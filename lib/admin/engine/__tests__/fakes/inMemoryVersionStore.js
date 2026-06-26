/*
 * In-memory parent+version store — Sprint 3.8 test fake (ADMIN_PANEL_PLAN.md
 * Section 13.17, engine verification). Mirrors the exact publish/reject/
 * supersede transaction semantics of lib/admin/repository/talentRepository.js
 * (`publishTalentVersion`) and lib/admin/repository/entityRepository.js
 * (`publishEntityVersion`) — which are themselves structural mirrors of one
 * another — without Prisma, a database connection, or a migration.
 *
 * This is the one piece of logic duplicated from the real repositories
 * (the authoritative revision-conflict check, supersede, repoint,
 * increment). Everything else it backs (the adapters in this same
 * __tests__/fakes/ directory, and the real engine services that call them)
 * is the actual, unmodified production code — only the Prisma-backed
 * storage layer is faked, per the approved Sprint 3.8 scope.
 */
import { VERSION_STATUS, REVISION_CONFLICT_ERROR_CODE } from '../../../constants/enums';

let idCounter = 0;
function nextId(prefix) {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

export function createInMemoryVersionStore() {
  const parents = new Map();
  const versions = new Map();

  return {
    /** Seed a parent row (mirrors a fresh Talent/Entity row with no published version yet). */
    createParent({ id, revisionNumber = 0, currentPublishedVersionId = null, status = 'ACTIVE' } = {}) {
      const parentId = id || nextId('parent');
      const parent = { id: parentId, revisionNumber, currentPublishedVersionId, status };
      parents.set(parentId, parent);
      return parent;
    },

    /**
     * Sprint 4.1 — mirrors talentRepository.listTalents() /
     * entityRepository.listEntities()'s shape exactly: bare parent rows
     * plus a `hasPendingChanges` flag derived from whether any DRAFT/
     * PROPOSED version exists for that parent. Read-only, decision-free,
     * same as the real repositories.
     */
    async listParents({ status } = {}) {
      return Array.from(parents.values())
        .filter((p) => !status || p.status === status)
        .map((p) => ({
          id: p.id,
          status: p.status,
          hasPublishedVersion: Boolean(p.currentPublishedVersionId),
          hasPendingChanges: Array.from(versions.values()).some(
            (v) =>
              v.parentId === p.id &&
              (v.status === VERSION_STATUS.DRAFT || v.status === VERSION_STATUS.PROPOSED)
          ),
        }));
    },

    async getParent(parentId) {
      return parents.get(parentId) || null;
    },

    async getVersion(versionId) {
      return versions.get(versionId) || null;
    },

    async listVersionsForParent(parentId) {
      return Array.from(versions.values())
        .filter((v) => v.parentId === parentId)
        .sort((a, b) => b.createdAt - a.createdAt);
    },

    async insertVersion({ parentId, fields, status, basedOnVersionId, basedOnRevisionNumber, createdById }) {
      const version = {
        id: nextId('version'),
        parentId,
        fields,
        status,
        basedOnVersionId: basedOnVersionId || null,
        basedOnRevisionNumber: basedOnRevisionNumber ?? null,
        createdById,
        approvedById: null,
        approvedAt: null,
        rejectionNote: null,
        // monotonic counter stands in for createdAt so "newest first" sort
        // is deterministic regardless of how fast the test runs.
        createdAt: idCounter,
      };
      versions.set(version.id, version);
      return version;
    },

    async updateVersionStatus(versionId, status) {
      const version = versions.get(versionId);
      if (!version) throw new Error(`[inMemoryVersionStore] no version "${versionId}".`);
      version.status = status;
      return version;
    },

    /**
     * Mirrors talentRepository.publishTalentVersion / entityRepository.
     * publishEntityVersion exactly: the authoritative revision-conflict
     * check runs first and aborts (no mutation at all) on a stale
     * `expectedRevisionNumber`; otherwise the prior published version (if
     * any) is superseded, the target version is published, and the parent
     * is repointed + its revisionNumber bumped — all before this function
     * returns, standing in for the real repository's single
     * `prisma.$transaction`.
     */
    async publishVersion(versionId, { expectedRevisionNumber, approvedById } = {}) {
      const version = versions.get(versionId);
      if (!version) throw new Error(`[inMemoryVersionStore] no version "${versionId}".`);
      const parent = parents.get(version.parentId);
      if (!parent) throw new Error(`[inMemoryVersionStore] no parent "${version.parentId}".`);

      if (expectedRevisionNumber != null && parent.revisionNumber !== expectedRevisionNumber) {
        throw Object.assign(
          new Error(
            `[inMemoryVersionStore] revision conflict: parent "${parent.id}" is at ` +
              `revisionNumber ${parent.revisionNumber}, expected ${expectedRevisionNumber}.`
          ),
          {
            code: REVISION_CONFLICT_ERROR_CODE,
            currentRevisionNumber: parent.revisionNumber,
            expectedRevisionNumber,
          }
        );
      }

      if (parent.currentPublishedVersionId && parent.currentPublishedVersionId !== versionId) {
        const prior = versions.get(parent.currentPublishedVersionId);
        if (prior) prior.status = VERSION_STATUS.SUPERSEDED;
      }

      version.status = VERSION_STATUS.PUBLISHED;
      version.approvedById = approvedById;
      version.approvedAt = new Date();

      parent.currentPublishedVersionId = versionId;
      parent.revisionNumber += 1;

      return { version, parent };
    },

    async setVersionRejection(versionId, { rejectionNote } = {}) {
      const version = versions.get(versionId);
      if (!version) throw new Error(`[inMemoryVersionStore] no version "${versionId}".`);
      if (!rejectionNote || !rejectionNote.trim()) {
        throw new Error('[inMemoryVersionStore] rejectionNote is required.');
      }
      version.status = VERSION_STATUS.REJECTED;
      version.rejectionNote = rejectionNote;
      return version;
    },

    /** Test-only introspection — never called by the engine itself. */
    _debugAllVersions() {
      return Array.from(versions.values());
    },
  };
}
