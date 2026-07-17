/*
 * POST /api/admin/talent/[id]/gallery/[imageId]/resume — Gallery Sprint 1.
 *
 * Sibling to app/api/admin/talent/[id]/socials/[socialId]/resume/route.js
 * — the "Continue fixing" / "המשך תיקון" entry point for a rejected
 * gallery image. Editor-action (requireOwnerOrEmployee, NOT requireOwner),
 * since resuming a rejected proposal is the editor fixing their own work.
 *
 * Sprint 1 (Auth Hardening + Draft Ownership): was requireUser (any
 * authenticated session, not role-checked) — tightened to
 * requireOwnerOrEmployee so a third role added later doesn't silently
 * inherit this action just by having a valid session, matching every
 * sibling draft-mutation route in this tree. Ownership of the REJECTED row
 * being resumed (an EMPLOYEE may only resume a row they themselves
 * authored; OWNER may resume any) is enforced inside
 * galleryService.resumeRejected() itself, not here.
 *
 * Behavior:
 *   - no session                              -> 401
 *   - missing id or imageId                    -> 400
 *   - talent not found                         -> 404
 *   - gallery row not found for this talent    -> 404
 *   - gallery row isn't REJECTED                -> 409, { error, code: 'NOT_REJECTED' }
 *   - EMPLOYEE resuming another user's rejected row -> 403, { error, code: 'FORBIDDEN_NOT_DRAFT_OWNER' }
 *   - otherwise                                -> 201, { image } (the new DRAFT row)
 */

import { NextResponse } from 'next/server';
import { requireOwnerOrEmployee } from '@/lib/admin/auth/authorize';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';
import { galleryService } from '@/lib/admin/engine/galleryService';
import { he } from '@/lib/admin/i18n/he';

export async function POST(request, { params }) {
  let session;
  try {
    session = await requireOwnerOrEmployee(request);
  } catch (error) {
    return NextResponse.json(
      { error: he.gallery.errors.notAuthenticated },
      { status: error.statusCode || 401 }
    );
  }

  const { id, imageId } = await params;
  if (!id || !imageId) {
    return NextResponse.json({ error: 'Talent id and image id are required.' }, { status: 400 });
  }

  const talent = await talentAdapter.getParent(id);
  if (!talent) {
    return NextResponse.json({ error: 'Talent not found.' }, { status: 404 });
  }

  try {
    const { image } = await galleryService.resumeRejected(talentAdapter, {
      parentId: id,
      imageId,
      actorId: session.userId,
      actorRole: session.role,
    });

    return NextResponse.json({ image }, { status: 201 });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return NextResponse.json({ error: he.gallery.errors.notFound }, { status: 404 });
    }
    if (error.code === 'NOT_REJECTED') {
      return NextResponse.json(
        { error: he.gallery.rejectionNotice.resumeError, code: 'NOT_REJECTED' },
        { status: 409 }
      );
    }
    if (error.code === 'FORBIDDEN_NOT_DRAFT_OWNER') {
      return NextResponse.json(
        { error: he.gallery.errors.notDraftOwner, code: 'FORBIDDEN_NOT_DRAFT_OWNER' },
        { status: 403 }
      );
    }
    console.error('[POST /api/admin/talent/[id]/gallery/[imageId]/resume] failed to resume:', error);
    return NextResponse.json({ error: he.gallery.errors.serverError }, { status: 500 });
  }
}
