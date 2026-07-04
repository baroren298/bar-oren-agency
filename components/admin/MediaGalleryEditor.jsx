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
 * UPDATED — Gallery UX Polish sprint: "Add Image" now accepts several files
 * at once (click-multi-select or drag-and-drop onto AddImageCard's new
 * modern drop zone), each uploaded sequentially via the same unchanged
 * /api/admin/assets/upload call handleUploadImage used to make, one POST
 * per file. `uploadQueue` replaces the old single uploadStatus/uploadError
 * pair with one entry per in-flight file (rendered as UploadingImageCard
 * placeholders in the grid) so a failed file shows its own inline error and
 * dismiss button without blocking or hiding any other file's upload or any
 * already-completed image. Reordering is now drag-and-drop instead of
 * Up/Down buttons; `handleMove` is gone, replaced by `handleDragEnd` below.
 * `toComparablePayload` is unchanged — it still derives `order` from each
 * row's position in `proposedImages`, which is now set by dragging instead
 * of by button clicks.
 *
 * UPDATED again — same sprint: the first reorder pass used framer-motion's
 * `<Reorder.Group>` (framer-motion was already a project dependency), but
 * its single-axis swap logic isn't grid-aware and felt imprecise across a
 * 4-column wrapping grid. Replaced with @dnd-kit/core + @dnd-kit/sortable +
 * @dnd-kit/utilities (newly installed for this purpose), which ship a
 * `rectSortingStrategy` built specifically for multi-column grid reordering.
 * `<DndContext>` + `<SortableContext>` wrap the grid below; `handleDragEnd`
 * uses `arrayMove` on `active.id`/`over.id` (both `_key`s) to produce the
 * new order. AddImageCard/UploadingImageCard render as plain siblings
 * inside the same grid — they are not part of `SortableContext`'s `items`,
 * so they're never drag targets, only the real image cards are.
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

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import styles from "./MediaGalleryEditor.module.css";
import PublishedMediaGrid from "./PublishedMediaGrid";
import GalleryImageCard from "./GalleryImageCard";
import AddImageCard from "./AddImageCard";
import UploadingImageCard from "./UploadingImageCard";
import EmptyState from "./EmptyState";
import EditorActionBar from "./EditorActionBar";
import PrimaryButton from "./PrimaryButton";
import { he } from "@/lib/admin/i18n/he";
import { VERSION_STATUS, ROLE } from "@/lib/admin/constants/enums";
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
  role = null,
  // Pre-merge blocker fix sprint (QA finding #1) — computed server-side
  // (lib/storage/availability.js, via app/admin/talent/[id]/page.jsx):
  // false when the active storage provider is `local` in a production
  // build. Gates only the upload surface (AddImageCard becomes the inert
  // placeholder + a Hebrew notice renders); reorder/alt/crop editing, Save
  // Draft, Submit and Publish keep working.
  uploadsEnabled = true,
}) {
  const router = useRouter();
  const hasPersistence = Boolean(talentId);
  const canUpload = hasPersistence && uploadsEnabled;
  const isOwner = role === ROLE.OWNER;
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

  // Single-Section Editing UX sprint — collapses the old simultaneous
  // "Published" + "Proposed" two-section layout into one section that
  // toggles between a read-only view and the exact same editable surface,
  // mirroring ComparisonView/SocialLinksEditor's Phase 1 pattern. Like
  // Social Links, Gallery has no entity that gates whether editing is
  // *possible* — entering edit mode is purely local UI state, never an API
  // call. Starts true whenever a real Draft/Proposed set already exists
  // (resuming a session in progress reads as "still editing").
  const [isEditing, setIsEditing] = useState(() => draftImages.length > 0);

  const [saveDraftStatus, setSaveDraftStatus] = useState("idle"); // idle | saving | saved | error
  const [saveDraftError, setSaveDraftError] = useState(null);
  const [submitStatus, setSubmitStatus] = useState("idle"); // idle | submitting | submitted | error
  const [submitError, setSubmitError] = useState(null);
  // Owner Direct Publish UX sprint — same idle/in-flight/error shape as
  // saveDraftStatus/submitStatus above, for the Owner-only Publish Now
  // action.
  const [publishStatus, setPublishStatus] = useState("idle"); // idle | publishing | published | error
  const [publishError, setPublishError] = useState(null);

  // Gallery UX Polish sprint — one entry per in-flight upload, replacing
  // Gallery Upload Sprint 2's single uploadStatus/uploadError pair now that
  // several files can upload at once. Deliberately separate from
  // saveDraftStatus/submitStatus: an upload is its own network call (POST
  // /api/admin/assets/upload per file), not a Save Draft, and can fail or
  // succeed independently of whether the grid has ever been saved or of any
  // other file in the same batch.
  // Shape: { clientId, fileName, file, status: "uploading" | "error", error }
  const [uploadQueue, setUploadQueue] = useState([]);

  // Gallery UX Polish sprint — PointerSensor handles mouse/touch drag from
  // the card's handle (a small `distance` threshold avoids hijacking a
  // plain click on the handle as an accidental drag); KeyboardSensor makes
  // the same handle operable with Space/arrow keys/Space, since dnd-kit's
  // `attributes` (spread onto the handle in GalleryImageCard.jsx) wire up
  // the necessary aria/tabIndex automatically.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const isDirty =
    JSON.stringify(toComparablePayload(proposedImages)) !== JSON.stringify(toComparablePayload(savedImages));
  const saving = saveDraftStatus === "saving";
  const submitting = submitStatus === "submitting";
  const publishing = publishStatus === "publishing";
  const hasDraftRows = savedImages.some((image) => image.versionStatus === VERSION_STATUS.DRAFT);
  // Owner Direct Publish UX sprint — unlike hasDraftRows (Submit is
  // DRAFT-only), Publish Now is meant to work on a row that's already
  // PROPOSED too (e.g. one an Employee already submitted) — see
  // TalentDetailsEditor's analogous comment for the same distinction.
  const hasPublishableRows = savedImages.some(
    (image) => image.versionStatus === VERSION_STATUS.DRAFT || image.versionStatus === VERSION_STATUS.PROPOSED
  );

  const saveDraftDisabled = !hasPersistence || !isDirty || saving || submitting;
  const submitDisabled = !hasPersistence || isDirty || saving || submitting || !hasDraftRows;
  const publishDisabled =
    !hasPersistence || !isOwner || isDirty || saving || submitting || publishing || !hasPublishableRows;

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
  const publishDisabledReason = !hasPersistence
    ? undefined
    : isDirty
      ? he.editor.publish.unsavedHint
      : !hasPublishableRows
        ? he.editor.publish.disabledNothingToPublish
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
    if (publishStatus !== "idle" && publishStatus !== "publishing") {
      setPublishStatus("idle");
      setPublishError(null);
    }
  }

  // Implementation Sprint A, Phase 1 — state synchronization after Publish.
  // Same bug/fix shape as SocialLinksEditor's analogous effect:
  // handlePublishNow (and handleSubmit) call `router.refresh()`, which
  // re-renders this component with fresh `publishedImages`/`draftImages`
  // props but never remounts it — so `proposedImages`/`savedImages`, seeded
  // once via `useState(() => withKeys(initialSeed))`, would otherwise stay
  // frozen on the pre-publish rows forever, along with whatever save/
  // submit/publish status was last set. Guarded by `!isDirty` for the same
  // reason every other module's sync effect is: Publish/Submit are only
  // clickable while clean, so by the time either succeeds and props change,
  // proposedImages already equals savedImages — resyncing both to the fresh
  // server rows can never clobber an in-progress, unsaved edit (including a
  // still-in-flight upload, which only ever touches proposedImages once it
  // resolves, after which the grid is dirty again until the next save).
  const initialSeedKey = JSON.stringify(toComparablePayload(initialSeed));
  useEffect(() => {
    if (!isDirty) {
      const refreshed = withKeys(initialSeed);
      setProposedImages(refreshed);
      setSavedImages(refreshed);
      setSaveDraftStatus("idle");
      setSaveDraftError(null);
      setSubmitStatus("idle");
      setSubmitError(null);
      setPublishStatus("idle");
      setPublishError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSeedKey]);

  function handleFieldChange(key, field, value) {
    setProposedImages((previous) =>
      previous.map((image) => (image._key === key ? { ...image, [field]: value } : image))
    );
    clearStatuses();
  }

  // Resets back to whatever was last actually saved (or, if nothing has
  // been saved yet this session, the original published/draft seed) —
  // never talks to a server. Mirrors SocialLinksEditor's handleCancel.
  // Single-Section Editing UX sprint — also exits edit mode, returning to
  // the read-only published view, same as Social/SEO's Cancel.
  function handleReset() {
    setProposedImages(savedImages);
    setSaveDraftStatus("idle");
    setSaveDraftError(null);
    setIsEditing(false);
  }

  // Single-Section Editing UX sprint — the only place this component enters
  // edit mode on its own. Purely local UI state, never an API call: no
  // TalentGalleryImage row is created or touched until Save Draft fires.
  function handleStartEditing() {
    setIsEditing(true);
  }

  // Still local-only, never persisted — see this file's header comment.
  function handleRemove(index) {
    setProposedImages((previous) => previous.filter((_, i) => i !== index));
    clearStatuses();
  }

  // Gallery UX Polish sprint — dnd-kit's <DndContext> fires this once a
  // drag ends with a valid drop target. `active`/`over` carry the dragged/
  // target item's sortable `id`, which is each image's `_key` (see
  // <SortableContext>'s `items` in the render below) — arrayMove produces
  // the new order, exactly equivalent to the old index-swap handleMove,
  // since toComparablePayload still derives `order` from array position
  // either way.
  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setProposedImages((previous) => {
      const oldIndex = previous.findIndex((image) => image._key === active.id);
      const newIndex = previous.findIndex((image) => image._key === over.id);
      if (oldIndex === -1 || newIndex === -1) return previous;
      return arrayMove(previous, oldIndex, newIndex);
    });
    clearStatuses();
  }

  // Gallery UX Polish sprint — uploads every selected/dropped file
  // sequentially via the existing /api/admin/assets/upload route (one POST
  // per file, same FormData shape Gallery Upload Sprint 2 introduced), so
  // no backend change is needed to support multiple files. Sequential
  // (rather than parallel) keeps each new row's `order`/`mobileOrder`
  // default (current proposed-list length) race-free, and means a failure
  // partway through never aborts the files still queued behind it.
  async function handleSelectFiles(files) {
    // `canUpload` is a courtesy guard only — the upload route independently
    // refuses with 503 when uploads are unavailable in this environment.
    if (!canUpload || !files || files.length === 0) return;

    const queueItems = files.map((file) => ({
      clientId: `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fileName: file.name,
      file,
      status: "uploading",
      error: null,
    }));

    setUploadQueue((previous) => [...previous, ...queueItems]);
    clearStatuses();

    for (const item of queueItems) {
      await uploadQueueItem(item);
    }
  }

  // One file's upload. On success, appends the result straight into the
  // in-memory proposed grid (no id yet, just imageAssetId — see
  // toComparablePayload's header comment for how Save Draft turns this
  // into a real row) and removes this file from the queue. On failure,
  // flips just this file's queue entry to "error" — every other file in
  // the same batch keeps uploading/succeeding independently.
  async function uploadQueueItem(item) {
    try {
      const formData = new FormData();
      formData.append("file", item.file);
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
      setUploadQueue((previous) => previous.filter((queued) => queued.clientId !== item.clientId));
    } catch (error) {
      setUploadQueue((previous) =>
        previous.map((queued) =>
          queued.clientId === item.clientId
            ? { ...queued, status: "error", error: error?.message || he.gallery.uploadGenericError }
            : queued
        )
      );
    }
  }

  // Removes one failed upload's placeholder card. Never touches any other
  // queued file or any already-completed image — see UploadingImageCard's
  // header comment.
  function dismissUploadItem(clientId) {
    setUploadQueue((previous) => previous.filter((item) => item.clientId !== clientId));
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

  // Owner Direct Publish UX sprint — POSTs to the new
  // app/api/admin/talent/[id]/gallery/publish/route.js, which composes the
  // *existing* galleryService.submit() (only for rows still DRAFT) and
  // galleryService.approve() (looped over every now-PROPOSED row) — no new
  // business logic, an OWNER-only route doing in one request what an Owner
  // clicking Submit then Approve on every row would already do today.
  async function handlePublishNow() {
    if (!hasPersistence || publishDisabled) return;

    setPublishStatus("publishing");
    setPublishError(null);

    try {
      const response = await fetch(`/api/admin/talent/${talentId}/gallery/publish`, {
        method: "POST",
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || he.editor.publish.error);
      }

      setPublishStatus("published");
      // Same reasoning as handleSubmit's router.refresh() above: a
      // successful publish changes the rows' status to PUBLISHED, which the
      // page's own pending-rows reads need to re-derive.
      router.refresh();
    } catch (error) {
      setPublishStatus("error");
      setPublishError(error?.message || he.editor.publish.error);
    }
  }

  return (
    <div className={styles.tokens}>
      <RejectedGalleryImagesNotice talentId={talentId} rejectedImages={unresolvedRejectedImages} />

      {/*
       * Single-Section Editing UX sprint — one section, one mode at a time,
       * mirroring ComparisonView/SocialLinksEditor's pattern exactly. The
       * grid itself (PublishedMediaGrid vs. the DnD-editable grid) is the
       * part that swaps; per-image zoom/drag positioning inside each cell is
       * explicitly out of scope this sprint (see GalleryImageCard, unchanged)
       * — only the section-level view/edit toggle changes here.
       */}
      <section
        className={isEditing ? styles.proposedSection : styles.publishedSection}
        aria-label={isEditing ? he.gallery.proposedEyebrowTitle : he.gallery.publishedEyebrowTitle}
      >
        <header className={styles.eyebrow}>
          <span className={styles.eyebrowIcon} aria-hidden="true">
            {isEditing ? he.gallery.proposedEyebrowIcon : he.gallery.publishedEyebrowIcon}
          </span>
          <span className={isEditing ? styles.eyebrowTitleProposed : styles.eyebrowTitle}>
            {isEditing ? he.gallery.proposedEyebrowTitle : he.gallery.publishedEyebrowTitle}
          </span>
        </header>
        <p className={isEditing ? styles.proposedSubtitle : styles.publishedSubtitle}>
          {isEditing ? he.gallery.proposedSubtitle : he.gallery.publishedSubtitle}
        </p>

        {isEditing && !uploadsEnabled ? (
          // Pre-merge blocker fix sprint (QA finding #1) — clear Hebrew
          // notice that uploads are unavailable in this environment; the
          // AddImageCard below renders as its inert placeholder
          // (onSelectFiles null) rather than a working dropzone.
          <div className={styles.previewNotice} role="note">
            <p className={styles.previewNoticeBody}>{he.gallery.errors.uploadsDisabled}</p>
          </div>
        ) : null}

        {isEditing ? (
          proposedImages.length === 0 && uploadQueue.length === 0 ? (
            <EmptyState
              title={emptyProposedTitle}
              description={emptyProposedDescription}
              action={
                <AddImageCard
                  className={styles.emptyProposedAction}
                  onSelectFiles={canUpload ? handleSelectFiles : null}
                />
              }
            />
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={proposedImages.map((image) => image._key)}
                strategy={rectSortingStrategy}
              >
                <div className={styles.proposedGrid}>
                  {proposedImages.map((image, index) => (
                    <GalleryImageCard
                      key={image._key}
                      image={image}
                      onChange={(field, value) => handleFieldChange(image._key, field, value)}
                      onRemove={() => handleRemove(index)}
                    />
                  ))}
                  {uploadQueue.map((item) => (
                    <UploadingImageCard
                      key={item.clientId}
                      fileName={item.fileName}
                      status={item.status}
                      error={item.error}
                      onDismiss={() => dismissUploadItem(item.clientId)}
                    />
                  ))}
                  <AddImageCard onSelectFiles={canUpload ? handleSelectFiles : null} />
                </div>
              </SortableContext>
            </DndContext>
          )
        ) : (
          <PublishedMediaGrid
            images={publishedImages}
            emptyTitle={emptyPublishedTitle}
            emptyDescription={emptyPublishedDescription}
          />
        )}
      </section>

      {isEditing ? (
        <>
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
            onPublish={handlePublishNow}
            showSaveDraft={hasPersistence}
            showSubmit={hasPersistence && !isOwner}
            showPublish={hasPersistence && isOwner}
            saveDraftDisabled={saveDraftDisabled}
            saveDraftDisabledReason={saveDraftDisabledReason}
            saveDraftStatus={saveDraftStatus}
            saveDraftStatusMessage={saveDraftStatus === "error" ? saveDraftError : undefined}
            submitDisabled={submitDisabled}
            submitDisabledReason={submitDisabledReason}
            submitStatus={submitStatus}
            submitStatusMessage={submitStatus === "error" ? submitError : undefined}
            publishDisabled={publishDisabled}
            publishDisabledReason={publishDisabledReason}
            publishStatus={publishStatus}
            publishStatusMessage={publishStatus === "error" ? publishError : undefined}
          />
        </>
      ) : (
        <div className={styles.startEditingRow}>
          <PrimaryButton type="button" onClick={handleStartEditing}>
            {he.editor.actions.startEditing}
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}
