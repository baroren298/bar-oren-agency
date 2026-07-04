/*
 * POST /api/admin/talent/[id]/socials/[socialId]/resume — Rejected
 * Resubmission Recovery sprint.
 *
 * Explicit, user-action-only entry point for the "Continue fixing" /
 * "המשך תיקון" control in RejectedSocialsNotice (components/admin/
 * SocialLinksEditor.jsx). Editor-only (requireUser, like saveDraft/submit —
 * NOT requireOwner), since resuming a rejected proposal is the editor fixing
 * their own work, not an Owner decision.
 *
 * Mirrors the sibling approve/reject routes' shape exactly (requireX ->
 * param validation -> talentAdapter.getParent 404 check -> call into
 * socialsService -> map specific error codes to HTTP statuses), per this
 * codebase's existing pattern for one-row TalentSocial actions.
 *
 * Behavior:
 *   - no session                              -> 401
 *   - missing id or socialId                   -> 400
 *   - talent not found                         -> 404
 *   - social row not found for this talent     -> 404
 *   - social row isn't REJECTED                -> 409, { error, code: 'NOT_REJECTED' }
 *   - otherwise                                -> 201, { account } (the new DRAFT row)
 */

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/admin/auth/authorize';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';
import { socialsService } from '@/lib/admin/engine/socialsService';
import { he } from '@/lib/admin/i18n/he';

export async function POST(request, { params }) {
  let session;
  try {
    session = await requireUser(request);
  } catch (error) {
    return NextResponse.json(
      { error: he.social.errors.notAuthenticated },
      { status: error.statusCode || 401 }
    );
  }

  const { id, socialId } = await params;
  if (!id || !socialId) {
    return NextResponse.json({ error: 'Talent id and social id are required.' }, { status: 400 });
  }

  const talent = await talentAdapter.getParent(id);
  if (!talent) {
    return NextResponse.json({ error: 'Talent not found.' }, { status: 404 });
  }

  try {
    const { account } = await socialsService.resumeRejected(talentAdapter, {
      parentId: id,
      socialId,
      actorId: session.userId,
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return NextResponse.json({ error: he.social.errors.notFound }, { status: 404 });
    }
    if (error.code === 'NOT_REJECTED') {
      return NextResponse.json(
        { error: he.social.rejectionNotice.resumeError, code: 'NOT_REJECTED' },
        { status: 409 }
      );
    }
    console.error('[POST /api/admin/talent/[id]/socials/[socialId]/resume] failed to resume:', error);
    return NextResponse.json({ error: he.social.errors.serverError }, { status: 500 });
  }
}
