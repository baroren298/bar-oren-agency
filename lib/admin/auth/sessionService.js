/*
 * sessionService — Sprint 3a (Session Security Foundation).
 *
 * Owns EVERY security decision about DB-backed sessions; the repository
 * beneath it (lib/admin/repository/sessionRepository.js) is pure data
 * access. Node-runtime only — this module reaches Prisma and must never be
 * imported from proxy.js or anything else that runs on the Edge (the
 * Edge-safe cryptographic half lives in lib/admin/auth/session.js).
 *
 * Decisions owned here:
 *   - sid generation: crypto.randomUUID() — 128-bit CSPRNG, non-guessable.
 *     Never cuid (partially predictable), never DB-defaulted.
 *   - TTL alignment: Session.expiresAt derives from the SAME
 *     SESSION_MAX_AGE_SECONDS constant as the JWT exp (imported from
 *     session.js), so DB and token expiry never diverge.
 *   - The full per-request validity predicate (getValidSessionUser).
 *
 * FAIL-CLOSED CONTRACT: getValidSessionUser() returns either a fully
 * validated { userId, role, sid } or null — never a partial result, and
 * never an exception surfaced as anything but null. Callers (authorize.js)
 * treat null as "not authenticated"; error responses stay generic, so a
 * client can never distinguish missing vs revoked vs expired.
 */

import { randomUUID } from 'crypto';
import { sessionRepository } from '../repository/sessionRepository';
import { SESSION_MAX_AGE_SECONDS } from './session';

export const sessionService = {
  /** Generate a new non-guessable session id (CSPRNG, 128-bit). */
  generateSessionId() {
    return randomUUID();
  },

  /**
   * Compute the DB expiry for a session created "now" — same max-age the
   * JWT is signed with. Exposed for the login route/tests so the value is
   * derived in exactly one place.
   */
  getExpiryDate(from = new Date()) {
    return new Date(from.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
  },

  /**
   * Persist a new session row for a login. Called by the login route AFTER
   * the JWT has been signed (plan Section D ordering: a signing failure —
   * e.g. missing SESSION_SECRET — must abort before any DB write). Any
   * failure here propagates: the route then returns 500 and never sets a
   * cookie, so no token is ever issued without a backing row.
   */
  async createSession({ sid, userId }) {
    return sessionRepository.create({
      id: sid,
      userId,
      expiresAt: this.getExpiryDate(),
    });
  },

  /**
   * The per-request validity predicate — the single place that decides
   * whether a cryptographically valid token still corresponds to a live,
   * authorized session. Returns { userId, role, sid } only when ALL hold:
   *
   *   1. sid is a non-empty string (callers pass verifySession()'s output,
   *      which already shape-checked it — re-checked anyway);
   *   2. the Session row exists;
   *   3. it has not been revoked (revokedAt is null);
   *   4. it has not expired (expiresAt in the future — DB expiry judged
   *      independently of the JWT exp);
   *   5. the User row still exists;
   *   6. the user is still active (isActive === true).
   *
   * ROLE SOURCE: the returned `role` comes from the fetched DB User row,
   * NEVER from any JWT claim — a role embedded in a token can never
   * override the current DB role.
   *
   * Any DB error is caught and returns null (fail closed): an exception in
   * the auth path must yield 401/redirect, never a pass-through and never
   * a 500 that might leak session state.
   */
  async getValidSessionUser(sid) {
    if (typeof sid !== 'string' || sid.length === 0) return null;
    try {
      const session = await sessionRepository.getWithUser(sid);
      if (!session) return null;
      if (session.revokedAt !== null) return null;
      if (!(session.expiresAt instanceof Date) || session.expiresAt.getTime() <= Date.now()) {
        return null;
      }
      const user = session.user;
      if (!user || user.isActive !== true) return null;
      return { userId: user.id, role: user.role, sid: session.id };
    } catch (err) {
      // Log hygiene: no sid, token, or DB detail — just the fact that the
      // auth path failed closed.
      console.error('[sessionService] Session validation failed closed due to an internal error.');
      return null;
    }
  },

  /**
   * Revoke a single session (logout path). Idempotent: unknown, expired,
   * or already-revoked sids resolve to 0 rows, never an error.
   */
  async revokeSession(sid) {
    return sessionRepository.revoke(sid);
  },
};

export default sessionService;
