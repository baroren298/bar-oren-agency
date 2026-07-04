/*
 * POST /api/admin/talent/[id]/proposals/[versionId]/submit — "Submit for
 * Approval" sprint (Sprint 1, scoped per ADMIN_PANEL_PLAN.md Section 13.3:
 * Content -> Version -> Proposal -> Approval -> Publish -> Events).
 *
 * Explicit, user-action-only entry point for flipping an existing DRAFT
 * TalentVersion to PROPOSED. Pattern matches the sibling PATCH route exactly
 * (app/api/admin/talent/[id]/proposals/[versionId]/route.js): API Route (not
 * a Server Action), auth via requireUser() as defense in depth alongside
 * middleware.js, route does nothing but param-validate then call the engine
 * — no repository/Prisma import here, and the actual DRAFT-only guard is
 * enforced by proposalService.submit() itself, not by this route.
 *
 * Locked decisions this route encodes:
 *   - submits the existing DRAFT row in place — never creates a new version
 *     row, never publishes anything
 *   - only a DRAFT can be submitted; any other status is rejected with 409
 *     before proposalService.submit() is even called (defense in depth on
 *     top of that service's own guard)
 *   - IN_REVIEW, Start Review, Approve/Reject, Publish, and editable
 *     PROPOSED are all explicitly out of scope for this route — it does
 *     exactly one thing: DRAFT -> PROPOSED
 *
 * Behavior:
 *   - no session                          -> 401 (also enforced by middleware)
 *   - missing id/versionId                -> 400
 *   - talent not found                    -> 404
 *   - version not found / wrong talent    -> 404
 *   - version exists but isn't DRAFT      -> 409 (server-side authority —
 *     proposalService.submit() is what actually enforces this; this status
 *     code just reflects the error it throws)
 *   - otherwise                           -> 200, { version }
 *
 * Out of scope (later sprints, not this one): IN_REVIEW, Start Review,
 * Approve, Reject, Publish, and editable PROPOSED.
 */

import { NextResponse } from 'next/server';
import { requireOwnerOrEmployee } from '@/lib/admin/auth/authorize';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';
import { proposalService } from '@/lib/admin/engine/proposalService';
import { VERSION_STATUS } from '@/lib/admin/constants/enums';

export async function POST(request, { params }) {
  let session;
  try {
    session = await requireOwnerOrEmployee(request);
  } catch (error) {
    return NextResponse.json(
      { error: 'Not authenticated.' },
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

  if (existingVersion.status !== VERSION_STATUS.DRAFT) {
    return NextResponse.json(
      {
        error:
          `This version is "${existingVersion.status}", not a Draft — only a Draft can be ` +
          'submitted for approval.',
        code: 'NOT_SUBMITTABLE',
        status: existingVersion.status,
      },
      { status: 409 }
    );
  }

  try {
    const version = await proposalService.submit(talentAdapter, {
      parentId: id,
      versionId,
      actorId: session.userId,
    });

    return NextResponse.json({ version }, { status: 200 });
  } catch (error) {
    console.error(
      '[POST /api/admin/talent/[id]/proposals/[versionId]/submit] failed to submit:',
      error
    );
    return NextResponse.json({ error: 'Failed to submit for approval.' }, { status: 500 });
  }
}
