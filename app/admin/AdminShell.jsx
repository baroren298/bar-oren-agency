/*
 * Admin dashboard shell — Phase 4: Layout/Design System Foundation.
 *
 * Reusable header + sidebar + main-content wrapper for the protected
 * admin pages. Imported directly by each page that wants it
 * (app/admin/page.jsx, app/admin/talent/page.jsx,
 * app/admin/talent/[id]/page.jsx) rather than via a nested layout, so no
 * routing files needed to move — /admin/login (which must stay
 * shell-less, since a logged-out visitor shouldn't see admin nav) is
 * completely unaffected.
 *
 * Purely presentational: no auth check here. Every page that uses this
 * shell is already gated by proxy.js's existing /admin/* session
 * check (see proxy.js's header comment) — this component doesn't
 * touch or duplicate that logic.
 *
 * Server Component. The only client pieces are AdminNavLinks (needs
 * usePathname() for the active-link highlight), AdminLogoutButton
 * (needs an onClick handler), and AdminIdleTimeoutManager (needs timers/
 * DOM listeners) — all imported in, not inlined here.
 *
 * Sprint 4 (Admin Idle Timeout & Automatic Logout): AdminIdleTimeoutManager
 * is mounted once here, alongside AdminLogoutButton, so every page that
 * renders this shell gets the 3-minute idle-timeout/warning/auto-logout
 * behavior with no per-page wiring. Since /admin/login (see file header
 * above) never renders <AdminShell>, it never mounts the idle manager
 * either — the same "shell-less" property that already keeps admin nav off
 * the login page keeps the idle timer off it too, with no extra check
 * needed. Renders nothing itself unless the 2-minute warning threshold is
 * reached (see components/admin/AdminIdleTimeoutManager.jsx).
 *
 * Sprint 3 (Users UI): this is now an async Server Component so it can
 * derive the current session's role once, here, and pass it down to
 * AdminNavLinks — the only change needed to gate the new Owner-only
 * "Users" nav item without touching every page that renders <AdminShell>.
 * Same `getSessionUser({ cookies: await cookies() })` pattern every other
 * role-aware Server Component page already uses (see
 * app/admin/talent/[id]/page.jsx). A caller with no session (shouldn't
 * happen here — proxy.js already redirects unauthenticated requests
 * away from every /admin/* page before this ever renders) just gets
 * role: null, which AdminNavLinks treats as "not Owner" — the nav item is
 * hidden, not a crash.
 */

import Image from "next/image";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/admin/auth/authorize";
import AdminNavLinks from "./AdminNavLinks";
import AdminLogoutButton from "./AdminLogoutButton";
import AdminIdleTimeoutManager from "@/components/admin/AdminIdleTimeoutManager";
import styles from "./admin-shell.module.css";
import { he } from "@/lib/admin/i18n/he";

export default async function AdminShell({ children }) {
  const session = await getSessionUser({ cookies: await cookies() });
  const role = session?.role ?? null;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        {/* Same asset the public site Header uses (components/layout/Header.jsx)
            — intentionally reused, not copied, so there's one source of truth
            for the brand mark. Only the admin-local *layout* around it
            (size/spacing) is independent, per this file's styling-isolation rule. */}
        <Image
          src="/images/brand/logo3.png"
          alt={he.shell.brand}
          width={600}
          height={240}
          priority
          className={styles.brandLogo}
        />
        <AdminNavLinks className={styles.nav} role={role} />
      </aside>

      <div className={styles.main}>
        <header className={styles.header}>
          <AdminLogoutButton />
        </header>

        <AdminNavLinks className={styles.mobileNav} role={role} />

        <main className={styles.content}>{children}</main>
      </div>

      <AdminIdleTimeoutManager />
    </div>
  );
}
