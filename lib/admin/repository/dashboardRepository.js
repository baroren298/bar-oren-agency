/*
 * Dashboard repository — Owner Dashboard Sprint 1 (see
 * OWNER_DASHBOARD_UX_SPEC.md).
 *
 * Read-only, cross-entity queries that feed lib/admin/dashboard/
 * dashboardService.js — the dashboard page itself never imports this file
 * (Section 13.15 layering: page → service → repository, never page →
 * repository).
 *
 * Decision-free per Section 13.15 ("thin data-access layer ... query
 * construction and shape-mapping only"): every method here takes the
 * status it should fetch as an argument and returns raw-ish rows. What a
 * status *means* for the dashboard (what counts as "pending approval",
 * how socials/gallery rows group into one queue item, who counts as an
 * "employee") is decided in dashboardService, not here.
 *
 * The three list methods deliberately have no `limit`/`take`: the
 * dashboard's grouping and total counts need the full (small) queue, and
 * these queues are bounded by real-world workflow volume (a handful of
 * open proposals/drafts at a time), not by table size. Revisit with
 * pagination only if that assumption breaks.
 *
 * Shared filters (the one "visible-by-default" convention, reused from
 * constants rather than re-decided here):
 *   - rows whose own lifecycleStatus is ARCHIVED/DELETED are excluded
 *     (TalentSocial / TalentGalleryImage — TalentVersion has no
 *     lifecycleStatus axis);
 *   - rows whose parent Talent is ARCHIVED/DELETED are excluded, so a
 *     soft-deleted talent's leftover proposals never haunt the Owner's
 *     queues.
 */

import { prisma } from '../db';
import { ACTION_TYPE, DEFAULT_HIDDEN_LIFECYCLE_STATUSES } from '../constants/enums';

/** Actor shape selected everywhere a "who" is shown on the dashboard. */
const USER_SELECT = Object.freeze({
  select: { id: true, displayName: true, email: true, role: true },
});

/** Parent-talent filter shared by all three list methods (see header). */
const VISIBLE_PARENT_TALENT = Object.freeze({
  status: { notIn: [...DEFAULT_HIDDEN_LIFECYCLE_STATUSES] },
});

