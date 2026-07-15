/*
 * POST /api/admin/users/[id]/password — route-level coverage (Sprint 3.1:
 * User Details Page).
 *
 * requireOwner and userService are both mocked — verifies the route's own
 * job: the auth gate, request-body parsing, and mapping whatever
 * userService.resetPassword throws/returns to the right HTTP status/body.
 * userService.test.js is responsible for resetPassword's own validation
 * and hashing logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock('@/lib/admin/auth/authorize', () => ({
  requireOwner: hoisted.requireOwner,
}));

vi.mock('@/lib/admin/userService', () => ({
  userService: {
    resetPassword: hoisted.resetPassword,
  },
}));

import { POST } from './route';

function makeRequest(body) {
  return { json: async () => body };
}

function makeParams(id) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/admin/users/[id]/password', () => {
  it('returns 401 when there is no valid session', async () => {
    hoisted.requireOwner.mockRejectedValue(Object.assign(new Error('Not authenticated'), { statusCode: 401 }));

    const response = await POST(makeRequest({ temporaryPassword: 'temp12345' }), makeParams('user-1'));

    expect(response.status).toBe(401);
    expect(hoisted.resetPassword).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-Owner session', async () => {
    hoisted.requireOwner.mockRejectedValue(Object.assign(new Error('Forbidden'), { statusCode: 403 }));

    const response = await POST(makeRequest({ temporaryPassword: 'temp12345' }), makeParams('user-1'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Only the Owner may manage users.');
  });

  it('returns 400 for an unparsable request body', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER' });

    const response = await POST(
      {
        json: async () => {
          throw new Error('bad json');
        },
      },
      makeParams('user-1')
    );

    expect(response.status).toBe(400);
    expect(hoisted.resetPassword).not.toHaveBeenCalled();
  });

  it('returns 400 with fieldErrors when userService.resetPassword rejects validation', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER' });
    hoisted.resetPassword.mockRejectedValue(
      Object.assign(new Error('Please fix the highlighted fields.'), {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        fieldErrors: { temporaryPassword: 'Temporary password must be at least 8 characters.' },
      })
    );

    const response = await POST(makeRequest({ temporaryPassword: 'short' }), makeParams('user-1'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fieldErrors).toEqual({ temporaryPassword: 'Temporary password must be at least 8 characters.' });
  });

  it('returns 404 when userService reports the user does not exist', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER' });
    hoisted.resetPassword.mockRejectedValue(Object.assign(new Error('User not found.'), { statusCode: 404 }));

    const response = await POST(makeRequest({ temporaryPassword: 'temp12345' }), makeParams('missing-user'));

    expect(response.status).toBe(404);
  });

  it('resets the password and returns the safe user on success', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER' });
    hoisted.resetPassword.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });

    const response = await POST(makeRequest({ temporaryPassword: 'temp12345' }), makeParams('user-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ user: { id: 'user-1', email: 'user@example.com' } });
    expect(body.user.passwordHash).toBeUndefined();
    // Sprint 2b — actor identity, per-request correlationId, and
    // request-only metadata are threaded through for the UserPasswordReset
    // event (makeRequest has no headers, so ip/userAgent fall back).
    expect(hoisted.resetPassword).toHaveBeenCalledWith(
      'user-1',
      'temp12345',
      expect.objectContaining({
        actorId: 'owner-1',
        actorRole: 'OWNER',
        correlationId: expect.any(String),
        requestMetadata: { ipAddress: 'unknown', userAgent: null },
      })
    );
  });
});
