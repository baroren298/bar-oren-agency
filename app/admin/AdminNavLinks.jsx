"use client";

/*
 * Admin nav links — Phase 4 layout/design-system foundation.
 *
 * Client component (needs usePathname() for the active-link highlight).
 * Shared by the desktop sidebar and the mobile top nav in AdminShell.jsx
 * so both stay in sync from one list. Only working routes are listed —
 * no placeholder/future items, per this sprint's scope.
 *
 * Phase 2 (Agency Workflow) added "My Work" -> /admin/my-work.
 *
 * Sprint 3 (Users UI) added the "Users" item, but only for role ===
 * ROLE.OWNER — an Employee's session never renders it, in addition to (not
 * instead of) the page itself redirecting a non-Owner away and every
 * underlying API route/service re-checking OWNER independently (see
 * app/admin/users/page.jsx and lib/admin/userService.js). `role` is passed
 * down from AdminShell.jsx, which derives it once from the session cookie.
 */

import { usePathname } from "next/navigation";
import styles from "./admin-shell.module.css";
import { he } from "@/lib/admin/i18n/he";
import { ROLE } from "@/lib/admin/constants/enums";

const BASE_NAV_ITEMS = [
  { href: "/admin", label: he.nav.dashboard },
  { href: "/admin/my-work", label: he.nav.myWork },
  { href: "/admin/talent", label: he.nav.talent },
];

const OWNER_ONLY_NAV_ITEMS = [{ href: "/admin/users", label: he.nav.users }];

export default function AdminNavLinks({ className, role }) {
  const pathname = usePathname();
  const navItems = role === ROLE.OWNER ? [...BASE_NAV_ITEMS, ...OWNER_ONLY_NAV_ITEMS] : BASE_NAV_ITEMS;

  return (
    <nav className={className}>
      {navItems.map((item) => {
        const isActive =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);

        return (
          <a
            key={item.href}
            href={item.href}
            className={isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
