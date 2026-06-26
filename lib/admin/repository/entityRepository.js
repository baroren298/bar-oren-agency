/*
 * Generic Entity/EntityVersion repository — skeleton (Phase 1: Foundations)
 * plus a set of thin primitives added in Sprint 3.6 for the Core Content
 * Engine's `entityAdapter` (lib/admin/engine/adapters/entityAdapter.js).
 *
 * Per ADMIN_PANEL_PLAN.md Section 3.1/3.3, this generic path is reserved
 * for content that doesn't warrant a dedicated table: the collaborations
 * list and agency-level social links. Do not extend this repository to
 * cover content types that would benefit from real columns — add a
 * dedicated repository/table instead (see talentRepository for the
 * normalized pattern).
 *
 * The original stub methods below (`getOrCreateEntity`, `getPublishedContent`,
 * `proposeContent`, `approve`, `reject`) defined the planned API surface for
 * Phase 7 route handlers and are left untouched — still stubs, still
 * throwing via notImplemented(). The Sprint 3.6 primitives below are
 * deliberately named differently (`getParentEntity`, `publishEntityVersion`,
 * `setEntityVersionRejection`, ...) to avoid colliding with those
 * pre-existing stub names while that reconciliation is pending, exactly
 * mirroring how talentRepository handled the same situation in Sprints
 * 3.3/3.4.
 *
 * These primitives exist solely so `entityAdapter` has something real to
 * call — they are the second adapter's repository layer, proving Phase 3
 * success criterion #8 (Section 13.17: "at least two adapters using the
 * engine with zero engine modifications") against an entity type that
 * actually has a parent row with `revisionNumber`/`currentPublishedVersionId`
 * (Entity), unlike SiteContent/Seo/LegalPage, which are self-versioning
 * rows with no separate parent table.
 *
 * Like talentRepository.publishTalentVersion, `publishEntityVersion`'s
 * in-transaction revision comparison is the one necessary exception to
 * "decision-free": Section 13.8 requires the authoritative conflict check
 * to run inside publishService.publish()'s own transaction, and only
 * `prisma.$transaction`'s callback can provide that atomicity. Every other
 * status/conflict/validation decision lives in the engine (proposalService,
 * conflictService, publishService, approvalService), never here.
 *
 * Not wired to the public site, which continues reading data/*.js directly.
 */

import { prisma } from '../db';
import { notImplemented } from './_notImplemented';
import { VERSION_STATUS, REVISION_CONFLICT_ERROR_CODE } from '../constants/enums';

