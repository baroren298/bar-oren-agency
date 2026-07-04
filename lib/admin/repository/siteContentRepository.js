/*
 * SiteContent repository — skeleton only (Phase 1: Foundations).
 * Planned API per ADMIN_PANEL_PLAN.md Section 3.2. Covers the structured,
 * repeatable parts of data/site.js (nav, categories, homepage/talentPage/
 * contactPage copy blocks). Wired up in the "remaining content types" phase.
 */

import { notImplemented } from './_notImplemented';

export const siteContentRepository = {
  /** Get the currently published value for a section+key pair. (Phase 7) */
  async getPublished(/* section, key */) {
    return notImplemented('siteContentRepository.getPublished');
  },

  /** List all rows for a section, published + any pending proposals. (Phase 7) */
  async listBySection(/* section */) {
    return notImplemented('siteContentRepository.listBySection');
  },

  /** Propose a new value for a section+key pair (Section 6 optimistic locking applies). (Phase 7) */
  async proposeValue(/* section, key, { valueHe, valueEn, basedOnRevisionNumber, createdById } */) {
    return notImplemented('siteContentRepository.proposeValue');
  },

  /** Approve/reject a proposed SiteContent row (Section 4). (Phase 7) */
  async approve(/* siteContentId, { approvedById, ip, userAgent } */) {
    return notImplemented('siteContentRepository.approve');
  },
  async reject(/* siteContentId, { rejectedById, rejectionNote, ip, userAgent } */) {
    return notImplemented('siteContentRepository.reject');
  },
};

export default siteContentRepository;
