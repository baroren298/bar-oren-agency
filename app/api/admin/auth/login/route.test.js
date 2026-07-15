/*
 * POST /api/admin/auth/login — route-level coverage.
 *
 * Added by the User Model Completion sprint (Sprint 2) alongside the
 * isActive gate and lastLoginAt stamping this file's route now does. No
 * test file existed for the login route before this sprint; this covers
 * both the new Sprint 2 behavior (inactive users rejected, lastLoginAt
 * updated on success, existing OWNER login still works) and the
 * pre-existing Sprint 1 contract (bad credentials -> 401, rate limit ->
 * 429, no enumeration leak between "no such user" and "wrong password").
 *
 * userRepository, password verification, rate limiting, and session
 * signing are all mocked — this file's job is to verify the route wires
 * them together correctly, not to re-prove bcrypt or JWT behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  getByEmail: vi.fn(),
  updateLastLoginAt: vi.fn(),
  verifyPassword: vi.fn(),
  isRateLimited: vi.fn(),
  recordFailedAttempt: vi.fn(),
  clearAttempts: vi.fn(),
  signSession: vi.fn(),
  // Sprint 3a — DB-backed sessions.
  generateSessionId: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock('@/lib/admin/repository/userRepository', () => ({
  userRepository: {
    getByEmail: hoisted.getByEmail,
    updateLastLoginAt: hoisted.updateLastLoginAt,
  },
}));

vi.mock('@/lib/admin/auth/password', () => ({
  verifyPassword: hoisted.verifyPassword,
  DUMMY_PASSWORD_HASH: 'dummy-hash',
}));

vi.mock('@/lib/admin/auth/rateLimit', () => ({
  isRateLimited: hoisted.isRateLimited,
  recordFailedAttempt: hoisted.recordFailedAttempt,
  clearAttempts: hoisted.clearAttempts,
}));

vi.mock('@/lib/admin/auth/session', () => ({
  signSession: hoisted.signSession,
  getSessionCookieOptions: () => ({ httpOnly: true }),
  SESSION_COOKIE_NAME: 'admin_session',
}));

vi.mock('@/lib/admin/auth/sessionService', () => ({
  sessionService: {
    generateSessionId: hoisted.generateSessionId,
    createSession: hoisted.createSession,
  },
}));

import { POST } from './route';

const TEST_SID = '11111111-2222-4333-8444-555555555555';

function makeRequest({ email = 'owner@example.com', password = 'correct-password' } = {}) {
  return {
    headers: new Map([['x-forwarded-for', '1.2.3.4']]),
    json: async () => ({ email, password }),
  };
}
// NextRequest-like: headers.get(...) — Map has .get too, so this satisfies
// getClientIp(request)'s request.headers.get("x-forwarded-for") call.

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.isRateLimited.mockReturnValue(false);
  hoisted.signSession.mockResolvedValue('signed-token');
  hoisted.generateSessionId.mockReturnValue(TEST_SID);
  hoisted.createSession.mockResolvedValue({ id: TEST_SID });
});

describe('POST /api/admin/auth/login', () => {
  it('returns 401 and never signs a session when no user exists for the email (no enumeration leak)', async () => {
    hoisted.getByEmail.mockResolvedValue(null);
    hoisted.verifyPassword.mockResolvedValue(false);

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Invalid email or password.');
    expect(hoisted.recordFailedAttempt).toHaveBeenCalledWith('1.2.3.4', 'owner@example.com');
    expect(hoisted.signSession).not.toHaveBeenCalled();
    expect(hoisted.updateLastLoginAt).not.toHaveBeenCalled();
  });

  it('returns 401 for a wrong password on an existing user', async () => {
    hoisted.getByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
      passwordHash: 'hash',
      role: 'OWNER',
      isActive: true,
    });
    hoisted.verifyPassword.mockResolvedValue(false);

    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    expect(hoisted.signSession).not.toHaveBeenCalled();
  });

  it('returns 429 when rate limited, without touching the repository at all', async () => {
    hoisted.isRateLimited.mockReturnValue(true);

    const response = await POST(makeRequest());

    expect(response.status).toBe(429);
    expect(hoisted.getByEmail).not.toHaveBeenCalled();
  });

  it('OWNER login continues to work: valid credentials + isActive true -> 200, session signed, lastLoginAt updated', async () => {
    hoisted.getByEmail.mockResolvedValue({
      id: 'owner-1',
      email: 'owner@example.com',
      passwordHash: 'hash',
      role: 'OWNER',
      isActive: true,
    });
    hoisted.verifyPassword.mockResolvedValue(true);

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(hoisted.signSession).toHaveBeenCalledWith({ userId: 'owner-1', role: 'OWNER', sid: TEST_SID });
    expect(hoisted.updateLastLoginAt).toHaveBeenCalledWith('owner-1');
    expect(hoisted.clearAttempts).toHaveBeenCalledWith('1.2.3.4', 'owner@example.com');
  });

  it('EMPLOYEE login with valid credentials + isActive true also succeeds', async () => {
    hoisted.getByEmail.mockResolvedValue({
      id: 'employee-1',
      email: 'employee@example.com',
      passwordHash: 'hash',
      role: 'EMPLOYEE',
      isActive: true,
    });
    hoisted.verifyPassword.mockResolvedValue(true);

    const response = await POST(makeRequest({ email: 'employee@example.com' }));

    expect(response.status).toBe(200);
    expect(hoisted.signSession).toHaveBeenCalledWith({ userId: 'employee-1', role: 'EMPLOYEE', sid: TEST_SID });
  });

  it('returns 403 and never signs a session when credentials are correct but the user is inactive', async () => {
    hoisted.getByEmail.mockResolvedValue({
      id: 'user-2',
      email: 'disabled@example.com',
      passwordHash: 'hash',
      role: 'EMPLOYEE',
      isActive: false,
    });
    hoisted.verifyPassword.mockResolvedValue(true);

    const response = await POST(makeRequest({ email: 'disabled@example.com' }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('This account has been deactivated.');
    expect(hoisted.signSession).not.toHaveBeenCalled();
    expect(hoisted.updateLastLoginAt).not.toHaveBeenCalled();
  });

  it('does not record a failed rate-limit attempt for a deactivated-but-correct-password login (credentials were right)', async () => {
    hoisted.getByEmail.mockResolvedValue({
      id: 'user-2',
      email: 'disabled@example.com',
      passwordHash: 'hash',
      role: 'EMPLOYEE',
      isActive: false,
    });
    hoisted.verifyPassword.mockResolvedValue(true);

    await POST(makeRequest({ email: 'disabled@example.com' }));

    expect(hoisted.recordFailedAttempt).not.toHaveBeenCalled();
  });

  /*
   * Sprint 3a (Session Security Foundation) — DB-backed session creation.
   */
  describe('Sprint 3a — Session creation (S10/S11)', () => {
    const owner = {
      id: 'owner-1',
      email: 'owner@example.com',
      passwordHash: 'hash',
      role: 'OWNER',
      isActive: true,
    };

    it('S10: a successful login creates exactly one Session for the same sid the JWT carries', async () => {
      hoisted.getByEmail.mockResolvedValue(owner);
      hoisted.verifyPassword.mockResolvedValue(true);

      const response = await POST(makeRequest());

      expect(response.status).toBe(200);
      expect(hoisted.generateSessionId).toHaveBeenCalledTimes(1);
      expect(hoisted.createSession).toHaveBeenCalledTimes(1);
      expect(hoisted.createSession).toHaveBeenCalledWith({ sid: TEST_SID, userId: 'owner-1' });
      // Same sid in the token and the row — never two different ids.
      expect(hoisted.signSession).toHaveBeenCalledWith(expect.objectContaining({ sid: TEST_SID }));
    });

    it('ordering: the JWT is signed BEFORE the Session row is written (a signing failure causes no DB write)', async () => {
      hoisted.getByEmail.mockResolvedValue(owner);
      hoisted.verifyPassword.mockResolvedValue(true);
      hoisted.signSession.mockRejectedValue(new Error('SESSION_SECRET is not set'));

      await expect(POST(makeRequest())).rejects.toThrow();
      expect(hoisted.createSession).not.toHaveBeenCalled();
    });

    it('S11: a Session-create failure aborts the login — no cookie is issued and lastLoginAt is not stamped', async () => {
      hoisted.getByEmail.mockResolvedValue(owner);
      hoisted.verifyPassword.mockResolvedValue(true);
      hoisted.createSession.mockRejectedValue(new Error('insert failed'));

      // The route lets the failure propagate (Next.js turns it into a 500);
      // the essential property is that nothing after step 3 ran.
      await expect(POST(makeRequest())).rejects.toThrow('insert failed');
      expect(hoisted.updateLastLoginAt).not.toHaveBeenCalled();
    });

    it('failed logins never create a Session (401 and 403 paths)', async () => {
      // 401 — bad credentials
      hoisted.getByEmail.mockResolvedValue(null);
      hoisted.verifyPassword.mockResolvedValue(false);
      await POST(makeRequest());
      expect(hoisted.createSession).not.toHaveBeenCalled();

      // 403 — deactivated account
      hoisted.getByEmail.mockResolvedValue({ ...owner, isActive: false });
      hoisted.verifyPassword.mockResolvedValue(true);
      await POST(makeRequest());
      expect(hoisted.createSession).not.toHaveBeenCalled();
    });
  });
});