export const entityRepository = {
  /** Get or create the Entity row for a given entityType (+ optional entityId). (Phase 7) */
  async getOrCreateEntity(/* entityType, entityId */) {
    return notImplemented('entityRepository.getOrCreateEntity');
  },

  /** Get the currently published EntityVersion's content for an entity. (Phase 7) */
  async getPublishedContent(/* entityType, entityId */) {
    return notImplemented('entityRepository.getPublishedContent');
  },

  /** Propose new content for an entity (Section 6 optimistic locking applies). (Phase 7) */
  async proposeContent(/* entityType, entityId, content, { basedOnRevisionNumber, createdById } */) {
    return notImplemented('entityRepository.proposeContent');
  },

  /** Approve/reject a proposed EntityVersion (Section 4). (Phase 7) */
  async approve(/* entityVersionId, { approvedById, ip, userAgent } */) {
    return notImplemented('entityRepository.approve');
  },
  async reject(/* entityVersionId, { rejectedById, rejectionNote, ip, userAgent } */) {
    return notImplemented('entityRepository.reject');
  },

  /**
   * List Entity rows for one entityType (Sprint 4.1 — the same read-only
   * roster-list primitive talentRepository.listTalents() provides for
   * Talent, here for the generic Entity/EntityVersion pair). Used by
   * createEntityAdapter()'s `listParents`, which is itself not wired into
   * any admin page yet — added so the contract addition (Section 13.10)
   * is satisfied identically by both real adapters, matching how the rest
   * of this file's Sprint 3.6 primitives mirror talentRepository's shape.
   *
   * Decision-free per Section 13.15: `content` is free-form Json
   * (Section 3.1), so unlike talentRepository.listTalents() there is no
   * generic, safe display field to surface — this only reports existence
   * (has a published version, has a pending version), never resolves or
   * shapes `content` itself.
   *
   * @param {object} opts
   * @param {string} opts.entityType - required; an Entity row is only ever
   *   listed within its own entityType (Section 3.1's `@@unique([entityType, entityId])`)
   * @param {string} [opts.status] - LIFECYCLE_STATUS filter
   * @returns {Promise<Array<{
   *   id: string, entityId: string|null, status: string,
   *   hasPublishedVersion: boolean, hasPendingChanges: boolean,
   * }>>}
   */
  async listEntities({ entityType, status } = {}) {
    if (!entityType) {
      throw new Error('[entityRepository.listEntities] entityType is required.');
    }

    const entities = await prisma.entity.findMany({
      where: { entityType, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        versions: {
          where: { status: { in: [VERSION_STATUS.DRAFT, VERSION_STATUS.PROPOSED] } },
          select: { id: true },
          take: 1,
        },
      },
    });

    return entities.map((entity) => ({
      id: entity.id,
      entityId: entity.entityId,
      status: entity.status,
      hasPublishedVersion: Boolean(entity.currentPublishedVersionId),
      hasPendingChanges: entity.versions.length > 0,
    }));
  },

  // ───────────────────────────────────────────────────────────────────────
  // Sprint 3.6 — thin primitives for the Core Content Engine's
  // entityAdapter (lib/admin/engine/adapters/entityAdapter.js). See header
  // comment: no version-transition or conflict decisions here, except the
  // one noted exception in publishEntityVersion.
  // ───────────────────────────────────────────────────────────────────────

  /** Fetch the bare Entity row (for adapter.getParent / conflictService's revisionNumber read). */
  async getParentEntity(entityRowId) {
    if (!entityRowId) return null;
    return prisma.entity.findUnique({ where: { id: entityRowId } });
  },

  /** Fetch one EntityVersion row by id (for adapter.getVersion). */
  async getEntityVersionById(versionId) {
    if (!versionId) return null;
    return prisma.entityVersion.findUnique({ where: { id: versionId } });
  },

  /** List every EntityVersion for an Entity, newest first (for adapter.listVersionsForParent). */
  async listEntityVersionsForParent(entityRowId) {
    return prisma.entityVersion.findMany({
      where: { entityId: entityRowId },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Insert a new EntityVersion row exactly as given — no status/conflict
   * decision is made here, that's `proposalService`'s job. Unlike
   * talentRepository.insertTalentVersion, there are no named business
   * columns to map: EntityVersion.content is a single Json field, so the
   * adapter's `fields` argument is stored verbatim. Used by
   * adapter.insertProposedVersion.
   */
  async insertEntityVersion({
    entityId,
    fields,
    status,
    basedOnVersionId,
    basedOnRevisionNumber,
    createdById,
  }) {
    return prisma.entityVersion.create({
      data: {
        entityId,
        status,
        basedOnVersionId: basedOnVersionId || null,
        basedOnRevisionNumber: basedOnRevisionNumber ?? null,
        createdById,
        content: fields,
      },
    });
  },

  /**
   * Flip an EntityVersion's status — no decision about whether the flip is
   * allowed happens here, that's `proposalService.submit()`'s job. Used by
   * adapter.submitVersion.
   */
  async updateEntityVersionStatus(versionId, status) {
    return prisma.entityVersion.update({
      where: { id: versionId },
      data: { status },
    });
  },

  /**
   * Atomically publish a PROPOSED EntityVersion (Sections 4, 13.5,
   * 13.17#3): supersede the entity's current published version (if any),
   * flip the target version to PUBLISHED with approvedById/approvedAt set,
   * repoint Entity.currentPublishedVersionId at it, and bump
   * Entity.revisionNumber — all inside one `prisma.$transaction`. This is a
   * direct structural mirror of talentRepository.publishTalentVersion,
   * since Entity/EntityVersion carries the same parent-pointer +
   * revisionNumber shape as Talent/TalentVersion (unlike SiteContent/Seo/
   * LegalPage, which have no separate parent row to repoint).
   *
   * Section 13.8's authoritative conflict check happens here, at the start
   * of the same transaction: if `expectedRevisionNumber` is supplied and no
   * longer matches the entity's live `revisionNumber`, this throws before
   * any write — which aborts the whole transaction. The thrown error
   * carries `code: REVISION_CONFLICT_ERROR_CODE` plus
   * `currentRevisionNumber` / `expectedRevisionNumber` so
   * `publishService.publish()` can recognize and translate it, without this
   * repository importing anything from the engine layer.
   *
   * `expectedRevisionNumber == null` means "no base to compare against" —
   * skipped, not treated as a conflict, mirroring
   * `conflictService.checkRevision`'s own behavior.
   *
   * @param {string} versionId
   * @param {object} params
   * @param {number|null} [params.expectedRevisionNumber]
   * @param {string} params.approvedById
   * @returns {Promise<{ version: object, parent: object }>}
   */
  async publishEntityVersion(versionId, { expectedRevisionNumber, approvedById } = {}) {
    if (!versionId) {
      throw new Error('[entityRepository.publishEntityVersion] versionId is required.');
    }
    if (!approvedById) {
      throw new Error('[entityRepository.publishEntityVersion] approvedById is required.');
    }

    return prisma.$transaction(async (tx) => {
      const version = await tx.entityVersion.findUnique({ where: { id: versionId } });
      if (!version) {
        throw new Error(
          `[entityRepository.publishEntityVersion] no EntityVersion found for id "${versionId}".`
        );
      }

      const entity = await tx.entity.findUnique({ where: { id: version.entityId } });
      if (!entity) {
        throw new Error(
          `[entityRepository.publishEntityVersion] no parent Entity found for id "${version.entityId}".`
        );
      }

      if (expectedRevisionNumber != null && entity.revisionNumber !== expectedRevisionNumber) {
        throw Object.assign(
          new Error(
            `[entityRepository.publishEntityVersion] revision conflict: entity "${entity.id}" ` +
              `is at revisionNumber ${entity.revisionNumber}, expected ${expectedRevisionNumber}.`
          ),
          {
            code: REVISION_CONFLICT_ERROR_CODE,
            currentRevisionNumber: entity.revisionNumber,
            expectedRevisionNumber,
          }
        );
      }

      if (entity.currentPublishedVersionId && entity.currentPublishedVersionId !== versionId) {
        await tx.entityVersion.update({
          where: { id: entity.currentPublishedVersionId },
          data: { status: VERSION_STATUS.SUPERSEDED },
        });
      }

      const publishedVersion = await tx.entityVersion.update({
        where: { id: versionId },
        data: {
          status: VERSION_STATUS.PUBLISHED,
          approvedById,
          approvedAt: new Date(),
        },
      });

      const publishedEntity = await tx.entity.update({
        where: { id: entity.id },
        data: {
          currentPublishedVersionId: versionId,
          revisionNumber: { increment: 1 },
        },
      });

      return { version: publishedVersion, parent: publishedEntity };
    });
  },

  /**
   * Flip an EntityVersion to REJECTED with its required rejectionNote
   * (Section 4). No parent repoint, no transaction needed — a single-row
   * update. Named distinctly from the pre-existing `reject` stub above to
   * avoid a collision; used by adapter.rejectVersion.
   */
  async setEntityVersionRejection(versionId, { rejectionNote } = {}) {
    if (!versionId) {
      throw new Error('[entityRepository.setEntityVersionRejection] versionId is required.');
    }
    if (!rejectionNote || !rejectionNote.trim()) {
      throw new Error('[entityRepository.setEntityVersionRejection] rejectionNote is required.');
    }

    return prisma.entityVersion.update({
      where: { id: versionId },
      data: { status: VERSION_STATUS.REJECTED, rejectionNote },
    });
  },
};

export default entityRepository;
