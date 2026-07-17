/*
 * lib/admin/auth/sessionService.js — Sprint 3a (Session Security
 * Foundation). The full per-request validity predicate, with the
 * repository mocked (no test may touch a real database):
 *
 *   S3 — no Session row for the sid            → null
 *   S4 — Session revoked                        → null
 *   S5 — Session expired in the DB (independent of the JWT exp) → null
 *   S6 — user deleted or isActive:false         → null
 *   S7 — role comes from the DB user row, never any JWT claim
 *   plus: TTL alignment with SESSION_MAX_AGE_SECONDS, fail-closed on DB
 *   errors, and log hygiene (the fail-closed log line carries no sid).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.SESSION_SECRET = 'vitest-only-session-secret-never-a-real-value';

const hoisted = vi.hoisted(() => ({
  create: vi.fn(),
  getWithUser: vi.fn(),
  revoke: vi.fn(),
  revokeAllForUser: vi.fn(),
}));

vi.mock('../repository/sessionRepository', () => ({
  sessionRepository: {
    create: hoisted.create,
    getWithUser: hoisted.getWithUser,
    revoke: hoisted.revoke,
    revokeAllForUser: hoisted.revokeAllForUser,
  },
}));

import { sessionService } from './sessionService';
import { SESSION_MAX_AGE_SECONDS } from './session';

const SID = '11111111-2222-4333-8444-555555555555';

function liveSession(overrides = {}, userOverrides = {}) {
  return {
    id: SID,
    userId: 'user-1',
    createdAt: new Date(Date.now() - 1000),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    revokedAt: null,
    user: {
      id: 'user-1',
      role: 'EMPLOYEE',
      isActive: true,
      ...userOverrides,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createSession — TTL alignment', () => {
  it('persists expiresAt derived from the same SESSION_MAX_AGE_SECONDS as the JWT exp', async () => {
    hoisted.create.mockResolvedValue({ id: SID });
    const before = Date.now();
    await sessionService.createSession({ sid: SID, userId: 'user-1' });
    const after = Date.now();

    expect(hoisted.create).toHaveBeenCalledTimes(1);
    const arg = hoisted.create.mock.calls[0][0];
    expect(arg.id).toBe(SID);
    expect(arg.userId).toBe('user-1');
    const expectedMin = before + SESSION_MAX_AGE_SECONDS * 1000;
    const expectedMax = after + SESSION_MAX_AGE_SECONDS * 1000;
    expect(arg.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(arg.expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);
  });

  it('propagates a repository failure (login route turns this into a 500, no cookie)', async () => {
    hoisted.create.mockRejectedValue(new Error('insert failed'));
    await expect(sessionService.createSession({ sid: SID, userId: 'user-1' })).rejects.toThrow('insert failed');
  });
});

describe('getValidSessionUser — the validity predicate', () => {
  it('S3: returns null when no Session row exists for the sid', async () => {
    hoisted.getWithUser.mockResolvedValue(null);
    expect(await sessionService.getValidSessionUser(SID)).toBeNull();
  });

  it('S4: returns null when the Session is revoked', async () => {
    hoisted.getWithUser.mockResolvedValue(liveSession({ revokedAt: new Date() }));
    expect(await sessionService.getValidSessionUser(SID)).toBeNull();
  });

  it('S5: returns null when the DB expiresAt is past — independent of any JWT exp', async () => {
    hoisted.getWithUser.mockResolvedValue(liveSession({ expiresAt: new Date(Date.now() - 1000) }));
    expect(await sessionService.getValidSessionUser(SID)).toBeNull();
  });

  it('S6: returns null when the user row no longer exists', async () => {
    hoisted.getWithUser.mockResolvedValue(liveSession({ user: null }));
    expect(await sessionService.getValidSessionUser(SID)).toBeNull();
  });

  it('S6: returns null when the user is deactivated', async () => {
    hoisted.getWithUser.mockResolvedValue(liveSession({}, { isActive: false }));
    expect(await sessionService.getValidSessionUser(SID)).toBeNull();
  });

  it('S7: the returned role is the CURRENT DB role — there is no token input at all', async () => {
    // The predicate takes only a sid: by construction no JWT role claim can
    // reach it. Assert the role is read off the fetched user row.
    hoisted.getWithUser.mockResolvedValue(liveSession({}, { role: 'EMPLOYEE' }));
    expect(await sessionService.getValidSessionUser(SID)).toEqual({
      userId: 'user-1',
      role: 'EMPLOYEE',
      sid: SID,
    });

    hoisted.getWithUser.mockResolvedValue(liveSession({}, { role: 'OWNER' }));
    expect((await sessionService.getValidSessionUser(SID)).role).toBe('OWNER');
  });

  it('returns null for a missing/malformed sid without touching the repository', async () => {
    expect(await sessionService.getValidSessionUser(undefined)).toBeNull();
    expect(await sessionService.getValidSessionUser('')).toBeNull();
    expect(await sessionService.getValidSessionUser(42)).toBeNull();
    expect(hoisted.getWithUser).not.toHaveBeenCalled();
  });

  it('fails closed on a DB error — null, and the log line leaks no sid (S15)', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    hoisted.getWithUser.mockRejectedValue(new Error('connection lost'));

    expect(await sessionService.getValidSessionUser(SID)).toBeNull();

    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).not.toContain(SID);
    expect(logged).not.toContain('connection lost'); // no internal detail either
    consoleError.mockRestore();
  });
});

describe('revokeSession — idempotency at the service layer', () => {
  it('forwards to the repository revoke (updateMany, revokedAt: null filter — 0 rows is a no-op, not an error)', async () => {
    hoisted.revoke.mockResolvedValue(0);
    await expect(sessionService.revokeSession(SID)).resolves.toBe(0);
    expect(hoisted.revoke).toHaveBeenCalledWith(SID);
  });
});
