/*
 * PrimaryButton — Admin Design System Foundation.
 *
 * Solid, accent-colored call-to-action button for the admin panel's main
 * action per context (e.g. "Add talent", "Save", "Publish" in later
 * sprints). Renders as <a> when given an `href` (navigation) or <button>
 * otherwise (in-page action) — same look either way.
 *
 * No "use client": this component itself has no hooks or browser-only
 * APIs, so it can be rendered from a Server Component. If a caller needs
 * an onClick handler, that caller must itself be a Client Component (the
 * existing pattern in AdminLogoutButton.jsx) — this component just
 * forwards whatever props it's given to the underlying element.
 *
 * Props:
 *   - href (string, optional) — renders an <a>
 *   - onClick, type, disabled — forwarded to <button> when no href
 *   - children (node)
 */

import styles from "./PrimaryButton.module.css";

export default function PrimaryButton({ href, children, className = "", ...rest }) {
  const classes = `${styles.tokens} ${styles.button} ${className}`;

  if (href) {
    return (
      <a href={href} className={classes} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
