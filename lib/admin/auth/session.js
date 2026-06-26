/*
 * Session cookie — Phase 2: Auth/Security.
 *
 * Stateless signed JWT in an httpOnly cookie, not a DB-backed sessions
 * table — simplest option for a single Owner account (ADMIN_PANEL_PLAN.md
 * Section 11). Signed/verified with `jose` (HS256), which runs on both the
 * Node and Edge runtimes — required because middleware.js verifies this
 * same token and Next.js middleware runs on the Edge runtime by default.
 *
 * Nothing here trusts client input: verifySession() always re-checks the
 * cryptographic signature and expiry before returning a payload. Every
 * caller (middleware.js, lib/admin/auth/authorize.js) treats an invalid or
 * missing token as "not logged in," never as a role to fall back on.
 */

import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'admin_session';

const SESSION_MAX_AGE_SECONDS = Number(process.env.SESSION_MAX_AGE_SECONDS) || 8 * 60 * 60; // 8h

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      '[lib/admin/auth/session] SESSION_SECRET is not set. Add it to .env.local ' +
        '(see .env.local.example) before logging in — never commit a real value.'
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Sign a new session JWT for a given user. Payload is intentionally
 * minimal: just enough to re-derive identity and role without another DB
 * round trip on every request (the DB is still the source of truth —
 * getSessionUser() in authorize.js re-fetches the user record too, see
 * that file's header comment for why).
 */
export async function signSession({ userId, role }) {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

/**
 * Verify a session JWT. Returns { userId, role } on success, or null on
 * any failure (missing token, bad signature, expired, malformed) — callers
 * must treat null as "not authenticated," not throw a 500.
 */
export async function verifySession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (!payload.sub || !payload.role) return null;
    return { userId: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

/** Cookie options shared by the login route (set) and logout route (clear). */
export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
