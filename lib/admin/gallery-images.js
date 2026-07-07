/*
 * Gallery image shape helpers — Gallery UX Completion sprint.
 *
 * Sibling to lib/admin/gallery-review.js — same "pure, presentation-layer,
 * no I/O" rules. Two jobs, both about keeping every gallery row in the
 * editor in ONE flat shape:
 *
 * 1. `buildGalleryImages` — moved verbatim from
 *    app/admin/talent/[id]/page.jsx (where it was a page-local helper) so
 *    the exact same repository-row -> editor-row normalization can run in
 *    two places instead of one:
 *      - the Server Component page, on load (unchanged behavior), and
 *      - MediaGalleryEditor.handleSaveDraft, on the PATCH response.
 *    This closes a real shape-divergence bug: the gallery PATCH route
 *    returns raw repository rows (`imageAsset: { blobUrl }`, no `src`/`alt`)
 *    and the editor previously fed those straight into its state via
 *    withKeys(), so after the first Save Draft every card lost the `src`
 *    next/image requires and the `alt` fallback the page had computed.
 *    Normalizing the response through this same function makes the
 *    post-save state byte-shaped like the page-load seed.
 *
 * 2. `buildUploadedGalleryImage` — the flat row appended to the proposed
 *    grid when /api/admin/assets/upload succeeds (previously an inline
 *    object literal in MediaGalleryEditor.uploadQueueItem). Extracted so
 *    the new-upload defaults are testable and documented in one place:
 *    a brand-new upload now seeds `position: "50% 50%"` / `scale: 1`
 *    (matching ImagePreview's drag math and ImagePositionControls' slider
 *    floor) instead of nulls, so the interactive positioning surface starts
 *    from an explicit, saved-on-first-draft framing. Existing rows are
 *    untouched — `buildGalleryImages` still passes their `position`/`scale`
 *    through as-is, nulls included (null still means "renderer default" on
 *    the public site).
 *
 * No repository/Prisma/fetch imports here — inputs are plain objects.
 */

import { he } from './i18n/he';

/** Default framing seeded onto a brand-new uploaded gallery row. */
export const DEFAULT_UPLOAD_POSITION = '50% 50%';
export const DEFAULT_UPLOAD_SCALE = 1;

/*
 * Normalizes repository-shaped TalentGalleryImage rows (each with its
 * `imageAsset` relation included) into the flat row shape
 * MediaGalleryEditor/PublishedMediaGrid/GalleryImageCard/GalleryOwnerReview
 * expect — `src`/`alt` for display, plus every editable field (`altHe`,
 * `altEn`, `position`, `scale`, `mobileOrder`) and lifecycle metadata
 * (`versionStatus`, `basedOnVersionId`, `rejectionNote`, `createdBy`,
 * `createdAt`). `altHe` is used for display when present (DB-authored alt
 * text); falls back to the same generated "<name> — תמונה N" label the
 * mock-data path used, so a row with no alt text yet still renders
 * identically to before. Read-only — never writes anything.
 *
 * (Moved from app/admin/talent/[id]/page.jsx, Gallery UX Completion sprint —
 * body unchanged.)
 *
 * @param {object[]} galleryImages - repository rows
 * @param {string} displayName - talent display name, for the alt fallback
 * @returns {object[]} flat editor-shaped rows
 */
export function buildGalleryImages(galleryImages, displayName) {
  return (galleryImages || []).map((row, index) => ({
    id: row.id,
    imageAssetId: row.imageAssetId,
    src: row.imageAsset?.blobUrl ?? null,
    alt: row.altHe || he.gallery.imageAlt(displayName, index),
    altHe: row.altHe ?? null,
    altEn: row.altEn ?? null,
    order: row.order,
    position: row.position ?? null,
    scale: row.scale ?? null,
    mobileOrder: row.mobileOrder ?? null,
    versionStatus: row.versionStatus,
    basedOnVersionId: row.basedOnVersionId ?? null,
    rejectionNote: row.rejectionNote ?? null,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt ?? null,
  }));
}

/*
 * The flat, editor-shaped row for one freshly-uploaded Asset, appended to
 * the proposed grid before any TalentGalleryImage row exists. Carries no
 * `id` (Save Draft's "no id, has imageAssetId" branch is what creates the
 * DB row — see galleryService.saveDraft) and an explicit `_key` since
 * withKeys() only handles rows that already have an `id`.
 *
 * @param {object} asset - the upload route's response asset ({ id, blobUrl })
 * @param {number} index - the row's position in the proposed grid at append
 *   time (seeds both `order` and `mobileOrder`; `order` is recomputed from
 *   array position on save anyway, `mobileOrder` has no such recompute)
 * @returns {object} flat editor-shaped row
 */
export function buildUploadedGalleryImage(asset, index) {
  return {
    _key: `new-${asset.id}`,
    imageAssetId: asset.id,
    src: asset.blobUrl,
    alt: he.gallery.newImageAlt,
    altHe: null,
    altEn: null,
    position: DEFAULT_UPLOAD_POSITION,
    scale: DEFAULT_UPLOAD_SCALE,
    order: index,
    mobileOrder: index,
  };
}
