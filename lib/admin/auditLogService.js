/*
 * Audit Log read service — Administration Sprint 2c (Audit Log module).
 *
 * OWNER-only, READ-ONLY. Composes auditLogRepository's raw rows into the
 * safe DTO consumed by /admin/audit-log and GET /api/admin/audit-log.
 * There are deliberately no write methods here — AuditLog rows are written
 * only by auditLogListener (Section 13.18), and this sprint adds no
 * mutation surface of any kind.
 *
 * SECURITY BOUNDARY — this service is the choke point that guarantees raw
 * audit data never reaches a route or page:
 *
 *   1. assertActorIsOwner (same second-gate pattern as userService /
 *      approvalService): callers (route handlers / server components) run
 *      requireOwner()/the page redirect first; this check is independent of
 *      that, so dropping one gate in a future refactor still leaves the
 *      other.
 *   2. DETAILS ALLOWLIST: `metadataAfter` is never spread or forwarded.
 *      buildSafeDetails() below copies specific, named keys only — the
 *      fields Sprint 2b's user events allowlisted at emission (email /
 *      displayName / role / changedFields / before / after, with before &
 *      after themselves re-projected to email/displayName only). Anything
 *      else in metadata — including anything a future emitter might add —
 *      is silently dropped. Passwords, hashes, tokens, cookies, secrets,
 *      and connection data (ipAddress/userAgent — not even selected by the
 *      repository) can therefore never render.
 *   3. Internal ids: the DTO exposes the AuditLog row's own `id` only
 *      (needed as the React key and the pagination cursor). Actor ids,
 *      target entity ids, and version ids are not exposed — targets are
 *      identified by human label, actors by displayName/email.
 *
 * Unknown/future compatibility: unknown ActionType or EntityType values
 * pass through as raw strings — the display layer (audit-log-display.js)
 * owns the graceful fallback; this service never throws on them.
 * A null/system actor (all five actor FKs empty) yields actor: null.
 *
 * Pagination: cursor-based, newest first, PAGE_SIZE rows per call. The
 * caller passes the previous page's last row id as `cursor`. `hasMore` is
 * derived by fetching one extra row (fetch N+1, return N).
 */

import { auditLogRepository } from './repository/auditLogRepository';
import { ROLE, ENTITY_TYPE } from './constants/enums';

export const AUDIT_LOG_PAGE_SIZE = 50;

function assertActorIsOwner(actorRole, action) {
  if (actorRole !== ROLE.OWNER) {
    const err = new Error(
      `[${action}] actorRole "${actorRole}" is not permitted — only OWNER may read the audit log.`
    );
    err.statusCode = 403;
    err.code = 'FORBIDDEN_ROLE';
    throw err;
  }
}

/**
 * The five AuditLog actor relations in the order auditLogListener populates
 * them (exactly one is set per row it writes). Checked in a fixed order so
 * a hypothetical multi-actor row still resolves deterministically.
 */
const ACTOR_RELATIONS = ['createdBy', 'updatedBy', 'approvedBy', 'rejectedBy', 'deletedBy'];

/** First populated actor relation → { displayName, email }, or null (system/unknown actor). */
function resolveActor(row) {
  for (const relation of ACTOR_RELATIONS) {
    const actor = row[relation];
    if (actor) {
      return { displayName: actor.displayName ?? null, email: actor.email ?? null };
    }
  }
  return null;
}

