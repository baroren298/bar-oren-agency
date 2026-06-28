/*
 * /admin/talent/new — "Add New Talent" sprint.
 *
 * Server Component shell, same database-deferred bridge pattern as
 * app/admin/talent/page.jsx (`force-dynamic` + `isDatabaseConfigured`
 * guard) — this route reads nothing on render (it's the form), but the
 * form's submit calls POST /api/admin/talent, which does touch the
 * database, so the same "don't even offer the form with no DB" guard
 * applies here.
 *
 * Talent's stable parent record carries the slug + lifecycle status; its
 * first content snapshot is a TalentVersion, exactly like every other
 * talent (see talentRepository.createTalentWithInitialVersion). All the
 * actual create logic lives in NewTalentForm.jsx (client) + the new POST
 * route — this file is just layout.
 */

import { isDatabaseConfigured } from '@/lib/admin/db';
import AdminShell from '../../AdminShell';
import PageHeader from '@/components/admin/PageHeader';
import EmptyState from '@/components/admin/EmptyState';
import NewTalentForm from './NewTalentForm';
import { he } from '@/lib/admin/i18n/he';
import styles from './new-talent.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'יצירת מיוצג חדש — ניהול',
};

export default function NewTalentPage() {
  if (!isDatabaseConfigured) {
    return (
      <AdminShell>
        <PageHeader title={he.talent.create.pageTitle} />
        <EmptyState
          title={he.talent.create.dbNotConfiguredTitle}
          description={he.talent.create.dbNotConfiguredDescription}
        />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className={styles.tokens}>
        <a href="/admin/talent" className={styles.backLink}>
          {he.talent.create.backToList}
        </a>

        <PageHeader title={he.talent.create.pageTitle} description={he.talent.create.pageDescription} />

        <NewTalentForm />
      </div>
    </AdminShell>
  );
}
