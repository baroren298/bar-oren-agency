/*
 * User repository — Phase 2: Auth/Security.
 *
 * Implements the data-access methods auth needs (ADMIN_PANEL_PLAN.md
 * Section 11): looking up a user for login/session resolution, and
 * creating the single Owner account via the one-off `scripts/create-owner.js`
 * script (no public signup flow exists or is planned).
 *
 * Callers (lib/admin/auth/*, scripts/create-owner.js) never construct
 * Prisma queries themselves — they go through this module, consistent with
 * the rest of the repository layer.
 */

import { prisma } from '../db';

export const userRepository = {
  /** Look up a user by email (used by the login route). Case-insensitive. */
  async getByEmail(email) {
    if (!email) return null;
    return prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
  },

  /** Look up a user by id (used by session resolution in getSessionUser()). */
  async getById(userId) {
    if (!userId) return null;
    return prisma.user.findUnique({ where: { id: userId } });
  },

  /**
   * Create the single Owner user at setup time. No public signup flow is
   * planned (Section 11) — this is only ever called from
   * scripts/create-owner.js, run manually on the machine/host that has
   * DATABASE_URL configured, never from an HTTP route.
   */
  async createOwner({ email, passwordHash }) {
    return prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        passwordHash,
        role: 'OWNER',
      },
    });
  },
};

export default userRepository;
