/*
 * User repository — Phase 2: Auth/Security, extended by the User Model
 * Completion sprint (Sprint 2).
 *
 * Implements the data-access methods auth and basic user management need
 * (ADMIN_PANEL_PLAN.md Section 11): looking up a user for login/session
 * resolution, creating the single Owner account via the one-off
 * `scripts/create-owner.js` script (no public signup flow exists or is
 * planned), and the small set of profile/management operations added in
 * Sprint 2 (list, create Employee, rename, activate/deactivate, record
 * last login). No permission tables, capability helper, or new roles are
 * part of this repository — see prisma/schema.prisma's User model comment.
 *
 * Callers (lib/admin/auth/*, scripts/create-owner.js) never construct
 * Prisma queries themselves — they go through this module, consistent with
 * the rest of the repository layer.
 */

import { prisma } from '../db';
import { ROLE } from '../constants/enums';

/**
 * Fields safe to return from list/management operations — deliberately
 * excludes passwordHash. getByEmail/getById below still return the full
 * row (including passwordHash) since the login route needs it to verify
 * credentials; every other method here is not on that path and should
 * never leak a hash outward.
 */
const SAFE_USER_SELECT = {
  id: true,
  email: true,
  role: true,
  displayName: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

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

  /**
   * List every user (OWNER and EMPLOYEE alike), newest first. Excludes
   * passwordHash. No Users UI consumes this yet (Sprint 2 deliberately
   * doesn't build one) — this exists so the repository layer is complete
   * ahead of that UI, and so it can be exercised directly in the interim
   * (e.g. via a script or the manual test checklist).
   */
  async listUsers() {
    return prisma.user.findMany({
      select: SAFE_USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Create an EMPLOYEE account. Distinct from createOwner() — always
   * role: 'EMPLOYEE', never OWNER, and takes a displayName since Employee
   * accounts are managed by someone else (an Owner) rather than
   * self-provisioned via scripts/create-owner.js. Does not hash the
   * password itself — callers pass an already-hashed value, same
   * convention as createOwner(), keeping bcrypt usage confined to
   * lib/admin/auth/password.js and scripts/create-owner.js.
   */
  async createEmployee({ email, passwordHash, displayName }) {
    return prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        passwordHash,
        displayName: displayName ?? null,
        role: ROLE.EMPLOYEE,
      },
      select: SAFE_USER_SELECT,
    });
  },

  /** Update a user's display name. */
  async updateDisplayName(userId, displayName) {
    if (!userId) return null;
    return prisma.user.update({
      where: { id: userId },
      data: { displayName: displayName ?? null },
      select: SAFE_USER_SELECT,
    });
  },

  /**
   * Set a user active or inactive. An inactive user fails login (see
   * app/api/admin/auth/login/route.js) but existing sessions already
   * issued before deactivation are not individually revoked by this call
   * — session tokens are stateless JWTs (lib/admin/auth/session.js) valid
   * until their own expiry. Out of scope for this sprint; revisit if
   * immediate session revocation is ever required.
   */
  async setActive(userId, isActive) {
    if (!userId) return null;
    return prisma.user.update({
      where: { id: userId },
      data: { isActive: Boolean(isActive) },
      select: SAFE_USER_SELECT,
    });
  },

  /** Stamp lastLoginAt to now (or an explicit timestamp). Called by the login route on every successful login. */
  async updateLastLoginAt(userId, when = new Date()) {
    if (!userId) return null;
    return prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: when },
    });
  },

  /**
   * Count active (isActive: true) OWNER accounts. Sprint 3 (Users UI) —
   * backs userService.setActive's "never disable the last remaining Owner"
   * rule. Written against "active Owner count", not "the one Owner
   * account", so the rule still behaves correctly if a second Owner is ever
   * provisioned later (Section 11 keeps the schema ready for that even
   * though no UI creates a second OWNER today).
   */
  async countActiveOwners() {
    return prisma.user.count({ where: { role: ROLE.OWNER, isActive: true } });
  },
};

export default userRepository;
