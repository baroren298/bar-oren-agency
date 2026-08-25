/*
 * assetService — Production Upload Enablement sprint. First coverage for
 * the upload orchestration (validate -> store -> persist -> emit).
 *
 * Mock boundary: the storage resolver, the repository, and the event
 * service are mocked (I/O seams); keyGen / mimeSniff / validationProfiles
 * are used for real — they're pure, they have their own test files, and
 * running them here proves the pieces actually compose (e.g. that a
 * spoofed-mime buffer really is stopped before any storage write).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  provider: {
    name: 'fake-provider',
    put: vi.fn(),
    delete: vi.fn(),
    getSignedUrl: vi.fn(),
  },
  createAsset: vi.fn(),
  emit: vi.fn(),
}));

vi.mock('../../storage', () => ({
  getStorageProvider: () => hoisted.provider,
}));

vi.mock('../repository/assetRepository', () => ({
  assetRepository: { createAsset: hoisted.createAsset },
}));

vi.mock('./eventService', () => ({
  eventService: { emit: hoisted.emit },
}));

import { assetService } from './assetService';
import { he } from '../i18n/he';

// Real JPEG magic bytes so the real mimeSniff recognizes it.
const JPEG_BUFFER = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.from('rest-of-image'),
]);

const STORED = {
  url: 'https://blobs.example/gallery/some-uuid.jpg',
  key: 'https://blobs.example/gallery/some-uuid.jpg',
  bytes: JPEG_BUFFER.length,
};

function validParams(overrides = {}) {
  return {
    buffer: JPEG_BUFFER,
    purpose: 'gallery',
    originalFilename: 'headshot.jpg',
    uploadedById: 'user-1',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.provider.put.mockResolvedValue(STORED);
  hoisted.provider.delete.mockResolvedValue(undefined);
  hoisted.createAsset.mockImplementation(async (fields) => ({ id: 'asset-1', ...fields }));
  hoisted.emit.mockResolvedValue(undefined);
});

describe('uploadAsset — happy path', () => {
  it('stores the file under a random gallery key, persists the metadata row, and emits ASSET_UPLOADED', async () => {
    const asset = await assetService.uploadAsset(validParams());

    // Storage write: keyGen-shaped key, sniffed mime forwarded.
    expect(hoisted.provider.put).toHaveBeenCalledTimes(1);
    const [buffer, putOptions] = hoisted.provider.put.mock.calls[0];
    expect(buffer).toBe(JPEG_BUFFER);
    expect(putOptions.key).toMatch(/^gallery\/[0-9a-f-]{36}\.jpg$/);
    expect(putOptions.mimeType).toBe('image/jpeg');

    // DB row: provider-returned url/key, sniffed (not client-claimed) mime.
    expect(hoisted.createAsset).toHaveBeenCalledWith({
      blobUrl: STORED.url,
      provider: 'fake-provider',
      providerKey: STORED.key,
      originalFilename: 'headshot.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: STORED.bytes,
      kind: 'IMAGE',
      uploadedById: 'user-1',
    });
    expect(asset.id).toBe('asset-1');

    // Audit event.
    expect(hoisted.emit).toHaveBeenCalledTimes(1);
    expect(hoisted.emit.mock.calls[0][1].payload.assetId).toBe('asset-1');

    // Nothing failed, so nothing was cleaned up.
    expect(hoisted.provider.delete).not.toHaveBeenCalled();
  });
});

describe('uploadAsset — validation failures (all before any storage write)', () => {
  it('rejects an empty file', async () => {
    await expect(assetService.uploadAsset(validParams({ buffer: Buffer.alloc(0) }))).rejects.toThrow(
      he.gallery.errors.uploadEmptyFile
    );
    expect(hoisted.provider.put).not.toHaveBeenCalled();
  });

  it('requires uploadedById', async () => {
    await expect(assetService.uploadAsset(validParams({ uploadedById: null }))).rejects.toThrow(
      /uploadedById is required/
    );
    expect(hoisted.provider.put).not.toHaveBeenCalled();
  });

  it('rejects an unknown purpose with code UNKNOWN_PURPOSE', async () => {
    let thrown;
    try {
      await assetService.uploadAsset(validParams({ purpose: 'nonsense' }));
    } catch (error) {
      thrown = error;
    }
    expect(thrown.code).toBe('UNKNOWN_PURPOSE');
    expect(hoisted.provider.put).not.toHaveBeenCalled();
  });

  it('rejects a file over the purpose size cap', async () => {
    const oversized = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.alloc(8 * 1024 * 1024), // header + 8MB > the 8MB cap
    ]);
    await expect(assetService.uploadAsset(validParams({ buffer: oversized }))).rejects.toThrow(
      he.gallery.errors.uploadFileTooLarge
    );
    expect(hoisted.provider.put).not.toHaveBeenCalled();
  });

  // Profile Image Upload Fix sprint (2026-08-25) — server-side authority
  // for the lowered profile cap (validationProfiles.js: 4MB, down from
  // 8MB). Proves the same rejection this test already covers for gallery
  // (8MB) also holds for profile at its own, lower 4MB cap — never reaches
  // the storage provider.
  it('rejects a profile-purpose file over its own 4MB cap', async () => {
    const oversized = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.alloc(4 * 1024 * 1024), // header + 4MB > the profile purpose's 4MB cap
    ]);
    await expect(
      assetService.uploadAsset(validParams({ purpose: 'profile', buffer: oversized }))
    ).rejects.toThrow(he.gallery.errors.uploadFileTooLarge);
    expect(hoisted.provider.put).not.toHaveBeenCalled();
  });

  it('rejects a spoofed mime type — content bytes decide, not the filename', async () => {
    const scriptDressedAsJpeg = Buffer.from('#!/bin/sh\nrm -rf /', 'utf8');
    await expect(
      assetService.uploadAsset(
        validParams({ buffer: scriptDressedAsJpeg, originalFilename: 'innocent.jpg' })
      )
    ).rejects.toThrow(he.gallery.errors.uploadUnsupportedType);
    expect(hoisted.provider.put).not.toHaveBeenCalled();
  });

  it('rejects a real image type outside the purpose allowlist (gif sniffs fine but gallery forbids it)', async () => {
    const gif = Buffer.from('GIF89a-and-then-some', 'ascii');
    await expect(assetService.uploadAsset(validParams({ buffer: gif }))).rejects.toThrow(
      he.gallery.errors.uploadUnsupportedType
    );
    expect(hoisted.provider.put).not.toHaveBeenCalled();
  });
});

describe('uploadAsset — compensating delete', () => {
  it('deletes the just-stored file when the DB write fails, and rethrows the DB error', async () => {
    const dbError = new Error('db exploded');
    hoisted.createAsset.mockRejectedValue(dbError);

    await expect(assetService.uploadAsset(validParams())).rejects.toBe(dbError);

    expect(hoisted.provider.delete).toHaveBeenCalledWith(STORED.key);
    expect(hoisted.emit).not.toHaveBeenCalled();
  });

  it('still surfaces the original DB error when the compensating delete itself fails', async () => {
    const dbError = new Error('db exploded');
    hoisted.createAsset.mockRejectedValue(dbError);
    hoisted.provider.delete.mockRejectedValue(new Error('delete also failed'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(assetService.uploadAsset(validParams())).rejects.toBe(dbError);

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
