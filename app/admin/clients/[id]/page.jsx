/*
 * /admin/clients/[id] — Sprint 7B (Clients & Brands Foundation).
 *
 * Client detail: editable client details + the Brands section (list, add,
 * rename/edit, archive) inline on the same page — deliberately NO separate
 * brand detail page (approved plan; nothing in the existing architecture
 * requires one). Visible to both roles; archive controls render for OWNER
 * only AND are re-enforced by the OWNER-only archive routes + service
 * re-assertion — UI visibility is never the security boundary.
 *
 * Initial data comes straight from clientService.getClientDetail (same
 * server-read pattern as app/admin/users/[id]/page.jsx); all writes go
 * through ClientDetailClient's fetch calls + router.refresh().
 */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/admin/auth/authorize";
import { clientService } from "@/lib/admin/clientService";
import { isDatabaseConfigured } from "@/lib/admin/db";
import AdminShell from "../../AdminShell";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import ClientDetailClient from "./ClientDetailClient";
import { he } from "@/lib/admin/i18n/he";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "פרטי לקוח — ניהול",
};

export default async function AdminClientDetailPage({ params }) {
  const session = await getSessionUser({ cookies: await cookies() });
  if (!session) {
    redirect("/admin/login");
  }

  if (!isDatabaseConfigured) {
    return (
      <AdminShell>
        <PageHeader title={he.clients.detail.title} />
        <EmptyState
          title={he.clients.dbNotConfiguredTitle}
          description={he.clients.dbNotConfiguredDescription}
        />
      </AdminShell>
    );
  }

  const { id } = await params;

  let client = null;
  try {
    client = await clientService.getClientDetail(id, { actorRole: session.role });
  } catch (error) {
    if (error.statusCode !== 404) throw error;
  }

  if (!client) {
    return (
      <AdminShell>
        <PageHeader title={he.clients.detail.title} />
        <EmptyState
          title={he.clients.detail.notFoundTitle}
          description={he.clients.detail.notFoundDescription}
        />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <ClientDetailClient initialClient={client} role={session.role} />
    </AdminShell>
  );
}
