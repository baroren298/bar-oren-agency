/*
 * /admin/audit-log — Administration Sprint 2c (Audit Log module).
 *
 * Owner-only, READ-ONLY oversight page ("Administration is oversight, not
 * operations"). Follows app/admin/users/page.jsx's exact structure:
 *
 *   - Role from the verified session cookie (getSessionUser) — a non-Owner
 *     is redirected to the dashboard before any audit data is fetched, on
 *     top of (not instead of) the API route's requireOwner and
 *     auditLogService's assertActorIsOwner (defense in depth).
 *   - First page is read server-side via auditLogService directly — no
 *     client fetch for first paint. "Load more" goes through
 *     GET /api/admin/audit-log (AuditLogPageClient.jsx).
 *   - Same `force-dynamic` + isDatabaseConfigured guard as every DB-backed
 *     admin page, so `next build`/Preview without DATABASE_URL never runs
 *     the Prisma-backed call.
 *
 * The page renders narrative items only (lib/admin/audit-log-display.js) —
 * raw audit rows never reach the client; the service's safe DTO is the
 * only shape that crosses the server/client boundary.
 */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/admin/auth/authorize";
import { auditLogService } from "@/lib/admin/auditLogService";
import { isDatabaseConfigured } from "@/lib/admin/db";
import { ROLE } from "@/lib/admin/constants/enums";
import AdminShell from "../AdminShell";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import AuditLogPageClient from "./AuditLogPageClient";
import { he } from "@/lib/admin/i18n/he";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "יומן פעילות — ניהול",
};

export default async function AdminAuditLogPage() {
  const session = await getSessionUser({ cookies: await cookies() });
  const role = session?.role ?? null;

  // An Employee must never reach this page — redirected before any audit
  // data is fetched. The nav link is also hidden for Employees
  // (AdminNavLinks.jsx), but a typed-in URL is blocked here regardless.
  if (role !== ROLE.OWNER) {
    redirect("/admin");
  }

  if (!isDatabaseConfigured) {
    return (
      <AdminShell>
        <PageHeader title={he.auditLog.title} description={he.auditLog.description} />
        <EmptyState
          title={he.auditLog.dbNotConfiguredTitle}
          description={he.auditLog.dbNotConfiguredDescription}
        />
      </AdminShell>
    );
  }

  const { entries, nextCursor } = await auditLogService.listEntries({ actorRole: role });

  return (
    <AdminShell>
      <PageHeader title={he.auditLog.title} description={he.auditLog.description} />
      <AuditLogPageClient initialEntries={entries} initialNextCursor={nextCursor} />
    </AdminShell>
  );
}
