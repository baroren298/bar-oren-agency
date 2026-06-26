/*
 * AuditLog listener — PLACEHOLDER ONLY (Sprint 3.2).
 *
 * ADMIN_PANEL_PLAN.md Section 13.7 calls for this listener to be the only
 * writer of AuditLog rows, built from whichever Event triggered it
 * ("auditLogListener.js — turns each Event into an AuditLog row — the
 * only writer of AuditLog rows", Section 13.2). Full projection logic
 * (mapping each EVENT_TYPE to an ActionType, and deriving the
 * metadataBefore/metadataAfter snapshot from the event's payload) is
 * deliberately deferred to a later sprint — implementing it now would mean
 * committing to a per-event-type mapping before ProposalService /
 * ApprovalService / PublishService (which actually produce those events)
 * exist to validate the mapping against.
 *
 * This file exists now only so the listener registry (./index.js) has a
 * real, named seam to register against once it's ready. It is NOT
 * registered in ./index.js's active listener list yet — see that file.
 */

/**
 * @param {{ id: string, type: string, entityType: string, entityId: string,
 *   actorId: string|null, correlationId: string, payload: object,
 *   metadata: object, createdAt: Date }} event
 */
export async function auditLogListener(/* event */) {
  // Intentionally not implemented yet — see header comment. This throws
  // rather than silently no-op-ing so that registering it by mistake
  // before it's ready fails loudly instead of producing a false sense of
  // audit coverage.
  throw new Error(
    '[lib/admin/engine/listeners/auditLogListener] Not implemented yet — ' +
      'full AuditLog projection (ADMIN_PANEL_PLAN.md Section 13.7) is ' +
      'scoped to a later sprint. This listener is not registered in ' +
      './index.js, so this should never actually be invoked by eventService.'
  );
}

export default auditLogListener;
