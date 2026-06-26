/*
 * ApprovalService — Sprint 3.4 (ADMIN_PANEL_PLAN.md Section 4, 13.5,
 * 13.17#2). Implements the "Approval" step of Content -> Version ->
 * Proposal -> Approval -> Publish -> Events (Section 13.1).
 *
 * Reaffirmed per Section 13.5: Approval and Publish are kept as two
 * separate services/files, even though v1's `approve()` composes them by
 * calling `publishService.publish()` immediately. `approve()` itself never
 * writes a version row directly — it delegates the entire publish
 * transaction (including setting approvedById/approvedAt, which the
 * Talent schema stores on the version row itself) to `publishService`, so
 * there is exactly one code path that can ever produce a PUBLISHED
 * version (Section 13.5's "only code path" guarantee) and no duplicate
 * status/conflict checks between the two services.
 *
 * Ordering matters: `approve()` calls `publishService.publish()` *before*
 * emitting `ProposalApproved`. If publish() throws (e.g. a revision
 * conflict caught inside its transaction), `approve()` propagates the
 * error and never emits `ProposalApproved` — so the Event stream can never
 * contain an "approved" event for a proposal that was not, in fact,
 * published. (This is the v1 composition only; Section 13.5's anticipated
 * "approve now, publish later" flow is a different, not-yet-built method
 * that would emit ProposalApproved on its own without calling publish.)
 *
 * `reject()` is independent of publish/approve entirely — it requires a
 * `rejectionNote` (Section 4) and only flips the version's own status.
 *
 * Generic and entity-agnostic per Section 13.9/13.16: no entity-specific
 * branching anywhere in this file.
 */

import { assertImplementsAdapterContract } from './adapters/adapterContract';
import { publishService } from './publishService';
import { eventService } from './eventService';
import { EVENT_TYPE } from './eventTypes';
import { VERSION_STATUS } from '../constants/enums';

export const approvalService = {
  /**
   * Approve a PROPOSED version and publish it immediately (Section 13.5's
   * v1 composition). All status/conflict validation for the publish step
   * itself lives in `publishService.publish()` — not duplicated here.
   *
   * @param {object} adapter - Section 13.10 contract
   * @param {object} params
   * @param {string} params.parentId
   * @param {string} params.versionId
   * @param {string} params.actorId
   * @param {number} [params.basedOnRevisionNumber] - forwarded to
   *   publishService.publish(); see its doc comment.
   * @param {string} [params.correlationId]
   * @returns {Promise<{ version: object, parent: object }>}
   */
  async approve(
    adapter,
    { parentId, versionId, actorId, basedOnRevisionNumber, correlationId } = {}
  ) {
    assertImplementsAdapterContract(adapter);

    if (!parentId) {
      throw new Error('[approvalService.approve] parentId is required.');
    }
    if (!versionId) {
      throw new Error('[approvalService.approve] versionId is required.');
    }
    if (!actorId) {
      throw new Error('[approvalService.approve] actorId is required.');
    }

    const result = await publishService.publish(adapter, {
      parentId,
      versionId,
      actorId,
      basedOnRevisionNumber,
      correlationId,
    });

    await eventService.emit(EVENT_TYPE.PROPOSAL_APPROVED, {
      entityType: adapter.entityType,
      entityId: parentId,
      actorId,
      correlationId,
      payload: { versionId },
      metadata: {},
    });

    return result;
  },

  /**
   * Reject a PROPOSED version with a required `rejectionNote` (Section 4:
   * "Rejection flips status to rejected with a required rejectionNote;
   * nothing about the published pointer changes"). Emits
   * `ProposalRejected`.
   *
   * @param {object} adapter
   * @param {object} params
   * @param {string} params.parentId
   * @param {string} params.versionId
   * @param {string} params.actorId
   * @param {string} params.rejectionNote
   * @param {string} [params.correlationId]
   * @returns {Promise<object>} the updated version row
   */
  async reject(adapter, { parentId, versionId, actorId, rejectionNote, correlationId } = {}) {
    assertImplementsAdapterContract(adapter);

    if (!parentId) {
      throw new Error('[approvalService.reject] parentId is required.');
    }
    if (!versionId) {
      throw new Error('[approvalService.reject] versionId is required.');
    }
    if (!actorId) {
      throw new Error('[approvalService.reject] actorId is required.');
    }
    if (!rejectionNote || !rejectionNote.trim()) {
      throw new Error(
        '[approvalService.reject] rejectionNote is required (Section 4: rejection ' +
          'always requires a note).'
      );
    }

    const version = await adapter.getVersion(versionId);
    if (!version) {
      throw new Error(`[approvalService.reject] no version found for id "${versionId}".`);
    }
    if (version.status !== VERSION_STATUS.PROPOSED) {
      throw new Error(
        `[approvalService.reject] version "${versionId}" is "${version.status}", not ` +
          'PROPOSED — only a PROPOSED proposal can be rejected.'
      );
    }

    const rejected = await adapter.rejectVersion(versionId, { rejectionNote });

    await eventService.emit(EVENT_TYPE.PROPOSAL_REJECTED, {
      entityType: adapter.entityType,
      entityId: parentId,
      actorId,
      correlationId,
      payload: { versionId, rejectionNote },
      metadata: {},
    });

    return rejected;
  },
};

export default approvalService;
