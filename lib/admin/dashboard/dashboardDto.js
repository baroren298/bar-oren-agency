/*
 * Owner Dashboard DTO — Owner Dashboard Sprint 1 (OWNER_DASHBOARD_UX_SPEC.md).
 *
 * The single structured object the dashboard page receives from
 * dashboardService.getOwnerDashboard(). The page renders this and nothing
 * else — it never reaches into repositories or engine services (spec §0:
 * "the dashboard is where decisions begin, not where work happens";
 * architecturally: page → service → repository only).
 *
 * All timestamps are ISO-8601 strings, not Date objects, so the DTO is
 * JSON-serializable as-is (safe to pass across the server/client component
 * boundary, cache, or return from a route handler later without a mapping
 * step).
 *
 * Recent Activity is deliberately absent — out of scope for Sprint 1 per
 * the sprint brief. When it lands it becomes a fifth top-level key here,
 * not a change to the existing four.
 */

/**
 * What kind of work a queue item is about. Mirrors the three versioned
 * clusters that flow through the approval workflow today. Values are
 * dashboard-internal (not a Prisma enum) — the Hebrew labels live in
 * lib/admin/i18n/he.js (he.dashboard.owner.workTypes), keyed by these.
 */
export const DASHBOARD_WORK_TYPE = Object.freeze({
  DETAILS: 'DETAILS', // TalentVersion — פרטי מיוצג
  SOCIALS: 'SOCIALS', // TalentSocial — רשתות חברתיות
  GALLERY: 'GALLERY', // TalentGalleryImage — גלריה
});

/**
 * @typedef {object} DashboardActor
 * @property {string} id
 * @property {string|null} displayName - null for accounts predating the field
 * @property {string} email - fallback display identity when displayName is null
 */

/**
 * @typedef {object} PendingApprovalItem
 * @property {string} key - stable React key, unique across the section
 * @property {string} workType - DASHBOARD_WORK_TYPE value
 * @property {string} talentId
 * @property {string|null} talentName
 * @property {number} itemCount - rows folded into this item (1 for DETAILS;
 *   ≥1 for SOCIALS/GALLERY, which group per talent)
 * @property {DashboardActor|null} submittedBy
 * @property {string} submittedAt - ISO string; earliest submission in the
 *   group ("how long has this been waiting")
 * @property {string} href - deep link to where the decision happens
 */

/**
 * @typedef {object} RejectedItem
 * @property {string} key
 * @property {string} workType
 * @property {string} talentId
 * @property {string|null} talentName
 * @property {number} itemCount
 * @property {DashboardActor|null} rejectedBy - null when the audit trail
 *   can't attribute it (socials/gallery — see dashboardRepository's
 *   listRejectionAuditsForVersionIds coverage note)
 * @property {string} rejectedAt - ISO string
 * @property {string} href
 */

/**
 * @typedef {object} EmployeeDraftGroup
 * @property {string} key
 * @property {DashboardActor} employee
 * @property {number} draftCount
 * @property {string} lastUpdatedAt - ISO string
 */

/**
 * @typedef {object} OwnerDashboardDto
 * @property {string} generatedAt - ISO string
 * @property {{ displayName: string|null, pendingApprovalsCount: number }} greeting
 *   pendingApprovalsCount is the X in "יש כרגע X פריטים שממתינים לאישורך" —
 *   Pending Approvals ONLY, never a blend of sections (spec §3)
 * @property {{ totalCount: number, items: PendingApprovalItem[] }} pendingApprovals - items ≤ 5
 * @property {{ totalCount: number, items: RejectedItem[] }} rejectedItems - items ≤ 5
 * @property {{ totalCount: number, groups: EmployeeDraftGroup[] }} employeeDrafts - groups ≤ 5
 */

/** Spec §1: each queue section shows at most five entries; totals carry the rest. */
export const DASHBOARD_MAX_SECTION_ITEMS = 5;

/**
 * Assemble a normalized OwnerDashboardDto. Pure shaping only (defaults +
 * the ≤5 cap) — all querying/grouping decisions happen in dashboardService
 * before this is called. Exists as its own function so the DTO contract is
 * asserted in exactly one place and trivially unit-testable.
 *
 * @param {object} parts
 * @param {{ displayName: string|null }} parts.viewer
 * @param {PendingApprovalItem[]} parts.pendingApprovals - full, pre-sorted list
 * @param {RejectedItem[]} parts.rejectedItems - full, pre-sorted list
 * @param {EmployeeDraftGroup[]} parts.employeeDraftGroups - full, pre-sorted list
 * @param {Date} [parts.now] - injectable clock for tests
 * @returns {OwnerDashboardDto}
 */
export function buildOwnerDashboardDto({
  viewer = { displayName: null },
  pendingApprovals = [],
  rejectedItems = [],
  employeeDraftGroups = [],
  now = new Date(),
} = {}) {
  return {
    generatedAt: now.toISOString(),
    greeting: {
      displayName: viewer?.displayName ?? null,
      pendingApprovalsCount: pendingApprovals.length,
    },
    pendingApprovals: {
      totalCount: pendingApprovals.length,
      items: pendingApprovals.slice(0, DASHBOARD_MAX_SECTION_ITEMS),
    },
    rejectedItems: {
      totalCount: rejectedItems.length,
      items: rejectedItems.slice(0, DASHBOARD_MAX_SECTION_ITEMS),
    },
    employeeDrafts: {
      totalCount: employeeDraftGroups.length,
      groups: employeeDraftGroups.slice(0, DASHBOARD_MAX_SECTION_ITEMS),
    },
  };
}
