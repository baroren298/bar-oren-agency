/*
 * Asset repository — Gallery Upload Sprint 1
 * (GALLERY_UPLOAD_SPRINT_1_ARCHITECTURE.md §3/§4). Renamed from
 * imageAssetRepository.js now that `Asset` is generalized beyond images
 * (kind: IMAGE/DOCUMENT/VIDEO/AUDIO/OTHER) and this sprint gives it its
 * first real implementation. Same rule as every other repository file in
 * this directory: this is the ONLY place permitted to run a Prisma query
 * against `Asset` — lib/admin/engine/assetService.js (the only caller of
 * `createAsset` below) never imports `prisma` directly.
 *
 * `Asset` does not go through the lifecycle engine's adapter pattern
 * (lib/admin/engine/adapters/) — it has no VersionStatus/approval
 * lifecycle of its own (it is deliberately "lifecycle-neutral", per the
 * architecture doc §10), so adapterContract.js's versioned-entity shape
 * does not apply here and would only require no-op methods.
 *
 * getAssetById / archiveAsset remain unimplemented stubs — GET and DELETE
 * routes are explicitly out of scope for this sprint.
 */

import { prisma } from '../db';
import { notImplemented } from './_notImplemented';

export const assetRepository = {
  /**
   * Insert one Asset row for an already-stored file. Storage-first/DB-
   * second (architecture doc §1/§4): by the time this is called, the bytes
   * are already durably written by a StorageProvider — this only persists
   * the metadata row pointing at them.
   *
   * @param {object} fields
   * @param {string} fields.blobUrl - public/loadable URL returned by the StorageProvider
   * @param {string} fields.provider - StorageProvider name (e.g. "local")
   * @param {string} [fields.providerKey] - provider's own management key for the file
   * @param {string} [fields.originalFilename] - display/audit only, never used as a storage key
   * @param {string} [fields.mimeType] - sniffed (not client-reported) mime type
   * @param {number} [fields.sizeBytes]
   * @param {'IMAGE'|'DOCUMENT'|'VIDEO'|'AUDIO'|'OTHER'} [fields.kind]
   * @param {string} fields.uploadedById
   * @returns {Promise<object>} the created Asset row
   */
  async createAsset({
    blobUrl,
    provider,
    providerKey = null,
    originalFilename = null,
    mimeType = null,
    sizeBytes = null,
    kind = 'IMAGE',
    uploadedById,
  }) {
    return prisma.asset.create({
      data: {
        blobUrl,
        provider,
        providerKey,
        originalFilename,
        mimeType,
        sizeBytes,
        kind,
        uploadedById,
      },
    });
  },

  /** Fetch one asset by id. (Out of scope this sprint — no GET route calls this yet.) */
  async getAssetById(/* assetId */) {
    return notImplemented('assetRepository.getAssetById');
  },

  /** Archive (not delete) an asset once superseded/removed. (Out of scope this sprint — no DELETE route calls this yet.) */
  async archiveAsset(/* assetId, { actorId } */) {
    return notImplemented('assetRepository.archiveAsset');
  },
};

export default assetRepository;
