/*
 * Generic Entity/EntityVersion repository — skeleton only (Phase 1:
 * Foundations). Per ADMIN_PANEL_PLAN.md Section 3.1/3.3, this generic
 * path is reserved for content that doesn't warrant a dedicated table:
 * the collaborations list and agency-level social links. Do not extend
 * this repository to cover content types that would benefit from real
 * columns — add a dedicated repository/table instead (see talentRepository
 * for the normalized pattern).
 */

import { notImplemented } from './_notImplemented';

export const entityRepository = {
  /** Get or create the Entity row for a given entityType (+ optional entityId). (Phase 7) */
  async getOrCreateEntity(/* entityType, entityId */) {
    return notImplemented('entityRepository.getOrCreateEntity');
  },

  /** Get the currently published EntityVersion's content for an entity. (Phase 7) */
  async getPublishedContent(/* entityType, entityId */) {
    return notImplemented('entityRepository.getPublishedContent');
  },

  /** Propose new content for an entity (Section 6 optimistic locking applies). (Phase 7) */
  async proposeContent(/* entityType, entityId, content, { basedOnRevisionNumber, createdById } */) {
    return notImplemented('entityRepository.proposeContent');
  },

  /** Approve/reject a proposed EntityVersion (Section 4). (Phase 7) */
  async approve(/* entityVersionId, { approvedById, ip, userAgent } */) {
    return notImplemented('entityRepository.approve');
  },
  async reject(/* entityVersionId, { rejectedById, rejectionNote, ip, userAgent } */) {
    return notImplemented('entityRepository.reject');
  },
};

export default entityRepository;
