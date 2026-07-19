/*
 * talentArchiveService — Talent Archive & Restore feature (final CMS v1
 * feature).
 *
 * Business-rule layer between the archive/restore admin API routes
 * (app/api/admin/talent/[id]/archive|restore) and talentAdapter. Mirrors
 * lib/admin/clientService.js's archiveClient shape exactly (actor-role
 * re-assertion, idempotence via 409, event emission after the committed
 * mutation) — adapted to go through talentAdapter rather than a bare
 * repository, since Talent (unlike Client) is a full Core Content Engine
 * entity: every other Talent mutation already goes through talentAdapter,
 * never talentRepository directly (Section 13.15's layering rule).
 *
 * Rules that live here (and nowhere else):
 *   - OWNER ONLY for both archive and restore — re-asserted here
 *     independently of the route-level requireOwner() gate, same defense
 *     in depth every other service in this codebase already applies.
 *     Neither action is ever available to EMPLOYEE, unlike the normal
 *     Draft -> Proposed -> Published flow.
 *   - archive/restore is a pure status transition on the Talent row only
 *     (talentRepository.archiveTalent/restoreTalent): no cascade to
 *     TalentVersion/TalentSocial/TalentGalleryImage, no change to
 *     currentPublishedVersionId/revisionNumber. All history, media,
 *     socials, and SEO fields (every one of them a versioned field on
 *     those child rows) are therefore preserved by construction, not by
 *     any explicit "preserve" step here.
 *   - no hard delete, ever — archive only ever sets LIFECYCLE_STATUS.
 *     ARCHIVED; restore only ever sets it back to ACTIVE.
 *   - idempotence: archiving an already-archived talent, or restoring a
 *     talent that isn't archived, is a 409 — not a silent success.
 *   - event emission AFTER the committed mutation, allowlisted payload
 *     (slug + resulting status only — never version/profile content).
 *     Same committed-mutation-wins error handling as clientService's
 *     emitClientBrandEvent: a failed emit is logged as an audit gap, never
 *     rethrown, so a listener failure can't undo an already-committed
 *     archive/restore.
 */

import { talentAdapter } from './engine/adapters/talentAdapter';
import { ROLE, ENTITY_TYPE, LIFECYCLE_STATUS } from './constants/enums';
import { eventService } from './engine/eventService';
import { EVENT_TYPE } from './engine/eventTypes';
import { he } from './i18n/he';

const ERR = he.talent.archive.errors;

function forbiddenError() {
  const err = new Error(ERR.ownerOnly);
  err.statusCode = 403;
  err.code = 'FORBIDDEN_ROLE';
  return err;
}

function invalidBodyError() {
  const err = new Error(ERR.invalidBody);
  err.statusCode = 400;
  err.code = 'VALIDATION_ERROR';
  return err;
}

function notFoundError() {
  const err = new Error(ERR.talentNotFound);
  err.statusCode = 404;
  err.code = 'NOT_FOUND';
  return err;
}

function conflictError(message, code) {
  const err = new Error(message);
  err.statusCode = 409;
  err.code = code;
  return err;
}

/** Archive/restore is OWNER-only — re-asserted here independently of the route gate. */
function assertActorIsOwner(actorRole) {
  if (actorRole !== ROLE.OWNER) throw forbiddenError();
}

/**
 * Emit one talent archive/restore event AFTER its mutation committed —
 * allowlisted payload only, committed-mutation-wins on emit failure (see
 * header + clientService.emitClientBrandEvent for the identical pattern).
 */
async function emitTalentArchiveEvent(
  type,
  { entityId, actorId, correlationId, payload, metadata }
) {
  try {
    await eventService.emit(type, {
      entityType: ENTITY_TYPE.TALENT,
      entityId,
      actorId: actorId || null,
      correlationId,
      payload: payload || {},
      metadata: metadata || {},
    });
  } catch (err) {
    console.error(
      `[talentArchiveService] AUDIT GAP — mutation committed but event "${type}" failed to persist ` +
        `(entity=TALENT:${entityId}, actor=${actorId || 'unknown'}, correlationId=${correlationId || 'n/a'}):`,
      err
    );
  }
}

export const talentArchiveService = {
  /**
   * OWNER ONLY. Archive a talent (status -> ARCHIVED + attribution stamp).
   * No hard delete, no cascade. Idempotence guard: archiving an
   * already-archived talent is a 409, not a silent success.
   */
  async archiveTalent(talentId, { actorId, actorRole, correlationId, requestMetadata } = {}) {
    assertActorIsOwner(actorRole);
    if (!talentId) throw invalidBodyError();

    const target = await talentAdapter.getParent(talentId);
    if (!target) throw notFoundError();
    if (target.status === LIFECYCLE_STATUS.ARCHIVED) {
      throw conflictError(ERR.talentAlreadyArchived, 'TALENT_ALREADY_ARCHIVED');
    }

    const archived = await talentAdapter.archiveParent(talentId, { actorId });

    await emitTalentArchiveEvent(EVENT_TYPE.TALENT_ARCHIVED, {
      entityId: talentId,
      actorId,
      correlationId,
      payload: { slug: archived.slug, status: archived.status },
      metadata: requestMetadata,
    });

    return archived;
  },

  /**
   * OWNER ONLY. Restore a previously archived talent (status -> ACTIVE,
   * clears the soft-delete stamp). No re-publish step — the same
   * currentPublishedVersion, history, media, socials, and SEO data that
   * existed before archiving become live again exactly as they were.
   * Idempotence guard: restoring a talent that isn't archived is a 409.
   */
  async restoreTalent(talentId, { actorId, actorRole, correlationId, requestMetadata } = {}) {
    assertActorIsOwner(actorRole);
    if (!talentId) throw invalidBodyError();

    const target = await talentAdapter.getParent(talentId);
    if (!target) throw notFoundError();
    if (target.status !== LIFECYCLE_STATUS.ARCHIVED) {
      throw conflictError(ERR.talentNotArchived, 'TALENT_NOT_ARCHIVED');
    }

    const restored = await talentAdapter.restoreParent(talentId);

    await emitTalentArchiveEvent(EVENT_TYPE.TALENT_RESTORED, {
      entityId: talentId,
      actorId,
      correlationId,
      payload: { slug: restored.slug, status: restored.status },
      metadata: requestMetadata,
    });

    return restored;
  },
};

export default talentArchiveService;
