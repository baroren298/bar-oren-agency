/*
 * UploadingImageCard — Gallery UX Polish sprint.
 *
 * A transient placeholder for one in-flight file in MediaGalleryEditor's
 * upload queue. Sits in the same grid track as GalleryImageCard/AddImageCard
 * (same card shell, same aspect-ratio image area) so the grid never jumps
 * around while several files upload — it just shows a spinner instead of an
 * image until the request settles.
 *
 * Multiple files are uploaded sequentially (see MediaGalleryEditor's
 * handleSelectFiles), each as its own request against the unchanged
 * /api/admin/assets/upload route — this card only reflects one file's
 * status:
 *   - "uploading": spinner + file name, nothing clickable.
 *   - "error": the server's error message (already a friendly Hebrew
 *     string — see he.gallery.errors.* / uploadGenericError) plus a dismiss
 *     button. Dismissing only removes this card from the queue; it never
 *     touches any other file's upload or any already-completed image.
 *
 * No props here ever reach into the save payload — a card only exists
 * before a TalentGalleryImage row does (or after one fails to be created),
 * so there is nothing for Save Draft to read from this component.
 *
 * Props:
 *   - fileName (string)
 *   - status ("uploading" | "error")
 *   - error (string, optional) — only meaningful when status === "error"
 *   - onDismiss (function, optional) — only rendered/used for "error"
 */

import styles from "./UploadingImageCard.module.css";
import { he } from "@/lib/admin/i18n/he";

export default function UploadingImageCard({ fileName, status, error = null, onDismiss = () => {} }) {
  const isError = status === "error";

  return (
    <div className={`${styles.tokens} ${styles.card}`}>
      <div className={`${styles.imageWrapper} ${isError ? styles.imageWrapperError : ""}`}>
        {isError ? (
          <span className={styles.errorIcon} aria-hidden="true">
            ⚠️
          </span>
        ) : (
          <span className={styles.spinner} aria-hidden="true" />
        )}
        <span className={styles.fileName} title={fileName}>
          {fileName}
        </span>
      </div>

      {isError ? (
        <div className={styles.errorRow}>
          <p className={styles.errorText} role="alert">
            {error || he.gallery.uploadGenericError}
          </p>
          <button type="button" className={styles.dismissButton} onClick={onDismiss}>
            {he.gallery.actions.dismissUpload}
          </button>
        </div>
      ) : (
        <p className={styles.uploadingLabel}>{he.gallery.actions.uploading}</p>
      )}
    </div>
  );
}
