/*
 * sessionManagementService — Sprint 3b (Session Management API).
 *
 * OWNER-only policy layer for VIEWING and REVOKING sessions, sitting
 * between the three routes under app/api/admin/users/[id]/sessions/* and
 * the (policy-free) sessionRepository. Deliberately a SEPARATE service
 * from lib/admin/auth/sessionService.js — the auth-path service is the
 * per-request validity predicate with fail-closed, null-returning
 * semantics; management operations have the opposite error contract
 * (throw with statusCode/code, like userService) and must never be mixed
 * into the auth path. sessionService is NOT touched by this sprint.
 *
 * Policy owned here (SPRINT_3B_SESSION_MANAGEMENT_API_PLAN.md §1.5–1.6,
 * all approved):
 *
 *   - SECOND OWNER GATE: assertActorIsOwner on every method, independent
 *     of the routes' requireOwner() — same defense-in-depth as
 *     userService, so dropping one gate in a refactor leaves the other.
 *   - Target user must exist → otherwise 404 USER_NOT_FOUND.
 *   - SCOPED 404: a session id that doesn't exist FOR THE TARGET USER —
 *     whether it never existed or belongs to someone else — yields one
 *     identical 404 SESSION_NOT_FOUND. No cross-user existence oracle.
 *   - 409 CANNOT_REVOKE_CURRENT_SESSION: the acting Owner cannot
 *     single-revoke the session they are acting from (logout is the
 *     explicit action for that — it also clears the cookie). Same
 *     philosophy as userService's CANNOT_DISABLE_SELF.
 *   - Self revoke-all SPARES the current session ("sign out everywhere
 *     else") — the Owner can never strand themself mid-request.
 *   - IDEMPOTENT: already-revoked/expired sessions and concurrent
 *     double-revokes resolve to 200 { revoked: 0 }, never an error.
 *
 * AUDIT HYGIENE (approved decisions — stricter than the Sprint 2b user
 * events): payloads carry ONLY the allowlisted { scope } /
 * { scope, revokedCount }; metadata is deliberately EMPTY — no ipAddress/
 * userAgent passthrough (unlike emitUserEvent's requestMetadata), and
 * never a sid, JWT, cookie, token, or raw request data. UserSessionRevoked
 * is emitted only for an EFFECTIVE revocation (count === 1);
 * UserSessionsRevoked records intent and is emitted even at count 0.
 * Same committed-mutation-wins semantics as userService.emitUserEvent:
 * an emit failure is logged as an audit gap, never turned into a failed
 * response for a revocation that actually happened.
 */

import { sessionRepository } from './repository/sessionRepository';
import { userRepository } from './repository/userRepository';
import { ROLE, ENTITY_TYPE } from './constants/enums';
import { eventService } from './engine/eventService';
import { EVENT_TYPE } from './engine/eventTypes';

function assertActorIsOwner(actorRole, action) {
  if (actorRole !== ROLE.OWNER) {
    const err = new Error(
      `[${action}] actorRole "${actorRole}" is not permitted — only OWNER may manage sessions.`
    );
    err.statusCode = 403;
    err.code = 'FORBIDDEN_ROLE';
    throw err;
  }
}

function validationError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = 'VALIDATION_ERROR';
  err.fieldErrors = {};
  return err;
}

function userNotFoundError() {
  const err = new Error('User not found.');
  err.statusCode = 404;
  err.code = 'USER_NOT_FOUND';
  return err;
}

/**
 * The one scoped 404 for both "never existed" and "belongs to another
 * user" — built in exactly one place so the two cases can never drift
 * into distinguishable responses.
 */
function sessionNotFoundError() {
  const err = new Error('Session not found.');
  err.statusCode = 404;
  err.code = 'SESSION_NOT_FOUND';
  return err;
}

/** 404 the target user id unless a user row exists. Returns nothing usable — existence check only. */
async function assertTargetUserExists(targetUserId) {
  const target = await userRepository.getSafeById(targetUserId);
  if (!target) throw userNotFoundError();
}

/**
 * Minimal safe DTO for one listed session row (plan §1.3): id (the revoke
 * target — a sid alone is not a credential; authenticating requires the
 * JWT signed over it), createdAt/expiresAt as ISO strings, and isCurrent.
 * Nothing else: no userId (implied by the URL), no revokedAt (always null
 * for listed rows), and no IP/user-agent/lastSeen (columns don't exist).
 */
function toSessionDto(row, actorSid) {
  return {
    id: row.id,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    expiresAt: row.expiresAt instanceof Date ? row.expiresAt.toISOString() : row.expiresAt,
    isCurrent: Boolean(actorSid) && row.id === actorSid,
  };
}

/**
 * Sprint 3b audit emission — same committed-mutation-wins try/catch as
 * userService.emitUserEvent, with one deliberate difference: `metadata`
 * is ALWAYS {} (approved decision — no IP/user-agent/raw request data on
 * session-revocation events). `payload` is constructed by the callers
 * below with named keys only; this helper adds nothing.
 */