/** Copy only email/displayName off a before/after snapshot object. */
function pickProfileFields(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const out = {};
  if (typeof snapshot.email === 'string') out.email = snapshot.email;
  if (typeof snapshot.displayName === 'string') out.displayName = snapshot.displayName;
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * EXPLICIT ALLOWLIST projection of metadataAfter → the row's expandable
 * "details" object, or null when nothing safe is present. Every key below
 * is copied by name; nothing is spread. See the header's security notes.
 */
function buildSafeDetails(metadataAfter) {
  if (!metadataAfter || typeof metadataAfter !== 'object' || Array.isArray(metadataAfter)) {
    return null;
  }

  const details = {};

  // USER_CREATED payload (Sprint 2b): { email, displayName, role }.
  if (typeof metadataAfter.email === 'string') details.email = metadataAfter.email;
  if (typeof metadataAfter.displayName === 'string') details.displayName = metadataAfter.displayName;
  if (typeof metadataAfter.role === 'string') details.role = metadataAfter.role;

  // USER_DETAILS_UPDATED payload (Sprint 2b): { changedFields, before, after }.
  if (Array.isArray(metadataAfter.changedFields)) {
    const changedFields = metadataAfter.changedFields.filter((f) => typeof f === 'string');
    if (changedFields.length > 0) details.changedFields = changedFields;
  }
  const before = pickProfileFields(metadataAfter.before);
  const after = pickProfileFields(metadataAfter.after);
  if (before) details.before = before;
  if (after) details.after = after;

  return Object.keys(details).length > 0 ? details : null;
}

/** Extract the changed profile field name ('email' | 'displayName' | null) for the narrative. */
function resolveChangedField(details) {
  if (!details || !Array.isArray(details.changedFields)) return null;
  if (details.changedFields.includes('email')) return 'email';
  if (details.changedFields.includes('displayName')) return 'displayName';
  return null;
}

export const auditLogService = {
  /**
   * Owner-only. One newest-first page of safe audit entries.
   *
   * @param {{ actorRole: string, cursor?: string|null }} options
   * @returns {Promise<{ entries: Array<object>, nextCursor: string|null }>}
   *   entries: [{ id, actionType, entityType, createdAt (ISO string),
   *   actor: {displayName,email}|null, targetLabel: string|null,
   *   changedField: 'email'|'displayName'|null, details: object|null }]
   */
  async listEntries({ actorRole, cursor = null } = {}) {
    assertActorIsOwner(actorRole, 'auditLogService.listEntries');

    const safeCursor = typeof cursor === 'string' && cursor.length > 0 ? cursor : null;

    // Fetch one extra row to know whether another page exists.
    const rows = await auditLogRepository.listRecent({
      limit: AUDIT_LOG_PAGE_SIZE + 1,
      cursor: safeCursor,
    });
    const hasMore = rows.length > AUDIT_LOG_PAGE_SIZE;
    const pageRows = hasMore ? rows.slice(0, AUDIT_LOG_PAGE_SIZE) : rows;

    // Batch target-label resolution — one query per target kind, not per row.
    const userTargetIds = pageRows
      .filter((r) => r.entityType === ENTITY_TYPE.USER)
      .map((r) => r.entityId);
    const talentTargetIds = pageRows
      .filter((r) => r.entityType === ENTITY_TYPE.TALENT)
      .map((r) => r.entityId);

    const [userLabels, talentLabels] = await Promise.all([
      auditLogRepository.findUserLabels(userTargetIds),
      auditLogRepository.findTalentLabels(talentTargetIds),
    ]);

    const entries = pageRows.map((row) => {
      let targetLabel = null;
      if (row.entityType === ENTITY_TYPE.USER && row.entityId) {
        const user = userLabels.get(row.entityId);
        // Same precedence as actors: displayName first, email as fallback.
        targetLabel = user ? user.displayName || user.email || null : null;
      } else if (row.entityType === ENTITY_TYPE.TALENT && row.entityId) {
        targetLabel = talentLabels.get(row.entityId)?.label ?? null;
      }
      // Other/unknown entity types: no label — the display layer falls back
      // to a generic entity-type noun. Deliberately no raw entityId leak.

      const details = buildSafeDetails(row.metadataAfter);

      return {
        id: row.id,
        actionType: row.actionType,
        entityType: row.entityType,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
        actor: resolveActor(row),
        targetLabel,
        changedField: resolveChangedField(details),
        details,
      };
    });

    return {
      entries,
      nextCursor: hasMore && pageRows.length > 0 ? pageRows[pageRows.length - 1].id : null,
    };
  },
};

export default auditLogService;
