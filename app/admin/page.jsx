/*
 * /admin — Owner Dashboard (Sprint 2: first real UI).
 *
 * Sprint 1 built the architecture (page → dashboardService →
 * dashboardDto) with deliberately unpolished placeholder cards. This
 * sprint implements OWNER_DASHBOARD_UX_SPEC.md's visual hierarchy (§2) on
 * top of that same data flow — no repository changes, no new queries, no
 * redesign of the service/DTO boundary. Per the spec:
 *
 *   - Section order is fixed (spec §1): Greeting → Pending Approvals →
 *     Rejected Items → Employee Drafts. Recent Activity remains out of
 *     scope (sprint brief) and intentionally absent.
 *   - Read-and-route only (spec §9): every approval/rejected row is a
 *     deep link into the talent workspace where the decision happens; no
 *     approve buttons, no inline actions anywhere on this page.
 *   - The greeting count is Pending Approvals ONLY (spec §3).
 *   - Max five rows per section — enforced by the DTO, not the JSX.
 *   - Visual tiers (spec §2): the greeting is plain text, never a card
 *     (Tier 1); Pending Approvals is the only section with the accent
 *     surface (Tier 2, `<Card tone="accent">`) and the only section whose
 *     CTA uses the accent-colored <PrimaryButton> — Rejected Items and
 *     Employee Drafts use <SecondaryButton> so "one accent color, one
 *     owner" holds. Rejected Items' only warning treatment is the tinted
 *     row metadata text, never a red card.
 *   - Aging flag (spec §7/§3): a Pending Approvals item waiting more than
 *     3 days gets a quiet "ממתין X ימים" text flag — no color, no badge.
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
 * Still explicitly out of scope this sprint (per the sprint brief):
 * Recent Activity, the Employee Dashboard, mobile-specific polish,
 * skeleton loading states, and empty-state illustrations. Empty sections
 * keep Sprint 1's single quiet line.
 *
 * Sprint 5a adds two things on top of the above, without touching any of
 * it: a fourth queue section, "Recent Publishes" (same QueueSection shell,
 * neutral tone, fed by dashboard.recentPublishes — see dashboardService's
 * publishTimestamp() for the approvedAt-as-publish-time-proxy assumption
 * this section rests on), and a static "Quick Actions" block of four fixed
 * links (Add Represented Talent / Represented Talents / Users / Audit Log)
 * that reads no dashboard data at all — it's rendered directly here, not
 * part of OwnerDashboardDto, since there's no query behind it.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import AdminShell from "./AdminShell";
import Card from "@/components/admin/Card";
import PrimaryButton from "@/components/admin/PrimaryButton";
import SecondaryButton from "@/components/admin/SecondaryButton";
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

/** An item waiting longer than this many days gets the quiet aging flag (spec §7). */
const AGING_THRESHOLD_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

/*
 * Dashboard UX refinement — time-of-day greeting. The duplicated "לוח
 * בקרה" PageHeader is gone (the sidebar already shows the active page), so
 * the main content now opens with a personal greeting instead.
 *
 * The hour is resolved in the agency's timezone explicitly (not the
 * server's local clock) because this is a Server Component: on a UTC host
 * the untranslated hour would greet Bar "בוקר טוב" at 9pm Israel time.
 */
const GREETING_TIME_ZONE = "Asia/Jerusalem";

function greetingPeriod(date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: GREETING_TIME_ZONE,
      hour: "numeric",
      hour12: false,
    }).format(date)
  );
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night"; // 22:00–04:59 (Intl may emit "24" for midnight — still night)
}

function greetingText(displayName) {
  return he.dashboard.timeGreeting[greetingPeriod()](displayName);
}

/** Whole days between submittedAt and "now" (the DTO's generatedAt) — spec §7 aging flag. */
function daysWaiting(submittedAtIso, generatedAtIso) {
  const elapsed = new Date(generatedAtIso).getTime() - new Date(submittedAtIso).getTime();
  return Math.floor(elapsed / MS_PER_DAY);
}

