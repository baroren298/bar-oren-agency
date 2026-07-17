/*
 * Audit Log narrative projection — Administration Sprint 2c.
 *
 * Pure presentation helpers (no I/O, no Prisma — same guardrail as
 * lib/admin/talent-history.js) that turn auditLogService.listEntries()'s
 * safe DTO rows into what the /admin/audit-log UI renders: a human-readable
 * Hebrew sentence ("בר עדכן את כתובת האימייל של נועה כהן"), an action
 * badge, and the allowlisted expandable detail rows.
 *
 * Product principle (sprint brief): the PRIMARY view is narrative, not raw
 * event data. Raw values (enum names) appear only in the small action
 * badge; technical details render only inside the explicit expandable
 * section, and only fields the service already allowlisted.
 *
 * Unknown/future compatibility: an ActionType or EntityType this build
 * doesn't recognize must degrade gracefully, never crash — it renders the
 * generic fallback narrative with a raw-value badge. Never synthesize
 * facts that weren't stored (talent-history.js's hard rule applies here
 * too): a missing actor is "המערכת", a missing target label is the entity
 * type's generic noun, never a guess.
 */

import { he } from './i18n/he';
import { ACTION_TYPE, ENTITY_TYPE } from './constants/enums';

const t = he.auditLog;

/** Actor display precedence: displayName → email → system fallback. */
export function resolveActorName(actor) {
  if (actor && typeof actor === 'object') {
    if (actor.displayName) return actor.displayName;
    if (actor.email) return actor.email;
  }
  return t.systemActor;
}

/** Safe target text: resolved label, else the entity type's generic noun. */
export function resolveTargetText(entry) {
  if (entry?.targetLabel) return entry.targetLabel;
  return t.targetNoun[entry?.entityType] || t.targetNoun.unknown;
}

function fill(template, { actor, target }) {
  return template.replace('{actor}', actor).replace('{target}', target);
}

/** Content-engine entity types that share the proposal narrative verbs. */
const CONTENT_ENTITY_TYPES = new Set([
  ENTITY_TYPE.TALENT,
  ENTITY_TYPE.SITE_CONTENT,
  ENTITY_TYPE.SEO,
  ENTITY_TYPE.LEGAL_PAGE,
  ENTITY_TYPE.COLLABORATIONS,
  ENTITY_TYPE.AGENCY_SOCIAL,
  ENTITY_TYPE.IMAGE_ASSET,
]);

/**
 * The narrative sentence for one safe audit entry.
 *
 * @param {{ actionType: string, entityType: string, actor: object|null,
 *   targetLabel: string|null, changedField: string|null }} entry —
 *   auditLogService DTO shape.
 * @returns {string}
 */
export function buildNarrative(entry) {
  const actor = resolveActorName(entry?.actor);
  const target = resolveTargetText(entry);
  const vars = { actor, target };

  if (entry?.entityType === ENTITY_TYPE.USER) {
    const userT = t.narrative.user;
    switch (entry.actionType) {
      case ACTION_TYPE.CREATED:
        return entry.targetLabel
          ? fill(userT.CREATED, vars)
          : fill(userT.CREATED_NO_TARGET, vars);
      case ACTION_TYPE.UPDATED:
        if (entry.changedField === 'email') return fill(userT.UPDATED_EMAIL, vars);
        if (entry.changedField === 'displayName') return fill(userT.UPDATED_DISPLAY_NAME, vars);
        return fill(userT.UPDATED, vars);
      case ACTION_TYPE.ACTIVATED:
        return fill(userT.ACTIVATED, vars);
      case ACTION_TYPE.DEACTIVATED:
        return fill(userT.DEACTIVATED, vars);
      case ACTION_TYPE.PASSWORD_RESET:
        return fill(userT.PASSWORD_RESET, vars);
      case ACTION_TYPE.SESSION_REVOKED:
        return fill(userT.SESSION_REVOKED, vars);
      case ACTION_TYPE.SESSIONS_REVOKED:
        return fill(userT.SESSIONS_REVOKED, vars);
      default:
        break; // unknown user action → generic fallback below
    }
  } else if (CONTENT_ENTITY_TYPES.has(entry?.entityType)) {
    const template = t.narrative.content[entry.actionType];
    if (template) return fill(template, vars);
  }

  // Unknown entityType, or known entityType with an unmapped/future
  // actionType — graceful generic sentence; the badge still carries the
  // specific (possibly raw) action value.
  return fill(t.narrative.fallback, vars);
}

