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
 *
 * Administration Sprint 1 moved that Users item under an "Administration"
 * nav *section* (a non-interactive heading + its links), matching the
 * frozen Administration architecture (Users / Sessions / Audit Log, with
 * Roles & Permissions / Security Policies / Platform reserved). The whole
 * section — heading included — renders only for ROLE.OWNER; the visibility
 * rules and every deeper authorization layer are unchanged. Future
 * Administration modules add an entry to ADMINISTRATION_NAV_ITEMS and
 * nothing else here. URLs deliberately stay flat (/admin/users, not
 * /admin/administration/users) — the grouping is presentation-only; see
 * ADMINISTRATION_MIGRATION_PLAN.md ("Accepted deviations").
 */

import { usePathname } from "next/navigation";
import styles from "./admin-shell.module.css";
import { he } from "@/lib/admin/i18n/he";
import { ROLE } from "@/lib/admin/constants/enums";

const BASE_NAV_ITEMS = [
  { href: "/admin", label: he.nav.dashboard },
  { href: "/admin/my-work", label: he.nav.myWork },
  { href: "/admin/talent", label: he.nav.talent },
  // Sprint 7B (Clients & Brands Foundation) — visible to both roles:
  // OWNER and EMPLOYEE may view/create/edit Clients and Brands. Archive is
  // Owner-only, but that's enforced by the routes/service (and hidden per
  // action inside the pages) — not by hiding this nav item.
  { href: "/admin/clients", label: he.nav.clients },
  // Sprint 8A (Campaigns UI Prototype) — PROTOTYPE module: fake in-memory
  // demo data only, no database/API. Visible to both roles like Clients.
  // Remove or keep this entry when the real Campaigns module ships.
  { href: "/admin/campaigns", label: he.nav.campaigns },
];

// Owner-only "Administration" section (frozen architecture). Sessions will
// be appended here by its own sprint — per the approved Engineering Plan,
// no placeholder links for unbuilt modules. Audit Log added by
// Administration Sprint 2c (the module shipped in the same sprint).
const ADMINISTRATION_NAV_ITEMS = [
  { href: "/admin/users", label: he.nav.users },
  { href: "/admin/audit-log", label: he.nav.auditLog },
];

export default function AdminNavLinks({ className, role }) {
  const pathname = usePathname();

  function renderLink(item) {
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
  }

  return (
    <nav className={className}>
      {BASE_NAV_ITEMS.map(renderLink)}

      {role === ROLE.OWNER ? (
        <>
          <span className={styles.navSectionLabel}>{he.nav.administration}</span>
          {ADMINISTRATION_NAV_ITEMS.map(renderLink)}
        </>
      ) : null}
    </nav>
  );
}
