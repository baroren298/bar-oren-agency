/*
 * sessionManagementService — unit tests (Sprint 3b: Session Management API).
 *
 * sessionRepository, userRepository, and eventService are all mocked — this
 * file verifies the service's own policy: the second OWNER gate, target-user
 * 404, the scoped session 404 vs idempotent 200 distinction, the 409
 * self-revoke block, the self-sparing revoke-all behavior, DTO projection
 * (isCurrent stamping), and audit-event emission (including the allowlisted
 * payload / empty metadata contract). The repository's own Prisma queries
 * have their own coverage in sessionRepository.test.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  listActiveForUser: vi.fn(),
  getForUser: vi.fn(),
  revokeForUser: vi.fn(),
  revokeAllForUserExcept: vi.fn(),
  getSafeById: vi.fn(),
  emit: vi.fn(),
}));

vi.mock('./repository/sessionRepository', () => ({
  sessionRepository: {
    listActiveForUser: hoisted.listActiveForUser,
    getForUser: hoisted.getForUser,
    revokeForUser: hoisted.revokeForUser,
    revokeAllForUserExcept: hoisted.revokeAllForUserExcept,
  },
}));

vi.mock('./repository/userRepository', () => ({
  userRepository: {
    getSafeById: hoisted.getSafeById,
  },
}));

vi.mock('./engine/eventService', () => ({
  eventService: { emit: hoisted.emit },
}));

import { sessionManagementService } from './sessionManagementService';
import { ROLE, ENTITY_TYPE } from './constants/enums';
import { EVENT_TYPE } from './engine/eventTypes';

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.getSafeById.mockResolvedValue({ id: 'user-1' });
  hoisted.emit.mockResolvedValue({ id: 'event-1' });
});

const OWNER_CTX = { actorId: 'owner-1', actorRole: ROLE.OWNER, actorSid: 'owner-sid' };

describe('sessionManagementService.listSessions', () => {
  it('throws 403 for a non-OWNER actor and never touches the repository', async () => {
    await expect(
      sessionManagementService.listSessions('user-1', { actorRole: ROLE.EMPLOYEE })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN_ROLE' });
    expect(hoisted.getSafeById).not.toHaveBeenCalled();
    expect(hoisted.listActiveForUser).not.toHaveBeenCalled();
  });

  it('throws 404 when the target user does not exist', async () => {
    hoisted.getSafeById.mockResolvedValue(null);
    await expect(
      sessionManagementService.listSessions('missing-user', { actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ statusCode: 404, code: 'USER_NOT_FOUND' });
    expect(hoisted.listActiveForUser).not.toHaveBeenCalled();
  });

  it('projects rows to the safe DTO, ISO-stamping dates and isCurrent from actorSid', async () => {
    hoisted.listActiveForUser.mockResolvedValue([
      {
        id: 'owner-sid',
        createdAt: new Date('2026-07-16T00:00:00.000Z'),
        expiresAt: new Date('2026-07-16T08:00:00.000Z'),
        userId: 'user-1',
        revokedAt: null,
      },
      {
        id: 'other-sid',
        createdAt: new Date('2026-07-15T00:00:00.000Z'),
        expiresAt: new Date('2026-07-15T08:00:00.000Z'),
        userId: 'user-1',
        revokedAt: null,
      },
    ]);

    const result = await sessionManagementService.listSessions('user-1', {
      actorRole: ROLE.OWNER,
      actorSid: 'owner-sid',
    });

    expect(result).toEqual([
      { id: 'owner-sid', createdAt: '2026-07-16T00:00:00.000Z', expiresAt: '2026-07-16T08:00:00.000Z', isCurrent: true },
      { id: 'other-sid', createdAt: '2026-07-15T00:00:00.000Z', expiresAt: '2026-07-15T08:00:00.000Z', isCurrent: false },
    ]);
    // No userId/revokedAt leak into the DTO.
    expect(result[0]).not.toHaveProperty('userId');
    expect(result[0]).not.toHaveProperty('revokedAt');
  });

  it('never marks a row isCurrent when no actorSid is supplied (viewing another user)', async () => {
    hoisted.listActiveForUser.mockResolvedValue([
      { id: 'some-sid', createdAt: new Date(), expiresAt: new Date(), userId: 'user-1', revokedAt: null },
    ]);

    const result = await sessionManagementService.listSessions('user-1', { actorRole: ROLE.OWNER });
    expect(result[0].isCurrent).toBe(false);
  });
});

describe('sessionManagementService.revokeSession', () => {
  it('throws 403 for a non-OWNER actor and never touches the repository', async () => {
    await expect(
      sessionManagementService.revokeSession('user-1', 'sid-1', { actorRole: ROLE.EMPLOYEE })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(hoisted.revokeForUser).not.toHaveBeenCalled();
  });

  it('throws 404 when the target user does not exist', async () => {
    hoisted.getSafeById.mockResolvedValue(null);
    await expect(
      sessionManagementService.revokeSession('missing-user', 'sid-1', { actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ statusCode: 404, code: 'USER_NOT_FOUND' });
    expect(hoisted.revokeForUser).not.toHaveBeenCalled();
  });

  it('rejects revoking the acting Owner\'s own current session with 409 before any write', async () => {
    await expect(
      sessionManagementService.revokeSession('user-1', 'owner-sid', OWNER_CTX)
    ).rejects.toMatchObject({ statusCode: 409, code: 'CANNOT_REVOKE_CURRENT_SESSION' });
    expect(hoisted.revokeForUser).not.toHaveBeenCalled();
    expect(hoisted.emit).not.toHaveBeenCalled();
  });

  it('returns { revoked: 1 } and emits UserSessionRevoked with the allowlisted payload on an effective revoke', async () => {
    hoisted.revokeForUser.mockResolvedValue(1);

    const result = await sessionManagementService.revokeSession('user-1', 'sid-2', {
      ...OWNER_CTX,
      correlationId: 'corr-1',
    });

    expect(result).toEqual({ revoked: 1 });
    expect(hoisted.revokeForUser).toHaveBeenCalledWith('sid-2', 'user-1');
    expect(hoisted.emit).toHaveBeenCalledTimes(1);
    expect(hoisted.emit).toHaveBeenCalledWith(EVENT_TYPE.USER_SESSION_REVOKED, {
      entityType: ENTITY_TYPE.USER,
      entityId: 'user-1',
      actorId: 'owner-1',
      correlationId: 'corr-1',
      payload: { scope: 'single' },
      metadata: {},
    });
    // Never a sid in the emitted payload.
    expect(JSON.stringify(hoisted.emit.mock.calls[0])).not.toContain('sid-2');
  });

  it('returns { revoked: 0 } and emits nothing when the session exists for this user but is already dead', async () => {
    hoisted.revokeForUser.mockResolvedValue(0);
    hoisted.getForUser.mockResolvedValue({ id: 'sid-2', userId: 'user-1', revokedAt: new Date() });

    const result = await sessionManagementService.revokeSession('user-1', 'sid-2', OWNER_CTX);

    expect(result).toEqual({ revoked: 0 });
    expect(hoisted.emit).not.toHaveBeenCalled();
  });

  it('throws the scoped 404 when the session id does not exist for this user (unknown or foreign)', async () => {
    hoisted.revokeForUser.mockResolvedValue(0);
    hoisted.getForUser.mockResolvedValue(null);

    await expect(
      sessionManagementService.revokeSession('user-1', 'sid-nonexistent', OWNER_CTX)
    ).rejects.toMatchObject({ statusCode: 404, code: 'SESSION_NOT_FOUND' });
    expect(hoisted.emit).not.toHaveBeenCalled();
  });

  it('scopes the 0-row disambiguation read by BOTH ids (IDOR guard)', async () => {
    hoisted.revokeForUser.mockResolvedValue(0);
    hoisted.getForUser.mockResolvedValue(null);

    await expect(
      sessionManagementService.revokeSession('user-1', 'sid-of-someone-else', OWNER_CTX)
    ).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
    expect(hoisted.getForUser).toHaveBeenCalledWith('sid-of-someone-else', 'user-1');
  });
});

describe('sessionManagementService.revokeAllSessions', () => {
  it('throws 403 for a non-OWNER actor and never touches the repository', async () => {
    await expect(
      sessionManagementService.revokeAllSessions('user-1', { actorRole: ROLE.EMPLOYEE })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(hoisted.revokeAllForUserExcept).not.toHaveBeenCalled();
  });

  it('throws 404 when the target user does not exist', async () => {
    hoisted.getSafeById.mockResolvedValue(null);
    await expect(
      sessionManagementService.revokeAllSessions('missing-user', { actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ statusCode: 404, code: 'USER_NOT_FOUND' });
  });

  it('spares the current session when the Owner targets themself', async () => {
    hoisted.revokeAllForUserExcept.mockResolvedValue(2);

    const result = await sessionManagementService.revokeAllSessions('owner-1', OWNER_CTX);

    expect(hoisted.revokeAllForUserExcept).toHaveBeenCalledWith('owner-1', 'owner-sid');
    expect(result).toEqual({ revoked: 2 });
  });

  it('revokes ALL sessions (no exception) when targeting a different user', async () => {
    hoisted.revokeAllForUserExcept.mockResolvedValue(3);

    const result = await sessionManagementService.revokeAllSessions('employee-1', OWNER_CTX);

    expect(hoisted.revokeAllForUserExcept).toHaveBeenCalledWith('employee-1', null);
    expect(result).toEqual({ revoked: 3 });
  });

  it('emits UserSessionsRevoked with scope+revokedCount even at count 0 (intent is auditable)', async () => {
    hoisted.revokeAllForUserExcept.mockResolvedValue(0);

    await sessionManagementService.revokeAllSessions('employee-1', { ...OWNER_CTX, correlationId: 'corr-2' });

    expect(hoisted.emit).toHaveBeenCalledTimes(1);
    expect(hoisted.emit).toHaveBeenCalledWith(EVENT_TYPE.USER_SESSIONS_REVOKED, {
      entityType: ENTITY_TYPE.USER,
      entityId: 'employee-1',
      actorId: 'owner-1',
      correlationId: 'corr-2',
      payload: { scope: 'all', revokedCount: 0 },
      metadata: {},
    });
  });

  it('never puts a sid (including the spared one) in the emitted payload', async () => {
    hoisted.revokeAllForUserExcept.mockResolvedValue(1);

    await sessionManagementService.revokeAllSessions('owner-1', OWNER_CTX);

    expect(JSON.stringify(hoisted.emit.mock.calls[0])).not.toContain('owner-sid');
  });
});

describe('consistency — committed revocation wins over a failed Event persist', () => {
  it('revokeSession still returns { revoked: 1 } when eventService.emit rejects after the write committed', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    hoisted.revokeForUser.mockResolvedValue(1);
    hoisted.emit.mockRejectedValue(new Error('event table unavailable'));

    const result = await sessionManagementService.revokeSession('user-1', 'sid-2', OWNER_CTX);

    expect(result).toEqual({ revoked: 1 });
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('AUDIT GAP'), expect.any(Error));
    consoleError.mockRestore();
  });

  it('revokeAllSessions still returns the count when eventService.emit rejects after the write committed', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    hoisted.revokeAllForUserExcept.mockResolvedValue(4);
    hoisted.emit.mockRejectedValue(new Error('event table unavailable'));

    const result = await sessionManagementService.revokeAllSessions('employee-1', OWNER_CTX);

    expect(result).toEqual({ revoked: 4 });
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('AUDIT GAP'), expect.any(Error));
    consoleError.mockRestore();
  });
});
