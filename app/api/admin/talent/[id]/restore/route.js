/*
 * POST /api/admin/talent/[id]/restore — Talent Archive & Restore feature
 * (final CMS v1 feature).
 *
 * OWNER ONLY — same requireOwner + service-level assertActorIsOwner
 * defense-in-depth as the sibling archive/route.js. Restoring a talent
 * that isn't archived is a 409, not a silent success.
 *
 * Pure status transition — no re-publish step. The exact
 * currentPublishedVersion, full version history, media, socials, and SEO
 * data that existed before archiving are untouched throughout, so
 * restoring immediately brings the talent back to the public site and the
 * admin's default views exactly as it was.
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
  console.error('[POST /api/admin/talent/[id]/restore] failed to restore talent:', error);
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
    const talent = await talentArchiveService.restoreTalent(id, {
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
