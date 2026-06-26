/*
 * entityAdapter — Sprint 3.6 (ADMIN_PANEL_PLAN.md Section 13.2: "generic
 * adapter for the shared Entity/EntityVersion primitives (Section 3.1),
 * parameterized per entityType"). The second real adapter, proving the
 * Core Content Engine generalizes beyond Talent — closing Phase 3 success
 * criterion #8 (Section 13.17: "At least two different adapters ... exercise
 * the full lifecycle above through the same, unmodified engine services —
 * proving genericness empirically, not just by design intent").
 *
 * Why this entity type and not siteContentAdapter/seoAdapter/legalPageAdapter
 * (Section 13.14 sub-phase 7's other listed stubs): SiteContent, Seo, and
 * LegalPage rows are self-versioning — they carry no separate "parent" row
 * with a `revisionNumber`/`currentPublishedVersionId` pair to repoint, so
 * they don't yet fit the adapter contract's getParent()/publishVersion()
 * shape without a design decision that's out of this sprint's scope. The
 * generic Entity/EntityVersion pair (Section 3.1) already has exactly that
 * shape — structurally identical to Talent/TalentVersion — so it's the
 * cheapest second adapter that can be wired for *real*, not left as a
 * contract-shaped stub that throws everywhere.
 *
 * Per Section 13.9/13.16 ("Adapters own translation only"), this file is
 * the only place that knows EntityVersion's actual column names (`content`,
 * `entityId`, ...). Engine services (proposalService/conflictService/
 * publishService/approvalService/versionService) only ever see the generic
 * `parentId`/`fields`/`versionId` vocabulary from
 * lib/admin/engine/adapters/adapterContract.js — exactly as they do for
 * talentAdapter. No engine service file was modified to build this adapter.
 *
 * Parameterization: unlike talentAdapter (one fixed entityType, TALENT),
 * the Entity/EntityVersion pair backs several entity types (e.g.
 * COLLABORATIONS, AGENCY_SOCIAL — Section 3.1/3.3). `createEntityAdapter()`
 * is a factory that binds one fixed `entityType` per instance, since the
 * adapter contract (Section 13.10) requires a single static `entityType`
 * and a single static `capabilities` object per adapter — exactly what
 * Section 13.4 means by "capabilities are declared per entityType
 * instantiation, not fixed for the whole adapter file."
 */

import { entityRepository } from '../../repository/entityRepository';
import { VERSION_STATUS } from '../../constants/enums';

/**
 * Conservative default capabilities for a generic Entity/EntityVersion-backed
 * content type: no dedicated preview mapping, no scheduling, no SEO/gallery
 * fields of its own, but it does carry the shared LifecycleStatus (soft
 * delete/archive) and can be published/rejected through the standard
 * pipeline. Per Section 13.4's closing note, a capability flag is only a
 * routing/UI convenience — the adapter must still enforce it server-side;
 * since `mapToPublicShape` below is a stub that throws, `supportsPreview`
 * is correctly `false` until a real mapping exists.
 */
const DEFAULT_CAPABILITIES = Object.freeze({
  supportsPreview: false,
  supportsScheduling: false,
  supportsSEO: false,
  supportsGallery: false,
  supportsSoftDelete: true,
  supportsPublishing: true,
  supportsArchive: true,
});

/**
 * Build an adapter instance bound to one fixed `entityType`.
 *
 * @param {string} entityType - one of the `EntityType` enum values
 *   (lib/admin/constants/enums.js ENTITY_TYPE) — e.g. ENTITY_TYPE.COLLABORATIONS.
 * @param {object} [overrides]
 * @param {object} [overrides.capabilities] - merged over DEFAULT_CAPABILITIES.
 * @returns {object} an adapter satisfying lib/admin/engine/adapters/adapterContract.js
 */
