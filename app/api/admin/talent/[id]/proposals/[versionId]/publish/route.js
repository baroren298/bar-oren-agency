/*
 * POST /api/admin/talent/[id]/proposals/[versionId]/publish — Owner Direct
 * Publish UX sprint.
 *
 * The Owner's one-click shortcut: an OWNER actor no longer has to click
 * Submit and then separately click Approve to get a TalentVersion live.
 * This route does NOT introduce any new business logic — it composes the
 * two engine methods that already exist and are already independently
 * role-checked:
 *
 *   1. proposalService.submit()  — DRAFT -> PROPOSED (only called when the
 *      version is still DRAFT; a no-op step when it's already PROPOSED).
 *   2. approvalService.approve() — PROPOSED -> PUBLISHED (which itself
 *      already composes publishService.publish() — Section 13.5's "only
 *      code path that can ever set PUBLISHED" remains exactly that; this
 *      route never touches PUBLISHED directly).
 *
 * This is exactly what an OWNER clicking Submit then Approve would already
 * produce today — same two calls, same two services, same revision-conflict
 * and status guards, just one HTTP round trip instead of two. The approval
 * model itself (DRAFT -> PROPOSED -> PUBLISHED, Owner-only approval) is
 * unchanged and not weakened: an EMPLOYEE still cannot reach this route at
 * all (requireOwner, not requireUser/requireOwnerOrEmployee), and
 * approvalService.approve()'s own assertActorIsOwner check still fires
 * independently even if this route's own gate were ever bypassed.
 *
 * Behavior:
 *   - no session / not Owner            -> 401 / 403
 *   - missing id or versionId           -> 400
 *   - talent not found                  -> 404
 *   - version not found for this talent -> 404
 *   - version is PUBLISHED or REJECTED  -> 409, { error, code: 'NOT_PUBLISHABLE' }
 *   - revision conflict                 -> 409, { error, code: 'REVISION_CONFLICT', conflict }
 *   - otherwise                         -> 200, { version, parent }
 */

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin/auth/authorize';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';
import { proposalService } from '@/lib/admin/engine/proposalService';
import { approvalService } from '@/lib/admin/engine/approvalService';
import { VERSION_STATUS, REVISION_CONFLICT_ERROR_CODE } from '@/lib/admin/constants/enums';

export async function POST(request, { params }) {
  let session;
  try {
    session = await requireOwner(request);
  } catch (error) {
    return NextResponse.json(
      { error: error.statusCode === 403 ? 'Only the Owner may publish directly.' : 'Not authenticated.' },
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

  if (
    existingVersion.status !== VERSION_STATUS.DRAFT &&
    existingVersion.status !== VERSION_STATUS.PROPOSED
  ) {
    return NextResponse.json(
      {
        error:
          `This version is "${existingVersion.status}" — only a Draft or a Proposed version can be ` +
          'published directly.',
        code: 'NOT_PUBLISHABLE',
        status: existingVersion.status,
      },
      { status: 409 }
    );
  }

  try {
    // Step 1 — only needed when the version is still DRAFT. Reuses
    // proposalService.submit() verbatim; no duplicated status-transition
    // logic here.
    if (existingVersion.status === VERSION_STATUS.DRAFT) {
      await proposalService.submit(talentAdapter, {
        parentId: id,
        versionId,
        actorId: session.userId,
      });
    }

    // Step 2 — the same approvalService.approve() the existing Approve
    // route already calls, with the same actorRole defense-in-depth check.
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
        {
          error: 'This talent changed since this proposal was created.',
          code: REVISION_CONFLICT_ERROR_CODE,
          conflict: error.conflict,
        },
        { status: 409 }
      );
    }
    console.error(
      '[POST /api/admin/talent/[id]/proposals/[versionId]/publish] failed to publish:',
      error
    );
    return NextResponse.json({ error: 'Failed to publish.' }, { status: 500 });
  }
}
