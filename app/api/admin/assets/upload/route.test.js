/*
 * POST /api/admin/assets/upload — route-level coverage (Production Upload
 * Enablement sprint). Same pattern as app/api/admin/users/route.test.js:
 * every dependency is mocked; this verifies wiring only — auth gate,
 * availability gate, rate-limit gate (and their ORDER), multipart parsing,
 * and status-code mapping. assetService's own logic is assetService.test.js's
 * job.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  requireOwnerOrEmployee: vi.fn(),
  consumeUploadSlot: vi.fn(),
  uploadAsset: vi.fn(),
  isUploadAvailable: vi.fn(),
}));

vi.mock('@/lib/admin/auth/authorize', () => ({
  requireOwnerOrEmployee: hoisted.requireOwnerOrEmployee,
}));

vi.mock('@/lib/admin/auth/uploadRateLimit', () => ({
  consumeUploadSlot: hoisted.consumeUploadSlot,
}));

vi.mock('@/lib/admin/engine/assetService', () => ({
  assetService: { uploadAsset: hoisted.uploadAsset },
}));

vi.mock('@/lib/storage/availability', () => ({
  isUploadAvailable: hoisted.isUploadAvailable,
}));

import { POST } from './route';
import { he } from '@/lib/admin/i18n/he';

const FILE_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

function makeFile({ name = 'photo.jpg', bytes = FILE_BYTES } = {}) {
  return {
    name,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

function makeRequest(entries) {
  return {
    formData: async () => ({
      get: (field) => (field in entries ? entries[field] : null),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.requireOwnerOrEmployee.mockResolvedValue({ userId: 'user-1', role: 'EMPLOYEE' });
  hoisted.isUploadAvailable.mockReturnValue(true);
  hoisted.consumeUploadSlot.mockReturnValue(true);
  hoisted.uploadAsset.mockResolvedValue({ id: 'asset-1', blobUrl: 'https://blobs.example/x.jpg' });
});

describe('auth gate', () => {
  it('returns 401 when there is no valid session', async () => {
    hoisted.requireOwnerOrEmployee.mockRejectedValue(
      Object.assign(new Error('Not authenticated'), { statusCode: 401 })
    );

    const response = await POST(makeRequest({}));

    expect(response.status).toBe(401);
    expect(hoisted.uploadAsset).not.toHaveBeenCalled();
  });

  it('returns 403 for a valid session whose role is not allowed', async () => {
    hoisted.requireOwnerOrEmployee.mockRejectedValue(
      Object.assign(new Error('Forbidden'), { statusCode: 403 })
    );

    const response = await POST(makeRequest({}));

    expect(response.status).toBe(403);
    expect(hoisted.uploadAsset).not.toHaveBeenCalled();
  });
});

describe('availability gate', () => {
  it('returns 503 UPLOADS_DISABLED when no production-capable provider is configured', async () => {
    hoisted.isUploadAvailable.mockReturnValue(false);

    const response = await POST(makeRequest({ file: makeFile(), purpose: 'gallery' }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.code).toBe('UPLOADS_DISABLED');
    expect(hoisted.uploadAsset).not.toHaveBeenCalled();
    // Order matters: an environment that can't upload must not consume
    // rate-limit slots.
    expect(hoisted.consumeUploadSlot).not.toHaveBeenCalled();
  });
});

describe('rate-limit gate', () => {
  it('returns 429 RATE_LIMITED when the user exhausted the window', async () => {
    hoisted.consumeUploadSlot.mockReturnValue(false);

    const response = await POST(makeRequest({ file: makeFile(), purpose: 'gallery' }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe('RATE_LIMITED');
    expect(body.error).toBe(he.gallery.errors.uploadRateLimited);
    expect(hoisted.uploadAsset).not.toHaveBeenCalled();
  });

  it('is keyed by the authenticated user id, after auth', async () => {
    await POST(makeRequest({ file: makeFile(), purpose: 'gallery' }));

    expect(hoisted.consumeUploadSlot).toHaveBeenCalledWith('user-1');
  });
});

describe('request validation', () => {
  it('returns 400 for an unparsable multipart body', async () => {
    const response = await POST({
      formData: async () => {
        throw new Error('not multipart');
      },
    });

    expect(response.status).toBe(400);
    expect(hoisted.uploadAsset).not.toHaveBeenCalled();
  });

  it('returns 400 when the file field is missing or a plain string', async () => {
    expect((await POST(makeRequest({ purpose: 'gallery' }))).status).toBe(400);
    expect((await POST(makeRequest({ file: 'not-a-file', purpose: 'gallery' }))).status).toBe(400);
    expect(hoisted.uploadAsset).not.toHaveBeenCalled();
  });

  it('returns 400 when purpose is missing', async () => {
    const response = await POST(makeRequest({ file: makeFile() }));

    expect(response.status).toBe(400);
    expect(hoisted.uploadAsset).not.toHaveBeenCalled();
  });

  it('returns 400 when assetService reports an unknown purpose', async () => {
    hoisted.uploadAsset.mockRejectedValue(
      Object.assign(new Error('unknown purpose'), { code: 'UNKNOWN_PURPOSE' })
    );

    const response = await POST(makeRequest({ file: makeFile(), purpose: 'nonsense' }));

    expect(response.status).toBe(400);
  });
});

describe('content validation mapping', () => {
  it.each([
    ['empty file', () => he.gallery.errors.uploadEmptyFile],
    ['oversized file', () => he.gallery.errors.uploadFileTooLarge],
    ['unsupported/spoofed mime type', () => he.gallery.errors.uploadUnsupportedType],
  ])('maps a rejected %s to 422', async (_label, message) => {
    hoisted.uploadAsset.mockRejectedValue(new Error(message()));

    const response = await POST(makeRequest({ file: makeFile(), purpose: 'gallery' }));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toBe(message());
  });

  it('maps unexpected service failures to 500 without leaking the internal message', async () => {
    hoisted.uploadAsset.mockRejectedValue(new Error('ECONNREFUSED db:5432'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST(makeRequest({ file: makeFile(), purpose: 'gallery' }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe(he.gallery.errors.serverError);
    expect(body.error).not.toContain('ECONNREFUSED');
    consoleError.mockRestore();
  });
});

describe('happy path', () => {
  it('returns 201 with the created asset and forwards buffer/purpose/filename/user to the service', async () => {
    const response = await POST(makeRequest({ file: makeFile({ name: 'headshot.jpg' }), purpose: 'gallery' }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.asset.id).toBe('asset-1');

    expect(hoisted.uploadAsset).toHaveBeenCalledTimes(1);
    const args = hoisted.uploadAsset.mock.calls[0][0];
    expect(Buffer.isBuffer(args.buffer)).toBe(true);
    expect(Buffer.compare(args.buffer, FILE_BYTES)).toBe(0);
    expect(args.purpose).toBe('gallery');
    expect(args.originalFilename).toBe('headshot.jpg');
    expect(args.uploadedById).toBe('user-1');
  });
});