export const dashboardRepository = {
  /**
   * TalentVersion rows (the "פרטי מיוצג" work type) in a given
   * VersionStatus, oldest first. The display name comes from the version
   * row itself (a TalentVersion always carries `name`).
   *
   * Clean Admin Talent URL sprint: the parent talent's current published
   * `slug` is now selected too (decision-free shape widening, Section
   * 13.15 — same nested select the socials/gallery methods below already
   * make), so dashboardService can build slug-based workspace links for
   * details items as well.
   *
   * @param {string} status - VERSION_STATUS value (PROPOSED/REJECTED/DRAFT)
   * @returns {Promise<Array<{
   *   id: string, talentId: string, name: string,
   *   createdAt: Date, rejectionNote: string|null,
   *   createdBy: { id, displayName, email, role },
   *   talent: { slug: string },
   * }>>}
   */
  async listTalentVersionsByStatus(status) {
    if (!status) {
      throw new Error('[dashboardRepository.listTalentVersionsByStatus] status is required.');
    }
    return prisma.talentVersion.findMany({
      where: { status, talent: VISIBLE_PARENT_TALENT },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        id: true,
        talentId: true,
        name: true,
        createdAt: true,
        rejectionNote: true,
        createdBy: USER_SELECT,
        talent: { select: { slug: true } },
      },
    });
  },

  /**
   * TalentSocial rows (the "רשתות חברתיות" work type) in a given
   * versionStatus, oldest-updated first. Includes the parent talent's
   * current published display name since a social row has no name of its
   * own.
   *
   * @param {string} versionStatus - VERSION_STATUS value
   * @returns {Promise<Array<{
   *   id: string, talentId: string,
   *   createdAt: Date, updatedAt: Date, rejectionNote: string|null,
   *   createdBy: { id, displayName, email, role },
   *   talent: { slug: string, currentPublishedVersion: { name: string }|null },
   * }>>}
   */
  async listTalentSocialsByVersionStatus(versionStatus) {
    if (!versionStatus) {
      throw new Error(
        '[dashboardRepository.listTalentSocialsByVersionStatus] versionStatus is required.'
      );
    }
    return prisma.talentSocial.findMany({
      where: {
        versionStatus,
        lifecycleStatus: { notIn: [...DEFAULT_HIDDEN_LIFECYCLE_STATUSES] },
        talent: VISIBLE_PARENT_TALENT,
      },
      orderBy: [{ updatedAt: 'asc' }],
      select: {
        id: true,
        talentId: true,
        createdAt: true,
        updatedAt: true,
        rejectionNote: true,
        createdBy: USER_SELECT,
        talent: {
          select: { slug: true, currentPublishedVersion: { select: { name: true } } },
        },
      },
    });
  },

  /**
   * TalentGalleryImage rows (the "גלריה" work type) in a given
   * versionStatus, oldest-updated first. `createdBy` is nullable here —
   * unlike TalentSocial/TalentVersion, historical gallery rows may predate
   * the createdById column (see prisma/schema.prisma's TalentGalleryImage
   * backfill note).
   *
   * @param {string} versionStatus - VERSION_STATUS value
   * @returns {Promise<Array<{
   *   id: string, talentId: string,
   *   createdAt: Date, updatedAt: Date, rejectionNote: string|null,
   *   createdBy: { id, displayName, email, role }|null,
   *   talent: { slug: string, currentPublishedVersion: { name: string }|null },
   * }>>}
   */
  async listTalentGalleryImagesByVersionStatus(versionStatus) {
    if (!versionStatus) {
      throw new Error(
        '[dashboardRepository.listTalentGalleryImagesByVersionStatus] versionStatus is required.'
      );
    }
    return prisma.talentGalleryImage.findMany({
      where: {
        versionStatus,
        lifecycleStatus: { notIn: [...DEFAULT_HIDDEN_LIFECYCLE_STATUSES] },
        talent: VISIBLE_PARENT_TALENT,
      },
      orderBy: [{ updatedAt: 'asc' }],
      select: {
        id: true,
        talentId: true,
        createdAt: true,
        updatedAt: true,
        rejectionNote: true,
        createdBy: USER_SELECT,
        talent: {
          select: { slug: true, currentPublishedVersion: { select: { name: true } } },
        },
      },
    });
  },

  /**
   * REJECTED audit rows for a set of version ids, newest first — powers the
   * Rejected Items section's "נדחה על ידי" attribution. The version rows
   * themselves carry no rejectedById column; the audit log (projected from
   * ProposalRejected events by auditLogListener) is the source of truth for
   * who rejected and when.
   *
   * KNOWN COVERAGE GAP, deliberate for this sprint: auditLogListener sets
   * targetVersionId from `payload.versionId`, which only talent-details
   * rejections populate — socials/gallery rejection events carry
   * `socialId`/`galleryImageId` in their payload instead, so their audit
   * rows have targetVersionId = null and this lookup can't find them.
   * dashboardService therefore shows attribution for details rejections
   * only, and null for socials/gallery (rendered as "—"). Closing the gap
   * belongs to a listener/payload alignment sprint, not to a JSON-path
   * query here.
   *
   * @param {string[]} versionIds
   * @returns {Promise<Array<{
   *   targetVersionId: string, createdAt: Date,
   *   rejectedBy: { id, displayName, email }|null,
   * }>>}
   */
  async listRejectionAuditsForVersionIds(versionIds) {
    if (!Array.isArray(versionIds) || versionIds.length === 0) return [];
    return prisma.auditLog.findMany({
      where: {
        actionType: ACTION_TYPE.REJECTED,
        targetVersionId: { in: versionIds },
      },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        targetVersionId: true,
        createdAt: true,
        rejectedBy: { select: { id: true, displayName: true, email: true } },
      },
    });
  },
};

export default dashboardRepository;