async function emitSessionEvent(type, { targetUserId, actorId, correlationId, payload }) {
  try {
    await eventService.emit(type, {
      entityType: ENTITY_TYPE.USER,
      entityId: targetUserId,
      actorId: actorId || null,
      correlationId,
      payload: payload || {},
      metadata: {},
    });
  } catch (err) {
    console.error(
      `[sessionManagementService] AUDIT GAP — revocation committed but event "${type}" failed to persist ` +
        `(target=${targetUserId}, actor=${actorId || 'unknown'}, correlationId=${correlationId || 'n/a'}):`,
      err
    );
  }
}

export const sessionManagementService = {
  /**
   * Owner-only. The target user's ACTIVE sessions as safe DTOs, newest
   * first, hard-capped at 50 (repository-enforced). `isCurrent` is stamped
   * from the acting Owner's own sid — only ever true when an Owner views
   * their own list.
   *
   * @returns {Promise<Array<{id, createdAt, expiresAt, isCurrent}>>}
   */
  async listSessions(targetUserId, { actorRole, actorSid } = {}) {
    assertActorIsOwner(actorRole, 'sessionManagementService.listSessions');
    if (!targetUserId) throw validationError('User id is required.');

    await assertTargetUserExists(targetUserId);

    const rows = await sessionRepository.listActiveForUser(targetUserId);
    return rows.map((row) => toSessionDto(row, actorSid));
  },

  /**
   * Owner-only. Revoke ONE of the target user's sessions.
   *
   *   - 409 CANNOT_REVOKE_CURRENT_SESSION when sessionId is the acting
   *     Owner's own current session (checked BEFORE any write).
   *   - { revoked: 1 } for an effective revocation (+ audit event).
   *   - { revoked: 0 } when the session exists for this user but is
   *     already revoked/expired (idempotent — includes the losing side of
   *     a concurrent double-revoke; NO audit event, nothing happened).
   *   - 404 SESSION_NOT_FOUND when no such session exists for this user —
   *     nonexistent and foreign ids are indistinguishable by construction
   *     (the post-miss read is scoped by BOTH ids).
   *
   * @returns {Promise<{revoked: 0|1}>}
   */
  async revokeSession(targetUserId, sessionId, { actorId, actorRole, actorSid, correlationId } = {}) {
    assertActorIsOwner(actorRole, 'sessionManagementService.revokeSession');
    if (!targetUserId) throw validationError('User id is required.');
    if (!sessionId) throw validationError('Session id is required.');

    await assertTargetUserExists(targetUserId);

    if (actorSid && sessionId === actorSid) {
      const err = new Error('Use logout to end your current session.');
      err.statusCode = 409;
      err.code = 'CANNOT_REVOKE_CURRENT_SESSION';
      throw err;
    }

    const count = await sessionRepository.revokeForUser(sessionId, targetUserId);

    if (count === 1) {
      // Allowlisted payload only — scope, nothing else. Never the sid.
      await emitSessionEvent(EVENT_TYPE.USER_SESSION_REVOKED, {
        targetUserId,
        actorId,
        correlationId,
        payload: { scope: 'single' },
      });
      return { revoked: 1 };
    }

    // 0-row revoke: distinguish idempotent success from a scoped 404 with
    // ONE read keyed by BOTH ids. Row exists (necessarily revoked or
    // expired — active rows would have matched the update) → idempotent.
    const row = await sessionRepository.getForUser(sessionId, targetUserId);
    if (row) return { revoked: 0 };
    throw sessionNotFoundError();
  },

  /**
   * Owner-only. Revoke ALL of the target user's active sessions. When the
   * Owner targets THEMSELF the current session is spared ("sign out
   * everywhere else") — they can never lock themself out mid-request;
   * ending everything remains revoke-all + logout. The revoke-all INTENT
   * is audited even when nothing was revoked (revokedCount 0).
   *
   * @returns {Promise<{revoked: number}>}
   */
  async revokeAllSessions(targetUserId, { actorId, actorRole, actorSid, correlationId } = {}) {
    assertActorIsOwner(actorRole, 'sessionManagementService.revokeAllSessions');
    if (!targetUserId) throw validationError('User id is required.');

    await assertTargetUserExists(targetUserId);

    const exceptSid = actorId && targetUserId === actorId ? actorSid : null;
    const revoked = await sessionRepository.revokeAllForUserExcept(targetUserId, exceptSid);

    // Allowlisted payload only — scope + honest count. Never a sid (not
    // even the spared one), never request/connection data.
    await emitSessionEvent(EVENT_TYPE.USER_SESSIONS_REVOKED, {
      targetUserId,
      actorId,
      correlationId,
      payload: { scope: 'all', revokedCount: revoked },
    });

    return { revoked };
  },
};

export default sessionManagementService;
