/*
 * GET /api/admin/talent/[id]/slug-availability?slug=<slug> — Talent SEO +
 * Slug Management sprint.
 *
 * Read-only duplicate-slug detection for the Slug editor: "is this slug
 * free, or does another Talent already own it?" Called (debounced) while
 * the employee edits the slug so a collision is visible immediately, long
 * before Publish. This check is advisory UX only — the authoritative,
 * race-safe gate remains inside talentRepository.publishTalentVersion's
 * transaction (plus Talent.slug's own @unique constraint), which is what
 * actually blocks a publish. A slug that is "available" here can, in
 * principle, be taken by the time the publish runs; the publish gate is
 * what guarantees correctness.
 *
 * Pattern matches every other admin route: requireOwnerOrEmployee as
 * defense in depth alongside middleware, no repository/Prisma import —
 * the lookup goes through talentAdapter.getParentBySlug (the same
 * pure-read primitive the Add New Talent route already uses).
 *
 * Behavior:
 *   - no session          -> 401
 *   - missing id/slug     -> 400
 *   - invalid slug format -> 200, { available: false, reason: 'INVALID' }
 *     (a format problem is not a duplicate, but it is also never
 *     "available" — the editor shows its own validation message first)
 *   - slug owned by this same talent -> 200, { available: true, ownedByThisTalent: true }
 *   - slug owned by another talent   -> 200, { available: false, reason: 'TAKEN' }
 *   - otherwise                      -> 200, { available: true }
 */

import { NextResponse } from 'next/server';
import { requireOwnerOrEmployee } from '@/lib/admin/auth/authorize';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';
import { isValidSlug } from '@/lib/admin/slug';

export async function GET(request, { params }) {
  try {
    await requireOwnerOrEmployee(request);
  } catch (error) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: error.statusCode || 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Talent id is required.' }, { status: 400 });
  }

  const slug = new URL(request.url).searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({ error: 'slug query parameter is required.' }, { status: 400 });
  }

  if (!isValidSlug(slug)) {
    return NextResponse.json({ available: false, reason: 'INVALID', slug }, { status: 200 });
  }

  try {
    const owner = await talentAdapter.getParentBySlug(slug);
    if (!owner) {
      return NextResponse.json({ available: true, slug }, { status: 200 });
    }
    if (owner.id === id) {
      return NextResponse.json({ available: true, ownedByThisTalent: true, slug }, { status: 200 });
    }
    return NextResponse.json({ available: false, reason: 'TAKEN', slug }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/admin/talent/[id]/slug-availability] lookup failed:', error);
    return NextResponse.json({ error: 'Failed to check slug availability.' }, { status: 500 });
  }
}
