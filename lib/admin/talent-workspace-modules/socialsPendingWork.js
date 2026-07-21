/*
 * Socials workspace module — Global Reconciliation sprint.
 *
 * Sibling to galleryPendingWork.js — same reasoning applies verbatim: every
 * TalentSocial DRAFT/PROPOSED row is created only by an explicit user
 * action (socialsService.saveDraft), never as an automatic side effect of
 * opening the workspace. There is no "untouched auto-clone" case here, so
 * this module only ever reports existence and never discards anything.
 */

export const socialsPendingWork = {
  name: 'socials',

  /**
   * The shared contract every workspace module implements.
   *
   * @param {object} adapter - talentAdapter (or a fake shaped like it)
   * @param {string} parentId - the talent id
   * @returns {Promise<boolean>}
   */
  async hasEffectivePendingWork(adapter, parentId) {
    const pending = await adapter.getDraftOrProposedSocials(parentId);
    return Array.isArray(pending) && pending.length > 0;
  },
};
