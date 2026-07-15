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
};

export default sessionRepository;
