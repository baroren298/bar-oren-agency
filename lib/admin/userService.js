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
import { ROLE, ENTITY_TYPE } from './constants/enums';
import { eventService } from './engine/eventService';
import { EVENT_TYPE } from './engine/eventTypes';

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

/**
 * Administration Sprint 2b — emit one user-management event AFTER its
 * mutation has committed. Two deliberate rules live here:
 *
 * 1. PAYLOAD ALLOWLIST: callers pass an explicitly constructed `payload`
 *    (never a spread of a request body or DB row) so no passwordHash,
 *    temporary credential, or unrelated column can ever reach the Event/
 *    AuditLog tables. This helper adds nothing to it.
 *
 * 2. COMMITTED-MUTATION-WINS CONSISTENCY: if writing the Event row itself
 *    fails, the user mutation has already committed — throwing here would
 *    make the route return a failure for an action that actually happened,
 *    inviting a retry with real duplicate-action risk (a retried create
 *    hits "email already exists"; a retried password reset silently
 *    re-invalidates a credential the Owner already handed out). So the
 *    emit error is caught and logged as a critical audit-gap error, and
 *    the caller still returns success. This is scoped to user-management
 *    emission only; eventService itself is unchanged. Listener failures
 *    are a separate case eventService already handles (it catches and
 *    logs them — Section 13.13), which is preserved as-is: the Event row
 *    is the durable record and the AuditLog projection can be backfilled.
 *
 * `metadata` carries technical/request context only ({ ipAddress,
 * userAgent } from the route) — the exact passthrough Sprint 2a's
 * auditLogListener already projects into AuditLog's existing columns.
 */
