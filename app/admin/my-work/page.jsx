/*
 * /admin/my-work — "My Work" page (Phase 2: Agency Workflow).
 *
 * First version of the agency-workflow dashboard described in this
 * sprint's brief: an employee should land in the admin and immediately
 * see what needs their attention, grouped into the four workflow stages
 * (Drafts, Waiting for Approval, Changes Requested, Approved / Published).
 *
 * Server Component, already protected by middleware.js's existing
 * /admin/* session check (see app/admin/AdminShell.jsx's header comment) —
 * no new auth code needed.
 *
 * Data source: lib/admin/mock-workflow.js — local mock data only, per this
 * sprint's explicit scope (no database, no Prisma, no API route). The
 * page itself only calls getWorkflowSections() and renders the result, so
 * swapping that for a real query later (e.g. something backed by the Core
 * Content Engine in lib/admin/engine/) shouldn't require touching this
 * file's JSX at all.
 *
 * Reuses the existing admin design system as-is: AdminShell for the
 * page chrome, PageHeader for the title, EmptyState for sections with no
 * items, and WorkflowItemCard (./WorkflowItemCard.jsx) — itself built from
 * Card + StatusBadge — for each item.
 */

import AdminShell from "../AdminShell";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import { getWorkflowSections } from "@/lib/admin/mock-workflow";
import WorkflowItemCard from "./WorkflowItemCard";
import styles from "./my-work.module.css";
import { he } from "@/lib/admin/i18n/he";

export const metadata = {
  title: "המשימות שלי — ניהול",
};

export default function AdminMyWorkPage() {
  const sections = getWorkflowSections();

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
