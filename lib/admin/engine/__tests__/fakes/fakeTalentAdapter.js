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

export function createFakeTalentAdapter() {
  const store = createInMemoryVersionStore();

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
      return store.getVersion(versionId);
    },

    async listVersionsForParent(parentId) {
      return store.listVersionsForParent(parentId);
    },

    async insertProposedVersion(fields, meta) {
      const { parentId, status = VERSION_STATUS.DRAFT, basedOnVersionId, basedOnRevisionNumber, createdById } = meta;
      return store.insertVersion({ parentId, fields, status, basedOnVersionId, basedOnRevisionNumber, createdById });
    },

    async submitVersion(versionId) {
      return store.updateVersionStatus(versionId, VERSION_STATUS.PROPOSED);
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

    /** Test-only — seeds a parent row directly, bypassing the engine. */
    _seedParent(opts) {
      return store.createParent(opts);
    },
  };

  return adapter;
}
