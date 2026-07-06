/*
 * PATCH /api/admin/talent/[id]/socials — Social Links persistence sprint.
 *
 * Explicit, user-action-only entry point for the Socials tab's "שמור
 * כטיוטה" button. Pattern matches the sibling TalentVersion Save Draft
 * route (app/api/admin/talent/[id]/proposals/[versionId]/route.js) as
 * closely as the shape allows: API Route (not a Server Action), auth via
 * requireUser() as defense in depth alongside middleware.js, route does
 * nothing but param/body-validate then call the engine — no
 * repository/Prisma import here, only `talentAdapter` + the new
 * `socialsService`.
 *
 * Shape difference from the TalentVersion route, and why: a single Save
 * Draft action here can touch *several* TalentSocial rows at once (one
 * call inserts/updates every account currently in the editor's proposed
 * list), not one version row, so there's no `[versionId]` segment — the
 * body carries the whole `accounts` array and `socialsService.saveDraft`
 * decides per-row whether to insert a new Draft, clone-from-Published into
 * a new Draft, or update an existing Draft/Proposed row in place (see that
 * file's header comment).
 *
 * Validation here DOES block (unlike proposalService.update()'s
 * never-block rule for TalentVersion) — see socialsService.js's header
 * comment for why a malformed/empty social account is treated as
 * unsavable, not "incomplete but fine." A validation failure returns 422
 * with per-account Hebrew error messages, not 200.
 *
 * Behavior:
 *   - no session                  -> 401 (also enforced by middleware)
 *   - missing id                  -> 400
 *   - body.accounts not an array  -> 400
 *   - talent not found            -> 404
 *   - one or more accounts invalid -> 422, { error, code: 'VALIDATION_FAILED', details }
 *   - an account id not found / belongs to another talent -> 404
 *   - an account id exists but isn't PUBLISHED/DRAFT/PROPOSED -> 409
 *   - EMPLOYEE editing a DRAFT/PROPOSED account created by a different user
 *     -> 403, { error, code: 'FORBIDDEN_NOT_DRAFT_OWNER' } (Auth Hardening +
 *     Draft Ownership Sprint 1 — enforced inside socialsService.saveDraft()
 *     itself, not here; OWNER may edit any account)
 *   - otherwise                   -> 200, { accounts }
 *
 * Out of scope (not this sprint): Gallery, SEO, image uploads, removing an
 * existing social account (no delete control exists in the UI yet — see
 * SocialLinkRow.jsx).
 */

import { NextResponse } from 'next/server';
import { requireOwnerOrEmployee } from '@/lib/admin/auth/authorize';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';
import { socialsService, SocialValidationError } from '@/lib/admin/engine/socialsService';
import { he } from '@/lib/admin/i18n/he';

export async function PATCH(request, { params }) {
  let session;
  try {
    session = await requireOwnerOrEmployee(request);
  } catch (error) {
    return NextResponse.json(
      { error: he.social.errors.notAuthenticated },
      { status: error.statusCode || 401 }
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Talent id is required.' }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: he.social.errors.invalidBody }, { status: 400 });
  }

  const accounts = body?.accounts;
  if (!Array.isArray(accounts)) {
    return NextResponse.json({ error: he.social.errors.invalidBody }, { status: 400 });
  }

  const talent = await talentAdapter.getParent(id);
  if (!talent) {
    return NextResponse.json({ error: 'Talent not found.' }, { status: 404 });
  }

  try {
    const { accounts: saved } = await socialsService.saveDraft(talentAdapter, {
      parentId: id,
      accounts,
      actorId: session.userId,
      actorRole: session.role,
    });

    return NextResponse.json({ accounts: saved }, { status: 200 });
  } catch (error) {
    if (error instanceof SocialValidationError) {
      return NextResponse.json(
        { error: he.social.errors.validationSummary, code: error.code, details: error.details },
        { status: 422 }
      );
    }
    if (error.code === 'FORBIDDEN_NOT_DRAFT_OWNER') {
      return NextResponse.json(
        { error: he.social.errors.notDraftOwner, code: error.code },
        { status: 403 }
      );
    }
    if (error.message && error.message.includes('not found for this talent')) {
      return NextResponse.json({ error: he.social.errors.notFound }, { status: 404 });
    }
    if (error.message && error.message.includes('only PUBLISHED, DRAFT, or PROPOSED rows')) {
      return NextResponse.json(
        { error: he.social.errors.notEditable, code: 'NOT_EDITABLE' },
        { status: 409 }
      );
    }
    console.error('[PATCH /api/admin/talent/[id]/socials] failed to save draft:', error);
    return NextResponse.json({ error: he.social.errors.serverError }, { status: 500 });
  }
}
