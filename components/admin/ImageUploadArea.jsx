"use client";

/*
 * ImageUploadArea — Profile Image Management sprint.
 *
 * Reuse boundary note (architecture self-review follow-up): this is a
 * reusable *atom*, not a composite — it has no opinion about how many
 * images a caller manages or what layout they sit in. A future Gallery
 * Upload rebuild should use this component directly (with `multiple`),
 * not assume the single-image ImageEditorCard/ImageAssetEditor composites
 * are the way to get here.
 *
 * Entity-agnostic click-or-drag-and-drop file chooser. Same interaction
 * shape as Gallery's AddImageCard (click opens the OS file picker, dropping
 * a file onto the zone works too, clear drag-over feedback) but decoupled
 * from AddImageCard's grid-tile presentation, so it can be dropped into any
 * layout — a single-image "Replace Image" zone (Profile Image, Cover
 * Image, Hero Image, ...) as well as, later, a multi-file zone (Gallery
 * Upload) just by passing `multiple`.
 *
 * Pure selection/drop UI — no fetch, no validation, no knowledge of upload
 * "purpose" or any entity. The caller (ImageEditorCard today) owns what
 * happens to the file(s) once selected.
 *
 * Props:
 *   - onSelectFiles (function(File[]): void) — called once per click-pick
 *     or drop with every file involved
 *   - accept (string, optional) — passed straight to <input accept>
 *   - multiple (boolean, optional, default false)
 *   - disabled (boolean, optional, default false) — no editable draft to
 *     attach an upload to; renders inert with `disabledHint` instead of the
 *     normal copy
 *   - busy (boolean, optional, default false) — an upload is in flight;
 *     stays clickable-looking but shows `busyLabel` instead of the normal
 *     copy and ignores further drops/clicks
 *   - dropLabel / orLabel / chooseLabel / busyLabel / dragActiveLabel /
 *     disabledHint (strings) — all caller-supplied copy, so this component
 *     carries no i18n assumption of its own
 *   - className (string, optional)
 */

import { useRef, useState } from "react";
import styles from "./ImageUploadArea.module.css";

export default function ImageUploadArea({
  onSelectFiles,
  accept = "image/jpeg,image/png,image/webp",
  multiple = false,
  disabled = false,
  busy = false,
  dropLabel = "Drag image here",
  orLabel = "or",
  chooseLabel = "Choose Image",
  busyLabel = "Uploading…",
  dragActiveLabel = "Drop here to upload",
  disabledHint = "",
  className = "",
}) {
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const isInteractive = !disabled && !busy;

  function openPicker() {
    if (!isInteractive) return;
    fileInputRef.current?.click();
  }

  function handleFileChange(event) {
    const files = event.target.files;
    // Reset immediately so re-picking the same file still fires onChange.
    event.target.value = "";
    if (files && files.length > 0) {
      onSelectFiles(Array.from(files));
    }
  }

  function handleDragOver(event) {
    if (!isInteractive) return;
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
    if (!isInteractive) return;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      onSelectFiles(Array.from(files));
    }
  }

  return (
    <div
      className={`${styles.tokens} ${styles.zone} ${isDragOver ? styles.zoneDragOver : ""} ${
        disabled ? styles.zoneDisabled : ""
      } ${className}`}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {disabled ? (
        <p className={styles.disabledHint}>{disabledHint}</p>
      ) : (
        <>
          <span className={styles.icon} aria-hidden="true">
            🖼️
          </span>
          <span className={styles.label}>
            {busy ? busyLabel : isDragOver ? dragActiveLabel : dropLabel}
          </span>
          {!busy ? (
            <>
              <span className={styles.or}>{orLabel}</span>
              <button type="button" className={styles.chooseButton} onClick={openPicker}>
                {chooseLabel}
              </button>
            </>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            className={styles.hiddenInput}
            onChange={handleFileChange}
            tabIndex={-1}
            aria-hidden="true"
            disabled={!isInteractive}
          />
        </>
      )}
    </div>
  );
}
