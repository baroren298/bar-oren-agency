"use client";

/*
 * PodcastTab — Podcast tab sprint, extended by the "Enable Podcast Save"
 * sprint.
 *
 * Dedicated "פודקאסט" tab (sibling of Details/Gallery/Socials/SEO/History)
 * for the TalentVersion podcast* fields — the single place podcast data is
 * shown or edited (Podcast Panel Removal cleanup sprint removed the
 * standalone read-only preview that used to sit above the tabs).
 *
 * Enable Podcast Save sprint — this component no longer owns its own
 * inputs/local state for podcastTitle/podcastDescriptionHe/
 * podcastDescriptionEn/podcastVideoEmbedUrl. Those four fields are now
 * rendered and saved by <TalentDetailsEditor> + <ComparisonView> — the
 * exact same Save Draft / Submit machinery the פרטים tab already uses
 * (same PATCH .../proposals/[versionId] route, same talentRepository.
 * updateTalentVersionFields allowlist, now extended to include these four
 * columns — see that file's WRITABLE_COLUMNS). No new save mechanism, no
 * new API route, per this sprint's explicit instruction to reuse the
 * existing one. `versionId`/`versionStatus` are null whenever there's no
 * editable DRAFT/PROPOSED version, in which case <TalentDetailsEditor>
 * itself disables Save Draft/Submit — the same "nothing to act on yet"
 * state the פרטים tab already shows; `copy.noEditableVersionHint` below
 * just explains *why* in this tab's own context.
 *
 * Podcast Image Upload sprint — "החלף תמונה" is now a real upload flow:
 * a hidden file input + the existing useImageAssetUpload hook (purpose
 * "podcast", validated by lib/storage/utils/validationProfiles.js), then
 * an explicit PATCH of { podcastImageAssetId } onto the current editable
 * DRAFT/PROPOSED version via the same proposals/[versionId] route every
 * other editor uses (flow logic in lib/admin/podcast-image.js, extracted
 * for testability). The action is available only when an editable
 * versionId exists AND uploadsEnabled (server-computed environment gate)
 * is true; nothing here runs on render — no draft is created by opening
 * this tab, and there is no auto-save beyond this one explicit action.
 * After a successful upload+save the preview swaps to the new image
 * immediately; on refresh the pending draft's stored image (via
 * podcastImageAsset on the pending version) keeps showing. Publishing is
 * never triggered from here — the new image goes live only through the
 * existing Submit/Approve/Publish lifecycle.
 *
 * Still unchanged from previous sprints:
 *  - The YouTube link and the *fallback* image preview reflect the
 *    published version's current values — editing the video URL happens
 *    via the proposed-column input in the editor below, not by typing
 *    into this link/preview area.
 *
 * Podcast tab UX polish sprint — when `hasPodcastData` is false (published
 * version has no podcast fields set at all), the placeholder-filled
 * preview column (empty image frame, disabled button, "no link" span) is
 * no longer rendered — it added noise for the common case of a talent
 * with no podcast yet. A clean <EmptyState> card is shown instead. The
 * editor below is unaffected either way: it's still always rendered, with
 * the same disabled-when-no-draft behavior as before, so editing is
 * unchanged from prior sprints.
 *
 * Talent Detail UX Refactor, Phase 2 — the image/video preview used to be
 * its own full-height column standing beside the editor (two visual blocks
 * side by side, the same "heavy" pattern Phase 1 removed from ComparisonView
 * itself). It is now a single compact row (small thumbnail + actions) above
 * the editor, so the tab reads as one section: a light read-only accessory
 * followed directly by the one editing surface, instead of two competing
 * columns. Purely a layout change — `hasPodcastData`/`podcastImageUrl`/
 * `podcastVideoEmbedUrl` still drive exactly the same conditions as before,
 * and the editor itself (<TalentDetailsEditor>/<ComparisonView>) is
 * untouched.
 *
 * Props:
 *   talentId              — string
 *   versionId             — string | null, the editable DRAFT/PROPOSED
 *                           version's id, or null if none (same contract
 *                           as <TalentDetailsEditor>)
 *   versionStatus         — "DRAFT" | "PROPOSED" | null
 *   groups                — ComparisonView's `groups` prop (buildPodcastGroups)
 *   podcastImageUrl        — published ImageAsset.blobUrl, or null
 *   pendingPodcastImageUrl — pending DRAFT/PROPOSED version's own
 *                           podcastImageAsset.blobUrl, or null (Podcast
 *                           Image Upload sprint — what keeps a saved
 *                           replacement visible after a refresh)
 *   podcastVideoEmbedUrl  — string | null (published value, for the
 *                           read-only "צפייה ביוטיוב" link)
 *   hasPodcastData        — boolean — whether the published version has any
 *                           podcast field set at all (drives the empty state)
 *   displayName           — talent's display name, for image alt text
 *   uploadsEnabled        — server-computed environment gate (Podcast Image
 *                           Upload sprint); false disables only the upload
 *                           control, with an explanatory hint
 */

