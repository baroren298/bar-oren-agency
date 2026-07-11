/*
 * Podcast Image Upload sprint — flow-level coverage for
 * lib/admin/podcast-image.js, the logic behind PodcastTab's "החלף תמונה"
 * control. No DOM harness exists in this repo (component tests render with
 * react-dom/server and can't simulate clicks), so the sprint's behavioral
 * requirements are locked here against the extracted flow directly:
 * upload success PATCHes the current version with the new asset id, no
 * editable versionId / uploadsEnabled=false makes the action unavailable
 * (and performs zero network calls), and any failure leaves the current
 * image untouched (the flow reports failure; the preview only ever swaps
 * on { ok: true }).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  canReplacePodcastImage,
  selectPodcastPreviewUrl,
  replacePodcastImage,
} from './podcast-image';

const copy = { saveError: 'שמירת הטיוטה נכשלה.', networkError: 'תקלת תקשורת.' };

function makeUpload(asset = { id: 'asset-9', blobUrl: 'https://blob.test/new.jpg' }) {
  return vi.fn(async () => (asset ? { asset } : null));
}

function makeFetch({ ok = true, body = {} } = {}) {
  return vi.fn(async () => ({ ok, json: async () => body }));
}

describe('canReplacePodcastImage', () => {
  it('is available only with an editable versionId AND uploadsEnabled AND not busy', () => {
    expect(canReplacePodcastImage({ versionId: 'v-1', uploadsEnabled: true })).toBe(true);
    expect(canReplacePodcastImage({ versionId: null, uploadsEnabled: true })).toBe(false);
    expect(canReplacePodcastImage({ versionId: 'v-1', uploadsEnabled: false })).toBe(false);
    expect(canReplacePodcastImage({ versionId: 'v-1', uploadsEnabled: true, busy: true })).toBe(false);
  });
});

describe('selectPodcastPreviewUrl', () => {
  it('published image is the fallback before any replacement exists', () => {
    expect(selectPodcastPreviewUrl({ publishedImageUrl: 'https://blob.test/pub.jpg' })).toBe(
      'https://blob.test/pub.jpg'
    );
  });

  it('a pending draft image (post-refresh) wins over the published image', () => {
    expect(
      selectPodcastPreviewUrl({
        pendingImageUrl: 'https://blob.test/pending.jpg',
        publishedImageUrl: 'https://blob.test/pub.jpg',
      })
    ).toBe('https://blob.test/pending.jpg');
  });

  it('an image uploaded+saved this session wins over both', () => {
    expect(
      selectPodcastPreviewUrl({
        localPreviewUrl: 'https://blob.test/new.jpg',
        pendingImageUrl: 'https://blob.test/pending.jpg',
        publishedImageUrl: 'https://blob.test/pub.jpg',
      })
    ).toBe('https://blob.test/new.jpg');
  });

  it('returns null when there is no image at all', () => {
    expect(selectPodcastPreviewUrl({})).toBeNull();
  });
});

describe('replacePodcastImage', () => {
  const baseParams = {
    talentId: 't-1',
    versionId: 'v-1',
    uploadsEnabled: true,
    file: { name: 'cover.jpg' },
    copy,
  };

  it('upload success PATCHes the current version with exactly { fields: { podcastImageAssetId } }', async () => {
    const upload = makeUpload();
    const fetchImpl = makeFetch();

    const result = await replacePodcastImage({ ...baseParams, upload, fetchImpl });

    expect(result).toEqual({ ok: true, asset: { id: 'asset-9', blobUrl: 'https://blob.test/new.jpg' } });
    expect(upload).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledOnce();

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/admin/talent/t-1/proposals/v-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ fields: { podcastImageAssetId: 'asset-9' } });
  });

  it('no editable versionId → unavailable, no upload, no network call', async () => {
    const upload = makeUpload();
    const fetchImpl = makeFetch();

    const result = await replacePodcastImage({ ...baseParams, versionId: null, upload, fetchImpl });

    expect(result).toEqual({ ok: false, reason: 'unavailable' });
    expect(upload).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('uploadsEnabled=false → unavailable, no upload, no network call', async () => {
    const upload = makeUpload();
    const fetchImpl = makeFetch();

    const result = await replacePodcastImage({ ...baseParams, uploadsEnabled: false, upload, fetchImpl });

    expect(result).toEqual({ ok: false, reason: 'unavailable' });
    expect(upload).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('upload failure → no PATCH is attempted, current image stays (flow reports failure)', async () => {
    const upload = vi.fn(async () => null); // useImageAssetUpload's failure contract
    const fetchImpl = makeFetch();

    const result = await replacePodcastImage({ ...baseParams, upload, fetchImpl });

    expect(result).toEqual({ ok: false, reason: 'upload' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('PATCH failure → surfaces the API user-facing message, never ok', async () => {
    const upload = makeUpload();
    const fetchImpl = makeFetch({ ok: false, body: { error: 'לא ניתן לערוך גרסה זו.' } });

    const result = await replacePodcastImage({ ...baseParams, upload, fetchImpl });

    expect(result).toEqual({ ok: false, reason: 'save', error: 'לא ניתן לערוך גרסה זו.' });
  });

  it('PATCH network error → friendly network copy, never a raw technical error', async () => {
    const upload = makeUpload();
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNRESET raw technical detail');
    });

    const result = await replacePodcastImage({ ...baseParams, upload, fetchImpl });

    expect(result).toEqual({ ok: false, reason: 'save', error: copy.networkError });
    expect(result.error).not.toContain('ECONNRESET');
  });
});
