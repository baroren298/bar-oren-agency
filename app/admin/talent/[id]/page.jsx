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
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';
import ComparisonView from '@/components/admin/ComparisonView';
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

/*
 * Field config for the פרטים editing experience — Editing Experience
 * Foundation sprint, regrouped by the Profile Editor Foundation sprint.
 * Maps the same published-version fields the previous read-only view
 * showed into <ComparisonView>'s generic group shape:
 * { key, label, fields: { key, label, value, type }[] }[]. This is the
 * only place that knows "name is text, category is a list, featured is a
 * boolean, and they belong in these four groups" for talent —
 * ComparisonView itself stays entity-agnostic so the same component can be
 * reused for Gallery/SEO/Social links/Homepage/etc. later, each with its
 * own grouping.
 */
function buildDetailsGroups(publishedVersion) {
  return [
    {
      key: 'basic',
      label: he.talent.detailGroups.basic,
      fields: [
        { key: 'name', label: he.talent.fields.name, type: 'text', value: publishedVersion.name },
        { key: 'nameEn', label: he.talent.fields.nameEn, type: 'text', value: publishedVersion.nameEn },
        {
          key: 'featured',
          label: he.talent.fields.featured,
          type: 'boolean',
          value: Boolean(publishedVersion.featured),
        },
      ],
    },
    {
      key: 'bio',
      label: he.talent.detailGroups.bio,
      fields: [
        { key: 'bioHe', label: he.talent.fields.bio, type: 'textarea', value: publishedVersion.bioHe },
        { key: 'bioEn', label: he.talent.fields.bioEn, type: 'textarea', value: publishedVersion.bioEn },
      ],
    },
    {
      key: 'categories',
      label: he.talent.detailGroups.categories,
      fields: [
        { key: 'category', label: he.talent.fields.category, type: 'list', value: publishedVersion.category },
        { key: 'tags', label: he.talent.fields.tags, type: 'list', value: publishedVersion.tags },
      ],
    },
    {
      key: 'location',
      label: he.talent.detailGroups.location,
      fields: [
        { key: 'location', label: he.talent.fields.location, type: 'text', value: publishedVersion.location },
        {
          key: 'locationEn',
          label: he.talent.fields.locationEn,
          type: 'text',
          value: publishedVersion.locationEn,
        },
      ],
    },
  ];
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

  return <ComparisonView groups={buildDetailsGroups(publishedVersion)} />;
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

      <TalentWorkspaceTabs sections={sections} />

      <details className={styles.technicalInfo}>
        <summary className={styles.technicalInfoSummary}>{he.talent.detail.technicalInfo}</summary>
        <div className={styles.technicalInfoBody}>
          <span className={styles.technicalInfoHint}>{he.talent.detail.technicalInfoHint}</span>
          <div className={styles.technicalInfoRow}>
            <span className={styles.technicalInfoLabel}>{he.talent.detail.slug}</span>
            <span className={styles.technicalInfoValue}>{talent.slug}</span>
          </div>
        </div>
      </details>
    </AdminShell>
  );
}