import { useRef, useState } from "react";
import styles from "./PodcastTab.module.css";
import EmptyState from "./EmptyState";
import PrimaryButton from "./PrimaryButton";
import TalentDetailsEditor from "./TalentDetailsEditor";
import { he } from "@/lib/admin/i18n/he";
import { toYouTubeWatchUrl } from "@/lib/youtube";
import { useImageAssetUpload } from "@/lib/admin/hooks/useImageAssetUpload";
import {
  canReplacePodcastImage,
  selectPodcastPreviewUrl,
  replacePodcastImage,
} from "@/lib/admin/podcast-image";
import { getValidationProfile } from "@/lib/storage/utils/validationProfiles";

// Static mirror of the server's podcast validation profile, purely for the
// file picker's `accept` filter — the hook re-validates on pick and the
// upload route re-validates authoritatively on the server.
const PODCAST_ACCEPT = getValidationProfile("podcast").allowedMimeTypes.join(",");

export default function PodcastTab({
  talentId,
  versionId,
  versionStatus = null,
  groups,
  podcastImageUrl,
  pendingPodcastImageUrl = null,
  podcastVideoEmbedUrl,
  hasPodcastData,
  displayName,
  role = null,
  uploadsEnabled = true,
}) {
  const copy = he.talent.detail.podcastTab;

  // The stored value is a YouTube *embed* URL (what the public iframe
  // needs). Opening an embed URL as a top-level page triggers YouTube
  // Error 153, so the admin button gets a derived /watch URL instead. The
  // stored value itself is never touched.
  const youtubeWatchUrl = toYouTubeWatchUrl(podcastVideoEmbedUrl);

  // Podcast Image Upload sprint — the replace-image flow's state. All of
  // it is inert until the user explicitly picks a file: nothing below
  // fires a network call on render, and no draft is ever created here
  // (replacePodcastImage only PATCHes an already-existing versionId).
  const fileInputRef = useRef(null);
  const { status: uploadStatus, error: uploadError, upload } = useImageAssetUpload(
    "podcast",
    he.media.errors
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedNow, setSavedNow] = useState(false);
  // blobUrl of an asset uploaded AND saved to the draft this session —
  // set only after the PATCH succeeds, so a failed flow never swaps the
  // preview away from the current image.
  const [localPreviewUrl, setLocalPreviewUrl] = useState(null);

  const busy = uploadStatus === "uploading" || saving;
  const canReplace = canReplacePodcastImage({ versionId, uploadsEnabled, busy });

  const previewUrl = selectPodcastPreviewUrl({
    localPreviewUrl,
    pendingImageUrl: pendingPodcastImageUrl,
    publishedImageUrl: podcastImageUrl,
  });
  const showingPendingImage = previewUrl !== null && previewUrl !== podcastImageUrl;

  function handleReplaceClick() {
    if (!canReplace) return;
    fileInputRef.current?.click();
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0] ?? null;
    // Reset so picking the same file again re-triggers change.
    event.target.value = "";
    if (!file || !canReplace) return;

    setSaveError(null);
    setSavedNow(false);
    setSaving(true);
    try {
      const result = await replacePodcastImage({
        talentId,
        versionId,
        uploadsEnabled,
        file,
        upload,
        copy: {
          saveError: he.editor.saveDraft.error,
          networkError: he.media.errors.networkError,
        },
      });

      if (result.ok) {
        // Swap the preview immediately; the published image stays stored
        // untouched (fallback until this draft is approved and published).
        if (result.asset.blobUrl) {
          setLocalPreviewUrl(result.asset.blobUrl);
        }
        setSavedNow(true);
      } else if (result.reason === "save") {
        setSaveError(result.error);
      }
      // reason === "upload": the hook's own `uploadError` already carries
      // the user-facing message; reason === "unavailable": nothing to show.
    } finally {
      setSaving(false);
    }
  }

  const replaceDisabledHint = !uploadsEnabled
    ? he.media.uploadsDisabledHint
    : !versionId
      ? copy.replaceImageNoVersionHint
      : null;

  const replaceStatusMessage = busy
    ? copy.uploading
    : uploadError || saveError
      ? uploadError || saveError
      : savedNow
        ? copy.uploadSaved
        : null;
  const replaceStatusIsError = !busy && Boolean(uploadError || saveError);

  const editorColumn = (
    <div className={styles.editorColumn}>
      <TalentDetailsEditor
        talentId={talentId}
        versionId={versionId}
        versionStatus={versionStatus}
        groups={groups}
        role={role}
      />
    </div>
  );

  if (!hasPodcastData) {
    return (
      <div className={styles.tab}>
        <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />

        {!versionId ? <p className={styles.noEditableVersionHint}>{copy.noEditableVersionHint}</p> : null}

        <div className={styles.body}>{editorColumn}</div>
      </div>
    );
  }

  return (
    <div className={styles.tab}>
      {!versionId ? <p className={styles.noEditableVersionHint}>{copy.noEditableVersionHint}</p> : null}

      <div className={styles.body}>
        <div className={styles.previewRow}>
          <span className={styles.previewLabel}>{copy.imageLabel}</span>
          <div className={styles.previewRowContent}>
            <div className={styles.frame}>
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={copy.imageAlt(displayName)}
                  className={styles.image}
                />
              ) : (
                <div className={styles.placeholder} aria-hidden="true">
                  {copy.noImage}
                </div>
              )}
            </div>

            <div className={styles.previewActions}>
              {/*
                Podcast Image Upload sprint — real file picker. The input is
                hidden (the visible control keeps the exact "החלף תמונה"
                button this card always had); it never renders as part of a
                form and only does anything after an explicit click+pick.
              */}
              <input
                ref={fileInputRef}
                type="file"
                accept={PODCAST_ACCEPT}
                onChange={handleFileChange}
                className={styles.hiddenFileInput}
                aria-hidden="true"
                tabIndex={-1}
              />
              <button
                type="button"
                className={styles.imageButton}
                onClick={handleReplaceClick}
                disabled={!canReplace}
              >
                {copy.replaceImage}
              </button>

              {replaceDisabledHint ? <p className={styles.hint}>{replaceDisabledHint}</p> : null}

              {replaceStatusMessage ? (
                <p
                  className={replaceStatusIsError ? styles.uploadStatusError : styles.uploadStatus}
                  role={replaceStatusIsError ? "alert" : "status"}
                >
                  {replaceStatusMessage}
                </p>
              ) : null}

              {showingPendingImage ? <p className={styles.hint}>{copy.pendingImageHint}</p> : null}

              {youtubeWatchUrl ? (
                <PrimaryButton
                  href={youtubeWatchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.youtubeButton}
                >
                  {copy.viewOnYoutube}
                </PrimaryButton>
              ) : (
                <span className={styles.noVideoLink}>{copy.noVideoLink}</span>
              )}
            </div>
          </div>
        </div>

        {editorColumn}
      </div>
    </div>
  );
}
