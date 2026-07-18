/*
 * Gallery Owner Review sprint.
 *
 * Sibling to lib/admin/social-review.js — same pure, presentation-layer
 * diff logic, comparing a talent's Current Published TalentGalleryImage
 * rows against its PROPOSED rows for the Gallery tab's Owner Review panel
 * (components/admin/GalleryOwnerReview.jsx, wired in from
 * app/admin/talent/[id]/page.jsx). See social-review.js's header comment
 * for the full rationale on why this lives outside lib/admin/talent-
 * workspace.js — it applies unchanged here.
 *
 * Matching strategy — identical to social-review.js's, substituting
 * TalentGalleryImage's own fields:
 *   - `basedOnVersionId` is the linkage galleryService.saveDraft/
 *     resumeRejected already establish (see that file's header comment):
 *     the new Draft/Proposed row carries the Published row's id in
 *     `basedOnVersionId`. This module matches on exactly that field.
 *   - A PROPOSED row with no matching Published row is a brand-new
 *     addition: ADDED. In practice this never happens yet in Sprint 1 (no
 *     "Add Image" capability exists — see galleryService.js's header
 *     comment), but the case is kept for the same forward-compatibility
 *     reason REMOVED is kept below.
 *   - A PROPOSED row matched to a Published row is compared field-by-field
 *     (order, altHe, altEn, position, scale, mobileOrder) — any difference
 *     makes it CHANGED, otherwise UNCHANGED.
 *   - A Published row with no matching PROPOSED row is shown as
 *     UNCHANGED_PUBLISHED_ONLY.
 *
 * REMOVED detection — a PROPOSED row whose `lifecycleStatus !== ACTIVE`.
 * Gallery Image Removal sprint: this is no longer a forward-compatibility
 * placeholder — galleryService.saveDraft can now actually produce such a
 * row (see that file's header comment). Two cases reach this state, and
 * they must be told apart:
 *   - The row is matched to a live Published row (`basedOnVersionId` marks
 *     a real content removal awaiting Owner sign-off — REMOVED, shown in
 *     the review list.
 *   - The row has no matched Published row (a brand-new addition that was
 *     withdrawn before ever going live) — nothing public is at stake, so
 *     an Owner approving/rejecting it would be reviewing a no-op. This
 *     module drops that item from its output entirely rather than
 *     labeling it REMOVED (see the early `continue` below).
 */

export const GALLERY_REVIEW_STATUS = Object.freeze({
  ADDED: 'ADDED',
  CHANGED: 'CHANGED',
  UNCHANGED: 'UNCHANGED',
  UNCHANGED_PUBLISHED_ONLY: 'UNCHANGED_PUBLISHED_ONLY',
  REMOVED: 'REMOVED',
});

// Only these fields are ever compared — imageAssetId is never reassigned
// by any write path this sprint (no "replace image"), so it's not a
// meaningful "change" to flag even though it's present on every row.
const COMPARABLE_FIELDS = ['order', 'altHe', 'altEn', 'position', 'scale', 'mobileOrder'];