export function createEntityAdapter(entityType, { capabilities } = {}) {
  if (!entityType) {
    throw new Error('[entityAdapter] createEntityAdapter requires an entityType.');
  }

  return {
    entityType,

    capabilities: Object.freeze({
      ...DEFAULT_CAPABILITIES,
      ...(capabilities || {}),
    }),

    /** @param {string} entityRowId - the Entity row's own id */
    async getParent(entityRowId) {
      return entityRepository.getParentEntity(entityRowId);
    },

    /** @param {string} versionId */
    async getVersion(versionId) {
      return entityRepository.getEntityVersionById(versionId);
    },

    /** @param {string} parentId - the Entity row's own id */
    async listVersionsForParent(parentId) {
      return entityRepository.listEntityVersionsForParent(parentId);
    },

    /**
     * Sprint 4.1 — same read-only roster-list primitive talentAdapter
     * gained for `/admin/talent`, added here so the contract addition
     * (Section 13.10) holds identically for both real adapters, even
     * though no admin page calls this adapter's listParents yet. Pure
     * translation: the entityType is this adapter instance's own bound
     * value (Section 13.4's "capabilities are declared per entityType
     * instantiation"), never a parameter the caller supplies.
     *
     * @param {object} [opts]
     * @param {string} [opts.status] - LIFECYCLE_STATUS filter
     */
    async listParents(opts) {
      return entityRepository.listEntities({ ...opts, entityType });
    },

    /**
     * @param {object} fields - free-form business content, stored verbatim
     *   in EntityVersion.content (Json) — no named-column mapping needed,
     *   unlike talentAdapter.
     * @param {object} meta - generic engine vocabulary: { parentId, status,
     *   basedOnVersionId, basedOnRevisionNumber, createdById }
     */
    async insertProposedVersion(fields, meta) {
      const {
        parentId,
        status = VERSION_STATUS.DRAFT,
        basedOnVersionId,
        basedOnRevisionNumber,
        createdById,
      } = meta;

      return entityRepository.insertEntityVersion({
        entityId: parentId, // translation: engine's generic parentId -> this entity's FK column
        fields,
        status,
        basedOnVersionId,
        basedOnRevisionNumber,
        createdById,
      });
    },

    /** @param {string} versionId */
    async submitVersion(versionId) {
      return entityRepository.updateEntityVersionStatus(versionId, VERSION_STATUS.PROPOSED);
    },

    /**
     * The only path through this adapter that can result in a PUBLISHED
     * EntityVersion — called exclusively by `publishService.publish()`
     * (Section 13.5). Pure translation: forwards straight to the
     * repository's atomic transaction, which is also where the
     * authoritative, in-transaction revision conflict check lives (Section
     * 13.8) — this method makes no decision of its own about whether the
     * publish is allowed.
     *
     * @param {string} versionId
     * @param {object} meta
     * @param {number|null} [meta.expectedRevisionNumber]
     * @param {string} meta.approvedById
     */
    async publishVersion(versionId, { expectedRevisionNumber, approvedById } = {}) {
      return entityRepository.publishEntityVersion(versionId, {
        expectedRevisionNumber,
        approvedById,
      });
    },

    /**
     * Called exclusively by `approvalService.reject()`. Pure translation to
     * the repository's rejection primitive — no decision about whether
     * rejection is allowed is made here; that belongs to `approvalService`
     * (Section 13.16).
     *
     * @param {string} versionId
     * @param {object} meta
     * @param {string} meta.rejectionNote
     */
    async rejectVersion(versionId, { rejectionNote } = {}) {
      return entityRepository.setEntityVersionRejection(versionId, { rejectionNote });
    },

    /**
     * Minimal field validation for this sprint — mirrors talentAdapter's
     * level of effort. EntityVersion.content is free-form Json (Section
     * 3.1), so the only generic rule that applies to every content type
     * behind this adapter is "there must be some content object." Per-type
     * field rules belong in a later, content-type-specific pass, not here
     * (Section 13.16: "Adapters own translation only" — and even this
     * generic adapter is one adapter file, not the engine itself).
     *
     * @param {object} fields
     * @returns {{ valid: boolean, errors: string[] }}
     */
    validate(fields) {
      const errors = [];
      if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
        errors.push('fields must be a non-null object');
      }
      return { valid: errors.length === 0, errors };
    },

    /**
     * Live Preview mapping (Section 7/13.11) — out of scope for this
     * sprint, consistent with `supportsPreview: false` above and with
     * talentAdapter.mapToPublicShape's current stub state. Not called by
     * anything yet; throws rather than silently returning a wrong shape.
     */
    mapToPublicShape(/* version, related */) {
      throw new Error(
        '[entityAdapter.mapToPublicShape] not implemented yet — Live Preview ' +
          '(ADMIN_PANEL_PLAN.md Section 7/13.11) is a later sprint; nothing ' +
          'calls this yet, and capabilities.supportsPreview is false.'
      );
    },
  };
}

export default createEntityAdapter;
