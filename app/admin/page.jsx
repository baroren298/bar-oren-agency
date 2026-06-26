/*
 * /admin — dashboard landing page.
 *
 * Server Component. No auth code lives here: middleware.js already gates
 * every /admin/* path except the allow-listed /admin/login (see its header
 * comment), so this route is protected purely by reusing that existing
 * check — nothing new to wire up.
 *
 * Admin Hebrew + Friendly Home sprint: replaced the previous generic
 * "Talent management" / "Admin foundation ready" cards with a warm,
 * work-focused landing: a Hebrew greeting, then a compact summary of the
 * same workflow statuses already defined in lib/admin/mock-workflow.js
 * (the same data source /admin/my-work uses), so an employee logging in
 * immediately sees what needs attention instead of a cold technical
 * dashboard. Still no database/API logic — purely a different read of the
 * existing mock data — and the one working link into /admin/talent is
 * kept, just restyled to fit the new layout.
 */

import AdminShell from './AdminShell';
import PageHeader from '@/components/admin/PageHeader';
import Card from '@/components/admin/Card';
import PrimaryButton from '@/components/admin/PrimaryButton';
import StatusBadge from '@/components/admin/StatusBadge';
import MOCK_WORKFLOW_ITEMS, { WORKFLOW_STATUS } from '@/lib/admin/mock-workflow';
import { he } from '@/lib/admin/i18n/he';
import styles from './dashboard.module.css';

export const metadata = {
  title: 'לוח בקרה — ניהול',
};

export default function AdminDashboardPage() {
  const waitingForApproval = MOCK_WORKFLOW_ITEMS.filter(
    (item) => item.status === WORKFLOW_STATUS.WAITING_FOR_APPROVAL
  );
  const changesRequested = MOCK_WORKFLOW_ITEMS.filter(
    (item) => item.status === WORKFLOW_STATUS.CHANGES_REQUESTED
  );
  const recentlyPublished = MOCK_WORKFLOW_ITEMS.filter(
    (item) => item.status === WORKFLOW_STATUS.PUBLISHED
  ).sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));

  const summaryTiles = [
    {
      key: 'waiting_for_approval',
      label: he.dashboard.summary.waitingForApproval,
      count: waitingForApproval.length,
      tone: 'warning',
    },
    {
      key: 'changes_requested',
      label: he.dashboard.summary.changesRequested,
      count: changesRequested.length,
      tone: 'danger',
    },
    {
      key: 'recently_published',
      label: he.dashboard.summary.recentlyPublished,
      count: recentlyPublished.length,
      tone: 'success',
    },
  ];

  return (
    <AdminShell>
      <PageHeader title={he.nav.dashboard} />

      <Card>
        <h2 className={styles.greeting}>{he.dashboard.greeting('בר')}</h2>
        <p className={styles.subline}>{he.dashboard.subline}</p>
      </Card>

      <div className={styles.summaryGrid}>
        {summaryTiles.map((tile) => (
          <Card key={tile.key}>
            <div className={styles.summaryTile}>
              <span className={styles.summaryCount}>{tile.count}</span>
              <StatusBadge label={tile.label} tone={tile.tone} />
            </div>
          </Card>
        ))}
      </div>

      <Card title="מיוצגים">
        <p className={styles.talentCardText}>ניהול רשימת המיוצגים — שמות, סטטוס ופרסום.</p>
        <PrimaryButton href="/admin/talent">למיוצגים ←</PrimaryButton>
      </Card>
    </AdminShell>
  );
}
