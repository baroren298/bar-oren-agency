"use client";

/*
 * NewTalentForm — Add New Talent flow, revised per product decision:
 * creating a talent must NOT publish it directly.
 *
 * Create Talent Sprint 1: widened from the three original fields (Hebrew
 * name, English name, slug) to also collect Profile Image and Short Bio
 * (Hebrew) — the two fields this sprint adds, per the sprint brief's exact
 * field list. Nothing else (gallery, socials, SEO, podcast, categories,
 * advanced settings) is collected here, by design — those stay on the
 * talent detail page (TalentDetailsEditor), filled in afterward, before the
 * normal Draft -> Proposed -> Approve -> Publish workflow applies.
 *
 * Plain create form (not <ComparisonView> — there is nothing to compare
 * against yet, this is the talent's very first version, created as a
 * DRAFT). Owns all local form state, client-side validation (a
 * fast-feedback mirror of the server's real validation in
 * app/api/admin/talent/route.js — the server is still the actual
 * authority), the POST request, and Hebrew error display.
 *
 * Profile image upload reuses the existing, unmodified upload
 * infrastructure exactly the way MediaGalleryEditor does: a direct POST to
 * /api/admin/assets/upload (multipart, `file` + `purpose`), here with
 * `purpose=profile` (lib/storage/utils/validationProfiles.js) instead of
 * `purpose=gallery`. The upload happens immediately on file selection,
 * before Save Draft — by the time the talent-create POST fires, it only
 * ever sends an already-uploaded Asset's id (`profileImageAssetId`), never
 * a file. No new upload code, no new storage code — only this form's own
 * upload-state bookkeeping (uploading / preview / remove) is new.
 *
 * Create Talent Screen Polish sprint — the profile image control was
 * rebuilt as a single click-or-drop zone (empty state) that's fully
 * replaced by a large image preview + two text actions, "החלף תמונה" /
 * "הסר תמונה" (filled state), mirroring AddImageCard.jsx's drag/drop
 * interaction pattern without importing it directly (that component has no
 * "replace an already-uploaded single image" mode — it's built for
 * appending to a multi-image gallery grid). "Replace" re-opens the file
 * picker and uploads a new file over the current one; "Remove" just clears
 * local state. Neither calls any delete/cleanup endpoint — per this
 * sprint's explicit instruction, an orphaned profile-image Asset row after
 * replace/remove is accepted for now, not handled here.
 *
 * On success: redirects to /admin/talent/[id] (the new talent's detail
 * page), per the product decision.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PrimaryButton from "@/components/admin/PrimaryButton";
import SecondaryButton from "@/components/admin/SecondaryButton";
import { he } from "@/lib/admin/i18n/he";
import styles from "./new-talent.module.css";

const COPY = he.talent.create;
const UPLOAD_ERRORS = he.gallery.errors;

// Mirrors the server's SLUG_PATTERN (app/api/admin/talent/route.js) — a
// fast client-side check only; the server re-validates regardless.
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Mirrors validationProfiles.js's "profile" entry — advisory only, the
// upload route/assetService are still the real gatekeeper.
const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";

const EMPTY_FORM = {
  name: "",
  nameEn: "",
  slug: "",
  bioHe: "",
};

// Pre-merge blocker fix sprint (QA finding #1) — `uploadsEnabled` is
// computed server-side (lib/storage/availability.js, via page.jsx) and
// passed in: false when the active storage provider is `local` in a
// production build. Only the profile-image upload zone is gated (replaced
// by a Hebrew notice); every other field and the create action itself keep
// working — a talent can be created without a photo and get one later,
// once cloud storage exists. The upload route re-checks server-side (503).
export default function NewTalentForm({ uploadsEnabled = true }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  // Profile image upload state — separate from `form` because it tracks an
  // already-uploaded Asset (id + preview URL), not raw form input. `null`
  // means "no image chosen" (allowed — Profile Image is optional this
  // sprint).
  const fileInputRef = useRef(null);
  const [profileImageAssetId, setProfileImageAssetId] = useState(null);
  const [profileImagePreviewUrl, setProfileImagePreviewUrl] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState(null);
  const [isImageDragOver, setIsImageDragOver] = useState(false);

  function updateField(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
    setFieldErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  function openImagePicker() {
    fileInputRef.current?.click();
  }

  async function uploadProfileImage(file) {
    // Courtesy guard only — the upload route independently refuses with
    // 503 when uploads are unavailable in this environment.
    if (!uploadsEnabled) return;
    if (!file) return;

    setImageUploadError(null);
    setImageUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("purpose", "profile");

      const response = await fetch("/api/admin/assets/upload", {
        method: "POST",
        body: formData,
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setImageUploadError(body.error || UPLOAD_ERRORS.serverError);
        setImageUploading(false);
        return;
      }

      // A "replace" upload simply overwrites the previous asset id/preview
      // in local state — the previous Asset row is left as-is server-side
      // (no delete/cleanup call here; an orphaned row is accepted for now,
      // per this sprint's scope).
      setProfileImageAssetId(body.asset.id);
      setProfileImagePreviewUrl(body.asset.blobUrl);
      setImageUploading(false);
    } catch {
      setImageUploadError(UPLOAD_ERRORS.networkError);
      setImageUploading(false);
    }
  }

  function handleImageFileChange(event) {
    const file = event.target.files?.[0];
    // Reset immediately so re-picking the same file still fires onChange.
    event.target.value = "";
    uploadProfileImage(file);
  }

  function handleImageDragOver(event) {
    // Required so the browser allows a drop here instead of opening/
    // navigating to the dragged file.
    event.preventDefault();
    if (!imageUploading) setIsImageDragOver(true);
  }

  function handleImageDragLeave(event) {
    event.preventDefault();
    setIsImageDragOver(false);
  }

  function handleImageDrop(event) {
    event.preventDefault();
    setIsImageDragOver(false);
    if (imageUploading) return;
    const file = event.dataTransfer?.files?.[0];
    uploadProfileImage(file);
  }

  function handleImageDropzoneKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openImagePicker();
    }
  }

  function removeProfileImage() {
    setProfileImageAssetId(null);
    setProfileImagePreviewUrl(null);
    setImageUploadError(null);
  }

  function validateClientSide() {
    const errors = {};
    if (!form.name.trim()) errors.name = COPY.errors.nameRequired;

    const slug = form.slug.trim().toLowerCase();
    if (!slug) {
      errors.slug = COPY.errors.slugRequired;
    } else if (!SLUG_PATTERN.test(slug)) {
      errors.slug = COPY.errors.slugInvalid;
    }

    return errors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);

    const errors = validateClientSide();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError(COPY.errors.validationSummary);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/talent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          nameEn: form.nameEn.trim() || null,
          slug: form.slug.trim().toLowerCase(),
          bioHe: form.bioHe.trim() || null,
          profileImageAssetId,
        }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFieldErrors(body.fieldErrors || {});
        setFormError(body.error || COPY.errors.serverError);
        setSubmitting(false);
        return;
      }

      setSucceeded(true);
      router.push(`/admin/talent/${body.talent.id}`);
    } catch {
      setFormError(COPY.errors.networkError);
      setSubmitting(false);
    }
  }

  return (
    <form className={`${styles.tokens} ${styles.form}`} onSubmit={handleSubmit}>
      {formError ? (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      ) : null}

      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{COPY.fields.name}</span>
          <input
            type="text"
            className={styles.input}
            value={form.name}
            placeholder={COPY.fields.namePlaceholder}
            onChange={(event) => updateField("name", event.target.value)}
          />
          {fieldErrors.name ? <span className={styles.fieldError}>{fieldErrors.name}</span> : null}
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{COPY.fields.nameEn}</span>
          <input
            type="text"
            dir="ltr"
            className={styles.input}
            value={form.nameEn}
            placeholder={COPY.fields.nameEnPlaceholder}
            onChange={(event) => updateField("nameEn", event.target.value)}
          />
          {fieldErrors.nameEn ? <span className={styles.fieldError}>{fieldErrors.nameEn}</span> : null}
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{COPY.fields.slug}</span>
          <input
            type="text"
            dir="ltr"
            className={styles.input}
            value={form.slug}
            placeholder={COPY.fields.slugPlaceholder}
            onChange={(event) => updateField("slug", event.target.value)}
          />
          <span className={styles.fieldHelper}>{COPY.fields.slugHelper}</span>
          {form.slug.trim() ? (
            <span className={styles.slugPreview} dir="ltr">
              {COPY.fields.slugPreviewPrefix}
              {form.slug.trim().toLowerCase()}
            </span>
          ) : null}
          {fieldErrors.slug ? <span className={styles.fieldError}>{fieldErrors.slug}</span> : null}
        </label>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>{COPY.fields.profileImage}</span>

          {!uploadsEnabled ? (
            // Pre-merge blocker fix sprint (QA finding #1) — uploads are
            // unavailable in this environment; show the notice instead of
            // a dropzone that could only fail. The rest of the form is
            // untouched.
            <span className={styles.fieldHelper} role="note">
              {UPLOAD_ERRORS.uploadsDisabled}
            </span>
          ) : profileImagePreviewUrl ? (
            // Filled state: the dropzone is gone entirely, replaced by a
            // large preview and exactly two text actions — no leftover
            // empty placeholder alongside it.
            <div className={styles.imagePreviewBlock}>
              <div className={styles.imagePreviewFrame}>
                <img
                  src={profileImagePreviewUrl}
                  alt={COPY.fields.profileImageAlt}
                  className={styles.imagePreview}
                />
                {imageUploading ? (
                  <div className={styles.imagePreviewOverlay} aria-hidden="true">
                    <span className={styles.spinner} />
                  </div>
                ) : null}
              </div>
              <div className={styles.imagePreviewActions}>
                <button
                  type="button"
                  className={styles.imageActionLink}
                  onClick={openImagePicker}
                  disabled={imageUploading}
                >
                  {COPY.fields.profileImageReplace}
                </button>
                <span className={styles.imageActionDivider} aria-hidden="true">
                  ·
                </span>
                <button
                  type="button"
                  className={styles.imageActionLink}
                  onClick={removeProfileImage}
                  disabled={imageUploading}
                >
                  {COPY.fields.profileImageRemove}
                </button>
              </div>
            </div>
          ) : (
            // Empty state: a single click-or-drop zone — no separate
            // button, no placeholder frame.
            <div
              className={`${styles.imageDropzone} ${isImageDragOver ? styles.imageDropzoneActive : ""} ${
                imageUploading ? styles.imageDropzoneUploading : ""
              }`}
              role="button"
              tabIndex={0}
              aria-label={COPY.fields.profileImageUpload}
              onClick={imageUploading ? undefined : openImagePicker}
              onKeyDown={handleImageDropzoneKeyDown}
              onDragEnter={handleImageDragOver}
              onDragOver={handleImageDragOver}
              onDragLeave={handleImageDragLeave}
              onDrop={handleImageDrop}
            >
              {imageUploading ? (
                <>
                  <span className={styles.spinner} aria-hidden="true" />
                  <span className={styles.imageDropzoneLabel}>{COPY.fields.profileImageUploading}</span>
                </>
              ) : (
                <>
                  <span className={styles.imageDropzoneIcon} aria-hidden="true">
                    📷
                  </span>
                  <span className={styles.imageDropzoneLabel}>{COPY.fields.profileImageDropHint}</span>
                  <span className={styles.imageDropzoneOr}>{COPY.fields.profileImageOr}</span>
                  <span className={styles.imageDropzoneLabel}>{COPY.fields.profileImageUpload}</span>
                </>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES}
            className={styles.hiddenInput}
            onChange={handleImageFileChange}
            tabIndex={-1}
            aria-hidden="true"
          />

          <span className={styles.fieldHelper}>{COPY.fields.profileImageHint}</span>
          {imageUploadError ? <span className={styles.fieldError}>{imageUploadError}</span> : null}
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{COPY.fields.bioHe}</span>
          <textarea
            className={styles.textarea}
            rows={4}
            value={form.bioHe}
            placeholder={COPY.fields.bioHePlaceholder}
            onChange={(event) => updateField("bioHe", event.target.value)}
          />
        </label>
      </div>

      <div className={styles.actions}>
        <SecondaryButton type="button" onClick={() => router.push("/admin/talent")}>
          {COPY.cancel}
        </SecondaryButton>
        <PrimaryButton type="submit" disabled={submitting || succeeded}>
          {submitting ? COPY.submitting : succeeded ? COPY.successRedirecting : COPY.submit}
        </PrimaryButton>
      </div>
    </form>
  );
}
