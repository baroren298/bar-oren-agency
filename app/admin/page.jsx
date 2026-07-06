/*
 * /admin — Owner Dashboard (Sprint 1: data architecture + page skeleton).
 *
 * Implements OWNER_DASHBOARD_UX_SPEC.md's structure with real data and
 * deliberately unpolished placeholder cards — the sprint's goal is the
 * architecture (page → dashboardService → dashboardRepository), not the
 * final UI. Per the spec:
 *
 *   - Section order is fixed (spec §1): Greeting → Pending Approvals →
 *     Rejected Items → Employee Drafts. Recent Activity is out of scope
 *     for Sprint 1 and intentionally absent.
 *   - Read-and-route only (spec §9): every approval/rejected row is a
 *     deep link into the talent workspace where the decision happens; no
 *     approve buttons, no inline actions anywhere on this page.
 *   - The greeting count is Pending Approvals ONLY (spec §3).
 *   - Max five rows per section — enforced by the DTO, not the JSX.
 *
 * Owner-only (spec: Owner Dashboard and Employee Dashboard are different
 * products): a non-Owner session is redirected to /admin/my-work before
 * any data is fetched. dashboardService re-asserts the role server-side
 * regardless (defense in depth, same as userService).
 *
 * Section CTAs currently route to /admin/talent — the roster is the only
 * existing screen that surfaces pending/draft state per talent. Dedicated
 * queue screens (full approvals list, rejected list, drafts-by-employee)
 * are later sprints; when they exist, only these three hrefs change.
 *
 * Loading/empty-state design, mobile layout, and visual hierarchy polish
 * are explicitly out of Sprint 1 scope (sprint brief) — empty sections
 * render a single quiet line so the page stays truthful, nothing more.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import AdminShell from "./AdminShell";
import PageHeader from "@/components/admin/PageHeader";
import Card from "@/components/admin/Card";
import PrimaryButton from "@/components/admin/PrimaryButton";
import EmptyState from "@/components/admin/EmptyState";
import { getSessionUser } from "@/lib/admin/auth/authorize";
import { ROLE } from "@/lib/admin/constants/enums";
import { isDatabaseConfigured } from "@/lib/admin/db";
import { dashboardService } from "@/lib/admin/dashboard/dashboardService";
import { he } from "@/lib/admin/i18n/he";
import styles from "./dashboard.module.css";

export const metadata = {
  title: "לוח בקרה — ניהול",
};

const t = he.dashboard.owner;

/** Placeholder-grade timestamp formatting; relative times ("לפני שעתיים") are a later sprint. */
const dateTimeFormat = new Intl.DateTimeFormat("he-IL", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatWhen(isoString) {
  return dateTimeFormat.format(new Date(isoString));
}

/** "גלריה של קים" (spec §7 row copy) — work-type label + talent name. */
function itemTitle(item) {
  const workTypeLabel = t.workTypes[item.workType] ?? item.workType;
  return item.talentName ? `${workTypeLabel} של ${item.talentName}` : workTypeLabel;
}

function actorName(actor) {
  return actor?.displayName ?? actor?.email ?? null;
}

function summarySentence(count) {
  if (count === 0) return t.summaryNone;
  if (count === 1) return t.summaryOne;
  return t.summaryMany(count);
}

/** Shared shell for the three queue sections: title, rows, one CTA (spec §2). */
function QueueSection({ title, emptyText, cta, children, hasItems }) {
  return (
    <Card title={title} as="section">
      {hasItems ? (
        <>
          {children}
          <PrimaryButton href={cta.href}>{cta.label}</PrimaryButton>
        </>
      ) : (
        // Spec §4.2: empty sections shrink to one quiet line; the CTA is
        // hidden (a "view all" pointing at an empty list is a dead end).
        <p className={styles.queueEmpty}>{emptyText}</p>
      )}
    </Card>
  );
}

export default async function OwnerDashboardPage() {
  const session = await getSessionUser({ cookies: await cookies() });
  if (!session) {
    // Middleware already gates /admin/*; this is belt-and-suspenders.
    redirect("/admin/login");
  }
  if (session.role !== ROLE.OWNER) {
    // Employees land on their own product (spec: the two dashboards are
    // different products and must never mix).
    redirect("/admin/my-work");
  }

  if (!isDatabaseConfigured) {
    return (
      <AdminShell>
        <PageHeader title={he.nav.dashboard} />
        <EmptyState title={t.dbNotConfiguredTitle} description={t.dbNotConfiguredDescription} />
      </AdminShell>
    );
  }

  const dashboard = await dashboardService.getOwnerDashboard({
    actorId: session.userId,
    actorRole: session.role,
  });

  const displayName = dashboard.greeting.displayName ?? t.defaultDisplayName;

  return (
    <AdminShell>
      <PageHeader title={he.nav.dashboard} />

      {/* 1 — Greeting (spec §1/§7). */}
      <Card>
        <h2 className={styles.greeting}>{he.dashboard.greeting(displayName)}</h2>
        <p className={styles.subline}>
          {summarySentence(dashboard.greeting.pendingApprovalsCount)}
        </p>
      </Card>

      {/* 2 — Pending Approvals: rows deep-link, CTA goes to the queue (spec §8). */}
      <QueueSection
        title={`${t.sections.pendingApprovals} · ${dashboard.pendingApprovals.totalCount}`}
        emptyText={t.empty.pendingApprovals}
        cta={{ href: "/admin/talent", label: t.cta.pendingApprovals }}
        hasItems={dashboard.pendingApprovals.items.length > 0}
      >
        <ul className={styles.queueList}>
          {dashboard.pendingApprovals.items.map((item) => (
            <li key={item.key}>
              <Link href={item.href} className={styles.queueRow}>
                <p className={styles.queueRowTitle}>{itemTitle(item)}</p>
                <p className={styles.queueRowMeta}>
                  {[
                    actorName(item.submittedBy) ? t.submittedBy(actorName(item.submittedBy)) : null,
                    formatWhen(item.submittedAt),
                    item.itemCount > 1 ? t.itemCount(item.itemCount) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </QueueSection>

      {/* 3 — Rejected Items ("הוחזרו לתיקון") — above drafts: stalled beats healthy (spec §1). */}
      <QueueSection
        title={`${t.sections.rejectedItems} · ${dashboard.rejectedItems.totalCount}`}
        emptyText={t.empty.rejectedItems}
        cta={{ href: "/admin/talent", label: t.cta.rejectedItems }}
        hasItems={dashboard.rejectedItems.items.length > 0}
      >
        <ul className={styles.queueList}>
          {dashboard.rejectedItems.items.map((item) => (
            <li key={item.key}>
              <Link href={item.href} className={styles.queueRow}>
                <p className={styles.queueRowTitle}>{itemTitle(item)}</p>
                <p className={styles.queueRowMeta}>
                  {[t.rejectedBy(actorName(item.rejectedBy)), formatWhen(item.rejectedAt)].join(
                    " · "
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </QueueSection>

      {/* 4 — Employee Drafts, grouped by employee. Groups are not links yet:
          there is no drafts-filtered-by-employee screen to deep-link to
          (spec §8 wants one; that's the CTA's future destination). */}
      <QueueSection
        title={t.sections.employeeDrafts}
        emptyText={t.empty.employeeDrafts}
        cta={{ href: "/admin/talent", label: t.cta.employeeDrafts }}
        hasItems={dashboard.employeeDrafts.groups.length > 0}
      >
        <ul className={styles.queueList}>
          {dashboard.employeeDrafts.groups.map((group) => (
            <li key={group.key} className={styles.queueRow}>
              <p className={styles.queueRowTitle}>{actorName(group.employee)}</p>
              <p className={styles.queueRowMeta}>
                {[t.draftCount(group.draftCount), t.lastUpdated(formatWhen(group.lastUpdatedAt))].join(
                  " · "
                )}
              </p>
            </li>
          ))}
        </ul>
      </QueueSection>
    </AdminShell>
  );
}
