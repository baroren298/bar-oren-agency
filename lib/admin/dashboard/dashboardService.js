/*
 * DashboardService — Owner Dashboard Sprint 1 (OWNER_DASHBOARD_UX_SPEC.md).
 *
 * The single aggregation point behind /admin's Owner Dashboard. The page
 * calls exactly one method — getOwnerDashboard() — and receives one
 * OwnerDashboardDto (lib/admin/dashboard/dashboardDto.js). The page never
 * queries repositories directly; this service never renders anything.
 *
 * Owner-only, enforced here as defense in depth (same pattern as
 * userService/approvalService): the page redirects non-Owners before
 * calling, but this service refuses a non-OWNER actor regardless, with the
 * same 403-shaped error the rest of the engine throws.
 *
 * Decisions that live HERE (and deliberately not in dashboardRepository,
 * per Section 13.15's decision-free repository rule):
 *
 *  - What "pending approval" means: PROPOSED TalentVersion rows, plus
 *    PROPOSED TalentSocial/TalentGalleryImage rows.
 *  - Grouping: socials/gallery proposals are per-row in the database but
 *    are reviewed per talent (GalleryOwnerReview / SocialLinksOwnerReview
 *    both operate on a talent's whole proposed set), so the dashboard
 *    folds them into ONE queue item per (talent, work type) — the Owner
 *    sees "גלריה של קים · 4 פריטים", not four rows for four images.
 *  - Ordering: Pending Approvals and Rejected Items are oldest first (spec
 *    §3 — the item waiting longest is the biggest risk); Employee Drafts
 *    groups are most-recently-updated first (what a supervisor scans for).
 *  - "Employee" means creator whose role is EMPLOYEE. The Owner's own
 *    drafts are the Owner's business, not supervision — excluded (spec §6
 *    item 6: the Owner Dashboard never treats the Owner as an employee).
 *  - The greeting count is pendingApprovals.totalCount ONLY (spec §3).
 *
 * Deep links: every queue item's href points at the talent workspace
 * (/admin/talent/[id]) — the screen where reviewing/approving actually
 * happens today. The workspace's tabs are client-side state without
 * query-string routing (TalentWorkspaceTabs.jsx is deliberately dumb), so
 * work-type-specific tab deep links are not possible yet; when tab routing
 * lands, only buildHref() below changes.
 */

import { dashboardRepository } from '../repository/dashboardRepository';
import { userRepository } from '../repository/userRepository';
import { ROLE, VERSION_STATUS } from '../constants/enums';
import { DASHBOARD_WORK_TYPE, buildOwnerDashboardDto } from './dashboardDto';

/** Same 403 shape as approvalService/userService — routes map it to HTTP directly. */
function assertActorIsOwner(actorRole, action) {
  if (actorRole !== ROLE.OWNER) {
    const err = new Error(
      `[${action}] actorRole "${actorRole}" is not permitted — the Owner Dashboard is Owner-only.`
    );
    err.statusCode = 403;
    err.code = 'FORBIDDEN_ROLE';
    throw err;
  }
}

/** Deep link for a queue item — see header note on why it's tab-less for now. */
function buildHref(talentId) {
  return `/admin/talent/${talentId}`;
}

/** Normalize a repository user row into the DTO's DashboardActor (or null). */
function toActor(user) {
  if (!user) return null;
  return { id: user.id, displayName: user.displayName ?? null, email: user.email };
}

/** A social/gallery row's "when" — updatedAt when present (submission/rejection bump it), else createdAt. */
function rowTimestamp(row) {
  return row.updatedAt ?? row.createdAt;
}

/**
 * Fold per-row socials/gallery proposals into one queue item per talent
 * (see header). submittedAt is the EARLIEST row timestamp — the moment
 * this talent's change set started waiting — so queue ordering reflects
 * true waiting time. submittedBy is the most recent row's creator (the
 * person who completed the submission).
 *
 * @param {Array} rows - dashboardRepository social/gallery rows
 * @param {string} workType - DASHBOARD_WORK_TYPE value
 * @returns {Array} ungrouped-shape items (see dashboardDto typedefs)
 */
function groupRowsByTalent(rows, workType) {
  const byTalent = new Map();
  for (const row of rows) {
    if (!byTalent.has(row.talentId)) byTalent.set(row.talentId, []);
    byTalent.get(row.talentId).push(row);
  }

  return [...byTalent.entries()].map(([talentId, group]) => {
    const sorted = [...group].sort((a, b) => rowTimestamp(a) - rowTimestamp(b));
    const earliest = sorted[0];
    const latest = sorted[sorted.length - 1];
    return {
      key: `${workType}:${talentId}`,
      workType,
      talentId,
      talentName: earliest.talent?.currentPublishedVersion?.name ?? earliest.talent?.slug ?? null,
      itemCount: group.length,
      submittedBy: toActor(latest.createdBy),
      submittedAt: rowTimestamp(earliest).toISOString(),
      href: buildHref(talentId),
    };
  });
}

/** One queue item per PROPOSED/REJECTED/DRAFT TalentVersion row (details are already per-talent). */
function toDetailsItem(version) {
  return {
    key: `${DASHBOARD_WORK_TYPE.DETAILS}:${version.id}`,
    workType: DASHBOARD_WORK_TYPE.DETAILS,
    talentId: version.talentId,
    talentName: version.name ?? null,
    itemCount: 1,
    submittedBy: toActor(version.createdBy),
    submittedAt: version.createdAt.toISOString(),
    href: buildHref(version.talentId),
  };
}

