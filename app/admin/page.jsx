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
 * work-focused landing: a Hebrew greeting plus the one working link into
 * /admin/talent.
 *
 * Pre-merge stabilization: the workflow summary tiles (Waiting for
 * Approval / Changes Requested / Recently Published counts) were removed —
 * they were fed by lib/admin/mock-workflow.js's hardcoded demo items, so
 * they showed the Owner fictitious counts. Restore them only once they can
 * be derived from a real engine query (e.g. a future
 * versionService.listForOwner()); the CSS for the grid
 * (dashboard.module.css .summaryGrid/.summaryTile/.summaryCount) is left
 * in place for that reintroduction.
 */

import AdminShell from './AdminShell';
import PageHeader from '@/components/admin/PageHeader';
import Card from '@/components/admin/Card';
import PrimaryButton from '@/components/admin/PrimaryButton';
import { he } from '@/lib/admin/i18n/he';
import styles from './dashboard.module.css';

export const metadata = {
  title: 'לוח בקרה — ניהול',
};

export default function AdminDashboardPage() {
  return (
    <AdminShell>
      <PageHeader title={he.nav.dashboard} />

      <Card>
        <h2 className={styles.greeting}>{he.dashboard.greeting('בר')}</h2>
        <p className={styles.subline}>{he.dashboard.subline}</p>
      </Card>

      <Card title="מיוצגים">
        <p className={styles.talentCardText}>ניהול רשימת המיוצגים — שמות, סטטוס ופרסום.</p>
        <PrimaryButton href="/admin/talent">למיוצגים ←</PrimaryButton>
      </Card>
    </AdminShell>
  );
}
