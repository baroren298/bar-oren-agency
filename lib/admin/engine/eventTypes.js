/*
 * Event type catalog — ADMIN_PANEL_PLAN.md Section 13.2 ("the catalog of
 * valid event type strings ... plain strings, not a Postgres enum, since
 * this list is expected to grow continuously").
 *
 * NAMING CONVENTION (decided here, Sprint 3.2, resolving the open question
 * in Section 13.13/14 "Open questions"): generic `<Action>` names with no
 * entity prefix — e.g. `ProposalCreated`, not `TalentProposalCreated`.
 * Rationale: the engine itself is entity-agnostic (Section 13.9) and the
 * acting entity is always already present on the Event row's own
 * `entityType`/`entityId` columns, so baking it into the type string would
 * be redundant and would multiply the catalog by every adapter. Reserve an
 * entity-prefixed name only for an event that is conceptually specific to
 * one content type with no generic equivalent — none exist yet.
 *
 * SPRINT 3.2 SCOPE NOTE: this sprint only builds the EventService plumbing
 * (lib/admin/engine/eventService.js). Nothing yet calls `emit()` with these
 * types — ProposalService/ApprovalService/PublishService, which will, are
 * later sprints. The list is seeded now so eventService's validation has a
 * real catalog to check against, and so those future services have an
 * agreed vocabulary instead of inventing ad hoc strings later.
 */

export const EVENT_TYPE = Object.freeze({
  PROPOSAL_CREATED: 'ProposalCreated',
  PROPOSAL_UPDATED: 'ProposalUpdated',
  PROPOSAL_SUBMITTED: 'ProposalSubmitted',
  PROPOSAL_APPROVED: 'ProposalApproved',
  PROPOSAL_REJECTED: 'ProposalRejected',
  VERSION_PUBLISHED: 'VersionPublished',
  // Gallery Upload Sprint 1 (GALLERY_UPLOAD_SPRINT_1_ARCHITECTURE.md §11) —
  // emitted by lib/admin/engine/assetService.js. `Asset` is lifecycle-
  // neutral (no VersionStatus of its own), so this is a generic upload
  // event, not a proposal/version event — same naming convention as above,
  // no entity prefix needed since the Event row's own entityType/entityId
  // already record what was uploaded.
  ASSET_UPLOADED: 'AssetUploaded',
  // Cancel Editing / Discard Draft sprint — emitted by
  // proposalService.discard(). Maps to ActionType.DELETED in
  // auditLogListener (that enum value + AuditLog.deletedById already exist,
  // so this needs no schema change, unlike VERSION_PUBLISHED/ASSET_UPLOADED
  // above).
  PROPOSAL_DISCARDED: 'ProposalDiscarded',
  // Administration Sprint 2a (Audit Log) — user-management events. These
  // use a `User` prefix deliberately, per this file's own convention note
  // above: a prefixed name is reserved for events conceptually specific to
  // one entity with no generic equivalent, which account management is
  // (accounts have no proposal/version lifecycle — see lib/admin/
  // userService.js's header). The Event row's entityType is USER and
  // entityId is the TARGET user's id; the acting Owner goes in actorId.
  // NOTHING EMITS THESE YET — emission is Sprint 2b (userService); this
  // sprint only catalogues the vocabulary and wires the auditLogListener
  // projection so 2b needs no listener/schema work.
  USER_CREATED: 'UserCreated',
  USER_DETAILS_UPDATED: 'UserDetailsUpdated',
  USER_ACTIVATED: 'UserActivated',
  USER_DEACTIVATED: 'UserDeactivated',
  USER_PASSWORD_RESET: 'UserPasswordReset',
  // Sprint 3b (Session Management API) — Owner-initiated session
  // revocation, emitted by lib/admin/sessionManagementService.js. Same
  // `User` prefix rationale as the Sprint 2a block above (account/session
  // management is conceptually user-specific). Payloads are allowlisted at
  // emission to { scope } / { scope, revokedCount } ONLY — never a sid,
  // token, or any request/connection data. UserSessionRevoked is emitted
  // only for an EFFECTIVE single revocation (count === 1);
  // UserSessionsRevoked records revoke-all INTENT and is emitted even when
  // revokedCount is 0.
  USER_SESSION_REVOKED: 'UserSessionRevoked',
  USER_SESSIONS_REVOKED: 'UserSessionsRevoked',
});

const VALID_EVENT_TYPES = new Set(Object.values(EVENT_TYPE));

/** True if `type` is a known, catalogued event type string. */
export function isValidEventType(type) {
  return VALID_EVENT_TYPES.has(type);
}
