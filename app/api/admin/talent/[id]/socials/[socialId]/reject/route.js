/*
 * POST /api/admin/talent/[id]/socials/[socialId]/reject — Owner
 * Approve/Reject (Social Links) sprint.
 *
 * Explicit, user-action-only entry point for the Owner Review panel's
 * "בקש שינויים" control. Owner-only (requireOwner), same role split as the
 * sibling approve route. Requires a non-empty `rejectionNote` in the body —
 * rejection without a note is rejected with 400 before the service layer is
 * ever called (the service layer also enforces this independently; the
 * route check just gives a clearer Hebrew message without a stack of
 * generic-Error string matching).
 *
 * Behavior:
 *   - no session / not Owner            -> 401 / 403
 *   - missing id or socialId            -> 400
 *   - missing/blank rejectionNote       -> 400, { error, code: 'REJECTION_NOTE_REQUIRED' }
 *   - talent not found                  -> 404
 *   - social row not found for this talent -> 404
 *   - social row isn't PROPOSED         -> 409, { error, code: 'NOT_PROPOSABLE' }
 *   - otherwise                         -> 200, { account }
 */

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin/auth/authorize';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';
import { socialsService } from '@/lib/admin/engine/socialsService';
import { he } from '@/lib/admin/i18n/he';

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

  const { id, socialId } = await params;
  if (!id || !socialId) {
    return NextResponse.json({ error: 'Talent id and social id are required.' }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: he.social.errors.invalidBody }, { status: 400 });
  }

  const rejectionNote = typeof body?.rejectionNote === 'string' ? body.rejectionNote.trim() : '';
  if (!rejectionNote) {
    return NextResponse.json(
      { error: he.social.errors.rejectionNoteRequired, code: 'REJECTION_NOTE_REQUIRED' },
      { status: 400 }
    );
  }

  const talent = await talentAdapter.getParent(id);
  if (!talent) {
    return NextResponse.json({ error: 'Talent not found.' }, { status: 404 });
  }

  try {
    const { account } = await socialsService.reject(talentAdapter, {
      parentId: id,
      socialId,
      actorId: session.userId,
      actorRole: session.role,
      rejectionNote,
    });

    return NextResponse.json({ account }, { status: 200 });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return NextResponse.json({ error: he.social.errors.notFound }, { status: 404 });
    }
    if (error.code === 'NOT_PROPOSABLE') {
      return NextResponse.json(
        { error: he.social.errors.notProposable, code: 'NOT_PROPOSABLE' },
        { status: 409 }
      );
    }
    if (error.code === 'REJECTION_NOTE_REQUIRED') {
      return NextResponse.json(
        { error: he.social.errors.rejectionNoteRequired, code: 'REJECTION_NOTE_REQUIRED' },
        { status: 400 }
      );
    }
    console.error('[POST /api/admin/talent/[id]/socials/[socialId]/reject] failed to reject:', error);
    return NextResponse.json({ error: he.social.errors.serverError }, { status: 500 });
  }
}
