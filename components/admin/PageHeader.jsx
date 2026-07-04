/*
 * PageHeader — Admin Design System Foundation.
 *
 * Generic page-level header for admin pages: a title, an optional
 * subtitle/description line, and an optional action slot on the right
 * (typically a <PrimaryButton> or <SecondaryButton>, but any node works).
 *
 * Plain presentational component — no hooks, no "use client" — so it can
 * be rendered from Server Components (the Dashboard, and later Talent/
 * SEO/Media/Settings pages, are all Server Components) or Client
 * Components alike.
 *
 * Props:
 *   - title (string, required)
 *   - description (string, optional) — one-line supporting copy
 *   - action (node, optional) — rendered at the right edge of the header
 */

import styles from "./PageHeader.module.css";

export default function PageHeader({ title, description, action }) {
  return (
    <div className={styles.tokens}>
      <div className={styles.header}>
        <div className={styles.text}>
          <h1 className={styles.title}>{title}</h1>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>

        {action ? <div className={styles.action}>{action}</div> : null}
      </div>
    </div>
  );
}
