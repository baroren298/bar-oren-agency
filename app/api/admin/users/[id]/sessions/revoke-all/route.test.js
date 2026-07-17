/*
 * POST /api/admin/users/[id]/sessions/revoke-all — route-level coverage
 * (Sprint 3b).
 *
 * requireOwner and sessionManagementService are both mocked — verifies the
 * route's own job: the auth gate, the missing-id 400, correlationId
 * threading, and mapping whatever sessionManagementService.revokeAllSessions
 * returns to the right HTTP status/body. sessionManagementService.test.js
 * owns the service's own policy (self-sparing behavior, audit emission).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  revokeAllSessions: vi.fn(),
}));

vi.mock('@/lib/admin/auth/authorize', () => ({
  requireOwner: hoisted.requireOwner,
}));

vi.mock('@/lib/admin/sessionManagementService', () => ({
  sessionManagementService: {
    revokeAllSessions: hoisted.revokeAllSessions,
  },
}));

import { POST } from './route';

function makeRequest() {
  return { headers: { get: () => null } };
}

function makeParams(id) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/admin/users/[id]/sessions/revoke-all', () => {
  it('returns 401 when there is no valid session', async () => {
    hoisted.requireOwner.mockRejectedValue(Object.assign(new Error('Not authenticated'), { statusCode: 401 }));

    const response = await POST(makeRequest(), makeParams('user-1'));

    expect(response.status).toBe(401);
    expect(hoisted.revokeAllSessions).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-Owner session', async () => {
    hoisted.requireOwner.mockRejectedValue(Object.assign(new Error('Forbidden'), { statusCode: 403 }));

    const response = await POST(makeRequest(), makeParams('user-1'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Only the Owner may manage users.');
  });

  it('returns 400 when the id param is missing', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER', sid: 'owner-sid' });

    const response = await POST(makeRequest(), makeParams(undefined));

    expect(response.status).toBe(400);
    expect(hoisted.revokeAllSessions).not.toHaveBeenCalled();
  });

  it('returns 404 when the service reports the target user does not exist', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER', sid: 'owner-sid' });
    hoisted.revokeAllSessions.mockRejectedValue(
      Object.assign(new Error('User not found.'), { statusCode: 404, code: 'USER_NOT_FOUND' })
    );

    const response = await POST(makeRequest(), makeParams('missing-user'));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe('USER_NOT_FOUND');
  });

  it('threads actor identity + a correlationId to the service and returns { revoked: n }', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER', sid: 'owner-sid' });
    hoisted.revokeAllSessions.mockResolvedValue({ revoked: 2 });

    const response = await POST(makeRequest(), makeParams('user-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ revoked: 2 });
    expect(hoisted.revokeAllSessions).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        actorId: 'owner-1',
        actorRole: 'OWNER',
        actorSid: 'owner-sid',
        correlationId: expect.any(String),
      })
    );
  });

  it('returns { revoked: 0 } as a 200 (idempotent intent-audited outcome)', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER', sid: 'owner-sid' });
    hoisted.revokeAllSessions.mockResolvedValue({ revoked: 0 });

    const response = await POST(makeRequest(), makeParams('user-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ revoked: 0 });
  });

  it('does not read a request body (no fields to parse for this action)', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER', sid: 'owner-sid' });
    hoisted.revokeAllSessions.mockResolvedValue({ revoked: 1 });
    const request = makeRequest();
    request.json = () => {
      throw new Error('json() should never be called by this route');
    };

    const response = await POST(request, makeParams('user-1'));
    expect(response.status).toBe(200);
  });

  it('returns a generic 500 for an unexpected service error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER', sid: 'owner-sid' });
    hoisted.revokeAllSessions.mockRejectedValue(new Error('db exploded'));

    const response = await POST(makeRequest(), makeParams('user-1'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to revoke sessions.');
    consoleError.mockRestore();
  });
});
