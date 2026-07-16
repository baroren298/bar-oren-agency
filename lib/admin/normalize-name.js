/*
 * Name normalization — Sprint 7B (Clients & Brands Foundation).
 *
 * Produces the `normalizedName` value that carries Client/Brand duplicate
 * prevention (clients.normalizedName UNIQUE; brands (clientId,
 * normalizedName) UNIQUE — archived rows included, per the confirmed
 * product rule that archived names stay reserved).
 *
 * Deliberately NOT lib/admin/slug.js's normalizeSlug: that helper strips
 * everything outside [a-z0-9-] — a Hebrew name like "לקוח דמו א׳"
 * normalizes to '' there, which would make every Hebrew client collide
 * with every other. This helper only neutralizes the accidental
 * differences a human retyping a name produces:
 *
 *   - leading/trailing whitespace        ("לקוח דמו א׳ " == "לקוח דמו א׳")
 *   - runs of internal whitespace        ("לקוח  דמו" == "לקוח דמו")
 *   - Latin letter case                  ("Nike" == "nike"; Hebrew has no case)
 *   - Unicode representation differences (NFKC — e.g. composed vs
 *     decomposed forms, full-width variants — without discarding letters)
 *
 * It never strips characters: punctuation like ׳ or & is meaningful in a
 * business name and two names differing by it are legitimately different.
 */

/**
 * Normalize a Client/Brand display name for duplicate comparison.
 * Returns '' for non-strings/empty input — callers treat '' as invalid
 * (a name is required before normalization is ever persisted).
 *
 * @param {string} input
 * @returns {string}
 */
export function normalizeName(input) {
  if (typeof input !== 'string') return '';
  return input
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

const normalizeNameLib = { normalizeName };
export default normalizeNameLib;
