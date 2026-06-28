/*
 * Social Links Owner Review sprint.
 *
 * Pure, presentation-layer diff logic for comparing a talent's Current
 * Published TalentSocial rows against its PROPOSED rows — the data behind
 * the new read-only Owner Review panel on the Socials tab
 * (components/admin/SocialLinksOwnerReview.jsx, wired in from
 * app/admin/talent/[id]/page.jsx).
 *
 * Why this lives outside lib/admin/talent-workspace.js: that module's
 * helpers (deriveDetailWorkflowStatus, buildVersionHistoryTimelineItems,
 * etc.) are all scoped to the single-row-per-parent TalentVersion model.
 * Social Links are a fundamentally different shape — many independently
 * versioned TalentSocial rows per talent — so the matching/diffing rules
 * here are their own thing, not a variant of the TalentVersion ones.
 *
 * No diffing existed anywhere in the codebase before this sprint —
 * ComparisonView.jsx's `.changeDot` is explicitly documented there as an
 * inert, undiffed placeholder. This module is the first real diff logic in
 * the admin panel, written narrowly for TalentSocial only.
 *
 * Matching strategy — how a PROPOSED row is paired with the Published row
 * it's an edit of:
 *   - `basedOnVersionId` is the linkage socialsService.saveDraft already
 *     establishes when an employee starts editing an existing Published
 *     account (see that file's header comment): the new Draft/Proposed row
 *     carries the Published row's id in `basedOnVersionId`. This module
 *     matches on exactly that field — it does not guess by platform/handle,
 *     since two accounts can share a platform (multi-account support) and
 *     a handle can itself be the thing that changed.
 *   - A PROPOSED row with no `basedOnVersionId` (or one that doesn't match
 *     any current Published row's id) is a brand-new account: ADDED.
 *   - A PROPOSED row matched to a Published row is compared field-by-field
 *     (platform, label, customLabel, handle, url) — any difference makes it
 *     CHANGED, otherwise UNCHANGED.
 *   - A Published row with no matching PROPOSED row is shown as
 *     UNCHANGED_PUBLISHED_ONLY — included so the Owner sees the full
 *     current picture, not just what's moving.
 *
 * KNOWN LIMITATION — "missing/removed" detection:
 *   The data model and this module's logic CAN represent a removed account
 *   (a PROPOSED row whose `lifecycleStatus !== ACTIVE`, see
 *   talentRepository.getProposedSocialsForTalent's header comment) — see
 *   REMOVED below. In practice this can never occur yet: no UI control
 *   exists for an employee to mark an account for removal, and
 *   talentRepository.updateTalentSocialFields's WRITABLE_COLUMNS allowlist
 *   excludes `lifecycleStatus` entirely, so no current write path can ever
 *   produce a PROPOSED row with anything but lifecycleStatus=ACTIVE. This
 *   module is written so that limitation lives in one place and a future
 *   "remove account" feature only has to start writing that column — no
 *   review-side change would be needed.
 */

export const SOCIAL_REVIEW_STATUS = Object.freeze({
  ADDED: 'ADDED',
  CHANGED: 'CHANGED',
  UNCHANGED: 'UNCHANGED',
  UNCHANGED_PUBLISHED_ONLY: 'UNCHANGED_PUBLISHED_ONLY',
  REMOVED: 'REMOVED',
});

// Only these fields are ever compared — sortOrder is display-only
// bookkeeping, not something the Owner needs flagged as a "change."
const COMPARABLE_FIELDS = ['platform', 'label', 'customLabel', 'handle', 'url'];

