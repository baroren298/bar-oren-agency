/*
 * POST /api/admin/brands/[id]/archive — route-level coverage (Sprint 7B,
 * Final Authorization Coverage Verification).
 *
 * Mirrors app/api/admin/clients/[id]/archive/route.test.js exactly: this
 * route gates on requireOwner (NOT requireOwnerOrEmployee) — an EMPLOYEE
 * session's 403 carries the Hebrew owner-only message and
 * clientService.archiveBrand is never reached. Service-layer rules
 * (including repository non-invocation) live in clientService.test.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  archiveBrand: vi.fn(),
}));

vi.mock('@/lib/admin/auth/authorize', () => ({
  requireOwner: hoisted.requireOwner,
}));

vi.mock('@/lib/admin/clientService', () => ({
  clientService: {
    archiveBrand: hoisted.archiveBrand,
  },
}));

import { POST } from './route';
import { he } from '@/lib/admin/i18n/he';

function makeRequest() {
  return { headers: { get: () => null } };
}

function makeContext(id) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/admin/brands/[id]/archive', () => {
  it('returns 401 when there is no valid session', async () => {
    hoisted.requireOwner.mockRejectedValue(
      Object.assign(new Error('Not authenticated'), { statusCode: 401 })
    );

    const response = await POST(makeRequest(), makeContext('brand-1'));

    expect(response.status).toBe(401);
    expect(hoisted.archiveBrand).not.toHaveBeenCalled();
  });

  it('returns 403 with the Hebrew owner-only message for an EMPLOYEE session — service never called', async () => {
    hoisted.requireOwner.mockRejectedValue(
      Object.assign(new Error('Forbidden'), { statusCode: 403 })
    );

    const response = await POST(makeRequest(), makeContext('brand-1'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe(he.clients.errors.archiveOwnerOnly);
    expect(hoisted.archiveBrand).not.toHaveBeenCalled();
  });

  it('archives for an OWNER session and returns the archived brand', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER' });
    hoisted.archiveBrand.mockResolvedValue({ id: 'brand-1', status: 'ARCHIVED' });

    const response = await POST(makeRequest(), makeContext('brand-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.brand.status).toBe('ARCHIVED');
    const [brandId, ctx] = hoisted.archiveBrand.mock.calls[0];
    expect(brandId).toBe('brand-1');
    expect(ctx).toMatchObject({ actorId: 'owner-1', actorRole: 'OWNER' });
    expect(ctx.correlationId).toBeTruthy();
  });

  it('passes the already-archived Hebrew 409 through untouched', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER' });
    hoisted.archiveBrand.mockRejectedValue(
      Object.assign(new Error(he.clients.errors.brandAlreadyArchived), {
        statusCode: 409,
        code: 'BRAND_ALREADY_ARCHIVED',
      })
    );

    const response = await POST(makeRequest(), makeContext('brand-1'));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe(he.clients.errors.brandAlreadyArchived);
  });
});
