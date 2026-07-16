/*
 * /admin/users/[id] — Sprint 3.1: User Details Page, revised by Sprint 3.2
 * (User Detail UX Cleanup).
 *
 * Owner-only, same role-derivation-from-session-cookie + redirect pattern
 * every other Owner-only Server Component page already uses (see
 * app/admin/users/page.jsx's header comment, which this page mirrors).
 * The Users list (app/admin/users/UsersPageClient.jsx) now links each row
 * here instead of editing displayName/activation inline — this page is the
 * "full user management screen" the product decision calls for.
 *
 * Initial read is direct via userService.getUserDetail (same "no
 * client-side fetch needed just to render the first paint" pattern as
 * page.jsx's listUsers() call) — a pure read, no writes. All writes
 * (profile edit — displayName + email, password reset, activation toggle)
 * happen in UserDetailClient.jsx via fetch to the existing/new
 * /api/admin/users routes, followed by router.refresh() to re-read this
 * same server-side detail.
 *
 * Role editing is NOT implemented here — see he.js's
 * he.users.detail.role.readOnlyNote (rendered directly in the Role &
 * permissions section) for why: it needs the same last-active-Owner /
 * self-demotion guardrails userService.setActive already has for
 * deactivation, and building + testing that safely is bigger than this
 * sprint's scope. Role is shown read-only, explicitly marked as a
 * follow-up, rather than shipping a half-safe toggle.
 *
 * Same `force-dynamic` + `isDatabaseConfigured` guard every other DB-backed
 * admin page uses. getUserDetail() 404s (statusCode 404) for an unknown id,
 * mapped here to Next's notFound() the same way a missing talent would be.
 */

import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/admin/auth/authorize";
import { userService } from "@/lib/admin/userService";
import { isDatabaseConfigured } from "@/lib/admin/db";
import { ROLE } from "@/lib/admin/constants/enums";
import AdminShell from "../../AdminShell";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import UserDetailClient from "./UserDetailClient";
import { he } from "@/lib/admin/i18n/he";
import styles from "./user-detail.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "פרטי משתמש — ניהול",
};

export default async function AdminUserDetailPage({ params }) {
  const session = await getSessionUser({ cookies: await cookies() });
  const role = session?.role ?? null;

  // Employee must never reach this page — same defense-in-depth reasoning
  // as /admin/users itself: a typed-in URL must be blocked regardless of
  // whether any link to it was ever visible.
  if (role !== ROLE.OWNER) {
    redirect("/admin");
  }

  const { id } = await params;

  if (!isDatabaseConfigured) {
    return (
      <AdminShell>
        <a href="/admin/users" className={styles.backLink}>
          {he.users.detail.backToList}
        </a>
        <PageHeader title={he.users.detail.title} />
        <EmptyState
          title={he.users.dbNotConfiguredTitle}
          description={he.users.dbNotConfiguredDescription}
        />
      </AdminShell>
    );
  }

  let user;
  try {
    user = await userService.getUserDetail(id, { actorRole: role });
  } catch (error) {
    if (error.statusCode === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <AdminShell>
      <a href="/admin/users" className={styles.backLink}>
        {he.users.detail.backToList}
      </a>

      {/* Sprint 3.2 QA fix: show displayName as the title when available,
          falling back to email — but never show email as both title and
          subtitle. The subtitle only appears when it adds information
          (i.e. there is a displayName, so the email isn't already the
          title). */}
      <PageHeader title={user.displayName || user.email} description={user.displayName ? user.email : undefined} />

      {/* Sprint 3c: Session Management UI needs to know whether the acting
          Owner is looking at their own user record, purely to choose the
          SessionsSection revoke-all copy variant ("...כל שאר..." vs
          "...כל..."). session.userId already comes from the same
          getSessionUser() call above — no new auth surface, no extra DB
          read. */}
      <UserDetailClient user={user} isSelfView={session?.userId === user.id} />
    </AdminShell>
  );
}
