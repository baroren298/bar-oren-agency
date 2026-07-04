/*
 * POST /api/admin/talent/[id]/gallery/submit — Gallery Sprint 1.
 *
 * Sibling to app/api/admin/talent/[id]/socials/submit/route.js — identical
 * shape: submits *every* DRAFT TalentGalleryImage row belonging to the
 * talent in one call (galleryService.submit -> talentAdapter.submitDraftGalleryImages
 * -> talentRepository.submitDraftGalleryImagesForTalent's single
 * transaction).
 *
 * Behavior:
 *   - no session                  -> 401 (also enforced by middleware)
 *   - missing id                  -> 400
 *   - talent not found            -> 404
 *   - no DRAFT gallery rows exist  -> 409, { error, code: 'NOTHING_TO_SUBMIT' }
 *   - otherwise                   -> 200, { images }
 *
 * Out of scope (not this sprint): Approve/Reject/Publish for gallery rows —
 * this only flips DRAFT -> PROPOSED.
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

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Talent id is required.' }, { status: 400 });
  }

  const talent = await talentAdapter.getParent(id);
  if (!talent) {
    return NextResponse.json({ error: 'Talent not found.' }, { status: 404 });
  }

  try {
    const { images } = await galleryService.submit(talentAdapter, {
      parentId: id,
      actorId: session.userId,
    });

    return NextResponse.json({ images }, { status: 200 });
  } catch (error) {
    if (error.code === 'NOTHING_TO_SUBMIT') {
      return NextResponse.json(
        { error: he.gallery.errors.nothingToSubmit, code: 'NOTHING_TO_SUBMIT' },
        { status: 409 }
      );
    }
    console.error('[POST /api/admin/talent/[id]/gallery/submit] failed to submit:', error);
    return NextResponse.json({ error: he.gallery.errors.serverError }, { status: 500 });
  }
}
