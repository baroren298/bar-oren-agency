/*
 * Talent repository — skeleton only (Phase 1: Foundations), plus a set of
 * thin primitives added in Sprint 3.3 for the Core Content Engine's
 * `talentAdapter` (lib/admin/engine/adapters/talentAdapter.js).
 *
 * The original stub methods below (`listTalents`, `getTalentById`,
 * `proposeTalentVersion`, `approveTalentVersion`, etc.) defined the
 * planned API surface for Phase 4/5 route handlers per
 * ADMIN_PANEL_PLAN.md Sections 3, 4, 5, 6, written before the v1.4
 * layering rules (Section 13.15) existed. They are left untouched here —
 * still stubs, still throwing via notImplemented() — since deciding
 * whether Phase 4 calls them directly or rebuilds equivalent behavior on
 * top of the engine/adapter is a Phase 4 decision, not this sprint's.
 *
 * The new "Sprint 3.3" methods below are intentionally lower-level and
 * decision-free (Section 13.15: "Repositories are a thin data-access
 * layer over Prisma — query construction and shape-mapping only, no
 * approval/publish/version-transition decisions") — they exist solely so
 * `talentAdapter` has something real to call. Every status/conflict/
 * validation decision lives in the engine (`proposalService`,
 * `conflictService`), never here.
 *
 * Not wired to the public site, which continues reading
 * data/talent/index.js directly.
 */

import { prisma } from '../db';
import { notImplemented } from './_notImplemented';

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
};

export default talentRepository;
