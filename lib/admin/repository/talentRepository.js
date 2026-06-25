/*
 * Talent repository — skeleton only (Phase 1: Foundations).
 *
 * Defines the planned API surface for Talent / TalentVersion /
 * TalentSocial / TalentGalleryImage per ADMIN_PANEL_PLAN.md Sections 3, 4,
 * 5, 6. Route handlers and admin UI (Phase 4+) will call these instead of
 * touching `prisma` directly. No method here does real work yet — each
 * throws via notImplemented() until its implementation phase.
 *
 * Not imported by any route, page, or component yet. Not wired to the
 * public site, which continues reading data/talent/index.js directly.
 */

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
};

export default talentRepository;
