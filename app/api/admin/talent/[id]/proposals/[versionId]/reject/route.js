/*
 * POST /api/admin/talent/[id]/proposals/[versionId]/reject — OWNER/EMPLOYEE
 * Permission Model Sprint.
 *
 * Sibling to the approve route in this same directory — same rationale
 * (approvalService.reject() already existed and was unit-tested, but no
 * TalentVersion route ever called it). Modeled directly on the Gallery
 * reject route (app/api/admin/talent/[id]/gallery/[imageId]/reject/route.js):
 * Owner-only (requireOwner), requires a non-empty `rejectionNote` in the
 * body, no business logic duplicated — this route only param/body-validates
 * then calls the existing `approvalService.reject()`.
 *
 * Defense in depth: `session.role` is forwarded as `actorRole` so
 * approvalService also verifies OWNER independently of this route's own
 * requireOwner() gate.
 *
 * Behavior:
 *   - no session / not Owner            -> 401 / 403
 *   - missing id or versionId           -> 400
 *   - missing/blank rejectionNote       -> 400, { error, code: 'REJECTION_NOTE_REQUIRED' }
 *   - talent not found                  -> 404
 *   - version not found for this talent -> 404
 *   - version isn't PROPOSED            -> 409
 *   - otherwise                         -> 200, { version }
 */

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin/auth/authorize';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';
import { approvalService } from '@/lib/admin/engine/approvalService';

export async function POST(request, { params }) {
  let session;
  try {
    session = await requireOwner(request);
  } catch (error) {
    return NextResponse.json(
      { error: error.statusCode === 403 ? 'Only the Owner may reject a proposal.' : 'Not authenticated.' },
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

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const rejectionNote = typeof body?.rejectionNote === 'string' ? body.rejectionNote.trim() : '';
  if (!rejectionNote) {
    return NextResponse.json(
      { error: 'rejectionNote is required.', code: 'REJECTION_NOTE_REQUIRED' },
      { status: 400 }
    );
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
    const version = await approvalService.reject(talentAdapter, {
      parentId: id,
      versionId,
      actorId: session.userId,
      actorRole: session.role,
      rejectionNote,
    });

    return NextResponse.json({ version }, { status: 200 });
  } catch (error) {
    if (error.message && error.message.includes('not') && error.message.includes('PROPOSED')) {
      return NextResponse.json(
        { error: `This version is "${existingVersion.status}", not Proposed — only a Proposed version can be rejected.`, code: 'NOT_PROPOSABLE', status: existingVersion.status },
        { status: 409 }
      );
    }
    if (error.message && error.message.includes('rejectionNote is required')) {
      return NextResponse.json(
        { error: 'rejectionNote is required.', code: 'REJECTION_NOTE_REQUIRED' },
        { status: 400 }
      );
    }
    console.error('[POST /api/admin/talent/[id]/proposals/[versionId]/reject] failed to reject:', error);
    return NextResponse.json({ error: 'Failed to reject proposal.' }, { status: 500 });
  }
}
