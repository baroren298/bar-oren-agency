/*
 * Talent Published Sort Order sprint — the pure ordering primitive behind
 * publish-time automatic reordering.
 *
 * PRODUCT MODEL. `sortOrder` is not a free-form number an editor happens to
 * type into a box; it is a Talent's *position* in the ordered published
 * roster. "Put this talent at 7" must mean "make it the 7th published
 * talent", with everyone at 7 and after shifting to make room — never "two
 * talents now both claim 7", which is what the pre-sprint behavior produced
 * (see this sprint's investigation: `sortOrder` had no constraint, no
 * validation and was never read by the publish transaction, so the public
 * list's `[...talents].sort((a, b) => a.sortOrder - b.sortOrder)` broke ties
 * by raw Postgres row order — nondeterministically).
 *
 * WHY A SEPARATE, DB-FREE MODULE. Everything here is arithmetic over plain
 * objects: no Prisma import, no async, no I/O. That keeps the entire
 * ordering contract unit-testable without a database (see
 * published-order.test.js), and leaves talentRepository.publishTalentVersion
 * responsible only for reading the current published list, calling these
 * functions, and writing the resulting diff inside its existing
 * transaction. Same "pure helper + sibling .test.js" shape as lib/admin/
 * slug.js, gallery-images.js and social-review.js already use.
 *
 * ONE-BASED BY DECISION. Position 1 is the first published talent, 2 the
 * second, and so on — human positions, per the approved product decision.
 * The seeded production data is 0-based (data/talent/index.js runs 0..9),
 * so the two do not agree yet; `isCanonicalPublishedOrder` below is exactly
 * the gate that keeps this module from silently renumbering that data
 * during an ordinary publish. The one-off normalization that makes the
 * production list canonical is a separate, explicitly-approved step.
 */

/**
 * The first position in the canonical published ordering. 1 = the first
 * published talent (approved product decision), not 0.
 */
export const PUBLISHED_ORDER_BASE = 1;

/**
 * Why a publish landed on the position it did. Returned by
 * `resolvePublishPosition` so callers (and tests, and any future admin UI)
 * can tell an explicit user-requested move apart from the two implicit
 * cases, rather than inferring intent from the number alone.
 */
export const POSITION_REASON = {
  /** The version carries no `sortOrder` — append to the end of the list. */
  APPEND_UNSET: 'APPEND_UNSET',
  /**
   * The version's `sortOrder` is unchanged from the version this draft was
   * based on, i.e. the editor never touched the position field. The talent
   * keeps its CURRENT effective position, which may differ from the number
   * stored on the draft — see the anti-drift note on
   * `resolvePublishPosition`.
   */
  UNCHANGED: 'UNCHANGED',
  /** The editor asked for a specific position. */
  EXPLICIT: 'EXPLICIT',
};

/**
 * Is this list already in the canonical published ordering — exactly the
 * integers PUBLISHED_ORDER_BASE..(BASE + n - 1), each used once, no nulls?
 *
 * This is the sprint's central safety gate, and the reason it exists is a
 * deliberate product constraint rather than a technical one: the publish
 * transaction must NEVER quietly rewrite the whole roster's numbering as a
 * side effect of publishing one talent. Today's production data is 0-based
 * and may hold duplicates/nulls/gaps, so `computePublishedOrder`'s output
 * (which always renumbers to a contiguous 1..N) would touch every row on
 * the very first publish after this ships. Gating on this predicate means:
 *
 *   - list already canonical -> reorder runs, and because the input is
 *     contiguous the resulting diff is only the affected band;
 *   - list not yet canonical -> the caller skips reordering entirely and
 *     publishes exactly as it did before this sprint. Nothing is renumbered
 *     behind the operator's back.
 *
 * An empty list is vacuously canonical: publishing the very first talent
 * into an empty roster correctly lands it at position 1.
 *
 * @param {Array<{ sortOrder: number|null }>} entries
 * @returns {boolean}
 */
export function isCanonicalPublishedOrder(entries) {
  if (!Array.isArray(entries)) return false;

  const max = PUBLISHED_ORDER_BASE + entries.length - 1;
  const seen = new Set();

  for (const entry of entries) {
    const value = entry ? entry.sortOrder : null;
    if (!Number.isInteger(value)) return false;
    if (value < PUBLISHED_ORDER_BASE || value > max) return false;
    if (seen.has(value)) return false;
    seen.add(value);
  }

  return true;
}

