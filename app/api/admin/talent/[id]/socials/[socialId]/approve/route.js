/*
 * POST /api/admin/talent/[id]/socials/[socialId]/approve — Owner
 * Approve/Reject (Social Links) sprint.
 *
 * Explicit, user-action-only entry point for the Owner Review panel's
 * "אשר ופרסם" button. Owner-only (requireOwner, not requireUser — Section
 * 11: an Editor can save/submit a proposal but only an Owner may approve
 * it), mirroring the role split already documented on
 * lib/admin/auth/authorize.js's `requireOwner`.
 *
 * Route does nothing but param-validate then call
 * `socialsService.approve()` — no repository/Prisma import here, only
 * `talentAdapter` + `socialsService`, same layering every other socials
 * route already follows.
 *
 * Behavior:
 *   - no session / not Owner        -> 401 / 403
 *   - missing id or socialId        -> 400
 *   - talent not found              -> 404
 *   - social row not found for this talent -> 404
 *   - social row isn't PROPOSED     -> 409, { error, code: 'NOT_PROPOSABLE' }
 *   - otherwise                     -> 200, { account }
 */

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin/auth/authorize';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';
import { socialsService } from '@/lib/admin/engine/socialsService';
import { he } from '@/lib/admin/i18n/he';

export async function POST(request, { params }) {
  let session;
  try {
    session = await requireOwner(request);
  } catch (error) {
    return NextResponse.json(
      { error: error.statusCode === 403 ? he.social.errors.notOwner : he.social.errors.notAuthenticated },
      { status: error.statusCode || 401 }
    );
  }

  const { id, socialId } = await params;
  if (!id || !socialId) {
    return NextResponse.json({ error: 'Talent id and social id are required.' }, { status: 400 });
  }

  const talent = await talentAdapter.getParent(id);
  if (!talent) {
    return NextResponse.json({ error: 'Talent not found.' }, { status: 404 });
  }

  try {
    const { account } = await socialsService.approve(talentAdapter, {
      parentId: id,
      socialId,
      actorId: session.userId,
      actorRole: session.role,
    });

    return NextResponse.json({ account }, { status: 200 });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return NextResponse.json({ error: he.social.errors.notFound }, { status: 404 });
    }
    if (error.code === 'NOT_PROPOSABLE') {
      return NextResponse.json(
        { error: he.social.errors.notProposable, code: 'NOT_PROPOSABLE' },
        { status: 409 }
      );
    }
    console.error('[POST /api/admin/talent/[id]/socials/[socialId]/approve] failed to approve:', error);
    return NextResponse.json({ error: he.social.errors.serverError }, { status: 500 });
  }
}
