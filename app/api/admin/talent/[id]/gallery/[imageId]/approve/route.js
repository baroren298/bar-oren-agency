/*
 * POST /api/admin/talent/[id]/gallery/[imageId]/approve — Gallery Sprint 1.
 *
 * Sibling to app/api/admin/talent/[id]/socials/[socialId]/approve/route.js
 * — Owner-only (requireOwner, not requireUser), identical shape.
 *
 * Behavior:
 *   - no session / not Owner        -> 401 / 403
 *   - missing id or imageId         -> 400
 *   - talent not found              -> 404
 *   - gallery row not found for this talent -> 404
 *   - gallery row isn't PROPOSED    -> 409, { error, code: 'NOT_PROPOSABLE' }
 *   - otherwise                     -> 200, { image }
 */

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin/auth/authorize';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';
import { galleryService } from '@/lib/admin/engine/galleryService';
import { he } from '@/lib/admin/i18n/he';
import { isTalentArchived, talentArchivedResponse } from '@/lib/admin/talent-archive-guard';

export async function POST(request, { params }) {
  let session;
  try {
    session = await requireOwner(request);
  } catch (error) {
    return NextResponse.json(
      { error: error.statusCode === 403 ? he.gallery.errors.notOwner : he.gallery.errors.notAuthenticated },
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

  // Talent Archive & Restore feature — an archived talent is read-only:
  // no per-row gallery approval while it's archived.
  if (isTalentArchived(talent)) {
    return talentArchivedResponse();
  }

  try {
    const { image } = await galleryService.approve(talentAdapter, {
      parentId: id,
      imageId,
      actorId: session.userId,
      actorRole: session.role,
    });

    return NextResponse.json({ image }, { status: 200 });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return NextResponse.json({ error: he.gallery.errors.notFound }, { status: 404 });
    }
    if (error.code === 'NOT_PROPOSABLE') {
      return NextResponse.json(
        { error: he.gallery.errors.notProposable, code: 'NOT_PROPOSABLE' },
        { status: 409 }
      );
    }
    console.error('[POST /api/admin/talent/[id]/gallery/[imageId]/approve] failed to approve:', error);
    return NextResponse.json({ error: he.gallery.errors.serverError }, { status: 500 });
  }
}
