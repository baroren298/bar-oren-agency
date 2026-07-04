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
 *   - children (node) — card body
 *   - as ("div" | "section", optional, default "div")
 */

import styles from "./Card.module.css";

export default function Card({ title, children, as: Tag = "div" }) {
  return (
    <Tag className={`${styles.tokens} ${styles.card}`}>
      {title ? <h2 className={styles.title}>{title}</h2> : null}
      <div className={styles.body}>{children}</div>
    </Tag>
  );
}
