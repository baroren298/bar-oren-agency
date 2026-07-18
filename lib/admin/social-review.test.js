/*
 * Social Remove sprint — buildSocialReviewItems() removal coverage.
 *
 * Sibling to lib/admin/gallery-review.test.js — same pure-function, no-I/O
 * style. Confirms the split social-review.js's header comment now
 * describes (previously a documented "known limitation" that never
 * triggered in practice, since no write path could ever produce a non-ACTIVE
 * PROPOSED row before this sprint):
 *   - A hidden PROPOSED row matched (via basedOnVersionId) to a live
 *     Published row is a real removal awaiting Owner review — REMOVED.
 *   - A hidden PROPOSED row with no matched Published row was never
 *     public — it's a withdrawn account and must not appear in the review
 *     list (or its summary counts) at all.
 */
import { describe, it, expect } from 'vitest';
import { buildSocialReviewItems, summarizeSocialReview, SOCIAL_REVIEW_STATUS } from './social-review';

function makePublishedRow(overrides = {}) {
  return {
    id: 'published-1',
    platform: 'INSTAGRAM',
    label: 'MAIN',
    customLabel: null,
    handle: 'almavay',
    url: 'https://instagram.com/almavay',
    ...overrides,
  };
}

function makeProposedRow(overrides = {}) {
  return {
    id: 'proposed-1',
    basedOnVersionId: null,
    lifecycleStatus: 'ACTIVE',
    platform: 'INSTAGRAM',
    label: 'MAIN',
    customLabel: null,
    handle: 'almavay',
    url: 'https://instagram.com/almavay',
    createdAt: '2026-07-19T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildSocialReviewItems — removing a published account (has a live counterpart)', () => {
  it('a hidden proposed row matched to a published row appears as REMOVED, carrying the matched published row', () => {
    const published = makePublishedRow({ id: 'published-1' });
    const proposed = makeProposedRow({
      id: 'proposed-1',
      basedOnVersionId: 'published-1',
      lifecycleStatus: 'HIDDEN',
    });

    const items = buildSocialReviewItems([published], [proposed]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      status: SOCIAL_REVIEW_STATUS.REMOVED,
      published,
      proposed,
    });

    const summary = summarizeSocialReview(items);
    expect(summary.removed).toBe(1);
    expect(summary.total).toBe(1);
  });
});

describe('buildSocialReviewItems — withdrawing a never-published account (no live counterpart)', () => {
  it('a hidden proposed row with no matched published row is excluded from the review list entirely', () => {
    const proposed = makeProposedRow({
      id: 'proposed-2',
      basedOnVersionId: null, // never had a live counterpart
      lifecycleStatus: 'HIDDEN',
    });

    const items = buildSocialReviewItems([], [proposed]);

    expect(items).toHaveLength(0);

    const summary = summarizeSocialReview(items);
    expect(summary.removed).toBe(0);
    expect(summary.total).toBe(0);
  });

  it('is excluded even when unrelated published rows exist for the same talent', () => {
    const published = makePublishedRow({ id: 'published-9', platform: 'TIKTOK' });
    const withdrawn = makeProposedRow({
      id: 'proposed-3',
      basedOnVersionId: null,
      lifecycleStatus: 'HIDDEN',
    });

    const items = buildSocialReviewItems([published], [withdrawn]);

    // The withdrawn row is dropped; the unrelated published row still
    // surfaces as UNCHANGED_PUBLISHED_ONLY (no proposed row referencing it).
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe(SOCIAL_REVIEW_STATUS.UNCHANGED_PUBLISHED_ONLY);
    expect(items[0].published).toEqual(published);
  });
});

describe('buildSocialReviewItems — unaffected existing statuses (regression check)', () => {
  it('still reports ADDED for a brand-new, still-ACTIVE proposed row with no matched published row', () => {
    const proposed = makeProposedRow({ id: 'proposed-4', basedOnVersionId: null, lifecycleStatus: 'ACTIVE' });
    const items = buildSocialReviewItems([], [proposed]);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe(SOCIAL_REVIEW_STATUS.ADDED);
  });

  it('still reports CHANGED for a matched, ACTIVE proposed row with a field difference', () => {
    const published = makePublishedRow({ id: 'published-5', handle: 'old-handle' });
    const proposed = makeProposedRow({
      id: 'proposed-5',
      basedOnVersionId: 'published-5',
      lifecycleStatus: 'ACTIVE',
      handle: 'new-handle',
    });
    const items = buildSocialReviewItems([published], [proposed]);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe(SOCIAL_REVIEW_STATUS.CHANGED);
    expect(items[0].changedFields).toContain('handle');
  });

  it('still reports UNCHANGED for a matched, ACTIVE proposed row with no field difference', () => {
    const published = makePublishedRow({ id: 'published-6' });
    const proposed = makeProposedRow({
      id: 'proposed-6',
      basedOnVersionId: 'published-6',
      lifecycleStatus: 'ACTIVE',
    });
    const items = buildSocialReviewItems([published], [proposed]);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe(SOCIAL_REVIEW_STATUS.UNCHANGED);
  });
});
