/*
 * POST /api/admin/talent/[id]/proposals/[versionId]/publish — Owner Direct
 * Publish UX sprint.
 *
 * The Owner's one-click shortcut: an OWNER actor no longer has to click
 * Submit and then separately click Approve to get a TalentVersion live.
 * This route does NOT introduce any new business logic — it composes the
 * two engine methods that already exist and are already independently
 * role-checked:
 *
 *   1. proposalService.submit()  — DRAFT -> PROPOSED (only called when the
 *      version is still DRAFT; a no-op step when it's already PROPOSED).
 *   2. approvalService.approve() — PROPOSED -> PUBLISHED (which itself
 *      already composes publishService.publish() — Section 13.5's "only
 *      code path that can ever set PUBLISHED" remains exactly that; this
 *      route never touches PUBLISHED directly).
 *
 * This is exactly what an OWNER clicking Submit then Approve would already
 * produce today — same two calls, same two services, same revision-conflict
 * and status guards, just one HTTP round trip instead of two. The approval
 * model itself (DRAFT -> PROPOSED -> PUBLISHED, Owner-only approval) is
 * unchanged and not weakened: an EMPLOYEE still cannot reach this route at
 * all (requireOwner, not requireUser/requireOwnerOrEmployee), and
 * approvalService.approve()'s own assertActorIsOwner check still fires
 * independently even if this route's own gate were ever bypassed.
 *
 * Behavior:
 *   - no session / not Owner            -> 401 / 403
 *   - missing id or versionId           -> 400
 *   - talent not found                  -> 404
 *   - version not found for this talent -> 404
 *   - version is PUBLISHED or REJECTED  -> 409, { error, code: 'NOT_PUBLISHABLE' }
 *   - revision conflict                 -> 409, { error, code: 'REVISION_CONFLICT', conflict }
 *   - otherwise                         -> 200, { version, parent }
 *
 * Global Reconciliation sprint — this is the "global editor" Publish Now
 * handler: the one Details/Podcast/SEO tabs (TalentDetailsEditor /
 * SeoEditor) call while the page's global edit session (StartEditingButton /
 * CancelEditingButton / globalEditing) is active, and `versionId` here IS
 * that same session's pending TalentVersion — publishing it already flips
 * its own status to PUBLISHED, which is normally what makes
 * versionService.getCurrentDraftOrProposed() (and therefore the header's
 * Continue/Cancel Editing controls and every tab's dirty/preview state)
 * fall back to read-only on the client's next refresh.
 *
 * `globalEditing`/`pendingVersion` themselves are unchanged by this sprint
 * — still derived directly from the current TalentVersion DRAFT/PROPOSED.
 * What this call adds is `reconcileTalentEditMode`: after this publish
 * succeeds, it checks Gallery and Socials too (not just TalentVersion) for
 * any real unpublished work. If a second, older Draft is left over from
 * this exact talent (e.g. an interrupted "Start Editing") and nothing else
 * in the workspace is pending either, that leftover anchor is discarded so
 * the workspace correctly falls back to read-only; if Gallery or Socials
 * still has real pending work, the anchor (if any) is left exactly as-is,
 * so Edit Mode correctly stays open. See
 * lib/admin/talent-workspace-reconciliation.js's own header comment — never
 * throws.
 */

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin/auth/authorize';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';
import { proposalService } from '@/lib/admin/engine/proposalService';
import { approvalService } from '@/lib/admin/engine/approvalService';
import { reconcileTalentEditMode } from '@/lib/admin/talent-workspace-reconciliation';
import {
  VERSION_STATUS,
  REVISION_CONFLICT_ERROR_CODE,
  SLUG_CONFLICT_ERROR_CODE,
  SLUG_INVALID_ERROR_CODE,
} from '@/lib/admin/constants/enums';
import { isTalentArchived, talentArchivedResponse } from '@/lib/admin/talent-archive-guard';

