/*
 * Talent Workspace Foundation sprint — presentational-only helpers shared
 * by app/admin/talent/page.jsx (list/work-queue) and
 * app/admin/talent/[id]/page.jsx (workspace detail).
 *
 * Scope guardrail for this sprint: NO Prisma/repository/engine changes.
 * Every function here only *derives a display value* from data the engine
 * already returns via existing, unchanged calls (talentAdapter.listParents,
 * versionService.getCurrentPublished/getCurrentDraftOrProposed/
 * listVersionHistory). Nothing here queries the database directly or adds
 * a new repository/adapter/service method.
 *
 * Reuses WORKFLOW_STATUS / STATUS_LABEL / STATUS_TONE from
 * lib/admin/mock-workflow.js rather than redefining the same four
 * statuses+labels+tones a second time — "My Work" and the Talent workspace
 * are describing the same underlying workflow vocabulary (Section 4 of the
 * sprint brief: draft / waiting for approval / changes requested /
 * published), so they should render identically.
 */

import { VERSION_STATUS } from './constants/enums';
import { WORKFLOW_STATUS, STATUS_LABEL, STATUS_TONE } from './mock-workflow';
import { he } from './i18n/he';

/**
 * The five placeholder sections of a talent's workspace (sprint
 * requirement #2). Deliberately just `{ key, label }` — no route, no
 * content type, no editing capability flag — so this list can't
 * accidentally encode any future Draft/Review/Approval/Publishing
 * decision (sprint requirement #4: "do not hardcode future logic").
 */
export const TALENT_WORKSPACE_SECTIONS = [
  { key: 'details', label: he.talent.sections.details },
  { key: 'gallery', label: he.talent.sections.gallery },
  { key: 'socials', label: he.talent.sections.socials },
  { key: 'seo', label: he.talent.sections.seo },
  { key: 'history', label: he.talent.sections.history },
];

/**
 * List-page status derivation (app/admin/talent/page.jsx).
 *
 * Input is exactly the shape `talentAdapter.listParents()` already returns
 * today: `{ hasPublishedVersion, hasPendingChanges }` booleans — no version
 * `status` string, no timestamp. That's a deliberate lightness tradeoff in
 * the existing list query (one row per talent, no N+1 per-talent version
 * fetch), not an oversight, so this function only derives the three states
 * that boolean pair can actually distinguish:
 *
 *   - published:            has a published version, nothing pending
 *   - waiting_for_approval:  has a published version AND a newer pending one
 *   - draft:                 no published version yet (pending or not)
 *
 * "changes_requested" (a REJECTED version) can't be told apart from "draft"
 * with this data shape, because the list query's pending-version lookup
 * filters to DRAFT/PROPOSED only (see talentRepository.listTalents) and
 * doesn't select a timestamp. Surfacing that on the list view would need a
 * small repository change, which is out of scope for this sprint (no
 * Prisma/DB edits) — flagged as a follow-up instead of guessed at.
 */
export function deriveListWorkflowStatus({ hasPublishedVersion, hasPendingChanges } = {}) {
  if (hasPublishedVersion && hasPendingChanges) return WORKFLOW_STATUS.WAITING_FOR_APPROVAL;
  if (hasPublishedVersion) return WORKFLOW_STATUS.PUBLISHED;
  return WORKFLOW_STATUS.DRAFT;
}

/**
 * A short, honest one-line summary for a list row, built only from the
 * same two booleans `deriveListWorkflowStatus` uses — no invented copy.
 */
export function deriveListSummary({ hasPublishedVersion, hasPendingChanges } = {}) {
  if (hasPublishedVersion && hasPendingChanges) return he.talent.meta.pendingChanges;
  if (hasPublishedVersion) return he.talent.meta.upToDate;
  return he.talent.meta.noPublishedVersion;
}

/**
 * Detail-page status derivation (app/admin/talent/[id]/page.jsx), where the
 * caller has the full version history available (versionService.
 * listVersionHistory — newest first, per its own existing contract), so
 * every real VERSION_STATUS value, including REJECTED, can be told apart
 * for once. This is the one place "changes requested" is actually visible
 * this sprint.
 *
 * @param {object[]} versions - newest-first, as returned by
 *   versionService.listVersionHistory(talentAdapter, id)
 */
