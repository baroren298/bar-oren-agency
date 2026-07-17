/*
 * Gallery image shape helpers — Gallery UX Completion sprint.
 *
 * Covers the two jobs of lib/admin/gallery-images.js:
 *
 * 1. buildGalleryImages — the repository-row -> flat-editor-row
 *    normalization, now shared between the talent detail page (load) and
 *    MediaGalleryEditor.handleSaveDraft (the gallery PATCH response). The
 *    regression these tests pin down: a raw repository row carries its
 *    image URL only as `imageAsset.blobUrl` and has no `alt` at all —
 *    before this sprint the editor stored those raw rows after a save, so
 *    every card lost the `src` its <img> needs.
 *
 * 2. buildUploadedGalleryImage — the flat row appended after a successful
 *    /api/admin/assets/upload call, including the new explicit
 *    position/scale defaults for the interactive positioning surface.
 *
 * Pure functions, no I/O — no mocks needed, same style as
 * lib/admin/gallery-review's consumers and the other lib/admin tests.
 */

import { describe, it, expect } from 'vitest';
import {
  buildGalleryImages,
  buildUploadedGalleryImage,
  DEFAULT_UPLOAD_POSITION,
  DEFAULT_UPLOAD_SCALE,
} from './gallery-images';
import { he } from './i18n/he';

/** A raw repository-shaped TalentGalleryImage row, as the PATCH route returns it. */
function makeRepositoryRow(overrides = {}) {
  return {
    id: 'img-1',
    imageAssetId: 'asset-1',
    imageAsset: { blobUrl: 'https://blob.example/gallery/one.jpg' },
    order: 0,
    altHe: null,
    altEn: null,
    position: null,
    scale: null,
    mobileOrder: null,
    versionStatus: 'DRAFT',
    basedOnVersionId: null,
    rejectionNote: null,
    createdBy: null,
    createdAt: '2026-07-07T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildGalleryImages', () => {
  it('maps a raw repository row to the flat editor shape (the Save Draft regression)', () => {
    const [row] = buildGalleryImages([makeRepositoryRow()], 'קים צ׳ורילוב');

    // The two display fields the raw repository row does NOT have:
    expect(row.src).toBe('https://blob.example/gallery/one.jpg');
    expect(row.alt).toBe(he.gallery.imageAlt('קים צ׳ורילוב', 0));

    // Everything the editor and Save Draft payload read:
    expect(row).toMatchObject({
      id: 'img-1',
      imageAssetId: 'asset-1',
      order: 0,
      altHe: null,
      altEn: null,
      position: null,
      scale: null,
      mobileOrder: null,
      versionStatus: 'DRAFT',
      basedOnVersionId: null,
      rejectionNote: null,
    });
  });

  it('prefers DB-authored altHe over the generated alt fallback', () => {
    const [row] = buildGalleryImages(
      [makeRepositoryRow({ altHe: 'תמונת במה' })],
      'קים צ׳ורילוב'
    );
    expect(row.alt).toBe('תמונת במה');
    expect(row.altHe).toBe('תמונת במה');
  });

  it('preserves existing position/scale values exactly, keyword strings included', () => {
    const [row] = buildGalleryImages(
      [makeRepositoryRow({ position: 'center 36%', scale: 1.05 })],
      'x'
    );
    expect(row.position).toBe('center 36%');
    expect(row.scale).toBe(1.05);
  });

  it('keeps nulls as nulls — it never invents defaults for existing rows', () => {
    const [row] = buildGalleryImages([makeRepositoryRow()], 'x');
    expect(row.position).toBeNull();
    expect(row.scale).toBeNull();
    expect(row.mobileOrder).toBeNull();
  });

  it('tolerates a row with no imageAsset relation (src becomes null, not a crash)', () => {
    const [row] = buildGalleryImages([makeRepositoryRow({ imageAsset: undefined })], 'x');
    expect(row.src).toBeNull();
  });

  it('generates per-index alt fallbacks across multiple rows', () => {
    const rows = buildGalleryImages(
      [makeRepositoryRow({ id: 'a' }), makeRepositoryRow({ id: 'b' })],
      'גל'
    );
    expect(rows[0].alt).toBe(he.gallery.imageAlt('גל', 0));
    expect(rows[1].alt).toBe(he.gallery.imageAlt('גל', 1));
  });

  it('returns [] for null/undefined input', () => {
    expect(buildGalleryImages(null, 'x')).toEqual([]);
    expect(buildGalleryImages(undefined, 'x')).toEqual([]);
  });
});

describe('buildUploadedGalleryImage', () => {
  const asset = { id: 'asset-9', blobUrl: 'https://blob.example/gallery/new.jpg' };

  it('seeds the explicit position/scale defaults for a brand-new upload', () => {
    const row = buildUploadedGalleryImage(asset, 3);
    expect(row.position).toBe(DEFAULT_UPLOAD_POSITION);
    expect(row.position).toBe('50% 50%');
    expect(row.scale).toBe(DEFAULT_UPLOAD_SCALE);
    expect(row.scale).toBe(1);
  });

  it('builds the same flat shape the editor uses everywhere else, with no id yet', () => {
    const row = buildUploadedGalleryImage(asset, 3);
    expect(row).toMatchObject({
      _key: 'new-asset-9',
      imageAssetId: 'asset-9',
      src: 'https://blob.example/gallery/new.jpg',
      alt: he.gallery.newImageAlt,
      altHe: null,
      altEn: null,
      order: 3,
      mobileOrder: 3,
    });
    // No `id` — Save Draft's "no id, has imageAssetId" branch is what
    // creates the TalentGalleryImage row (galleryService.saveDraft).
    expect(row.id).toBeUndefined();
  });

  it('seeds order and mobileOrder from the append index', () => {
    const row = buildUploadedGalleryImage(asset, 0);
    expect(row.order).toBe(0);
    expect(row.mobileOrder).toBe(0);
  });
});
