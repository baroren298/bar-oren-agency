/*
 * POST /api/admin/auth/logout — Sprint 3a (Session Security Foundation).
 *
 * S12: logout revokes the current Session and clears the cookie, and is
 * IDEMPOTENT — missing cookie, invalid signature, legacy token (no sid),
 * unknown/expired/already-revoked session, and double logout all return
 * the same success shape with the cookie cleared, leaking nothing about
 * session state. A revoke DB failure still clears the cookie and returns
 * success, logging a SECURITY GAP line that carries no token or sid (S15).
 *
 * verifySession and sessionService are mocked — the real crypto and DB
 * predicates have their own suites (session.test.js /
 * sessionService.test.js); this file locks the route's semantics.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  verifySession: vi.fn(),
  revokeSession: vi.fn(),
}));

vi.mock('@/lib/admin/auth/session', () => ({
  SESSION_COOKIE_NAME: 'admin_session',
  verifySession: hoisted.verifySession,
}));

vi.mock('@/lib/admin/auth/sessionService', () => ({
  sessionService: { revokeSession: hoisted.revokeSession },
}));

import { POST } from './route';

const SID = '11111111-2222-4333-8444-555555555555';
const RAW_TOKEN = 'raw.jwt.token-value';

function requestWithCookie(value = RAW_TOKEN) {
  return { cookies: { get: (name) => (name === 'admin_session' && value ? { value } : undefined) } };
}

async function expectSuccessAndClearedCookie(response) {
  expect(await response.json()).toEqual({ success: true });
  const setCookie = response.headers.get('set-cookie') || '';
  expect(setCookie).toContain('admin_session=;');
  expect(setCookie.toLowerCase()).toContain('max-age=0');
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.revokeSession.mockResolvedValue(1);
});

describe('S12 — logout revocation and idempotency', () => {
  it('valid sid: revokes the Session, then clears the cookie, success', async () => {
    hoisted.verifySession.mockResolvedValue({ userId: 'user-1', role: 'OWNER', sid: SID });

    const response = await POST(requestWithCookie());

    expect(hoisted.revokeSession).toHaveBeenCalledWith(SID);
    await expectSuccessAndClearedCookie(response);
  });

  it('missing cookie: success, cookie cleared, no revoke attempted', async () => {
    const response = await POST(requestWithCookie(null));
    expect(hoisted.verifySession).not.toHaveBeenCalled();
    expect(hoisted.revokeSession).not.toHaveBeenCalled();
    await expectSuccessAndClearedCookie(response);
  });

  it('invalid signature / legacy token without sid: success, cookie cleared, no revoke', async () => {
    hoisted.verifySession.mockResolvedValue(null);
    const response = await POST(requestWithCookie('legacy-or-garbage'));
    expect(hoisted.revokeSession).not.toHaveBeenCalled();
    await expectSuccessAndClearedCookie(response);
  });

  it('unknown / expired / already-revoked session (0-row revoke): identical success, no error leak', async () => {
    hoisted.verifySession.mockResolvedValue({ userId: 'user-1', role: 'OWNER', sid: SID });
    hoisted.revokeSession.mockResolvedValue(0); // idempotent no-op

    const response = await POST(requestWithCookie());
    await expectSuccessAndClearedCookie(response);
  });

  it('double logout is idempotent: two calls, both succeed identically', async () => {
    hoisted.verifySession.mockResolvedValue({ userId: 'user-1', role: 'OWNER', sid: SID });
    hoisted.revokeSession.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    await expectSuccessAndClearedCookie(await POST(requestWithCookie()));
    await expectSuccessAndClearedCookie(await POST(requestWithCookie()));
  });

  it('revoke DB failure: cookie STILL cleared, success STILL returned, gap logged', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    hoisted.verifySession.mockResolvedValue({ userId: 'user-1', role: 'OWNER', sid: SID });
    hoisted.revokeSession.mockRejectedValue(new Error('db down'));

    const response = await POST(requestWithCookie());

    await expectSuccessAndClearedCookie(response);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('SECURITY GAP'));
    consoleError.mockRestore();
  });
});

describe('S15 — log and response hygiene', () => {
  it('the SECURITY GAP log line contains no token, sid, or cookie value', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    hoisted.verifySession.mockResolvedValue({ userId: 'user-1', role: 'OWNER', sid: SID });
    hoisted.revokeSession.mockRejectedValue(new Error(`db down for ${SID}`));

    await POST(requestWithCookie());

    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).not.toContain(SID);
    expect(logged).not.toContain(RAW_TOKEN);
    consoleError.mockRestore();
  });

  it('no response body ever distinguishes why a logout was a no-op (anti-enumeration)', async () => {
    const bodies = [];

    hoisted.verifySession.mockResolvedValue(null);
    bodies.push(await (await POST(requestWithCookie('legacy'))).json());

    hoisted.verifySession.mockResolvedValue({ userId: 'u', role: 'OWNER', sid: SID });
    hoisted.revokeSession.mockResolvedValue(0);
    bodies.push(await (await POST(requestWithCookie())).json());

    hoisted.revokeSession.mockResolvedValue(1);
    bodies.push(await (await POST(requestWithCookie())).json());

    bodies.push(await (await POST(requestWithCookie(null))).json());

    for (const body of bodies) expect(body).toEqual({ success: true });
    expect(new Set(bodies.map((b) => JSON.stringify(b))).size).toBe(1);
  });
});
