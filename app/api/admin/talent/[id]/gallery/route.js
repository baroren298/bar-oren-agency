/*
 * PATCH /api/admin/talent/[id]/gallery — Gallery Sprint 1.
 *
 * Sibling to app/api/admin/talent/[id]/socials/route.js — same pattern:
 * API Route (not a Server Action), auth via requireUser() as defense in
 * depth alongside middleware.js, route does nothing but param/body-validate
 * then call the engine — no repository/Prisma import here, only
 * `talentAdapter` + `galleryService`.
 *
 * Shape difference from the socials route, and why: every entry in
 * `body.images` MUST carry an `id` — Gallery Sprint 1 has no "Add Image"
 * capability (no storage provider is implemented; see galleryService.js's
 * header comment), so there is no equivalent of the socials route's
 * "no id -> insert a brand-new account" case. An entry with no `id` is a
 * validation failure (`MISSING_IMAGE_ID`), not silently ignored.
 *
 * Behavior:
 *   - no session                  -> 401 (also enforced by middleware)
 *   - missing id                  -> 400
 *   - body.images not an array    -> 400
 *   - talent not found            -> 404
 *   - one or more images invalid (including missing id) -> 422, { error, code: 'VALIDATION_FAILED', details }
 *   - an image id not found / belongs to another talent -> 404
 *   - an image id exists but isn't PUBLISHED/DRAFT/PROPOSED -> 409
 *   - otherwise                   -> 200, { images }
 *
 * Out of scope (not this sprint): image upload, replace, add — see this
 * file's header comment and ADMIN_PANEL_PLAN.md Gallery Sprint 1 scope.
 */

import { NextResponse } from 'next/server';
import { requireOwnerOrEmployee } from '@/lib/admin/auth/authorize';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';
import { galleryService, GalleryValidationError } from '@/lib/admin/engine/galleryService';
import { he } from '@/lib/admin/i18n/he';

export async function PATCH(request, { params }) {
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

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: he.gallery.errors.invalidBody }, { status: 400 });
  }

  const images = body?.images;
  if (!Array.isArray(images)) {
    return NextResponse.json({ error: he.gallery.errors.invalidBody }, { status: 400 });
  }

  const talent = await talentAdapter.getParent(id);
  if (!talent) {
    return NextResponse.json({ error: 'Talent not found.' }, { status: 404 });
  }

  try {
    const { images: saved } = await galleryService.saveDraft(talentAdapter, {
      parentId: id,
      images,
      actorId: session.userId,
    });

    return NextResponse.json({ images: saved }, { status: 200 });
  } catch (error) {
    if (error instanceof GalleryValidationError) {
      return NextResponse.json(
        { error: he.gallery.errors.validationSummary, code: error.code, details: error.details },
        { status: 422 }
      );
    }
    if (error.message && error.message.includes('not found for this talent')) {
      return NextResponse.json({ error: he.gallery.errors.notFound }, { status: 404 });
    }
    if (error.message && error.message.includes('only PUBLISHED, DRAFT, or PROPOSED rows')) {
      return NextResponse.json(
        { error: he.gallery.errors.notEditable, code: 'NOT_EDITABLE' },
        { status: 409 }
      );
    }
    console.error('[PATCH /api/admin/talent/[id]/gallery] failed to save draft:', error);
    return NextResponse.json({ error: he.gallery.errors.serverError }, { status: 500 });
  }
}
