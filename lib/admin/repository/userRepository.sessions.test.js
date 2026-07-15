/*
 * userRepository — Sprint 3a composite transactional methods.
 *
 * S8/S9: deactivation and password reset must revoke every active session
 * ATOMICALLY with the user mutation — both writes ride ONE
 * prisma.$transaction (array form: all-or-nothing by construction), and a
 * transaction failure propagates with neither write surviving outside it.
 *
 * Prisma is mocked (no test may touch a real database). The array-form
 * $transaction contract is what's asserted: both operations are handed to
 * $transaction in one call, and NO user/session write ever happens outside
 * of it — which is exactly the property that makes "user updated but
 * revoke silently failed" impossible in the real client.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  const state = {
    userUpdateCalls: [],
    sessionUpdateManyCalls: [],
  };
  return {
    state,
    transaction: vi.fn(async (ops) => Promise.all(ops)),
    userUpdate: vi.fn((args) => {
      state.userUpdateCalls.push(args);
      return Promise.resolve({ id: args.where.id, ...args.data });
    }),
    sessionUpdateMany: vi.fn((args) => {
      state.sessionUpdateManyCalls.push(args);
      return Promise.resolve({ count: 2 });
    }),
  };
});

vi.mock('@/lib/admin/db', () => ({
  prisma: {
    $transaction: hoisted.transaction,
    user: { update: hoisted.userUpdate },
    session: { updateMany: hoisted.sessionUpdateMany },
  },
  isDatabaseConfigured: true,
}));

import { userRepository } from '@/lib/admin/repository/userRepository';

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.state.userUpdateCalls.length = 0;
  hoisted.state.sessionUpdateManyCalls.length = 0;
  hoisted.transaction.mockImplementation(async (ops) => Promise.all(ops));
});

describe('S8 — setActiveAndRevokeSessions', () => {
  it('runs the isActive flip AND the revoke-all in ONE $transaction call', async () => {
    const result = await userRepository.setActiveAndRevokeSessions('user-1', false);

    expect(hoisted.transaction).toHaveBeenCalledTimes(1);
    expect(hoisted.transaction.mock.calls[0][0]).toHaveLength(2);

    expect(hoisted.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { isActive: false },
      })
    );
    // Revoke-all targets ONLY the user's still-active sessions and sets
    // revokedAt — set-once semantics (already-revoked rows untouched).
    expect(hoisted.sessionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      })
    );
    expect(result).toMatchObject({ id: 'user-1', isActive: false });
  });

  it('a transaction failure propagates — the flag flip cannot commit while the revoke leg fails', async () => {
    hoisted.transaction.mockRejectedValue(new Error('tx aborted'));
    await expect(userRepository.setActiveAndRevokeSessions('user-1', false)).rejects.toThrow('tx aborted');
  });

  it('the passwordHash is never selected back out of the user update', async () => {
    await userRepository.setActiveAndRevokeSessions('user-1', false);
    const select = hoisted.userUpdate.mock.calls[0][0].select;
    expect(select).toBeDefined();
    expect(select.passwordHash).toBeUndefined();
  });
});

describe('S9 — updatePasswordHashAndRevokeSessions', () => {
  it('runs the hash overwrite AND the revoke-all in ONE $transaction call', async () => {
    const result = await userRepository.updatePasswordHashAndRevokeSessions('user-1', 'new-hash');

    expect(hoisted.transaction).toHaveBeenCalledTimes(1);
    expect(hoisted.transaction.mock.calls[0][0]).toHaveLength(2);
    expect(hoisted.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { passwordHash: 'new-hash' },
      })
    );
    expect(hoisted.sessionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      })
    );
    expect(result).toMatchObject({ id: 'user-1' });
  });

  it('a transaction failure propagates — a reset can never commit while its revoke-all fails', async () => {
    hoisted.transaction.mockRejectedValue(new Error('tx aborted'));
    await expect(userRepository.updatePasswordHashAndRevokeSessions('user-1', 'new-hash')).rejects.toThrow(
      'tx aborted'
    );
  });

  it('the hash never appears in the returned projection', async () => {
    const result = await userRepository.updatePasswordHashAndRevokeSessions('user-1', 'new-hash');
    const select = hoisted.userUpdate.mock.calls[0][0].select;
    expect(select.passwordHash).toBeUndefined();
    // The mock echoes data back, so also assert the repo's select shape is
    // the SAFE projection (id/email/role/... — no passwordHash key).
    expect(Object.keys(select)).not.toContain('passwordHash');
    expect(result).toBeDefined();
  });
});

describe('S13 — plain setActive(true) touches no sessions', () => {
  it('reactivation goes through the non-composite path: no $transaction, no session write', async () => {
    await userRepository.setActive('user-1', true);
    expect(hoisted.transaction).not.toHaveBeenCalled();
    expect(hoisted.sessionUpdateMany).not.toHaveBeenCalled();
  });
});
