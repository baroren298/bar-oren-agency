/*
 * PATCH /api/admin/talent/[id]/proposals/[versionId] — "Save Draft" sprint.
 *
 * Explicit, user-action-only entry point for updating a Draft TalentVersion's
 * fields in place. Pattern matches the sibling POST route
 * (app/api/admin/talent/[id]/proposals/route.js) exactly: API Route (not a
 * Server Action), auth via requireUser() as defense in depth alongside
 * middleware.js, route does nothing but param-validate then call the engine
 * — no repository/Prisma import here.
 *
 * Extended by the "Editable PROPOSED" sprint: this route now also accepts a
 * PROPOSED version (product decision — a PROPOSED version stays editable
 * in place until a future sprint's Owner review locks it; no IN_REVIEW
 * status, no locking, no Approve/Reject/Publish here). The DRAFT-only
 * language below is otherwise unchanged from the original "Save Draft"
 * sprint.
 *
 * Locked decisions this route encodes:
 *   - manual save only, no auto-save (nothing here is called except by an
 *     explicit "שמור כטיוטה" / "עדכן הצעה" click)
 *   - updates the existing DRAFT or PROPOSED version in place — never
 *     creates a new version row
 *   - expects the *complete* current payload from the editor, not a partial
 *     diff (ComparisonView's proposed-column state is always the full set
 *     of fields it knows about) — "partial" here refers only to which
 *     *columns* talentRepository.updateTalentVersionFields is allowed to
 *     touch (the column-clobber safeguard), not to what the client sends
 *   - validation never blocks this endpoint — an incomplete Draft is a
 *     supported, expected state (full validation gates Submit, a later
 *     sprint)
 *   - conflict info is returned to the client as non-blocking, informational
 *     metadata — it never causes this endpoint to reject the save
 *
 * Behavior:
 *   - no session                          -> 401 (also enforced by middleware)
 *   - missing id/versionId/fields         -> 400
 *   - talent not found                    -> 404
 *   - version not found                   -> 404
 *   - version exists but isn't DRAFT/PROPOSED -> 409 (server-side authority —
 *     proposalService.update() is what actually enforces this; this status
 *     code just reflects the error it throws)
 *   - EMPLOYEE editing a version created by a different user -> 403,
 *     { error, code: 'FORBIDDEN_NOT_DRAFT_OWNER' } (Auth Hardening + Draft
 *     Ownership Sprint 1 — enforced inside proposalService.update() itself,
 *     not here; OWNER may edit any version)
 *   - otherwise                           -> 200, { version, conflict, validation }
 *
 * Out of scope (next sprints, not this one): Submit, Approve, Reject,
 * Publish, and any Gallery/Socials/SEO saving.
 */

import { NextResponse } from 'next/server';
import { requireOwnerOrEmployee } from '@/lib/admin/auth/authorize';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';
import { proposalService } from '@/lib/admin/engine/proposalService';
import { VERSION_STATUS } from '@/lib/admin/constants/enums';

export async function PATCH(request, { params }) {
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

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const fields = body?.fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    return NextResponse.json({ error: 'fields must be an object.' }, { status: 400 });
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
          `This version is "${existingVersion.status}", not a Draft or Proposed — only a Draft ` +
          'or Proposed version can be edited and saved.',
        code: 'NOT_EDITABLE',
        status: existingVersion.status,
      },
      { status: 409 }
    );
  }

  try {
    const { version, conflict, validation } = await proposalService.update(talentAdapter, {
      parentId: id,
      versionId,
      fields,
      actorId: session.userId,
      actorRole: session.role,
      basedOnRevisionNumber: talent.revisionNumber,
    });

    return NextResponse.json({ version, conflict, validation }, { status: 200 });
  } catch (error) {
    if (error.code === 'FORBIDDEN_NOT_DRAFT_OWNER') {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 403 });
    }
    console.error('[PATCH /api/admin/talent/[id]/proposals/[versionId]] failed to save draft:', error);
    return NextResponse.json({ error: 'Failed to save draft.' }, { status: 500 });
  }
}
