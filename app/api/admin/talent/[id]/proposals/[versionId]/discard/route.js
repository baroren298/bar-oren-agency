/*
 * POST /api/admin/talent/[id]/proposals/[versionId]/discard — Cancel
 * Editing / Discard Draft sprint.
 *
 * Explicit, user-action-only entry point for abandoning an existing DRAFT
 * TalentVersion and returning to the Published version. Pattern matches the
 * sibling submit route exactly (app/api/admin/talent/[id]/proposals/
 * [versionId]/submit/route.js): API Route (not a Server Action), auth via
 * requireOwnerOrEmployee() as defense in depth alongside middleware.js,
 * route does nothing but param-validate then call the engine — no
 * repository/Prisma import here, and the actual DRAFT-only guard is
 * enforced by proposalService.discard() itself, not by this route.
 *
 * Business meaning (locked decision this sprint): "Cancel Editing" deletes
 * the DRAFT row outright. The Published version is a separate, untouched
 * row, so deleting the Draft *is* "returning to Published" — no other
 * write happens here.
 *
 * Locked decisions this route encodes:
 *   - only a DRAFT can be discarded this way; any other status (in
 *     particular PROPOSED) is rejected with 409 before
 *     proposalService.discard() is even called (defense in depth on top of
 *     that service's own guard)
 *   - PROPOSED is explicitly out of scope here — withdrawing/cancelling a
 *     submitted proposal remains exclusively the Owner Reject flow
 *     (app/api/admin/talent/[id]/proposals/[versionId]/reject/route.js),
 *     which this route never calls and does not change
 *   - both OWNER and EMPLOYEE may discard a Draft (requireOwnerOrEmployee,
 *     same as the submit/save-draft routes) — no extra role check, since
 *     "abandon your own in-progress edit" is symmetric across both roles
 *
 * Behavior:
 *   - no session                          -> 401 (also enforced by middleware)
 *   - missing id/versionId                -> 400
 *   - talent not found                    -> 404
 *   - version not found / wrong talent    -> 404
 *   - version exists but isn't DRAFT      -> 409, { error, code: 'NOT_DISCARDABLE' }
 *   - otherwise                           -> 200, { discarded: true }
 *
 * Out of scope (later sprints, not this one): Gallery/Socials/SEO discard,
 * and any change to Approve/Reject/Publish semantics.
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
          'discarded. A Proposed version can only be withdrawn via Owner Reject.',
        code: 'NOT_DISCARDABLE',
        status: existingVersion.status,
      },
      { status: 409 }
    );
  }

  try {
    await proposalService.discard(talentAdapter, {
      parentId: id,
      versionId,
      actorId: session.userId,
    });

    return NextResponse.json({ discarded: true }, { status: 200 });
  } catch (error) {
    console.error(
      '[POST /api/admin/talent/[id]/proposals/[versionId]/discard] failed to discard:',
      error
    );
    return NextResponse.json({ error: 'Failed to discard draft.' }, { status: 500 });
  }
}
