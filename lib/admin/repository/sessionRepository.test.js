/*
 * sessionRepository — unit tests for the Sprint 3b (Session Management API)
 * additions: listActiveForUser, getForUser, revokeForUser,
 * revokeAllForUserExcept. Prisma is mocked (no test may touch a real
 * database) — this file verifies the WHERE clauses/ordering/cap this
 * repository builds, which is where the IDOR guarantee and the
 * active-vs-expired distinction actually live (plan §1.4/§5). The 3a
 * methods (create/getWithUser/revoke/revokeAllForUser) already have
 * coverage via lib/admin/auth/sessionService.test.js and
 * userRepository.sessions.test.js and are not re-proven here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock('@/lib/admin/db', () => ({
  prisma: {
    session: {
      findMany: hoisted.findMany,
      findFirst: hoisted.findFirst,
      updateMany: hoisted.updateMany,
    },
  },
}));

import { sessionRepository, MAX_ACTIVE_SESSIONS_LISTED } from './sessionRepository';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sessionRepository.listActiveForUser', () => {
  it('returns [] without querying when userId is missing', async () => {
    expect(await sessionRepository.listActiveForUser(undefined)).toEqual([]);
    expect(hoisted.findMany).not.toHaveBeenCalled();
  });

  it('queries active (not revoked, not expired) rows for the user, newest first, capped', async () => {
    hoisted.findMany.mockResolvedValue([{ id: 'sid-1' }]);
    const now = new Date('2026-07-16T00:00:00.000Z');

    const result = await sessionRepository.listActiveForUser('user-1', now);

    expect(hoisted.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      take: MAX_ACTIVE_SESSIONS_LISTED,
    });
    expect(result).toEqual([{ id: 'sid-1' }]);
  });
});

describe('sessionRepository.getForUser', () => {
  it('returns null without querying when either id is missing', async () => {
    expect(await sessionRepository.getForUser(null, 'user-1')).toBeNull();
    expect(await sessionRepository.getForUser('sid-1', null)).toBeNull();
    expect(hoisted.findFirst).not.toHaveBeenCalled();
  });

  it('scopes the read to BOTH id and userId (IDOR guard primitive)', async () => {
    hoisted.findFirst.mockResolvedValue({ id: 'sid-1', userId: 'user-1' });

    const result = await sessionRepository.getForUser('sid-1', 'user-1');

    expect(hoisted.findFirst).toHaveBeenCalledWith({ where: { id: 'sid-1', userId: 'user-1' } });
    expect(result).toEqual({ id: 'sid-1', userId: 'user-1' });
  });

  it('finds a row regardless of revoked/expired state (service decides idempotent-vs-404)', async () => {
    hoisted.findFirst.mockResolvedValue({ id: 'sid-1', userId: 'user-1', revokedAt: new Date() });
    const result = await sessionRepository.getForUser('sid-1', 'user-1');
    expect(result.revokedAt).toBeInstanceOf(Date);
  });
});

describe('sessionRepository.revokeForUser', () => {
  it('returns 0 without writing when either id is missing', async () => {
    expect(await sessionRepository.revokeForUser(null, 'user-1')).toBe(0);
    expect(await sessionRepository.revokeForUser('sid-1', null)).toBe(0);
    expect(hoisted.updateMany).not.toHaveBeenCalled();
  });

  it('updates only the row matching BOTH ids, still active and unexpired, and returns the count', async () => {
    hoisted.updateMany.mockResolvedValue({ count: 1 });
    const when = new Date('2026-07-16T00:00:00.000Z');

    const result = await sessionRepository.revokeForUser('sid-1', 'user-1', when);

    expect(hoisted.updateMany).toHaveBeenCalledWith({
      where: { id: 'sid-1', userId: 'user-1', revokedAt: null, expiresAt: { gt: when } },
      data: { revokedAt: when },
    });
    expect(result).toBe(1);
  });

  it('is idempotent — a second revoke of the same session returns 0, never throws', async () => {
    hoisted.updateMany.mockResolvedValue({ count: 0 });
    const result = await sessionRepository.revokeForUser('sid-1', 'user-1');
    expect(result).toBe(0);
  });
});

describe('sessionRepository.revokeAllForUserExcept', () => {
  it('returns 0 without writing when userId is missing', async () => {
    expect(await sessionRepository.revokeAllForUserExcept(null, 'sid-1')).toBe(0);
    expect(hoisted.updateMany).not.toHaveBeenCalled();
  });

  it('revokes every active session for the user when exceptSid is null (non-self target)', async () => {
    hoisted.updateMany.mockResolvedValue({ count: 3 });
    const when = new Date('2026-07-16T00:00:00.000Z');

    const result = await sessionRepository.revokeAllForUserExcept('user-1', null, when);

    expect(hoisted.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null, expiresAt: { gt: when } },
      data: { revokedAt: when },
    });
    expect(result).toBe(3);
  });

  it('excludes exceptSid from the WHERE clause when provided (self revoke-all sparing the current session)', async () => {
    hoisted.updateMany.mockResolvedValue({ count: 2 });
    const when = new Date('2026-07-16T00:00:00.000Z');

    const result = await sessionRepository.revokeAllForUserExcept('owner-1', 'owner-sid', when);

    expect(hoisted.updateMany).toHaveBeenCalledWith({
      where: { userId: 'owner-1', revokedAt: null, expiresAt: { gt: when }, id: { not: 'owner-sid' } },
      data: { revokedAt: when },
    });
    expect(result).toBe(2);
  });

  it('never touches expired-but-unrevoked rows (they are neither matched nor counted)', async () => {
    hoisted.updateMany.mockResolvedValue({ count: 0 });
    const result = await sessionRepository.revokeAllForUserExcept('user-1', null);
    expect(result).toBe(0);
  });
});
