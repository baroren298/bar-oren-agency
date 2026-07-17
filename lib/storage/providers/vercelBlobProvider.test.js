/*
 * vercelBlobProvider — Production Upload Enablement sprint. The SDK is
 * mocked (and additionally aliased to a throwing stub in vitest.config.js),
 * so nothing here can reach the network; this verifies our side of the
 * contract only — what we pass the SDK and what we hand back to
 * assetService.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  put: vi.fn(),
  del: vi.fn(),
}));

vi.mock('@vercel/blob', () => ({
  put: hoisted.put,
  del: hoisted.del,
}));

import { vercelBlobProvider } from './vercelBlobProvider';
import { assertImplementsStorageContract } from '../types/StorageProvider';

const BLOB_URL = 'https://example.public.blob.vercel-storage.com/gallery/abc-123.jpg';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('contract', () => {
  it('satisfies the StorageProvider contract', () => {
    expect(assertImplementsStorageContract(vercelBlobProvider)).toBe(true);
    expect(vercelBlobProvider.name).toBe('vercel-blob');
  });
});

describe('put', () => {
  it('uploads as a public blob under the keyGen key, no random suffix, sniffed content type', async () => {
    hoisted.put.mockResolvedValue({ url: BLOB_URL });
    const buffer = Buffer.from('fake-image-bytes');

    const stored = await vercelBlobProvider.put(buffer, {
      key: 'gallery/abc-123.jpg',
      mimeType: 'image/jpeg',
    });

    expect(hoisted.put).toHaveBeenCalledWith('gallery/abc-123.jpg', buffer, {
      access: 'public',
      contentType: 'image/jpeg',
      addRandomSuffix: false,
    });
    expect(stored).toEqual({ url: BLOB_URL, key: BLOB_URL, bytes: buffer.length });
  });

  it('returns the blob URL as the management key (providerKey semantics)', async () => {
    hoisted.put.mockResolvedValue({ url: BLOB_URL });

    const stored = await vercelBlobProvider.put(Buffer.from('x'), { key: 'gallery/abc-123.jpg' });

    expect(stored.key).toBe(BLOB_URL);
    expect(stored.key).toBe(stored.url);
  });

  it('requires a key', async () => {
    await expect(vercelBlobProvider.put(Buffer.from('x'), {})).rejects.toThrow(/key is required/);
    expect(hoisted.put).not.toHaveBeenCalled();
  });

  it('propagates SDK failures to the caller (assetService treats put failure as upload failure)', async () => {
    hoisted.put.mockRejectedValue(new Error('blob store unreachable'));

    await expect(
      vercelBlobProvider.put(Buffer.from('x'), { key: 'gallery/abc-123.jpg' })
    ).rejects.toThrow('blob store unreachable');
  });
});

describe('delete', () => {
  it('deletes by the blob URL put() returned', async () => {
    hoisted.del.mockResolvedValue(undefined);

    await vercelBlobProvider.delete(BLOB_URL);

    expect(hoisted.del).toHaveBeenCalledWith(BLOB_URL);
  });

  it('is idempotent the way assetService relies on: the SDK resolving for a missing blob is not an error', async () => {
    hoisted.del.mockResolvedValue(undefined); // @vercel/blob del() resolves even when the blob doesn't exist

    await expect(vercelBlobProvider.delete(BLOB_URL)).resolves.toBeUndefined();
  });

  it('requires a key', async () => {
    await expect(vercelBlobProvider.delete()).rejects.toThrow(/key is required/);
    expect(hoisted.del).not.toHaveBeenCalled();
  });
});

describe('getSignedUrl', () => {
  it('returns the public blob URL unchanged (public blobs, no signing yet)', async () => {
    await expect(vercelBlobProvider.getSignedUrl(BLOB_URL)).resolves.toBe(BLOB_URL);
  });

  it('requires a key', async () => {
    await expect(vercelBlobProvider.getSignedUrl()).rejects.toThrow(/key is required/);
  });
});
