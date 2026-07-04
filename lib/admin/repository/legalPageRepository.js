/*
 * LegalPage repository — skeleton only (Phase 1: Foundations).
 * Planned API per ADMIN_PANEL_PLAN.md Section 3.2 (accessibility
 * statement, privacy policy). `sections` is a JSON blob — the one
 * deliberate exception to normalization in the data model.
 */

import { notImplemented } from './_notImplemented';

export const legalPageRepository = {
  /** Get the currently published version of a legal page by slug. (Phase 7) */
  async getPublished(/* slug */) {
    return notImplemented('legalPageRepository.getPublished');
  },

  /** Propose new section content for a legal page (Section 6 optimistic locking applies). (Phase 7) */
  async proposeSections(/* slug, sections, { basedOnRevisionNumber, createdById } */) {
    return notImplemented('legalPageRepository.proposeSections');
  },

  /** Approve/reject a proposed LegalPage row (Section 4). (Phase 7) */
  async approve(/* legalPageId, { approvedById, ip, userAgent } */) {
    return notImplemented('legalPageRepository.approve');
  },
  async reject(/* legalPageId, { rejectedById, rejectionNote, ip, userAgent } */) {
    return notImplemented('legalPageRepository.reject');
  },
};

export default legalPageRepository;
