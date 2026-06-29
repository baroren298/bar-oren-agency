"use client";

/*
 * ProfileImagePanel — Profile Image section sprint, made interactive by the
 * Profile Image Replace sprint.
 *
 * Shape/framing are unchanged from the original read-only version: a
 * rectangular, aspect-ratio 3 / 4 preview matching the public site's
 * primary portrait ratio, in its own titled section ("תמונת פרופיל").
 *
 * What changed in this sprint, and nothing else: the preview frame itself
 * is now a real click-or-drag-and-drop upload target — same interaction
 * shape as Gallery's AddImageCard (click opens a file picker, dropping a
 * file onto the frame works too), but laid directly over the existing
 * photo instead of a separate "add new card", since this section always
 * has exactly one image rather than a grid. Per the approved sprint scope:
 *
 *  - Uploading reuses the exact same /api/admin/assets/upload route Gallery
 *    already uses, just with purpose="profile" (a validation profile that
 *    already existed for NewTalentForm.jsx's Create Talent photo) — no new
 *    route, no new storage code.
 *  - The new photo shows immediately (an optimistic local object URL while
 *    the upload is in flight, swapped for the real asset.blobUrl once it
 *    completes) but is not persisted to the TalentVersion row until the
 *    employee clicks "שמור כטיוטה" — same "upload now, attach on Save
 *    Draft" split MediaGalleryEditor's uploadQueueItem already uses.
 *  - Save Draft / Submit reuse the exact same proposals PATCH/submit
 *    routes and EditorActionBar component TalentDetailsEditor already
 *    uses for the פרטים tab — no new approval logic, no new repository.
 *  - profileImageAssetId is already in talentRepository.js's
 *    updateTalentVersionFields WRITABLE_COLUMNS allowlist (added for
 *    Create Talent), so no schema/repository change was needed here.
 *  - Crop/Position and Zoom/Scale remain explicitly out of scope — those
 *    two buttons stay disabled placeholders, same as before.
 *
 * Props:
 *   talentId              — required to call the proposals PATCH/submit
 *                           routes
 *   versionId             — the editable DRAFT/PROPOSED version's id, or
 *                           null when there is none (mirrors
 *                           TalentDetailsEditor/PodcastTab's
 *                           isEditablePending/editableVersionId pattern —
 *                           see app/admin/talent/[id]/page.jsx)
 *   versionStatus         — "DRAFT" | "PROPOSED" | null, mirrors versionId
 *   imageUrl              — published ImageAsset.blobUrl, or null
 *   profileImagePosition  — published CSS object-position string, or null
 *   profileImageScale     — published CSS transform: scale factor, or null
 *   pendingImageUrl       — pending DRAFT/PROPOSED version's own
 *                           ImageAsset.blobUrl, or null. The pending
 *                           version already carries its own copy of these
 *                           three columns (insertTalentVersion copies them
 *                           when a Draft is created; getTalentVersionById
 *                           reads them back), so a previously-saved
 *                           replacement still shows as the preview after a
 *                           page reload, before any new upload this
 *                           session.
 *   pendingImagePosition  — same, for object-position
 *   pendingImageScale     — same, for the scale factor
 *   displayName           — talent's display name, for alt text
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ProfileImagePanel.module.css";
import EditorActionBar from "./EditorActionBar";
import { he } from "@/lib/admin/i18n/he";
import { VERSION_STATUS } from "@/lib/admin/constants/enums";

const ACCEPTED_MIME_TYPES = "image/jpeg,image/png,image/webp";

export default function ProfileImagePanel({
  talentId,
  versionId = null,
  versionStatus = null,
  imageUrl = null,
  profileImagePosition = null,
  profileImageScale = null,
  pendingImageUrl = null,
  pendingImagePosition = null,
  pendingImageScale = null,
  displayName,
}) {
  const copy = he.talent.detail.profile.image;
  const router = useRouter();
  const fileInputRef = useRef(null);
  const objectUrlRef = useRef(null);

  const isDraft = versionStatus === VERSION_STATUS.DRAFT;
  const fallbackUrl = pendingImageUrl ?? imageUrl ?? null;
  const fallbackPosition = pendingImageUrl ? pendingImagePosition : profileImagePosition;
  const fallbackScale = pendingImageUrl ? pendingImageScale : profileImageScale;

  const [previewUrl, setPreviewUrl] = useState(fallbackUrl);
  const [previewPosition, setPreviewPosition] = useState(fallbackPosition);
  const [previewScale, setPreviewScale] = useState(fallbackScale);
  const [pendingAssetId, setPendingAssetId] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("idle"); // idle | uploading | error
  const [uploadError, setUploadError] = useState(null);
  const [saveDraftStatus, setSaveDraftStatus] = useState("idle");
  const [saveDraftError, setSaveDraftError] = useState(null);
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitError, setSubmitError] = useState(null);

  // Stays in sync with the server-derived props (e.g. after Submit's
  // router.refresh() re-derives a fresh published/pending pair and flips
  // versionId back to null) — but only while there is no unsaved local
  // edit, so a just-uploaded-but-not-yet-saved preview is never clobbered
  // by a stale re-render.
  useEffect(() => {
    if (!isDirty) {
      setPreviewUrl(fallbackUrl);
      setPreviewPosition(fallbackPosition);
      setPreviewScale(fallbackScale);
      setPendingAssetId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallbackUrl, fallbackPosition, fallbackScale, versionId]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const imageStyle = {
    objectPosition: previewPosition || "center top",
    transform: previewScale ? `scale(${previewScale})` : undefined,
  };

  function openPicker() {
    if (!versionId) return;
    fileInputRef.current?.click();
  }

  function handleFileChange(event) {
    const files = event.target.files;
    // Reset immediately so re-picking the same file still fires onChange.
    event.target.value = "";
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }

  function handleDragOver(event) {
    if (!versionId) return;
    event.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragOver(false);
    if (!versionId) return;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  }

  async function handleFile(file) {
    if (!versionId) return;

    // Immediate optimistic preview via a local object URL, swapped for the
    // real (durable) blobUrl once the upload response returns — same
    // "show it now, persist on Save Draft" split MediaGalleryEditor's
    // uploadQueueItem already uses for Gallery images.
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const localUrl = URL.createObjectURL(file);
    objectUrlRef.current = localUrl;
    setPreviewUrl(localUrl);
    setPreviewPosition(null);
    setPreviewScale(null);
    setUploadStatus("uploading");
    setUploadError(null);
    setSaveDraftStatus("idle");
    setSaveDraftError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("purpose", "profile");

      const response = await fetch("/api/admin/assets/upload", {
        method: "POST",
        body: formData,
      });

      // The upload route already returns a ready-to-display Hebrew `error`
      // string (sourced server-side from he.gallery.errors.*), so this is
      // shown as-is rather than re-mapped by error code.
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || copy.uploadGenericError);
      }

      const asset = body.asset;
      setPendingAssetId(asset.id);
      setPreviewUrl(asset.blobUrl);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setIsDirty(true);
      setUploadStatus("idle");
    } catch (error) {
      setUploadStatus("error");
      setUploadError(error?.message || copy.uploadGenericError);
      // Revert the optimistic preview back to whatever is actually saved.
      setPreviewUrl(fallbackUrl);
      setPreviewPosition(fallbackPosition);
      setPreviewScale(fallbackScale);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    }
  }

  async function handleSaveDraft() {
    if (!versionId || pendingAssetId === null) return;

    setSaveDraftStatus("saving");
    setSaveDraftError(null);

    try {
      const response = await fetch(`/api/admin/talent/${talentId}/proposals/${versionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { profileImageAssetId: pendingAssetId } }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || he.editor.saveDraft.error);
      }

      setIsDirty(false);
      setSaveDraftStatus("saved");
    } catch (error) {
      setSaveDraftStatus("error");
      setSaveDraftError(error?.message || copy.networkError);
    }
  }

  async function handleSubmit() {
    if (!versionId || !isDraft) return;

    setSubmitStatus("submitting");
    setSubmitError(null);

    try {
      const response = await fetch(`/api/admin/talent/${talentId}/proposals/${versionId}/submit`, {
        method: "POST",
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || he.editor.submit.error);
      }

      setSubmitStatus("submitted");
      // Same reasoning as TalentDetailsEditor.handleSubmit: a successful
      // submit flips the version's status, which the page's own
      // pendingVersion read depends on — refresh re-derives versionId/
      // versionStatus on the next render.
      router.refresh();
    } catch (error) {
      setSubmitStatus("error");
      setSubmitError(error?.message || copy.networkError);
    }
  }

  function handleCancel() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPreviewUrl(fallbackUrl);
    setPreviewPosition(fallbackPosition);
    setPreviewScale(fallbackScale);
    setPendingAssetId(null);
    setIsDirty(false);
    setUploadStatus("idle");
    setUploadError(null);
    setSaveDraftStatus("idle");
    setSaveDraftError(null);
  }

  const saveDraftDisabledReason = !versionId
    ? he.editor.saveDraft.disabledNoVersion
    : !isDirty
      ? he.editor.saveDraft.disabledNoChanges
      : undefined;

  const submitDisabledReason = !versionId
    ? he.editor.submit.disabledNoVersion
    : !isDraft
      ? he.editor.submit.disabledProposedLocked
      : isDirty
        ? he.editor.submit.unsavedHint
        : undefined;

  const saveDraftStatusMessage =
    saveDraftStatus === "error"
      ? saveDraftError
      : saveDraftStatus === "saved"
        ? isDraft
          ? he.editor.saveDraft.saved
          : he.editor.saveDraft.savedProposal
        : undefined;

  return (
    <section className={styles.panel} aria-labelledby="profile-image-heading">
      <div className={styles.heading}>
        <h2 id="profile-image-heading" className={styles.title}>
          {copy.sectionTitle}
        </h2>
      </div>

      <div className={styles.body}>
        <div className={styles.previewColumn}>
          <span className={styles.previewLabel}>{copy.previewLabel}</span>
          <div
            className={`${styles.frame} ${versionId ? styles.frameInteractive : ""} ${
              isDragOver ? styles.frameDragOver : ""
            }`}
            role={versionId ? "button" : undefined}
            tabIndex={versionId ? 0 : undefined}
            aria-label={versionId ? copy.clickHint : undefined}
            onClick={versionId ? openPicker : undefined}
            onKeyDown={versionId ? handleKeyDown : undefined}
            onDragEnter={handleDragOver}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={he.talent.detail.profile.imageAlt(displayName)}
                className={styles.image}
                style={imageStyle}
              />
            ) : (
              <div className={styles.placeholder} aria-hidden="true">
                {he.talent.detail.profile.noImage}
              </div>
            )}

            {versionId ? (
              <div className={styles.overlay} aria-hidden="true">
                {uploadStatus === "uploading" ? copy.uploading : isDragOver ? copy.dragActiveHint : copy.clickHint}
              </div>
            ) : null}

            {versionId ? (
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_MIME_TYPES}
                className={styles.hiddenInput}
                onChange={handleFileChange}
                tabIndex={-1}
                aria-hidden="true"
              />
            ) : null}
          </div>

          {!versionId ? <p className={styles.noEditableVersionHint}>{copy.noEditableVersionHint}</p> : null}
          {uploadStatus === "error" ? (
            <p className={styles.uploadErrorHint} role="alert">
              {uploadError}
            </p>
          ) : null}
        </div>

        {/*
          Crop/Position and Zoom/Scale remain explicitly out of scope for
          this sprint — same disabled placeholders as before. "Replace" is
          gone as a separate button: clicking or dropping onto the preview
          above is now the one replace affordance, matching the Gallery's
          click-or-drop dropzone interaction instead of a redundant second
          control.
        */}
        <div className={styles.controlsColumn}>
          <button type="button" className={styles.controlButton} disabled>
            {copy.controls.crop}
          </button>
          <button type="button" className={styles.controlButton} disabled>
            {copy.controls.zoom}
          </button>
          <p className={styles.comingSoonHint}>{copy.comingSoonHint}</p>
        </div>
      </div>

      {versionId ? (
        <EditorActionBar
          onCancel={handleCancel}
          onSaveDraft={handleSaveDraft}
          onSubmit={handleSubmit}
          saveDraftDisabled={!isDirty || saveDraftStatus === "saving"}
          submitDisabled={!isDraft || isDirty || submitStatus === "submitting"}
          saveDraftDisabledReason={saveDraftDisabledReason}
          submitDisabledReason={submitDisabledReason}
          saveDraftStatus={saveDraftStatus}
          saveDraftStatusMessage={saveDraftStatusMessage}
          saveDraftLabel={isDraft ? he.editor.actions.saveDraft : he.editor.actions.updateProposal}
          submitStatus={submitStatus}
          submitStatusMessage={submitStatus === "error" ? submitError : undefined}
        />
      ) : null}
    </section>
  );
}
