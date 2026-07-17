/*
 * POST /api/admin/talent — "Add New Talent" flow, revised per product
 * decision: creating a talent must NOT publish it directly.
 *
 * Creates a brand-new Talent (parent row) plus its first TalentVersion, in
 * response to an explicit POST from the new /admin/talent/new form. The
 * first version is written as DRAFT — an initial, editable admin record
 * only, with no public effect — see talentRepository.
 * createTalentWithInitialVersion's header comment for the full reasoning.
 * The admin/employee is redirected to the talent detail page to complete
 * profile details, gallery, socials, and SEO; only after that does the
 * normal Draft -> Proposed -> Approve -> Publish flow apply, unchanged.
 *
 * Pattern matches the existing proposals route (app/api/admin/talent/[id]/
 * proposals/route.js): an API Route, not a Server Action;
 * requireOwnerOrEmployee() re-derives the session independently as defense
 * in depth even though proxy.js already gates /api/admin/* with the
 * same check (Pre-merge blocker fix sprint, QA finding #3: was
 * requireUser — functionally identical today, but every sibling write
 * route is written against the explicit role list so a future third role,
 * e.g. a read-only reviewer, never silently gains create rights just by
 * having a valid session); calls the
 * adapter directly (talentAdapter.createParentWithInitialVersion /
 * getParentBySlug) rather than a generic engine service, the same way the
 * proposals route calls talentAdapter.getParent directly — talent creation
 * has no generic cross-entity equivalent yet, so there's nothing for a
 * service layer to add here.
 *
 * Validation:
 *   - name (Hebrew name) and slug are required — the only two fields the
 *     simplified create form collects that the talent record actually
 *     needs to exist. nameEn (English name) is collected by the same form
 *     but optional here, consistent with the rest of this schema (e.g.
 *     TalentVersion.nameEn is a nullable column) — it can be filled in
 *     immediately afterward on the talent detail page if left blank.
 *   - slug must be lowercase ASCII letters/digits/hyphens only, matching the
 *     public site's existing slug shape (data/talent/index.js).
 *   - slug uniqueness is checked twice: an early read (getParentBySlug, for
 *     a fast/friendly error) and the DB's own `@unique` constraint inside
 *     the repository's transaction (the authoritative check — closes the
 *     race between the early read and the write).
 *
 * Deliberately out of scope for this route, per the product decision —
 * categories, birth date, and location are not collected at creation time at
 * all (not just "optional"); they, along with gallery/socials/SEO, are
 * completed afterward via the talent's normal edit workflow.
 *
 * Create Talent Sprint 1: widened to also accept `bioHe` (Hebrew short bio)
 * and `profileImageAssetId` (an already-uploaded Asset's id, from the
 * existing POST /api/admin/assets/upload?purpose=profile endpoint — see
 * NewTalentForm.jsx). Both optional, both passed straight through to
 * `fields` exactly like `nameEn` already was — no new validation rule, no
 * new repository/adapter method: `talentRepository.
 * createTalentWithInitialVersion` already writes both columns (they were
 * always part of TalentVersion's schema), this route just wasn't forwarding
 * them yet. `profileImageAssetId` is not existence-checked here; an invalid
 * id surfaces as a Prisma foreign-key error, caught by the generic
 * try/catch below and reported as the same friendly serverError — consistent
 * with how every other FK on this model is handled today.
 */

import { NextResponse } from 'next/server';
import { requireOwnerOrEmployee } from '@/lib/admin/auth/authorize';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';
import { eventService } from '@/lib/admin/engine/eventService';
import { EVENT_TYPE } from '@/lib/admin/engine/eventTypes';
import { he } from '@/lib/admin/i18n/he';

// Lowercase ASCII letters/digits/hyphens only; no leading/trailing/double
// hyphens — same shape the public site's existing talent slugs already use.
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function POST(request) {
  let session;
  try {
    session = await requireOwnerOrEmployee(request);
  } catch (error) {
    return NextResponse.json(
      { error: he.talent.create.errors.notAuthenticated },
      { status: error.statusCode || 401 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: he.talent.create.errors.invalidBody }, { status: 400 });
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const nameEn = typeof body.nameEn === 'string' ? body.nameEn.trim() : '';
  const bioHe = typeof body.bioHe === 'string' ? body.bioHe.trim() : '';
  const profileImageAssetId =
    typeof body.profileImageAssetId === 'string' && body.profileImageAssetId.trim()
      ? body.profileImageAssetId.trim()
      : null;

  const fieldErrors = {};
  if (!name) fieldErrors.name = he.talent.create.errors.nameRequired;
  if (!slug) {
    fieldErrors.slug = he.talent.create.errors.slugRequired;
  } else if (!SLUG_PATTERN.test(slug)) {
    fieldErrors.slug = he.talent.create.errors.slugInvalid;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { error: he.talent.create.errors.validationSummary, fieldErrors },
      { status: 400 }
    );
  }

  const existing = await talentAdapter.getParentBySlug(slug);
  if (existing) {
    return NextResponse.json(
      {
        error: he.talent.create.errors.slugTaken,
        fieldErrors: { slug: he.talent.create.errors.slugTaken },
      },
      { status: 409 }
    );
  }

  const fields = {
    name,
    nameEn: nameEn || null,
    bioHe: bioHe || null,
    profileImageAssetId,
  };

  // Belt-and-suspenders: the manual checks above already cover everything
  // talentAdapter.validate() checks today (name), but routing creation
  // through the adapter's own validate() too means this route automatically
  // benefits from any future tightening of that shared rule, same as every
  // proposal-creation path does.
  const validation = talentAdapter.validate(fields);
  if (!validation.valid) {
    return NextResponse.json(
      { error: he.talent.create.errors.validationSummary, fieldErrors: { name: he.talent.create.errors.nameRequired } },
      { status: 400 }
    );
  }

  try {
    const { talent, version } = await talentAdapter.createParentWithInitialVersion(fields, {
      slug,
      createdById: session.userId,
    });

    // Audit trail: reuse the existing PROPOSAL_CREATED -> ACTION_TYPE.CREATED
    // mapping (auditLogListener.js) rather than adding a new EVENT_TYPE for
    // a single-route action — "a version was created" is true here, as a
    // DRAFT (not published). See that listener's header comment for the
    // parallel, already-documented VERSION_PUBLISHED gap.
    await eventService.emit(EVENT_TYPE.PROPOSAL_CREATED, {
      entityType: talentAdapter.entityType,
      entityId: talent.id,
      actorId: session.userId,
      payload: { versionId: version.id, fields: { ...fields, slug } },
      metadata: { initialStatus: 'DRAFT' },
    });

    return NextResponse.json({ talent, version }, { status: 201 });
  } catch (error) {
    // P2002 = Prisma unique constraint violation — the authoritative
    // slug-uniqueness check, catching the race the early getParentBySlug
    // read above can't fully close.
    if (error && error.code === 'P2002') {
      return NextResponse.json(
        {
          error: he.talent.create.errors.slugTaken,
          fieldErrors: { slug: he.talent.create.errors.slugTaken },
        },
        { status: 409 }
      );
    }

    console.error('[POST /api/admin/talent] failed to create talent:', error);
    return NextResponse.json({ error: he.talent.create.errors.serverError }, { status: 500 });
  }
}
