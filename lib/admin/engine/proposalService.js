/*
 * ProposalService — Sprint 3.3 (Core Content Engine, ADMIN_PANEL_PLAN.md
 * Section 13.3). Implements the "Proposal" step of Content -> Version ->
 * Proposal -> Approval -> Publish -> Events (Section 13.1).
 *
 * Generic and entity-agnostic per Section 13.9/13.16 ("Services own
 * business logic", "Adapters own translation only"): every method here
 * takes an `adapter` (Section 13.10 contract) as its first argument and
 * contains no entity-specific branching or field names. All
 * entity-specific behavior — what "valid" means, how a generic `parentId`
 * maps to a real foreign key column — lives only inside the adapter
 * passed in (e.g. lib/admin/engine/adapters/talentAdapter.js).
 *
 * Approval and Publish are explicitly out of scope here (later sprints,
 * Section 13.5) — this file never sets a version's status to PUBLISHED.
 */

import { assertImplementsAdapterContract } from './adapters/adapterContract';
import { conflictService } from './conflictService';
import { eventService } from './eventService';
import { EVENT_TYPE } from './eventTypes';
import { VERSION_STATUS } from '../constants/enums';

export const proposalService = {
  /**
   * Validate a set of proposed fields against the adapter's own rules.
   * Pure delegation — the engine never knows what "valid" means for a
   * given entity type (Section 13.9). Exposed standalone so a caller
   * (e.g. a future route handler) can validate before deciding to call
   * `create()` at all.
   *
   * @param {object} adapter
   * @param {object} fields
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validate(adapter, fields) {
    assertImplementsAdapterContract(adapter);
    return adapter.validate(fields);
  },

  /**
   * Create a new proposal. Per Section 13.3, a proposal is just a version
   * row — always created here in DRAFT status, since `submit()` (below)
   * is the documented transition into PROPOSED ("This split lets an
   * editor save partial work without it appearing as pending Owner
   * review").
   *
   * Runs the early, non-blocking conflict check (Section 13.8) so a
   * caller/UI can warn immediately if `basedOnRevisionNumber` is already
   * stale. This never blocks creation — the authoritative, blocking check
   * happens later, inside publishService's own transaction (not built in
   * this sprint).
   *
   * Emits `ProposalCreated` (Section 13.6: dedicated correlationId,
   * payload/metadata split) once the version row exists.
   *
   * @param {object} adapter - Section 13.10 contract
   * @param {object} params
   * @param {string} params.parentId
   * @param {object} params.fields - business fields, adapter-specific shape
   * @param {string} params.actorId
   * @param {string} [params.basedOnVersionId]
   * @param {number} [params.basedOnRevisionNumber]
   * @param {string} [params.correlationId]
   * @returns {Promise<{ version: object, conflict: object }>}
   */
  async create(
    adapter,
    { parentId, fields, actorId, basedOnVersionId, basedOnRevisionNumber, correlationId } = {}
  ) {
    assertImplementsAdapterContract(adapter);

    if (!parentId) {
      throw new Error('[proposalService.create] parentId is required.');
    }
    if (!actorId) {
      throw new Error('[proposalService.create] actorId is required.');
    }

    const validation = adapter.validate(fields);
    if (!validation || validation.valid !== true) {
      const errors =
        validation && Array.isArray(validation.errors) ? validation.errors.join('; ') : 'unknown validation error';
      throw new Error(`[proposalService.create] validation failed: ${errors}`);
    }

    // Early, non-blocking conflict check (Section 13.8) — informational
    // only at this stage, never prevents the DRAFT from being created.
    const conflict = await conflictService.checkRevision(adapter, {
      parentId,
      basedOnRevisionNumber,
    });

    const version = await adapter.insertProposedVersion(fields, {
      parentId,
      status: VERSION_STATUS.DRAFT,
      basedOnVersionId,
      basedOnRevisionNumber,
      createdById: actorId,
    });

    await eventService.emit(EVENT_TYPE.PROPOSAL_CREATED, {
      entityType: adapter.entityType,
      entityId: parentId,
      actorId,
      correlationId,
      payload: { versionId: version.id, fields },
      metadata: { conflict },
    });

    return { version, conflict };
  },

  /**
   * Submit a DRAFT proposal for review — flips it to PROPOSED (Section
   * 13.3), the point at which it becomes visible to the approval queue
   * (approvalService is a later sprint). Emits `ProposalSubmitted`.
   *
   * @param {object} adapter
   * @param {object} params
   * @param {string} params.parentId
   * @param {string} params.versionId
   * @param {string} params.actorId
   * @param {string} [params.correlationId]
   * @returns {Promise<object>} the updated version row
   */
  async submit(adapter, { parentId, versionId, actorId, correlationId } = {}) {
    assertImplementsAdapterContract(adapter);

    if (!parentId) {
      throw new Error('[proposalService.submit] parentId is required.');
    }
    if (!versionId) {
      throw new Error('[proposalService.submit] versionId is required.');
    }

    const version = await adapter.getVersion(versionId);
    if (!version) {
      throw new Error(`[proposalService.submit] no version found for id "${versionId}".`);
    }
    if (version.status !== VERSION_STATUS.DRAFT) {
      throw new Error(
        `[proposalService.submit] version "${versionId}" is "${version.status}", not DRAFT — ` +
          'only a DRAFT proposal can be submitted.'
      );
    }

    const submitted = await adapter.submitVersion(versionId);

    await eventService.emit(EVENT_TYPE.PROPOSAL_SUBMITTED, {
      entityType: adapter.entityType,
      entityId: parentId,
      actorId,
      correlationId,
      payload: { versionId },
      metadata: {},
    });

    return submitted;
  },

  /**
   * Save Draft sprint — update an existing DRAFT proposal's fields in
   * place (locked decision: edits update the existing version row, never
   * create a new version). Mirrors `submit()`'s "load, check status, act"
   * shape above, with four differences required by this feature's explicit
   * scope:
   *
   *   1. DRAFT-or-PROPOSED editability (required safeguard #4, widened by
   *      the "Editable PROPOSED" sprint): PUBLISHED/REJECTED/SUPERSEDED
   *      still throw. Per that sprint's product decision, a PROPOSED
   *      version stays editable in place until a future sprint's Owner
   *      review locks it (no IN_REVIEW status yet, no locking yet — this
   *      sprint only widens which statuses may be saved). This is the
   *      server-side authority — the only place that actually enforces it;
   *      UI-side disabling is a courtesy, not the guarantee.
   *   2. Validation never blocks (required safeguard #5): unlike `create()`,
   *      a failed `adapter.validate(fields)` does not throw. An incomplete
   *      Draft is an expected, supported state — full validation is
   *      reserved for Submit, a later sprint. The validation result is
   *      still computed and returned so a caller/UI can show non-blocking
   *      hints if it wants to.
   *   3. Conflict info is non-blocking (required safeguard #6): exactly
   *      like `create()`'s early check, `conflictService.checkRevision` is
   *      informational only here too — it never prevents the save.
   *   4. Calls `adapter.updateProposedVersion(versionId, fields)` directly
   *      (not via `assertImplementsAdapterContract`, since that method is
   *      deliberately not part of the required contract — see
   *      talentAdapter.js's header comment on this method). A clear error
   *      is thrown if the adapter doesn't implement it, rather than a
   *      confusing "not a function" crash.
   *
   * Emits `ProposalUpdated` (already catalogued in eventTypes.js, already
   * mapped to ACTION_TYPE.UPDATED in auditLogListener — this is the first
   * caller).
   *
   * @param {object} adapter - Section 13.10 contract, plus the optional
   *   `updateProposedVersion(versionId, fields)` capability
   * @param {object} params
   * @param {string} params.parentId
   * @param {string} params.versionId
   * @param {object} params.fields - partial business fields to write
   * @param {string} params.actorId
   * @param {number} [params.basedOnRevisionNumber] - for the non-blocking conflict check
   * @param {string} [params.correlationId]
   * @returns {Promise<{ version: object, conflict: object, validation: { valid: boolean, errors: string[] } }>}
   */
  async update(
    adapter,
    { parentId, versionId, fields, actorId, basedOnRevisionNumber, correlationId } = {}
  ) {
    assertImplementsAdapterContract(adapter);

    if (typeof adapter.updateProposedVersion !== 'function') {
      throw new Error(
        `[proposalService.update] adapter "${adapter.entityType}" does not implement ` +
          'updateProposedVersion — Save Draft is not supported for this entity type yet.'
      );
    }
    if (!parentId) {
      throw new Error('[proposalService.update] parentId is required.');
    }
    if (!versionId) {
      throw new Error('[proposalService.update] versionId is required.');
    }
    if (!actorId) {
      throw new Error('[proposalService.update] actorId is required.');
    }
    if (!fields || typeof fields !== 'object') {
      throw new Error('[proposalService.update] fields must be an object.');
    }

    const version = await adapter.getVersion(versionId);
    if (!version) {
      throw new Error(`[proposalService.update] no version found for id "${versionId}".`);
    }
    // Server-side authority (required safeguard #4, widened by "Editable
    // PROPOSED") — DRAFT and PROPOSED are both editable statuses; this is
    // the actual enforcement, any client-side disabling of the Save/Update
    // button is just a courtesy on top of this.
    if (version.status !== VERSION_STATUS.DRAFT && version.status !== VERSION_STATUS.PROPOSED) {
      throw new Error(
        `[proposalService.update] version "${versionId}" is "${version.status}", not DRAFT or ` +
          'PROPOSED — only a DRAFT or PROPOSED proposal can be edited.'
      );
    }

    // Non-blocking: an incomplete Draft is allowed (required safeguard #5).
    // Full validation gates Submit, not Save Draft.
    const validation = adapter.validate(fields);

    // Non-blocking informational conflict check (required safeguard #6) —
    // same shape/role as the one in create() above.
    const conflict = await conflictService.checkRevision(adapter, {
      parentId,
      basedOnRevisionNumber,
    });

    const updated = await adapter.updateProposedVersion(versionId, fields);

    await eventService.emit(EVENT_TYPE.PROPOSAL_UPDATED, {
      entityType: adapter.entityType,
      entityId: parentId,
      actorId,
      correlationId,
      payload: { versionId, fields },
      metadata: { conflict, validation },
    });

    return { version: updated, conflict, validation };
  },
};

export default proposalService;
