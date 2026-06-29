/*
 * POST /api/admin/talent/[id]/gallery/publish — Owner Direct Publish UX
 * sprint.
 *
 * Gallery's Owner-only shortcut, mirroring
 * app/api/admin/talent/[id]/proposals/[versionId]/publish/route.js's design:
 * no new business logic, only orchestration of the two engine methods that
 * already exist and are already independently role-checked.
 *
 * TalentGalleryImage rows are per-row, not per-version (a talent can have
 * several DRAFT/PROPOSED rows at once), so "publish" here means:
 *
 *   1. galleryService.submit()   — every row still DRAFT -> PROPOSED.
 *      Tolerates "nothing to submit" (e.g. every row is already PROPOSED
 *      because an Employee already submitted) rather than failing the
 *      whole request.
 *   2. talentAdapter.getProposedGalleryImages() — re-read whichever rows are
 *      now PROPOSED (the ones just submitted, plus any that already were).
 *   3. galleryService.approve() — looped once per PROPOSED row. Each call is
 *      the exact same approve the existing per-row Owner approve route
 *      already uses, including its own assertActorIsOwner check.
 *
 * A failure approving one row does not abort the rows already approved —
 * each row's result/error is collected and returned, similar in spirit to
 * how Gallery's own upload queue already isolates per-file failures.
 *
 * Behavior:
 *   - no session / not Owner  -> 401 / 403
 *   - missing id              -> 400
 *   - talent not found        -> 404
 *   - nothing DRAFT or PROPOSED to publish -> 409, { error, code: 'NOTHING_TO_PUBLISH' }
 *   - otherwise                -> 200, { images, errors }
 *     (`images` = every row successfully published this call; `errors` =
 *     any row that failed, each as { imageId, error } — empty when every
 *     row published cleanly)
 */

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin/auth/authorize';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';
import { galleryService } from '@/lib/admin/engine/galleryService';
import { he } from '@/lib/admin/i18n/he';

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

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Talent id is required.' }, { status: 400 });
  }

  const talent = await talentAdapter.getParent(id);
  if (!talent) {
    return NextResponse.json({ error: 'Talent not found.' }, { status: 404 });
  }

  // Step 1 — submit every still-DRAFT row. "Nothing to submit" is expected
  // and harmless whenever every pending row is already PROPOSED, so it's
  // swallowed here rather than failing the whole request.
  try {
    await galleryService.submit(talentAdapter, {
      parentId: id,
      actorId: session.userId,
    });
  } catch (error) {
    if (error.code !== 'NOTHING_TO_SUBMIT') {
      console.error('[POST /api/admin/talent/[id]/gallery/publish] failed to submit:', error);
      return NextResponse.json({ error: he.gallery.errors.serverError }, { status: 500 });
    }
  }

  // Step 2 — re-read whichever rows are now PROPOSED (just-submitted ones,
  // plus any that already were before this call).
  const proposedImages = await talentAdapter.getProposedGalleryImages(id);

  if (!proposedImages || proposedImages.length === 0) {
    return NextResponse.json(
      { error: he.editor.publish.disabledNothingToPublish, code: 'NOTHING_TO_PUBLISH' },
      { status: 409 }
    );
  }

  // Step 3 — approve each row in turn, the same galleryService.approve()
  // the existing per-row Owner approve route already calls.
  const published = [];
  const errors = [];

  for (const row of proposedImages) {
    try {
      const { image } = await galleryService.approve(talentAdapter, {
        parentId: id,
        imageId: row.id,
        actorId: session.userId,
        actorRole: session.role,
      });
      published.push(image);
    } catch (error) {
      console.error(
        `[POST /api/admin/talent/[id]/gallery/publish] failed to approve image ${row.id}:`,
        error
      );
      errors.push({ imageId: row.id, error: error.message || he.gallery.errors.serverError });
    }
  }

  return NextResponse.json({ images: published, errors }, { status: 200 });
}
