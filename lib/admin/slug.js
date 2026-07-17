/*
 * Slug utilities — Talent SEO + Slug Management sprint.
 *
 * The single source of truth for "what is a valid public slug" and "how do
 * we turn arbitrary text into one." Used by:
 *   - the Slug editor UI (components/admin/SeoEditor.jsx) for live
 *     validation, auto-normalization, and Generate From Name;
 *   - talentRepository.publishTalentVersion, as the server-side publish
 *     gate (an invalid proposed slug blocks the publish);
 *   - the slug-availability API route's format pre-check.
 *
 * Deliberately dependency-free (no i18n import, no Prisma import) so the
 * repository layer may import it without violating the "dependencies point
 * downward only" layering rule, and so it is trivially unit-testable.
 *
 * Slug contract (sprint requirements):
 *   - allowed characters: a-z, 0-9, hyphen (-)
 *   - rejected: Hebrew (or any non-ASCII), spaces, underscores, special
 *     characters, double hyphens, leading/trailing hyphens
 */

/** The one authoritative pattern: lowercase latin/digit runs joined by single hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Machine-readable validation error codes (UI maps them to Hebrew copy). */
export const SLUG_ERROR = Object.freeze({
  EMPTY: 'EMPTY',
  INVALID_CHARACTERS: 'INVALID_CHARACTERS',
  UPPERCASE: 'UPPERCASE',
  WHITESPACE: 'WHITESPACE',
  UNDERSCORE: 'UNDERSCORE',
  DOUBLE_HYPHEN: 'DOUBLE_HYPHEN',
  EDGE_HYPHEN: 'EDGE_HYPHEN',
});

/**
 * Is this string already a fully valid slug? Boolean-only convenience for
 * server-side gates; the UI prefers validateSlug() below for specific
 * error codes.
 *
 * @param {string|null|undefined} slug
 * @returns {boolean}
 */
export function isValidSlug(slug) {
  return typeof slug === 'string' && SLUG_PATTERN.test(slug);
}

/**
 * Validate a slug and report every specific problem found, so the editor
 * can explain exactly what is wrong instead of a generic "invalid".
 *
 * @param {string|null|undefined} slug
 * @returns {{ valid: boolean, errors: string[] }} errors hold SLUG_ERROR codes
 */
export function validateSlug(slug) {
  const value = typeof slug === 'string' ? slug : '';
  const errors = [];

  if (!value) {
    return { valid: false, errors: [SLUG_ERROR.EMPTY] };
  }

  if (/\s/.test(value)) errors.push(SLUG_ERROR.WHITESPACE);
  if (/_/.test(value)) errors.push(SLUG_ERROR.UNDERSCORE);
  if (/[A-Z]/.test(value)) errors.push(SLUG_ERROR.UPPERCASE);
  if (/--/.test(value)) errors.push(SLUG_ERROR.DOUBLE_HYPHEN);
  if (/^-|-$/.test(value)) errors.push(SLUG_ERROR.EDGE_HYPHEN);
  // Anything outside a-z / 0-9 / hyphen that isn't already reported by a
  // more specific code above (Hebrew, punctuation, emoji, accented latin…).
  if (/[^a-z0-9-]/.test(value.replace(/\s/g, '').replace(/_/g, '').replace(/[A-Z]/g, ''))) {
    errors.push(SLUG_ERROR.INVALID_CHARACTERS);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Normalize arbitrary input toward a valid slug, automatically fixing
 * everything that CAN be fixed mechanically ("normalize automatically
 * whenever possible", per the sprint):
 *   - lowercases
 *   - strips latin diacritics (é → e) via NFKD decomposition
 *   - converts whitespace and underscores to hyphens
 *   - drops every remaining disallowed character (Hebrew letters have no
 *     mechanical latin transliteration, so they are removed rather than
 *     guessed at)
 *   - collapses consecutive hyphens, trims leading/trailing hyphens
 *
 * The result is either a valid slug or '' (when nothing usable remains,
 * e.g. purely-Hebrew input) — never an invalid non-empty string.
 *
 * @param {string|null|undefined} input
 * @returns {string}
 */
export function normalizeSlug(input) {
  if (typeof input !== 'string') return '';

  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // combining diacritics left by NFKD
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate a slug from a talent's names — the "Generate From Name" action.
 * Prefers the English name (a Hebrew name normalizes to '', since Hebrew
 * characters are not allowed and are never transliterated automatically);
 * falls back to whatever the Hebrew name yields (useful when it actually
 * contains latin characters).
 *
 * @param {{ name?: string|null, nameEn?: string|null }} names
 * @returns {string} a valid slug, or '' when neither name yields one
 */
export function generateSlugFromName({ name, nameEn } = {}) {
  const fromEnglish = normalizeSlug(nameEn);
  if (fromEnglish) return fromEnglish;
  return normalizeSlug(name);
}

const slugLib = { SLUG_PATTERN, SLUG_ERROR, isValidSlug, validateSlug, normalizeSlug, generateSlugFromName };
export default slugLib;
