/*
 * POST /api/admin/talent/[id]/socials/submit — Social Links persistence
 * sprint.
 *
 * Explicit, user-action-only entry point for the Socials tab's "שלח
 * לאישור" button. Pattern matches the sibling TalentVersion submit route
 * (app/api/admin/talent/[id]/proposals/[versionId]/submit/route.js): API
 * Route, auth via requireUser() as defense in depth, route does nothing but
 * param-validate then call the engine.
 *
 * Shape difference, and why: there's no `[versionId]` segment because this
 * submits *every* DRAFT TalentSocial row belonging to the talent in one
 * call (socialsService.submit -> talentAdapter.submitDraftSocials ->
 * talentRepository.submitDraftSocialsForTalent's single transaction) —
 * Save Draft already established which rows are DRAFT; Submit doesn't need
 * the editor to enumerate them again.
 *
 * Behavior:
 *   - no session                  -> 401 (also enforced by middleware)
 *   - missing id                  -> 400
 *   - talent not found            -> 404
 *   - no DRAFT social rows exist  -> 409, { error, code: 'NOTHING_TO_SUBMIT' }
 *   - otherwise                   -> 200, { accounts }
 *
 * Out of scope (not this sprint): Approve/Reject/Publish for social rows —
 * this only flips DRAFT -> PROPOSED, same as the TalentVersion submit route
 * only ever does DRAFT -> PROPOSED.
 */

import { NextResponse } from 'next/server';
import { requireOwnerOrEmployee } from '@/lib/admin/auth/authorize';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';
import { socialsService } from '@/lib/admin/engine/socialsService';
import { he } from '@/lib/admin/i18n/he';

export async function POST(request, { params }) {
  let session;
  try {
    session = await requireOwnerOrEmployee(request);
  } catch (error) {
    return NextResponse.json(
      { error: he.social.errors.notAuthenticated },
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

  try {
    const { accounts } = await socialsService.submit(talentAdapter, {
      parentId: id,
      actorId: session.userId,
    });

    return NextResponse.json({ accounts }, { status: 200 });
  } catch (error) {
    if (error.code === 'NOTHING_TO_SUBMIT') {
      return NextResponse.json(
        { error: he.social.errors.nothingToSubmit, code: 'NOTHING_TO_SUBMIT' },
        { status: 409 }
      );
    }
    console.error('[POST /api/admin/talent/[id]/socials/submit] failed to submit:', error);
    return NextResponse.json({ error: he.social.errors.serverError }, { status: 500 });
  }
}
