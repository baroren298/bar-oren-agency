/*
 * Gallery workspace module — Global Reconciliation sprint.
 *
 * Every TalentGalleryImage DRAFT/PROPOSED row is created only by an
 * explicit user action (uploading or editing an image via
 * galleryService.saveDraft — never as an automatic side effect of opening
 * the workspace, unlike TalentVersion's "Start Editing" anchor). There is
 * no "untouched auto-clone" case here: any pending Gallery row that exists
 * is real work, so this module only ever needs to answer "is there one,"
 * and — unlike talentVersionPendingWork — never discards anything.
 */

export const galleryPendingWork = {
  name: 'gallery',

  /**
   * The shared contract every workspace module implements.
   *
   * @param {object} adapter - talentAdapter (or a fake shaped like it)
   * @param {string} parentId - the talent id
   * @returns {Promise<boolean>}
   */
  async hasEffectivePendingWork(adapter, parentId) {
    const pending = await adapter.getDraftOrProposedGalleryImages(parentId);
    return Array.isArray(pending) && pending.length > 0;
  },
};
