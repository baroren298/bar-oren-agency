/*
 * Talent repository — skeleton only (Phase 1: Foundations), plus sets of
 * thin primitives added in Sprint 3.3 and Sprint 3.4 for the Core Content
 * Engine's `talentAdapter` (lib/admin/engine/adapters/talentAdapter.js).
 *
 * The original stub methods below (`listTalents`, `getTalentById`,
 * `proposeTalentVersion`, `approveTalentVersion`, `rejectTalentVersion`,
 * etc.) defined the planned API surface for Phase 4/5 route handlers per
 * ADMIN_PANEL_PLAN.md Sections 3, 4, 5, 6, written before the v1.4
 * layering rules (Section 13.15) existed. They are left untouched here —
 * still stubs, still throwing via notImplemented() — since deciding
 * whether Phase 4 calls them directly or rebuilds equivalent behavior on
 * top of the engine/adapter is a Phase 4 decision, not this sprint's. Note
 * the Sprint 3.4 primitives below are deliberately named differently
 * (`publishTalentVersion`, `setTalentVersionRejection`) to avoid colliding
 * with these pre-existing stub names while that reconciliation is pending.
 *
 * The "Sprint 3.3"/"Sprint 3.4" methods below are intentionally lower-level
 * and decision-free where the data shape allows it (Section 13.15:
 * "Repositories are a thin data-access layer over Prisma — query
 * construction and shape-mapping only, no approval/publish/version-
 * transition decisions") — they exist solely so `talentAdapter` has
 * something real to call. The one necessary exception is
 * `publishTalentVersion`'s in-transaction revision comparison: Section
 * 13.8 requires the authoritative conflict check to run inside
 * publishService.publish()'s own transaction, not as a separate read-then-
 * write, and only the repository's `prisma.$transaction` callback can
 * provide that atomicity. That comparison is mechanical (does a live
 * column equal an expected number?), not a judgment call — the actual
 * decision of what a conflict *means* and how to respond still lives in
 * `publishService` (Section 13.16: "services own business logic"), which
 * is why the repository communicates it by throwing a tagged error
 * (`REVISION_CONFLICT_ERROR_CODE`) rather than silently choosing a winner.
 * Every other status/conflict/validation decision lives in the engine
 * (`proposalService`, `conflictService`, `publishService`,
 * `approvalService`), never here.
 *
 * Not wired to the public site, which continues reading
 * data/talent/index.js directly.
 */

import { prisma } from '../db';
import { notImplemented } from './_notImplemented';
import { VERSION_STATUS, REVISION_CONFLICT_ERROR_CODE } from '../constants/enums';

