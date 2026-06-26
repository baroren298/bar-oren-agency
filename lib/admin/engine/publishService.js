/*
 * PublishService — Sprint 3.4 (ADMIN_PANEL_PLAN.md Section 13.5, 13.8,
 * 13.17#3). Implements the "Publish" step of Content -> Version ->
 * Proposal -> Approval -> Publish -> Events (Section 13.1).
 *
 * `publish()` is the *only* code path in the whole system permitted to set
 * a version's status to PUBLISHED (Section 13.5: "publishService.publish()
 * remains the only code path that ever sets a version's status to
 * PUBLISHED"; Section 13.18: "no bypassing the Proposal/Approval flow").
 * That guarantee is enforced by convention across two layers: this service
 * never calls anything but `adapter.publishVersion()` to perform the write,
 * and every adapter's `publishVersion` (Section 13.10/Sprint 3.4) is
 * documented as the narrow, single path to PUBLISHED for that entity type
 * — never a general status setter.
 *
 * Generic and entity-agnostic per Section 13.9/13.16: every method here
 * takes an `adapter` (Section 13.10 contract) as its first argument and
 * contains no entity-specific branching. All entity-specific work — which
 * columns get superseded, repointed, incremented — lives only in the
 * adapter and the repository it wraps.
 *
 * Section 13.8: the authoritative, blocking conflict check happens inside
 * the repository's own publish transaction (see talentRepository.
 * publishTalentVersion's header comment), not as a separate read-then-
 * write here. This service's job on conflict is purely translation: catch
 * the tagged error the repository/adapter throws and re-shape it into the
 * same `{ conflict, currentRevisionNumber, basedOnRevisionNumber }` shape
 * `conflictService`'s early, non-blocking check already returns, so a
 * caller never has to know which of the two checks caught a given
 * conflict. `conflictService` itself is not called from here — it remains
 * scoped to the early, non-blocking warning used at proposal-creation time
 * (Section 13.8: "the early check is a UX convenience, the in-transaction
 * check is the one that actually prevents a lost update").
 */

import { assertImplementsAdapterContract } from './adapters/adapterContract';
import { eventService } from './eventService';
import { EVENT_TYPE } from './eventTypes';
import { VERSION_STATUS, REVISION_CONFLICT_ERROR_CODE } from '../constants/enums';

export const publishService = {
  /**
   * Publish a PROPOSED version: the proposed row's status flips to
   * PUBLISHED, the prior published row (if any) flips to SUPERSEDED, and
   * the parent is repointed — atomically (Section 4), inside the
   * adapter/repository's own transaction (Section 13.8).
   *
   * Emits `VersionPublished` (Section 13.6: dedicated correlationId,
   * payload/metadata split) once the transaction commits. Never emits on
   * failure — including on conflict, so the Event stream never records a
   * publish that didn't actually happen.
   *
   * @param {object} adapter - Section 13.10 contract
   * @param {object} params
   * @param {string} params.parentId
   * @param {string} params.versionId
   * @param {string} params.actorId
   * @param {number} [params.basedOnRevisionNumber] - overrides the
   *   version's own stored `basedOnRevisionNumber` if supplied; otherwise
   *   that stored value (captured at proposal-creation time, Section 6) is
   *   what gets compared against the parent's live revisionNumber.
   * @param {string} [params.correlationId]
   * @returns {Promise<{ version: object, parent: object }>}
   * @throws if the version is not PROPOSED, or on a revision conflict
   *   (error.code === REVISION_CONFLICT_ERROR_CODE, error.conflict holds
   *   the structured shape).
   */
  async publish(
    adapter,
    { parentId, versionId, actorId, basedOnRevisionNumber, correlationId } = {}
  ) {
    assertImplementsAdapterContract(adapter);

    if (!parentId) {
      throw new Error('[publishService.publish] parentId is required.');
    }
    if (!versionId) {
      throw new Error('[publishService.publish] versionId is required.');
    }
    if (!actorId) {
      throw new Error('[publishService.publish] actorId is required.');
    }

    const version = await adapter.getVersion(versionId);
    if (!version) {
      throw new Error(`[publishService.publish] no version found for id "${versionId}".`);
    }
    if (version.status !== VERSION_STATUS.PROPOSED) {
      throw new Error(
        `[publishService.publish] version "${versionId}" is "${version.status}", not ` +
          'PROPOSED — only a PROPOSED proposal can be published.'
      );
    }

    const expectedRevisionNumber =
      basedOnRevisionNumber !== undefined ? basedOnRevisionNumber : version.basedOnRevisionNumber;

    let result;
    try {
      result = await adapter.publishVersion(versionId, {
        expectedRevisionNumber,
        approvedById: actorId,
      });
    } catch (err) {
      if (err && err.code === REVISION_CONFLICT_ERROR_CODE) {
        const conflict = {
          conflict: true,
          currentRevisionNumber: err.currentRevisionNumber,
          basedOnRevisionNumber: err.expectedRevisionNumber,
        };
        const conflictError = new Error(
          `[publishService.publish] revision conflict publishing version "${versionId}": ` +
            `expected revisionNumber ${conflict.basedOnRevisionNumber}, found ` +
            `${conflict.currentRevisionNumber}.`
        );
        conflictError.code = REVISION_CONFLICT_ERROR_CODE;
        conflictError.conflict = conflict;
        throw conflictError;
      }
      throw err;
    }

    await eventService.emit(EVENT_TYPE.VERSION_PUBLISHED, {
      entityType: adapter.entityType,
      entityId: parentId,
      actorId,
      correlationId,
      payload: {
        versionId,
        revisionNumber: result.parent ? result.parent.revisionNumber : undefined,
      },
      metadata: {},
    });

    return result;
  },
};

export default publishService;
