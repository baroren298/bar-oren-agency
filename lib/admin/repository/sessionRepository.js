/*
 * Session repository — Sprint 3a (Session Security Foundation).
 *
 * Pure data access for the `sessions` table, nothing more. POLICY-FREE by
 * design (same convention as the rest of the repository layer): no method
 * here decides whether a session is valid, generates a sid, or knows the
 * session lifetime — all of that lives in lib/admin/auth/sessionService.js.
 * Keeping this layer decision-free means the security predicate exists in
 * exactly one place and can never drift between callers.
 *
 * Revocation uses updateMany filtered on `revokedAt: null` so it is
 * naturally idempotent (revoking an already-revoked/unknown sid is a
 * 0-row no-op, never an error) and set-once (`revokedAt` is never
 * overwritten or cleared — reactivating a user must not resurrect old
 * sessions).
 *
 * NOTE: the two atomic "user mutation + revoke-all" paths (deactivation,
 * owner password reset) do NOT call revokeAllForUser() here — they live as
 * composite $transaction methods on userRepository so both writes commit
 * or roll back together (plan Section D). revokeAllForUser() exists for
 * completeness of this repository's contract.
 */

import { prisma } from '../db';

/**
 * Sprint 3b — hard cap for listActiveForUser (approved: no pagination;
 * 50 is a safety valve, not a page size). Exported so the service/tests
 * reference the same constant instead of re-hardcoding it.
 */
export const MAX_ACTIVE_SESSIONS_LISTED = 50;

export const sessionRepository = {
  /**
   * Insert a new session row. `id` is the service-generated sid —
   * deliberately supplied by the caller (sessionService), never defaulted
   * here or in the DB.
   */
  async create({ id, userId, expiresAt }) {
    return prisma.session.create({
      data: { id, userId, expiresAt },
    });
  },

  /**
   * Fetch a session row together with its user in ONE round trip — backs
   * sessionService.getValidSessionUser()'s per-request check. Returns the
   * full row + user or null; validity judgment belongs to the service.
   */
  async getWithUser(sid) {
    if (!sid) return null;
    return prisma.session.findUnique({
      where: { id: sid },
      include: { user: true },
    });
  },

  /**
   * Revoke one session (idempotent). Returns the number of rows revoked
   * (0 when the sid is unknown or already revoked — never throws for
   * those cases).
   */
  async revoke(sid, when = new Date()) {
    if (!sid) return 0;
    const result = await prisma.session.updateMany({
      where: { id: sid, revokedAt: null },
      data: { revokedAt: when },
    });
    return result.count;
  },

  /**
   * Revoke every active session for a user (idempotent). See the header
   * note — the deactivation/password-reset flows use userRepository's
   * composite transactions instead, so this standalone variant is only
   * for non-atomic contexts.
   */
  async revokeAllForUser(userId, when = new Date()) {
    if (!userId) return 0;
    const result = await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: when },
    });
    return result.count;
  },

  // ── Sprint 3b (Session Management API) — management read/revoke methods.
  //
  // Still policy-free: these are scoped queries, not decisions. The
  // double-key `{ id, userId }` WHERE clauses below are the data-layer IDOR
  // guarantee (SPRINT_3B plan §5): a session id pasted under the wrong
  // user's URL matches zero rows here regardless of what any upper layer
  // checked. The management revokes additionally filter `expiresAt > now`
  // so an expired-but-unrevoked row is never counted as an *effective*
  // revocation (approved decision: expired ⇒ idempotent { revoked: 0 }) —
  // the 3a invariants (revokedAt set-once via `revokedAt: null` filter,
  // 0-row no-op never throws) all still hold.

  /**
   * The user's ACTIVE sessions (not revoked, not expired), newest first,
   * hard-capped at `MAX_ACTIVE_SESSIONS_LISTED` (no pagination by approved
   * design — sessions are bounded by the 8h TTL; hitting the cap signals a
   * login-loop bug, not an under-paginated list). Uses the existing
   * (userId, revokedAt) index.
   */
  async listActiveForUser(userId, now = new Date()) {
    if (!userId) return [];
    return prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      take: MAX_ACTIVE_SESSIONS_LISTED,
    });
  },

  /**
   * One session row scoped to BOTH ids — the IDOR-guard read primitive.
   * Returns the row (regardless of revoked/expired state — the service
   * uses that to tell idempotent-200 from 404) or null when the id doesn't
   * exist *for this user*. A foreign user's session is indistinguishable
   * from a nonexistent one by construction.
   */
  async getForUser(sessionId, userId) {
    if (!sessionId || !userId) return null;
    return prisma.session.findFirst({
      where: { id: sessionId, userId },
    });
  },

  /**
   * Revoke one ACTIVE session, scoped to BOTH ids (idempotent). Returns the
   * count (1 = effective revocation; 0 = unknown / foreign / already
   * revoked / expired — never throws for any of those).
   */
  async revokeForUser(sessionId, userId, when = new Date()) {
    if (!sessionId || !userId) return 0;
    const result = await prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null, expiresAt: { gt: when } },
      data: { revokedAt: when },
    });
    return result.count;
  },

  /**
   * Revoke every ACTIVE session for a user except (optionally) one —
   * the "sign out everywhere else" primitive. `exceptSid` null/undefined
   * revokes all of them. Returns the count of effectively revoked rows
   * (expired/already-revoked rows are neither touched nor counted, so the
   * count is honest for the SESSIONS_REVOKED audit payload). Idempotent.
   */
  async revokeAllForUserExcept(userId, exceptSid, when = new Date()) {
    if (!userId) return 0;
    const where = { userId, revokedAt: null, expiresAt: { gt: when } };
    if (exceptSid) where.id = { not: exceptSid };
    const result = await prisma.session.updateMany({
      where,
      data: { revokedAt: when },
    });
    return result.count;
  },
};

export default sessionRepository;
