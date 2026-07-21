/*
 * POST /api/admin/talent/[id]/archive — Talent Archive & Restore feature
 * (final CMS v1 feature).
 *
 * OWNER ONLY — requireOwner(request) is the first, independent gate;
 * talentArchiveService.archiveTalent's assertActorIsOwner is the second
 * (same defense-in-depth as app/api/admin/clients/[id]/archive/route.js,
 * the pattern this route mirrors 1:1). An EMPLOYEE session gets 403 from
 * both gates independently; UI visibility of the archive button is never
 * the security boundary.
 *
 * Pure status transition — no hard delete, no cascade to TalentVersion/
 * TalentSocial/TalentGalleryImage. Archiving an already-archived talent is
 * a 409, not a silent success. Once archived, the talent is immediately
 * excluded from the public site (lib/public/talent.js's existing
 * `status: ACTIVE` filter already handles this — no change needed there)
 * and from the admin roster's default views (see TalentListClient.jsx's
 * new "archived" pill), while remaining fully visible/restorable in the
 * admin under that pill. Every propose/submit/approve/publish route for
 * this talent also independently rejects further edits once archived —
 * see lib/admin/talent-archive-guard.js.
 */

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin/auth/authorize';
import { talentArchiveService } from '@/lib/admin/talentArchiveService';
import { buildRequestAuditContext } from '@/lib/admin/requestAuditContext';
import { he } from '@/lib/admin/i18n/he';

const ERR = he.talent.archive.errors;

function authErrorResponse(error) {
  return NextResponse.json(
    { error: error.statusCode === 403 ? ERR.ownerOnly : ERR.notAuthenticated },
    { status: error.statusCode || 401 }
  );
}

function serviceErrorResponse(error) {
  if (error.statusCode) {
    return NextResponse.json({ error: error.message || ERR.serverError, code: error.code }, {
      status: error.statusCode,
    });
  }
  console.error('[POST /api/admin/talent/[id]/archive] failed to archive talent:', error);
  return NextResponse.json({ error: ERR.serverError }, { status: 500 });
}

export async function POST(request, { params }) {
  let session;
  try {
    session = await requireOwner(request);
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: ERR.invalidBody }, { status: 400 });
  }

  const { correlationId, requestMetadata } = buildRequestAuditContext(request);

  try {
    const talent = await talentArchiveService.archiveTalent(id, {
      actorId: session.userId,
      actorRole: session.role,
      correlationId,
      requestMetadata,
    });
    return NextResponse.json({ talent }, { status: 200 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
