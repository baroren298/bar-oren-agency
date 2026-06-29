"use client";

/*
 * ProfileImagePanel — Profile Image Management sprint.
 *
 * Thin, talent-specific wrapper around the reusable ImageAssetEditor
 * (Current Published vs Proposed image, upload, zoom/position) — the same
 * "thin wrapper around a generic editor" shape TalentDetailsEditor already
 * uses around ComparisonView. This file owns nothing about uploading,
 * dragging, or rendering an image; it only owns:
 *
 *  - mapping this talent's published/pending profile-image columns into
 *    the generic { assetUrl, position, scale } value shape
 *    ImageAssetEditor/ImageEditorCard expect
 *  - the Draft → Submit → Approve → Publish wiring (Save Draft PATCH,
 *    Submit POST, Cancel reverting local state) — the exact same
 *    proposals routes and EditorActionBar component every other editor in
 *    this admin already uses
 *  - deciding *what* to PATCH: profileImagePosition/profileImageScale are
 *    always included (even when null, to support clearing back to
 *    defaults), but profileImageAssetId is only included when a new
 *    upload actually completed this session (tracked via `uploadedAssetId`
 *    state) — relying on updateTalentVersionFields' sparse-update
 *    semantics (lib/admin/repository/talentRepository.js) so omitting the
 *    key leaves whatever asset id is already on the version untouched.
 *    This avoids needing the published image's real asset id client-side,
 *    so no repository/query changes were needed for this sprint.
 *
 * Props (unchanged from the previous, upload-placeholder version of this
 * component — app/admin/talent/[id]/page.jsx's call site needs no changes):
 *   talentId              — required to call the proposals PATCH/submit routes
 *   versionId             — the editable DRAFT/PROPOSED version's id, or
 *                           null when there is none
 *   versionStatus         — "DRAFT" | "PROPOSED" | null, mirrors versionId
 *   imageUrl              — published ImageAsset.blobUrl, or null
 *   profileImagePosition  — published CSS object-position string, or null
 *   profileImageScale     — published CSS transform: scale factor, or null
 *   pendingImageUrl       — pending DRAFT/PROPOSED version's own
 *                           ImageAsset.blobUrl, or null
 *   pendingImagePosition  — same, for object-position
 *   pendingImageScale     — same, for the scale factor
 *   displayName           — talent's display name, for alt text
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ProfileImagePanel.module.css";
import EditorActionBar from "./EditorActionBar";
import ImageAssetEditor from "./ImageAssetEditor";
import { he } from "@/lib/admin/i18n/he";
import { VERSION_STATUS } from "@/lib/admin/constants/enums";

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
  const sectionCopy = he.talent.detail.profile.image;
  const mediaCopy = he.media;
  const router = useRouter();

  const isDraft = versionStatus === VERSION_STATUS.DRAFT;

  const publishedValue = {
    assetUrl: imageUrl,
    position: profileImagePosition,
    scale: profileImageScale,
  };

  // Same fallback rule the previous version of this component used: a
  // previously-saved pending replacement (from an earlier session) wins
  // over the published image; otherwise fall back to published.
  const fallbackValue = pendingImageUrl
    ? { assetUrl: pendingImageUrl, position: pendingImagePosition, scale: pendingImageScale }
    : publishedValue;

  const [proposedValue, setProposedValue] = useState(fallbackValue);
  const [uploadedAssetId, setUploadedAssetId] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [saveDraftStatus, setSaveDraftStatus] = useState("idle");
  const [saveDraftError, setSaveDraftError] = useState(null);
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitError, setSubmitError] = useState(null);

  // Stays in sync with server-derived props (e.g. after Submit's
  // router.refresh() re-derives a fresh published/pending pair and flips
  // versionId back to null) — but only while there is no unsaved local
  // edit, so a just-uploaded-but-not-yet-saved preview is never clobbered
  // by a stale re-render.
  useEffect(() => {
    if (!isDirty) {
      setProposedValue(fallbackValue);
      setUploadedAssetId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallbackValue.assetUrl, fallbackValue.position, fallbackValue.scale, versionId]);

  function handleProposedChange(nextValue) {
    if (!versionId) return;
    const { assetId, ...rest } = nextValue;
    setProposedValue(rest);
    if (assetId) {
      setUploadedAssetId(assetId);
    }
    setIsDirty(true);
    setSaveDraftStatus("idle");
    setSaveDraftError(null);
  }

  async function handleSaveDraft() {
    if (!versionId || !isDirty) return;

    setSaveDraftStatus("saving");
    setSaveDraftError(null);

    const fields = {
      profileImagePosition: proposedValue.position ?? null,
      profileImageScale: proposedValue.scale ?? null,
    };
    if (uploadedAssetId !== null) {
      fields.profileImageAssetId = uploadedAssetId;
    }

    try {
      const response = await fetch(`/api/admin/talent/${talentId}/proposals/${versionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || he.editor.saveDraft.error);
      }

      setIsDirty(false);
      setSaveDraftStatus("saved");
    } catch (error) {
      setSaveDraftStatus("error");
      setSaveDraftError(error?.message || mediaCopy.errors.networkError);
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
      setSubmitError(error?.message || mediaCopy.errors.networkError);
    }
  }

  function handleCancel() {
    setProposedValue(fallbackValue);
    setUploadedAssetId(null);
    setIsDirty(false);
    setSaveDraftStatus("idle");
    setSaveDraftError(null);
    // Remounts ImageAssetEditor (via key below) so ImageEditorCard drops
    // any optimistic local preview / in-flight-upload state from the
    // cancelled edit — the temporary upload fully disappears, exactly like
    // every other field's Cancel restores the published value.
    setResetToken((token) => token + 1);
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
          {sectionCopy.sectionTitle}
        </h2>
      </div>

      <ImageAssetEditor
        key={resetToken}
        publishedValue={publishedValue}
        proposedValue={proposedValue}
        onProposedChange={handleProposedChange}
        purpose="profile"
        disabled={!versionId}
        defaultPosition="center top"
        alt={he.talent.detail.profile.imageAlt(displayName)}
        // Talent Detail UX Refactor, Phase 2 — single-section view/editing
        // copy (see ImageAssetEditor's header comment); the old published*/
        // proposed* keys are no longer read here since there is only ever
        // one frame now. Single-Section Editing UX sprint removed
        // showPositionGrid entirely (no more 3×3 grid to show/hide) — see
        // ImagePositionControls' header comment.
        copy={{
          viewEyebrowIcon: mediaCopy.viewEyebrowIcon,
          viewEyebrowTitle: mediaCopy.viewEyebrowTitle,
          viewSubtitle: mediaCopy.viewSubtitle,
          editingEyebrowIcon: mediaCopy.editingEyebrowIcon,
          editingEyebrowTitle: mediaCopy.editingEyebrowTitle,
          editingSubtitle: mediaCopy.editingSubtitle,
          noImage: he.talent.detail.profile.noImage,
          uploadArea: mediaCopy.uploadArea,
          preview: mediaCopy.preview,
          positionControls: mediaCopy.positionControls,
          disabledHint: sectionCopy.noEditableVersionHint,
          errors: mediaCopy.errors,
        }}
      />

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
