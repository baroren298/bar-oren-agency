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
 * shell is already gated by middleware.js's existing /admin/* session
 * check (see middleware.js's header comment) — this component doesn't
 * touch or duplicate that logic.
 *
 * Server Component. The only client pieces are AdminNavLinks (needs
 * usePathname() for the active-link highlight) and AdminLogoutButton
 * (needs an onClick handler) — both imported in, not inlined here.
 */

import Image from "next/image";
import AdminNavLinks from "./AdminNavLinks";
import AdminLogoutButton from "./AdminLogoutButton";
import styles from "./admin-shell.module.css";
import { he } from "@/lib/admin/i18n/he";

export default function AdminShell({ children }) {
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
        <AdminNavLinks className={styles.nav} />
      </aside>

      <div className={styles.main}>
        <header className={styles.header}>
          <AdminLogoutButton />
        </header>

        <AdminNavLinks className={styles.mobileNav} />

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
