/*
 * /admin — dashboard landing page (Phase 4 foundation).
 *
 * Server Component. No auth code lives here: middleware.js already gates
 * every /admin/* path except the allow-listed /admin/login (see its header
 * comment), so this route is protected purely by reusing that existing
 * check — nothing new to wire up.
 *
 * Phase 4 layout sprint: now wrapped in AdminShell (header + sidebar +
 * content) instead of supplying its own <main> padding — see
 * ./AdminShell.jsx for the shared shell. No change to the page's own
 * content/behavior.
 *
 * Deliberately minimal per this sprint's scope: a title, a one-line
 * welcome, and a single nav link into /admin/talent. No stats, no charts,
 * no additional nav until those sections actually exist.
 *
 * Admin Design System Foundation sprint: rebuilt with the new
 * components/admin/** components (PageHeader, Card, PrimaryButton,
 * SecondaryButton, StatusBadge, EmptyState) in place of inline styles, as
 * the worked example for later pages to copy. Same facts as before — no
 * new data, no invented statistics; the "Read-only" badge just restates
 * what app/admin/talent/page.jsx's own heading already says. Still a
 * single working link into /admin/talent; no routing change.
 *
 * Admin Dashboard Polish sprint: tightened the layout into two cards —
 * a primary "Talent management" card (the one real, working link into
 * /admin/talent) and a small "Admin foundation ready" status card. Both
 * are factual statements about the admin shell/design-system work that's
 * already shipped, not product metrics — still no fake numbers, no fake
 * recent-activity feed, and no nav/links to sections that don't exist yet
 * (the EmptyState used previously named future sections by name, which
 * reads like placeholder navigation, so it's dropped here). Page still
 * renders nothing but AdminShell + these components; no new data fetching,
 * no routing change, no change to how /admin is protected.
 */

import AdminShell from './AdminShell';
import PageHeader from '@/components/admin/PageHeader';
import Card from '@/components/admin/Card';
import PrimaryButton from '@/components/admin/PrimaryButton';
import StatusBadge from '@/components/admin/StatusBadge';

export const metadata = {
  title: 'Admin — Bar Oren Agency',
};

export default function AdminDashboardPage() {
  return (
    <AdminShell>
      <PageHeader title="Dashboard" description="Welcome back. Here's where to manage the agency's admin tools." />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'stretch' }}>
        <div style={{ flex: '2 1 320px' }}>
          <Card title="Talent management">
            <p style={{ margin: '0 0 1.25rem' }}>
              Manage the talent roster — names, slugs, status, and publish state.
            </p>
            <PrimaryButton href="/admin/talent">Open Talent →</PrimaryButton>
          </Card>
        </div>

        <div style={{ flex: '1 1 220px' }}>
          <Card title="Admin foundation">
            <p style={{ margin: '0 0 1rem' }}>Admin shell, navigation, and design system are set up.</p>
            <StatusBadge label="Ready" tone="success" />
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
