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
 */

import { usePathname } from "next/navigation";
import styles from "./admin-shell.module.css";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/my-work", label: "My Work" },
  { href: "/admin/talent", label: "Talent" },
];

export default function AdminNavLinks({ className }) {
  const pathname = usePathname();

  return (
    <nav className={className}>
      {NAV_ITEMS.map((item) => {
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
