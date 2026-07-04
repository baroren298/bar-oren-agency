"use client";

/*
 * ImageEditorCard — Profile Image Management sprint.
 *
 * Reuse boundary note (architecture self-review follow-up): this is a
 * single-image *composite* — it bundles upload + one value + position
 * controls into one fixed layout for "replace this one image" use cases
 * (Profile Image today; Cover/Hero Image later). It is NOT the right
 * building block for a multi-image grid like Gallery Upload — a future
 * Gallery rebuild should compose ImageUploadArea + useImageAssetUpload +
 * ImagePreview + ImagePositionControls directly (those four are the
 * reusable atoms), not wrap this component around a grid of images.
 *
 * The "smart" half of the reusable image stack: composes ImageUploadArea
 * (pick/drop) + useImageAssetUpload (validate/upload) + ImagePreview
 * (render) + ImagePositionControls (zoom/position) into the single
 * "proposed image" editing surface. Entity-agnostic — it knows nothing
 * about talent/draft/publish, only about "here is the current value
 * {assetUrl, position, scale}, let the user replace/reposition it, tell
 * the parent what changed."
 *
 * Local optimistic preview: while a file is uploading, the just-picked
 * file is shown via a local object URL so the user sees their photo
 * instantly rather than waiting on the network. Once the parent confirms
 * the real asset URL is in `value.assetUrl` (i.e. the upload round-trip is
 * fully reflected back), the local object URL is revoked and dropped —
 * it is never kept around "just in case" for the rest of the session. On
 * a failed upload, the object URL is revoked immediately rather than left
 * for a later cleanup.
 *
 * Props:
 *   - value ({ assetUrl, position, scale } | null) — the current proposed
 *     image; assetUrl null means "no image yet".
 *   - onChange (function({ assetUrl, assetId, position, scale }): void) —
 *     called once an upload finishes (assetId included so the caller can
 *     decide what to persist) and again on every position/scale tweak
 *     (assetId omitted — caller should leave any already-known id alone).
 *     On a successful new upload, position/scale are reset to
 *     `defaultPosition`/`defaultScale` rather than carrying over whatever
 *     crop the previous image had — a brand-new photo gets a fresh default
 *     framing. Manual position/scale edits after that are untouched.
 *   - purpose (string) — forwarded to useImageAssetUpload, e.g. "profile".
 *   - disabled (boolean, optional) — no editable draft yet; the whole card
 *     renders inert with a hint instead of an uploader.
 *   - aspectRatio (string, optional, default "3 / 4")
 *   - defaultPosition (string, optional)
 *   - defaultScale (number, optional, default 1) — applied to a brand-new
 *     upload's initial framing, alongside defaultPosition.
 *   - copy ({ uploadArea: {...}, preview: { proposedLabel }, positionControls: {...}, errors: {...} })
 *
 * Single-Section Editing UX sprint: `showPositionGrid` is gone — the old
 * 3×3 keyword grid it gated has been removed entirely (see
 * ImagePositionControls' header comment). Positioning is now done by
 * dragging the live preview itself (ImagePreview's new `editable`/
 * `onPositionChange` props, wired below), so there is no longer a separate
 * "grid vs. no grid" mode to choose between.
 */

import { useEffect, useRef, useState } from "react";
import ImageUploadArea from "./ImageUploadArea";
import ImagePreview from "./ImagePreview";
import ImagePositionControls from "./ImagePositionControls";
import { useImageAssetUpload } from "@/lib/admin/hooks/useImageAssetUpload";
import styles from "./ImageEditorCard.module.css";