function normalize(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

/**
 * Field-by-field comparison between a Published row and the PROPOSED row
 * matched to it. Returns the subset of COMPARABLE_FIELDS that actually
 * differ.
 *
 * @param {object} published
 * @param {object} proposed
 * @returns {string[]} field names that differ
 */
export function diffGalleryImageFields(published, proposed) {
  if (!published || !proposed) return [];
  return COMPARABLE_FIELDS.filter(
    (field) => normalize(published[field]) !== normalize(proposed[field])
  );
}

/**
 * Builds one review item per image the Owner needs to see: every Published
 * row (matched to its PROPOSED counterpart if one exists, or standing
 * alone if not) plus every PROPOSED row that doesn't match any Published
 * row.
 *
 * @param {Array<object>} publishedImages - current Published+Active TalentGalleryImage rows
 * @param {Array<object>} proposedImages - current PROPOSED TalentGalleryImage rows (any lifecycleStatus)
 * @returns {Array<{
 *   key: string,
 *   status: string,
 *   published: object|null,
 *   proposed: object|null,
 *   changedFields: string[],
 * }>}
 */
export function buildGalleryReviewItems(publishedImages = [], proposedImages = []) {
  const published = Array.isArray(publishedImages) ? publishedImages : [];
  const proposed = Array.isArray(proposedImages) ? proposedImages : [];

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

    // See this module's header comment for the two cases this covers.
    const isRemoved = proposedRow.lifecycleStatus && proposedRow.lifecycleStatus !== 'ACTIVE';

    // A hidden row with no live Published counterpart was never public —
    // removing it is an immediate withdrawal (galleryService.saveDraft
    // already lets it take effect with no Submit/Approve needed), not a
    // reviewable removal. It must not appear in Owner Review at all.
    if (isRemoved && !matchedPublished) {
      continue;
    }

    let status;
    let changedFields = [];

    if (isRemoved) {
      status = GALLERY_REVIEW_STATUS.REMOVED;
    } else if (!matchedPublished) {
      status = GALLERY_REVIEW_STATUS.ADDED;
    } else {
      changedFields = diffGalleryImageFields(matchedPublished, proposedRow);
      status = changedFields.length > 0 ? GALLERY_REVIEW_STATUS.CHANGED : GALLERY_REVIEW_STATUS.UNCHANGED;
    }

    items.push({
      key: proposedRow.id || `proposed-${items.length}`,
      status,
      published: matchedPublished || null,
      proposed: proposedRow,
      changedFields,
    });
  }

  // Every Published row no PROPOSED row referenced.
  for (const publishedRow of published) {
    if (matchedPublishedIds.has(publishedRow.id)) continue;
    items.push({
      key: `published-${publishedRow.id}`,
      status: GALLERY_REVIEW_STATUS.UNCHANGED_PUBLISHED_ONLY,
      published: publishedRow,
      proposed: null,
      changedFields: [],
    });
  }

  return items;
}

/**
 * Rejected Resubmission Recovery (Gallery) — filters a talent's REJECTED
 * TalentGalleryImage rows down to only the ones that still need an
 * editor's attention, hiding any REJECTED row already superseded by a
 * newer row in the same lineage. Identical lineage-key logic to
 * social-review.js's filterUnresolvedRejectedSocials — see that function's
 * header comment for the full reasoning, which applies unchanged here.
 *
 * @param {Array<object>} rejectedImages - REJECTED rows (talentAdapter.getRejectedGalleryImages)
 * @param {Array<object>} allImageRows - every other TalentGalleryImage row to check
 *   against (typically publishedImages + draftImages + rejectedImages combined)
 * @returns {Array<object>} the subset of rejectedImages still unresolved
 */
export function filterUnresolvedRejectedGalleryImages(rejectedImages = [], allImageRows = []) {
  const rejected = Array.isArray(rejectedImages) ? rejectedImages : [];
  const allRows = Array.isArray(allImageRows) ? allImageRows : [];

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

/**
 * Small counts summary for the review panel's header.
 *
 * @param {ReturnType<typeof buildGalleryReviewItems>} items
 */
export function summarizeGalleryReview(items = []) {
  const summary = {
    added: 0,
    changed: 0,
    unchanged: 0,
    removed: 0,
    total: 0,
  };

  for (const item of items) {
    if (item.status === GALLERY_REVIEW_STATUS.ADDED) summary.added += 1;
    else if (item.status === GALLERY_REVIEW_STATUS.CHANGED) summary.changed += 1;
    else if (item.status === GALLERY_REVIEW_STATUS.REMOVED) summary.removed += 1;
    else summary.unchanged += 1; // UNCHANGED + UNCHANGED_PUBLISHED_ONLY

    if (item.proposed) summary.total += 1;
  }

  return summary;
}
