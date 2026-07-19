/*
 * POST /api/admin/talent/[id]/socials/publish — Owner Direct Publish UX
 * sprint.
 *
 * Socials' Owner-only shortcut, the exact sibling of
 * app/api/admin/talent/[id]/gallery/publish/route.js — same three-step
 * orchestration (submit DRAFT rows, re-read whichever rows are now
 * PROPOSED, approve each in turn), no new business logic, against
 * socialsService instead of galleryService since TalentSocial rows are also
 * per-row rather than per-version.
 *
 * Pre-merge blocker fix sprint (QA finding #4) — step 1 no longer
 * bulk-flips *every* DRAFT row: `createdById: session.userId` scopes the
 * auto-submit to drafts the acting Owner authored themselves. Another
 * author's (e.g. an Employee's) half-finished DRAFT rows stay DRAFT,
 * untouched and unpublished — they only ever reach step 3 after that
 * author explicitly Submits them (flipping them PROPOSED), which is the
 * intended review handoff. Step 3 still approves every PROPOSED row —
 * PROPOSED means "explicitly submitted for the Owner's decision," so
 * approving it here is precisely the Owner acting on that request.
 *
 * Behavior:
 *   - no session / not Owner  -> 401 / 403
 *   - missing id              -> 400
 *   - talent not found        -> 404
 *   - nothing DRAFT or PROPOSED to publish -> 409, { error, code: 'NOTHING_TO_PUBLISH' }
 *   - otherwise                -> 200, { accounts, errors }
 *     (`accounts` = every row successfully published this call; `errors` =
 *     any row that failed, each as { socialId, error } — empty when every
 *     row published cleanly)
 *
 * Post-Publish Edit Mode Cleanup fix — same best-effort cleanup as the
 * sibling gallery/publish/route.js: TalentSocial rows are never part of
 * TalentVersion, so this publish can succeed while leaving an unrelated
 * pending TalentVersion DRAFT behind (the one "Start Editing" creates to
 * open global edit mode). If that Draft was never actually edited —
 * identical to Published, per talentVersionIsUnchangedFromPublished — it's
 * discarded here too, so the workspace falls back to read-only instead of
 * staying stuck. A Draft with real unpublished changes, or a PROPOSED
 * version, is never touched. See that file's header comment for the full
 * rationale.
 */

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin/auth/authorize';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';
import { socialsService } from '@/lib/admin/engine/socialsService';
import { versionService } from '@/lib/admin/engine/versionService';
import { proposalService } from '@/lib/admin/engine/proposalService';
import { talentVersionIsUnchangedFromPublished } from '@/lib/admin/talent-workspace';
import { VERSION_STATUS } from '@/lib/admin/constants/enums';
import { he } from '@/lib/admin/i18n/he';
import { isTalentArchived, talentArchivedResponse } from '@/lib/admin/talent-archive-guard';

export async function POST(request, { params }) {
  let session;
  try {
    session = await requireOwner(request);
  } catch (error) {
    return NextResponse.json(
      { error: error.statusCode === 403 ? he.social.errors.notOwner : he.social.errors.notAuthenticated },
      { status: error.statusCode || 401 }
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Talent id is required.' }, { status: 400 });
  }

  const talent = await talentAdapter.getParent(id);
  if (!talent) {
    return NextResponse.json({ error: 'Talent not found.' }, { status: 404 });
  }

  // Talent Archive & Restore feature — an archived talent is read-only:
  // no social-account publish while it's archived.
  if (isTalentArchived(talent)) {
    return talentArchivedResponse();
  }

  // Step 1 — submit the acting Owner's own still-DRAFT rows only (QA
  // finding #4 — never sweep another author's unfinished drafts into a
  // publish). "Nothing to submit" is expected and harmless whenever every
  // pending row is already PROPOSED (or the only drafts belong to someone
  // else), so it's swallowed here rather than failing the whole request.
  try {
    await socialsService.submit(talentAdapter, {
      parentId: id,
      actorId: session.userId,
      actorRole: session.role,
      createdById: session.userId,
    });
  } catch (error) {
    if (error.code !== 'NOTHING_TO_SUBMIT') {
      console.error('[POST /api/admin/talent/[id]/socials/publish] failed to submit:', error);
      return NextResponse.json({ error: he.social.errors.serverError }, { status: 500 });
    }
  }

  // Step 2 — re-read whichever rows are now PROPOSED (just-submitted ones,
  // plus any that already were before this call).
  const proposedSocials = await talentAdapter.getProposedSocials(id);

  if (!proposedSocials || proposedSocials.length === 0) {
    return NextResponse.json(
      { error: he.editor.publish.disabledNothingToPublish, code: 'NOTHING_TO_PUBLISH' },
      { status: 409 }
    );
  }

  // Step 3 — approve each row in turn, the same socialsService.approve()
  // the existing per-row Owner approve route already calls.
  const published = [];
  const errors = [];

  for (const row of proposedSocials) {
    try {
      const { account } = await socialsService.approve(talentAdapter, {
        parentId: id,
        socialId: row.id,
        actorId: session.userId,
        actorRole: session.role,
      });
      published.push(account);
    } catch (error) {
      console.error(
        `[POST /api/admin/talent/[id]/socials/publish] failed to approve account ${row.id}:`,
        error
      );
      errors.push({ socialId: row.id, error: error.message || he.social.errors.serverError });
    }
  }

  // Social publishes do not use TalentVersion. Entering global edit mode
  // eagerly creates an empty TalentVersion DRAFT for the Details/SEO/Podcast
  // workflow (see StartEditingButton.jsx / proposals/route.js), even when
  // the user only ever meant to touch Socials. If that DRAFT remained
  // completely unchanged, discard it after a successful Social publish so
  // the workspace correctly returns to read-only mode instead of staying
  // stuck showing an editing session the user never touched. See this
  // file's header comment for the full rationale. Best-effort only: any
  // failure here is logged and swallowed, never surfaced as a failed
  // publish.
  try {
    const pendingVersion = await versionService.getCurrentDraftOrProposed(talentAdapter, id);
    if (pendingVersion && pendingVersion.status === VERSION_STATUS.DRAFT) {
      const publishedVersion = await versionService.getCurrentPublished(talentAdapter, id);
      if (talentVersionIsUnchangedFromPublished(pendingVersion, publishedVersion)) {
        await proposalService.discard(talentAdapter, {
          parentId: id,
          versionId: pendingVersion.id,
          actorId: session.userId,
          actorRole: session.role,
        });
      }
    }
  } catch (cleanupError) {
    console.error(
      '[POST /api/admin/talent/[id]/socials/publish] failed to clean up an empty pending TalentVersion draft:',
      cleanupError
    );
  }

  return NextResponse.json({ accounts: published, errors }, { status: 200 });
}
