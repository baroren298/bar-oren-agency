/*
 * /admin/users — Sprint 3: Users UI.
 *
 * Owner-only. Role is derived from the same verified session cookie every
 * other role-aware Server Component page already uses (see
 * app/admin/talent/[id]/page.jsx's `getSessionUser({ cookies: await
 * cookies() })` pattern) — a non-Owner is redirected straight back to the
 * dashboard before any user data is ever fetched. This is on top of, not
 * instead of, every route/service's own requireOwner()/assertActorIsOwner()
 * check (defense in depth, same reasoning as every other Owner-only surface
 * in this codebase — see lib/admin/userService.js's header comment).
 *
 * Initial list is read directly via userService (same pattern as
 * app/admin/talent/page.jsx calling versionService.listParents directly) —
 * no client-side fetch needed just to render the first paint. All writes
 * (create employee, edit displayName, toggle active) go through
 * UsersPageClient.jsx's fetch calls to the new /api/admin/users routes,
 * followed by router.refresh() to re-read this same server-side list.
 *
 * Database-deferred bridge: same `force-dynamic` + `isDatabaseConfigured`
 * guard every other DB-backed admin page uses (e.g. app/admin/talent/
 * page.jsx) so this page never runs its Prisma-backed call during
 * `next build`/Preview with no DATABASE_URL set.
 */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/admin/auth/authorize";
import { userService } from "@/lib/admin/userService";
import { isDatabaseConfigured } from "@/lib/admin/db";
import { ROLE } from "@/lib/admin/constants/enums";
import AdminShell from "../AdminShell";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import UsersPageClient from "./UsersPageClient";
import { he } from "@/lib/admin/i18n/he";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "משתמשים — ניהול",
};

export default async function AdminUsersPage() {
  const session = await getSessionUser({ cookies: await cookies() });
  const role = session?.role ?? null;

  // Employee must never reach this page — redirected to the dashboard
  // before any user data is fetched. The nav link is also hidden for
  // Employees (AdminNavLinks.jsx), but a typed-in URL must be blocked here
  // regardless of whether the link was ever visible.
  if (role !== ROLE.OWNER) {
    redirect("/admin");
  }

  if (!isDatabaseConfigured) {
    return (
      <AdminShell>
        <PageHeader title={he.users.title} />
        <EmptyState
          title={he.users.dbNotConfiguredTitle}
          description={he.users.dbNotConfiguredDescription}
        />
      </AdminShell>
    );
  }

  const users = await userService.listUsers({ actorRole: role });

  return (
    <AdminShell>
      <PageHeader title={he.users.title} />
      <UsersPageClient initialUsers={users} currentUserId={session.userId} />
    </AdminShell>
  );
}