export const talentRepository = {
  /** List talents for /admin/talent, with optional lifecycle status filter. (Phase 4) */
  async listTalents(/* { status } = {} */) {
    return notImplemented('talentRepository.listTalents');
  },

  /** Fetch one talent plus its current published version, socials, gallery. (Phase 4) */
  async getTalentById(/* talentId */) {
    return notImplemented('talentRepository.getTalentById');
  },

  /** Fetch one talent by slug — mirrors the public site's lookup pattern. (Phase 4) */
  async getTalentBySlug(/* slug */) {
    return notImplemented('talentRepository.getTalentBySlug');
  },

  /**
   * Create a proposed TalentVersion for an existing talent. Performs the
   * optimistic-locking check from Section 6: compares `basedOnRevisionNumber`
   * against the talent's live `revisionNumber` and returns a conflict
   * result (not a throw) if stale, so the caller can render the
   * conflict-resolution screen. (Phase 4)
   */
  async proposeTalentVersion(/* talentId, fields, { basedOnRevisionNumber, createdById } */) {
    return notImplemented('talentRepository.proposeTalentVersion');
  },

  /** Create a brand-new talent as a proposal with no published counterpart yet. (Phase 4) */
  async proposeNewTalent(/* fields, { createdById } */) {
    return notImplemented('talentRepository.proposeNewTalent');
  },

  /**
   * Approve a proposed TalentVersion: flips it to PUBLISHED, flips the
   * prior published version to SUPERSEDED, repoints
   * Talent.currentPublishedVersionId, and bumps Talent.revisionNumber —
   * all in one transaction (Section 4). Also writes the AuditLog row
   * (Section 4.1). (Phase 5)
   */
  async approveTalentVersion(/* talentVersionId, { approvedById, ip, userAgent } */) {
    return notImplemented('talentRepository.approveTalentVersion');
  },

  /** Reject a proposed TalentVersion with a required rejectionNote (Section 4). (Phase 5) */
  async rejectTalentVersion(/* talentVersionId, { rejectedById, rejectionNote, ip, userAgent } */) {
    return notImplemented('talentRepository.rejectTalentVersion');
  },

  /** Soft-delete/archive/hide/restore a talent — status transition only, never a real DELETE (Section 5). (Phase 4) */
  async setTalentLifecycleStatus(/* talentId, status, { actorId, ip, userAgent } */) {
    return notImplemented('talentRepository.setTalentLifecycleStatus');
  },

  /** Propose social link changes for a talent (Section 3.2). (Phase 4) */
  async proposeTalentSocial(/* talentId, platform, proposedUrl, followerCount */) {
    return notImplemented('talentRepository.proposeTalentSocial');
  },

  /** Propose gallery additions/removals/reordering/crop edits (Section 10). (Phase 6) */
  async proposeGalleryChange(/* talentId, change */) {
    return notImplemented('talentRepository.proposeGalleryChange');
  },

  // ───────────────────────────────────────────────────────────────────────
  // Sprint 3.3 — thin primitives for the Core Content Engine's
  // talentAdapter (lib/admin/engine/adapters/talentAdapter.js). See header
  // comment: no version-transition or conflict decisions here.
  // ───────────────────────────────────────────────────────────────────────

  /** Fetch the bare Talent row (for adapter.getParent / conflictService's revisionNumber read). */
  async getParentTalent(talentId) {
    if (!talentId) return null;
    return prisma.talent.findUnique({ where: { id: talentId } });
  },

  /** Fetch one TalentVersion row by id (for adapter.getVersion). */
  async getTalentVersionById(versionId) {
    if (!versionId) return null;
    return prisma.talentVersion.findUnique({ where: { id: versionId } });
  },

  /** List every TalentVersion for a talent, newest first (for adapter.listVersionsForParent). */
  async listTalentVersionsForTalent(talentId) {
    return prisma.talentVersion.findMany({
      where: { talentId },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Insert a new TalentVersion row exactly as given — no status/conflict
   * decision is made here, that's `proposalService`'s job. Used by
   * adapter.insertProposedVersion.
   */
  async insertTalentVersion({
    talentId,
    fields,
    status,
    basedOnVersionId,
    basedOnRevisionNumber,
    createdById,
  }) {
    return prisma.talentVersion.create({
      data: {
        talentId,
        status,
        basedOnVersionId: basedOnVersionId || null,
        basedOnRevisionNumber: basedOnRevisionNumber ?? null,
        createdById,
        name: fields.name,
        nameEn: fields.nameEn,
        category: fields.category || [],
        tags: fields.tags || [],
        featured: fields.featured ?? false,
        featuredOrder: fields.featuredOrder,
        sortOrder: fields.sortOrder,
        location: fields.location,
        locationEn: fields.locationEn,
        birthDate: fields.birthDate,
        bioHe: fields.bioHe,
        bioEn: fields.bioEn,
        profileImageAssetId: fields.profileImageAssetId,
        profileImagePosition: fields.profileImagePosition,
        profileImageScale: fields.profileImageScale,
      },
    });
  },

  /**
   * Flip a TalentVersion's status — no decision about whether the flip is
   * allowed happens here, that's `proposalService.submit()`'s job. Used by
   * adapter.submitVersion.
   */
  async updateTalentVersionStatus(versionId, status) {
    return prisma.talentVersion.update({
      where: { id: versionId },
      data: { status },
    });
  },

  // ───────────────────────────────────────────────────────────────────────
  // Sprint 3.4 — thin primitives for publishService/approvalService, via
  // talentAdapter.publishVersion / talentAdapter.rejectVersion. See header
  // comment for why publishTalentVersion's revision comparison is the one
  // exception to "decision-free."
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Atomically publish a PROPOSED TalentVersion (Sections 4, 13.5,
   * 13.17#3): supersede the talent's current published version (if any),
   * flip the target version to PUBLISHED with approvedById/approvedAt set,
   * repoint Talent.currentPublishedVersionId at it, and bump
   * Talent.revisionNumber — all inside one `prisma.$transaction`.
   *
   * Section 13.8's authoritative conflict check happens here, at the start
   * of the same transaction: if `expectedRevisionNumber` is supplied and no
   * longer matches the talent's live `revisionNumber`, this throws before
   * any write — which aborts the whole transaction — rather than returning
   * a result the caller has to remember to check. The thrown error carries
   * `code: REVISION_CONFLICT_ERROR_CODE` plus `currentRevisionNumber` /
   * `expectedRevisionNumber` so `publishService.publish()` can recognize it
   * and translate it into the same conflict shape `conflictService` uses,
   * without this repository importing anything from the engine layer.
   *
   * `expectedRevisionNumber == null` means "no base to compare against"
   * (e.g. a brand-new entity's first publish) — skipped, not treated as a
   * conflict, mirroring `conflictService.checkRevision`'s own behavior.
   *
   * @param {string} versionId
   * @param {object} params
   * @param {number|null} [params.expectedRevisionNumber]
   * @param {string} params.approvedById
   * @returns {Promise<{ version: object, parent: object }>}
   */
  async publishTalentVersion(versionId, { expectedRevisionNumber, approvedById } = {}) {
    if (!versionId) {
      throw new Error('[talentRepository.publishTalentVersion] versionId is required.');
    }
    if (!approvedById) {
      throw new Error('[talentRepository.publishTalentVersion] approvedById is required.');
    }

    return prisma.$transaction(async (tx) => {
      const version = await tx.talentVersion.findUnique({ where: { id: versionId } });
      if (!version) {
        throw new Error(
          `[talentRepository.publishTalentVersion] no TalentVersion found for id "${versionId}".`
        );
      }

      const talent = await tx.talent.findUnique({ where: { id: version.talentId } });
      if (!talent) {
        throw new Error(
          `[talentRepository.publishTalentVersion] no parent Talent found for id "${version.talentId}".`
        );
      }

      if (expectedRevisionNumber != null && talent.revisionNumber !== expectedRevisionNumber) {
        throw Object.assign(
          new Error(
            `[talentRepository.publishTalentVersion] revision conflict: talent "${talent.id}" ` +
              `is at revisionNumber ${talent.revisionNumber}, expected ${expectedRevisionNumber}.`
          ),
          {
            code: REVISION_CONFLICT_ERROR_CODE,
            currentRevisionNumber: talent.revisionNumber,
            expectedRevisionNumber,
          }
        );
      }

      if (talent.currentPublishedVersionId && talent.currentPublishedVersionId !== versionId) {
        await tx.talentVersion.update({
          where: { id: talent.currentPublishedVersionId },
          data: { status: VERSION_STATUS.SUPERSEDED },
        });
      }

      const publishedVersion = await tx.talentVersion.update({
        where: { id: versionId },
        data: {
          status: VERSION_STATUS.PUBLISHED,
          approvedById,
          approvedAt: new Date(),
        },
      });

      const publishedTalent = await tx.talent.update({
        where: { id: talent.id },
        data: {
          currentPublishedVersionId: versionId,
          revisionNumber: { increment: 1 },
        },
      });

      return { version: publishedVersion, parent: publishedTalent };
    });
  },

  /**
   * Flip a TalentVersion to REJECTED with its required rejectionNote
   * (Section 4: "Rejection flips status to rejected with a required
   * rejectionNote; nothing about the published pointer changes"). No
   * parent repoint, no transaction needed — a single-row update. Named
   * distinctly from the pre-existing `rejectTalentVersion` stub above to
   * avoid a collision; used by adapter.rejectVersion.
   */
  async setTalentVersionRejection(versionId, { rejectionNote } = {}) {
    if (!versionId) {
      throw new Error('[talentRepository.setTalentVersionRejection] versionId is required.');
    }
    if (!rejectionNote || !rejectionNote.trim()) {
      throw new Error('[talentRepository.setTalentVersionRejection] rejectionNote is required.');
    }

    return prisma.talentVersion.update({
      where: { id: versionId },
      data: { status: VERSION_STATUS.REJECTED, rejectionNote },
    });
  },
};

export default talentRepository;
