/*
 * /admin/talent/[id] — Sprint 4.2 (read-only detail), reworked by the
 * "Talent Workspace Foundation" sprint into the talent's workspace: a
 * header (name, workflow status, last updated) plus workspace navigation
 * with five placeholder sections (פרטים / גלריה / רשתות / SEO / היסטוריה),
 * per the product vision — opening a talent should feel like opening
 * their working folder, not a CRUD edit screen.
 *
 * Calls straight into the existing Core Content Engine read path — no new
 * repository/adapter/engine code, no API route, no Prisma changes. The one
 * addition to the data calls already made here (getCurrentPublished,
 * getCurrentDraftOrProposed) is versionService.listVersionHistory, which
 * already existed unused by this page — adding it lets
 * lib/admin/talent-workspace.js derive the real four-state status
 * (including "changes requested", via a REJECTED version) instead of just
 * three, see that module's header comment.
 *
 * Draft Editing Foundation sprint, corrected per architecture review —
 * Details tab only: `loadPendingVersion()` below is a **pure read**. It
 * calls `versionService.getCurrentDraftOrProposed` (an existing,
 * already-read-only method) and nothing else. It NEVER calls
 * `proposalService.create()` or any other write — opening this page must
 * never create a Draft or write anything to the database, no matter what
 * state the talent is in. If a DRAFT or PROPOSED version already exists in
 * the database, it's loaded and its fields are shown in <ComparisonView>'s
 * proposed column (via `draftValue`); if neither exists, only the
 * Published version is shown, exactly as before this feature existed.
 *
 * Starting a brand-new Draft is intentionally not done by this file. The
 * "Start Editing" sprint adds that as its own explicit user action:
 * <StartEditingButton> (components/admin/StartEditingButton.jsx) renders
 * conditionally below, reflecting the exact same `pendingVersion` this page
 * already read above, and POSTs to app/api/admin/talent/[id]/proposals/
 * route.js on click — this page itself still performs zero writes on
 * render, no matter what state the talent is in.
 *
 * Gallery/Socials/SEO sections are untouched by this pass — still the
 * fully local, no-persistence UI from earlier sprints.
 *
 * Database-deferred bridge unchanged: still `force-dynamic` + the
 * `isDatabaseConfigured` guard.
 *
 * Talent Detail DB Read Integration sprint — Gallery and Socials are no
 * longer "untouched": they now read the talent's published
 * TalentGalleryImage/TalentSocial rows (via two new pure-read
 * talentAdapter methods, getGalleryImages/getSocials — see that file and
 * talentRepository.js for the new repository primitives) instead of
 * data/talent/index.js. SEO stays exactly as it was (no SEO model/query
 * exists yet, and adding one is out of this sprint's scope) — still
 * hardcoded `null`s. The editor components themselves
 * (MediaGalleryEditor/SocialLinksEditor and everything they render) are
 * unchanged; only what's fed into their `published*` props changed, and
 * still only PUBLISHED + ACTIVE rows are ever shown, never a pending edit.
 * Still zero writes, still `force-dynamic`.
 */

import { notFound } from 'next/navigation';
import { versionService } from '@/lib/admin/engine/versionService';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';
import { isDatabaseConfigured } from '@/lib/admin/db';
import AdminShell from '../../AdminShell';
import PageHeader from '@/components/admin/PageHeader';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';
import StartEditingButton from '@/components/admin/StartEditingButton';
import TalentDetailsEditor from '@/components/admin/TalentDetailsEditor';
import MediaGalleryEditor from '@/components/admin/MediaGalleryEditor';
import SocialLinksEditor from '@/components/admin/SocialLinksEditor';
import SeoEditor from '@/components/admin/SeoEditor';
import Timeline from '@/components/admin/Timeline';
import TalentWorkspaceTabs from './TalentWorkspaceTabs';
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
import { VERSION_STATUS } from '@/lib/admin/constants/enums';
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
/*
 * `pendingVersion` is optional (null when neither a DRAFT nor a PROPOSED
 * version exists yet, or it just hasn't been created — see
 * loadPendingVersion below, which is a pure read and never creates one).
 * Each field's `draftValue` is left `undefined` whenever there's nothing
 * pending to read from, which <ComparisonView> already treats as "fall
 * back to the published value" (its existing, unchanged default).
 */
