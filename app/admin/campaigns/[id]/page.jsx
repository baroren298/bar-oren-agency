/*
 * /admin/campaigns/[id] — Sprint 8A (Campaigns UI Prototype).
 *
 * PROTOTYPE ONLY. Thin server wrapper: session check + AdminShell, then
 * everything renders client-side in CampaignDetailClient — the campaign is
 * resolved from the in-memory prototype store in the BROWSER's module
 * memory, because campaigns created locally this session exist only there.
 * Deliberately no notFound() here: the server can't know what the client
 * store holds, so "not found" is a client-rendered empty state instead.
 *
 * No Prisma, no API routes, no database, no persistence.
 */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/admin/auth/authorize";
import AdminShell from "../../AdminShell";
import CampaignDetailClient from "./CampaignDetailClient";
import { blockRetiredModulePage } from "@/lib/admin/retired-modules";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "פרטי קמפיין — ניהול",
};

export default async function AdminCampaignDetailPage({ params }) {
  // Website CMS Focus Cleanup — retired module. Unavailable to everyone
  // (renders 404) before any access; the prototype code below stays in
  // place, just unreachable.
  blockRetiredModulePage();

  const session = await getSessionUser({ cookies: await cookies() });
  if (!session) {
    redirect("/admin/login");
  }

  const { id } = await params;

  return (
    <AdminShell>
      <CampaignDetailClient campaignId={id} />
    </AdminShell>
  );
}
