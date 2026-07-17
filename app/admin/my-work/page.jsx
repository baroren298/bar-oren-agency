/*
 * /admin/my-work — "My Work" page (My Work — real data sprint).
 *
 * First version with REAL data: the page reads the current session,
 * calls dashboardService.getMyWork({ actorId, actorRole }) — the
 * per-actor query added next to the Owner Dashboard aggregation in
 * lib/admin/dashboard/dashboardService.js — and feeds the results into
 * the existing getWorkflowSections() rendering, replacing the explicit
 * empty array from the pre-merge stabilization pass.
 *
 * "My" means items created by the logged-in user (createdBy.id ===
 * session.userId), the same rule for OWNER and EMPLOYEE (this sprint's
 * decision: /admin/my-work is "items created/edited by me" for everyone;
 * supervision lives on the Owner Dashboard, not here).
 *
 * Status mapping (documented since Phase 2 in lib/admin/mock-workflow.js,
 * now actually exercised): the service returns raw VERSION_STATUS values;
 * this page maps them onto the section vocabulary:
 *
 *   DRAFT    → WORKFLOW_STATUS.DRAFT               (טיוטות)
 *   PROPOSED → WORKFLOW_STATUS.WAITING_FOR_APPROVAL (ממתינים לאישור)
 *   REJECTED → WORKFLOW_STATUS.CHANGES_REQUESTED    (נדרשו תיקונים)
 *
 * The Approved/Published section stays empty for now: approvals publish
 * immediately (no stored APPROVED state), and listing PUBLISHED work would
 * need a bounded "recent published" repository query that doesn't exist
 * yet — deliberately out of this read-only sprint (see getMyWork()'s
 * JSDoc). The section still renders with its EmptyState, unchanged JSX.
 *
 * i18n stays at this layer: the service is Hebrew-free, so work-type
 * labels (he.dashboard.owner.workTypes) and the rejection-note prefix
 * (he.workflow.rejectionNote) are applied here when shaping card items.
 *
 * Session/DB handling mirrors /admin/page.jsx exactly: middleware already
 * gates /admin/*, the getSessionUser() check is belt-and-suspenders, and a
 * missing database renders a quiet EmptyState instead of crashing.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import AdminShell from "../AdminShell";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import { getSessionUser } from "@/lib/admin/auth/authorize";
import { isDatabaseConfigured } from "@/lib/admin/db";
import { dashboardService } from "@/lib/admin/dashboard/dashboardService";
import { VERSION_STATUS } from "@/lib/admin/constants/enums";
import { getWorkflowSections, WORKFLOW_STATUS } from "@/lib/admin/mock-workflow";
import WorkflowItemCard from "./WorkflowItemCard";
import styles from "./my-work.module.css";
import { he } from "@/lib/admin/i18n/he";

export const metadata = {
  title: "המשימות שלי — ניהול",
};

/** VERSION_STATUS (service/DB vocabulary) → WORKFLOW_STATUS (section vocabulary). */
const SECTION_STATUS = {
  [VERSION_STATUS.DRAFT]: WORKFLOW_STATUS.DRAFT,
  [VERSION_STATUS.PROPOSED]: WORKFLOW_STATUS.WAITING_FOR_APPROVAL,
  [VERSION_STATUS.REJECTED]: WORKFLOW_STATUS.CHANGES_REQUESTED,
};

/**
 * MyWorkItem (see dashboardService.getMyWork JSDoc) → the card/item shape
 * getWorkflowSections() and WorkflowItemCard already consume. No `owner`
 * field on purpose — everything on this page is the viewer's own work, so
 * "בטיפול של X" would only add noise.
 */
function toCardItem(item) {
  const workTypeLabel = he.dashboard.owner.workTypes[item.workType] ?? item.workType;
  return {
    id: item.key,
    title: item.talentName ?? workTypeLabel,
    type:
      item.itemCount > 1
        ? `${workTypeLabel} · ${he.dashboard.owner.itemCount(item.itemCount)}`
        : workTypeLabel,
    status: SECTION_STATUS[item.versionStatus],
    lastUpdated: item.lastUpdatedAt,
    description: item.rejectionNote ? he.workflow.rejectionNote(item.rejectionNote) : null,
    href: item.href,
  };
}

export default async function AdminMyWorkPage() {
  const session = await getSessionUser({ cookies: await cookies() });
  if (!session) {
    // Middleware already gates /admin/*; this is belt-and-suspenders.
    redirect("/admin/login");
  }

  if (!isDatabaseConfigured) {
    return (
      <AdminShell>
        <PageHeader
          title={he.nav.myWork}
          description="כל מה שאתם עובדים עליו, הגשתם, או מחכים לתשובה לגביו."
        />
        <EmptyState
          title={he.workflow.dbNotConfiguredTitle}
          description={he.workflow.dbNotConfiguredDescription}
        />
      </AdminShell>
    );
  }

  const myWork = await dashboardService.getMyWork({
    actorId: session.userId,
    actorRole: session.role,
  });

  const sections = getWorkflowSections(myWork.map(toCardItem));

  return (
    <AdminShell>
      <PageHeader
        title={he.nav.myWork}
        description="כל מה שאתם עובדים עליו, הגשתם, או מחכים לתשובה לגביו."
      />

      <div className={styles.sections}>
        {sections.map((section) => (
          <section key={section.key} className={styles.section} aria-labelledby={`section-${section.key}`}>
            <div className={styles.sectionHeader}>
              <h2 id={`section-${section.key}`} className={styles.sectionTitle}>
                {section.label}
              </h2>
              <span className={styles.sectionCount}>{section.items.length}</span>
            </div>
            <p className={styles.sectionDescription}>{section.description}</p>

            {section.items.length === 0 ? (
              <EmptyState
                title={he.workflow.emptyState.title}
                description={he.workflow.emptyState.description(section.label)}
              />
            ) : (
              <div className={styles.grid}>
                {section.items.map((item) => (
                  <WorkflowItemCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </AdminShell>
  );
}
