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

/** he-IL date formatting, tolerant of null/invalid input (renders "—"). */
export function formatHebrewDate(value) {
  if (!value) return he.talent.meta.noDateYet;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return he.talent.meta.noDateYet;
  return date.toLocaleDateString('he-IL', { year: 'numeric', month: 'short', day: 'numeric' });
}