export async function POST(request, { params }) {
  let session;
  try {
    session = await requireOwner(request);
  } catch (error) {
    return NextResponse.json(
      { error: error.statusCode === 403 ? 'Only the Owner may publish directly.' : 'Not authenticated.' },
      { status: error.statusCode || 401 }
    );
  }

  const { id, versionId } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Talent id is required.' }, { status: 400 });
  }
  if (!versionId) {
    return NextResponse.json({ error: 'Version id is required.' }, { status: 400 });
  }

  const talent = await talentAdapter.getParent(id);
  if (!talent) {
    return NextResponse.json({ error: 'Talent not found.' }, { status: 404 });
  }

  // Talent Archive & Restore feature — an archived talent is read-only:
  // no direct-publish shortcut while it's archived.
  if (isTalentArchived(talent)) {
    return talentArchivedResponse();
  }

  const existingVersion = await talentAdapter.getVersion(versionId);
  if (!existingVersion || existingVersion.talentId !== id) {
    return NextResponse.json({ error: 'Version not found for this talent.' }, { status: 404 });
  }

  if (
    existingVersion.status !== VERSION_STATUS.DRAFT &&
    existingVersion.status !== VERSION_STATUS.PROPOSED
  ) {
    return NextResponse.json(
      {
        error:
          `This version is "${existingVersion.status}" — only a Draft or a Proposed version can be ` +
          'published directly.',
        code: 'NOT_PUBLISHABLE',
        status: existingVersion.status,
      },
      { status: 409 }
    );
  }

  try {
    // Step 1 — only needed when the version is still DRAFT. Reuses
    // proposalService.submit() verbatim; no duplicated status-transition
    // logic here.
    if (existingVersion.status === VERSION_STATUS.DRAFT) {
      await proposalService.submit(talentAdapter, {
        parentId: id,
        versionId,
        actorId: session.userId,
        actorRole: session.role,
      });
    }

    // Step 2 — the same approvalService.approve() the existing Approve
    // route already calls, with the same actorRole defense-in-depth check.
    const { version, parent } = await approvalService.approve(talentAdapter, {
      parentId: id,
      versionId,
      actorId: session.userId,
      actorRole: session.role,
      basedOnRevisionNumber: talent.revisionNumber,
    });

    // Global Reconciliation sprint — see this file's header comment.
    // `version` (now PUBLISHED) is excluded automatically:
    // reconcileTalentEditMode's TalentVersion module only ever considers
    // the current DRAFT/PROPOSED row, so this can only ever discard a
    // *different*, leftover draft, never the one just published. Never
    // throws — no try/catch needed here.
    await reconcileTalentEditMode(talentAdapter, {
      parentId: id,
      actorId: session.userId,
      actorRole: session.role,
    });

    return NextResponse.json({ version, parent }, { status: 200 });
  } catch (error) {
    if (error.code === REVISION_CONFLICT_ERROR_CODE) {
      return NextResponse.json(
        {
          error: 'This talent changed since this proposal was created.',
          code: REVISION_CONFLICT_ERROR_CODE,
          conflict: error.conflict,
        },
        { status: 409 }
      );
    }
    // Talent SEO + Slug Management sprint — the publish transaction's
    // authoritative slug gates (talentRepository.publishTalentVersion).
    // Publishing is blocked, nothing was written. NOTE: when step 1 above
    // already flipped a DRAFT to PROPOSED, that flip stands (it is its own
    // committed transaction) — the version simply awaits a corrected slug.
    if (error.code === SLUG_CONFLICT_ERROR_CODE) {
      return NextResponse.json(
        {
          error: `The slug "${error.slug}" is already used by another talent. Choose a different slug before publishing.`,
          code: SLUG_CONFLICT_ERROR_CODE,
          slug: error.slug,
        },
        { status: 409 }
      );
    }
    if (error.code === SLUG_INVALID_ERROR_CODE) {
      return NextResponse.json(
        {
          error: `The proposed slug "${error.slug}" is invalid (allowed: a-z, 0-9, single hyphens). Fix it before publishing.`,
          code: SLUG_INVALID_ERROR_CODE,
          slug: error.slug,
        },
        { status: 409 }
      );
    }
    console.error(
      '[POST /api/admin/talent/[id]/proposals/[versionId]/publish] failed to publish:',
      error
    );
    return NextResponse.json({ error: 'Failed to publish.' }, { status: 500 });
  }
}