export function deriveDetailWorkflowStatus(versions) {
  if (!Array.isArray(versions) || versions.length === 0) {
    return WORKFLOW_STATUS.DRAFT;
  }

  const newest = versions[0];

  switch (newest.status) {
    case VERSION_STATUS.REJECTED:
      return WORKFLOW_STATUS.CHANGES_REQUESTED;
    case VERSION_STATUS.PROPOSED:
      return WORKFLOW_STATUS.WAITING_FOR_APPROVAL;
    case VERSION_STATUS.DRAFT:
      return WORKFLOW_STATUS.DRAFT;
    case VERSION_STATUS.PUBLISHED:
      return WORKFLOW_STATUS.PUBLISHED;
    default: {
      // SUPERSEDED newest is the only remaining case — meaning the newest
      // row by createdAt is a version that has since been replaced. That
      // only happens if a still-pending/rejected version is somehow older
      // than the supersession, which shouldn't occur in practice; fall
      // back to "is there a published version at all" rather than guess.
      const hasPublished = versions.some((v) => v.status === VERSION_STATUS.PUBLISHED);
      return hasPublished ? WORKFLOW_STATUS.PUBLISHED : WORKFLOW_STATUS.DRAFT;
    }
  }
}

/** Status label, ready to hand to <StatusBadge label=... />. */
export function workflowStatusLabel(status) {
  return STATUS_LABEL[status] || status;
}

/** Status tone, ready to hand to <StatusBadge tone=... />. */
export function workflowStatusTone(status) {
  return STATUS_TONE[status] || 'neutral';
}

/**
 * The most recent timestamp worth showing as "last updated" for a talent's
 * workspace header, given its full version history. Falls back to the
 * parent Talent row's own `updatedAt` (already present on the object
 * `talentAdapter.getParent()` returns — Prisma includes every scalar field
 * by default) if there are no versions at all yet.
 */
export function deriveLastUpdated(versions, talent) {
  if (Array.isArray(versions) && versions.length > 0 && versions[0]?.updatedAt) {
    return versions[0].updatedAt;
  }
  return talent?.updatedAt ?? null;
}

/**
 * Draft Editing Foundation sprint — pure field extraction, no I/O, NOT
 * currently called by anything. Originally wired into the talent detail
 * page to auto-seed a new Draft on page load; an architecture review
 * corrected that (opening a talent must be a pure read — see that page's
 * header comment), so this helper is unused for now and reserved for the
 * future, explicit "Start Editing" action (Published -> user clicks "Start
 * Editing" -> create Draft -> edit -> save -> submit). Left in place,
 * documented, rather than deleted, since that action will need exactly
 * this: picking the same business-field set talentRepository.
 * insertTalentVersion writes (lib/admin/repository/talentRepository.js)
 * off an existing TalentVersion row, so a brand-new DRAFT can be seeded as
 * a full snapshot of the published version rather than just the handful of
 * fields the Details tab happens to render. Keeping this a full-row copy
 * (not just name/bio/category/etc.) matters because TalentVersion is one
 * snapshot row shared by every future tab (Gallery/Socials/SEO) — seeding
 * only the Details fields would silently drop the other fields' values the
 * moment that future draft is ever submitted/published.
 *
 * Returns a plain object shaped for adapter.insertProposedVersion's `fields`
 * argument (talentAdapter passes it straight to
 * talentRepository.insertTalentVersion). Returns `{ name: undefined }`-safe
 * output even if `version` is null/undefined, so a caller can pass the
 * result straight to validate() and get a normal validation failure instead
 * of a thrown TypeError.
 *
 * @param {object|null} version - a TalentVersion row (e.g. the current
 *   published version)
 */
export function extractTalentVersionFields(version) {
  if (!version) return {};
  return {
    name: version.name,
    nameEn: version.nameEn,
    category: version.category,
    tags: version.tags,
    featured: version.featured,
    featuredOrder: version.featuredOrder,
    sortOrder: version.sortOrder,
    location: version.location,
    locationEn: version.locationEn,
    birthDate: version.birthDate,
    bioHe: version.bioHe,
    bioEn: version.bioEn,
    profileImageAssetId: version.profileImageAssetId,
    profileImagePosition: version.profileImagePosition,
    profileImageScale: version.profileImageScale,
  };
}