function normalize(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

/**
 * Field-by-field comparison between a Published row and the PROPOSED row
 * matched to it. Returns the subset of COMPARABLE_FIELDS that actually
 * differ — an empty array means "no real change," even if the rows aren't
 * byte-identical (e.g. "" vs null are treated as equal via normalize()).
 *
 * @param {object} published
 * @param {object} proposed
 * @returns {string[]} field names that differ
 */
export function diffSocialFields(published, proposed) {
  if (!published || !proposed) return [];
  return COMPARABLE_FIELDS.filter(
    (field) => normalize(published[field]) !== normalize(proposed[field])
  );
}

/**
 * Builds one review item per account the Owner needs to see: every
 * Published row (matched to its PROPOSED counterpart if one exists, or
 * standing alone if not) plus every PROPOSED row that doesn't match any
 * Published row (a brand-new account).
 *
 * @param {Array<object>} publishedSocials - current Published+Active TalentSocial rows
 * @param {Array<object>} proposedSocials - current PROPOSED TalentSocial rows (any lifecycleStatus)
 * @returns {Array<{
 *   key: string,
 *   status: string,
 *   published: object|null,
 *   proposed: object|null,
 *   changedFields: string[],
 * }>}
 */
export function buildSocialReviewItems(publishedSocials = [], proposedSocials = []) {
  const published = Array.isArray(publishedSocials) ? publishedSocials : [];
  const proposed = Array.isArray(proposedSocials) ? proposedSocials : [];

  const publishedById = new Map(published.map((row) => [row.id, row]));
  const matchedPublishedIds = new Set();
  const items = [];

  for (const proposedRow of proposed) {
    const matchedPublished =
      proposedRow.basedOnVersionId && publishedById.has(proposedRow.basedOnVersionId)
        ? publishedById.get(proposedRow.basedOnVersionId)
        : null;

    if (matchedPublished) {
      matchedPublishedIds.add(matchedPublished.id);
    }

    // See this module's header comment — never true today (no write path
    // sets lifecycleStatus on a TalentSocial row), kept for forward
    // compatibility if a "remove account" feature is ever built.
    const isRemoved = proposedRow.lifecycleStatus && proposedRow.lifecycleStatus !== 'ACTIVE';

    let status;
    let changedFields = [];

    if (isRemoved) {
      status = SOCIAL_REVIEW_STATUS.REMOVED;
    } else if (!matchedPublished) {
      status = SOCIAL_REVIEW_STATUS.ADDED;
    } else {
      changedFields = diffSocialFields(matchedPublished, proposedRow);
      status = changedFields.length > 0 ? SOCIAL_REVIEW_STATUS.CHANGED : SOCIAL_REVIEW_STATUS.UNCHANGED;
    }

    items.push({
      key: proposedRow.id || `proposed-${items.length}`,
      status,
      published: matchedPublished || null,
      proposed: proposedRow,
      changedFields,
    });
  }

  // Every Published row no PROPOSED row referenced — included so the Owner
  // sees the full current picture, not just what's changing.
  for (const publishedRow of published) {
    if (matchedPublishedIds.has(publishedRow.id)) continue;
    items.push({
      key: `published-${publishedRow.id}`,
      status: SOCIAL_REVIEW_STATUS.UNCHANGED_PUBLISHED_ONLY,
      published: publishedRow,
      proposed: null,
      changedFields: [],
    });
  }

  return items;
}

/**
 * Small counts summary for the review panel's header
 * ("3 changes: 1 new, 1 changed, 1 unchanged").
 *
 * @param {ReturnType<typeof buildSocialReviewItems>} items
 */
/**
 * Rejected Resubmission Recovery sprint — filters a talent's REJECTED
 * TalentSocial rows down to only the ones that still need an editor's
 * attention, hiding any REJECTED row that has already been superseded by a
 * newer row in the same lineage (created via socialsService.resumeRejected,
 * or by any subsequent edit of that same lineage that happened afterward).
 *
 * Lineage key, mirroring socialsService.resumeRejected's own convention:
 * `row.basedOnVersionId || row.id`. Two rows are "the same thread" when one
 * row's `basedOnVersionId` equals the other's lineage key — this covers
 * both cases resumeRejected produces:
 *   - an edit of a published account: every row in the thread shares
 *     `basedOnVersionId` = that published row's (stable) id.
 *   - a brand-new account with no published base: every row in the thread
 *     shares `basedOnVersionId` = the very first rejected row's id (the
 *     thread's permanent anchor — resumeRejected never changes a rejected
 *     row's own basedOnVersionId, so this anchor never moves).
 *
 * A REJECTED row is hidden once any OTHER row in `allSocialRows` (any
 * status — DRAFT, PROPOSED, PUBLISHED, or even another REJECTED attempt)
 * shares its lineage key and was created later. This naturally collapses a
 * whole thread of repeated rejections down to showing only the single
 * newest one, and hides it entirely once a resumed draft moves on to
 * PROPOSED/PUBLISHED.
 *
 * @param {Array<object>} rejectedSocials - REJECTED rows (talentAdapter.getRejectedSocials)
 * @param {Array<object>} allSocialRows - every other TalentSocial row to check
 *   against (typically publishedSocials + draftSocials + rejectedSocials
 *   combined) — each row needs at least `id`, `basedOnVersionId`, `createdAt`
 * @returns {Array<object>} the subset of rejectedSocials still unresolved
 */
export function filterUnresolvedRejectedSocials(rejectedSocials = [], allSocialRows = []) {
  const rejected = Array.isArray(rejectedSocials) ? rejectedSocials : [];
  const allRows = Array.isArray(allSocialRows) ? allSocialRows : [];

  function lineageKey(row) {
    return row.basedOnVersionId || row.id;
  }

  function timestamp(row) {
    return row.createdAt ? new Date(row.createdAt).getTime() : 0;
  }

  return rejected.filter((rejectedRow) => {
    const key = lineageKey(rejectedRow);
    const rejectedAt = timestamp(rejectedRow);

    const hasNewerInLineage = allRows.some((row) => {
      if (row.id === rejectedRow.id) return false;
      if (row.basedOnVersionId !== key) return false;
      return timestamp(row) > rejectedAt;
    });

    return !hasNewerInLineage;
  });
}

export function summarizeSocialReview(items = []) {
  const summary = {
    added: 0,
    changed: 0,
    unchanged: 0,
    removed: 0,
    total: 0,
  };

  for (const item of items) {
    if (item.status === SOCIAL_REVIEW_STATUS.ADDED) summary.added += 1;
    else if (item.status === SOCIAL_REVIEW_STATUS.CHANGED) summary.changed += 1;
    else if (item.status === SOCIAL_REVIEW_STATUS.REMOVED) summary.removed += 1;
    else summary.unchanged += 1; // UNCHANGED + UNCHANGED_PUBLISHED_ONLY

    // Only proposed-side items count toward "what's actually pending
    // review" — UNCHANGED_PUBLISHED_ONLY rows aren't part of this proposal.
    if (item.proposed) summary.total += 1;
  }

  return summary;
}
