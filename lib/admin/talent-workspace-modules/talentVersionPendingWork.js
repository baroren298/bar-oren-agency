/*
 * TalentVersion workspace module — Global Reconciliation sprint.
 *
 * Backs Details/Podcast/SEO, the one workspace section with an "anchor"
 * Draft concept: `pendingVersion`/`globalEditing` on
 * app/admin/talent/[id]/page.jsx are derived directly from the current
 * DRAFT/PROPOSED TalentVersion (versionService.getCurrentDraftOrProposed),
 * unchanged by this sprint. "Start Editing" seeds that anchor as a verbatim
 * clone of the current Published version — nobody asked for it to exist as
 * its own piece of content, so it's the one place in the workspace where an
 * "untouched, safe to discard" case is even meaningful.
 *
 * Exposes the shared `hasEffectivePendingWork()` contract every workspace
 * module implements (see lib/admin/talent-workspace-reconciliation.js),
 * plus one extra, TalentVersion-only capability — `discardIfSafeAnchor` —
 * that no other module has, because no other module has this anchor
 * concept. `discardIfSafeAnchor` is only ever called by the reconciliation
 * flow itself, after it has confirmed (via the shared contract, across
 * every module) that nothing else in the workspace is pending either.
 */

import { versionService } from '../engine/versionService';
import { proposalService } from '../engine/proposalService';
import { VERSION_STATUS } from '../constants/enums';
import { talentVersionIsUnchangedFromPublished } from '../talent-workspace';

/**
 * Resolves the current pending TalentVersion (if any) and classifies it as
 * either "effective" (real, must never be silently discarded) or not.
 *
 * - No pending version -> not effective (nothing here at all).
 * - PROPOSED -> always effective (already submitted for review).
 * - DRAFT with no recorded baseline, or a baseline that no longer resolves
 *   -> effective (unknown must never be treated as safe).
 * - DRAFT whose fields differ from its own basedOnVersionId baseline ->
 *   effective (real, human-made changes).
 * - DRAFT identical to its own baseline -> NOT effective (exactly the
 *   "Start Editing" auto-clone nobody has touched yet).
 *
 * Slug backfill false-positive fix — passes the parent Talent's live
 * `slug` through to talentVersionIsUnchangedFromPublished (see that
 * function's own header comment in lib/admin/talent-workspace.js) so a
 * Draft whose only "difference" from its baseline is the slug backfill
 * "Start Editing" itself applies (baseline predates the slug column,
 * `slug: null`) is still correctly recognized as untouched, rather than
 * being misclassified as real user-edited content.
 *
 * @param {object} adapter - talentAdapter (or a fake shaped like it)
 * @param {string} parentId - the talent id
 * @returns {Promise<{ pending: object|null, effective: boolean }>}
 */
async function resolvePendingVersion(adapter, parentId) {
  const pending = await versionService.getCurrentDraftOrProposed(adapter, parentId);
  if (!pending) {
    return { pending: null, effective: false };
  }
  if (pending.status !== VERSION_STATUS.DRAFT) {
    // PROPOSED (the only other status getCurrentDraftOrProposed returns).
    return { pending, effective: true };
  }
  if (!pending.basedOnVersionId) {
    return { pending, effective: true };
  }
  const baseline = await adapter.getVersion(pending.basedOnVersionId);
  if (!baseline) {
    return { pending, effective: true };
  }

  const parent = await adapter.getParent(parentId);
  const untouched = talentVersionIsUnchangedFromPublished(pending, baseline, parent?.slug ?? null);
  return { pending, effective: !untouched };
}

export const talentVersionPendingWork = {
  name: 'talentVersion',

  /**
   * The shared contract every workspace module implements. Never throws —
   * a failure here is the caller's (reconcileTalentEditMode's) job to
   * treat conservatively as "still pending."
   *
   * @param {object} adapter
   * @param {string} parentId
   * @returns {Promise<boolean>}
   */
  async hasEffectivePendingWork(adapter, parentId) {
    const { effective } = await resolvePendingVersion(adapter, parentId);
    return effective;
  },

  /**
   * TalentVersion-only extra capability, private to this module's callers
   * (only lib/admin/talent-workspace-reconciliation.js calls this — it is
   * deliberately not part of the shared module contract, since no other
   * workspace module has an anchor to discard). Re-resolves the pending
   * version itself rather than trusting a value the caller might be
   * holding from an earlier read, so this stays correct even if something
   * else changed the anchor in between.
   *
   * @param {object} adapter
   * @param {object} params
   * @param {string} params.parentId
   * @param {string} [params.actorId]
   * @param {string} [params.actorRole]
   * @returns {Promise<{ discarded: boolean, versionId: string|null }>}
   */
  async discardIfSafeAnchor(adapter, { parentId, actorId, actorRole } = {}) {
    const { pending, effective } = await resolvePendingVersion(adapter, parentId);

    if (!pending || effective || pending.status !== VERSION_STATUS.DRAFT) {
      return { discarded: false, versionId: null };
    }

    await proposalService.discard(adapter, {
      parentId,
      versionId: pending.id,
      actorId,
      actorRole,
    });

    return { discarded: true, versionId: pending.id };
  },
};
