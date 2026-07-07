"use client";

/*
 * GalleryImageCard — Gallery Editor Foundation sprint.
 *
 * A single image card inside the "Proposed Update" half of a gallery
 * editor (MediaGalleryEditor.jsx).
 *
 * Gallery Sprint 1 — adds real metadata-editing inputs (altHe, altEn,
 * position, scale, mobileOrder) via a new `onChange(field, value)` prop,
 * mirroring SocialAccountCard's onChange pattern. These fields are the
 * only thing that actually persists this sprint (through
 * MediaGalleryEditor's Save Draft / Submit) — Replace/Add/Upload remain
 * untouched and disabled, exactly as before.
 *
 * Gallery Upload Sprint 2 fix-up — the metadata inputs below are collapsed
 * behind a "ערוך פרטים נוספים" disclosure, closed by default, so a
 * proposed card reads as a compact thumbnail + action row (this is purely
 * a default-collapsed `useState`, not a removal — every remaining field is
 * still rendered, still wired to the same `onChange`, and still part of
 * the Save Draft payload the moment it's edited; collapsing it only hides
 * the DOM nodes, it never clears a value). No props changed.
 *
 * Gallery UX Polish sprint — the "הזז למעלה"/"הזז למטה" buttons are gone.
 * Reordering is now drag-and-drop via @dnd-kit/sortable's `useSortable`
 * (replacing an earlier framer-motion `Reorder.Item` attempt, which wasn't
 * grid-aware — dnd-kit's `rectSortingStrategy`, wired up in
 * MediaGalleryEditor.jsx's `<DndContext>`/`<SortableContext>`, is built
 * specifically for multi-column grid reordering). The card's visual
 * position in the grid IS the order; no order number is ever shown to the
 * employee, and the `isFirst`/`isLast`/`onMoveUp`/`onMoveDown` props are
 * gone along with the buttons (MediaGalleryEditor derives the persisted
 * `order` from the sorted array's position, exactly as it derived it from
 * array position before — see toComparablePayload, unchanged).
 *
 * Drag is started only from the small "⠿" handle — `attributes` and
 * `listeners` from `useSortable` are spread onto that button only, not the
 * card root (dnd-kit's documented "drag handle" pattern), so clicking
 * Remove, the details toggle, or any metadata input never accidentally
 * starts a drag.
 *
 * Note: unlike the framer-motion attempt, dnd-kit's `attributes` makes the
 * handle keyboard-operable out of the box (focus it, Space to pick up,
 * arrow keys to move, Space to drop) once MediaGalleryEditor's
 * `<DndContext>` registers a KeyboardSensor — see that file.
 *
 * UPDATED — Gallery UX Completion sprint: the gallery finally gets the
 * interactive positioning the profile image has had since the
 * Single-Section Editing UX sprint, composed exactly the way the atoms'
 * own reuse-boundary notes prescribe (one atom per grid cell, NOT the
 * single-image ImageEditorCard/ImageAssetEditor composites):
 *
 *   - The static next/image thumbnail is replaced by ImagePreview in
 *     editable mode — pointer-dragging the photo pans it inside the same
 *     4/5 frame and writes a continuous "<x>% <y>%" string through the
 *     EXISTING onChange("position", value) plumbing (that column was
 *     always a free-form CSS object-position string, so legacy keyword
 *     values like "center 36%" both render and drag correctly —
 *     ImagePreview.parsePosition normalizes them). The card's preview now
 *     also visually applies position/scale for the first time, so edits
 *     finally have live feedback.
 *   - ImagePositionControls (the zoom slider atom) renders below the
 *     actions row, wired to the EXISTING onChange("scale", value). A row
 *     with scale: null shows the slider at its 100% floor without writing
 *     anything until the user actually moves it — nulls stay nulls.
 *   - A small "איפוס מיקום" reset action sets position to "50% 50%" and
 *     scale to 1 (the same defaults buildUploadedGalleryImage seeds onto
 *     brand-new uploads — see lib/admin/gallery-images.js).
 *   - The raw `position`/`scale` text inputs are gone from the disclosure
 *     (the interactive surface replaced them; keeping both would let the
 *     two drift mid-edit). altHe/altEn/mobileOrder stay behind the
 *     disclosure unchanged. he.gallery.fields.position/scale label keys
 *     are still read by GalleryOwnerReview — only this card stopped using
 *     them.
 *
 *   Reorder-vs-position drag disambiguation: ImagePreview listens for
 *   pointerdown on the frame; the ⠿ reorder handle (rendered INSIDE the
 *   frame as an ImagePreview overlay child, same visual spot as before)
 *   must not let its pointerdown bubble into the frame, or one press would
 *   start both drags at once. The handle's own onPointerDown (defined
 *   AFTER spreading dnd-kit's `listeners`, so it wraps rather than loses
 *   dnd-kit's handler) stops propagation first, then delegates to
 *   dnd-kit's — so the handle drags the card, the photo drags the
 *   framing, and neither ever triggers the other. dnd-kit's PointerSensor
 *   has no listeners anywhere else on the card, so dragging the photo can
 *   never reorder.
 *
 * Props:
 *   - image ({ src, alt, altHe, altEn, position, scale, mobileOrder })
 *   - onChange(field, value) — called for each metadata field edit
 *   - onRemove (function)
 */

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import styles from "./GalleryImageCard.module.css";
import SecondaryButton from "./SecondaryButton";
import ImagePreview from "./ImagePreview";
import ImagePositionControls from "./ImagePositionControls";
import { DEFAULT_UPLOAD_POSITION, DEFAULT_UPLOAD_SCALE } from "@/lib/admin/gallery-images";
import { he } from "@/lib/admin/i18n/he";

