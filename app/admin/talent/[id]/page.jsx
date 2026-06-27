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
 * Details/Gallery/Socials/SEO/History now each have a real (still fully
 * local, still no persistence) UI — see DetailsSectionContent,
 * GallerySectionContent, SocialsSectionContent, SeoSectionContent,
 * HistorySectionContent below. History Tab Real Data sprint: History now
 * renders <Timeline> from the real `versions` array already fetched on
 * this page (versionService.listVersionHistory) — see
 * lib/admin/talent-workspace.js's buildVersionHistoryTimelineItems for the
 * row -> Timeline-item mapping. lib/admin/mock-history.js is left in place,
 * unused, per that sprint's explicit scope (not deleted).
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
import MediaGalleryEditor from '@/components/admin/MediaGalleryEditor';
import SocialLinksEditor from '@/components/admin/SocialLinksEditor';
import SeoEditor from '@/components/admin/SeoEditor';
import Timeline from '@/components/admin/Timeline';
import TalentWorkspaceTabs from './TalentWorkspaceTabs';
import { getTalentBySlug } from '@/data/talent';
import {
  TALENT_WORKSPACE_SECTIONS,
  deriveDetailWorkflowStatus,
  deriveLastUpdated,
  formatHebrewDate,
  workflowStatusLabel,
  workflowStatusTone,
  buildVersionHistoryTimelineItems,
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

/*
 * Gallery Editor Foundation sprint — normalizes a talent's published
 * gallery entries (each either a plain string path or a
 * { src, position, scale } override object, per data/talent/index.js's
 * documented field shape) into the flat { src, alt } shape
 * MediaGalleryEditor/PublishedMediaGrid/GalleryImageCard expect.
 *
 * Deliberately reads from data/talent/index.js rather than the database:
 * per talentMapper.js's own "PHASE 1 NOTE", the public website still
 * renders straight from that file today (no gallery query exists yet on
 * talentAdapter/versionService, and adding one is out of scope for a
 * UI-only sprint) — so data/talent/index.js *is* the accurate "what's
 * currently live" source for a gallery, exactly like the public
 * ProfileGallery component itself reads. Read-only: nothing here writes
 * to that file or to the public site.
 */
function buildGalleryImages(talentSlug, displayName) {
  const publicTalent = talentSlug ? getTalentBySlug(talentSlug) : null;
  const rawGallery = publicTalent?.gallery || [];

  return rawGallery.map((entry, index) => {
    const src = typeof entry === 'string' ? entry : entry.src;
    return { src, alt: he.gallery.imageAlt(displayName, index) };
  });
}

function GallerySectionContent({ talentSlug, displayName }) {
  const images = buildGalleryImages(talentSlug, displayName);
  return <MediaGalleryEditor publishedImages={images} />;
}

/*
 * Social Links Editor Foundation sprint — same reasoning as
 * buildGalleryImages above: data/talent/index.js (read via getTalentBySlug)
 * is the accurate "what's currently live" source today, since the public
 * site still renders straight from that file and no social-links query
 * exists yet on talentAdapter/versionService. Read-only, nothing here
 * writes anywhere.
 *
 * Only instagram/tiktok/youtube exist on that data shape today (see
 * data/talent/index.js's own field-shape comment); facebook/website aren't
 * modeled there yet, so they're surfaced as `null` — SocialLinkRow already
 * renders `null` as a calm "לא קיים" placeholder, exactly like a platform
 * that genuinely has no account yet.
 */
function buildSocialLinks(talentSlug) {
  const publicTalent = talentSlug ? getTalentBySlug(talentSlug) : null;

  return {
    instagram: publicTalent?.instagram ?? null,
    tiktok: publicTalent?.tiktok ?? null,
    youtube: publicTalent?.youtube ?? null,
    facebook: null,
    website: null,
  };
}

function SocialsSectionContent({ talentSlug }) {
  const publishedLinks = buildSocialLinks(talentSlug);
  return <SocialLinksEditor publishedLinks={publishedLinks} />;
}

/*
 * SEO Editor Foundation sprint — same reasoning as buildSocialLinks above:
 * no seo query exists yet on talentAdapter/versionService (and adding one
 * is out of scope for a UI-only sprint), and data/talent/index.js doesn't
 * model SEO fields at all today. So every field is surfaced as `null` —
 * SeoFieldRow already renders `null` as a calm "לא קיים" placeholder,
 * exactly like a talent that genuinely has no SEO metadata set yet.
 * Wiring this up to a real "page SEO" record is later work; this sprint
 * only prepares the layout and the editing surface.
 */
function buildSeoFields() {
  return {
    title: null,
    description: null,
    keywords: [],
    ogTitle: null,
    ogDescription: null,
  };
}

function SeoSectionContent() {
  const publishedSeo = buildSeoFields();
  return <SeoEditor publishedSeo={publishedSeo} />;
}

/*
 * History Tab Real Data sprint — renders <Timeline> from the real
 * version-history rows already fetched on this page
 * (versionService.listVersionHistory(talentAdapter, id), passed in as
 * `versions`), instead of lib/admin/mock-history.js's getTalentHistory().
 * All the row -> { action, date, user, summary, tone } mapping logic lives
 * in lib/admin/talent-workspace.js's buildVersionHistoryTimelineItems,
 * which reuses the same workflowStatusLabel/workflowStatusTone helpers
 * <StatusBadge> uses elsewhere on this page, per that sprint's requirement
 * to reuse existing label/tone vocabulary rather than inventing a new one.
 * <Timeline> itself is unchanged — it already renders an EmptyState when
 * `items` is empty (a brand-new talent with no versions yet).
 */
function HistorySectionContent({ versions }) {
  const items = buildVersionHistoryTimelineItems(versions);
  return <Timeline items={items} />;
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
    if (section.key === 'gallery') {
      return {
        ...section,
        content: <GallerySectionContent talentSlug={talent.slug} displayName={displayName} />,
      };
    }
    if (section.key === 'socials') {
      return { ...section, content: <SocialsSectionContent talentSlug={talent.slug} /> };
    }
    if (section.key === 'seo') {
      return { ...section, content: <SeoSectionContent /> };
    }
    if (section.key === 'history') {
      return { ...section, content: <HistorySectionContent versions={versions} /> };
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
