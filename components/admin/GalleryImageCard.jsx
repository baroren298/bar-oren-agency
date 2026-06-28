/*
 * GalleryImageCard — Gallery Editor Foundation sprint.
 *
 * A single image card inside the "Proposed Update" half of a gallery
 * editor (MediaGalleryEditor.jsx). Prepares the visual language for three
 * future actions — Replace / Remove / Reorder — without implementing the
 * real work behind any of them yet, per this sprint's explicit scope (no
 * upload, no Cloudinary, no file picker, no persistence):
 *
 *   - "הסר" (Remove) really does call `onRemove` — removing a card from
 *     the in-memory proposed array is a local-state operation, not
 *     persistence, the same reasoning ComparisonView already applies to
 *     "ביטול שינויים" (see that file's header comment).
 *   - "הזז למעלה" / "הזז למטה" (Reorder) also really call
 *     `onMoveUp`/`onMoveDown` — swapping two entries in the local array.
 *     No drag-and-drop library, just simple, accessible buttons; disabled
 *     at the start/end of the list rather than hidden, so the grid's
 *     shape never jumps around as the employee reorders.
 *   - "החלף" (Replace) is left disabled with a tooltip — it would need a
 *     real file picker / upload pipeline, which is explicitly out of
 *     scope this sprint. Disabled + tooltip (not a silent no-op) matches
 *     EditorActionBar's existing "coming soon" pattern.
 *
 * Entity-agnostic: takes only an `image` ({ src, alt }) and position
 * flags, so the same card can later back talent galleries, homepage
 * media, or any other CMS image collection.
 *
 * Gallery UX Polish sprint — adds a small "לא נשמר" (not saved) badge over
 * every card, and clarifying `title` tooltips on Move/Remove. Those two
 * buttons genuinely mutate the in-memory proposed grid (see this file's
 * header comment above and MediaGalleryEditor.jsx), so unlike Replace/Add
 * they were never disabled — but with no visual cue, a working button on
 * an otherwise read-only-looking thumbnail reads as "this is saved." The
 * badge + tooltips are the fix; no behavior changes.
 *
 * Props:
 *   - image ({ src, alt })
 *   - onRemove, onMoveUp, onMoveDown (function)
 *   - isFirst, isLast (boolean) — disable the relevant move button at the
 *     edges of the list
 */

import Image from "next/image";
import styles from "./GalleryImageCard.module.css";
import SecondaryButton from "./SecondaryButton";
import { he } from "@/lib/admin/i18n/he";

export default function GalleryImageCard({
  image,
  onRemove = () => {},
  onMoveUp = () => {},
  onMoveDown = () => {},
  isFirst = false,
  isLast = false,
}) {
  return (
    <div className={`${styles.tokens} ${styles.card}`}>
      <div className={styles.imageWrapper}>
        <Image src={image.src} alt={image.alt} fill sizes="240px" className={styles.image} />
        <span className={styles.previewBadge}>{he.gallery.previewBadge}</span>
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

        <div className={styles.reorderActions}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label={he.gallery.actions.moveUp}
            title={he.gallery.moveHint}
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onMoveDown}
            disabled={isLast}
            aria-label={he.gallery.actions.moveDown}
            title={he.gallery.moveHint}
          >
            ↓
          </button>
        </div>

        <SecondaryButton onClick={onRemove} className={styles.removeButton} title={he.gallery.removeHint}>
          {he.gallery.actions.remove}
        </SecondaryButton>
      </div>
    </div>
  );
}
