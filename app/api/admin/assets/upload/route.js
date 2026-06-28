/*
 * POST /api/admin/assets/upload — Gallery Upload Sprint 1
 * (GALLERY_UPLOAD_SPRINT_1_ARCHITECTURE.md §5/§8). Same pattern as
 * app/api/admin/talent/[id]/gallery/route.js: API Route, auth via
 * requireUser() as defense in depth alongside middleware.js, route does
 * nothing but parse the multipart body then call the engine — no
 * repository/Prisma import here, only `assetService`.
 *
 * requireUser (not requireRole/requireOwner): per the approved sprint
 * scope, uploading is a draft/admin editing action like gallery draft
 * saves, not an Owner approval action.
 *
 * Body: multipart/form-data, fields `file` (the binary) and `purpose`
 * (a key into lib/storage/utils/validationProfiles.js, e.g. "gallery").
 *
 * Behavior:
 *   - no session                          -> 401 (also enforced by middleware)
 *   - missing file or purpose             -> 400
 *   - unknown purpose                     -> 400
 *   - file too large / wrong mime type    -> 422
 *   - otherwise                           -> 201, { asset }
 *
 * Out of scope this sprint (see architecture doc): GET/DELETE for assets,
 * checksum, virus scanning, cloud provider integration, video/document
 * handling.
 */

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/admin/auth/authorize';
import { assetService } from '@/lib/admin/engine/assetService';
import { he } from '@/lib/admin/i18n/he';

export async function POST(request) {
  let session;
  try {
    session = await requireUser(request);
  } catch (error) {
    return NextResponse.json(
      { error: he.gallery.errors.notAuthenticated },
      { status: error.statusCode || 401 }
    );
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: he.gallery.errors.invalidBody }, { status: 400 });
  }

  const file = formData.get('file');
  const purpose = formData.get('purpose');

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: he.gallery.errors.uploadMissingFile }, { status: 400 });
  }
  if (!purpose || typeof purpose !== 'string') {
    return NextResponse.json({ error: he.gallery.errors.uploadMissingPurpose }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const asset = await assetService.uploadAsset({
      buffer,
      purpose,
      originalFilename: typeof file.name === 'string' ? file.name : null,
      uploadedById: session.userId,
    });

    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    if (error.code === 'UNKNOWN_PURPOSE') {
      return NextResponse.json({ error: he.gallery.errors.uploadMissingPurpose }, { status: 400 });
    }
    if (
      error.message === he.gallery.errors.uploadEmptyFile ||
      error.message === he.gallery.errors.uploadFileTooLarge ||
      error.message === he.gallery.errors.uploadUnsupportedType
    ) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error('[POST /api/admin/assets/upload] upload failed:', error);
    return NextResponse.json({ error: he.gallery.errors.serverError }, { status: 500 });
  }
}
