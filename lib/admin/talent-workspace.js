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
import { SOCIAL_PLATFORMS } from './social-platforms';
import { he } from './i18n/he';
import { siteConfig } from '@/data/site';

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
  // Podcast tab sprint — dedicated editable tab for the TalentVersion
  // podcast* fields (podcastTitle/podcastDescriptionHe/podcastDescriptionEn/
  // podcastVideoEmbedUrl/podcastImageAsset). Podcast Panel Removal cleanup
  // sprint removed the standalone read-only preview that used to sit above
  // the tabs, so this tab is now the only place these fields are shown.
  // Placed after SEO and before History so History stays the last,
  // audit-style tab.
  { key: 'podcast', label: he.talent.sections.podcast },
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

/**
 * Admin Read Sprint — turns the list query's `socialPreview` shape
 * (`{ platform, label, handle, url }`, from talentRepository.listTalents)
 * into a ready-to-render `{ icon, text }` pair for the list row, or `null`
 * if the talent has no published social account. Pure display mapping:
 * the *which-one-is-the-preview* decision already happened in the
 * repository (Section 13.15 — that's still query-shape work, picking one
 * row); this only formats the one row it was given.
 *
 * `platform` on the DB row is uppercase (Prisma enum, e.g. "INSTAGRAM");
 * SOCIAL_PLATFORMS keys are lowercase — lowercased here to look up the
 * existing registry rather than duplicating its labels/icons.
 *
 * @param {{ platform: string, label: string, handle: string|null, url: string|null }|null} socialPreview
 */
export function deriveListSocialPreview(socialPreview) {
  if (!socialPreview) return null;

  const platformEntry = SOCIAL_PLATFORMS.find(
    (entry) => entry.key === socialPreview.platform?.toLowerCase()
  );

  const text = socialPreview.handle || socialPreview.url || platformEntry?.label || socialPreview.platform;

  return {
    icon: platformEntry?.icon || '🔗',
    text,
  };
}

/**
 * Admin Talent List Polish sprint — translate a stored `category` value
 * (e.g. "content", "influencer") into its Hebrew display label for the
 * admin UI, without changing the stored value itself. Re-uses
 * `siteConfig.categories` (data/site.js) — the exact same key→label map
 * the public site's CategoryFilter/TalentCard already use — rather than
 * inventing a second, parallel translation table that could drift from
 * it. The public website is untouched: this only changes what the admin
 * *displays*, never what's read from or written to the database.
 *
 * `tags` (freeform Hebrew strings already, per data/talent/index.js — e.g.
 * "לייף סטייל", "אופנה") deliberately aren't run through this: they have
 * no English/Hebrew pair to look up, only `category` does.
 *
 * Falls back to the raw stored value if it isn't one of the known
 * category keys, so an unexpected/legacy value still renders something
 * instead of disappearing.
 *
 * @param {string} categoryKey - e.g. "content", "influencer", "model", "actor"
 * @returns {string} Hebrew label, or the original key if unrecognized
 */
export function localizeCategoryLabel(categoryKey) {
  if (!categoryKey) return categoryKey;
  const entry = siteConfig.categories.find((c) => c.key === categoryKey);
  return entry?.label || categoryKey;
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
 * Talent List Filters sprint — read-only client-side filter helper.
 *
 * IMPORTANT scope note: this is *not* the future "public visibility" field
 * (a deliberately separate, not-yet-built axis — see the dedicated
 * `isPubliclyVisible`/`publicVisibility` recommendation from the prior
 * sprint). There is no such field on Talent yet. This helper only reuses
 * the workflow status this list already derives (`deriveListWorkflowStatus`)
 * to answer a narrower, already-true-today question: "does this talent have
 * a published version, i.e. is it currently live on the public site?"
 */
export function isListTalentPublished(talent) {
  return deriveListWorkflowStatus(talent) === WORKFLOW_STATUS.PUBLISHED;
}

/**
 * Talent List Polish (read-only) sprint — corrects a mislabeling from the
 * prior "Talent List Filters" sprint. A talent with no published version
 * yet (`deriveListWorkflowStatus` -> DRAFT or WAITING_FOR_APPROVAL) is
 * content still being prepared — that's "Draft", not "Hidden". The two
 * concepts are kept deliberately distinct in the UI (see
 * `isListTalentHidden` below), even though today only this one is actually
 * derivable from the data the list query returns.
 */
export function isListTalentDraft(talent) {
  return !isListTalentPublished(talent);
}

/**
 * Talent List Polish (read-only) sprint — "Hidden" means a talent that
 * exists in the system but has been intentionally hidden from the public
 * website by an Owner, independent of whether it has ever been published.
 * That is a genuinely different axis than "published vs. draft", and it
 * needs its own schema field (e.g. `isPubliclyVisible` /
 * `publicVisibility`) plus a DB write to set it — neither exists yet, and
 * adding either is out of scope for this read-only sprint.
 *
 * Always returns false for now, on purpose: there is no real data behind
 * "hidden" yet, so this deliberately never matches any talent rather than
 * guessing/borrowing the draft signal for it (that was the previous
 * sprint's bug — conflating "no published version" with "hidden"). The
 * "מוסתרים" pill stays in the UI, future-ready, showing an honest (0)
 * until the real field and its toggle (on the talent detail page) ship.
 */
export function isListTalentHidden(_talent) {
  return false;
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
 * Talent Detail Header DB read-only mapping sprint — pure derivation, no
 * I/O: today's age in whole years from a TalentVersion.birthDate value, or
 * `null` if there's nothing to compute from (no birthDate yet, or an
 * unparseable value — same tolerance pattern as formatHebrewDate above).
 * Display-only; this is not stored anywhere and nothing here writes to the
 * database.
 *
 * @param {string|Date|null} birthDate
 * @returns {number|null}
 */
export function calculateAge(birthDate) {
  if (!birthDate) return null;
  const date = birthDate instanceof Date ? birthDate : new Date(birthDate);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const hasNotHadBirthdayYetThisYear =
    today.getMonth() < date.getMonth() ||
    (today.getMonth() === date.getMonth() && today.getDate() < date.getDate());
  if (hasNotHadBirthdayYetThisYear) age--;

  return age >= 0 ? age : null;
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

/**
 * Admin Talent Editor UX polish sprint — surfaces the Owner's rejection note
 * directly near the editor (Profile Image / Details area) instead of only
 * inside the History tab's timeline. Deliberately mirrors
 * deriveDetailWorkflowStatus's own "only the newest row decides current
 * state" rule: a rejection note is only worth showing prominently while it
 * describes the *current* situation, i.e. the newest version is still the
 * REJECTED one nobody has started fixing yet. The moment a new DRAFT/
 * PROPOSED/PUBLISHED version exists on top of it, that older rejection note
 * is no longer "what's currently being asked for" — it stays visible in
 * History (buildVersionHistoryTimelineItems already shows it there) but
 * disappears from this prominent banner.
 *
 * Returns `null` whenever there's nothing current to show (no versions,
 * newest isn't REJECTED, or — defensively — a REJECTED row with no note
 * text, which shouldn't happen since approvalService.reject requires one,
 * but this stays tolerant rather than rendering an empty banner).
 *
 * @param {object[]} versions - newest-first, as returned by
 *   versionService.listVersionHistory(talentAdapter, id)
 * @returns {string|null}
 */
export function deriveCurrentRejectionNote(versions) {
  if (!Array.isArray(versions) || versions.length === 0) return null;
  const newest = versions[0];
  if (newest.status !== VERSION_STATUS.REJECTED) return null;
  return newest.rejectionNote || null;
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
