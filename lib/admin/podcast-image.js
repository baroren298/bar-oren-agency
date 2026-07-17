/*
 * Podcast Image Upload sprint — the client-side decision/flow logic behind
 * PodcastTab.jsx's "החלף תמונה" control, extracted into a plain module so
 * it is unit-testable with the repo's existing no-DOM vitest harness
 * (components/admin/__tests__/* renders with react-dom/server, which can't
 * simulate clicks — pure functions can be exercised directly instead).
 *
 * Deliberately owns NO React state and NO UI: PodcastTab supplies the
 * upload function (from the existing useImageAssetUpload hook, purpose
 * "podcast") and reads back a plain result object to decide what to render.
 *
 * The PATCH here is the exact same explicit-user-action save path every
 * other editor uses (app/api/admin/talent/[id]/proposals/[versionId] →
 * proposalService.update → talentRepository.updateTalentVersionFields'
 * allowlist) — updating one field ({ podcastImageAssetId }) on an
 * already-existing DRAFT/PROPOSED version. It never creates a version, so
 * no draft can come into existence through this module; if there is no
 * editable versionId the flow refuses before any network call.
 */

/**
 * Whether the "החלף תמונה" action is currently available.
 *
 * @param {object} params
 * @param {string|null} params.versionId - the editable DRAFT/PROPOSED
 *   version's id, or null when none exists
 * @param {boolean} params.uploadsEnabled - server-computed environment gate
 *   (lib/storage/availability.js via the page)
 * @param {boolean} [params.busy] - an upload/save is already in flight
 * @returns {boolean}
 */
export function canReplacePodcastImage({ versionId, uploadsEnabled, busy = false }) {
  return Boolean(versionId) && uploadsEnabled === true && !busy;
}

/**
 * Which URL the Podcast tab's preview frame should show. Precedence:
 * an image uploaded+saved in this session, else the pending draft's stored
 * image (survives refresh via the version's podcastImageAsset relation),
 * else the currently published image — which therefore remains the
 * fallback until a replacement actually exists.
 *
 * @param {object} params
 * @param {string|null} [params.localPreviewUrl] - blobUrl of an asset
 *   uploaded and PATCHed onto the draft during this session
 * @param {string|null} [params.pendingImageUrl] - pending version's stored
 *   podcastImageAsset.blobUrl
 * @param {string|null} [params.publishedImageUrl] - published version's
 *   podcastImageAsset.blobUrl
 * @returns {string|null}
 */
export function selectPodcastPreviewUrl({
  localPreviewUrl = null,
  pendingImageUrl = null,
  publishedImageUrl = null,
} = {}) {
  return localPreviewUrl || pendingImageUrl || publishedImageUrl || null;
}

/**
 * The full explicit replace action: upload the picked file (validated
 * client-side by useImageAssetUpload against the "podcast" profile, and
 * again server-side by the shared upload route), then PATCH the current
 * editable version with `{ fields: { podcastImageAssetId: asset.id } }`.
 *
 * Never throws. Result shapes:
 *   { ok: true,  asset }                    - uploaded AND saved to the draft
 *   { ok: false, reason: 'unavailable' }    - guard refused (no versionId /
 *                                             uploads disabled) — no network
 *   { ok: false, reason: 'upload' }         - upload failed; the hook that
 *                                             supplied `upload` already holds
 *                                             the user-facing error
 *   { ok: false, reason: 'save', error }    - upload succeeded but the PATCH
 *                                             didn't; `error` is a
 *                                             user-facing (Hebrew) message,
 *                                             never a raw technical one
 *
 * On any failure the caller keeps showing whatever image it showed before —
 * the published (or previously saved pending) image is untouched.
 *
 * @param {object} params
 * @param {string} params.talentId
 * @param {string|null} params.versionId
 * @param {boolean} params.uploadsEnabled
 * @param {File} params.file
 * @param {(file: File) => Promise<{ asset } | null>} params.upload -
 *   useImageAssetUpload's upload function (purpose "podcast")
 * @param {{ saveError: string, networkError: string }} params.copy
 * @param {typeof fetch} [params.fetchImpl] - injectable for tests only
 * @returns {Promise<object>} one of the result shapes above
 */
export async function replacePodcastImage({
  talentId,
  versionId,
  uploadsEnabled,
  file,
  upload,
  copy,
  fetchImpl = typeof fetch === 'function' ? fetch : undefined,
}) {
  if (!canReplacePodcastImage({ versionId, uploadsEnabled }) || !file) {
    return { ok: false, reason: 'unavailable' };
  }

  const uploaded = await upload(file);
  const asset = uploaded?.asset;
  if (!asset?.id) {
    return { ok: false, reason: 'upload' };
  }

  try {
    const response = await fetchImpl(`/api/admin/talent/${talentId}/proposals/${versionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { podcastImageAssetId: asset.id } }),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      // body.error is already the API's user-facing Hebrew message; fall
      // back to the caller-supplied generic copy, never a raw error string.
      return { ok: false, reason: 'save', error: body?.error || copy.saveError };
    }

    return { ok: true, asset };
  } catch {
    return { ok: false, reason: 'save', error: copy.networkError };
  }
}

export default { canReplacePodcastImage, selectPodcastPreviewUrl, replacePodcastImage };
