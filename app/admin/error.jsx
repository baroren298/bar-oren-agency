"use client";

/*
 * Admin error boundary — CMS Error & Loading Boundaries sprint.
 *
 * Catches any render error thrown by a page (or client component) under
 * app/admin/** — every admin route nests under this file, since Next.js
 * applies an error.jsx boundary to its entire segment subtree by default.
 *
 * Structural fact this file is built around (see the design review):
 * AdminShell (sidebar/header) is rendered per-page — imported directly by
 * app/admin/page.jsx, talent/page.jsx, clients/page.jsx, etc. — not by
 * app/admin/layout.jsx (see AdminShell.jsx's own header comment). An error
 * thrown by a page unmounts AdminShell along with it, so this fallback
 * replaces the ENTIRE screen, not just a content pane. It must stand fully
 * on its own: its own brand mark, its own way back to /admin, no assumption
 * that a sidebar or header is still on screen. Not a redesign of AdminShell
 * — a deliberately separate, standalone surface.
 *
 * Deliberately never reads `error.message` / `error.stack` / `error.digest`
 * (the two props Next.js passes are `error` and `reset`; only `reset` is
 * destructured below). The people using this admin panel are the agency
 * owner and an employee, not developers — a raw error, stack, or digest
 * would only ever be noise or a leak of internal detail (query text,
 * connection info, file paths), never something actionable for them. If a
 * support conversation ever needs the underlying error, that's a server log
 * lookup, not something this screen should surface.
 *
 * No app/global-error.jsx this sprint (see the design review §6): this app
 * has no shared root layout, so app/admin/layout.jsx and
 * app/[locale]/layout.jsx are each the de-facto root for their tree, and an
 * error thrown by either layout itself (rather than a page) would bypass
 * this file. Both layouts are low-risk enough — app/admin/layout.jsx does
 * no data fetching at all — to accept that as a known, cheap-to-close-later
 * gap for CMS v1, per the constraints of this sprint.
 */

import PrimaryButton from "@/components/admin/PrimaryButton";
import { he } from "@/lib/admin/i18n/he";
import styles from "./admin-error.module.css";

export default function AdminError({ reset }) {
  return (
    <div className={styles.page} dir="rtl" lang="he">
      <div className={styles.card}>
        <p className={styles.brand}>{he.shell.brand}</p>
        <h1 className={styles.title}>{he.error.title}</h1>
        <p className={styles.body}>{he.error.body}</p>
        <div className={styles.actions}>
          <PrimaryButton type="button" onClick={reset}>
            {he.error.retry}
          </PrimaryButton>
          <a href="/admin" className={styles.backLink}>
            {he.error.back}
          </a>
        </div>
      </div>
    </div>
  );
}
