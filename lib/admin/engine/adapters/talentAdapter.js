/*
 * talentAdapter — Sprint 3.3, extended in Sprint 3.4 with
 * publishVersion/rejectVersion. The first real adapter, proving the
 * contract (lib/admin/engine/adapters/adapterContract.js, Section 13.10)
 * against the most fully-fleshed-out model (Section 13.14, sub-phase 4:
 * "Talent is the most fully fleshed-out model in Section 3").
 *
 * Per Section 13.9/13.16 ("Adapters own translation only"), this file is
 * the only place that knows TalentVersion's actual column names
 * (`talentId`, `name`, `bioHe`, ...) — engine services
 * (proposalService/conflictService/eventService) only ever see the
 * generic `parentId`/`fields`/`versionId` vocabulary from
 * lib/admin/engine/adapters/adapterContract.js.
 *
 * Capabilities below match the "starting values" already decided in
 * ADMIN_PANEL_PLAN.md Section 13.4 for talentAdapter exactly — not
 * re-decided here.
 */

import { talentRepository } from '../../repository/talentRepository';
import { ENTITY_TYPE, VERSION_STATUS } from '../../constants/enums';

export const talentAdapter = {
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

  /** @param {string} talentId */
  async getParent(talentId) {
    return talentRepository.getParentTalent(talentId);
  },

  /** @param {string} versionId */
  async getVersion(versionId) {
    return talentRepository.getTalentVersionById(versionId);
  },

  /** @param {string} parentId - the Talent id */
  async listVersionsForParent(parentId) {
    return talentRepository.listTalentVersionsForTalent(parentId);
  },

  /**
   * Sprint 4.1 — backs the read-only `/admin/talent` roster list (Section
   * 2). Pure translation: forwards straight to the repository's
   * decision-free list query.
   *
   * @param {object} [opts]
   * @param {string} [opts.status] - LIFECYCLE_STATUS filter
   */
  async listParents(opts) {
    return talentRepository.listTalents(opts);
  },

  /**
   * @param {object} fields - TalentVersion business fields (name, bioHe, ...)
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

    return talentRepository.insertTalentVersion({
      talentId: parentId, // translation: engine's generic parentId -> this entity's FK column
      fields,
      status,
      basedOnVersionId,
      basedOnRevisionNumber,
      createdById,
    });
  },

  /** @param {string} versionId */
  async submitVersion(versionId) {
    return talentRepository.updateTalentVersionStatus(versionId, VERSION_STATUS.PROPOSED);
  },

  /**
   * Save Draft sprint — pure translation to the repository's partial-field
   * update primitive (Section 13.16). Not part of
   * lib/admin/engine/adapters/adapterContract.js's REQUIRED_ADAPTER_METHODS:
   * adding it there would force entityAdapter.js (and both test fakes) to
   * implement it in lockstep purely to keep `assertImplementsAdapterContract`
   * passing, for a method only the Talent Details "Save Draft" feature
   * currently calls. `proposalService.update()` instead checks for this
   * method directly on whichever adapter it's given, the same way an
   * optional capability would be checked.
   *
   * @param {string} versionId
   * @param {object} fields - partial TalentVersion business fields
   * @returns {Promise<object>} the updated TalentVersion row
   */
  async updateProposedVersion(versionId, fields) {
    return talentRepository.updateTalentVersionFields(versionId, fields);
  },

  /**
   * Sprint 3.4. The only path through this adapter that can result in a
   * PUBLISHED TalentVersion — called exclusively by
   * `publishService.publish()` (Section 13.5). Pure translation
   * (Section 13.16): forwards straight to the repository's atomic
   * transaction, which is also where the authoritative, in-transaction
   * revision conflict check lives (Section 13.8) — this method makes no
   * decision of its own about whether the publish is allowed.
   *
   * @param {string} versionId
   * @param {object} meta - generic engine vocabulary
   * @param {number|null} [meta.expectedRevisionNumber]
   * @param {string} meta.approvedById
   * @returns {Promise<{ version: object, parent: object }>}
   */
  async publishVersion(versionId, { expectedRevisionNumber, approvedById } = {}) {
    return talentRepository.publishTalentVersion(versionId, {
      expectedRevisionNumber,
      approvedById,
    });
  },

  /**
   * Sprint 3.4. Called exclusively by `approvalService.reject()`. Pure
   * translation to the repository's rejection primitive — no decision
   * about whether rejection is allowed (e.g. status preconditions) is made
   * here; that belongs to `approvalService` (Section 13.16).
   *
   * @param {string} versionId
   * @param {object} meta
   * @param {string} meta.rejectionNote
   */
  async rejectVersion(versionId, { rejectionNote } = {}) {
    return talentRepository.setTalentVersionRejection(versionId, { rejectionNote });
  },

  /**
   * Talent Detail DB Read Integration sprint — pure translation to the
   * repository's published-socials read, same optional-method pattern as
   * `updateProposedVersion` above (not part of
   * adapterContract.js's REQUIRED_ADAPTER_METHODS, since it's a
   * Talent-Workspace-specific read, not a generic version-lifecycle
   * operation every adapter needs).
   *
   * @param {string} parentId - the Talent id
   */
  async getSocials(parentId) {
    return talentRepository.getPublishedSocialsForTalent(parentId);
  },

  /**
   * Talent Detail DB Read Integration sprint — pure translation to the
   * repository's published-gallery-images read. Same rationale as
   * `getSocials` above.
   *
   * @param {string} parentId - the Talent id
   */
  async getGalleryImages(parentId) {
    return talentRepository.getPublishedGalleryImagesForTalent(parentId);
  },

  /**
   * Social Links persistence sprint — pure translation to the repository's
   * draft-or-proposed socials read, same optional-method pattern as
   * `getSocials` above (not part of adapterContract.js's
   * REQUIRED_ADAPTER_METHODS). Backs the Socials tab's "Proposed Update"
   * column once a save has happened — before any save, that column simply
   * falls back to `publishedSocials` (see SocialLinksEditor.jsx).
   *
   * @param {string} parentId - the Talent id
   */
  async getDraftOrProposedSocials(parentId) {
    return talentRepository.getDraftOrProposedSocialsForTalent(parentId);
  },

  /**
   * Owner Review (Social Links) sprint — pure translation to the
   * repository's PROPOSED-only socials read, same optional-method pattern
   * as `getSocials`/`getDraftOrProposedSocials` above (not part of
   * adapterContract.js's REQUIRED_ADAPTER_METHODS). Backs the new read-only
   * Owner Review panel on the Socials tab (lib/admin/social-review.js +
   * components/admin/SocialLinksOwnerReview.jsx) — narrower than
   * `getDraftOrProposedSocials` (PROPOSED only, no DRAFT rows) since a
   * review surface should only ever show what's actually been submitted.
   *
   * @param {string} parentId - the Talent id
   */
  async getProposedSocials(parentId) {
    return talentRepository.getProposedSocialsForTalent(parentId);
  },

  /**
   * Social Links persistence sprint — pure translation to the repository's
   * single-row lookup, used by socialsService to check a row's current
   * ownership/status before deciding whether to update it in place or
   * clone it into a new draft.
   *
   * @param {string} socialId
   */
  async getSocialById(socialId) {
    return talentRepository.getTalentSocialById(socialId);
  },

  /**
   * Social Links persistence sprint — pure translation to the repository's
   * insert primitive. `meta.parentId` is this entity's `talentId` FK
   * column, same translation `insertProposedVersion` above already does for
   * TalentVersion.
   *
   * @param {object} fields - { platform, label, customLabel, handle, url, sortOrder }
   * @param {object} meta - { parentId, basedOnVersionId, createdById }
   */
  async insertDraftSocial(fields, { parentId, basedOnVersionId, createdById } = {}) {
    return talentRepository.insertDraftSocial({
      talentId: parentId,
      fields,
      basedOnVersionId,
      createdById,
    });
  },

  /**
   * Social Links persistence sprint — pure translation to the repository's
   * partial-field update primitive, same role `updateProposedVersion` plays
   * for TalentVersion.
   *
   * @param {string} socialId
   * @param {object} fields - partial TalentSocial business fields
   */
  async updateSocialFields(socialId, fields) {
    return talentRepository.updateTalentSocialFields(socialId, fields);
  },

  /**
   * Social Links persistence sprint — pure translation to the repository's
   * bulk DRAFT -> PROPOSED flip for every social row belonging to a talent.
   *
   * @param {string} parentId - the Talent id
   */
  async submitDraftSocials(parentId) {
    return talentRepository.submitDraftSocialsForTalent(parentId);
  },

  /**
   * Add New Talent sprint — pure translation to the repository's new
   * combined create primitive (talentRepository.createTalentWithInitialVersion).
   * Per the Add New Talent flow revision, the first version this creates is
   * a DRAFT, not a published one — see that method's header comment for why
   * no publishService call is needed (or wanted) at creation time.
   *
   * Not part of adapterContract.js's REQUIRED_ADAPTER_METHODS — same
   * optional-capability pattern as `updateProposedVersion`/`getSocials`
   * above, since no generic engine service calls this yet (talent creation
   * is invoked directly from the new POST /api/admin/talent route, the same
   * way the existing proposals route calls `talentAdapter.getParent`
   * directly without going through a service).
   *
   * @param {object} fields - TalentVersion business fields (name, nameEn, ...)
   * @param {object} meta
   * @param {string} meta.slug
   * @param {string} meta.createdById
   * @returns {Promise<{ talent: object, version: object }>}
   */
  async createParentWithInitialVersion(fields, { slug, createdById } = {}) {
    return talentRepository.createTalentWithInitialVersion({ slug, fields, createdById });
  },

  /**
   * Add New Talent sprint — pure translation to the repository's slug
   * lookup, used by the create route's pre-write uniqueness check.
   *
   * @param {string} slug
   */
  async getParentBySlug(slug) {
    return talentRepository.getTalentBySlug(slug);
  },

  /**
   * Minimal field validation for this sprint — just enough for
   * proposalService.create() to have something real to call. Full field
   * validation (bilingual parity, category/tag shape, etc.) is a later
   * sprint's concern, not a redesign of this method's signature.
   *
   * @param {object} fields
   * @returns {{ valid: boolean, errors: string[] }}
   */
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

  /**
   * Owner Approve/Reject (Social Links) sprint — pure translation to the
   * repository's approve primitive, used by `socialsService.approve()`. Same
   * optional-method pattern as `getSocialById`/`updateSocialFields` above
   * (not part of adapterContract.js's REQUIRED_ADAPTER_METHODS — this is a
   * Social-Links-specific operation, not a generic version-lifecycle one).
   *
   * @param {string} socialId
   * @param {object} meta
   * @param {string} meta.approvedById
   */
  async approveSocial(socialId, { approvedById } = {}) {
    return talentRepository.approveTalentSocial(socialId, { approvedById });
  },

  /**
   * Owner Approve/Reject (Social Links) sprint — pure translation to the
   * repository's rejection primitive, used by `socialsService.reject()`. No
   * decision about whether rejection is allowed (status preconditions) is
   * made here — that belongs to `socialsService`, same split
   * `rejectVersion` above already follows for TalentVersion.
   *
   * @param {string} socialId
   * @param {object} meta
   * @param {string} meta.rejectionNote
   */
  async rejectSocial(socialId, { rejectionNote } = {}) {
    return talentRepository.setTalentSocialRejection(socialId, { rejectionNote });
  },

  /**
   * Owner Approve/Reject (Social Links) sprint — pure translation to the
   * repository's REJECTED-socials read, so the editor can surface the
   * Owner's rejectionNote next to the account it applies to. Sibling to
   * `getProposedSocials` above.
   *
   * @param {string} parentId - the Talent id
   */
  async getRejectedSocials(parentId) {
    return talentRepository.getRejectedSocialsForTalent(parentId);
  },

  /**
   * Gallery Sprint 1 — pure translation to the repository's
   * draft-or-proposed gallery-images read. Same optional-method pattern as
   * `getDraftOrProposedSocials` above. Backs MediaGalleryEditor's "Proposed
   * Update" grid once a save has happened.
   *
   * @param {string} parentId - the Talent id
   */
  async getDraftOrProposedGalleryImages(parentId) {
    return talentRepository.getDraftOrProposedGalleryImagesForTalent(parentId);
  },

  /**
   * Gallery Sprint 1 — pure translation to the repository's PROPOSED-only
   * gallery-images read. Same optional-method pattern as `getProposedSocials`
   * above. Backs GalleryOwnerReview.
   *
   * @param {string} parentId - the Talent id
   */
  async getProposedGalleryImages(parentId) {
    return talentRepository.getProposedGalleryImagesForTalent(parentId);
  },

  /**
   * Gallery Sprint 1 — pure translation to the repository's single-row
   * lookup, used by galleryService to check a row's current
   * ownership/status before deciding whether to update it in place or clone
   * it into a new draft. Sibling to `getSocialById`.
   *
   * @param {string} imageId
   */
  async getGalleryImageById(imageId) {
    return talentRepository.getTalentGalleryImageById(imageId);
  },

  /**
   * Gallery Sprint 1 — pure translation to the repository's insert
   * primitive. `meta.parentId` is this entity's `talentId` FK column, same
   * translation `insertDraftSocial` above already does for TalentSocial.
   *
   * @param {object} fields - { imageAssetId, order, altHe, altEn, position, scale, mobileOrder }
   * @param {object} meta - { parentId, basedOnVersionId, createdById }
   */
  async insertDraftGalleryImage(fields, { parentId, basedOnVersionId, createdById } = {}) {
    return talentRepository.insertDraftGalleryImage({
      talentId: parentId,
      fields,
      basedOnVersionId,
      createdById,
    });
  },

  /**
   * Gallery Sprint 1 — pure translation to the repository's partial-field
   * update primitive, same role `updateSocialFields` plays for TalentSocial.
   *
   * @param {string} imageId
   * @param {object} fields - partial TalentGalleryImage business fields
   */
  async updateGalleryImageFields(imageId, fields) {
    return talentRepository.updateTalentGalleryImageFields(imageId, fields);
  },

  /**
   * Gallery Sprint 1 — pure translation to the repository's bulk
   * DRAFT -> PROPOSED flip for every gallery-image row belonging to a
   * talent. Sibling to `submitDraftSocials`.
   *
   * @param {string} parentId - the Talent id
   */
  async submitDraftGalleryImages(parentId) {
    return talentRepository.submitDraftGalleryImagesForTalent(parentId);
  },

  /**
   * Gallery Sprint 1 — pure translation to the repository's approve
   * primitive, used by `galleryService.approve()`. Sibling to `approveSocial`.
   *
   * @param {string} imageId
   * @param {object} meta
   * @param {string} meta.approvedById
   */
  async approveGalleryImage(imageId, { approvedById } = {}) {
    return talentRepository.approveTalentGalleryImage(imageId, { approvedById });
  },

  /**
   * Gallery Sprint 1 — pure translation to the repository's rejection
   * primitive, used by `galleryService.reject()`. No decision about whether
   * rejection is allowed is made here — that belongs to `galleryService`,
   * same split `rejectSocial` above already follows. Sibling to
   * `rejectSocial`.
   *
   * @param {string} imageId
   * @param {object} meta
   * @param {string} meta.rejectionNote
   */
  async rejectGalleryImage(imageId, { rejectionNote } = {}) {
    return talentRepository.setTalentGalleryImageRejection(imageId, { rejectionNote });
  },

  /**
   * Gallery Sprint 1 — pure translation to the repository's
   * REJECTED-gallery-images read, so the editor can surface the Owner's
   * rejectionNote next to the image it applies to. Sibling to
   * `getRejectedSocials`.
   *
   * @param {string} parentId - the Talent id
   */
  async getRejectedGalleryImages(parentId) {
    return talentRepository.getRejectedGalleryImagesForTalent(parentId);
  },

  /**
   * Live Preview mapping (Section 7/13.11) — out of scope for this sprint.
   * Not called by anything yet; throws rather than silently returning a
   * wrong shape.
   */
  mapToPublicShape(/* version, related */) {
    throw new Error(
      '[talentAdapter.mapToPublicShape] not implemented yet — Live Preview ' +
        '(ADMIN_PANEL_PLAN.md Section 7/13.11) is a later sprint; nothing ' +
        'calls this yet.'
    );
  },
};

export default talentAdapter;
