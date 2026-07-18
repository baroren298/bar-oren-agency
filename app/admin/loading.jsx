/*
 * Admin loading boundary — CMS Error & Loading Boundaries sprint.
 *
 * Next.js's automatic Suspense fallback for every app/admin/** page while
 * its async Server Component body (Prisma reads via versionService /
 * talentAdapter / dashboardService / etc.) is still resolving — on first
 * load and on client-side navigation into a new admin segment alike.
 *
 * Same structural fact as error.jsx: AdminShell (sidebar/header) is
 * rendered per-page, not from app/admin/layout.jsx, so this fallback
 * replaces the sidebar and header too, not just the content pane. Its
 * background is set to exactly --admin-bg (the same token AdminShell's
 * .shell uses) so the screen doesn't flash white while the real page —
 * chrome included — is still loading in behind it.
 *
 * No fabricated rows, names, or content — a plain, content-agnostic
 * spinner, never a skeleton shaped like a specific page's data. No shared
 * Spinner component was added: this is the only consumer today, so a small
 * inline one here is the smaller change; promote it to components/ if a
 * second caller ever needs the same visual (see the design review §5/§8).
 *
 * Pure server-rendered markup — no "use client", no state, no
 * interactivity. The spin animation is plain CSS, disabled under
 * prefers-reduced-motion.
 */

import { he } from "@/lib/admin/i18n/he";
import styles from "./admin-loading.module.css";

export default function AdminLoading() {
  return (
    <div className={styles.page} dir="rtl" lang="he">
      <div className={styles.spinner} aria-hidden="true" />
      <span className={styles.visuallyHidden} role="status" aria-live="polite">
        {he.loading.label}
      </span>
    </div>
  );
}
