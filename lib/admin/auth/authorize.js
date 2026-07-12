/*
 * Role authorization helpers — Phase 2: Auth/Security.
 *
 * Used both in proxy.js (Edge runtime — only getSessionUser() +
 * verifySession() run there, never the Node-only repository/DB calls) and
 * again inside individual route handlers/server components once they
 * exist (Phase 4+), as defense in depth: middleware proves "is logged in
 * with a validly signed token," each route/page re-derives the user from
 * that same token rather than trusting any upstream header, satisfying
 * "no admin API may trust client-side role flags" (ADMIN_PANEL_PLAN.md
 * Section 11).
 *
 * getSessionUser() here is the Edge-safe variant: it verifies the JWT and
 * returns { id, role } straight from the token, with no DB round trip, so
 * it's usable from proxy.js. Route handlers that need the full User
 * row (e.g. to check the account hasn't been disabled) should call
 * userRepository.getById(session.userId) themselves after this returns —
 * that DB read only needs to happen in Node-runtime route handlers, not in
 * middleware.
 */

import { ROLE } from '../constants/enums';
import { SESSION_COOKIE_NAME, verifySession } from './session';

/**
 * Read + verify the session cookie from a Request/NextRequest-like object
 * (anything with a `cookies.get(name)` accessor, which both
 * NextRequest and the cookies() helper expose). Returns { userId, role }
 * or null.
 */
export async function getSessionUser(request) {
  const token = request.cookies?.get?.(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
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
