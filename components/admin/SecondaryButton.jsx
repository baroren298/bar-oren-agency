/*
 * SecondaryButton — Admin Design System Foundation.
 *
 * Outlined, lower-emphasis button for secondary actions ("Cancel", "Back",
 * "View" alongside a PrimaryButton). Same href/button duality as
 * PrimaryButton, and visually matches the existing logout button style
 * already used in AdminShell (app/admin/admin-shell.module.css's
 * .logoutButton) without depending on it.
 *
 * Props:
 *   - href (string, optional) — renders an <a>
 *   - onClick, type, disabled — forwarded to <button> when no href
 *   - children (node)
 */

import styles from "./SecondaryButton.module.css";

export default function SecondaryButton({ href, children, className = "", ...rest }) {
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
