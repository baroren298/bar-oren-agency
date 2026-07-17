/*
 * /admin/campaigns — Sprint 8A (Campaigns UI Prototype).
 *
 * PROTOTYPE ONLY. This page renders the Campaigns list entirely from the
 * fake in-memory store in ./_prototype/campaignPrototypeData.js — no
 * Prisma, no API routes, no database reads, no persistence. It exists so
 * the product experience (list → detail → creation flow) can be evaluated
 * before the real Campaigns data architecture is defined.
 *
 * Same page skeleton as /admin/clients: session check → AdminShell →
 * PageHeader → client component. Unlike clients there is deliberately NO
 * isDatabaseConfigured guard — nothing here touches the database.
 * Copy lives in ./_prototype/copy.js (not he.js) so the whole prototype
 * deletes cleanly; only the nav label lives in he.js.
 */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/admin/auth/authorize";
import AdminShell from "../AdminShell";
import PageHeader from "@/components/admin/PageHeader";
import CampaignsPageClient from "./CampaignsPageClient";
import { campaignsCopy } from "./_prototype/copy";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "קמפיינים — ניהול",
};

export default async function AdminCampaignsPage() {
  const session = await getSessionUser({ cookies: await cookies() });
  if (!session) {
    redirect("/admin/login");
  }

  return (
    <AdminShell>
      <PageHeader title={campaignsCopy.title} description={campaignsCopy.description} />
      <CampaignsPageClient />
    </AdminShell>
  );
}
