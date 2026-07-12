/*
 * POST /api/admin/assets/upload — Gallery Upload Sprint 1
 * (GALLERY_UPLOAD_SPRINT_1_ARCHITECTURE.md §5/§8). Same pattern as
 * app/api/admin/talent/[id]/gallery/route.js: API Route, auth via
 * requireUser() as defense in depth alongside proxy.js, route does
 * nothing but parse the multipart body then call the engine — no
 * repository/Prisma import here, only `assetService`.
 *
 * requireOwnerOrEmployee (not requireOwner): per the approved sprint
 * scope, uploading is a draft/admin editing action like gallery draft
 * saves, not an Owner approval action. Auth Hardening + Draft Ownership
 * Sprint 1: was requireUser (any authenticated session, not role-checked)
 * — tightened to requireOwnerOrEmployee so a third role added later doesn't
 * silently inherit this action just by having a valid session, matching
 * every sibling draft-mutation route in this tree.
 *
 * Body: multipart/form-data, fields `file` (the binary) and `purpose`
 * (a key into lib/storage/utils/validationProfiles.js, e.g. "gallery").
 *
 * Behavior:
 *   - no session                          -> 401 (also enforced by middleware)
 *   - uploads unavailable in this env     -> 503, code UPLOADS_DISABLED
 *   - too many uploads in a short window  -> 429, code RATE_LIMITED
 *     (Production Upload Enablement sprint — per-user fixed window via
 *     lib/admin/auth/uploadRateLimit.js, checked after auth so the key is
 *     the authenticated userId, and after the availability gate so a 503'd
 *     environment never consumes slots)
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
import { requireOwnerOrEmployee } from '@/lib/admin/auth/authorize';
import { consumeUploadSlot } from '@/lib/admin/auth/uploadRateLimit';
import { assetService } from '@/lib/admin/engine/assetService';
import { isUploadAvailable } from '@/lib/storage/availability';
import { he } from '@/lib/admin/i18n/he';

export async function POST(request) {
  let session;
  try {
    session = await requireOwnerOrEmployee(request);
  } catch (error) {
    return NextResponse.json(
      { error: he.gallery.errors.notAuthenticated },
      { status: error.statusCode || 401 }
    );
  }

  // Pre-merge blocker fix sprint (QA finding #1): with only the `local`
  // storage provider available, uploads cannot work in a production build
  // (localProvider refuses to write — no durable filesystem on Vercel, and
  // public/uploads/ is gitignored so a written file would 404 anyway).
  // Refuse here, before reading the body, with a clear Hebrew message and
  // 503 (service unavailable in this environment) instead of letting
  // localProvider's own throw surface as a generic 500. This is also what
  // guarantees no new `/uploads/...` blobUrl can ever be created in
  // production/preview — this route is the only code path that creates
  // Asset rows. The UI is gated too (uploadsEnabled prop), but this check
  // is the authority; local development (NODE_ENV !== 'production') is
  // unaffected.
  if (!isUploadAvailable()) {
    return NextResponse.json(
      { error: he.gallery.errors.uploadsDisabled, code: 'UPLOADS_DISABLED' },
      { status: 503 }
    );
  }

  // Production Upload Enablement sprint — per-user rate limit, applied
  // before the body is read so a limited user can't make the server buffer
  // 8MB just to be told no. Consuming counts the attempt whether or not the
  // rest of the request turns out valid.
  if (!consumeUploadSlot(session.userId)) {
    return NextResponse.json(
      { error: he.gallery.errors.uploadRateLimited, code: 'RATE_LIMITED' },
      { status: 429 }
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
