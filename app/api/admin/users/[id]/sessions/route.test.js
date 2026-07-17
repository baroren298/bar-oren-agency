/*
 * GET /api/admin/users/[id]/sessions — route-level coverage (Sprint 3b).
 *
 * requireOwner and sessionManagementService are both mocked — this file
 * verifies the route's own job: the auth gate, the missing-id 400, and
 * mapping whatever sessionManagementService.listSessions throws/returns to
 * the right HTTP status/body. sessionManagementService.test.js owns the
 * service's own policy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  listSessions: vi.fn(),
}));

vi.mock('@/lib/admin/auth/authorize', () => ({
  requireOwner: hoisted.requireOwner,
}));

vi.mock('@/lib/admin/sessionManagementService', () => ({
  sessionManagementService: {
    listSessions: hoisted.listSessions,
  },
}));

import { GET } from './route';

function makeParams(id) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/admin/users/[id]/sessions', () => {
  it('returns 401 when there is no valid session', async () => {
    hoisted.requireOwner.mockRejectedValue(Object.assign(new Error('Not authenticated'), { statusCode: 401 }));

    const response = await GET({}, makeParams('user-1'));

    expect(response.status).toBe(401);
    expect(hoisted.listSessions).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-Owner session', async () => {
    hoisted.requireOwner.mockRejectedValue(Object.assign(new Error('Forbidden'), { statusCode: 403 }));

    const response = await GET({}, makeParams('user-1'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Only the Owner may manage users.');
  });

  it('returns 400 when the id param is missing', async () => {
    hoisted.requireOwner.mockResolvedValue({ role: 'OWNER', sid: 'owner-sid' });

    const response = await GET({}, makeParams(undefined));

    expect(response.status).toBe(400);
    expect(hoisted.listSessions).not.toHaveBeenCalled();
  });

  it('returns 404 when the service reports the target user does not exist', async () => {
    hoisted.requireOwner.mockResolvedValue({ role: 'OWNER', sid: 'owner-sid' });
    hoisted.listSessions.mockRejectedValue(Object.assign(new Error('User not found.'), { statusCode: 404, code: 'USER_NOT_FOUND' }));

    const response = await GET({}, makeParams('missing-user'));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe('USER_NOT_FOUND');
  });

  it('passes the acting Owner role and sid to the service and returns its sessions list', async () => {
    hoisted.requireOwner.mockResolvedValue({ role: 'OWNER', sid: 'owner-sid' });
    hoisted.listSessions.mockResolvedValue([
      { id: 'owner-sid', createdAt: '2026-07-16T00:00:00.000Z', expiresAt: '2026-07-16T08:00:00.000Z', isCurrent: true },
    ]);

    const response = await GET({}, makeParams('user-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(hoisted.listSessions).toHaveBeenCalledWith('user-1', { actorRole: 'OWNER', actorSid: 'owner-sid' });
    expect(body).toEqual({
      sessions: [
        { id: 'owner-sid', createdAt: '2026-07-16T00:00:00.000Z', expiresAt: '2026-07-16T08:00:00.000Z', isCurrent: true },
      ],
    });
  });

  it('returns a generic 500 for an unexpected service error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    hoisted.requireOwner.mockResolvedValue({ role: 'OWNER', sid: 'owner-sid' });
    hoisted.listSessions.mockRejectedValue(new Error('db exploded'));

    const response = await GET({}, makeParams('user-1'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to load sessions.');
    consoleError.mockRestore();
  });
});
