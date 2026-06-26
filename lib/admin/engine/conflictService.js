/*
 * ConflictService — Sprint 3.3 (ADMIN_PANEL_PLAN.md Section 13.8,
 * formalizing Section 6's optimistic-locking design at the engine layer).
 *
 * `checkRevision(adapter, { parentId, basedOnRevisionNumber })` is a pure
 * revision comparison: it reads the parent's live `revisionNumber` via the
 * adapter (no entity-specific code here — Section 13.9) and compares it to
 * the value the caller started from. It never mutates anything, so it is
 * safe to call non-blockingly at proposal-creation time (this sprint,
 * `proposalService.create()`) and, later, authoritatively inside
 * `publishService.publish()`'s own transaction (Section 13.8 — that
 * second call site is not built in this sprint).
 */

export const conflictService = {
  /**
   * @param {object} adapter - Section 13.10 contract (only `getParent` is used)
   * @param {object} params
   * @param {string} params.parentId
   * @param {number} [params.basedOnRevisionNumber]
   * @returns {Promise<{ conflict: boolean, currentRevisionNumber: number|null, basedOnRevisionNumber?: number }>}
   */
  async checkRevision(adapter, { parentId, basedOnRevisionNumber }) {
    if (!parentId) {
      throw new Error('[conflictService.checkRevision] parentId is required.');
    }

    const parent = await adapter.getParent(parentId);
    if (!parent) {
      // No existing parent to conflict with (e.g. proposing a brand-new
      // entity with no published counterpart yet) — nothing to compare.
      return { conflict: false, currentRevisionNumber: null };
    }

    const currentRevisionNumber =
      typeof parent.revisionNumber === 'number' ? parent.revisionNumber : null;

    if (basedOnRevisionNumber == null || currentRevisionNumber == null) {
      // Caller didn't supply a base, or the adapter's parent shape has no
      // revisionNumber — nothing to compare against. Treat as no conflict
      // rather than guessing (the authoritative, blocking check inside
      // publishService is the one that must never skip this for a real
      // reason; this early check is a UX convenience only, Section 13.8).
      return { conflict: false, currentRevisionNumber };
    }

    return {
      conflict: basedOnRevisionNumber !== currentRevisionNumber,
      currentRevisionNumber,
      basedOnRevisionNumber,
    };
  },
};

export default conflictService;
