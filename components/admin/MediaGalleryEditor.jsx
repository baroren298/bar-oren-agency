"use client";

/*
 * MediaGalleryEditor — Gallery Editor Foundation sprint, polished by the
 * Gallery UX Polish sprint, connected to real persistence by Gallery
 * Sprint 1.
 *
 * Was (through the UX Polish sprint): strictly local-state-only, exactly
 * like SocialLinksEditor before the Social Links persistence sprint —
 * "ביטול שינויים"/reorder/remove worked against an in-memory array only,
 * "שמור כטיוטה"/"שלח לאישור" were hard-hidden (`showSaveDraft={false}
 * showSubmit={false}`) because no save path existed for gallery rows yet.
 *
 * Is: the proposed grid now seeds from a real persisted Draft/Proposed set
 * when one exists (`draftImages`, read by
 * talentAdapter.getDraftOrProposedGalleryImages — see
 * app/admin/talent/[id]/page.jsx), falling back to the published rows when
 * it doesn't — the exact same "draftValue falls back to value" seed
 * SocialLinksEditor uses. Save Draft and Submit are real network calls
 * against app/api/admin/talent/[id]/gallery[/submit], backed by
 * lib/admin/engine/galleryService.js.
 *
 * Still exactly the same "Current Published / Proposed Update" philosophy:
 * an employee always sees what is actually live on the website (read-only,
 * via PublishedMediaGrid), and separately shapes a proposed gallery
 * beneath it — nothing here ever touches the live site directly.
 *
 * UPDATED — Gallery Upload Sprint 2: "Add Image" is now real. Picking a
 * file in AddImageCard calls handleUploadImage below, which POSTs
 * multipart FormData to /api/admin/assets/upload (purpose=gallery) and, on
 * success, appends a new row straight into the in-memory proposed grid —
 * carrying only `imageAssetId` (no `id` yet, since no TalentGalleryImage
 * row exists until Save Draft). It renders immediately via the existing,
 * unchanged GalleryImageCard, with the same metadata fields editable and
 * the same Remove/Reorder behavior as any other proposed row. Save Draft's
 * existing PATCH call is what actually creates the TalentGalleryImage row
 * (galleryService.saveDraft's pre-existing "no id, has imageAssetId"
 * branch — see that file) — toComparablePayload below now forwards
 * `imageAssetId` for any row that has no `id` yet, which it previously
 * dropped (dead code until this sprint, since no row could ever lack an
 * `id` before). GalleryImageCard's "החלף" button and AddImageCard's
 * disabled/no-talentId fallback are unchanged — still no replace, no
 * drag/drop, no bulk upload, no media library, no crop UI.
 *
 * Per Gallery Sprint 1's explicit scope:
 *   - Existing images only. There is still no Add Image / Replace Image /
 *     Upload — AddImageCard and GalleryImageCard's "החלף" button stay
 *     disabled with their existing "coming soon" tooltips, unchanged.
 *   - "Remove" stays exactly as before: a local-only, never-persisted
 *     operation (see its existing `removeHint` copy) — Save Draft only
 *     ever sends the rows still present in the proposed grid, so removing
 *     a card here simply leaves that row untouched in the database rather
 *     than deleting it. This sprint adds no delete capability.
 *   - "Reorder" (move up/down) is still real against the in-memory array,
 *     but now also feeds the persisted `order` field — saving a draft
 *     writes each row's current position in the proposed grid.
 *   - New: per-card metadata editing (altHe, altEn, position, scale,
 *     mobileOrder) via GalleryImageCard's `onChange`, persisted the same
 *     way.
 *
 * Props:
 *   - talentId (string, optional) — the Talent id. When absent, this
 *     component falls back to the original, fully local preview-only
 *     behavior (no talentId means there's nowhere to save to) — same
 *     fallback SocialLinksEditor uses.
 *   - publishedImages ({ id, src, alt, altHe, altEn, position, scale,
 *     mobileOrder, order, versionStatus, basedOnVersionId }[], optional,
 *     default []) — every published+active TalentGalleryImage row,
 *     already in display order.
 *   - draftImages (same shape[], optional, default []) — every DRAFT or
 *     PROPOSED TalentGalleryImage row already saved for this talent. When
 *     non-empty, the proposed grid seeds from this instead of
 *     `publishedImages`.
 *   - rejectedImages (same shape + rejectionNote[], optional, default [])
 *     — every REJECTED TalentGalleryImage row for this talent, rendered as
 *     a notice above the comparison grids with a "המשך תיקון" / "Continue
 *     fixing" resume action, mirroring SocialLinksEditor's
 *     RejectedSocialsNotice.
 *   - emptyPublishedTitle / emptyPublishedDescription (string, optional)
 *   - emptyProposedTitle / emptyProposedDescription (string, optional)
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./MediaGalleryEditor.module.css";
import PublishedMediaGrid from "./PublishedMediaGrid";
import GalleryImageCard from "./GalleryImageCard";
import AddImageCard from "./AddImageCard";
import EmptyState from "./EmptyState";
import EditorActionBar from "./EditorActionBar";
import PrimaryButton from "./PrimaryButton";
import { he } from "@/lib/admin/i18n/he";
import { VERSION_STATUS } from "@/lib/admin/constants/enums";
import { filterUnresolvedRejectedGalleryImages } from "@/lib/admin/gallery-review";

/*
 * Kept for any future standalone/no-talentId render of this editor — see
 * PersistenceModeNote below for the real, persistence-aware copy used once
 * a talentId is supplied.
 */
