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
   * Look up a user by id, excluding passwordHash — Sprint 3.1 (User Details
   * Page). Distinct from getById() above: that method is on the
   * login/session-resolution path and genuinely needs the hash (or, for
   * session resolution, is fine returning the full row since it never
   * leaves the server). This one backs userService.getUserDetail(), whose
   * result is serialized straight into a Server Component prop and down
   * into a Client Component — it must never carry passwordHash across that
   * boundary, same reasoning as every other SAFE_USER_SELECT method here.
   */
  async getSafeById(userId) {
    if (!userId) return null;
    return prisma.user.findUnique({
      where: { id: userId },
      select: SAFE_USER_SELECT,
    });
  },

  /**
   * Batched safe lookup by id — Sprint 2: Real Event-Based History
   * Timeline. Resolves the distinct actorIds collected off a talent's
   * Event rows in ONE query (id IN (...)), so the history timeline never
   * does an N+1 per-event user fetch. Same SAFE_USER_SELECT projection as
   * getSafeById above — results flow into Server Component props, so
   * passwordHash must never be selected. Ids that don't resolve (deleted
   * users) are simply absent from the result; callers render "—" for them.
   *
   * @param {string[]} userIds
   * @returns {Promise<object[]>}
   */
  async getSafeByIds(userIds) {
    const ids = [...new Set((Array.isArray(userIds) ? userIds : []).filter(Boolean))];
    if (ids.length === 0) return [];
    return prisma.user.findMany({
      where: { id: { in: ids } },
      select: SAFE_USER_SELECT,
    });
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
   * Update a user's email — Sprint 3.2 (User Detail UX Cleanup). Mirrors
   * updateDisplayName() above exactly; format validation and
   * duplicate-email protection both live in userService.updateEmail, not
   * here (same "repository stays decision-free" convention as the rest of
   * this file).
   */
  async updateEmail(userId, email) {
    if (!userId) return null;
    return prisma.user.update({
      where: { id: userId },
      data: { email },
      select: SAFE_USER_SELECT,
    });
  },

  /**
   * Set a user active or inactive. An inactive user fails login (see
   * app/api/admin/auth/login/route.js). Sprint 3a: this plain variant is
   * now only used for REACTIVATION (isActive: true) — deactivation goes
   * through setActiveAndRevokeSessions() below so the user's live sessions
   * die atomically with the flag flip. Reactivation deliberately revokes
   * nothing and never un-sets revokedAt on old sessions.
   */
  async setActive(userId, isActive) {
    if (!userId) return null;
    return prisma.user.update({
      where: { id: userId },
      data: { isActive: Boolean(isActive) },
      select: SAFE_USER_SELECT,
    });
  },

  /**
   * Sprint 3a (Session Security Foundation) — composite transactional
   * method: flip isActive AND revoke every active session for the user in
   * ONE prisma.$transaction, so both writes commit together or roll back
   * together (a deactivation can never commit while its revoke-all
   * silently fails — plan Section D). Mechanism only, no policy: the
   * decision of WHEN to use this vs plain setActive() (deactivate vs
   * reactivate) belongs to userService.setActive. Transactions live inside
   * repository methods per the existing convention
   * (talentRepository.publishTalentVersion et al.).
   */
  async setActiveAndRevokeSessions(userId, isActive) {
    if (!userId) return null;
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { isActive: Boolean(isActive) },
        select: SAFE_USER_SELECT,
      }),
      prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return updatedUser;
  },

  /**
   * Sprint 3a — composite transactional method: overwrite the password
   * hash AND revoke every active session for the user in ONE
   * prisma.$transaction (same commit-together-or-not-at-all guarantee as
   * setActiveAndRevokeSessions above). Backs userService.resetPassword —
   * an Owner-issued reset must kill every live session for the credential
   * it invalidates, including the Owner's own when self-resetting. Takes
   * an already-hashed value; returns the safe projection only, the hash
   * itself is never selected back out.
   */
  async updatePasswordHashAndRevokeSessions(userId, passwordHash) {
    if (!userId) return null;
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
        select: SAFE_USER_SELECT,
      }),
      prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return updatedUser;
  },

  /**
   * Overwrite a user's passwordHash — Sprint 3.1 (User Details Page),
   * backs the Owner-initiated "reset password" action in the Security
   * section (userService.resetPassword). Takes an already-hashed value,
   * same convention as createOwner()/createEmployee() — bcrypt usage stays
   * confined to lib/admin/auth/password.js. Returns the safe projection
   * only; the hash itself is never selected back out.
   */
  async updatePasswordHash(userId, passwordHash) {
    if (!userId) return null;
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
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