/**
 * Decide which position a version being published should actually land on.
 *
 * Three cases, in priority order:
 *
 * 1. NO POSITION REQUESTED (`requestedSortOrder == null`, or a value that
 *    isn't a finite number). Approved null semantics: null means "place at
 *    the end of the published list". This covers both a brand-new talent
 *    published without ever touching the field (every talent created via
 *    POST /api/admin/talent starts with `sortOrder: null`) and an existing
 *    published talent whose draft deliberately clears the field — the
 *    latter moves to the end, as decided.
 *
 * 2. UNCHANGED FROM THE DRAFT'S BASE — the anti-drift rule, and the reason
 *    `basedOnSortOrder` is a parameter at all. A draft is seeded from the
 *    live published version (POST /proposals passes
 *    `basedOnVersionId: publishedVersion.id`, and extractTalentVersionFields
 *    copies `sortOrder` across), so a draft that never edited the position
 *    still *carries* a number. If somebody else publishes in the meantime
 *    and shifts this talent 7 -> 8, publishing that untouched draft must
 *    not drag it back to 7. So: when the requested value equals the value
 *    the draft was based on, the talent keeps its CURRENT position and no
 *    other talent moves. This is also what makes "publish ordinary Details
 *    edits" a genuine no-op for the roster.
 *
 * 3. EXPLICIT MOVE — the editor typed a position. Clamped into
 *    [BASE, targetLength] rather than rejected: "0" and "999" are
 *    unambiguous intent (first / last), and publish is the worst possible
 *    place to hard-fail on a cosmetic field. `clamped` is reported back so
 *    a caller can surface what actually happened.
 *
 * @param {object} params
 * @param {number|null} params.requestedSortOrder - `sortOrder` on the
 *   version being published.
 * @param {number|null} params.currentPosition - the talent's current
 *   published position; null when this is a first publish.
 * @param {number|null} params.basedOnSortOrder - `sortOrder` on the version
 *   this one was based on; null when there is none.
 * @param {number} params.targetLength - how many talents the published list
 *   will hold AFTER this publish (N for a re-publish, N + 1 for a first
 *   publish).
 * @returns {{ position: number, reason: string, clamped: boolean }}
 */
export function resolvePublishPosition({
  requestedSortOrder,
  currentPosition,
  basedOnSortOrder,
  targetLength,
} = {}) {
  const lastPosition = Math.max(PUBLISHED_ORDER_BASE, targetLength);

  // Case 1 — no usable position requested. `Number.isFinite` (not a plain
  // null check) also absorbs a NaN, which is what `Number(...)` in the
  // admin's number input produces for unparseable text.
  if (requestedSortOrder == null || !Number.isFinite(requestedSortOrder)) {
    return { position: lastPosition, reason: POSITION_REASON.APPEND_UNSET, clamped: false };
  }

  // Case 2 — untouched position on an already-published talent.
  if (
    currentPosition != null &&
    basedOnSortOrder != null &&
    requestedSortOrder === basedOnSortOrder
  ) {
    return { position: currentPosition, reason: POSITION_REASON.UNCHANGED, clamped: false };
  }

  // Case 3 — explicit move, clamped into range.
  const requested = Math.trunc(requestedSortOrder);
  const position = Math.min(Math.max(requested, PUBLISHED_ORDER_BASE), lastPosition);

  return { position, reason: POSITION_REASON.EXPLICIT, clamped: position !== requested };
}

