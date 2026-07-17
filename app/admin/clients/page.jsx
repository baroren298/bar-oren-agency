/*
 * /admin/clients — Sprint 7B (Clients & Brands Foundation).
 *
 * Clients list: name, contact, ACTIVE-brand count, lifecycle status,
 * search, create, archived-visibility toggle. Visible to BOTH roles
 * (OWNER and EMPLOYEE may view/create/edit — unlike /admin/users there is
 * no role redirect here); archive actions live on the detail page and are
 * Owner-only there, enforced server-side either way.
 *
 * Initial list is read directly via clientService (same pattern as
 * app/admin/users/page.jsx calling userService directly) — ACTIVE clients
 * only; ClientsPageClient re-fetches with includeArchived=1 from
 * /api/admin/clients when the toggle is switched on. All writes go
 * through the API routes + router.refresh().
 *
 * Database-deferred bridge: same `force-dynamic` + `isDatabaseConfigured`
 * guard every other DB-backed admin page uses.
 */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/admin/auth/authorize";
import { clientService } from "@/lib/admin/clientService";
import { isDatabaseConfigured } from "@/lib/admin/db";
import AdminShell from "../AdminShell";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import ClientsPageClient from "./ClientsPageClient";
import { he } from "@/lib/admin/i18n/he";
import { blockRetiredModulePage } from "@/lib/admin/retired-modules";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "לקוחות — ניהול",
};

export default async function AdminClientsPage() {
  // Website CMS Focus Cleanup — retired module. Unavailable to everyone
  // (renders 404) before any auth/data access; the existing session and
  // service checks below remain intact as an additional boundary.
  blockRetiredModulePage();

  const session = await getSessionUser({ cookies: await cookies() });
  if (!session) {
    redirect("/admin/login");
  }

  if (!isDatabaseConfigured) {
    return (
      <AdminShell>
        <PageHeader title={he.clients.title} />
        <EmptyState
          title={he.clients.dbNotConfiguredTitle}
          description={he.clients.dbNotConfiguredDescription}
        />
      </AdminShell>
    );
  }

  const clients = await clientService.listClients(
    { includeArchived: false },
    { actorRole: session.role }
  );

  return (
    <AdminShell>
      <PageHeader title={he.clients.title} description={he.clients.description} />
      <ClientsPageClient initialClients={clients} />
    </AdminShell>
  );
}