/**
 * Badge text for the row's action. Known ActionTypes get the translated
 * label; unknown/future values fall back to the raw enum string — a safe,
 * non-sensitive constant that keeps the row honest without crashing.
 *
 * @param {string} actionType
 * @returns {string}
 */
export function buildActionBadge(actionType) {
  return t.badge[actionType] || String(actionType || '');
}

/**
 * Badge variant per action — Sprint 2c UI-polish pass. Purely a
 * presentation vocabulary: each variant maps to a page-local CSS class in
 * audit-log.module.css (restrained semantic colors derived from the admin
 * token palette). Replaces the earlier 5-tone StatusBadge mapping so the
 * Audit Log's action semantics ("created" green vs "activated" darker
 * green vs "password reset" orange) don't get flattened into the shared
 * component's generic tones — and the shared StatusBadge stays untouched.
 *
 * 'PUBLISHED' is a string key on purpose: ActionType has no PUBLISHED
 * value yet (documented Sprint 2a gap); the style hook is ready for the
 * future schema sprint that adds it. Unknown/future actions → neutral.
 */
const BADGE_VARIANT = Object.freeze({
  [ACTION_TYPE.CREATED]: 'created', // green
  [ACTION_TYPE.UPDATED]: 'updated', // blue
  [ACTION_TYPE.PROPOSED]: 'updated', // blue — a submission is an update-flow step
  [ACTION_TYPE.APPROVED]: 'affirmed', // darker green
  [ACTION_TYPE.ACTIVATED]: 'affirmed',
  [ACTION_TYPE.RESTORED]: 'affirmed',
  [ACTION_TYPE.REJECTED]: 'negative', // muted red
  [ACTION_TYPE.DEACTIVATED]: 'negative',
  [ACTION_TYPE.DELETED]: 'negative',
  [ACTION_TYPE.LOGIN_FAILED]: 'negative',
  [ACTION_TYPE.PASSWORD_RESET]: 'security', // orange
  // Sprint 3b — session revocation is a security action, same tone as
  // password reset, not a destructive/negative one like deactivate/delete.
  [ACTION_TYPE.SESSION_REVOKED]: 'security',
  [ACTION_TYPE.SESSIONS_REVOKED]: 'security',
  PUBLISHED: 'published', // muted purple (future ActionType — see above)
  [ACTION_TYPE.LOGIN]: 'neutral',
  [ACTION_TYPE.ARCHIVED]: 'neutral',
});

/** @param {string} actionType @returns {string} badge variant name (CSS vocabulary) */
export function buildActionBadgeVariant(actionType) {
  return BADGE_VARIANT[actionType] || 'neutral';
}

/**
 * Icon key per entry — Sprint 2c UI-polish pass. Decorative-only concept
 * vocabulary; AuditLogPageClient maps each key to a small inline SVG
 * (aria-hidden — the narrative and badge already carry the information).
 * Action semantics win over entity type (a password reset shows the key
 * icon, not the person icon); USER entity is the tiebreak for
 * create/generic; unknown anything → the safe generic icon.
 */
export function buildIconKey(actionType, entityType) {
  switch (actionType) {
    case ACTION_TYPE.PASSWORD_RESET:
    case ACTION_TYPE.SESSION_REVOKED:
    case ACTION_TYPE.SESSIONS_REVOKED:
      return 'security';
    case ACTION_TYPE.APPROVED:
    case ACTION_TYPE.ACTIVATED:
    case ACTION_TYPE.RESTORED:
      return 'approve';
    case ACTION_TYPE.REJECTED:
    case ACTION_TYPE.DEACTIVATED:
    case ACTION_TYPE.DELETED:
    case ACTION_TYPE.LOGIN_FAILED:
      return 'reject';
    case ACTION_TYPE.UPDATED:
    case ACTION_TYPE.PROPOSED:
      return 'edit';
    case 'PUBLISHED': // future ActionType — hook ready, see BADGE_VARIANT
      return 'publish';
    case ACTION_TYPE.CREATED:
    case ACTION_TYPE.LOGIN:
      return entityType === ENTITY_TYPE.USER ? 'user' : 'edit';
    default:
      return entityType === ENTITY_TYPE.USER ? 'user' : 'generic';
  }
}

