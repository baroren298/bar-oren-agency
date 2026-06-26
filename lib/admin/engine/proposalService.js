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
};

export default proposalService;
