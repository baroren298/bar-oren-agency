/*
 * Clean Admin Talent URL sprint — unit coverage for lib/admin/talent-route.js:
 * the admin link builder (adminTalentPath) and the /admin/talent/[id]
 * dynamic-segment resolver (resolveAdminTalentRoute). Pure functions with
 * injected lookups — no Prisma, no Next runtime, no network.
 */
import { describe, it, expect } from 'vitest';
import { adminTalentPath, resolveAdminTalentRoute } from './talent-route';

const ID = 'cmqwfxrmg002jjwqz2g7jbj7t';
const SLUG = 'michal-ben-david';

/** Minimal in-memory stand-ins for talentAdapter.getParent/getParentBySlug. */
function lookupsFor(talents) {
  return {
    getParent: async (id) => talents.find((t) => t.id === id) ?? null,
    getParentBySlug: async (slug) => talents.find((t) => t.slug === slug) ?? null,
  };
}

describe('adminTalentPath — generated admin links', () => {
  it('uses the current published slug when available', () => {
    expect(adminTalentPath({ id: ID, slug: SLUG })).toBe(`/admin/talent/${SLUG}`);
  });

  it('falls back to the internal id only when no slug exists', () => {
    expect(adminTalentPath({ id: ID, slug: null })).toBe(`/admin/talent/${ID}`);
    expect(adminTalentPath({ id: ID })).toBe(`/admin/talent/${ID}`);
  });

  it('never reads a pending version slug — only the parent Talent record', () => {
    // A draft/proposed slug lives on TalentVersion, not on the parent —
    // even if a caller passes the whole talent with pending data attached,
    // only `slug` (the published one) is consulted.
    const talent = {
      id: ID,
      slug: SLUG,
      versions: [{ status: 'DRAFT', slug: 'unpublished-draft-slug' }],
    };
    expect(adminTalentPath(talent)).toBe(`/admin/talent/${SLUG}`);
  });
});

describe('resolveAdminTalentRoute — /admin/talent/[id] segment resolution', () => {
  it('resolves a published slug directly, with no redirect', async () => {
    const result = await resolveAdminTalentRoute(SLUG, lookupsFor([{ id: ID, slug: SLUG }]));
    expect(result.talent).toMatchObject({ id: ID, slug: SLUG });
    expect(result.redirectTo).toBeNull();
  });

  it('resolves a legacy ID and redirects to the canonical slug URL', async () => {
    const result = await resolveAdminTalentRoute(ID, lookupsFor([{ id: ID, slug: SLUG }]));
    expect(result.talent).toMatchObject({ id: ID, slug: SLUG });
    expect(result.redirectTo).toBe(`/admin/talent/${SLUG}`);
  });

  it('prefers an exact ID match over a slug collision', async () => {
    // Pathological case: one talent's slug equals another's id. Exact-ID
    // lookup wins, per the "ID first only when it matches an existing ID"
    // rule.
    const collider = { id: ID, slug: 'collider' };
    const other = { id: 'other-id', slug: ID };
    const result = await resolveAdminTalentRoute(ID, lookupsFor([collider, other]));
    expect(result.talent).toBe(collider);
    expect(result.redirectTo).toBe('/admin/talent/collider');
  });

  it('renders in place (no redirect loop) when a talent found by ID has no slug', async () => {
    const result = await resolveAdminTalentRoute(ID, lookupsFor([{ id: ID, slug: null }]));
    expect(result.talent).toMatchObject({ id: ID });
    expect(result.redirectTo).toBeNull();
  });

  it('returns null talent for an unknown segment (caller 404s)', async () => {
    const result = await resolveAdminTalentRoute('does-not-exist', lookupsFor([{ id: ID, slug: SLUG }]));
    expect(result.talent).toBeNull();
    expect(result.redirectTo).toBeNull();
  });

  it('returns null talent for an empty segment without calling any lookup', async () => {
    const result = await resolveAdminTalentRoute('', {
      getParent: async () => {
        throw new Error('must not be called');
      },
      getParentBySlug: async () => {
        throw new Error('must not be called');
      },
    });
    expect(result.talent).toBeNull();
    expect(result.redirectTo).toBeNull();
  });

  it('a draft/proposed slug does NOT change the canonical admin URL', async () => {
    // While a pending version proposes "michal-bd-new", the parent
    // Talent.slug is still the published one — the ID URL keeps
    // redirecting to the CURRENT published slug, and the proposed slug
    // does not resolve at all yet.
    const talent = { id: ID, slug: SLUG }; // parent record: published slug only
    const lookups = lookupsFor([talent]);

    const byId = await resolveAdminTalentRoute(ID, lookups);
    expect(byId.redirectTo).toBe(`/admin/talent/${SLUG}`);

    const byProposedSlug = await resolveAdminTalentRoute('michal-bd-new', lookups);
    expect(byProposedSlug.talent).toBeNull();
  });

  it('a PUBLISHED slug change becomes the new canonical admin URL', async () => {
    // Simulate the existing publish flow's one observable effect on
    // routing: Talent.slug is rewritten inside publishTalentVersion's
    // transaction. After that, the same ID URL redirects to the NEW slug,
    // the new slug resolves directly, and the old slug no longer matches.
    const published = { id: ID, slug: 'michal-bd-new' };
    const lookups = lookupsFor([published]);

    const byId = await resolveAdminTalentRoute(ID, lookups);
    expect(byId.redirectTo).toBe('/admin/talent/michal-bd-new');

    const byNewSlug = await resolveAdminTalentRoute('michal-bd-new', lookups);
    expect(byNewSlug.talent).toBe(published);
    expect(byNewSlug.redirectTo).toBeNull();

    const byOldSlug = await resolveAdminTalentRoute(SLUG, lookups);
    expect(byOldSlug.talent).toBeNull();
  });
});
