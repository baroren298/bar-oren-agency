/*
 * fakeTalentAdapter — Sprint 3.8 test double, shaped exactly like the real
 * lib/admin/engine/adapters/talentAdapter.js: same `entityType` (TALENT),
 * same `capabilities` object, same field vocabulary (`fields.name` is
 * required, mirroring talentAdapter.validate). Backed by
 * inMemoryVersionStore.js instead of talentRepository/Prisma.
 *
 * Purpose: exercise the real, unmodified engine services
 * (proposalService/conflictService/approvalService/publishService/
 * versionService) against one of the two adapter "shapes" Phase 3 success
 * criterion #8 (ADMIN_PANEL_PLAN.md Section 13.17) requires, without a live
 * database. No engine or adapter-contract file is modified to support this
 * — this fake satisfies the same contract
 * (lib/admin/engine/adapters/adapterContract.js) the real talentAdapter
 * does.
 */
import { ENTITY_TYPE, VERSION_STATUS } from '../../../constants/enums';
import { createInMemoryVersionStore } from './inMemoryVersionStore';

/*
 * Fake-adapter fidelity fix — inMemoryVersionStore.js keeps a version's
 * business fields nested under `.fields` internally (its own
 * insertVersion/updateVersionFields storage shape), but the real
 * talentRepository/talentAdapter.getVersion + listVersionsForParent hand
 * back raw Prisma rows, where every business column (name, bioHe, ...)
 * already sits flat at the top level next to id/status/etc. — there is no
 * separate `.fields` wrapper in production. Any production code that calls
 * talentAdapter.getVersion and compares business fields on the result
 * (e.g. talentVersionIsUnchangedFromPublished, which reads
 * extractTalentVersionFields's `version.name`, `version.bioHe`, ...) would
 * otherwise silently see `undefined` on both sides against this fake and
 * treat any pending Draft as "unchanged," regardless of what it actually
 * contains.
 *
 * Backward-compatibility fix (found by the full suite after the Global
 * Reconciliation sprint): proposalLifecycle.test.js predates this
 * flattening fix and asserts against the store's original nested shape —
 * `(await adapter.getVersion(draft.id)).fields.name`. Flattening-only broke
 * that read (`.fields` was gone). Rather than touch that pre-existing test
 * just to accommodate the fake, the object below carries BOTH shapes at
 * once: every business field spread flat at the top level (what
 * talentVersionIsUnchangedFromPublished / production-shaped code reads),
 * AND the original nested `fields` object re-attached afterward (what
 * proposalLifecycle.test.js reads) — `{ ...fields, ...rest, fields }`,
 * with the explicit trailing `fields` key ensuring the nested object always
 * wins over anything `...rest` might otherwise contribute to that key
 * (nothing does today, but this keeps the precedence explicit rather than
 * order-dependent by accident). Only getVersion/listVersionsForParent are
 * flattened (not insertProposedVersion/submitVersion's return values) —
 * unchanged from before.
 */
function flattenVersion(version) {
  if (!version) return version;
  const { fields, ...rest } = version;
  return { ...fields, ...rest, fields };
}

