/*
 * PATCH /api/admin/users/[id] — route-level coverage (Sprint 3: Users UI).
 *
 * requireOwner and userService are both mocked — verifies the route's own
 * job: the auth gate, rejecting a `role` key outright, requiring at least
 * one of displayName/isActive, and mapping userService's thrown errors
 * (self-disable / only-owner / not-found) to the right HTTP status.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  updateDisplayName: vi.fn(),
  setActive: vi.fn(),
}));

vi.mock('@/lib/admin/auth/authorize', () => ({
  requireOwner: hoisted.requireOwner,
}));

vi.mock('@/lib/admin/userService', () => ({
  userService: {
    updateDisplayName: hoisted.updateDisplayName,
    setActive: hoisted.setActive,
  },
}));

import { PATCH } from './route';

function makeRequest(body) {
  return { json: async () => body };
}

function makeParams(id) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PATCH /api/admin/users/[id]', () => {
  it('returns 401 when there is no valid session', async () => {
    hoisted.requireOwner.mockRejectedValue(Object.assign(new Error('Not authenticated'), { statusCode: 401 }));

    const response = await PATCH(makeRequest({ displayName: 'X' }), makeParams('user-1'));

    expect(response.status).toBe(401);
    expect(hoisted.updateDisplayName).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-Owner session', async () => {
    hoisted.requireOwner.mockRejectedValue(Object.assign(new Error('Forbidden'), { statusCode: 403 }));

    const response = await PATCH(makeRequest({ displayName: 'X' }), makeParams('user-1'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Only the Owner may manage users.');
  });

  it('rejects a body containing a `role` key with 400, before calling userService', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER' });

    const response = await PATCH(makeRequest({ role: 'OWNER' }), makeParams('user-1'));

    expect(response.status).toBe(400);
    expect(hoisted.updateDisplayName).not.toHaveBeenCalled();
    expect(hoisted.setActive).not.toHaveBeenCalled();
  });

  it('returns 400 when neither displayName nor isActive is present', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER' });

    const response = await PATCH(makeRequest({}), makeParams('user-1'));

    expect(response.status).toBe(400);
    expect(hoisted.updateDisplayName).not.toHaveBeenCalled();
    expect(hoisted.setActive).not.toHaveBeenCalled();
  });

  it('updates displayName and returns the updated user', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER' });
    hoisted.updateDisplayName.mockResolvedValue({ id: 'user-1', displayName: 'New Name' });

    const response = await PATCH(makeRequest({ displayName: 'New Name' }), makeParams('user-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ user: { id: 'user-1', displayName: 'New Name' } });
    expect(hoisted.updateDisplayName).toHaveBeenCalledWith('user-1', 'New Name', { actorRole: 'OWNER' });
  });

  it('toggles isActive and forwards actorId for the self/only-owner checks', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER' });
    hoisted.setActive.mockResolvedValue({ id: 'employee-1', isActive: false });

    const response = await PATCH(makeRequest({ isActive: false }), makeParams('employee-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ user: { id: 'employee-1', isActive: false } });
    expect(hoisted.setActive).toHaveBeenCalledWith('employee-1', false, {
      actorId: 'owner-1',
      actorRole: 'OWNER',
    });
  });

  it('maps CANNOT_DISABLE_SELF to a 409 with the service error message', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER' });
    hoisted.setActive.mockRejectedValue(
      Object.assign(new Error('You cannot disable your own account.'), {
        statusCode: 409,
        code: 'CANNOT_DISABLE_SELF',
      })
    );

    const response = await PATCH(makeRequest({ isActive: false }), makeParams('owner-1'));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('CANNOT_DISABLE_SELF');
  });

  it('maps CANNOT_DISABLE_ONLY_OWNER to a 409 with the service error message', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER' });
    hoisted.setActive.mockRejectedValue(
      Object.assign(new Error('You cannot disable the only Owner account.'), {
        statusCode: 409,
        code: 'CANNOT_DISABLE_ONLY_OWNER',
      })
    );

    const response = await PATCH(makeRequest({ isActive: false }), makeParams('owner-2'));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('CANNOT_DISABLE_ONLY_OWNER');
  });

  it('returns 404 when userService reports the user does not exist', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER' });
    hoisted.updateDisplayName.mockRejectedValue(Object.assign(new Error('User not found.'), { statusCode: 404 }));

    const response = await PATCH(makeRequest({ displayName: 'X' }), makeParams('missing-user'));

    expect(response.status).toBe(404);
  });
});
