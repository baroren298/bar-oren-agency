/*
 * AddImageCard — Gallery Editor Foundation sprint.
 *
 * The obvious "+ הוסף תמונה" affordance at the end of a proposed image
 * grid. Per this sprint's explicit scope this is UI groundwork only — no
 * upload, no Cloudinary, no file picker — so it's rendered disabled with
 * a "coming soon" tooltip rather than wired to a silent no-op, matching
 * EditorActionBar's existing disabled-button pattern (a button that does
 * nothing on click is confusing; a disabled one with a tooltip reads
 * honestly as "not built yet").
 *
 * Entity-agnostic: no props about what kind of gallery it's appended to,
 * so the same card works for talent galleries, homepage media, or any
 * other future CMS image collection.
 */

import styles from "./AddImageCard.module.css";
import { he } from "@/lib/admin/i18n/he";

export default function AddImageCard() {
  return (
    <button type="button" className={`${styles.tokens} ${styles.card}`} disabled title={he.gallery.addImageComingSoon}>
      <span className={styles.label}>{he.gallery.actions.addImage}</span>
    </button>
  );
}
