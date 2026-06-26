/*
 * SocialLinkRow — Social Links Editor Foundation sprint.
 *
 * A single platform row inside SocialLinksEditor: icon + platform name +
 * either a read-only value (published column) or a text input (proposed
 * column), plus a reserved "future status" slot. Mirrors GalleryImageCard's
 * role in MediaGalleryEditor — the one piece that knows how to render a
 * single entry — but stays a plain presentational component (no hooks, no
 * "use client") since unlike a gallery card it never owns any state itself;
 * SocialLinksEditor is the only thing that touches `proposedValues`.
 *
 * Entity-agnostic on purpose, same reasoning as ComparisonView/
 * MediaGalleryEditor: this file knows nothing about "talent" specifically,
 * only a `platform` ({ key, label, icon }) and a value, so the same row
 * backs agency social links, contact info, footer links, or brand pages
 * later — only the `platforms` array passed in changes.
 *
 * Future Ready (explicitly NOT implemented this sprint, per scope):
 *   - URL validation / username validation
 *   - Link preview
 *   - Copy link / Open in new tab
 * The `.futureActionButton` below is a disabled, tooltipped placeholder for
 * "open link"/"copy link" — same honest-disabled-button pattern as
 * GalleryImageCard's "החלף" and AddImageCard, so it reads as "not built
 * yet," not as a broken click. Wiring it up is a later sprint's job and
 * shouldn't need any change to this component's shape.
 *
 * Props:
 *   - platform ({ key, label, icon }) — from lib/admin/social-platforms.js
 *   - value (string|null)
 *   - readOnly (boolean, optional, default false)
 *   - onChange (function, optional) — (value: string) => void, ignored when
 *     readOnly
 */

import styles from "./SocialLinkRow.module.css";
import { he } from "@/lib/admin/i18n/he";

export default function SocialLinkRow({ platform, value, readOnly = false, onChange = () => {} }) {
  const { key, label, icon } = platform;

  return (
    <div className={readOnly ? styles.row : styles.rowEditable}>
      <div className={styles.platform}>
        <span className={styles.platformIcon} aria-hidden="true">
          {icon}
        </span>
        <span className={styles.platformLabel}>{label}</span>
      </div>

      <div className={styles.valueArea}>
        {readOnly ? (
          <span className={value ? styles.readOnlyValue : styles.emptyValue}>
            {value || he.social.notSet}
          </span>
        ) : (
          <input
            id={`social-${key}`}
            type="text"
            className={styles.input}
            value={value ?? ""}
            placeholder={he.social.inputPlaceholder(label)}
            onChange={(event) => onChange(event.target.value)}
            aria-label={label}
          />
        )}
      </div>

      {/*
       * Reserved "future status" slot (sprint's UX requirement). Always
       * rendered so every row's height/alignment stays identical whether or
       * not a future feature is wired — purely inert today, no aria role of
       * its own beyond the disabled button it wraps.
       */}
      <div className={styles.futureActions}>
        <button
          type="button"
          className={styles.futureActionButton}
          disabled
          title={he.social.comingSoon}
        >
          {readOnly ? he.social.actions.openLink : he.social.actions.copyLink}
        </button>
      </div>
    </div>
  );
}
