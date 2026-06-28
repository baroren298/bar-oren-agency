/*
 * POST /api/admin/talent — "Add New Talent" sprint.
 *
 * Creates a brand-new Talent (parent row) plus its first TalentVersion, in
 * response to an explicit POST from the new /admin/talent/new form. Per the
 * sprint's product decision ("Owner-created talent can be created directly
 * as the initial editable/published admin record" — only OWNER exists at
 * launch, Section 11), the first version is written straight as PUBLISHED;
 * see talentRepository.createTalentWithInitialVersion's header comment for
 * the full reasoning. Every subsequent edit to this talent still goes
 * through the unchanged Draft -> Proposed -> Approve -> Publish flow.
 *
 * Pattern matches the existing proposals route (app/api/admin/talent/[id]/
 * proposals/route.js): an API Route, not a Server Action; requireUser()
 * re-derives the session independently as defense in depth even though
 * middleware.js already gates /api/admin/* with the same check; calls the
 * adapter directly (talentAdapter.createParentWithInitialVersion /
 * getParentBySlug) rather than a generic engine service, the same way the
 * proposals route calls talentAdapter.getParent directly — talent creation
 * has no generic cross-entity equivalent yet, so there's nothing for a
 * service layer to add here.
 *
 * Validation:
 *   - name, slug, bioHe are required (he.talent.create copy explains why in
 *     the UI: these are the minimum fields needed for a usable profile).
 *   - slug must be lowercase ASCII letters/digits/hyphens only, matching the
 *     public site's existing slug shape (data/talent/index.js).
 *   - slug uniqueness is checked twice: an early read (getParentBySlug, for
 *     a fast/friendly error) and the DB's own `@unique` constraint inside
 *     the repository's transaction (the authoritative check — closes the
 *     race between the early read and the write).
 *   - category, location, birthDate, bioEn are optional.
 *
 * Out of scope this sprint (see ADMIN_TALENT_DETAIL_AUDIT-adjacent product
 * decision): primary image upload (no upload pipeline exists yet —
 * imageAssetRepository.uploadImage is still an unimplemented stub) and any
 * Gallery/Socials/SEO data — those are added afterward via the talent's
 * normal edit workflow, not at creation time.
 */

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/admin/auth/authorize';
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
    session = await requireUser(request);
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
  const bioHe = typeof body.bioHe === 'string' ? body.bioHe.trim() : '';
  const location = typeof body.location === 'string' ? body.location.trim() : '';
  const bioEn = typeof body.bioEn === 'string' ? body.bioEn.trim() : '';
  const category = Array.isArray(body.category)
    ? body.category.filter((c) => typeof c === 'string' && c.trim())
    : [];

  const fieldErrors = {};
  if (!name) fieldErrors.name = he.talent.create.errors.nameRequired;
  if (!slug) {
    fieldErrors.slug = he.talent.create.errors.slugRequired;
  } else if (!SLUG_PATTERN.test(slug)) {
    fieldErrors.slug = he.talent.create.errors.slugInvalid;
  }
  if (!bioHe) fieldErrors.bioHe = he.talent.create.errors.bioRequired;

  let birthDate = null;
  if (body.birthDate) {
    const parsed = new Date(body.birthDate);
    if (Number.isNaN(parsed.getTime())) {
      fieldErrors.birthDate = he.talent.create.errors.birthDateInvalid;
    } else {
      birthDate = parsed;
    }
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
    category,
    location: location || null,
    birthDate,
    bioHe,
    bioEn: bioEn || null,
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
    // a single-route action — "a version was created" is true here too, it
    // just happens to already be PUBLISHED. See that listener's header
    // comment for the parallel, already-documented VERSION_PUBLISHED gap.
    await eventService.emit(EVENT_TYPE.PROPOSAL_CREATED, {
      entityType: talentAdapter.entityType,
      entityId: talent.id,
      actorId: session.userId,
      payload: { versionId: version.id, fields: { ...fields, slug } },
      metadata: { directPublish: true },
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
