/*
 * POST /api/admin/users/[id]/sessions/[sessionId]/revoke — route-level
 * coverage (Sprint 3b).
 *
 * requireOwner and sessionManagementService are both mocked — verifies the
 * route's own job: the auth gate, the missing-param 400, correlationId
 * threading, and mapping whatever sessionManagementService.revokeSession
 * throws/returns to the right HTTP status/body (including the 409
 * self-revoke case). sessionManagementService.test.js owns the service's
 * own policy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  revokeSession: vi.fn(),
}));

vi.mock('@/lib/admin/auth/authorize', () => ({
  requireOwner: hoisted.requireOwner,
}));

vi.mock('@/lib/admin/sessionManagementService', () => ({
  sessionManagementService: {
    revokeSession: hoisted.revokeSession,
  },
}));

import { POST } from './route';

function makeRequest() {
  return { headers: { get: () => null } };
}

function makeParams(id, sessionId) {
  return { params: Promise.resolve({ id, sessionId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/admin/users/[id]/sessions/[sessionId]/revoke', () => {
  it('returns 401 when there is no valid session', async () => {
    hoisted.requireOwner.mockRejectedValue(Object.assign(new Error('Not authenticated'), { statusCode: 401 }));

    const response = await POST(makeRequest(), makeParams('user-1', 'sid-1'));

    expect(response.status).toBe(401);
    expect(hoisted.revokeSession).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-Owner session', async () => {
    hoisted.requireOwner.mockRejectedValue(Object.assign(new Error('Forbidden'), { statusCode: 403 }));

    const response = await POST(makeRequest(), makeParams('user-1', 'sid-1'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Only the Owner may manage users.');
  });

  it('returns 400 when id or sessionId is missing', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER', sid: 'owner-sid' });

    const response = await POST(makeRequest(), makeParams('user-1', undefined));

    expect(response.status).toBe(400);
    expect(hoisted.revokeSession).not.toHaveBeenCalled();
  });

  it('returns 404 SESSION_NOT_FOUND when the service reports a scoped miss', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER', sid: 'owner-sid' });
    hoisted.revokeSession.mockRejectedValue(
      Object.assign(new Error('Session not found.'), { statusCode: 404, code: 'SESSION_NOT_FOUND' })
    );

    const response = await POST(makeRequest(), makeParams('user-1', 'unknown-sid'));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe('SESSION_NOT_FOUND');
  });

  it('returns 409 CANNOT_REVOKE_CURRENT_SESSION when the service blocks self-revocation', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER', sid: 'owner-sid' });
    hoisted.revokeSession.mockRejectedValue(
      Object.assign(new Error('Use logout to end your current session.'), {
        statusCode: 409,
        code: 'CANNOT_REVOKE_CURRENT_SESSION',
      })
    );

    const response = await POST(makeRequest(), makeParams('owner-1', 'owner-sid'));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('CANNOT_REVOKE_CURRENT_SESSION');
  });

  it('threads actor identity + a correlationId to the service and returns { revoked: 1 } on success', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER', sid: 'owner-sid' });
    hoisted.revokeSession.mockResolvedValue({ revoked: 1 });

    const response = await POST(makeRequest(), makeParams('user-1', 'sid-2'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ revoked: 1 });
    expect(hoisted.revokeSession).toHaveBeenCalledWith(
      'user-1',
      'sid-2',
      expect.objectContaining({
        actorId: 'owner-1',
        actorRole: 'OWNER',
        actorSid: 'owner-sid',
        correlationId: expect.any(String),
      })
    );
  });

  it('returns { revoked: 0 } as a 200 for an idempotent already-dead session', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER', sid: 'owner-sid' });
    hoisted.revokeSession.mockResolvedValue({ revoked: 0 });

    const response = await POST(makeRequest(), makeParams('user-1', 'sid-2'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ revoked: 0 });
  });

  it('returns a generic 500 for an unexpected service error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER', sid: 'owner-sid' });
    hoisted.revokeSession.mockRejectedValue(new Error('db exploded'));

    const response = await POST(makeRequest(), makeParams('user-1', 'sid-2'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to revoke session.');
    consoleError.mockRestore();
  });
});
