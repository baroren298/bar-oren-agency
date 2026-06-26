"use client";

/*
 * Logout button — Phase 4 layout/design-system foundation.
 *
 * Wires the header to the existing POST /api/admin/auth/logout route
 * (app/api/admin/auth/logout/route.js, added in Phase 2 and unchanged
 * here) — no new auth logic, just a UI entry point for a route that
 * already worked. On success, redirects to /admin/login.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./admin-shell.module.css";

export default function AdminLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } finally {
      router.push("/admin/login");
      router.refresh();
    }
  }

  return (
    <button type="button" className={styles.logoutButton} onClick={handleLogout} disabled={loading}>
      {loading ? "…" : "Log out"}
    </button>
  );
}
