/*
 * fakeEntityAdapter — Sprint 3.8 test double, shaped exactly like the real
 * lib/admin/engine/adapters/entityAdapter.js: a parameterized `entityType`,
 * the same conservative DEFAULT_CAPABILITIES (no preview/scheduling/SEO/
 * gallery, but soft-delete/publish/archive supported), and the same
 * free-form `fields` vocabulary (validate only requires a non-null,
 * non-array object — no named columns, unlike fakeTalentAdapter's
 * `fields.name`). Backed by inMemoryVersionStore.js instead of
 * entityRepository/Prisma.
 *
 * Purpose: exercise the real, unmodified engine services against the
 * *second* of the two adapter "shapes" Phase 3 success criterion #8
 * (ADMIN_PANEL_PLAN.md Section 13.17) requires — deliberately different
 * from fakeTalentAdapter's validation/capabilities so a test that passes
 * against both is actually proving genericness, not just running the same
 * fixture twice.
 */
import { VERSION_STATUS } from '../../../constants/enums';
import { createInMemoryVersionStore } from './inMemoryVersionStore';

const DEFAULT_CAPABILITIES = Object.freeze({
  supportsPreview: false,
  supportsScheduling: false,
  supportsSEO: false,
  supportsGallery: false,
  supportsSoftDelete: true,
  supportsPublishing: true,
  supportsArchive: true,
});

export function createFakeEntityAdapter(entityType, { capabilities } = {}) {
  if (!entityType) {
    throw new Error('[fakeEntityAdapter] createFakeEntityAdapter requires an entityType.');
  }

  const store = createInMemoryVersionStore();

  const adapter = {
    entityType,

    capabilities: Object.freeze({
      ...DEFAULT_CAPABILITIES,
      ...(capabilities || {}),
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

    /** Mirrors entityAdapter.validate's real rule: any non-null, non-array object. */
    validate(fields) {
      const errors = [];
      if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
        errors.push('fields must be a non-null object');
      }
      return { valid: errors.length === 0, errors };
    },

    mapToPublicShape() {
      throw new Error('[fakeEntityAdapter.mapToPublicShape] not implemented — Live Preview is out of scope.');
    },

    /** Test-only — seeds a parent row directly, bypassing the engine. */
    _seedParent(opts) {
      return store.createParent(opts);
    },
  };

  return adapter;
}