function buildDetailsGroups(publishedVersion, pendingVersion) {
  const pending = pendingVersion || {};

  return [
    {
      key: 'basic',
      label: he.talent.detailGroups.basic,
      fields: [
        {
          key: 'name',
          label: he.talent.fields.name,
          type: 'text',
          value: publishedVersion.name,
          draftValue: pendingVersion ? pending.name : undefined,
        },
        {
          key: 'nameEn',
          label: he.talent.fields.nameEn,
          type: 'text',
          value: publishedVersion.nameEn,
          draftValue: pendingVersion ? pending.nameEn : undefined,
        },
        {
          key: 'featured',
          label: he.talent.fields.featured,
          type: 'boolean',
          value: Boolean(publishedVersion.featured),
          draftValue: pendingVersion ? Boolean(pending.featured) : undefined,
        },
      ],
    },
    {
      key: 'bio',
      label: he.talent.detailGroups.bio,
      fields: [
        {
          key: 'bioHe',
          label: he.talent.fields.bio,
          type: 'textarea',
          value: publishedVersion.bioHe,
          draftValue: pendingVersion ? pending.bioHe : undefined,
        },
        {
          key: 'bioEn',
          label: he.talent.fields.bioEn,
          type: 'textarea',
          value: publishedVersion.bioEn,
          draftValue: pendingVersion ? pending.bioEn : undefined,
        },
      ],
    },
    {
      key: 'categories',
      label: he.talent.detailGroups.categories,
      fields: [
        {
          key: 'category',
          label: he.talent.fields.category,
          type: 'list',
          value: publishedVersion.category,
          draftValue: pendingVersion ? pending.category : undefined,
        },
        {
          key: 'tags',
          label: he.talent.fields.tags,
          type: 'list',
          value: publishedVersion.tags,
          draftValue: pendingVersion ? pending.tags : undefined,
        },
      ],
    },
    {
      key: 'location',
      label: he.talent.detailGroups.location,
      fields: [
        {
          key: 'location',
          label: he.talent.fields.location,
          type: 'text',
          value: publishedVersion.location,
          draftValue: pendingVersion ? pending.location : undefined,
        },
        {
          key: 'locationEn',
          label: he.talent.fields.locationEn,
          type: 'text',
          value: publishedVersion.locationEn,
          draftValue: pendingVersion ? pending.locationEn : undefined,
        },
      ],
    },
  ];
}

/*
 * "Editable PROPOSED" sprint — both DRAFT and PROPOSED are now editable
 * (server-side authority lives in proposalService.update()'s status guard;
 * this is just the UI reflecting the same rule without an extra round
 * trip). Product decision: a PROPOSED version stays editable in place until
 * a future sprint's Owner review locks it — no IN_REVIEW status, no Owner
 * locking, no Approve/Reject/Publish here. `talentId`/`versionId`/
 * `versionStatus` flow through <TalentDetailsEditor>, the one place that
 * owns the actual Save/Update network call (required safeguard #2);
 * `versionStatus` is what lets it pick the right button label and decide
 * whether Submit may be offered at all (Submit stays DRAFT-only).
 */
function DetailsSectionContent({ talentId, publishedVersion, pendingVersion }) {
  if (!publishedVersion) {
    return (
      <EmptyState
        title={he.talent.detail.noPublishedVersionTitle}
        description={he.talent.detail.noPublishedVersionDescription}
      />
    );
  }

  const isEditablePending =
    pendingVersion?.status === VERSION_STATUS.DRAFT || pendingVersion?.status === VERSION_STATUS.PROPOSED;
  const editableVersionId = isEditablePending ? pendingVersion.id : null;

  return (
    <TalentDetailsEditor
      talentId={talentId}
      versionId={editableVersionId}
      versionStatus={isEditablePending ? pendingVersion.status : null}
      groups={buildDetailsGroups(publishedVersion, pendingVersion)}
    />
  );
}

/*
 * Architecture review correction: opening this page must be a pure read —
 * viewing /admin/talent/[id] may never create a Draft or write anything.
 * This function does exactly one thing: load whatever pending version
 * (DRAFT or PROPOSED) already exists via the existing, already-read-only
 * `versionService.getCurrentDraftOrProposed`. It calls no `insert*`/
 * `submit*`/`publish*`/`reject*` method, and therefore performs zero
 * database writes. If nothing is pending, it returns null and the caller
 * falls back to showing only the Published version — there is no creation
 * path here at all. Starting a new Draft is a future, explicit user action
 * ("Start Editing"), not a side effect of loading this page.
 *
 * Never throws: an unexpected read failure is caught and logged, then
 * treated the same as "nothing pending," so a transient engine/DB error
 * degrades to the published-only view rather than a broken page.
 *
 * @param {object} talent - talentAdapter.getParent() result
 * @returns {Promise<object|null>} the pending DRAFT or PROPOSED version, or null
 */
