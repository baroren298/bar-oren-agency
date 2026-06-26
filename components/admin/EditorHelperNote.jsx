/*
 * EditorHelperNote — Profile Editor Foundation sprint.
 *
 * A small, calm note shown at the bottom of an editing workspace (today:
 * the talent פרטים editor via ComparisonView; meant to be reused unchanged
 * by Gallery/SEO/Social/Homepage editors later). It exists purely to make
 * three things obvious to an employee who has never used this screen
 * before, without any CMS/developer wording:
 *   - this is a *proposed* update, not the live site,
 *   - nothing publishes until the owner approves it,
 *   - they're allowed to save a draft and come back later — they don't
 *     have to finish everything in one sitting.
 *
 * Plain presentational component (no hooks, no "use client") so it can be
 * dropped into a Server Component tree just as easily as a Client one.
 * Copy lives in lib/admin/i18n/he.js (he.editor.helperNote) rather than
 * being hardcoded here, same pattern as every other admin string.
 */

import styles from "./EditorHelperNote.module.css";
import { he } from "@/lib/admin/i18n/he";

export default function EditorHelperNote() {
  return (
    <div className={`${styles.tokens} ${styles.note}`} role="note">
      <span className={styles.icon} aria-hidden="true">
        💡
      </span>
      <p className={styles.text}>{he.editor.helperNote.body}</p>
    </div>
  );
}
