/*
 * Mock talent History data — History Tab Foundation sprint.
 *
 * Local, hardcoded stand-in for a future real audit/version-history feed
 * (eventually driven by versionService.listVersionHistory + workflow
 * events). No database, no Prisma, no API route — app/admin/talent/[id]/
 * page.jsx imports straight from this file, the same "presentation layer
 * reads a mock module directly" pattern lib/admin/mock-workflow.js already
 * established for "My Work".
 *
 * Deliberately entity-agnostic in shape (HISTORY_ACTION / ACTION_LABEL /
 * ACTION_TONE + getTalentHistory()) so the same vocabulary and the same
 * <Timeline> component can be reused later for other entities (site
 * content, SEO, homepage) once a real history feed exists — only the data
 * source changes, not the rendering.
 *
 * HISTORY_ACTION values are plain readable strings chosen to map 1:1 onto
 * future real workflow/version events:
 *   draft_saved      -> a DRAFT version was created/updated
 *   submitted        -> a version was sent for approval (PROPOSED)
 *   changes_requested -> a version was rejected with notes (REJECTED)
 *   approved         -> a version was approved (APPROVED)
 *   published        -> a version went live (PUBLISHED)
 */

import { he } from './i18n/he';

export const HISTORY_ACTION = {
  DRAFT_SAVED: 'draft_saved',
  SUBMITTED: 'submitted',
  CHANGES_REQUESTED: 'changes_requested',
  APPROVED: 'approved',
  PUBLISHED: 'published',
};

export const ACTION_LABEL = {
  [HISTORY_ACTION.DRAFT_SAVED]: he.history.actionLabel.draft_saved,
  [HISTORY_ACTION.SUBMITTED]: he.history.actionLabel.submitted,
  [HISTORY_ACTION.CHANGES_REQUESTED]: he.history.actionLabel.changes_requested,
  [HISTORY_ACTION.APPROVED]: he.history.actionLabel.approved,
  [HISTORY_ACTION.PUBLISHED]: he.history.actionLabel.published,
};

// Maps each action onto an existing StatusBadge tone (components/admin/
// StatusBadge.jsx) — purely presentational, mirrors lib/admin/mock-workflow.js's
// STATUS_TONE so the same five-color vocabulary reads consistently across
// "My Work" and a talent's History tab.
export const ACTION_TONE = {
  [HISTORY_ACTION.DRAFT_SAVED]: 'neutral',
  [HISTORY_ACTION.SUBMITTED]: 'warning',
  [HISTORY_ACTION.CHANGES_REQUESTED]: 'danger',
  [HISTORY_ACTION.APPROVED]: 'info',
  [HISTORY_ACTION.PUBLISHED]: 'success',
};

// Generic mock timeline, newest first — same list reused for every talent
// this sprint (no per-talent variation modeled yet, same simplification
// MOCK_WORKFLOW_ITEMS makes for "My Work"). Swapping this for a real
// per-talent query later only means changing getTalentHistory's body.
const MOCK_HISTORY_EVENTS = [
  {
    id: 'hist-1',
    action: HISTORY_ACTION.PUBLISHED,
    date: '2026-06-24T10:15:00',
    user: 'נועה לוי',
    summary: 'עודכנו פרטי פרופיל',
  },
  {
    id: 'hist-2',
    action: HISTORY_ACTION.APPROVED,
    date: '2026-06-24T09:50:00',
    user: 'בר אורן',
    summary: 'אושרו השינויים לפרסום',
  },
  {
    id: 'hist-3',
    action: HISTORY_ACTION.SUBMITTED,
    date: '2026-06-23T17:30:00',
    user: 'נועה לוי',
    summary: 'נוספו תמונות לגלריה',
  },
  {
    id: 'hist-4',
    action: HISTORY_ACTION.CHANGES_REQUESTED,
    date: '2026-06-21T13:05:00',
    user: 'בר אורן',
    summary: 'התבקש תיקון בתיאור הביוגרפיה',
  },
  {
    id: 'hist-5',
    action: HISTORY_ACTION.DRAFT_SAVED,
    date: '2026-06-20T11:40:00',
    user: 'איתי בן־דוד',
    summary: 'עודכנו קישורי רשתות',
  },
  {
    id: 'hist-6',
    action: HISTORY_ACTION.DRAFT_SAVED,
    date: '2026-06-18T16:00:00',
    user: 'איתי בן־דוד',
    summary: 'עודכן SEO',
  },
];

/**
 * Returns the mock history timeline for a talent, newest first. Takes a
 * `talentSlug` for a future-real-data-source signature even though this
 * sprint's mock list doesn't vary by talent — keeps the call site
 * (app/admin/talent/[id]/page.jsx) stable once a real per-talent query
 * replaces this function's body.
 */
export function getTalentHistory(talentSlug) {
  return MOCK_HISTORY_EVENTS;
}

export default MOCK_HISTORY_EVENTS;
