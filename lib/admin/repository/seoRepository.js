/*
 * SEO repository — skeleton only (Phase 1: Foundations).
 * Planned API per ADMIN_PANEL_PLAN.md Section 3.2. One row per
 * page/route's SEO fields, identified by entityType + entityId.
 */

import { notImplemented } from './_notImplemented';

export const seoRepository = {
  /** Get the currently published SEO row for a given entity. (Phase 7) */
  async getPublished(/* entityType, entityId */) {
    return notImplemented('seoRepository.getPublished');
  },

  /** Propose changes to a page's SEO fields (Section 6 optimistic locking applies). (Phase 7) */
  async proposeSeo(/* entityType, entityId, fields, { basedOnRevisionNumber, createdById } */) {
    return notImplemented('seoRepository.proposeSeo');
  },

  /** Approve/reject a proposed SEO row (Section 4). (Phase 7) */
  async approve(/* seoId, { approvedById, ip, userAgent } */) {
    return notImplemented('seoRepository.approve');
  },
  async reject(/* seoId, { rejectedById, rejectionNote, ip, userAgent } */) {
    return notImplemented('seoRepository.reject');
  },
};

export default seoRepository;
