/*
 * Gallery Image Removal sprint — buildGalleryReviewItems() removal
 * coverage.
 *
 * Pure function, no I/O — same style as lib/admin/gallery-images.test.js.
 * Confirms the split gallery-review.js's header comment describes:
 *   - A hidden PROPOSED row matched (via basedOnVersionId) to a live
 *     Published row is a real removal awaiting Owner review — REMOVED.
 *   - A hidden PROPOSED row with no matched Published row was never
 *     public — it's a withdrawn addition and must not appear in the
 *     review list (or its summary counts) at all.
 */
import { describe, it, expect } from 'vitest';
import { buildGalleryReviewItems, summarizeGalleryReview, GALLERY_REVIEW_STATUS } from './gallery-review';

function makePublishedRow(overrides = {}) {
  return {
    id: 'published-1',
    order: 0,
    altHe: 'תמונת במה',
    altEn: null,
    position: null,
    scale: null,
    mobileOrder: null,
    ...overrides,
  };
}

function makeProposedRow(overrides = {}) {
  return {
    id: 'proposed-1',
    basedOnVersionId: null,
    lifecycleStatus: 'ACTIVE',
    order: 0,
    altHe: 'תמונת במה',
    altEn: null,
    position: null,
    scale: null,
    mobileOrder: null,
    createdAt: '2026-07-19T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildGalleryReviewItems — removing a published image (has a live counterpart)', () => {
  it('a hidden proposed row matched to a published row appears as REMOVED, carrying the matched published row', () => {
    const published = makePublishedRow({ id: 'published-1' });
    const proposed = makeProposedRow({
      id: 'proposed-1',
      basedOnVersionId: 'published-1',
      lifecycleStatus: 'HIDDEN',
    });

    const items = buildGalleryReviewItems([published], [proposed]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      status: GALLERY_REVIEW_STATUS.REMOVED,
      published,
      proposed,
    });

    const summary = summarizeGalleryReview(items);
    expect(summary.removed).toBe(1);
    expect(summary.total).toBe(1);
  });
});

describe('buildGalleryReviewItems — withdrawing a never-published image (no live counterpart)', () => {
  it('a hidden proposed row with no matched published row is excluded from the review list entirely', () => {
    const proposed = makeProposedRow({
      id: 'proposed-2',
      basedOnVersionId: null, // never had a live counterpart
      lifecycleStatus: 'HIDDEN',
    });

    const items = buildGalleryReviewItems([], [proposed]);

    expect(items).toHaveLength(0);

    const summary = summarizeGalleryReview(items);
    expect(summary.removed).toBe(0);
    expect(summary.total).toBe(0);
  });

  it('is excluded even when unrelated published rows exist for the same talent', () => {
    const published = makePublishedRow({ id: 'published-9' });
    const withdrawn = makeProposedRow({
      id: 'proposed-3',
      basedOnVersionId: null,
      lifecycleStatus: 'HIDDEN',
    });

    const items = buildGalleryReviewItems([published], [withdrawn]);

    // The withdrawn row is dropped; the unrelated published row still
    // surfaces as UNCHANGED_PUBLISHED_ONLY (no proposed row referencing it).
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe(GALLERY_REVIEW_STATUS.UNCHANGED_PUBLISHED_ONLY);
    expect(items[0].published).toEqual(published);
  });
});

describe('buildGalleryReviewItems — unaffected existing statuses (regression check)', () => {
  it('still reports ADDED for a brand-new, still-ACTIVE proposed row with no matched published row', () => {
    const proposed = makeProposedRow({ id: 'proposed-4', basedOnVersionId: null, lifecycleStatus: 'ACTIVE' });
    const items = buildGalleryReviewItems([], [proposed]);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe(GALLERY_REVIEW_STATUS.ADDED);
  });

  it('still reports CHANGED for a matched, ACTIVE proposed row with a field difference', () => {
    const published = makePublishedRow({ id: 'published-5', altHe: 'ישן' });
    const proposed = makeProposedRow({
      id: 'proposed-5',
      basedOnVersionId: 'published-5',
      lifecycleStatus: 'ACTIVE',
      altHe: 'חדש',
    });
    const items = buildGalleryReviewItems([published], [proposed]);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe(GALLERY_REVIEW_STATUS.CHANGED);
    expect(items[0].changedFields).toContain('altHe');
  });
});
