"use client";

/*
 * useImageAssetUpload — Profile Image Management sprint.
 *
 * Reuse boundary note (architecture self-review follow-up): this hook is a
 * reusable *atom* — it uploads exactly one file per call and tracks one
 * status/error pair. It is intentionally NOT the right hook to "just call
 * N times" for a Gallery-style multi-file grid with its own per-item
 * queue/ordering state (MediaGalleryEditor.jsx already owns that uploading
 * concern independently). A future Gallery Upload migration should still
 * be able to call this hook once per queued file to de-duplicate the
 * fetch/validate logic, but the per-item queue/state management stays with
 * the caller, not this hook.
 *
 * Reusable client-side logic for "pick/drop a file → validate it → upload
 * it to the shared /api/admin/assets/upload endpoint → get back an asset".
 * Deliberately has no opinion about UI: ImageEditorCard (or any future
 * image module) drives a dropzone/preview and calls `upload(file)`; this
 * hook owns status/error state and the fetch.
 *
 * Pre-flight validation mirrors the server's per-purpose profile
 * (lib/storage/utils/validationProfiles.js) so obviously-invalid files are
 * rejected instantly with a friendly message instead of round-tripping to
 * the server first — the server still re-validates, this is just UX.
 *
 * Params:
 *   - purpose (string) — forwarded to validationProfiles + the upload
 *     endpoint, e.g. "profile" today, "gallery"/"cover"/"hero" later.
 *   - copy ({ invalidType, tooLarge(maxMb), genericUploadError, networkError })
 *     — all error strings supplied by the caller (sourced from
 *     he.media.errors.* today) so this hook carries no i18n of its own.
 *
 * Returns:
 *   - status: "idle" | "uploading" | "error"
 *   - error: string|null
 *   - upload(file): Promise<{ asset } | null> — resolves with the created
 *     asset on success, or null if validation/upload failed (error state
 *     is set as a side effect; caller doesn't need to also branch on the
 *     return value, but can for control flow).
 *   - reset(): void — back to idle/no error.
 */

import { useState } from "react";
import { getValidationProfile } from "@/lib/storage/utils/validationProfiles";

export function useImageAssetUpload(purpose, copy = {}) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  function reset() {
    setStatus("idle");
    setError(null);
  }

  function validate(file) {
    let profile;
    try {
      profile = getValidationProfile(purpose);
    } catch {
      return null; // unknown purpose is a programming error, not a user-facing one
    }
    if (!profile.allowedMimeTypes.includes(file.type)) {
      return copy.invalidType || "Unsupported file type.";
    }
    if (file.size > profile.maxBytes) {
      const maxMb = Math.round(profile.maxBytes / (1024 * 1024));
      return typeof copy.tooLarge === "function" ? copy.tooLarge(maxMb) : `File is too large (max ${maxMb}MB).`;
    }
    return null;
  }

  async function upload(file) {
    const validationError = validate(file);
    if (validationError) {
      setStatus("error");
      setError(validationError);
      return null;
    }

    setStatus("uploading");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("purpose", purpose);

      const response = await fetch("/api/admin/assets/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.asset) {
        setStatus("error");
        setError(data?.error || copy.genericUploadError || "Upload failed. Please try again.");
        return null;
      }

      setStatus("idle");
      return data;
    } catch {
      setStatus("error");
      setError(copy.networkError || "Network error — check your connection and try again.");
      return null;
    }
  }

  return { status, error, upload, reset };
}

export default useImageAssetUpload;
