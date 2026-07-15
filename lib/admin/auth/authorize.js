/*
 * Role authorization helpers — Phase 2: Auth/Security, upgraded by Sprint
 * 3a (Session Security Foundation).
 *
 * SPRINT 3A RUNTIME SPLIT — this module is now Node-only:
 *
 *   - proxy.js (Edge) imports ONLY lib/admin/auth/session.js and calls
 *     verifySession() directly — cryptographic gate (signature, expiry,
 *     well-formed sid), no DB. That keeps the Edge bundle free of Prisma.
 *     Nothing Edge-bundled may import THIS file (grep-verified: only Node
 *     route handlers and Server Components do).
 *
 *   - getSessionUser() here is the Node-side, DB-backed gate: it verifies
 *     the JWT AND requires, via sessionService.getValidSessionUser(sid),
 *     that the Session row exists, is not revoked, is not expired, and
 *     that the User row still exists and is active. The returned role
 *     comes from the CURRENT DB User row — never the JWT's role claim —
 *     so a stale or tampered claim can never grant authority, and
 *     revocation/deactivation/password-reset take effect on the next
 *     request instead of after up to 8h of token lifetime.
 *
 * Defense in depth is preserved: middleware proves "a validly signed,
 * sid-bearing token exists"; every route/page re-derives the user through
 * this DB-backed gate rather than trusting any upstream header; services
 * (userService, approvalService) re-assert the actor role a third time.
 *
 * Fail-closed: every failure mode — missing cookie, bad signature, legacy
 * token without sid, dead session, inactive user, DB error — collapses to
 * null here, which requireUser() turns into a generic 401. Clients can
 * never distinguish WHY (no session-state enumeration).
 *
 * Validation happens once per request at this gate; results are never
 * cached across requests (a request already authorized before a
 * concurrent revoke may finish — exposure is one request's duration).
 */

import { ROLE } from '../constants/enums';
import { SESSION_COOKIE_NAME, verifySession } from './session';
import { sessionService } from './sessionService';

/**
 * Read + verify the session cookie from a Request/NextRequest-like object
 * (anything with a `cookies.get(name)` accessor, which both NextRequest
 * and the cookies() helper expose), then validate the referenced Session
 * against the database. Returns { userId, role, sid } — role from the DB
 * user row — or null.
 */
export async function getSessionUser(request) {
  const token = request.cookies?.get?.(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload) return null;
  // The JWT's role claim is deliberately ignored from here on — the DB is
  // the only role source.
  return sessionService.getValidSessionUser(payload.sid);
}

/** Throws if there is no valid session. Use inside route handlers/pages. */
export async function requireUser(request) {
  const user = await getSessionUser(request);
  if (!user) {
    const err = new Error('Not authenticated');
    err.statusCode = 401;
    throw err;
  }
  return user;
}

/** Throws if there is no valid session or the session's role isn't allowed. */
export async function requireRole(request, allowedRoles) {
  const user = await requireUser(request);
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!roles.includes(user.role)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  return user;
}

/** Convenience wrapper — Owner-only at launch, but written against the role, not "the one Owner account" (Section 11). */
export async function requireOwner(request) {
  return requireRole(request, [ROLE.OWNER]);
}

/**
 * Convenience wrapper for actions either business role may perform: create
 * draft, save draft, submit proposal (OWNER/EMPLOYEE Permission Model
 * Sprint). Functionally equivalent to requireUser() today since OWNER and
 * EMPLOYEE are the only two roles, but written explicitly against the role
 * list — not "any authenticated user" — so a future third role (e.g. a
 * read-only reviewer) doesn't silently gain these permissions just by
 * having a valid session.
 */
export async function requireOwnerOrEmployee(request) {
  return requireRole(request, [ROLE.OWNER, ROLE.EMPLOYEE]);
}
