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
 * SAME GAP, SAME REASON — ASSET_UPLOADED (Gallery Upload Sprint 1,
 * GALLERY_UPLOAD_SPRINT_1_ARCHITECTURE.md §11) is also NOT mapped here.
 * `ActionType` has no `UPLOADED` value, and adding one is a schema change
 * out of this sprint's scope. The `Event` row itself (emitted by
 * assetService) is the durable record that an upload happened; this
 * listener's silent no-op for unmapped types means that fact simply has no
 * AuditLog projection yet, exactly like VERSION_PUBLISHED above.
 *
 * USER EVENTS — Administration Sprint 2a (Audit Log): the five
 * user-management event types (UserCreated, UserDetailsUpdated,
 * UserActivated, UserDeactivated, UserPasswordReset) are mapped below to
 * CREATED / UPDATED / ACTIVATED / DEACTIVATED / PASSWORD_RESET (the last
 * three added to ActionType by this sprint's additive migration). Nothing
 * emits them yet — emission from userService is Sprint 2b. For these rows
 * entityType is USER and entityId is the TARGET user's id; the acting
 * Owner (event.actorId) is recorded under `updatedById`/`createdById` per
 * ACTOR_FIELD_BY_ACTION_TYPE below.
 *
 * SESSION EVENTS — Sprint 3b (Session Management API): UserSessionRevoked /
 * UserSessionsRevoked (emitted by lib/admin/sessionManagementService.js)
 * map to ActionType.SESSION_REVOKED / SESSIONS_REVOKED, also added by this
 * sprint's additive migration. Same USER entityType/entityId convention as
 * the block above; actor lands under `updatedById`. payload carries only
 * the allowlisted `{ scope }` / `{ scope, revokedCount }` — never a sid.
 *
 * Actor field mapping: AuditLog has five actor FKs (createdById,
 * updatedById, approvedById, rejectedById, deletedById) but more
 * ActionType values (Section 4.1) — RESTORED/LOGIN/LOGIN_FAILED have no
 * dedicated column and aren't produced by this listener yet (no event
 * type maps to them). ARCHIVED is produced as of Sprint 7B (client/brand
 * archive) and reuses deletedById — see ACTOR_FIELD_BY_ACTION_TYPE. PROPOSED has no dedicated column either; it is
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
  // Cancel Editing / Discard Draft sprint — unlike VERSION_PUBLISHED/
  // ASSET_UPLOADED below, ActionType.DELETED already exists (Section 4.1)
  // and AuditLog already has a deletedById column, so this one *is* mapped.
  [EVENT_TYPE.PROPOSAL_DISCARDED]: ACTION_TYPE.DELETED,
  // Administration Sprint 2a (Audit Log) — user-management projections.
  // ACTIVATED/DEACTIVATED/PASSWORD_RESET were added to ActionType in this
  // sprint's additive migration. Nothing emits these event types yet
  // (emission is Sprint 2b); the mapping is wired now so 2b is
  // emission-only.
  [EVENT_TYPE.USER_CREATED]: ACTION_TYPE.CREATED,
  [EVENT_TYPE.USER_DETAILS_UPDATED]: ACTION_TYPE.UPDATED,
  [EVENT_TYPE.USER_ACTIVATED]: ACTION_TYPE.ACTIVATED,
  [EVENT_TYPE.USER_DEACTIVATED]: ACTION_TYPE.DEACTIVATED,
  [EVENT_TYPE.USER_PASSWORD_RESET]: ACTION_TYPE.PASSWORD_RESET,
  // Sprint 3b (Session Management API) — SESSION_REVOKED/SESSIONS_REVOKED
  // were added to ActionType in this sprint's additive migration
  // (prisma/migrations/20260716140000_session_management_action_types).
  // Emitted by lib/admin/sessionManagementService.js; entityType is USER
  // (the target user), same convention as the other user-management rows.
  [EVENT_TYPE.USER_SESSION_REVOKED]: ACTION_TYPE.SESSION_REVOKED,
  [EVENT_TYPE.USER_SESSIONS_REVOKED]: ACTION_TYPE.SESSIONS_REVOKED,
  // Sprint 7B (Clients & Brands Foundation) — client/brand management
  // projections, emitted by lib/admin/clientService.js. CREATED/UPDATED/
  // ARCHIVED all pre-exist in ActionType (Section 4.1), so unlike
  // VERSION_PUBLISHED below this needs no ActionType migration — ARCHIVED
  // is used here for the first time, with the honest entity-lifecycle
  // semantics it was reserved for. entityType is CLIENT/BRAND, entityId
  // the client/brand id; payloads are allowlisted at emission (names/
  // status/changed-field names only — never contact details or notes).
  [EVENT_TYPE.CLIENT_CREATED]: ACTION_TYPE.CREATED,
  [EVENT_TYPE.CLIENT_UPDATED]: ACTION_TYPE.UPDATED,
  [EVENT_TYPE.CLIENT_ARCHIVED]: ACTION_TYPE.ARCHIVED,
  [EVENT_TYPE.BRAND_CREATED]: ACTION_TYPE.CREATED,
  [EVENT_TYPE.BRAND_UPDATED]: ACTION_TYPE.UPDATED,
  [EVENT_TYPE.BRAND_ARCHIVED]: ACTION_TYPE.ARCHIVED,
  // EVENT_TYPE.VERSION_PUBLISHED is intentionally absent — see header.
  // EVENT_TYPE.ASSET_UPLOADED is intentionally absent — see header.
});