async function emitUserEvent(type, { targetUserId, actorId, correlationId, payload, metadata }) {
  try {
    await eventService.emit(type, {
      entityType: ENTITY_TYPE.USER,
      entityId: targetUserId,
      actorId: actorId || null,
      correlationId,
      payload: payload || {},
      metadata: metadata || {},
    });
  } catch (err) {
    console.error(
      `[userService] AUDIT GAP — mutation committed but event "${type}" failed to persist ` +
        `(target=${targetUserId}, actor=${actorId || 'unknown'}, correlationId=${correlationId || 'n/a'}):`,
      err
    );
  }
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
  async createEmployee(
    { email, displayName, temporaryPassword },
    { actorId, actorRole, correlationId, requestMetadata } = {}
  ) {
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
    const created = await userRepository.createEmployee({
      email: normalizedEmail,
      passwordHash,
      displayName: trimmedDisplayName,
    });

    // Sprint 2b — allowlisted payload only: the three created business
    // fields, never the password, hash, or a spread of the created row.
    await emitUserEvent(EVENT_TYPE.USER_CREATED, {
      targetUserId: created.id,
      actorId,
      correlationId,
      payload: {
        email: created.email,
        displayName: created.displayName,
        role: created.role,
      },
      metadata: requestMetadata,
    });

    return created;
  },

  /**
   * Owner-only. Returns a single user's safe fields (no passwordHash) for
   * the /admin/users/[id] detail page — Sprint 3.1 (User Details Page).
   * Same shape as listUsers()'s rows, just one of them. 404s when the id
   * doesn't exist so the route/page can render a real not-found instead of
   * null.
   */
  async getUserDetail(userId, { actorRole } = {}) {
    assertActorIsOwner(actorRole, 'userService.getUserDetail');

    if (!userId) {
      throw validationError('User id is required.', {});
    }

    const user = await userRepository.getSafeById(userId);
    if (!user) {
      throw notFoundError('User not found.');
    }
    return user;
  },

  /** Owner-only. Renames any user's displayName (Owner or Employee). */
  async updateDisplayName(userId, displayName, { actorId, actorRole, correlationId, requestMetadata } = {}) {
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

    const updated = await userRepository.updateDisplayName(userId, trimmed);

    // Sprint 2b — safe before/after: exactly the one changed field, picked
    // explicitly off the pre-fetched target (never a row spread).
    await emitUserEvent(EVENT_TYPE.USER_DETAILS_UPDATED, {
      targetUserId: userId,
      actorId,
      correlationId,
      payload: {
        changedFields: ['displayName'],
        before: { displayName: target.displayName },
        after: { displayName: trimmed },
      },
      metadata: requestMetadata,
    });

    return updated;
  },

  /**
   * Owner-only. Updates any user's email — Sprint 3.2 (User Detail UX
   * Cleanup), QA finding #4 ("Owner needs to edit user email as well as
   * displayName"). Mirrors createEmployee()'s email validation exactly
   * (format via EMAIL_REGEX, normalized to trimmed lowercase) plus the same
   * duplicate-email protection, checked against every *other* user (a
   * no-op re-save of a user's own current email is never rejected as
   * "taken").
   */
  async updateEmail(userId, email, { actorId, actorRole, correlationId, requestMetadata } = {}) {
    assertActorIsOwner(actorRole, 'userService.updateEmail');

    if (!userId) {
      throw validationError('User id is required.', {});
    }

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      throw validationError('Please fix the highlighted fields.', {
        email: 'A valid email address is required.',
      });
    }

    const target = await userRepository.getById(userId);
    if (!target) {
      throw notFoundError('User not found.');
    }

    if (normalizedEmail !== target.email) {
      const existing = await userRepository.getByEmail(normalizedEmail);
      if (existing && existing.id !== userId) {
        throw validationError('A user with this email already exists.', {
          email: 'A user with this email already exists.',
        });
      }
    }

    const updated = await userRepository.updateEmail(userId, normalizedEmail);

    await emitUserEvent(EVENT_TYPE.USER_DETAILS_UPDATED, {
      targetUserId: userId,
      actorId,
      correlationId,
      payload: {
        changedFields: ['email'],
        before: { email: target.email },
        after: { email: normalizedEmail },
      },
      metadata: requestMetadata,
    });

    return updated;
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
  async setActive(userId, isActive, { actorId, actorRole, correlationId, requestMetadata } = {}) {
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

    const updated = await userRepository.setActive(userId, nextActive);

    // Sprint 2b — activation and deactivation are distinct event types
    // (never one generic "toggled" event). Payload is deliberately empty:
    // the action type + target entityId already tell the whole story, and
    // the audit narrative needs no extra personal data.
    await emitUserEvent(
      nextActive ? EVENT_TYPE.USER_ACTIVATED : EVENT_TYPE.USER_DEACTIVATED,
      {
        targetUserId: userId,
        actorId,
        correlationId,
        payload: {},
        metadata: requestMetadata,
      }
    );

    return updated;
  },

  /**
   * Owner-only. Resets any user's password to a new Owner-supplied
   * temporary value — Sprint 3.1 (User Details Page), Security section.
   * Deliberately the only password-reset path that exists: no employee
   * self-service reset and no emailed reset link (both explicitly out of
   * scope). Same MIN_TEMP_PASSWORD_LENGTH floor and hashPassword() call as
   * createEmployee() above, so a reset password is held to the same bar a
   * brand-new Employee's temporary password already is. Never returns the
   * new plaintext or the hash — callers (the route) only get the safe user
   * projection back, same as every other write here.
   */
  async resetPassword(userId, temporaryPassword, { actorId, actorRole, correlationId, requestMetadata } = {}) {
    assertActorIsOwner(actorRole, 'userService.resetPassword');

    if (!userId) {
      throw validationError('User id is required.', {});
    }

    const password = typeof temporaryPassword === 'string' ? temporaryPassword : '';
    if (!password || password.length < MIN_TEMP_PASSWORD_LENGTH) {
      throw validationError('Please fix the highlighted fields.', {
        temporaryPassword: `Temporary password must be at least ${MIN_TEMP_PASSWORD_LENGTH} characters.`,
      });
    }

    const target = await userRepository.getSafeById(userId);
    if (!target) {
      throw notFoundError('User not found.');
    }

    const passwordHash = await hashPassword(password);
    const updated = await userRepository.updatePasswordHash(userId, passwordHash);

    // Sprint 2b — payload is deliberately EMPTY: no password, no hash, no
    // temporary credential, and no derived hint (not even a length). The
    // audit narrative is fully carried by the event type + entityId +
    // actorId.
    await emitUserEvent(EVENT_TYPE.USER_PASSWORD_RESET, {
      targetUserId: userId,
      actorId,
      correlationId,
      payload: {},
      metadata: requestMetadata,
    });

    return updated;
  },
};

export default userService;