/** he-IL date formatting, tolerant of null/invalid input (renders "—"). */
export function formatHebrewDate(value) {
  if (!value) return he.talent.meta.noDateYet;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return he.talent.meta.noDateYet;
  return date.toLocaleDateString('he-IL', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * History Tab Real Data sprint — maps one real TalentVersion row (as
 * returned by versionService.listVersionHistory(talentAdapter, id), i.e.
 * talentRepository.listTalentVersionsForTalent's shape, now including
 * `createdBy`/`approvedBy` { email } per that method's own sprint) into the
 * `{ id, action, date, user, summary, tone }` shape <Timeline> already
 * expects (components/admin/Timeline.jsx — unchanged by this sprint).
 *
 * Reuses the exact same WORKFLOW_STATUS vocabulary/labels/tones
 * deriveDetailWorkflowStatus/workflowStatusLabel/workflowStatusTone already
 * use above, rather than inventing a parallel "history action" vocabulary —
 * a version's status *is* the event worth showing for that row.
 *
 * Per-row status -> WORKFLOW_STATUS mapping (deliberately separate from
 * deriveDetailWorkflowStatus, which only looks at the newest row to decide
 * the talent's *current* status — this maps every row, individually):
 *   DRAFT      -> draft
 *   PROPOSED   -> waiting_for_approval
 *   REJECTED   -> changes_requested
 *   PUBLISHED  -> published
 *   SUPERSEDED -> published (it *was* a real publish; only superseded later
 *                 by a newer one — there is no separate "superseded" tone/
 *                 label in the shared vocabulary, and inventing one is out
 *                 of scope for this sprint)
 *
 * Timestamp: PUBLISHED/SUPERSEDED rows show `approvedAt` (when the version
 * actually went live) falling back to `createdAt`; every other status shows
 * `createdAt`, since TalentVersion has no separate submittedAt/rejectedAt
 * column today (a schema gap, not something this read-only sprint can add).
 *
 * "User": prefers `approvedBy.email` for PUBLISHED/SUPERSEDED rows (the
 * Owner who approved/published it), otherwise `createdBy.email` (who
 * drafted/submitted/was rejected) — falling back to "—" if, for whatever
 * reason, neither relation resolved.
 *
 * "Summary": a REJECTED row's most meaningful content is its required
 * rejectionNote (Section 4); every other row shows the version's own
 * display name, since there is no free-text change-summary field on
 * TalentVersion to draw from.
 *
 * @param {object[]} versions - newest-first, as returned by
 *   versionService.listVersionHistory(talentAdapter, id)
 * @returns {{ id: string, action: string, date: *, user: string, summary: string, tone: string }[]}
 */
export function buildVersionHistoryTimelineItems(versions) {
  if (!Array.isArray(versions)) return [];

  return versions.map((version) => {
    const status = deriveVersionRowWorkflowStatus(version);
    const isPublishLike =
      version.status === VERSION_STATUS.PUBLISHED || version.status === VERSION_STATUS.SUPERSEDED;

    const date = isPublishLike ? version.approvedAt || version.createdAt : version.createdAt;

    const user = isPublishLike
      ? version.approvedBy?.email || version.createdBy?.email || '—'
      : version.createdBy?.email || version.approvedBy?.email || '—';

    const summary =
      version.status === VERSION_STATUS.REJECTED
        ? version.rejectionNote || version.name || version.nameEn || '—'
        : version.name || version.nameEn || '—';

    return {
      id: version.id,
      action: workflowStatusLabel(status),
      date,
      user,
      summary,
      tone: workflowStatusTone(status),
    };
  });
}

/** Per-row status mapping used only by buildVersionHistoryTimelineItems above. */
function deriveVersionRowWorkflowStatus(version) {
  switch (version?.status) {
    case VERSION_STATUS.REJECTED:
      return WORKFLOW_STATUS.CHANGES_REQUESTED;
    case VERSION_STATUS.PROPOSED:
      return WORKFLOW_STATUS.WAITING_FOR_APPROVAL;
    case VERSION_STATUS.DRAFT:
      return WORKFLOW_STATUS.DRAFT;
    case VERSION_STATUS.PUBLISHED:
    case VERSION_STATUS.SUPERSEDED:
      return WORKFLOW_STATUS.PUBLISHED;
    default:
      return WORKFLOW_STATUS.DRAFT;
  }
}
