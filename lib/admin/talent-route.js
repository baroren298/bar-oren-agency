/*
 * Admin talent routing helpers — Clean Admin Talent URL sprint.
 *
 * The browser-facing admin workspace URL is now slug-based:
 *
 *   /admin/talent/michal-ben-david      (canonical)
 *   /admin/talent/cmqwfxrmg002jjwqz...  (legacy ID — still works, redirects)
 *
 * Two exports, both pure (no Prisma/Next imports — data access is injected
 * so this stays unit-testable and reusable):
 *
 *   - adminTalentPath({ id, slug }) — the ONE place admin talent links are
 *     built. Prefers the parent Talent.slug — the current AUTHORITATIVE
 *     PUBLISHED slug, which only ever changes inside
 *     talentRepository.publishTalentVersion's transaction. A pending
 *     DRAFT/PROPOSED version's slug lives on TalentVersion.slug and is
 *     deliberately never consulted here, so unpublished slug edits can't
 *     prematurely change admin routes; once such a version is published,
 *     Talent.slug carries the new value and links follow automatically.
 *     Falls back to the internal id only when no slug exists.
 *
 *   - resolveAdminTalentRoute(param, lookups) — how /admin/talent/[id]
 *     interprets its dynamic segment. Exact-ID lookup first (IDs are cuids;
 *     they also happen to match the slug alphabet, so ID identity is
 *     decided by an actual DB hit, never by pattern-guessing): a match
 *     means a legacy ID URL → redirect to the canonical slug URL. Otherwise
 *     the segment is treated as the current published slug. Neither lookup
 *     matching → not-found. Both lookups are the existing pure reads
 *     (talentAdapter.getParent / getParentBySlug); nothing about
 *     authorization changes — middleware and per-action role checks run
 *     exactly as before, regardless of how the talent was resolved.
 */

/**
 * Canonical admin workspace path for a talent.
 *
 * @param {{ id?: string|null, slug?: string|null }} talent - anything
 *   carrying the parent Talent's slug and/or id (a full Talent row, a list
 *   row, or a plain { id, slug } pair)
 * @returns {string} e.g. "/admin/talent/michal-ben-david"
 */
export function adminTalentPath(talent) {
  const segment = talent?.slug || talent?.id || '';
  return `/admin/talent/${segment}`;
}

/**
 * Resolve /admin/talent/[id]'s dynamic segment to a talent, deciding
 * whether the request must first be redirected to the canonical slug URL.
 *
 * @param {string} param - the raw dynamic segment (ID or published slug)
 * @param {object} lookups
 * @param {(id: string) => Promise<object|null>} lookups.getParent -
 *   exact-ID lookup (talentAdapter.getParent)
 * @param {(slug: string) => Promise<object|null>} lookups.getParentBySlug -
 *   published-slug lookup (talentAdapter.getParentBySlug)
 * @returns {Promise<{ talent: object|null, redirectTo: string|null }>}
 *   - talent null → not found (caller renders 404)
 *   - redirectTo non-null → legacy ID URL; caller redirects there instead
 *     of rendering
 */
export async function resolveAdminTalentRoute(param, { getParent, getParentBySlug }) {
  if (!param) return { talent: null, redirectTo: null };

  // Exact ID first — only "is an existing ID" counts, never a shape guess.
  const byId = await getParent(param);
  if (byId) {
    // Legacy ID URL: send the browser to the canonical slug URL. If the
    // talent somehow has no slug (shouldn't happen — slug is required and
    // unique), render in place rather than redirect-looping.
    const redirectTo = byId.slug && byId.slug !== param ? adminTalentPath(byId) : null;
    return { talent: byId, redirectTo };
  }

  const bySlug = await getParentBySlug(param);
  return { talent: bySlug ?? null, redirectTo: null };
}
