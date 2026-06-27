/*
 * /admin/talent — Sprint 4.1/4.2 (read-only roster), reworked by the
 * "Talent Workspace Foundation" sprint into a work-queue list per the
 * product vision: this should feel like an employee's queue of profiles to
 * act on, not a directory/CMS table.
 *
 * Still strictly read-only and still calling straight into the existing
 * Core Content Engine read path (versionService.listParents +
 * talentAdapter) — no new repository/adapter/engine code, no API route,
 * no Prisma changes. Only the Presentation layer changed: PageHeader +
 * EmptyState + the new TalentQueueRow (Card + StatusBadge) replace the
 * plain <table>, and status/summary text is derived from the exact same
 * fields the old table read (`hasPublishedVersion`, `hasPendingChanges`) —
 * see lib/admin/talent-workspace.js's header comment for why a full
 * four-state status (incl. "changes requested") isn't derivable from this
 * particular list query yet, and why that's a deliberate scope line for
 * this sprint rather than an oversight.
 *
 * Database-deferred bridge unchanged: still `force-dynamic` + the
 * `isDatabaseConfigured` guard (see lib/admin/db.js) so this page never
 * runs its Prisma-backed engine call during `next build`/Preview with no
 * DATABASE_URL set.
 */

import { versionService } from '@/lib/admin/engine/versionService';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';
import { isDatabaseConfigured } from '@/lib/admin/db';
import AdminShell from '../AdminShell';
import PageHeader from '@/components/admin/PageHeader';
import EmptyState from '@/components/admin/EmptyState';
import TalentListClient from './TalentListClient';
import { he } from '@/lib/admin/i18n/he';
import styles from './talent.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'מיוצגים — ניהול',
};

export default async function AdminTalentListPage() {
  if (!isDatabaseConfigured) {
    return (
      <AdminShell>
        <PageHeader title={he.talent.list.title} />
        <EmptyState
          title={he.talent.list.dbNotConfiguredTitle}
          description={he.talent.list.dbNotConfiguredDescription}
        />
      </AdminShell>
    );
  }

  const talents = await versionService.listParents(talentAdapter, {});

  return (
    <AdminShell>
      <PageHeader title={he.talent.list.title} />

      {talents.length === 0 ? (
        <EmptyState title={he.talent.list.emptyTitle} description={he.talent.list.emptyDescription} />
      ) : (
        <TalentListClient talents={talents} />
      )}
    </AdminShell>
  );
}
