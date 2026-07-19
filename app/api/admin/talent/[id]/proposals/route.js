/*
 * POST /api/admin/talent/[id]/proposals — "Start Editing" sprint.
 *
 * Explicit, user-action-only entry point for creating a Draft TalentVersion.
 * Per the architecture decision: opening /admin/talent/[id] is a pure read
 * (see that page's own header comment) — a Draft is only ever created here,
 * in response to an explicit POST, never as a side effect of any GET.
 *
 * Pattern: API Route, not a Server Action — matches the rest of this
 * codebase's admin mutations (app/api/admin/auth/login|logout/route.js),
 * which already documented that choice explicitly. proxy.js already
 * 401s any unauthenticated request under /api/admin/* before this file
 * runs; requireUser() below re-derives the session from the same cookie
 * independently anyway, as defense in depth (the same pattern
 * lib/admin/auth/authorize.js's own header comment describes), and is also
 * how this route gets `actorId` for proposalService.create().
 *
 * No repository/Prisma import here — this route only calls into the
 * existing engine (versionService, proposalService) and adapter
 * (talentAdapter), per the layering rule that Presentation/API never skips
 * the engine to reach a repository directly.
 *
 * Behavior (idempotent / explicit per state):
 *   - no session                          -> 401 (also enforced by middleware)
 *   - talent not found                    -> 404
 *   - a DRAFT already exists              -> 200, returns the existing Draft, creates nothing
 *   - a PROPOSED version already exists   -> 409, blocks creation, no competing Draft
 *   - no pending version, Published exists -> 201, creates a new DRAFT seeded
 *                                             from the Published version's fields
 *   - no pending version, no Published    -> 422 (explicitly not inventing
 *                                             empty-field content this sprint)
 *
 * Out of scope (next sprints, not this one): Save Draft, Submit, Approve,
 * Reject, Publish, and any Gallery/Socials/SEO editing.
 */

import { NextResponse } from 'next/server';
import { requireOwnerOrEmployee } from '@/lib/admin/auth/authorize';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';
import { versionService } from '@/lib/admin/engine/versionService';
import { proposalService } from '@/lib/admin/engine/proposalService';
import { extractTalentVersionFields } from '@/lib/admin/talent-workspace';
import { VERSION_STATUS } from '@/lib/admin/constants/enums';
import { isTalentArchived, talentArchivedResponse } from '@/lib/admin/talent-archive-guard';

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

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Talent id is required.' }, { status: 400 });
  }

  const talent = await talentAdapter.getParent(id);
  if (!talent) {
    return NextResponse.json({ error: 'Talent not found.' }, { status: 404 });
  }

  // Talent Archive & Restore feature — an archived talent is read-only:
  // no new Draft may be started on it until it's restored.
  if (isTalentArchived(talent)) {
    return talentArchivedResponse();
  }

  // Read-only check: does a pending (DRAFT or PROPOSED) version already exist?
  const pending = await versionService.getCurrentDraftOrProposed(talentAdapter, id);

  if (pending && pending.status === VERSION_STATUS.DRAFT) {
    // Idempotent: hand back the existing Draft rather than creating a second one.
    return NextResponse.json({ version: pending, created: false }, { status: 200 });
  }

  if (pending && pending.status === VERSION_STATUS.PROPOSED) {
    // Block: a Proposed version is already mid-review; don't create a
    // competing Draft behind its back.
    return NextResponse.json(
      {
        error:
          'A proposed version for this talent is already awaiting approval. ' +
          'Wait for a decision on it before starting a new draft.',
        code: 'PROPOSED_EXISTS',
        version: pending,
      },
      { status: 409 }
    );
  }

  // No pending version — seed a brand-new Draft from the current Published
  // version, per architecture decision: do not invent empty-field content.
  const publishedVersion = await versionService.getCurrentPublished(talentAdapter, id);
  if (!publishedVersion) {
    return NextResponse.json(
      {
        error:
          'No published version exists yet for this talent, so there is nothing to seed a ' +
          'draft from. Not supported this sprint.',
        code: 'NO_PUBLISHED_VERSION',
      },
      { status: 422 }
    );
  }

  const fields = extractTalentVersionFields(publishedVersion);

  // Talent SEO + Slug Management sprint — a published version created
  // before the slug column existed carries `slug: null` ("no slug
  // change"). Seed the new Draft's slug from the parent Talent's live slug
  // instead, so the Slug editor always starts from the real public slug
  // rather than an empty field. Purely a seeding default: the Draft's slug
  // remains fully editable and only ever reaches Talent.slug via Publish.
  if (fields.slug == null) {
    fields.slug = talent.slug;
  }

  try {
    const { version } = await proposalService.create(talentAdapter, {
      parentId: id,
      fields,
      actorId: session.userId,
      basedOnVersionId: publishedVersion.id,
      basedOnRevisionNumber: talent.revisionNumber,
    });

    return NextResponse.json({ version, created: true }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/admin/talent/[id]/proposals] failed to create draft:', error);
    return NextResponse.json({ error: 'Failed to create draft.' }, { status: 500 });
  }
}
