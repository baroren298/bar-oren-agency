/*
 * /admin/talent/[id] — Sprint 4.2 (read-only detail), reworked by the
 * "Talent Workspace Foundation" sprint into the talent's workspace: a
 * header (name, workflow status, last updated) plus workspace navigation
 * with five placeholder sections (פרטים / גלריה / רשתות / SEO / היסטוריה),
 * per the product vision — opening a talent should feel like opening
 * their working folder, not a CRUD edit screen.
 *
 * Still strictly read-only, still calling straight into the existing Core
 * Content Engine read path — no new repository/adapter/engine code, no
 * API route, no Prisma changes. The one addition to the data calls already
 * made here (getCurrentPublished, getCurrentDraftOrProposed) is
 * versionService.listVersionHistory, which already existed unused by this
 * page — adding it lets lib/admin/talent-workspace.js derive the real
 * four-state status (including "changes requested", via a REJECTED
 * version) instead of just three, see that module's header comment.
 *
 * No editing, no propose/approve/reject actions, no gallery/socials/SEO
 * content yet — those four sections are intentionally empty-state
 * placeholders this sprint (requirement #2: "No editing required yet.
 * Just create the layout and placeholders").
 *
 * Database-deferred bridge unchanged: still `force-dynamic` + the
 * `isDatabaseConfigured` guard.
 */

import { notFound } from 'next/navigation';
import { versionService } from '@/lib/admin/engine/versionService';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';
import { isDatabaseConfigured } from '@/lib/admin/db';
import AdminShell from '../../AdminShell';
import PageHeader from '@/components/admin/PageHeader';
import Card from '@/components/admin/Card';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';
import TalentWorkspaceTabs from './TalentWorkspaceTabs';
import {
  TALENT_WORKSPACE_SECTIONS,
  deriveDetailWorkflowStatus,
  deriveLastUpdated,
  formatHebrewDate,
  workflowStatusLabel,
  workflowStatusTone,
} from '@/lib/admin/talent-workspace';
import { he } from '@/lib/admin/i18n/he';
import styles from './talent-detail.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'סביבת עבודה — מיוצג',
};

function FieldRow({ label, value }) {
  return (
    <div className={styles.fieldRow}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.fieldValue}>
        {value === null || value === undefined || value === '' ? he.talent.fields.empty : String(value)}
      </span>
    </div>
  );
}

function DetailsSectionContent({ publishedVersion }) {
  if (!publishedVersion) {
    return (
      <EmptyState
        title={he.talent.detail.noPublishedVersionTitle}
        description={he.talent.detail.noPublishedVersionDescription}
      />
    );
  }

  return (
    <Card>
      <div className={styles.fieldList}>
        <FieldRow label={he.talent.fields.name} value={publishedVersion.name} />
        <FieldRow label={he.talent.fields.nameEn} value={publishedVersion.nameEn} />
        <FieldRow
          label={he.talent.fields.category}
          value={Array.isArray(publishedVersion.category) ? publishedVersion.category.join(', ') : null}
        />
        <FieldRow
          label={he.talent.fields.tags}
          value={Array.isArray(publishedVersion.tags) ? publishedVersion.tags.join(', ') : null}
        />
        <FieldRow label={he.talent.fields.location} value={publishedVersion.location} />
        <FieldRow label={he.talent.fields.locationEn} value={publishedVersion.locationEn} />
        <FieldRow
          label={he.talent.fields.featured}
          value={publishedVersion.featured ? he.talent.fields.yes : he.talent.fields.no}
        />
        <FieldRow label={he.talent.fields.bio} value={publishedVersion.bioHe} />
        <FieldRow label={he.talent.fields.bioEn} value={publishedVersion.bioEn} />
      </div>
    </Card>
  );
}

function PlaceholderSectionContent({ label }) {
  return (
    <EmptyState
      title={he.talent.sectionPlaceholder.title}
      description={he.talent.sectionPlaceholder.description(label)}
    />
  );
}

export default async function AdminTalentDetailPage({ params }) {
  if (!isDatabaseConfigured) {
    return (
      <AdminShell>
        <a href="/admin/talent" className={styles.backLink}>
          {he.talent.detail.backToList}
        </a>
        <EmptyState description={he.talent.detail.dbNotConfiguredDescription} />
      </AdminShell>
    );
  }

  const { id } = await params;

  const talent = await talentAdapter.getParent(id);
  if (!talent) {
    notFound();
  }

  const [publishedVersion, versions] = await Promise.all([
    versionService.getCurrentPublished(talentAdapter, id),
    versionService.listVersionHistory(talentAdapter, id),
  ]);

  const status = deriveDetailWorkflowStatus(versions);
  const lastUpdated = deriveLastUpdated(versions, talent);
  const displayName = publishedVersion?.name || talent.slug;

  const sections = TALENT_WORKSPACE_SECTIONS.map((section) => {
    if (section.key === 'details') {
      return { ...section, content: <DetailsSectionContent publishedVersion={publishedVersion} /> };
    }
    return { ...section, content: <PlaceholderSectionContent label={section.label} /> };
  });

  return (
    <AdminShell>
      <a href="/admin/talent" className={styles.backLink}>
        {he.talent.detail.backToList}
      </a>

      <PageHeader
        title={displayName}
        description={`${he.talent.meta.lastUpdated}: ${formatHebrewDate(lastUpdated)}`}
        action={<StatusBadge label={workflowStatusLabel(status)} tone={workflowStatusTone(status)} />}
      />

      <div className={styles.metaCard}>
        <Card as="section">
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>{he.talent.detail.slug}</span>
              <span className={styles.metaValue}>{talent.slug}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>{he.talent.detail.visibilityStatus}</span>
              <span className={styles.metaValue}>{talent.status}</span>
            </div>
          </div>
        </Card>
      </div>

      <TalentWorkspaceTabs sections={sections} />
    </AdminShell>
  );
}
