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

import { VERSION_STATUS, TALENT_VISIBILITY, LIFECYCLE_STATUS } from './constants/enums';
import { WORKFLOW_STATUS, STATUS_LABEL, STATUS_TONE } from './mock-workflow';
import { SOCIAL_PLATFORMS } from './social-platforms';
import { normalizeHandleDisplay } from './social-handle';
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
  // Website CMS Focus Cleanup — the Campaigns tab (Sprint 8A prototype) was
  // removed here: Campaigns is a My Agency business module, not Website CMS
  // content. Its prototype code and the he.talent.sections.campaigns label
  // are intentionally left in place; only this section entry (and its
  // wiring in app/admin/talent/[id]/page.jsx) were removed.
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
 * Talent Visibility sprint (Issue 2 fix): a handle is now run through the
 * same `normalizeHandleDisplay` SocialLinkRow.jsx's Socials tab already used
 * (now shared via lib/admin/social-handle.js) before display, so a stored
 * value with one or more leading "@" (e.g. "@@kimchourilov") always renders
 * with exactly one — matching what the Socials tab already showed for the
 * same account. The *which row is "the" preview* decision (talentRepository.
 * listTalents's mainSocial pick) is unaffected; this only formats the text
 * of whichever row it was given. `url`/the platform label fallback (used
 * only when there's no handle at all) are left as-is — they aren't handles,
 * so normalizing a leading "@" off them isn't applicable.
 *
 * @param {{ platform: string, label: string, handle: string|null, url: string|null }|null} socialPreview
 */
export function deriveListSocialPreview(socialPreview) {
  if (!socialPreview) return null;

  const platformEntry = SOCIAL_PLATFORMS.find(
    (entry) => entry.key === socialPreview.platform?.toLowerCase()
  );

  const text = socialPreview.handle
    ? normalizeHandleDisplay(socialPreview.handle)
    : socialPreview.url || platformEntry?.label || socialPreview.platform;

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
 * Talent Visibility sprint (admin UI) — "Hidden" means a talent that exists
 * in the system but has been intentionally hidden from the public website by
 * an Owner, independent of whether it has ever been published. That is a
 * genuinely different axis than "published vs. draft" (see
 * `isListTalentDraft` above) and a different axis again from
 * LIFECYCLE_STATUS (entity-level soft delete) — see
 * lib/admin/constants/enums.js's TALENT_VISIBILITY header comment.
 *
 * Phase 1 of this feature added the real schema field
 * (TalentVersion.visibility) and wired it through
 * talentRepository.listTalents() as `talent.visibility` (`'VISIBLE'` |
 * `'HIDDEN'` | `null` for a talent with no version row at all yet). This
 * helper now reads that real field instead of the previous always-false
 * placeholder — the "מוסתרים" pill (and this list's own muted "מוסתר" row
 * badge) reflect actual data as of this sprint.
 */
export function isListTalentHidden(talent) {
  return talent?.visibility === TALENT_VISIBILITY.HIDDEN;
}

/**
 * Talent Archive & Restore feature — entity-level lifecycle status, a
 * different axis again from both `isListTalentDraft` (content workflow)
 * and `isListTalentHidden` (public-website visibility). Reads the real
 * `talent.status` column talentRepository.listTalents already returns
 * (unlike visibility, no phased rollout needed — the column has existed
 * since the schema's foundation, just never set to anything but ACTIVE
 * until this feature).
 */
export function isListTalentArchived(talent) {
  return talent?.status === LIFECYCLE_STATUS.ARCHIVED;
}

/**
 * Admin Talent List single-badge sprint, widened by the Talent Detail
 * single-badge sprint — the one shared decision for "which single
 * workflow/visibility badge should this talent show", now used by both the
 * list card (TalentQueueRow.jsx, via `selectListBadge`) and the detail page
 * header (app/admin/talent/[id]/page.jsx, via `selectDetailBadge`), instead
 * of each screen rendering its own workflow badge plus a separate "מוסתר"
 * visibility badge side by side.
 *
 * Deliberately takes the already-derived `status` + "is it hidden" boolean
 * rather than a `talent` row, because the list and detail pages compute
 * those two inputs differently (list: `deriveListWorkflowStatus` /
 * `isListTalentHidden`, reading only the published version's visibility;
 * detail: `deriveDetailWorkflowStatus` over the full version history /
 * `deriveCurrentVisibility`, which lets a pending Draft's visibility win
 * over the published one) — neither page's own derivation logic changes,
 * only the final "pick one badge" step is shared, per the product rule
 * "Hidden is the most important thing to know about an otherwise-published
 * talent, so it replaces (not joins) the Published badge":
 *
 *   - not yet published (draft / waiting for approval / changes requested):
 *     show that workflow status, unchanged.
 *   - published + hidden: show the "מוסתר" badge (talentVisibilityTone),
 *     exactly the same label/tone the old secondary badge used.
 *   - published + visible: show "פורסם".
 *
 * @param {string} status - a WORKFLOW_STATUS value
 * @param {boolean} isHidden
 * @returns {{ label: string, tone: string }}
 */
function selectStatusBadge(status, isHidden) {
  if (status !== WORKFLOW_STATUS.PUBLISHED) {
    return { label: workflowStatusLabel(status), tone: workflowStatusTone(status) };
  }

  if (isHidden) {
    return {
      label: he.talent.list.hiddenBadge,
      tone: talentVisibilityTone(TALENT_VISIBILITY.HIDDEN),
    };
  }

  return { label: workflowStatusLabel(status), tone: workflowStatusTone(status) };
}

/**
 * List-card single badge (TalentQueueRow.jsx) — see `selectStatusBadge`
 * above for the shared decision. Unchanged from the Admin Talent List
 * single-badge sprint other than delegating to that shared helper.
 *
 * @param {object} talent
 * @returns {{ label: string, tone: string }}
 */
export function selectListBadge(talent) {
  // Talent Archive & Restore feature — same "one badge, strongest state
  // wins" precedence the detail page's headerBadge now follows: archived
  // is a stronger, entity-level state than any content workflow/visibility
  // status, so it replaces (not joins) whatever selectStatusBadge would
  // otherwise show.
  if (isListTalentArchived(talent)) {
    return { label: he.talent.list.archivedBadge, tone: 'neutral' };
  }
  return selectStatusBadge(deriveListWorkflowStatus(talent), isListTalentHidden(talent));
}

/**
 * Detail-header single badge (app/admin/talent/[id]/page.jsx) — Talent
 * Detail single-badge sprint. Replaces that page's previous two header
 * chips (workflow status + visibility) with the one `selectStatusBadge`
 * decision above, fed by the exact same `status`/`currentVisibility` values
 * the page already computes (`deriveDetailWorkflowStatus`,
 * `deriveCurrentVisibility`) — no change to either of those derivations,
 * and no effect on the Details tab's Current/Proposed visibility comparison
 * row (ComparisonView renders that independently from its own `value`/
 * `draftValue` props, never from this helper).
 *
 * @param {string} status - deriveDetailWorkflowStatus(versions)
 * @param {string} visibility - deriveCurrentVisibility(publishedVersion, pendingVersion)
 * @returns {{ label: string, tone: string }}
 */
export function selectDetailBadge(status, visibility) {
  return selectStatusBadge(status, visibility === TALENT_VISIBILITY.HIDDEN);
}

/**
 * Talent Visibility sprint (admin UI) — the single source of truth for
 * "what is this talent's current public-visibility state, for display
 * purposes" on the detail page header chip and the Hide/Restore action
 * button. Deliberately prioritizes a pending DRAFT/PROPOSED version's own
 * `visibility` over the Published version's: once a pending version exists,
 * it is the forward-looking truth (the same "Current Published vs Proposed"
 * principle every other field on this page already follows — see
 * DRAFT_PUBLISH_UX_SPEC.md), and it lets the Hide/Restore button toggle the
 * Owner/Employee's own not-yet-published change back and forth rather than
 * only ever reflecting what's live right now. Falls back to the Published
 * version's visibility, then to VISIBLE as the schema default, so a brand
 * new talent with neither a pending nor a published version still renders a
 * sensible default rather than `undefined`.
 *
 * @param {object|null} publishedVersion
 * @param {object|null} pendingVersion
 * @returns {'VISIBLE'|'HIDDEN'}
 */
export function deriveCurrentVisibility(publishedVersion, pendingVersion) {
  if (pendingVersion?.visibility) return pendingVersion.visibility;
  if (publishedVersion?.visibility) return publishedVersion.visibility;
  return TALENT_VISIBILITY.VISIBLE;
}

/** Visibility label, ready to hand to <StatusBadge label=... />. */
export function talentVisibilityLabel(visibility) {
  return visibility === TALENT_VISIBILITY.HIDDEN ? he.talent.fields.visibilityHidden : he.talent.fields.visibilityVisible;
}

/** Visibility tone, ready to hand to <StatusBadge tone=... />. */
export function talentVisibilityTone(visibility) {
  return visibility === TALENT_VISIBILITY.HIDDEN ? 'warning' : 'neutral';
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
    // Talent Visibility sprint (admin UI) — seed a brand-new Draft with the
    // current Published version's visibility, not the schema default
    // (VISIBLE). Without this, "Start Editing" on an already-Hidden talent
    // would silently propose making it Visible again the moment any
    // unrelated field (e.g. bio) was saved — visibility must carry forward
    // untouched, exactly like every other field this function already
    // copies, unless the new Hide/Restore action explicitly changes it.
    visibility: version.visibility,
    // Podcast prefill bugfix — seed a brand-new Draft with the current
    // Published version's podcast fields too. Without these, "Start
    // Editing" created a Draft whose podcast columns were null, so the
    // Podcast tab's edit form rendered empty (buildPodcastGroups reads
    // draftValue off the pending version) and publishing that Draft would
    // silently wipe the live podcast data — exactly the "full snapshot,
    // not just the Details fields" hazard this function's own header
    // comment warns about. podcastImageAssetId is carried forward as well
    // (and, since the Podcast Image Upload sprint, is also editable via
    // updateTalentVersionFields' WRITABLE_COLUMNS): it must survive the
    // Draft -> Publish flip or the published podcast image would be lost.
    podcastTitle: version.podcastTitle,
    podcastDescriptionHe: version.podcastDescriptionHe,
    podcastDescriptionEn: version.podcastDescriptionEn,
    podcastVideoEmbedUrl: version.podcastVideoEmbedUrl,
    podcastImageAssetId: version.podcastImageAssetId,
    // Talent SEO + Slug Management sprint — carry the versioned slug + SEO
    // block forward into a new Draft, same "full snapshot, not just the
    // Details fields" hazard the podcast comment above describes: without
    // these, publishing a Draft started after this sprint would wipe the
    // live SEO values and slug proposal. `slug` may be null on a published
    // version that predates the migration — the "Start Editing" route
    // (app/api/admin/talent/[id]/proposals/route.js) backfills it from the
    // parent Talent.slug so the Slug editor always has a real baseline.
    slug: version.slug,
    seoTitle: version.seoTitle,
    seoDescription: version.seoDescription,
    seoCanonicalUrl: version.seoCanonicalUrl,
    seoOgTitle: version.seoOgTitle,
    seoOgDescription: version.seoOgDescription,
    seoOgImageUrl: version.seoOgImageUrl,
    seoNoindex: version.seoNoindex ?? false,
  };
}

/**
 * Post-Publish Edit Mode Cleanup fix — true when `pendingVersion` (a DRAFT
 * TalentVersion) has never actually been edited: every field
 * extractTalentVersionFields extracts from it is identical to the same
 * field on `publishedVersion`. This is exactly the shape of a Draft that
 * "Start Editing" just created and nothing has touched since (that route
 * seeds a brand-new Draft as a verbatim clone of Published — see
 * extractTalentVersionFields's header comment) — as opposed to a Draft that
 * genuinely carries unpublished changes, which this must never mistake for
 * "empty."
 *
 * Why this matters: Gallery/Socials Publish Now can succeed without ever
 * touching TalentVersion at all (they're independent per-row lists, not
 * versioned together with Details/Podcast/SEO). If the page's global edit
 * session was opened via "Start Editing" but the user only ever worked in
 * Gallery/Socials, that auto-created Draft is left behind — real, pending,
 * and stuck showing the whole workspace as "still editing" — even though
 * nothing the user actually did remains unpublished. This check is what
 * lets a caller (the Gallery/Socials publish routes) tell that specific
 * "nothing to lose" case apart from a real one, so it can safely clean up
 * the empty Draft and only that case.
 *
 * Reuses extractTalentVersionFields's own field set (via Object.keys) so
 * this never needs a separately-maintained field list that could drift out
 * of sync with it. Dates are compared by value, not by object identity;
 * arrays (category/tags) are compared by content.
 *
 * Slug backfill false-positive fix — `extractTalentVersionFields`'s own
 * header comment documents that a published version predating the slug
 * column carries `slug: null` ("no slug change"), and the "Start Editing"
 * route (app/api/admin/talent/[id]/proposals/route.js) backfills a
 * brand-new Draft's slug from the parent Talent's live `slug` in that exact
 * case, specifically so the Slug editor always has a real value to show.
 * That backfill is seeding behavior, not a user edit — but a plain
 * field-by-field comparison saw `pending.slug` (the backfilled value) differ
 * from `published.slug` (still null) and wrongly classified an otherwise
 * completely untouched Draft as "changed." `currentParentSlug` (the
 * Talent's live slug at comparison time, i.e. the same value the seeding
 * fallback would use) lets this function recognize exactly that one
 * seeding-only case and treat it as unchanged, without weakening the slug
 * comparison for every other case: a baseline with a non-null slug, or a
 * Draft slug that doesn't match the current Talent slug, is still compared
 * normally and still counts as a real difference.
 *
 * @param {object|null} pendingVersion - a DRAFT TalentVersion row
 * @param {object|null} publishedVersion - the current Published TalentVersion row
 * @param {string|null} [currentParentSlug] - the parent Talent's live slug,
 *   only used to recognize the null-baseline seeding-fallback case above;
 *   omitting it simply disables that one exception (every other field, and
 *   slug itself whenever the baseline isn't null, compares exactly as
 *   before)
 * @returns {boolean} false whenever either version argument is missing —
 *   "unknown" must never be treated as "safe to discard"
 */
export function talentVersionIsUnchangedFromPublished(pendingVersion, publishedVersion, currentParentSlug) {
  if (!pendingVersion || !publishedVersion) return false;

  function normalize(value) {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return JSON.stringify(value);
    return value ?? null;
  }

  const pendingFields = extractTalentVersionFields(pendingVersion);
  const publishedFields = extractTalentVersionFields(publishedVersion);

  return Object.keys(pendingFields).every((key) => {
    if (
      key === 'slug' &&
      publishedFields.slug == null &&
      pendingFields.slug === currentParentSlug
    ) {
      // The one recognized seeding-fallback case — see this function's
      // header comment. Every other slug case (a non-null baseline, or a
      // Draft slug that isn't the current Talent slug) falls through to the
      // normal comparison below, unchanged.
      return true;
    }
    return normalize(pendingFields[key]) === normalize(publishedFields[key]);
  });
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
