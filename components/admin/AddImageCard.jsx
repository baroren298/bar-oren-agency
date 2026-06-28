/*
 * AddImageCard — Gallery Editor Foundation sprint, wired to a real upload
 * by Gallery Upload Sprint 2.
 *
 * Was (through Gallery Upload Sprint 1): UI groundwork only — no upload, no
 * file picker — rendered disabled with a "coming soon" tooltip, matching
 * EditorActionBar's existing disabled-button pattern.
 *
 * Is: when a caller supplies `onUpload`, this becomes the real "+ העלה
 * תמונה" affordance — a hidden file input behind a button, restricted to
 * the same image mime types the upload route/validation profile accept
 * (lib/storage/utils/validationProfiles.js's "gallery" profile: jpeg/png/
 * webp). Selecting a file calls `onUpload(file)`; the caller
 * (MediaGalleryEditor) owns the actual POST to
 * /api/admin/assets/upload and what happens with the result — this
 * component only renders the trigger and the uploading/error state handed
 * back to it via props, exactly like GalleryImageCard never owns the
 * network call for Save Draft.
 *
 * Per Gallery Upload Sprint 2's explicit scope: still no drag/drop, no
 * multi-file/bulk selection, no crop/replace UI — `onUpload` is omitted
 * entirely (preview mode / no talentId), so this renders exactly as before:
 * disabled, with the original "coming soon" tooltip.
 *
 * Entity-agnostic: no props about what kind of gallery it's appended to,
 * so the same card works for talent galleries, homepage media, or any
 * other future CMS image collection.
 *
 * Props:
 *   - className (string, optional)
 *   - onUpload (function(file): void, optional) — when provided, the card
 *     becomes a real upload trigger; when omitted, behaves exactly as the
 *     original disabled placeholder.
 *   - uploading (boolean, optional, default false) — caller is mid-upload;
 *     disables the trigger and swaps in the "מעלה..." label.
 *   - error (string, optional) — caller's last upload error, rendered
 *     beneath the card so a failed upload is never silent.
 */

import { useRef } from "react";
import styles from "./AddImageCard.module.css";
import { he } from "@/lib/admin/i18n/he";

const ACCEPTED_MIME_TYPES = "image/jpeg,image/png,image/webp";

export default function AddImageCard({ className = "", onUpload = null, uploading = false, error = null }) {
  const fileInputRef = useRef(null);

  if (!onUpload) {
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

  function handleFileChange(event) {
    const file = event.target.files && event.target.files[0];
    // Reset immediately so selecting the same file again still fires
    // onChange (browsers otherwise treat re-picking an identical path as a
    // no-op change event).
    event.target.value = "";
    if (file) {
      onUpload(file);
    }
  }

  return (
    <div className={styles.uploadWrapper}>
      <button
        type="button"
        className={`${styles.tokens} ${styles.card} ${styles.uploadCard} ${className}`}
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        aria-busy={uploading}
      >
        <span className={styles.label}>
          {uploading ? he.gallery.actions.uploading : he.gallery.actions.uploadImage}
        </span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_MIME_TYPES}
        className={styles.hiddenInput}
        onChange={handleFileChange}
        disabled={uploading}
        tabIndex={-1}
        aria-hidden="true"
      />
      {error ? (
        <p className={styles.uploadError} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
