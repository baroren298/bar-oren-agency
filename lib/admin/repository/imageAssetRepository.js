/*
 * ImageAsset repository — skeleton only (Phase 1: Foundations).
 * Planned API per ADMIN_PANEL_PLAN.md Sections 3.2 and 10. Real upload
 * (blob storage) and DB wiring land in the Image upload/versioning phase.
 */

import { notImplemented } from './_notImplemented';

export const imageAssetRepository = {
  /** Upload a file to blob storage and create its ImageAsset row. (Phase 6) */
  async uploadImage(/* file, { uploadedById } */) {
    return notImplemented('imageAssetRepository.uploadImage');
  },

  /** Fetch one image asset by id. (Phase 6) */
  async getImageAssetById(/* imageAssetId */) {
    return notImplemented('imageAssetRepository.getImageAssetById');
  },

  /** Archive (not delete) an image asset once superseded/removed (Section 5). (Phase 6) */
  async archiveImageAsset(/* imageAssetId, { actorId } */) {
    return notImplemented('imageAssetRepository.archiveImageAsset');
  },
};

export default imageAssetRepository;