export function createFakeTalentAdapter() {
  const store = createInMemoryVersionStore();

  // Global Reconciliation sprint — minimal in-memory Gallery/Socials
  // pending-row lists, just enough to exercise galleryPendingWork.js /
  // socialsPendingWork.js's hasEffectivePendingWork() against something
  // other than the real Prisma-backed talentAdapter. Deliberately not a
  // parallel full version-lifecycle store (no submit/approve/reject) —
  // reconciliation only ever needs to know "is there a pending row," never
  // this fake's job to model Gallery/Socials' own full lifecycle (that's
  // covered by galleryService/socialsService's own unrelated tests).
  let galleryIdCounter = 0;
  let socialIdCounter = 0;
  const galleryImages = [];
  const socials = [];

  const adapter = {
    entityType: ENTITY_TYPE.TALENT,

    capabilities: Object.freeze({
      supportsPreview: true,
      supportsScheduling: false,
      supportsSEO: false,
      supportsGallery: true,
      supportsSoftDelete: true,
      supportsPublishing: true,
      supportsArchive: true,
    }),

    async getParent(parentId) {
      return store.getParent(parentId);
    },

    async getVersion(versionId) {
      return flattenVersion(await store.getVersion(versionId));
    },

    async listVersionsForParent(parentId) {
      const versions = await store.listVersionsForParent(parentId);
      return versions.map(flattenVersion);
    },

    async insertProposedVersion(fields, meta) {
      const { parentId, status = VERSION_STATUS.DRAFT, basedOnVersionId, basedOnRevisionNumber, createdById } = meta;
      return store.insertVersion({ parentId, fields, status, basedOnVersionId, basedOnRevisionNumber, createdById });
    },

    async submitVersion(versionId) {
      return store.updateVersionStatus(versionId, VERSION_STATUS.PROPOSED);
    },

    /**
     * "Editable PROPOSED" sprint (originally "Save Draft" sprint) — mirrors
     * the real talentAdapter.updateProposedVersion exactly: an *optional*
     * capability, deliberately not part of every adapter shape (see
     * fakeEntityAdapter, which has no equivalent, same as the real
     * entityAdapter). proposalService.update() checks for this method
     * directly on whichever adapter it's given.
     */
    async updateProposedVersion(versionId, fields) {
      return store.updateVersionFields(versionId, fields);
    },

    /**
     * Cancel Editing / Discard Draft sprint — mirrors the real
     * talentAdapter.discardVersion exactly: same optional-capability
     * pattern as updateProposedVersion above (not part of every adapter
     * shape — fakeEntityAdapter has no equivalent, matching the real
     * entityAdapter). proposalService.discard() checks for this method
     * directly on whichever adapter it's given.
     */
    async discardVersion(versionId) {
      return store.deleteVersion(versionId);
    },

    async publishVersion(versionId, { expectedRevisionNumber, approvedById } = {}) {
      return store.publishVersion(versionId, { expectedRevisionNumber, approvedById });
    },

    async rejectVersion(versionId, { rejectionNote } = {}) {
      return store.setVersionRejection(versionId, { rejectionNote });
    },

    /** Mirrors talentAdapter.validate's real rule: fields.name is required. */
    validate(fields) {
      const errors = [];
      if (!fields || typeof fields !== 'object') {
        errors.push('fields must be an object');
        return { valid: false, errors };
      }
      if (!fields.name || typeof fields.name !== 'string' || !fields.name.trim()) {
        errors.push('name is required');
      }
      return { valid: errors.length === 0, errors };
    },

    mapToPublicShape() {
      throw new Error('[fakeTalentAdapter.mapToPublicShape] not implemented — Live Preview is out of scope.');
    },

    /** Sprint 4.1 — backs versionService.listParents(); mirrors talentAdapter.listParents. */
    async listParents(opts) {
      return store.listParents(opts);
    },

    /** Test-only — seeds a parent row directly, bypassing the engine. */
    _seedParent(opts) {
      return store.createParent(opts);
    },

    /**
     * Global Reconciliation sprint — mirrors the real
     * talentAdapter.getDraftOrProposedGalleryImages exactly: every
     * TalentGalleryImage row for this talent still in DRAFT or PROPOSED.
     */
    async getDraftOrProposedGalleryImages(parentId) {
      return galleryImages.filter(
        (img) =>
          img.talentId === parentId &&
          (img.status === VERSION_STATUS.DRAFT || img.status === VERSION_STATUS.PROPOSED)
      );
    },

    /**
     * Global Reconciliation sprint — mirrors the real
     * talentAdapter.getDraftOrProposedSocials exactly: every TalentSocial
     * row for this talent still in DRAFT or PROPOSED.
     */
    async getDraftOrProposedSocials(parentId) {
      return socials.filter(
        (social) =>
          social.talentId === parentId &&
          (social.status === VERSION_STATUS.DRAFT || social.status === VERSION_STATUS.PROPOSED)
      );
    },

    /** Test-only — seeds a Gallery pending row directly, bypassing galleryService. */
    _seedGalleryImage({ talentId, status = VERSION_STATUS.DRAFT, id } = {}) {
      galleryIdCounter += 1;
      const row = { id: id || `gallery_${galleryIdCounter}`, talentId, status };
      galleryImages.push(row);
      return row;
    },

    /** Test-only — seeds a Socials pending row directly, bypassing socialsService. */
    _seedSocial({ talentId, status = VERSION_STATUS.DRAFT, id } = {}) {
      socialIdCounter += 1;
      const row = { id: id || `social_${socialIdCounter}`, talentId, status };
      socials.push(row);
      return row;
    },
  };

  return adapter;
}
