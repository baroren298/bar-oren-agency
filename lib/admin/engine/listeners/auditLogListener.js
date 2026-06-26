/*
 * AuditLog listener — Sprint 3.7 implements the real projection described
 * in ADMIN_PANEL_PLAN.md Section 13.7: "turns each Event into an AuditLog
 * row — the only writer of AuditLog rows" (Section 13.2). Registered live
 * in ./index.js as of this sprint.
 *
 * EVENT_TYPE -> ActionType mapping (approved this sprint):
 *   PROPOSAL_CREATED   -> CREATED
 *   PROPOSAL_SUBMITTED -> PROPOSED
 *   PROPOSAL_APPROVED  -> APPROVED
 *   PROPOSAL_REJECTED  -> REJECTED
 *   PROPOSAL_UPDATED   -> UPDATED  (catalogued; nothing emits this yet)
 *
 * DELIBERATE, DOCUMENTED GAP — VERSION_PUBLISHED is NOT mapped here.
 * `ActionType` (prisma/schema.prisma) has no `PUBLISHED` value, and adding
 * one is a schema migration, which is out of scope for this sprint. Rather
 * than force VERSION_PUBLISHED into an existing, semantically wrong
 * ActionType (e.g. APPROVED), this listener treats any event type with no
 * entry in EVENT_TYPE_TO_ACTION_TYPE as a recognized, intentional no-op —
 * not an error. In v1's composition (approvalService.approve() always
 * calls publishService.publish() in the same transaction, Section 13.5),
 * the PROPOSAL_APPROVED row already records that the action happened; the
 * publish step itself simply has no dedicated audit row yet. This should
 * be revisited together with a future schema sprint that adds
 * `ActionType.PUBLISHED` — at which point "approve now, publish later"
 * (Section 13.5) will need its own VERSION_PUBLISHED audit row anyway,
 * since that flow can publish without a fresh approve() call.
 *
 * Actor field mapping: AuditLog has five actor FKs (createdById,
 * updatedById, approvedById, rejectedById, deletedById) but ten
 * ActionType values (Section 4.1) — RESTORED/ARCHIVED/LOGIN/LOGIN_FAILED
 * have no dedicated column and aren't produced by this listener yet (no
 * event type maps to them). PROPOSED has no dedicated column either; it is
 * recorded under `createdById`, since the actor "proposing" (submitting
 * their own DRAFT for review) is the same person the CREATED action's
 * `createdById` already represents — there is no separate "proposed by"
 * concept distinct from "authored by" in the current schema.
 *
 * metadataBefore/metadataAfter (Section 4.1: "JSON snapshots of the
 * relevant fields immediately before and after the action, not the entire
 * row"): none of the current event payloads (proposalService/
 * approvalService) carry a genuine "before" snapshot — they carry only the
 * versionId and, for PROPOSAL_CREATED, the proposed `fields` themselves.
 * So `metadataBefore` is left `null` and `metadataAfter` is the event's
 * `payload` as-is. Producing a real before/after diff would mean changing
 * what proposalService/approvalService/publishService put in `payload`,
 * which is out of this sprint's scope (this listener only projects what
 * already exists, per Section 13.16: services own business logic, the
 * listener owns translation only).
 */

import { ACTION_TYPE } from '../../constants/enums';
import { EVENT_TYPE } from '../eventTypes';
import { auditLogRepository } from '../../repository/auditLogRepository';

/** EVENT_TYPE string -> ActionType string. Absent key = intentional no-op (see header). */
const EVENT_TYPE_TO_ACTION_TYPE = Object.freeze({
  [EVENT_TYPE.PROPOSAL_CREATED]: ACTION_TYPE.CREATED,
  [EVENT_TYPE.PROPOSAL_SUBMITTED]: ACTION_TYPE.PROPOSED,
  [EVENT_TYPE.PROPOSAL_APPROVED]: ACTION_TYPE.APPROVED,
  [EVENT_TYPE.PROPOSAL_REJECTED]: ACTION_TYPE.REJECTED,
  [EVENT_TYPE.PROPOSAL_UPDATED]: ACTION_TYPE.UPDATED,
  // EVENT_TYPE.VERSION_PUBLISHED is intentionally absent — see header.
});

/** ActionType -> which AuditLog actor column it populates. See header note on PROPOSED. */
const ACTOR_FIELD_BY_ACTION_TYPE = Object.freeze({
  [ACTION_TYPE.CREATED]: 'createdById',
  [ACTION_TYPE.PROPOSED]: 'createdById',
  [ACTION_TYPE.UPDATED]: 'updatedById',
  [ACTION_TYPE.APPROVED]: 'approvedById',
  [ACTION_TYPE.REJECTED]: 'rejectedById',
  [ACTION_TYPE.DELETED]: 'deletedById',
});

/**
 * Project one Event into one AuditLog row, or do nothing for an event type
 * with no mapping yet (a recognized, intentional gap — see header — not a
 * bug). This is the only function in the codebase permitted to call
 * `auditLogRepository.record()` (Section 13.18).
 *
 * @param {{ id: string, type: string, entityType: string, entityId: string,
 *   actorId: string|null, correlationId: string, payload: object,
 *   metadata: object, createdAt: Date }} event
 */
export async function auditLogListener(event) {
  if (!event || !event.type) {
    throw new Error('[auditLogListener] received an event with no "type".');
  }

  const actionType = EVENT_TYPE_TO_ACTION_TYPE[event.type];
  if (!actionType) {
    // Intentional no-op — e.g. VERSION_PUBLISHED (see header comment).
    // Not an error: eventService treats a *throwing* listener as a logged
    // failure (Section 13.13), which this deliberately is not.
    return;
  }

  const entry = {
    actionType,
    entityType: event.entityType,
    entityId: event.entityId,
    targetVersionId: (event.payload && event.payload.versionId) || null,
    metadataBefore: null,
    metadataAfter: event.payload ?? null,
  };

  const actorField = ACTOR_FIELD_BY_ACTION_TYPE[actionType];
  if (actorField && event.actorId) {
    entry[actorField] = event.actorId;
  }

  await auditLogRepository.record(entry);
}

export default auditLogListener;
