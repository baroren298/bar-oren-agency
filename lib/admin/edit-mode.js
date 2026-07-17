/*
 * edit-mode.js — Global Edit Mode UX sprint.
 *
 * The one shared answer to "is this talent page currently in edit mode, and
 * should a tab's editing surface therefore be open?" — extracted as pure
 * functions so the Server Component page, every client editor, and the
 * tests all derive it identically instead of each tab re-implementing (and
 * drifting on) the same boolean logic.
 *
 * Deliberately tiny and UI-only. Nothing here reads or writes the database,
 * creates drafts, or knows anything about Save Draft / Submit / Publish /
 * Approve / Reject / Resume — each module (Details, Gallery, Socials,
 * future SEO persistence, Podcast) keeps its own draft lifecycle exactly as
 * before. These helpers only decide which surface (read-only vs. editable)
 * a tab shows.
 */

import { VERSION_STATUS } from '@/lib/admin/constants/enums';

/*
 * Whether the page-level "Start Editing" flow is active — i.e. a pending
 * TalentVersion (DRAFT or PROPOSED) already exists for this talent. Exactly
 * the same rule DetailsSectionContent/PodcastSectionContent already apply
 * via their local `isEditablePending`, centralized so the Gallery/Socials/
 * SEO tabs can share it.
 *
 * Pure derivation over an already-read status — calling this never triggers
 * a read or write of any kind.
 *
 * @param {string|null|undefined} pendingStatus - pendingVersion?.status
 * @returns {boolean}
 */
export function isGlobalEditingStatus(pendingStatus) {
  return pendingStatus === VERSION_STATUS.DRAFT || pendingStatus === VERSION_STATUS.PROPOSED;
}

/*
 * A tab's effective editable mode. Editable when EITHER:
 *   - the page is globally editing (one activation for the whole page —
 *     the product decision this sprint implements), OR
 *   - the tab's own local activation is on (its module-specific draft
 *     already exists, or the user pressed the tab's local "התחל בעריכה"
 *     while no global draft existed — both unchanged behaviors).
 *
 * `localEditing` stays the single piece of component state; the effective
 * mode is re-derived every render, so there is no duplicated boolean to
 * keep in sync and no effect-based synchronization loop. When
 * `globalEditing` flips back to false (draft published/discarded), the tab
 * simply falls back to its own `localEditing` — a module-specific draft
 * that seeded `localEditing` true keeps its editing session, and a tab with
 * nothing of its own returns to the read-only view.
 *
 * @param {{ globalEditing?: boolean, localEditing?: boolean }} flags
 * @returns {boolean}
 */
export function deriveEffectiveEditing({ globalEditing = false, localEditing = false } = {}) {
  return Boolean(globalEditing) || Boolean(localEditing);
}

/*
 * The initial value for a tab's `localEditing` state: true when the module
 * already has its own saved DRAFT/PROPOSED rows (resuming a session in
 * progress reads as "still editing" — the exact seed Gallery/Socials used
 * before this sprint), false otherwise. Centralized only so the editors and
 * the tests agree on it.
 *
 * @param {Array|null|undefined} moduleDraftRows - e.g. draftImages/draftSocials
 * @returns {boolean}
 */
export function deriveInitialLocalEditing(moduleDraftRows) {
  return Array.isArray(moduleDraftRows) && moduleDraftRows.length > 0;
}