export default function ImageEditorCard({
  value = null,
  onChange,
  purpose,
  disabled = false,
  // Pre-merge blocker fix sprint (QA finding #1) — uploads unavailable in
  // this environment (local storage provider in production). Unlike
  // `disabled`, positioning/zoom of the existing image stays fully
  // editable; only the file-upload surface is inert, showing
  // `copy.uploadsDisabledHint`.
  uploadDisabled = false,
  aspectRatio = "3 / 4",
  defaultPosition = "center center",
  defaultScale = 1,
  copy = {},
}) {
  const { status, error, upload, reset } = useImageAssetUpload(purpose, copy.errors);
  const [localPreviewUrl, setLocalPreviewUrl] = useState(null);
  const objectUrlRef = useRef(null);
  // Tracks the asset URL we expect the parent to echo back in `value.assetUrl`
  // once it has processed the latest successful upload. Used to know exactly
  // when it's safe to drop the local object URL in favor of the real one,
  // without a visible flicker (both point at the same photo in the meantime).
  const pendingConfirmedUrlRef = useRef(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  // Once the parent's value reflects the asset URL we just uploaded, the
  // local blob preview has done its job — revoke it and let the real URL
  // take over. This is what stops the object URL from being retained for
  // the rest of the editing session.
  useEffect(() => {
    if (
      pendingConfirmedUrlRef.current &&
      value?.assetUrl === pendingConfirmedUrlRef.current &&
      objectUrlRef.current
    ) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
      pendingConfirmedUrlRef.current = null;
      setLocalPreviewUrl(null);
    }
  }, [value?.assetUrl]);

  // Cancel Editing (handled by the parent) flips `disabled` back on while
  // resetting the stored value — drop the optimistic local preview and any
  // stale upload error so re-entering edit mode starts clean.
  useEffect(() => {
    if (disabled) {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      pendingConfirmedUrlRef.current = null;
      setLocalPreviewUrl(null);
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  async function handleSelectFiles(files) {
    // Courtesy guard only — the upload route independently refuses with
    // 503 when uploads are unavailable (see app/api/admin/assets/upload).
    if (uploadDisabled) return;
    const file = files[0];
    if (!file) return;

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const nextObjectUrl = URL.createObjectURL(file);
    objectUrlRef.current = nextObjectUrl;
    pendingConfirmedUrlRef.current = null;
    setLocalPreviewUrl(nextObjectUrl);

    const result = await upload(file);
    if (result?.asset) {
      // A brand-new photo gets a fresh default framing rather than
      // inheriting whatever crop the previous image had. Remember which
      // URL we're waiting to see echoed back so the effect above can swap
      // off the local blob preview the moment it shows up, with no flicker.
      pendingConfirmedUrlRef.current = result.asset.blobUrl;
      onChange({
        assetUrl: result.asset.blobUrl,
        assetId: result.asset.id,
        position: defaultPosition,
        scale: defaultScale,
      });
    } else {
      // Upload failed — revoke the optimistic preview's object URL right
      // away (nothing left referencing it) and fall back to whatever the
      // parent still has as the current proposed value.
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      pendingConfirmedUrlRef.current = null;
      setLocalPreviewUrl(null);
    }
  }

  function handlePositionChange(nextPosition) {
    onChange({ ...value, position: nextPosition });
  }

  function handleScaleChange(nextScale) {
    onChange({ ...value, scale: nextScale });
  }

  const displayUrl = localPreviewUrl || value?.assetUrl || null;
  const isUploading = status === "uploading";

  return (
    <div className={styles.card}>
      <ImagePreview
        src={displayUrl}
        alt={copy.preview?.proposedLabel || ""}
        position={value?.position}
        scale={value?.scale}
        aspectRatio={aspectRatio}
        placeholderText={copy.uploadArea?.replaceHint || ""}
        className={styles.preview}
        editable={!disabled && !isUploading}
        onPositionChange={handlePositionChange}
        dragHint={copy.positionControls?.dragHint || ""}
      />

      <ImageUploadArea
        onSelectFiles={handleSelectFiles}
        disabled={disabled || uploadDisabled}
        busy={isUploading}
        dropLabel={copy.uploadArea?.dropHint}
        orLabel={copy.uploadArea?.or}
        chooseLabel={copy.uploadArea?.chooseImage}
        busyLabel={copy.uploadArea?.uploading}
        dragActiveLabel={copy.uploadArea?.dragActiveHint}
        disabledHint={
          // `disabled` (no editable draft) keeps its original hint;
          // otherwise an upload-only block shows the environment message.
          disabled ? copy.disabledHint : uploadDisabled ? copy.uploadsDisabledHint : copy.disabledHint
        }
      />

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {!disabled && displayUrl ? (
        <ImagePositionControls
          scale={value?.scale}
          onScaleChange={handleScaleChange}
          disabled={isUploading}
          labels={copy.positionControls || {}}
        />
      ) : null}
    </div>
  );
}
