/*
 * lib/admin/auth/authorize.js — Sprint 3a (Session Security Foundation).
 *
 * The Node-side gate every route/page builds on. verifySession and
 * sessionService are mocked — this file verifies the WIRING contract:
 *
 *   - getSessionUser goes token → verifySession → sessionService, and any
 *     null along the chain collapses to null (fail closed);
 *   - legacy tokens (verifySession → null) never reach the DB layer (S2);
 *   - the JWT role claim is discarded — only the sid crosses into the DB
 *     check, and the DB-derived role is what comes back (S7);
 *   - requireUser/requireRole keep their generic 401/403 shape, so a
 *     client can't distinguish missing vs revoked vs expired (R3/R4).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  verifySession: vi.fn(),
  getValidSessionUser: vi.fn(),
}));

vi.mock('./session', () => ({
  SESSION_COOKIE_NAME: 'admin_session',
  verifySession: hoisted.verifySession,
}));

vi.mock('./sessionService', () => ({
  sessionService: { getValidSessionUser: hoisted.getValidSessionUser },
}));

import { getSessionUser, requireUser, requireOwner, requireOwnerOrEmployee } from './authorize';

const SID = '11111111-2222-4333-8444-555555555555';

function requestWithCookie(value = 'a.jwt.token') {
  return { cookies: { get: (name) => (name === 'admin_session' && value ? { value } : undefined) } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getSessionUser — DB-backed gate wiring', () => {
  it('returns null with no cookie, without touching crypto or DB layers', async () => {
    expect(await getSessionUser(requestWithCookie(null))).toBeNull();
    expect(hoisted.verifySession).not.toHaveBeenCalled();
    expect(hoisted.getValidSessionUser).not.toHaveBeenCalled();
  });

  it('S2: a token verifySession rejects (legacy / invalid) yields null and NEVER reaches the DB', async () => {
    hoisted.verifySession.mockResolvedValue(null);
    expect(await getSessionUser(requestWithCookie())).toBeNull();
    expect(hoisted.getValidSessionUser).not.toHaveBeenCalled();
  });

  it('passes ONLY the sid to the DB check and returns its verdict', async () => {
    hoisted.verifySession.mockResolvedValue({ userId: 'user-1', role: 'OWNER', sid: SID });
    hoisted.getValidSessionUser.mockResolvedValue({ userId: 'user-1', role: 'OWNER', sid: SID });

    const user = await getSessionUser(requestWithCookie());

    expect(hoisted.getValidSessionUser).toHaveBeenCalledWith(SID);
    expect(user).toEqual({ userId: 'user-1', role: 'OWNER', sid: SID });
  });

  it('S3/S4/S5/S6 collapse: a dead session (DB check null) yields null even for a valid token', async () => {
    hoisted.verifySession.mockResolvedValue({ userId: 'user-1', role: 'OWNER', sid: SID });
    hoisted.getValidSessionUser.mockResolvedValue(null);
    expect(await getSessionUser(requestWithCookie())).toBeNull();
  });

  it('S7: the DB role overrides the JWT role claim — a stale OWNER claim cannot grant OWNER', async () => {
    // Token still claims OWNER; DB says the user is now EMPLOYEE.
    hoisted.verifySession.mockResolvedValue({ userId: 'user-1', role: 'OWNER', sid: SID });
    hoisted.getValidSessionUser.mockResolvedValue({ userId: 'user-1', role: 'EMPLOYEE', sid: SID });

    const user = await getSessionUser(requestWithCookie());
    expect(user.role).toBe('EMPLOYEE');

    // And the OWNER-only gate rejects it (defense-in-depth chain intact).
    await expect(requireOwner(requestWithCookie())).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('require* — generic, non-enumerating errors', () => {
  it.each([
    ['missing cookie', () => requestWithCookie(null), null, null],
    ['legacy token', () => requestWithCookie(), null, null],
    ['revoked/expired/missing session', () => requestWithCookie(), { sid: SID, userId: 'u', role: 'OWNER' }, null],
  ])('requireUser → identical generic 401 for %s', async (_label, makeReq, verifyResult, dbResult) => {
    hoisted.verifySession.mockResolvedValue(verifyResult);
    hoisted.getValidSessionUser.mockResolvedValue(dbResult);

    await expect(requireUser(makeReq())).rejects.toMatchObject({
      statusCode: 401,
      message: 'Not authenticated', // same message in every case — no session-state enumeration
    });
  });

  it('requireOwnerOrEmployee admits both business roles from the DB', async () => {
    hoisted.verifySession.mockResolvedValue({ userId: 'user-1', role: 'EMPLOYEE', sid: SID });
    hoisted.getValidSessionUser.mockResolvedValue({ userId: 'user-1', role: 'EMPLOYEE', sid: SID });
    await expect(requireOwnerOrEmployee(requestWithCookie())).resolves.toMatchObject({ role: 'EMPLOYEE' });
  });
});