export default function GalleryImageCard({ image, onChange = () => {}, onRemove = () => {} }) {
  const fields = he.gallery.fields;
  const positionCopy = he.gallery.positionControls;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image._key,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function handleResetPosition() {
    onChange("position", DEFAULT_UPLOAD_POSITION);
    onChange("scale", DEFAULT_UPLOAD_SCALE);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.tokens} ${styles.card} ${isDragging ? styles.dragging : ""}`}
    >
      <ImagePreview
        src={image.src}
        alt={image.alt}
        position={image.position}
        scale={image.scale}
        aspectRatio="4 / 5"
        editable
        onPositionChange={(value) => onChange("position", value)}
        dragHint={positionCopy.dragHint}
      >
        <span className={styles.previewBadge}>{he.gallery.previewBadge}</span>
        <button
          type="button"
          className={styles.dragHandle}
          aria-label={he.gallery.dragReorderHint}
          title={he.gallery.dragReorderHint}
          {...attributes}
          {...listeners}
          // Defined after the `listeners` spread on purpose: stops the
          // press from bubbling into ImagePreview's frame-level
          // pointerdown (which would start a positioning drag under the
          // reorder drag), then hands the event to dnd-kit's own handler.
          onPointerDown={(event) => {
            event.stopPropagation();
            listeners?.onPointerDown?.(event);
          }}
        >
          ⠿
        </button>
      </ImagePreview>

      <div className={styles.positionRow}>
        <ImagePositionControls
          scale={image.scale}
          onScaleChange={(value) => onChange("scale", value)}
          labels={{ zoomLabel: positionCopy.zoomLabel }}
        />
        <button
          type="button"
          className={styles.resetButton}
          onClick={handleResetPosition}
          title={positionCopy.resetHint}
        >
          {positionCopy.resetAction}
        </button>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.actionButton}
          disabled
          title={he.gallery.replaceComingSoon}
        >
          {he.gallery.actions.replace}
        </button>

        <SecondaryButton onClick={onRemove} className={styles.removeButton} title={he.gallery.removeHint}>
          {he.gallery.actions.remove}
        </SecondaryButton>
      </div>

      <button
        type="button"
        className={styles.detailsToggle}
        onClick={() => setDetailsOpen((previous) => !previous)}
        aria-expanded={detailsOpen}
      >
        {detailsOpen ? he.gallery.fields.detailsToggleHide : he.gallery.fields.detailsToggleShow}
      </button>

      {detailsOpen ? (
        <div className={styles.metaFields}>
          <label className={styles.fieldRow}>
            <span className={styles.fieldLabel}>{fields.altHe}</span>
            <input
              type="text"
              className={styles.fieldInput}
              value={image.altHe ?? ""}
              placeholder={fields.altHePlaceholder}
              onChange={(event) => onChange("altHe", event.target.value)}
            />
          </label>

          <label className={styles.fieldRow}>
            <span className={styles.fieldLabel}>{fields.altEn}</span>
            <input
              type="text"
              className={styles.fieldInput}
              value={image.altEn ?? ""}
              placeholder={fields.altEnPlaceholder}
              onChange={(event) => onChange("altEn", event.target.value)}
            />
          </label>

          <label className={styles.fieldRow}>
            <span className={styles.fieldLabel}>{fields.mobileOrder}</span>
            <input
              type="number"
              step="1"
              className={styles.fieldInput}
              value={image.mobileOrder ?? ""}
              title={fields.mobileOrderHelper}
              onChange={(event) =>
                onChange("mobileOrder", event.target.value === "" ? null : Number(event.target.value))
              }
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
