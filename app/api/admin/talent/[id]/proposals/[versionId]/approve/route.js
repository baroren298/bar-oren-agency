/*
 * POST /api/admin/talent/[id]/proposals/[versionId]/approve — OWNER/EMPLOYEE
 * Permission Model Sprint.
 *
 * The architecture audit preceding this sprint found that approvalService
 * and publishService already existed and were fully unit-tested, but no
 * HTTP route ever wired them up for TalentVersion — Gallery and Socials
 * each got their own approve/reject routes, TalentVersion never did. This
 * route closes that gap. Modeled directly on the sibling Gallery route
 * (app/api/admin/talent/[id]/gallery/[imageId]/approve/route.js): Owner-only
 * (requireOwner, not requireUser/requireOwnerOrEmployee — an EMPLOYEE can
 * save/submit a proposal but only an OWNER may approve it), identical
 * shape, no business logic duplicated here — this route only param-
 * validates then calls the existing `approvalService.approve()`, which
 * itself composes `publishService.publish()` (Section 13.5's "only code
 * path that can ever set PUBLISHED").
 *
 * Defense in depth: `session.role` (recovered from the verified session
 * JWT, never trusted from the request body) is passed through as
 * `actorRole` so approvalService/publishService also verify OWNER
 * independently of this route's own requireOwner() gate.
 *
 * Behavior:
 *   - no session / not Owner            -> 401 / 403
 *   - missing id or versionId           -> 400
 *   - talent not found                  -> 404
 *   - version not found for this talent -> 404
 *   - version isn't PROPOSED            -> 409
 *   - revision conflict                 -> 409, { error, code: 'REVISION_CONFLICT', conflict }
 *   - otherwise                         -> 200, { version, parent }
 */

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin/auth/authorize';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';
import { approvalService } from '@/lib/admin/engine/approvalService';
import { REVISION_CONFLICT_ERROR_CODE } from '@/lib/admin/constants/enums';

export async function POST(request, { params }) {
  let session;
  try {
    session = await requireOwner(request);
  } catch (error) {
    return NextResponse.json(
      { error: error.statusCode === 403 ? 'Only the Owner may approve a proposal.' : 'Not authenticated.' },
      { status: error.statusCode || 401 }
    );
  }

  const { id, versionId } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Talent id is required.' }, { status: 400 });
  }
  if (!versionId) {
    return NextResponse.json({ error: 'Version id is required.' }, { status: 400 });
  }

  const talent = await talentAdapter.getParent(id);
  if (!talent) {
    return NextResponse.json({ error: 'Talent not found.' }, { status: 404 });
  }

  const existingVersion = await talentAdapter.getVersion(versionId);
  if (!existingVersion || existingVersion.talentId !== id) {
    return NextResponse.json({ error: 'Version not found for this talent.' }, { status: 404 });
  }

  try {
    const { version, parent } = await approvalService.approve(talentAdapter, {
      parentId: id,
      versionId,
      actorId: session.userId,
      actorRole: session.role,
      basedOnRevisionNumber: talent.revisionNumber,
    });

    return NextResponse.json({ version, parent }, { status: 200 });
  } catch (error) {
    if (error.code === REVISION_CONFLICT_ERROR_CODE) {
      return NextResponse.json(
        { error: 'This talent changed since this proposal was created.', code: REVISION_CONFLICT_ERROR_CODE, conflict: error.conflict },
        { status: 409 }
      );
    }
    if (error.message && error.message.includes('not PROPOSED')) {
      return NextResponse.json(
        { error: `This version is "${existingVersion.status}", not Proposed — only a Proposed version can be approved.`, code: 'NOT_PROPOSABLE', status: existingVersion.status },
        { status: 409 }
      );
    }
    console.error('[POST /api/admin/talent/[id]/proposals/[versionId]/approve] failed to approve:', error);
    return NextResponse.json({ error: 'Failed to approve proposal.' }, { status: 500 });
  }
}