/**
 * Compute the published roster after inserting/moving one talent to
 * `position`, and the minimal set of rows whose stored `sortOrder` has to
 * change to get there.
 *
 * The whole algorithm is one splice: drop the moving talent out of the
 * list, re-insert it at the requested index, then renumber contiguously
 * from PUBLISHED_ORDER_BASE. That single operation covers every case the
 * product spec calls out — insert into the middle, insert at the front,
 * append, move up (12 -> 7), move down (7 -> 12), and republish at the same
 * position — with no `+1` / `-1` branch logic to get backwards, no gap left
 * behind by a downward move, and no possibility of two talents sharing a
 * position in the output.
 *
 * Because the caller only ever runs this on an already-canonical list (see
 * `isCanonicalPublishedOrder`), renumbering is cheap in practice: rows
 * outside the band between the old and new position keep the value they
 * already had and are therefore absent from `changes`.
 *
 * The moving talent is ALWAYS present in `changes`, even when its position
 * is unchanged. That is deliberate, not an oversight: the row being written
 * is the newly-published version, a different row from the one that held
 * the talent's position a moment ago, and the number copied onto it from
 * the draft may be stale (the anti-drift case above). It must be stamped
 * with the authoritative position.
 *
 * @param {object} params
 * @param {Array<{ talentId: string, versionId: string, sortOrder: number }>} params.currentOrder
 *   the current published list, INCLUDING the moving talent's existing row
 *   when it already has one.
 * @param {string} params.movingTalentId
 * @param {string} params.movingVersionId - the version being published (the
 *   row that must receive the moving talent's position).
 * @param {number} params.position - 1-based target position, already
 *   resolved by `resolvePublishPosition`.
 * @returns {{ order: Array<{talentId: string, versionId: string, sortOrder: number}>,
 *             changes: Array<{talentId: string, versionId: string, sortOrder: number}> }}
 */
/**
 * Compute the published roster after ARCHIVING one talent — removing it
 * from the ordering scope entirely and closing the vacated position.
 *
 * Same contract as `computePublishedOrder` (renumber contiguously from
 * PUBLISHED_ORDER_BASE, return only the rows whose value actually
 * changed) with no insertion step — the moving talent is simply dropped.
 * Kept as a separate function rather than a special case of
 * `computePublishedOrder` because "insert at a position" and "remove"
 * have different call shapes (no `position`/`movingVersionId` here), but
 * it is deliberately the same renumber-and-diff shape so archive and
 * publish/restore share one ordering contract rather than two.
 *
 * @param {object} params
 * @param {Array<{ talentId: string, versionId: string, sortOrder: number }>} params.currentOrder
 *   the current published list, INCLUDING the talent being archived.
 * @param {string} params.removingTalentId
 * @returns {{ order: Array<{talentId: string, versionId: string, sortOrder: number}>,
 *             changes: Array<{talentId: string, versionId: string, sortOrder: number}> }}
 */
export function computeOrderAfterRemoval({ currentOrder, removingTalentId } = {}) {
  const entries = Array.isArray(currentOrder) ? currentOrder : [];

  const remaining = entries
    .filter((entry) => entry.talentId !== removingTalentId)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const order = remaining.map((entry, i) => ({
    talentId: entry.talentId,
    versionId: entry.versionId,
    sortOrder: PUBLISHED_ORDER_BASE + i,
  }));

  const previousByTalentId = new Map(entries.map((entry) => [entry.talentId, entry.sortOrder]));

  const changes = order.filter((entry) => previousByTalentId.get(entry.talentId) !== entry.sortOrder);

  return { order, changes };
}

export function computePublishedOrder({
  currentOrder,
  movingTalentId,
  movingVersionId,
  position,
} = {}) {
  const entries = Array.isArray(currentOrder) ? currentOrder : [];

  const others = entries
    .filter((entry) => entry.talentId !== movingTalentId)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Clamp the index rather than trusting `position` blindly — this function
  // is also the last line of defense if a caller ever computes a position
  // against a stale length.
  const index = Math.min(Math.max(position - PUBLISHED_ORDER_BASE, 0), others.length);

  const spliced = [
    ...others.slice(0, index),
    { talentId: movingTalentId, versionId: movingVersionId },
    ...others.slice(index),
  ];

  const order = spliced.map((entry, i) => ({
    talentId: entry.talentId,
    versionId: entry.versionId,
    sortOrder: PUBLISHED_ORDER_BASE + i,
  }));

  const previousByTalentId = new Map(entries.map((entry) => [entry.talentId, entry.sortOrder]));

  const changes = order.filter(
    (entry) =>
      entry.talentId === movingTalentId ||
      previousByTalentId.get(entry.talentId) !== entry.sortOrder
  );

  return { order, changes };
}
