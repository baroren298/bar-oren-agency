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
 */

import { prisma } from '../db';
import { notImplemented } from './_notImplemented';

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
};

export default auditLogRepository;