async function loadPendingVersion(talent) {
  try {
    return await versionService.getCurrentDraftOrProposed(talentAdapter, talent.id);
  } catch (error) {
    console.error('[AdminTalentDetailPage] loadPendingVersion failed, falling back to published-only:', error);
    return null;
  }
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
 * Talent Detail DB Read Integration sprint — replaces the previous
 * data/talent/index.js read with the real published gallery rows
 * (talentAdapter.getGalleryImages, already filtered to
 * versionStatus=PUBLISHED + lifecycleStatus=ACTIVE by the repository), and
 * normalizes them into the same flat { src, alt } shape
 * MediaGalleryEditor/PublishedMediaGrid/GalleryImageCard already expect —
 * the editor component itself is untouched. `altHe` is used when present
 * (DB-authored alt text); falls back to the same generated
 * "<name> — תמונה N" label the mock data path used, so a row with no alt
 * text yet still renders identically to before. Read-only.
 */
function buildGalleryImages(galleryImages, displayName) {
  return (galleryImages || []).map((row, index) => ({
    src: row.imageAsset?.blobUrl ?? null,
    alt: row.altHe || he.gallery.imageAlt(displayName, index),
  }));
}

function GallerySectionContent({ galleryImages, displayName }) {
  const images = buildGalleryImages(galleryImages, displayName);
  return <MediaGalleryEditor publishedImages={images} />;
}

/*
 * Talent Detail DB Read Integration sprint — replaces the previous
 * data/talent/index.js read with the real published TalentSocial rows
 * (talentAdapter.getSocials, already filtered to versionStatus=PUBLISHED +
 * lifecycleStatus=ACTIVE by the repository).
 *
 * <SocialLinksEditor> renders exactly one row per platform (a single
 * string|null value) — that UI shape predates this sprint and isn't
 * changed here. The schema now allows multiple accounts per platform
 * (TalentSocial.label), so for each platform this picks the MAIN-labeled
 * account if one exists, else the first published one, same precedence
 * `talentRepository.listTalents` already uses for its roster "social
 * preview" column — chosen for consistency, not invented here. Any
 * additional accounts on the same platform (e.g. a second "Spam" Instagram)
 * are not lost from the database, just not displayed on this page without
 * a UI change, which is out of this sprint's scope (see summary).
 *
 * Only the platforms <SocialLinksEditor>'s default registry
 * (lib/admin/social-platforms.js) knows about — instagram/tiktok/youtube/
 * facebook/website — are mapped; a THREADS row (schema-only platform, no
 * UI slot yet) is likewise not displayed, same reasoning.
 */
function buildSocialLinks(socials) {
  const platformKeys = { INSTAGRAM: 'instagram', TIKTOK: 'tiktok', YOUTUBE: 'youtube', FACEBOOK: 'facebook', WEBSITE: 'website' };
  const links = { instagram: null, tiktok: null, youtube: null, facebook: null, website: null };

  for (const [dbPlatform, key] of Object.entries(platformKeys)) {
    const accountsForPlatform = (socials || []).filter((s) => s.platform === dbPlatform);
    const chosen = accountsForPlatform.find((s) => s.label === 'MAIN') || accountsForPlatform[0] || null;
    links[key] = chosen ? (chosen.url || chosen.handle || null) : null;
  }

  return links;
}

function SocialsSectionContent({ socials }) {
  const publishedLinks = buildSocialLinks(socials);
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

  // Pure reads only — no version is ever created as a side effect of
  // loading this page (see loadPendingVersion's header comment above).
  // socials/galleryImages added by the Talent Detail DB Read Integration
  // sprint, same pure-read guarantee: talentAdapter.getSocials/
  // getGalleryImages call nothing but a SELECT.
  const [publishedVersion, pendingVersion, versions, socials, galleryImages] = await Promise.all([
    versionService.getCurrentPublished(talentAdapter, id),
    loadPendingVersion(talent),
    versionService.listVersionHistory(talentAdapter, id),
    talentAdapter.getSocials(talent.id),
    talentAdapter.getGalleryImages(talent.id),
  ]);

  const status = deriveDetailWorkflowStatus(versions);
  const lastUpdated = deriveLastUpdated(versions, talent);
  const displayName = publishedVersion?.name || talent.slug;

  const sections = TALENT_WORKSPACE_SECTIONS.map((section) => {
    if (section.key === 'details') {
      return {
        ...section,
        content: (
          <DetailsSectionContent
            talentId={talent.id}
            publishedVersion={publishedVersion}
            pendingVersion={pendingVersion}
          />
        ),
      };
    }
    if (section.key === 'gallery') {
      return {
        ...section,
        content: <GallerySectionContent galleryImages={galleryImages} displayName={displayName} />,
      };
    }
    if (section.key === 'socials') {
      return { ...section, content: <SocialsSectionContent socials={socials} /> };
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
        action={
          <div className={styles.headerActions}>
            <StatusBadge label={workflowStatusLabel(status)} tone={workflowStatusTone(status)} />
            {/*
              Start Editing sprint — explicit user action only, never a side
              effect of this (pure-read) page load. `pendingVersion` here is
              exactly the same value loadPendingVersion() already fetched
              above for the comparison view; this button makes no engine
              calls of its own, it just reflects that existing read.
            */}
            <StartEditingButton talentId={talent.id} pendingStatus={pendingVersion?.status ?? null} />
          </div>
        }
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
