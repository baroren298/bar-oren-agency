/*
 * reconcileTalentEditMode — Global Reconciliation sprint.
 *
 * The single, shared post-publish reconciliation flow every publish/approve
 * route calls, replacing the reverted "Duplicate Draft Prevention" sprint's
 * `cleanupOrphanedTalentDrafts` (lib/admin/talent-edit-mode-cleanup.js, now
 * an empty stub).
 *
 * Design (approved v3): `pendingVersion`/`globalEditing` on
 * app/admin/talent/[id]/page.jsx are UNCHANGED by this sprint — they remain
 * derived exactly as before, directly from the current TalentVersion
 * DRAFT/PROPOSED ("the anchor"). This function's only job is deciding
 * *whether the anchor is allowed to be cleared* after a publish succeeds
 * anywhere in the workspace:
 *
 *   1. The route's own publish/approve logic has already run (unchanged).
 *   2. Ask every registered workspace module the same one question —
 *      `hasEffectivePendingWork(adapter, parentId)` — via a static,
 *      explicit array of plain objects (no dynamic plugin system, no
 *      classes, no factories, no DI). This function never inspects any
 *      module's storage model directly; it only ever calls that one
 *      uniform method.
 *   3. If ANY module reports true, stop — leave the anchor exactly as it
 *      is. Edit Mode correctly stays open via the existing, untouched
 *      pendingVersion-based globalEditing derivation, regardless of which
 *      module reported the remaining work.
 *   4. If EVERY module reports false — nothing effective remains anywhere,
 *      including TalentVersion itself — call the one TalentVersion-only
 *      extra capability, `talentVersionPendingWork.discardIfSafeAnchor`,
 *      which is private to this module (not part of the shared contract;
 *      no other module has an anchor to discard). Discarding the anchor
 *      makes `pendingVersion` null on the workspace's next read, so
 *      `globalEditing` closes naturally through its own unmodified logic —
 *      this function never sets or clears `globalEditing` itself.
 *
 * Fail-safe, matching every other route-facing helper in this codebase:
 * never throws into the caller's publish/approve response. A module whose
 * `hasEffectivePendingWork` throws is treated as if it returned true (still
 * has pending work) — a broken check must never cause the anchor to be
 * discarded on incomplete information.
 */

import { talentVersionPendingWork } from './talent-workspace-modules/talentVersionPendingWork';
import { galleryPendingWork } from './talent-workspace-modules/galleryPendingWork';
import { socialsPendingWork } from './talent-workspace-modules/socialsPendingWork';

/*
 * Static, explicit registry — deliberately not auto-discovered from
 * adapter capabilities. Adding a future workspace section (e.g. a new
 * versioned content block) means adding one new module file plus one new
 * line here; a forgotten entry is a visible gap in code review, not a
 * silently-skipped check at runtime.
 */
const WORKSPACE_MODULES = [talentVersionPendingWork, galleryPendingWork, socialsPendingWork];

/**
 * @param {object} adapter - talentAdapter (or a fake shaped like it)
 * @param {string} parentId - the talent id
 * @param {object} module - one entry from WORKSPACE_MODULES
 * @returns {Promise<boolean>} true if the module has pending work, OR if
 *   the module's own check failed (fail-safe default)
 */
async function checkModule(adapter, parentId, module) {
  try {
    return Boolean(await module.hasEffectivePendingWork(adapter, parentId));
  } catch (error) {
    console.error(
      `[reconcileTalentEditMode] "${module.name}" module's hasEffectivePendingWork failed for`,
      parentId,
      error
    );
    // Fail-safe: an incomplete/failed check must never be read as "clean."
    return true;
  }
}

/**
 * @param {object} adapter - talentAdapter (or a fake shaped like it)
 * @param {object} params
 * @param {string} params.parentId - the talent id
 * @param {string} [params.actorId]
 * @param {string} [params.actorRole]
 * @returns {Promise<{ discardedVersionId: string|null, hasUnpublishedWork: boolean }>}
 */
export async function reconcileTalentEditMode(adapter, { parentId, actorId, actorRole } = {}) {
  if (!parentId) {
    return { discardedVersionId: null, hasUnpublishedWork: false };
  }

  const results = await Promise.all(
    WORKSPACE_MODULES.map((module) => checkModule(adapter, parentId, module))
  );
  const hasUnpublishedWork = results.some(Boolean);

  if (hasUnpublishedWork) {
    return { discardedVersionId: null, hasUnpublishedWork: true };
  }

  try {
    const { discarded, versionId } = await talentVersionPendingWork.discardIfSafeAnchor(adapter, {
      parentId,
      actorId,
      actorRole,
    });
    return { discardedVersionId: discarded ? versionId : null, hasUnpublishedWork: false };
  } catch (error) {
    console.error('[reconcileTalentEditMode] discardIfSafeAnchor failed for', parentId, error);
    return { discardedVersionId: null, hasUnpublishedWork: false };
  }
}
