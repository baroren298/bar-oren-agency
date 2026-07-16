/*
 * POST /api/admin/clients/[id]/archive — route-level coverage (Sprint 7B).
 *
 * The security-critical wiring proven here: this route gates on
 * requireOwner (NOT requireOwnerOrEmployee) — an EMPLOYEE session's 403
 * carries the Hebrew owner-only message and clientService is never
 * reached. Service rules themselves live in clientService.test.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  archiveClient: vi.fn(),
}));

vi.mock('@/lib/admin/auth/authorize', () => ({
  requireOwner: hoisted.requireOwner,
}));

vi.mock('@/lib/admin/clientService', () => ({
  clientService: {
    archiveClient: hoisted.archiveClient,
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

describe('POST /api/admin/clients/[id]/archive', () => {
  it('returns 401 when there is no valid session', async () => {
    hoisted.requireOwner.mockRejectedValue(
      Object.assign(new Error('Not authenticated'), { statusCode: 401 })
    );

    const response = await POST(makeRequest(), makeContext('client-1'));

    expect(response.status).toBe(401);
    expect(hoisted.archiveClient).not.toHaveBeenCalled();
  });

  it('returns 403 with the Hebrew owner-only message for an EMPLOYEE session — service never called', async () => {
    hoisted.requireOwner.mockRejectedValue(
      Object.assign(new Error('Forbidden'), { statusCode: 403 })
    );

    const response = await POST(makeRequest(), makeContext('client-1'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe(he.clients.errors.archiveOwnerOnly);
    expect(hoisted.archiveClient).not.toHaveBeenCalled();
  });

  it('archives for an OWNER session and returns the archived client', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER' });
    hoisted.archiveClient.mockResolvedValue({ id: 'client-1', status: 'ARCHIVED' });

    const response = await POST(makeRequest(), makeContext('client-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.client.status).toBe('ARCHIVED');
    const [clientId, ctx] = hoisted.archiveClient.mock.calls[0];
    expect(clientId).toBe('client-1');
    expect(ctx).toMatchObject({ actorId: 'owner-1', actorRole: 'OWNER' });
  });

  it('passes the already-archived Hebrew 409 through untouched', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER' });
    hoisted.archiveClient.mockRejectedValue(
      Object.assign(new Error(he.clients.errors.clientAlreadyArchived), {
        statusCode: 409,
        code: 'CLIENT_ALREADY_ARCHIVED',
      })
    );

    const response = await POST(makeRequest(), makeContext('client-1'));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe(he.clients.errors.clientAlreadyArchived);
  });
});
