/*
 * userService — Sprint 3: Users UI.
 *
 * Small business-rule layer sitting between the Owner Users UI's API routes
 * (app/api/admin/users/*) and userRepository (Sprint 2's data-access
 * layer). Deliberately NOT under lib/admin/engine/ — the Core Content
 * Engine there (proposalService/approvalService/publishService/etc.) is
 * specifically the Draft -> Proposed -> Approved -> Published versioning
 * system for content entities (talent, site content, SEO...); user accounts
 * have no such lifecycle (ADMIN_PANEL_PLAN.md Section 11: "no permission
 * tables, capability helper, or new roles"), so there is nothing here for
 * the engine's adapter contract to model. This file exists only to hold the
 * handful of rules that don't belong in a route handler (no DB access) and
 * don't belong in userRepository either (Sprint 2's design keeps that layer
 * decision-free):
 *
 *   - re-checking the actor is OWNER (defense in depth — route-level
 *     requireOwner() is the first gate, this is the second, independent
 *     one, same pattern as lib/admin/engine/approvalService.js's
 *     assertActorIsOwner)
 *   - field validation for create/update (email shape, temporary password
 *     length, displayName required)
 *   - the two safety rules this sprint's brief calls for: never let an
 *     Owner disable their own account, and never disable the last
 *     remaining active Owner account
 *
 * Every method takes an explicit actorRole (and, for setActive, an
 * actorId) rather than reading a session itself — callers (routes) are
 * still responsible for calling requireOwner(request) first and passing
 * the verified session through, exactly like approvalService.approve()'s
 * actorRole/actorId params.
 */

import { userRepository } from './repository/userRepository';
import { hashPassword } from './auth/password';
import { ROLE } from './constants/enums';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Deliberately lower than scripts/create-owner.mjs's 12-character Owner
// minimum — this is a temporary password an Owner hands to a new Employee
// out of band, not a long-lived credential the Employee chose themselves.
// No forced-change-on-first-login or self-service reset flow exists yet
// (both explicitly out of scope this sprint), so 8 is a floor, not a target.
const MIN_TEMP_PASSWORD_LENGTH = 8;

function assertActorIsOwner(actorRole, action) {
  if (actorRole !== ROLE.OWNER) {
    const err = new Error(
      `[${action}] actorRole "${actorRole}" is not permitted — only OWNER may manage users.`
    );
    err.statusCode = 403;
    err.code = 'FORBIDDEN_ROLE';
    throw err;
  }
}

function validationError(message, fieldErrors) {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = 'VALIDATION_ERROR';
  err.fieldErrors = fieldErrors || {};
  return err;
}

function notFoundError(message) {
  const err = new Error(message);
  err.statusCode = 404;
  err.code = 'NOT_FOUND';
  return err;
}

export const userService = {
  /** Owner-only. Returns every user (excludes passwordHash — see userRepository.SAFE_USER_SELECT). */
  async listUsers({ actorRole } = {}) {
    assertActorIsOwner(actorRole, 'userService.listUsers');
    return userRepository.listUsers();
  },

  /**
   * Owner-only. Creates a new EMPLOYEE account (never OWNER — no route or
   * service method here can ever provision a second Owner; that stays
   * script-only per scripts/create-owner.mjs).
   */
  async createEmployee({ email, displayName, temporaryPassword }, { actorRole } = {}) {
    assertActorIsOwner(actorRole, 'userService.createEmployee');

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const trimmedDisplayName = typeof displayName === 'string' ? displayName.trim() : '';
    const password = typeof temporaryPassword === 'string' ? temporaryPassword : '';

    const fieldErrors = {};
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      fieldErrors.email = 'A valid email address is required.';
    }
    if (!trimmedDisplayName) {
      fieldErrors.displayName = 'Display name is required.';
    }
    if (!password || password.length < MIN_TEMP_PASSWORD_LENGTH) {
      fieldErrors.temporaryPassword = `Temporary password must be at least ${MIN_TEMP_PASSWORD_LENGTH} characters.`;
    }
    if (Object.keys(fieldErrors).length > 0) {
      throw validationError('Please fix the highlighted fields.', fieldErrors);
    }

    const existing = await userRepository.getByEmail(normalizedEmail);
    if (existing) {
      throw validationError('A user with this email already exists.', {
        email: 'A user with this email already exists.',
      });
    }

    const passwordHash = await hashPassword(password);
    return userRepository.createEmployee({
      email: normalizedEmail,
      passwordHash,
      displayName: trimmedDisplayName,
    });
  },

  /** Owner-only. Renames any user's displayName (Owner or Employee). */
  async updateDisplayName(userId, displayName, { actorRole } = {}) {
    assertActorIsOwner(actorRole, 'userService.updateDisplayName');

    if (!userId) {
      throw validationError('User id is required.', {});
    }
    const trimmed = typeof displayName === 'string' ? displayName.trim() : '';
    if (!trimmed) {
      throw validationError('Display name is required.', { displayName: 'Display name is required.' });
    }

    const target = await userRepository.getById(userId);
    if (!target) {
      throw notFoundError('User not found.');
    }

    return userRepository.updateDisplayName(userId, trimmed);
  },

  /**
   * Owner-only. Toggles isActive, enforcing two safety rules before ever
   * touching the DB when deactivating (nextActive === false):
   *
   *   1. An Owner may never disable their own account (actorId === target
   *      id) — there is no self-service reactivation or password reset
   *      flow (both out of scope this sprint), so a self-disable would
   *      permanently lock the acting Owner out with no recovery path short
   *      of direct DB/script access.
   *   2. Nobody may disable the last remaining active Owner account,
   *      regardless of who is asking — same reasoning, generalized: the
   *      whole admin panel would become inaccessible to every Owner-only
   *      surface (including this one) with no way back in.
   *
   * Re-activating (nextActive === true) is never blocked by either rule.
   */
  async setActive(userId, isActive, { actorId, actorRole } = {}) {
    assertActorIsOwner(actorRole, 'userService.setActive');

    if (!userId) {
      throw validationError('User id is required.', {});
    }

    const target = await userRepository.getById(userId);
    if (!target) {
      throw notFoundError('User not found.');
    }

    const nextActive = Boolean(isActive);

    if (!nextActive) {
      if (actorId && target.id === actorId) {
        const err = new Error('You cannot disable your own account.');
        err.statusCode = 409;
        err.code = 'CANNOT_DISABLE_SELF';
        throw err;
      }

      if (target.role === ROLE.OWNER && target.isActive) {
        const activeOwners = await userRepository.countActiveOwners();
        if (activeOwners <= 1) {
          const err = new Error('You cannot disable the only Owner account.');
          err.statusCode = 409;
          err.code = 'CANNOT_DISABLE_ONLY_OWNER';
          throw err;
        }
      }
    }

    return userRepository.setActive(userId, nextActive);
  },
};

export default userService;
