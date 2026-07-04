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
 * Gallery Upload Sprint 2 fix-up — the five metadata inputs below are now
 * collapsed behind a "ערוך פרטים נוספים" disclosure, closed by default, so
 * a proposed card reads as a compact thumbnail + action row again (this is
 * purely a default-collapsed `useState`, not a removal — every field is
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
 * `<DndContext>` registers a KeyboardSensor — see that file. This closes
 * the keyboard-accessibility gap the previous attempt left open.
 *
 * Props:
 *   - image ({ src, alt, altHe, altEn, position, scale, mobileOrder })
 *   - onChange(field, value) — called for each metadata field edit
 *   - onRemove (function)
 */

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Image from "next/image";
import styles from "./GalleryImageCard.module.css";
import SecondaryButton from "./SecondaryButton";
import { he } from "@/lib/admin/i18n/he";

export default function GalleryImageCard({ image, onChange = () => {}, onRemove = () => {} }) {
  const fields = he.gallery.fields;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image._key,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.tokens} ${styles.card} ${isDragging ? styles.dragging : ""}`}
    >
      <div className={styles.imageWrapper}>
        <Image src={image.src} alt={image.alt} fill sizes="240px" className={styles.image} />
        <span className={styles.previewBadge}>{he.gallery.previewBadge}</span>
        <button
          type="button"
          className={styles.dragHandle}
          aria-label={he.gallery.dragReorderHint}
          title={he.gallery.dragReorderHint}
          {...attributes}
          {...listeners}
        >
          ⠿
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
            <span className={styles.fieldLabel}>{fields.position}</span>
            <input
              type="text"
              className={styles.fieldInput}
              value={image.position ?? ""}
              placeholder={fields.positionPlaceholder}
              title={fields.positionHelper}
              onChange={(event) => onChange("position", event.target.value)}
            />
          </label>

          <label className={styles.fieldRow}>
            <span className={styles.fieldLabel}>{fields.scale}</span>
            <input
              type="number"
              step="0.05"
              min="0"
              className={styles.fieldInput}
              value={image.scale ?? ""}
              title={fields.scaleHelper}
              onChange={(event) =>
                onChange("scale", event.target.value === "" ? null : Number(event.target.value))
              }
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
