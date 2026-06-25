/*
 * AuditLog repository — skeleton only (Phase 1: Foundations).
 * Planned API per ADMIN_PANEL_PLAN.md Section 4.1. Every other repository
 * is expected to call `record()` as part of the same transaction as the
 * action it's logging, once those repositories are implemented (Phase 5
 * onward) — the log itself is append-only and never updated or deleted.
 */

import { notImplemented } from './_notImplemented';

export const auditLogRepository = {
  /**
   * Append one audit log row. Expected shape (Section 4.1):
   * { actionType, entityType, entityId, targetVersionId,
   *   createdById|updatedById|approvedById|rejectedById|deletedById,
   *   ipAddress, userAgent, metadataBefore, metadataAfter }
   * (Phase 5)
   */
  async record(/* entry */) {
    return notImplemented('auditLogRepository.record');
  },

  /** List audit log rows for a given entity, newest first — powers /admin/history. (Phase 5) */
  async listForEntity(/* entityType, entityId */) {
    return notImplemented('auditLogRepository.listForEntity');
  },
};

export default auditLogRepository;
