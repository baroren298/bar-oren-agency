/*
 * AuditLog repository — Sprint 3.7 implements `record()` for real. Per
 * ADMIN_PANEL_PLAN.md Section 13.7/13.18, the only permitted caller of
 * `record()` is `auditLogListener.js` (lib/admin/engine/listeners/
 * auditLogListener.js) — no other service, adapter, or route may write an
 * AuditLog row directly. This repository itself makes no decision about
 * *whether* a row should be written or what `actionType` it gets; that
 * mapping lives in the listener (Section 13.16: repositories are a thin
 * data-access layer, no business logic).
 *
 * Append-only (Section 13.16: "Events are append-only," and AuditLog
 * mirrors that convention per Section 4.1) — there is deliberately no
 * `update`/`delete` method here.
 *
 * `listForEntity` (the read side powering /admin/history, Phase 5) is left
 * as a stub — out of scope for this sprint per the approved plan.
 *
 * Administration Sprint 2c adds the global read side (`listRecent` +
 * `findUserLabels`/`findTalentLabels`) powering the OWNER-only
 * /admin/audit-log page. Read-only — the append-only convention above is
 * untouched. Actor rows are projected through ACTOR_SELECT (displayName +
 * email ONLY — never passwordHash or any other column), mirroring
 * userRepository's SAFE_USER_SELECT reasoning: sensitive columns are
 * excluded at the query, not filtered later.
 */

import { prisma } from '../db';
import { notImplemented } from './_notImplemented';

/**
 * Safe projection for the five AuditLog actor relations. Deliberately no
 * `id`: the audit UI identifies actors by name/email, and internal user ids
 * are not useful to display (Sprint 2c security rules).
 */
const ACTOR_SELECT = { select: { displayName: true, email: true } };

/** Hard ceiling on one page of audit rows, whatever the caller asks for. */
const MAX_PAGE_SIZE = 100;

export const auditLogRepository = {
  /**
   * Append one audit log row. Expected shape (Section 4.1):
   * { actionType, entityType, entityId, targetVersionId,
   *   createdById, updatedById, approvedById, rejectedById, deletedById,
   *   ipAddress, userAgent, metadataBefore, metadataAfter }
   * Only the actor field(s) relevant to `actionType` need be populated —
   * all are nullable on the model, and the caller (auditLogListener)
   * decides which one(s) apply.
   *
   * @param {object} entry
   * @returns {Promise<object>} the created AuditLog row
   */
  async record({
    actionType,
    entityType,
    entityId = null,
    targetVersionId = null,
    createdById = null,
    updatedById = null,
    approvedById = null,
    rejectedById = null,
    deletedById = null,
    ipAddress = null,
    userAgent = null,
    metadataBefore = null,
    metadataAfter = null,
  } = {}) {
    if (!actionType) {
      throw new Error('[auditLogRepository.record] actionType is required.');
    }
    if (!entityType) {
      throw new Error('[auditLogRepository.record] entityType is required.');
    }

    return prisma.auditLog.create({
      data: {
        actionType,
        entityType,
        entityId,
        targetVersionId,
        createdById,
        updatedById,
        approvedById,
        rejectedById,
        deletedById,
        ipAddress,
        userAgent,
        metadataBefore,
        metadataAfter,
      },
    });
  },

  /** List audit log rows for a given entity, newest first — powers /admin/history. (Phase 5) */
  async listForEntity(/* entityType, entityId */) {
    return notImplemented('auditLogRepository.listForEntity');
  },

  /**
   * Administration Sprint 2c — global audit listing, newest first
   * (createdAt desc, id desc as a stable tiebreak), cursor-paginated.
   *
   * Selects scalar columns explicitly (no `metadataBefore` spread concerns —
   * both metadata columns ARE read here, but auditLogService projects them
   * through an explicit allowlist before anything reaches a route/page; raw
   * metadata never crosses the service boundary). ipAddress/userAgent are
   * deliberately NOT selected: Sprint 2c's display excludes connection data
   * entirely, so the read side doesn't even fetch it.
   *
   * @param {{ limit?: number, cursor?: string|null }} options — `cursor` is
   *   the `id` of the last row of the previous page (exclusive).
   * @returns {Promise<Array<object>>} up to `limit` rows.
   */
  async listRecent({ limit = 50, cursor = null } = {}) {
    const take = Math.min(Math.max(1, Number(limit) || 50), MAX_PAGE_SIZE);

    return prisma.auditLog.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        actionType: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        metadataAfter: true,
        createdBy: ACTOR_SELECT,
        updatedBy: ACTOR_SELECT,
        approvedBy: ACTOR_SELECT,
        rejectedBy: ACTOR_SELECT,
        deletedBy: ACTOR_SELECT,
      },
    });
  },

  /**
   * Batch label lookup for USER audit targets. Returns only what the audit
   * narrative needs (displayName/email) keyed by id — never the full row.
   *
   * @param {string[]} userIds
   * @returns {Promise<Map<string, { displayName: string|null, email: string }>>}
   */
  async findUserLabels(userIds) {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (ids.length === 0) return new Map();

    const rows = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, displayName: true, email: true },
    });
    return new Map(rows.map((row) => [row.id, { displayName: row.displayName, email: row.email }]));
  },

  /**
   * Batch label lookup for TALENT audit targets: the published version's
   * name when one exists, else the slug (both are already public-facing
   * values — safe to show).
   *
   * @param {string[]} talentIds
   * @returns {Promise<Map<string, { label: string }>>}
   */
  async findTalentLabels(talentIds) {
    const ids = [...new Set((talentIds || []).filter(Boolean))];
    if (ids.length === 0) return new Map();

    const rows = await prisma.talent.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        slug: true,
        currentPublishedVersion: { select: { name: true } },
      },
    });
    return new Map(
      rows.map((row) => [row.id, { label: row.currentPublishedVersion?.name || row.slug }])
    );
  },
};

export default auditLogRepository;
