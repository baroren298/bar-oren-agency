/*
 * AddImageCard — Gallery Editor Foundation sprint, wired to a real upload by
 * Gallery Upload Sprint 2, rebuilt as a modern click-or-drop zone by the
 * Gallery UX Polish sprint.
 *
 * Was (through Gallery Upload Sprint 2): a single dashed-border button —
 * click to open a single-file picker, "מעלה..."/error text swapped in via
 * `uploading`/`error` props the caller owned.
 *
 * Is: a full click-or-drag-and-drop zone, multi-file from both paths
 * (`<input multiple>` for the picker, `event.dataTransfer.files` for a
 * drop), restricted to the same image mime types the upload route/
 * validation profile accept (lib/storage/utils/validationProfiles.js's
 * "gallery" profile: jpeg/png/webp) via the input's `accept` attribute —
 * advisory only; the server is still the real gatekeeper for every file.
 * `onSelectFiles(files: File[])` is called once with every file picked or
 * dropped in a single interaction; the caller (MediaGalleryEditor) owns
 * uploading each one, one request per file, against the unchanged
 * /api/admin/assets/upload route, and renders its own per-file progress/
 * error cards (UploadingImageCard) — this component never tracks upload
 * state itself anymore, only selection.
 *
 * Per this sprint's explicit scope: no bulk-upload redesign of the backend,
 * no crop/replace UI — `onSelectFiles` is omitted entirely (preview mode /
 * no talentId), so this renders exactly as before: disabled, with the
 * original "coming soon" tooltip.
 *
 * Entity-agnostic: no props about what kind of gallery it's appended to, so
 * the same card works for talent galleries, homepage media, or any other
 * future CMS image collection.
 *
 * Props:
 *   - className (string, optional)
 *   - onSelectFiles (function(File[]): void, optional) — when provided, the
 *     card becomes a real click-or-drop zone; when omitted, behaves exactly
 *     as the original disabled placeholder.
 */

import { useRef, useState } from "react";
import styles from "./AddImageCard.module.css";
import { he } from "@/lib/admin/i18n/he";

const ACCEPTED_MIME_TYPES = "image/jpeg,image/png,image/webp";

export default function AddImageCard({ className = "", onSelectFiles = null }) {
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  if (!onSelectFiles) {
    return (
      <button
        type="button"
        className={`${styles.tokens} ${styles.card} ${className}`}
        disabled
        title={he.gallery.addImageComingSoon}
      >
        <span className={styles.label}>{he.gallery.actions.addImage}</span>
      </button>
    );
  }

  function openPicker() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event) {
    const files = event.target.files;
    // Reset immediately so re-picking the same file(s) still fires onChange
    // (browsers otherwise treat re-selecting an identical path as a no-op).
    event.target.value = "";
    if (files && files.length > 0) {
      onSelectFiles(Array.from(files));
    }
  }

  function handleDragOver(event) {
    // Required so the browser allows a drop here instead of opening/
    // navigating to the dragged file.
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
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      onSelectFiles(Array.from(files));
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  }

  return (
    <div
      className={`${styles.tokens} ${styles.card} ${styles.dropzone} ${
        isDragOver ? styles.dropzoneActive : ""
      } ${className}`}
      role="button"
      tabIndex={0}
      aria-label={he.gallery.actions.uploadImage}
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <span className={styles.dropzoneIcon} aria-hidden="true">
        📷
      </span>
      <span className={styles.dropzoneLabel}>{he.gallery.actions.dropHint}</span>
      <span className={styles.dropzoneOr}>{he.gallery.actions.or}</span>
      <span className={styles.dropzoneLabel}>{he.gallery.actions.uploadImage}</span>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_MIME_TYPES}
        multiple
        className={styles.hiddenInput}
        onChange={handleFileChange}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
