/*
 * talentAdapter — Sprint 3.3. The first real adapter, proving the
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
