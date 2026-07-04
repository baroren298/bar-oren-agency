"use client";

/*
 * ImageAssetEditor — Profile Image Management sprint.
 *
 * Reuse boundary note (architecture self-review follow-up): like
 * ImageEditorCard (which it composes), this is a single-image *composite*
 * — a "Current Published vs Proposed" pair for exactly one image. It is
 * NOT suitable for a multi-image grid such as Gallery Upload. A future
 * Gallery rebuild should compose the reusable atoms (ImageUploadArea,
 * ImagePreview, ImagePositionControls, useImageAssetUpload) directly per
 * grid cell, rather than assuming this component or ImageEditorCard scale
 * up to "many images."
 *
 * The top-level reusable "Current Published image vs Proposed image"
 * editing surface. Mirrors the visual language ComparisonView.jsx already
 * established for text/list/boolean fields (🌍 published eyebrow on a
 * calm, unboxed section / ✏️ proposed eyebrow on a tinted, elevated
 * section) — the same precedent MediaGalleryEditor.jsx already follows for
 * image grids — rather than routing image editing through ComparisonView's
 * generic scalar-field diffing engine, which has no notion of an
 * object-valued field with upload/position/scale semantics.
 *
 * Entity-agnostic: takes a published value and a proposed value/setter,
 * nothing about talent/draft/publish/IDs. ProfileImagePanel (today) and any
 * future Cover Image / Hero Image single-image module compose this the
 * same way TalentDetailsEditor composes ComparisonView.
 *
 * Props:
 *   - publishedValue ({ assetUrl, position, scale } | null)
 *   - proposedValue ({ assetUrl, position, scale } | null)
 *   - onProposedChange (function(nextValue): void)
 *   - purpose (string) — forwarded to ImageEditorCard, e.g. "profile"
 *   - disabled (boolean, optional) — no editable draft yet
 *   - aspectRatio (string, optional, default "3 / 4")
 *   - defaultPosition (string, optional)
 *   - defaultScale (number, optional, default 1) — forwarded to
 *     ImageEditorCard; applied as a brand-new upload's initial framing.
 *   - alt (string, optional) — accessible label for both preview frames
 *   - copy ({ viewEyebrowIcon, viewEyebrowTitle, viewSubtitle,
 *       editingEyebrowIcon, editingEyebrowTitle, editingSubtitle, noImage,
 *       uploadArea, preview, positionControls, disabledHint, errors })
 *     — sourced from he.media.* today.
 *
 * Single-Section Editing UX sprint: `showPositionGrid` is gone along with
 * the 3×3 grid it gated — see ImagePositionControls' header comment.
 *
 * Talent Detail UX Refactor, Phase 2 — collapsed from the old simultaneous
 * "Current Published image" + "Proposed image" two-section layout into a
 * single section that switches between a read-only preview and the
 * upload/zoom editing surface, mirroring exactly what ComparisonView.jsx did
 * for scalar fields in Phase 1 (see that file's header comment).
 *
 * `isEditing` is derived from `!disabled` rather than a new prop:
 * ProfileImagePanel already only passes `disabled={false}` when the caller
 * resolved an editable DRAFT/PROPOSED version (`versionId` truthy) — the
 * exact same signal the old proposed frame's "inert card" state used, just
 * read as a real mode switch instead. When `isEditing` is false, the section
 * shows the published image, read-only, via the same ImagePreview atom this
 * file already used for the old published frame. When `isEditing` is true,
 * it renders the exact same ImageEditorCard the old proposed frame used,
 * seeded from `proposedValue` exactly as before (ProfileImagePanel already
 * seeds that from a saved pending image when one exists, falling back to
 * published) — so resuming an existing Draft/Proposed still shows its image,
 * not the published one. There is no separate "Current Published" or
 * "Proposed Update" copy anywhere in this mode; that comparison framing is
 * intentionally left to GalleryOwnerReview/SocialLinksOwnerReview-style
 * review surfaces, which this component still does not render.
 */

import ImagePreview from "./ImagePreview";
import ImageEditorCard from "./ImageEditorCard";
import styles from "./ImageAssetEditor.module.css";

export default function ImageAssetEditor({
  publishedValue = null,
  proposedValue = null,
  onProposedChange,
  purpose,
  disabled = false,
  // Pre-merge blocker fix sprint (QA finding #1) — forwarded straight to
  // ImageEditorCard: blocks only the file-upload surface (environment has
  // no working storage provider), never position/zoom editing.
  uploadDisabled = false,
  aspectRatio = "3 / 4",
  defaultPosition = "center center",
  defaultScale = 1,
  alt = "",
  copy = {},
}) {
  const isEditing = !disabled;
  const sectionIcon = isEditing ? copy.editingEyebrowIcon : copy.viewEyebrowIcon;
  const sectionTitle = isEditing ? copy.editingEyebrowTitle : copy.viewEyebrowTitle;
  const sectionSubtitle = isEditing ? copy.editingSubtitle : copy.viewSubtitle;

  return (
    <div className={styles.editor}>
      <section className={isEditing ? styles.proposedSection : styles.publishedSection} aria-label={sectionTitle}>
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowIcon} aria-hidden="true">
            {sectionIcon}
          </span>
          <p className={isEditing ? styles.eyebrowTitleProposed : styles.eyebrowTitle}>{sectionTitle}</p>
        </div>
        {sectionSubtitle ? (
          <p className={isEditing ? styles.proposedSubtitle : styles.publishedSubtitle}>{sectionSubtitle}</p>
        ) : null}

        {isEditing ? (
          <ImageEditorCard
            value={proposedValue}
            onChange={onProposedChange}
            purpose={purpose}
            disabled={disabled}
            uploadDisabled={uploadDisabled}
            aspectRatio={aspectRatio}
            defaultPosition={defaultPosition}
            defaultScale={defaultScale}
            copy={copy}
          />
        ) : (
          <ImagePreview
            src={publishedValue?.assetUrl || null}
            alt={alt}
            position={publishedValue?.position}
            scale={publishedValue?.scale}
            aspectRatio={aspectRatio}
            placeholderText={copy.noImage || ""}
            className={styles.publishedPreview}
          />
        )}
      </section>
    </div>
  );
}
