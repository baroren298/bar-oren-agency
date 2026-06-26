/*
 * EmptyState — Admin Design System Foundation.
 *
 * Simple placeholder for "nothing here yet" admin states — an empty
 * talent roster, no proposals, no media, etc. Deliberately minimal per
 * this sprint's scope: a message and an optional action, no illustration.
 *
 * Props:
 *   - title (string, optional) — short heading, e.g. "No talent yet"
 *   - description (string, optional) — supporting line
 *   - action (node, optional) — e.g. a <PrimaryButton>
 */

import styles from "./EmptyState.module.css";

export default function EmptyState({ title, description, action }) {
  return (
    <div className={`${styles.tokens} ${styles.empty}`}>
      {title ? <p className={styles.title}>{title}</p> : null}
      {description ? <p className={styles.description}>{description}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