/** Shared shell for the three queue sections: title, rows, one CTA (spec §2). */
function QueueSection({ title, emptyText, cta, children, hasItems, tone, CtaButton = SecondaryButton }) {
  return (
    <Card title={title} as="section" tone={tone}>
      {hasItems ? (
        <>
          {children}
          <CtaButton href={cta.href}>{cta.label}</CtaButton>
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
        {/* No dashboard data without a DB — greet with the fallback name
            (the session token carries no displayName) and skip the summary
            subline, since there's no pending count to summarize. */}
        <div className={styles.greetingBlock}>
          <h1 className={styles.greeting}>{greetingText(t.defaultDisplayName)}</h1>
        </div>
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
      {/* 1 — Greeting (spec §1/§2/§7): plain text on the page background,
          never a card — the only element on the page allowed personality.
          Now also the page's opening element (and its h1): the "לוח בקרה"
          PageHeader was removed as duplicated — the sidebar already marks
          the active page. */}
      <div className={styles.greetingBlock}>
        <h1 className={styles.greeting}>{greetingText(displayName)}</h1>
        <p className={styles.subline}>
          {summarySentence(dashboard.greeting.pendingApprovalsCount)}
        </p>
      </div>

      {/* Quick Actions (Sprint 5a) — static links only, no dashboard data
          behind them; deliberately placed once, near the top, rather than
          folded into the queue sections below. */}
      <div className={styles.quickActionsWrapper}>
        <Card title={t.quickActions.title} as="section">
          <ul className={styles.quickActionsList}>
            <li>
              <Link href="/admin/talent/new" className={styles.quickActionLink}>
                {t.quickActions.addTalent}
              </Link>
            </li>
            <li>
              <Link href="/admin/talent" className={styles.quickActionLink}>
                {t.quickActions.talents}
              </Link>
            </li>
            <li>
              <Link href="/admin/users" className={styles.quickActionLink}>
                {t.quickActions.users}
              </Link>
            </li>
            <li>
              <Link href="/admin/audit-log" className={styles.quickActionLink}>
                {t.quickActions.auditLog}
              </Link>
            </li>
          </ul>
        </Card>
      </div>

      <div className={styles.sectionStack}>
        {/* 2 — Pending Approvals: the dominant section (spec §2) — the only
            accent-surface Card and the only accent-colored CTA. Rows
            deep-link, the CTA goes to the queue (spec §8). */}
        <QueueSection
          title={`${t.sections.pendingApprovals} · ${dashboard.pendingApprovals.totalCount}`}
          emptyText={t.empty.pendingApprovals}
          cta={{ href: "/admin/talent", label: t.cta.pendingApprovals }}
          hasItems={dashboard.pendingApprovals.items.length > 0}
          tone="accent"
          CtaButton={PrimaryButton}
        >
          <ul className={`${styles.queueList} ${styles.queueListApprovals}`}>
            {dashboard.pendingApprovals.items.map((item) => {
              const waited = daysWaiting(item.submittedAt, dashboard.generatedAt);
              return (
                <li key={item.key}>
                  <Link href={item.href} className={styles.queueRow}>
                    <div className={styles.queueRowText}>
                      <p className={styles.queueRowTitle}>{itemTitle(item)}</p>
                      <p className={styles.queueRowMeta}>
                        {[
                          actorName(item.submittedBy)
                            ? t.submittedBy(actorName(item.submittedBy))
                            : null,
                          formatWhen(item.submittedAt),
                          item.itemCount > 1 ? t.itemCount(item.itemCount) : null,
                          waited > AGING_THRESHOLD_DAYS ? (
                            <span key="aging" className={styles.agingFlag}>
                              {t.agingFlag(waited)}
                            </span>
                          ) : null,
                        ]
                          .filter((part) => part !== null)
                          .reduce((acc, part, i) => (i === 0 ? [part] : [...acc, " · ", part]), [])}
                      </p>
                    </div>
                    <span className={styles.chevron} aria-hidden="true">
                      ‹
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </QueueSection>

        {/* 3 — Rejected Items ("הוחזרו לתיקון") — above drafts: stalled beats
            healthy (spec §1). Neutral card; the only warning treatment is
            the tinted row metadata text (spec §2), never a red card. */}
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
                  <div className={styles.queueRowText}>
                    <p className={styles.queueRowTitle}>{itemTitle(item)}</p>
                    <p className={styles.rejectedMeta}>
                      {[t.rejectedBy(actorName(item.rejectedBy)), formatWhen(item.rejectedAt)].join(
                        " · "
                      )}
                    </p>
                  </div>
                  <span className={styles.chevron} aria-hidden="true">
                    ‹
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </QueueSection>

        {/* 4 — Employee Drafts, grouped by employee. Groups are not links
            yet: there is no drafts-filtered-by-employee screen to deep-link
            to (spec §8 wants one; that's the CTA's future destination). */}
        <QueueSection
          title={t.sections.employeeDrafts}
          emptyText={t.empty.employeeDrafts}
          cta={{ href: "/admin/talent", label: t.cta.employeeDrafts }}
          hasItems={dashboard.employeeDrafts.groups.length > 0}
        >
          <ul className={styles.queueList}>
            {dashboard.employeeDrafts.groups.map((group) => (
              <li key={group.key} className={styles.queueRow}>
                <div className={styles.queueRowText}>
                  <p className={styles.queueRowTitle}>{actorName(group.employee)}</p>
                  <p className={styles.queueRowMeta}>
                    {[
                      t.draftCount(group.draftCount),
                      t.lastUpdated(formatWhen(group.lastUpdatedAt)),
                    ].join(" · ")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </QueueSection>

        {/* 5 — Recent Publishes (Sprint 5a): what most recently went live,
            newest first. Neutral card, same shell as Rejected Items/
            Employee Drafts — no accent, no special warning treatment. Rows
            deep-link like Pending Approvals/Rejected Items. */}
        <QueueSection
          title={`${t.sections.recentPublishes} · ${dashboard.recentPublishes.totalCount}`}
          emptyText={t.empty.recentPublishes}
          cta={{ href: "/admin/talent", label: t.cta.recentPublishes }}
          hasItems={dashboard.recentPublishes.items.length > 0}
        >
          <ul className={styles.queueList}>
            {dashboard.recentPublishes.items.map((item) => (
              <li key={item.key}>
                <Link href={item.href} className={styles.queueRow}>
                  <div className={styles.queueRowText}>
                    <p className={styles.queueRowTitle}>{itemTitle(item)}</p>
                    <p className={styles.queueRowMeta}>
                      {[
                        t.publishedBy(actorName(item.publishedBy)),
                        formatWhen(item.publishedAt),
                        item.itemCount > 1 ? t.itemCount(item.itemCount) : null,
                      ]
                        .filter((part) => part !== null)
                        .join(" · ")}
                    </p>
                  </div>
                  <span className={styles.chevron} aria-hidden="true">
                    ‹
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </QueueSection>
      </div>
    </AdminShell>
  );
}
