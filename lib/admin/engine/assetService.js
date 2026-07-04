/*
 * AssetService — Gallery Upload Sprint 1
 * (GALLERY_UPLOAD_SPRINT_1_ARCHITECTURE.md §1/§4/§8). Orchestrates one
 * upload: validate -> store -> persist -> emit. Deliberately NOT built on
 * the lifecycle engine's adapter pattern (lib/admin/engine/adapters/) —
 * `Asset` has no VersionStatus/approval lifecycle of its own (§10,
 * "lifecycle-neutral"), so this is a small standalone service, following
 * the same route -> service -> repository layering (never importing prisma
 * or the repository's internals from anywhere but here and the repository
 * file itself) without forcing Asset through a contract built for versioned
 * entities.
 *
 * Storage-first / DB-second (§4): the file is durably written before any
 * database row is created. If the DB write then fails, the just-written
 * file is deleted (compensating delete) so a failed upload never leaves an
 * orphaned file with no metadata row pointing at it.
 */

import { getStorageProvider } from '../../storage';
import { generateStorageKey } from '../../storage/utils/keyGen';
import { sniffMimeType } from '../../storage/utils/mimeSniff';
import { getValidationProfile } from '../../storage/utils/validationProfiles';
import { assetRepository } from '../repository/assetRepository';
import { eventService } from './eventService';
import { EVENT_TYPE } from './eventTypes';
import { ENTITY_TYPE } from '../constants/enums';
import { he } from '../i18n/he';

/** Sniffed mime type -> Asset.kind. Sprint 1 only handles images (§ Out of scope: video/document). */
const KIND_BY_MIME_TYPE = Object.freeze({
  'image/jpeg': 'IMAGE',
  'image/png': 'IMAGE',
  'image/webp': 'IMAGE',
});

export const assetService = {
  /**
   * @param {object} params
   * @param {Buffer} params.buffer - raw file bytes, already read from the request
   * @param {string} params.purpose - validation profile key (lib/storage/utils/validationProfiles.js), e.g. "gallery"
   * @param {string} [params.originalFilename] - display/audit only, never used as a storage key
   * @param {string} params.uploadedById - acting user's id
   * @param {string} [params.correlationId]
   * @returns {Promise<object>} the created Asset row
   */
  async uploadAsset({ buffer, purpose, originalFilename = null, uploadedById, correlationId }) {
    if (!buffer || buffer.length === 0) {
      throw new Error(he.gallery.errors.uploadEmptyFile);
    }
    if (!uploadedById) {
      throw new Error('[assetService.uploadAsset] uploadedById is required.');
    }

    // Validation profile lookup also doubles as purpose validation — an
    // unknown purpose throws here (validationProfiles.js), before any
    // storage write is attempted.
    const profile = getValidationProfile(purpose);

    if (buffer.length > profile.maxBytes) {
      throw new Error(he.gallery.errors.uploadFileTooLarge);
    }

    // Never trust the client-supplied Content-Type — sniff actual bytes (§6/§8).
    const mimeType = sniffMimeType(buffer);
    if (!mimeType || !profile.allowedMimeTypes.includes(mimeType)) {
      throw new Error(he.gallery.errors.uploadUnsupportedType);
    }

    const provider = getStorageProvider();
    const key = generateStorageKey({ purpose, mimeType });

    const stored = await provider.put(buffer, { key, mimeType, purpose });

    let asset;
    try {
      asset = await assetRepository.createAsset({
        blobUrl: stored.url,
        provider: provider.name,
        providerKey: stored.key,
        originalFilename,
        mimeType,
        sizeBytes: stored.bytes,
        kind: KIND_BY_MIME_TYPE[mimeType] || 'IMAGE',
        uploadedById,
      });
    } catch (dbError) {
      // Compensating delete (§4) — the DB write failed, so don't leave an
      // orphaned file with no Asset row pointing at it. Best-effort: a
      // failure here is logged, never thrown, so the original dbError is
      // still what the caller sees.
      try {
        await provider.delete(stored.key);
      } catch (cleanupError) {
        console.error(
          `[assetService.uploadAsset] compensating delete failed for key "${stored.key}" ` +
            `after a DB write failure:`,
          cleanupError
        );
      }
      throw dbError;
    }

    await eventService.emit(EVENT_TYPE.ASSET_UPLOADED, {
      entityType: ENTITY_TYPE.IMAGE_ASSET,
      entityId: asset.id,
      actorId: uploadedById,
      correlationId,
      payload: {
        assetId: asset.id,
        provider: asset.provider,
        kind: asset.kind,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
      },
    });

    return asset;
  },
};

export default assetService;
