/*
 * Card — Admin Design System Foundation.
 *
 * Generic surface container for grouping admin content: a white panel
 * with the standard admin border/radius. Used for everything from a
 * single stat tile to a settings section — deliberately has no opinion
 * about its contents.
 *
 * Props:
 *   - title (string, optional) — rendered as a small heading inside the card
 *   - action (node, optional) — Sprint 7B.1 (Clients UX polish): a small
 *     action rendered on the title row's far side (e.g. the Client detail
 *     card's "ערוך פרטים" button). Purely additive — without it the card
 *     renders exactly as before; with it, title + action share one flex
 *     header row and the body is unchanged.
 *   - children (node) — card body
 *   - as ("div" | "section", optional, default "div")
 *   - tone ("default" | "accent", optional, default "default") — Owner
 *     Dashboard Sprint 2: the single, deliberate accent-border/subtle-
 *     background variant permitted by OWNER_DASHBOARD_UX_SPEC.md §2 ("only
 *     Pending Approvals may use the primary accent... one accent color,
 *     one owner"). Kept here rather than a one-off dashboard-only wrapper
 *     so any future screen that needs the same single-accent-surface rule
 *     doesn't duplicate it.
 */

import styles from "./Card.module.css";

const TONE_CLASS = {
  default: "",
  accent: "accent",
};

export default function Card({ title, action, children, as: Tag = "div", tone = "default" }) {
  const toneClass = styles[TONE_CLASS[tone]] ?? "";

  return (
    <Tag className={`${styles.tokens} ${styles.card} ${toneClass}`}>
      {title && action ? (
        <div className={styles.header}>
          <h2 className={styles.headerTitle}>{title}</h2>
          {action}
        </div>
      ) : title ? (
        <h2 className={styles.title}>{title}</h2>
      ) : null}
      <div className={styles.body}>{children}</div>
    </Tag>
  );
}