/* Relative-time thresholds (ms). Pure + clock-injected so it's
 * deterministic and unit-testable; the CLIENT decides when to call it
 * (after mount only — hydration safety lives in AuditLogPageClient, not
 * here). Beyond "yesterday" we return null and the caller keeps the exact
 * date as the primary label — old audit rows are better served by a real
 * date than by "לפני 3 שבועות". */
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Hebrew relative-time label for a timestamp, or null when the exact date
 * should be shown instead (future timestamps, >48h old, or unparseable).
 *
 * @param {string} isoString — entry.createdAt
 * @param {number} nowMs — injected clock (Date.now() at the call site)
 * @returns {string|null}
 */
export function formatRelativeTime(isoString, nowMs) {
  const then = Date.parse(isoString);
  if (Number.isNaN(then) || typeof nowMs !== 'number') return null;

  const diff = nowMs - then;
  const rt = t.time;
  if (diff < 0) return null; // clock skew / future — fall back to exact date
  if (diff < MINUTE) return rt.justNow;
  if (diff < 2 * MINUTE) return rt.minuteAgo;
  if (diff < HOUR) return rt.minutesAgo.replace('{count}', String(Math.floor(diff / MINUTE)));
  if (diff < 2 * HOUR) return rt.hourAgo;
  if (diff < 3 * HOUR) return rt.twoHoursAgo;
  if (diff < DAY) return rt.hoursAgo.replace('{count}', String(Math.floor(diff / HOUR)));
  if (diff < 2 * DAY) return rt.yesterday;
  return null; // older — exact date is the honest label
}

/**
 * The expandable technical-details rows for one entry, built ONLY from the
 * service's already-allowlisted `details` object — this module adds no new
 * fields, it only formats what the service exposed. Returns [] when there
 * is nothing safe to show (the UI then renders no expand control).
 *
 * @param {{ details: object|null }} entry
 * @returns {Array<{ label: string, value: string }>}
 */
export function buildDetailRows(entry) {
  const details = entry?.details;
  if (!details || typeof details !== 'object') return [];

  const rows = [];
  const dt = t.details;

  // Before/after change rows (USER_DETAILS_UPDATED): one row per changed
  // profile field, "before → after".
  const changed = Array.isArray(details.changedFields) ? details.changedFields : [];
  for (const field of changed) {
    if (field !== 'email' && field !== 'displayName') continue; // allowlist
    const beforeValue = details.before?.[field] ?? dt.emptyValue;
    const afterValue = details.after?.[field] ?? dt.emptyValue;
    rows.push({ label: dt[field], value: `${beforeValue} ← ${afterValue}` });
  }

  // Sprint 3b — revoke-all count (UserSessionsRevoked only; single-revoke
  // has no count worth a row, the narrative already says "one session").
  if (typeof details.revokedCount === 'number') {
    rows.push({ label: dt.revokedCount, value: String(details.revokedCount) });
  }

  // Creation snapshot rows (USER_CREATED): the created account's business
  // fields. Skipped when already covered by a before/after row above.
  if (changed.length === 0) {
    if (details.email) rows.push({ label: dt.email, value: details.email });
    if (details.displayName) rows.push({ label: dt.displayName, value: details.displayName });
    if (details.role) {
      const roleLabel =
        details.role === 'OWNER' ? he.roles.owner : details.role === 'EMPLOYEE' ? he.roles.employee : details.role;
      rows.push({ label: dt.role, value: roleLabel });
    }
  }

  return rows;
}

/**
 * Full display projection for a page of service entries — what the client
 * component maps over. Pure; safe on empty/undefined input.
 *
 * @param {Array<object>} entries — auditLogService DTO rows.
 * @returns {Array<{ id: string, narrative: string, badge: string,
 *   badgeVariant: string, iconKey: string, createdAt: string,
 *   detailRows: Array<{label: string, value: string}> }>}
 */
export function buildAuditLogDisplayItems(entries) {
  const list = Array.isArray(entries) ? entries : [];
  return list.map((entry) => ({
    id: entry.id,
    narrative: buildNarrative(entry),
    badge: buildActionBadge(entry.actionType),
    badgeVariant: buildActionBadgeVariant(entry.actionType),
    iconKey: buildIconKey(entry.actionType, entry.entityType),
    createdAt: entry.createdAt,
    detailRows: buildDetailRows(entry),
  }));
}