function PreviewModeNotice() {
  return (
    <div className={styles.previewNotice} role="note">
      <p className={styles.previewNoticeTitle}>{he.gallery.previewModeNotice.title}</p>
      <p className={styles.previewNoticeBody}>{he.gallery.previewModeNotice.body}</p>
    </div>
  );
}

function PersistenceModeNote() {
  return (
    <div className={styles.previewNotice} role="note">
      <p className={styles.previewNoticeTitle}>{he.gallery.persistenceModeNote.title}</p>
      <p className={styles.previewNoticeBody}>{he.gallery.persistenceModeNote.body}</p>
    </div>
  );
}

/*
 * Gallery Sprint 1 — one notice per REJECTED TalentGalleryImage row,
 * mirroring SocialLinksEditor's RejectedSocialsNotice exactly, including
 * the per-row "המשך תיקון" / "Continue fixing" resume action (POST
 * .../gallery/[imageId]/resume) and per-row loading/error state so
 * resuming one image's notice never disables another's button.
 */
function RejectedGalleryImagesNotice({ talentId, rejectedImages }) {
  const router = useRouter();
  const [resumingId, setResumingId] = useState(null);
  const [resumeErrors, setResumeErrors] = useState({});

  if (!rejectedImages || rejectedImages.length === 0) return null;

  async function handleResume(imageId) {
    if (!talentId || resumingId) return;

    setResumingId(imageId);
    setResumeErrors((previous) => ({ ...previous, [imageId]: null }));

    try {
      const response = await fetch(`/api/admin/talent/${talentId}/gallery/${imageId}/resume`, {
        method: "POST",
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || he.gallery.rejectionNotice.resumeError);
      }

      // Mirrors handleSubmit's pattern below: the new Draft this just
      // created lives only in the database until the Server Component tree
      // re-fetches, which is also what makes this notice disappear (the
      // page's filtered rejectedImages list now finds a newer row in this
      // image's lineage).
      router.refresh();
    } catch (error) {
      setResumeErrors((previous) => ({
        ...previous,
        [imageId]: error?.message || he.gallery.rejectionNotice.resumeError,
      }));
    } finally {
      setResumingId(null);
    }
  }

  return (
    <div className={styles.previewNotice} role="alert">
      <p className={styles.previewNoticeTitle}>
        {he.gallery.rejectionNotice.eyebrowIcon} {he.gallery.rejectionNotice.title}
      </p>
      <p className={styles.previewNoticeBody}>{he.gallery.rejectionNotice.subtitle}</p>
      {rejectedImages.map((image) => {
        const isResuming = resumingId === image.id;
        const resumeError = resumeErrors[image.id];
        return (
          <div key={image.id} className={styles.previewNoticeBody}>
            <p>
              <strong>{image.alt || image.altHe || image.id}:</strong>{" "}
              {he.gallery.rejectionNotice.noteLabel}: {image.rejectionNote}
            </p>
            {talentId ? (
              <PrimaryButton
                type="button"
                onClick={() => handleResume(image.id)}
                disabled={Boolean(resumingId)}
              >
                {isResuming ? he.gallery.rejectionNotice.resuming : he.gallery.rejectionNotice.resumeAction}
              </PrimaryButton>
            ) : null}
            {resumeError ? (
              <p className={styles.previewNoticeBody} role="alert">
                {resumeError}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function withKeys(images) {
  // Real DB rows already have a stable `id`; reuse it as the React/local-
  // state key so edits target the right card — mirrors SocialLinksEditor's
  // withKeys exactly. Only ever called on rows that came from the server
  // (the initial seed, or a Save Draft response) — both always have a real
  // `id` by the time they reach here. A freshly-uploaded, not-yet-saved row
  // (Gallery Upload Sprint 2) is appended directly in handleUploadImage
  // with its own explicit `_key`, bypassing this helper, since it has no
  // `id` yet.
  return images.map((image) => ({ ...image, _key: image.id }));
}

// Only the fields the server actually accepts for a partial update are sent
// over the wire for Save Draft — `order` is recomputed from the row's
// current position in this array (reordering's actual effect), not read
// off the row itself, since move up/down only mutate local array order.
//
// Gallery Upload Sprint 2: a freshly-uploaded row has no `id` yet (only
// `imageAssetId`, set by handleUploadImage below) — forward it so
// galleryService.saveDraft's existing "no id, has imageAssetId" branch can
// insert the new TalentGalleryImage row. Rows that already have an `id`
// never need imageAssetId on the wire (the server already knows it from
// the existing row), so this only adds the field for the new-row case.
function toComparablePayload(images) {
  return images.map((image, index) => ({
    id: image.id,
    ...(image.id ? {} : { imageAssetId: image.imageAssetId }),
    order: index,
    altHe: image.altHe ?? null,
    altEn: image.altEn ?? null,
    position: image.position ?? null,
    scale: image.scale ?? null,
    mobileOrder: image.mobileOrder ?? null,
  }));
}

export default function MediaGalleryEditor({
  talentId = null,
  publishedImages = [],
  draftImages = [],
  rejectedImages = [],
  emptyPublishedTitle = he.gallery.noPublishedImagesTitle,
  emptyPublishedDescription = he.gallery.noPublishedImagesDescription,
  emptyProposedTitle = he.gallery.noProposedImagesTitle,
  emptyProposedDescription = he.gallery.noProposedImagesDescription,
}) {
  const router = useRouter();
  const hasPersistence = Boolean(talentId);
  const initialSeed = draftImages.length > 0 ? draftImages : publishedImages;

  // Hide any REJECTED notice already superseded by a newer row in the same
  // lineage (e.g. a Draft created via "Continue fixing" below) — see
  // gallery-review.js's filterUnresolvedRejectedGalleryImages.
  const unresolvedRejectedImages = filterUnresolvedRejectedGalleryImages(rejectedImages, [
    ...publishedImages,
    ...draftImages,
    ...rejectedImages,
  ]);

  const [proposedImages, setProposedImages] = useState(() => withKeys(initialSeed));
  const [savedImages, setSavedImages] = useState(() => withKeys(initialSeed));

  const [saveDraftStatus, setSaveDraftStatus] = useState("idle"); // idle | saving | saved | error
  const [saveDraftError, setSaveDraftError] = useState(null);
  const [submitStatus, setSubmitStatus] = useState("idle"); // idle | submitting | submitted | error
  const [submitError, setSubmitError] = useState(null);

  // Gallery Upload Sprint 2 — local-only state for the AddImageCard upload
  // trigger. Deliberately separate from saveDraftStatus/submitStatus: an
  // upload is its own network call (POST /api/admin/assets/upload), not a
  // Save Draft, and can fail or succeed independently of whether the grid
  // has ever been saved.
  const [uploadStatus, setUploadStatus] = useState("idle"); // idle | uploading | error
  const [uploadError, setUploadError] = useState(null);
  const uploading = uploadStatus === "uploading";

  const isDirty =
    JSON.stringify(toComparablePayload(proposedImages)) !== JSON.stringify(toComparablePayload(savedImages));
  const saving = saveDraftStatus === "saving";
  const submitting = submitStatus === "submitting";
  const hasDraftRows = savedImages.some((image) => image.versionStatus === VERSION_STATUS.DRAFT);

  const saveDraftDisabled = !hasPersistence || !isDirty || saving || submitting;
  const submitDisabled = !hasPersistence || isDirty || saving || submitting || !hasDraftRows;

  const saveDraftDisabledReason = !hasPersistence
    ? undefined
    : !isDirty
      ? he.editor.saveDraft.disabledNoChanges
      : undefined;
  const submitDisabledReason = !hasPersistence
    ? undefined
    : isDirty
      ? he.editor.submit.unsavedHint
      : !hasDraftRows
        ? he.gallery.errors.nothingToSubmit
        : undefined;

  function clearStatuses() {
    if (saveDraftStatus !== "idle" && saveDraftStatus !== "saving") {
      setSaveDraftStatus("idle");
      setSaveDraftError(null);
    }
    if (submitStatus !== "idle" && submitStatus !== "submitting") {
      setSubmitStatus("idle");
      setSubmitError(null);
    }
  }

  function handleFieldChange(key, field, value) {
    setProposedImages((previous) =>
      previous.map((image) => (image._key === key ? { ...image, [field]: value } : image))
    );
    clearStatuses();
  }

  // Resets back to whatever was last actually saved (or, if nothing has
  // been saved yet this session, the original published/draft seed) —
  // never talks to a server. Mirrors SocialLinksEditor's handleCancel.
  function handleReset() {
    setProposedImages(savedImages);
    setSaveDraftStatus("idle");
    setSaveDraftError(null);
  }

  // Still local-only, never persisted — see this file's header comment.
  function handleRemove(index) {
    setProposedImages((previous) => previous.filter((_, i) => i !== index));
    clearStatuses();
  }

  function handleMove(index, direction) {
    setProposedImages((previous) => {
      const target = index + direction;
      if (target < 0 || target >= previous.length) return previous;
      const next = [...previous];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    clearStatuses();
  }

  // Gallery Upload Sprint 2 — uploads one file via the existing
  // /api/admin/assets/upload route, then appends the result straight into
  // the in-memory proposed grid (no id yet, just imageAssetId — see
  // toComparablePayload's header comment for how Save Draft turns this
  // into a real row). Mirrors handleSaveDraft's fetch/error-handling shape
  // below, but never touches saveDraftStatus/submitStatus — this is a
  // separate network call with its own idle/uploading/error state.
  async function handleUploadImage(file) {
    if (!hasPersistence || uploading) return;

    setUploadStatus("uploading");
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("purpose", "gallery");

      const response = await fetch("/api/admin/assets/upload", {
        method: "POST",
        body: formData,
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || he.gallery.uploadGenericError);
      }

      const asset = body.asset;
      setProposedImages((previous) => [
        ...previous,
        {
          _key: `new-${asset.id}`,
          imageAssetId: asset.id,
          src: asset.blobUrl,
          alt: he.gallery.newImageAlt,
          altHe: null,
          altEn: null,
          position: null,
          scale: null,
          // Sensible defaults: append at the end of both the desktop and
          // mobile order — toComparablePayload recomputes `order` from
          // array position on save anyway, but mobileOrder has no such
          // recompute, so it's seeded explicitly here.
          order: previous.length,
          mobileOrder: previous.length,
        },
      ]);
      setUploadStatus("idle");
      clearStatuses();
    } catch (error) {
      setUploadStatus("error");
      setUploadError(error?.message || he.gallery.uploadGenericError);
    }
  }

  async function handleSaveDraft() {
    if (!hasPersistence || saveDraftDisabled) return;

    setSaveDraftStatus("saving");
    setSaveDraftError(null);

    try {
      const response = await fetch(`/api/admin/talent/${talentId}/gallery`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: toComparablePayload(proposedImages) }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (body.code === "VALIDATION_FAILED") {
          throw new Error(he.gallery.errors.validationSummary);
        }
        throw new Error(body.error || he.gallery.errors.serverError);
      }

      const saved = withKeys(body.images || []);
      setProposedImages(saved);
      setSavedImages(saved);
      setSaveDraftStatus("saved");
    } catch (error) {
      setSaveDraftStatus("error");
      setSaveDraftError(error?.message || he.gallery.errors.networkError);
    }
  }

  async function handleSubmit() {
    if (!hasPersistence || submitDisabled) return;

    setSubmitStatus("submitting");
    setSubmitError(null);

    try {
      const response = await fetch(`/api/admin/talent/${talentId}/gallery/submit`, {
        method: "POST",
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || he.gallery.errors.serverError);
      }

      setSubmitStatus("submitted");
      // Re-fetch the Server Component tree so the page's own
      // getDraftOrProposedGalleryImages read picks up the new PROPOSED
      // status — same pattern SocialLinksEditor.handleSubmit uses.
      router.refresh();
    } catch (error) {
      setSubmitStatus("error");
      setSubmitError(error?.message || he.gallery.errors.networkError);
    }
  }

  return (
    <div className={styles.tokens}>
      <RejectedGalleryImagesNotice talentId={talentId} rejectedImages={unresolvedRejectedImages} />

      <section className={styles.publishedSection} aria-label={he.gallery.publishedEyebrowTitle}>
        <header className={styles.eyebrow}>
          <span className={styles.eyebrowIcon} aria-hidden="true">
            {he.gallery.publishedEyebrowIcon}
          </span>
          <span className={styles.eyebrowTitle}>{he.gallery.publishedEyebrowTitle}</span>
        </header>
        <p className={styles.publishedSubtitle}>{he.gallery.publishedSubtitle}</p>

        <PublishedMediaGrid
          images={publishedImages}
          emptyTitle={emptyPublishedTitle}
          emptyDescription={emptyPublishedDescription}
        />
      </section>

      <section className={styles.proposedSection} aria-label={he.gallery.proposedEyebrowTitle}>
        <header className={styles.eyebrow}>
          <span className={styles.eyebrowIcon} aria-hidden="true">
            {he.gallery.proposedEyebrowIcon}
          </span>
          <span className={styles.eyebrowTitleProposed}>{he.gallery.proposedEyebrowTitle}</span>
        </header>
        <p className={styles.proposedSubtitle}>{he.gallery.proposedSubtitle}</p>

        {proposedImages.length === 0 ? (
          <EmptyState
            title={emptyProposedTitle}
            description={emptyProposedDescription}
            action={
              <AddImageCard
                className={styles.emptyProposedAction}
                onUpload={hasPersistence ? handleUploadImage : null}
                uploading={uploading}
                error={uploadStatus === "error" ? uploadError : null}
              />
            }
          />
        ) : (
          <div className={styles.proposedGrid}>
            {proposedImages.map((image, index) => (
              <GalleryImageCard
                key={image._key}
                image={image}
                isFirst={index === 0}
                isLast={index === proposedImages.length - 1}
                onChange={(field, value) => handleFieldChange(image._key, field, value)}
                onRemove={() => handleRemove(index)}
                onMoveUp={() => handleMove(index, -1)}
                onMoveDown={() => handleMove(index, 1)}
              />
            ))}
            <AddImageCard
              onUpload={hasPersistence ? handleUploadImage : null}
              uploading={uploading}
              error={uploadStatus === "error" ? uploadError : null}
            />
          </div>
        )}
      </section>

      {hasPersistence ? <PersistenceModeNote /> : <PreviewModeNotice />}
      {saveDraftStatus === "error" && saveDraftError ? (
        <p className={styles.previewNoticeBody} role="alert">
          {saveDraftError}
        </p>
      ) : null}
      <EditorActionBar
        onCancel={handleReset}
        onSaveDraft={handleSaveDraft}
        onSubmit={handleSubmit}
        showSaveDraft={hasPersistence}
        showSubmit={hasPersistence}
        saveDraftDisabled={saveDraftDisabled}
        saveDraftDisabledReason={saveDraftDisabledReason}
        saveDraftStatus={saveDraftStatus}
        saveDraftStatusMessage={saveDraftStatus === "error" ? saveDraftError : undefined}
        submitDisabled={submitDisabled}
        submitDisabledReason={submitDisabledReason}
        submitStatus={submitStatus}
        submitStatusMessage={submitStatus === "error" ? submitError : undefined}
      />
    </div>
  );
}
