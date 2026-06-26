/*
 * Mock "My Work" workflow data — Phase 2 (Agency Workflow) foundation.
 *
 * Local, hardcoded stand-in for what will eventually be a real query
 * against the Core Content Engine (proposals/versions across Talent, Site
 * Content, SEO, etc. — see lib/admin/README.md). No database, no Prisma,
 * no API route: app/admin/my-work/page.jsx imports straight from this file,
 * the same "Presentation layer can read directly" pattern already used by
 * app/admin/talent/page.jsx for real data.
 *
 * Kept deliberately separate from any page component per this sprint's
 * architecture request, so the mock array itself isn't buried inside JSX,
 * and so swapping this file's exports for a real data-fetch later (e.g.
 * `versionService.listForOwner()`) doesn't touch the page's rendering code
 * at all — the page only ever consumes WORKFLOW_STATUS, STATUS_LABEL,
 * STATUS_TONE, and getWorkflowSections().
 *
 * WORKFLOW_STATUS values are plain readable strings chosen to map 1:1 onto
 * future real DB statuses (e.g. a TalentVersion/Proposal `status` column):
 *   draft               -> DRAFT
 *   waiting_for_approval -> PROPOSED
 *   changes_requested   -> REJECTED (with a rejectionNote)
 *   approved            -> APPROVED (approved, not yet live)
 *   published           -> PUBLISHED
 */

export const WORKFLOW_STATUS = {
  DRAFT: "draft",
  WAITING_FOR_APPROVAL: "waiting_for_approval",
  CHANGES_REQUESTED: "changes_requested",
  APPROVED: "approved",
  PUBLISHED: "published",
};

export const STATUS_LABEL = {
  [WORKFLOW_STATUS.DRAFT]: "Draft",
  [WORKFLOW_STATUS.WAITING_FOR_APPROVAL]: "Waiting for Approval",
  [WORKFLOW_STATUS.CHANGES_REQUESTED]: "Changes Requested",
  [WORKFLOW_STATUS.APPROVED]: "Approved",
  [WORKFLOW_STATUS.PUBLISHED]: "Published",
};

// Maps each status onto an existing StatusBadge tone (components/admin/StatusBadge.jsx).
// Purely presentational — no business meaning beyond "how should this read at a glance".
export const STATUS_TONE = {
  [WORKFLOW_STATUS.DRAFT]: "neutral",
  [WORKFLOW_STATUS.WAITING_FOR_APPROVAL]: "warning",
  [WORKFLOW_STATUS.CHANGES_REQUESTED]: "danger",
  [WORKFLOW_STATUS.APPROVED]: "info",
  [WORKFLOW_STATUS.PUBLISHED]: "success",
};

// Item "type" is a free-text category today (Talent Profile, Gallery Update,
// Site Content, SEO, ...) — not yet tied to lib/admin/constants/enums.js's
// EntityType, since several of these (Gallery Update, SEO) don't have a
// real adapter/entity yet. Revisit once more adapters exist.
const MOCK_WORKFLOW_ITEMS = [
  {
    id: "wf-1",
    title: "Maya Cohen — bio rewrite",
    type: "Talent Profile",
    status: WORKFLOW_STATUS.DRAFT,
    lastUpdated: "2026-06-24",
    owner: "Noa Levi",
    description: "Drafting an updated bio and headshot crop; not yet ready to submit for review.",
  },
  {
    id: "wf-2",
    title: "Summer 2026 gallery refresh",
    type: "Gallery Update",
    status: WORKFLOW_STATUS.DRAFT,
    lastUpdated: "2026-06-22",
    owner: "Itai Ben-David",
    description: "Selecting and ordering new campaign photos before sending for approval.",
  },
  {
    id: "wf-3",
    title: "Daniel Azulay — new talent profile",
    type: "Talent Profile",
    status: WORKFLOW_STATUS.WAITING_FOR_APPROVAL,
    lastUpdated: "2026-06-23",
    owner: "Noa Levi",
    description: "Full profile submitted for owner review — bio, stats, and three new photos.",
  },
  {
    id: "wf-4",
    title: "Homepage hero copy update",
    type: "Site Content",
    status: WORKFLOW_STATUS.WAITING_FOR_APPROVAL,
    lastUpdated: "2026-06-21",
    owner: "Shir Mizrahi",
    description: "Submitted updated hero headline and subtext for the homepage.",
  },
  {
    id: "wf-5",
    title: "Talent listing meta descriptions",
    type: "SEO",
    status: WORKFLOW_STATUS.CHANGES_REQUESTED,
    lastUpdated: "2026-06-20",
    owner: "Shir Mizrahi",
    description: "Owner asked for shorter meta descriptions (under 155 characters) on 4 profiles.",
  },
  {
    id: "wf-6",
    title: "Lior Katz — updated measurements",
    type: "Talent Profile",
    status: WORKFLOW_STATUS.CHANGES_REQUESTED,
    lastUpdated: "2026-06-19",
    owner: "Itai Ben-David",
    description: "Owner flagged a mismatch with the agency's internal sheet — needs a re-check before resubmitting.",
  },
  {
    id: "wf-7",
    title: "Contact page address update",
    type: "Site Content",
    status: WORKFLOW_STATUS.APPROVED,
    lastUpdated: "2026-06-18",
    owner: "Noa Levi",
    description: "Approved by the owner; queued to go live in the next publish pass.",
  },
  {
    id: "wf-8",
    title: "Maya Cohen — profile photo set",
    type: "Talent Profile",
    status: WORKFLOW_STATUS.PUBLISHED,
    lastUpdated: "2026-06-15",
    owner: "Noa Levi",
    description: "Live on the public site since June 15.",
  },
];

// The four "My Work" sections, in display order, with the items already
// filtered+sorted (most recently updated first) for each. Approved and
// Published are intentionally combined into one section per this sprint's
// requirements (section 4: "Approved / Published").
export function getWorkflowSections(items = MOCK_WORKFLOW_ITEMS) {
  const byRecency = (a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated);

  return [
    {
      key: "draft",
      label: "Drafts",
      description: "Work in progress that hasn't been submitted yet.",
      items: items.filter((item) => item.status === WORKFLOW_STATUS.DRAFT).sort(byRecency),
    },
    {
      key: "waiting_for_approval",
      label: "Waiting for Approval",
      description: "Submitted and waiting on an owner review.",
      items: items
        .filter((item) => item.status === WORKFLOW_STATUS.WAITING_FOR_APPROVAL)
        .sort(byRecency),
    },
    {
      key: "changes_requested",
      label: "Changes Requested",
      description: "Sent back with feedback — needs another pass before resubmitting.",
      items: items
        .filter((item) => item.status === WORKFLOW_STATUS.CHANGES_REQUESTED)
        .sort(byRecency),
    },
    {
      key: "approved_published",
      label: "Approved / Published",
      description: "Approved by the owner, including anything already live.",
      items: items
        .filter(
          (item) =>
            item.status === WORKFLOW_STATUS.APPROVED || item.status === WORKFLOW_STATUS.PUBLISHED
        )
        .sort(byRecency),
    },
  ];
}

export default MOCK_WORKFLOW_ITEMS;
