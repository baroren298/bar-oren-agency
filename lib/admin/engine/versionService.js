/*
 * VersionService — Sprint 3.5 (ADMIN_PANEL_PLAN.md Section 13.2/13.14
 * sub-phase 5). Closes a gap left when Sprints 3.3/3.4 built
 * proposalService, approvalService, and publishService but skipped the
 * read-side service the plan lists alongside proposalService in the same
 * sub-phase ("Build versionService.js and proposalService.js against the
 * Talent adapter"). Without this file, Phase 3 success criterion #4
 * (Section 13.17 — "Version history works: versionService can list every
 * version ... for a given parent, in order") is unmet.
 *
 * Generic and entity-agnostic per Section 13.9/13.16 ("Generic before
 * specific", "Services own business logic", "Adapters own translation
 * only"): every method here takes an `adapter` (Section 13.10 contract) as
 * its first argument and contains no entity-specific branching or field
 * names. All entity-specific work — what a parent's pointer column is
 * called, how a version row is shaped — lives only inside the adapter
 * passed in.
 *
 * Scope for this sprint: read-only queries over existing adapter methods
 * (`getParent`, `getVersion`, `listVersionsForParent`). No new repository
 * methods, no writes, no entity branching, no Live Preview wiring.
 * `getVersionForPreview()` (Section 13.11, sub-phase 8) is a distinct,
 * later sub-phase — deliberately not built here, since `talentAdapter.
 * mapToPublicShape()` itself is still an unimplemented stub (see that
 * file's header) and wiring a preview entry point against a method that
 * intentionally throws would not be a meaningful increment yet.
 */

import { assertImplementsAdapterContract } from './adapters/adapterContract';
import { VERSION_STATUS } from '../constants/enums';

const PENDING_STATUSES = Object.freeze([VERSION_STATUS.DRAFT, VERSION_STATUS.PROPOSED]);

export const versionService = {
  /**
   * The currently published version for a parent, or null if the parent
   * doesn't exist yet or has never published anything. Reads the parent's
   * pointer via `adapter.getParent()` and resolves it via
   * `adapter.getVersion()` — never assumes a specific pointer column name
   * itself (that translation lives in the adapter, Section 13.16).
   *
   * @param {object} adapter - Section 13.10 contract
   * @param {string} parentId
   * @returns {Promise<object|null>}
   */
  async getCurrentPublished(adapter, parentId) {
    assertImplementsAdapterContract(adapter);
    if (!parentId) {
      throw new Error('[versionService.getCurrentPublished] parentId is required.');
    }

    const parent = await adapter.getParent(parentId);
    if (!parent || !parent.currentPublishedVersionId) {
      return null;
    }

    return adapter.getVersion(parent.currentPublishedVersionId);
  },

  /**
   * The most recent not-yet-decided version for a parent — DRAFT or
   * PROPOSED, whichever is newest — or null if there is none. "Most
   * recent" per `listVersionsForParent`'s documented newest-first order
   * (e.g. talentRepository.listTalentVersionsForTalent).
   *
   * Per Section 6, two simultaneous proposals on the same entity are
   * allowed to coexist in v1; this method intentionally surfaces only the
   * single newest pending version rather than picking a "the" pending
   * version by some other rule. A caller that needs every pending version
   * (e.g. the future approval queue) should use `listVersionHistory` and
   * filter, not this method.
   *
   * @param {object} adapter
   * @param {string} parentId
   * @returns {Promise<object|null>}
   */
  async getCurrentDraftOrProposed(adapter, parentId) {
    assertImplementsAdapterContract(adapter);
    if (!parentId) {
      throw new Error('[versionService.getCurrentDraftOrProposed] parentId is required.');
    }

    const versions = await adapter.listVersionsForParent(parentId);
    if (!Array.isArray(versions)) return null;

    return versions.find((version) => PENDING_STATUSES.includes(version.status)) || null;
  },

  /**
   * Full version history for a parent — published, proposed, rejected,
   * superseded, and draft — in the order the adapter's
   * `listVersionsForParent` returns them (newest first, per existing
   * repository convention; this service does not re-sort, since sort
   * order is a data-access concern owned by the repository layer per
   * Section 13.15, not the engine).
   *
   * Satisfies Phase 3 success criterion #4 (Section 13.17): "versionService
   * can list every version (published, proposed, rejected, superseded,
   * draft) for a given parent, in order."
   *
   * @param {object} adapter
   * @param {string} parentId
   * @returns {Promise<object[]>}
   */
  async listVersionHistory(adapter, parentId) {
    assertImplementsAdapterContract(adapter);
    if (!parentId) {
      throw new Error('[versionService.listVersionHistory] parentId is required.');
    }

    const versions = await adapter.listVersionsForParent(parentId);
    return Array.isArray(versions) ? versions : [];
  },
};

export default versionService;