/** ActionType -> which AuditLog actor column it populates. See header note on PROPOSED. */
const ACTOR_FIELD_BY_ACTION_TYPE = Object.freeze({
  [ACTION_TYPE.CREATED]: 'createdById',
  [ACTION_TYPE.PROPOSED]: 'createdById',
  [ACTION_TYPE.UPDATED]: 'updatedById',
  [ACTION_TYPE.APPROVED]: 'approvedById',
  [ACTION_TYPE.REJECTED]: 'rejectedById',
  [ACTION_TYPE.DELETED]: 'deletedById',
  // Administration Sprint 2a — the three user-management ActionTypes have
  // no dedicated actor FK column (AuditLog keeps its existing five), so the
  // acting Owner is recorded under `updatedById`: semantically the actor
  // who changed the target user's account state. Deliberately no new
  // columns — same pattern as PROPOSED reusing createdById above.
  [ACTION_TYPE.ACTIVATED]: 'updatedById',
  [ACTION_TYPE.DEACTIVATED]: 'updatedById',
  [ACTION_TYPE.PASSWORD_RESET]: 'updatedById',
  // Sprint 3b — same reuse pattern: no dedicated FK for session-revocation
  // rows, so the acting Owner lands under updatedById.
  [ACTION_TYPE.SESSION_REVOKED]: 'updatedById',
  [ACTION_TYPE.SESSIONS_REVOKED]: 'updatedById',
  // Sprint 7B — ARCHIVED (client/brand archive) has no dedicated actor FK
  // either. The acting Owner lands under `deletedById`: archive is this
  // schema's lifecycle-removal concept (repositories stamp the row's own
  // deletedAt/deletedBy on archive — see clientRepository's header), so
  // the audit row's actor column mirrors the entity's attribution field
  // rather than the generic updatedById.
  [ACTION_TYPE.ARCHIVED]: 'deletedById',
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

  // Administration Sprint 2a — request-context passthrough. AuditLog has
  // always had ipAddress/userAgent columns (Section 4.1), but this listener
  // never populated them. Event.metadata is the documented home of
  // technical/request context (Section 13.6), so if the emitting service
  // put ipAddress/userAgent there, they now land in the matching columns.
  // Current emitters don't include them yet — rows keep getting null,
  // exactly as before — but Sprint 2b's user-mutation events will.
  const metadata = event.metadata || {};

  const entry = {
    actionType,
    entityType: event.entityType,
    entityId: event.entityId,
    targetVersionId: (event.payload && event.payload.versionId) || null,
    ipAddress: typeof metadata.ipAddress === 'string' ? metadata.ipAddress : null,
    userAgent: typeof metadata.userAgent === 'string' ? metadata.userAgent : null,
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