export const dashboardService = {
  /**
   * Aggregate everything the Owner Dashboard renders into one DTO.
   *
   * @param {object} params
   * @param {string} params.actorId - session user id (used for the greeting's displayName)
   * @param {string} params.actorRole - must be ROLE.OWNER (403 otherwise)
   * @returns {Promise<import('./dashboardDto').OwnerDashboardDto>}
   */
  async getOwnerDashboard({ actorId, actorRole } = {}) {
    assertActorIsOwner(actorRole, 'dashboardService.getOwnerDashboard');
    if (!actorId) {
      throw new Error('[dashboardService.getOwnerDashboard] actorId is required.');
    }

    const [
      viewer,
      proposedVersions,
      proposedSocials,
      proposedGallery,
      rejectedVersions,
      rejectedSocials,
      rejectedGallery,
      draftVersions,
      draftSocials,
      draftGallery,
    ] = await Promise.all([
      userRepository.getSafeById(actorId),
      dashboardRepository.listTalentVersionsByStatus(VERSION_STATUS.PROPOSED),
      dashboardRepository.listTalentSocialsByVersionStatus(VERSION_STATUS.PROPOSED),
      dashboardRepository.listTalentGalleryImagesByVersionStatus(VERSION_STATUS.PROPOSED),
      dashboardRepository.listTalentVersionsByStatus(VERSION_STATUS.REJECTED),
      dashboardRepository.listTalentSocialsByVersionStatus(VERSION_STATUS.REJECTED),
      dashboardRepository.listTalentGalleryImagesByVersionStatus(VERSION_STATUS.REJECTED),
      dashboardRepository.listTalentVersionsByStatus(VERSION_STATUS.DRAFT),
      dashboardRepository.listTalentSocialsByVersionStatus(VERSION_STATUS.DRAFT),
      dashboardRepository.listTalentGalleryImagesByVersionStatus(VERSION_STATUS.DRAFT),
    ]);

    // ── Pending Approvals (spec §1: the dominant section) ────────────────
    const pendingApprovals = [
      ...proposedVersions.map(toDetailsItem),
      ...groupRowsByTalent(proposedSocials, DASHBOARD_WORK_TYPE.SOCIALS),
      ...groupRowsByTalent(proposedGallery, DASHBOARD_WORK_TYPE.GALLERY),
    ].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)); // oldest first (spec §3)

    // ── Rejected Items ("הוחזרו לתיקון") ─────────────────────────────────
    // Attribution comes from the audit log; only details rejections carry
    // targetVersionId today (see dashboardRepository's coverage note), so
    // socials/gallery items get rejectedBy: null, rendered as "—".
    const rejectionAudits = await dashboardRepository.listRejectionAuditsForVersionIds(
      rejectedVersions.map((v) => v.id)
    );
    const latestAuditByVersionId = new Map();
    for (const audit of rejectionAudits) {
      // Repository returns newest-first; keep only the latest per version.
      if (!latestAuditByVersionId.has(audit.targetVersionId)) {
        latestAuditByVersionId.set(audit.targetVersionId, audit);
      }
    }

    const rejectedItems = [
      ...rejectedVersions.map((version) => {
        const audit = latestAuditByVersionId.get(version.id) ?? null;
        const base = toDetailsItem(version);
        return {
          key: base.key,
          workType: base.workType,
          talentId: base.talentId,
          talentName: base.talentName,
          itemCount: 1,
          rejectedBy: audit ? toActor(audit.rejectedBy) : null,
          rejectedAt: (audit?.createdAt ?? version.createdAt).toISOString(),
          href: base.href,
        };
      }),
      ...[...groupRowsByTalent(rejectedSocials, DASHBOARD_WORK_TYPE.SOCIALS),
          ...groupRowsByTalent(rejectedGallery, DASHBOARD_WORK_TYPE.GALLERY)].map((item) => ({
        key: item.key,
        workType: item.workType,
        talentId: item.talentId,
        talentName: item.talentName,
        itemCount: item.itemCount,
        rejectedBy: null, // audit gap for socials/gallery — see repository note
        rejectedAt: item.submittedAt, // latest lifecycle touch = the rejection bump
        href: item.href,
      })),
    ].sort((a, b) => a.rejectedAt.localeCompare(b.rejectedAt)); // oldest first (spec §3)

    // ── Employee Drafts (grouped by employee, spec §1/§3) ────────────────
    const draftRows = [
      ...draftVersions.map((v) => ({ createdBy: v.createdBy, at: v.createdAt })),
      ...draftSocials.map((r) => ({ createdBy: r.createdBy, at: rowTimestamp(r) })),
      ...draftGallery.map((r) => ({ createdBy: r.createdBy, at: rowTimestamp(r) })),
    ].filter((row) => row.createdBy?.role === ROLE.EMPLOYEE);

    const byEmployee = new Map();
    for (const row of draftRows) {
      const existing = byEmployee.get(row.createdBy.id);
      if (!existing) {
        byEmployee.set(row.createdBy.id, {
          key: `drafts:${row.createdBy.id}`,
          employee: toActor(row.createdBy),
          draftCount: 1,
          lastUpdatedAt: row.at,
        });
      } else {
        existing.draftCount += 1;
        if (row.at > existing.lastUpdatedAt) existing.lastUpdatedAt = row.at;
      }
    }
    const employeeDraftGroups = [...byEmployee.values()]
      .map((group) => ({ ...group, lastUpdatedAt: group.lastUpdatedAt.toISOString() }))
      .sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt)); // most recent first (spec §3)

    return buildOwnerDashboardDto({
      viewer: { displayName: viewer?.displayName ?? null },
      pendingApprovals,
      rejectedItems,
      employeeDraftGroups,
    });
  },
};

export default dashboardService;
