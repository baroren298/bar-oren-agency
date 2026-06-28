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
import ProfileImagePanel from '@/components/admin/ProfileImagePanel';
import PodcastTab from '@/components/admin/PodcastTab';
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
  calculateAge,
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
        // Talent Detail "location & age" cleanup sprint — birthDate/age
        // moved here from the standalone ProfileSummary block that used to
        // sit between Profile Image and Podcast (see this file's history).
        // birthDate is a real, already-writable TalentVersion column (see
        // talentRepository.updateTalentVersionFields's WRITABLE_COLUMNS
        // allowlist), so it's a normal editable "date" field, same pattern
        // as location/locationEn above. age is NOT a column — it's derived
        // from birthDate via calculateAge() and rendered with the new
        // "computed" field type, which ComparisonView treats as read-only
        // text in both the Published and Proposed columns (no input, ever).
        // Even though `age` rides along in the same fields/values object
        // ComparisonView's Save Draft sends to the API, the repository's
        // allowlist silently drops any key that isn't a real column, so it
        // can never be written — no new DB write capability is introduced.
        {
          key: 'birthDate',
          label: he.talent.fields.birthDate,
          type: 'date',
          value: publishedVersion.birthDate,
          draftValue: pendingVersion ? pending.birthDate : undefined,
        },
        {
          key: 'age',
          label: he.talent.fields.age,
          type: 'computed',
          value: calculateAge(publishedVersion.birthDate),
          draftValue: pendingVersion ? calculateAge(pending.birthDate) : undefined,
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
 * Socials Tab Multi-Account UI sprint — `buildSocialLinks` (which used to
 * collapse every platform's rows down to one MAIN-or-first pick, silently
 * dropping any second account like a "Spam" Instagram) is removed.
 * `getPublishedSocialsForTalent`'s own docstring already says rows are
 * "intentionally not collapsed" at the query layer — only this page's old
 * mapping was doing the collapsing. `socials` is now passed straight
 * through to <SocialLinksEditor> as `publishedSocials`: one DB row in, one
 * card out, for every published+active TalentSocial row, including any
 * additional accounts that share a platform, and including THREADS rows
 * now that the editor's platform registry has a slot for them.
 */
function SocialsSectionContent({ socials }) {
  return <SocialLinksEditor publishedSocials={socials || []} />;
}

/*
 * Enable Podcast Save sprint — the four podcast scalar fields' ComparisonView
 * group, same shape buildDetailsGroups above already produces for the
 * פרטים tab. Deliberately a single unlabeled group (no sub-groups needed for
 * just four fields) and deliberately only these four: podcastImageAssetId
 * is not included here because there is no safe existing upload/picker flow
 * to route an image-replace edit through yet (sprint rule #2/#6) — the
 * image stays a read-only preview with a disabled "החלף תמונה" placeholder
 * in <PodcastTab>.
 */
function buildPodcastGroups(publishedVersion, pendingVersion) {
  const published = publishedVersion || {};
  const pending = pendingVersion || {};

  return [
    {
      key: 'podcast',
      label: null,
      fields: [
        {
          key: 'podcastTitle',
          label: he.talent.fields.podcastTitle,
          type: 'text',
          value: published.podcastTitle,
          draftValue: pendingVersion ? pending.podcastTitle : undefined,
        },
        {
          key: 'podcastDescriptionHe',
          label: he.talent.fields.podcastDescriptionHe,
          type: 'textarea',
          value: published.podcastDescriptionHe,
          draftValue: pendingVersion ? pending.podcastDescriptionHe : undefined,
        },
        {
          key: 'podcastDescriptionEn',
          label: he.talent.fields.podcastDescriptionEn,
          type: 'textarea',
          value: published.podcastDescriptionEn,
          draftValue: pendingVersion ? pending.podcastDescriptionEn : undefined,
        },
        {
          key: 'podcastVideoEmbedUrl',
          label: he.talent.fields.podcastVideoEmbedUrl,
          type: 'text',
          value: published.podcastVideoEmbedUrl,
          draftValue: pendingVersion ? pending.podcastVideoEmbedUrl : undefined,
        },
      ],
    },
  ];
}

/*
 * Podcast tab sprint, extended by Enable Podcast Save and Podcast Panel
 * Removal — feeds publishedVersion.podcast* fields into the editable
 * <PodcastTab>, now the only place podcast data is shown (the standalone
 * read-only top-of-page preview that used to read these same fields has
 * been removed). `talentId`/`versionId`/`versionStatus` flow through to
 * <PodcastTab> -> <TalentDetailsEditor> exactly like DetailsSectionContent
 * above does for the פרטים tab — the exact same Save Draft/Submit network
 * call, no new API route, no new save mechanism. Tab still appears for
 * every talent (sprint requirement #2), including one with no published
 * version yet — <PodcastTab> itself renders a clear empty state when every
 * field is empty.
 */
function PodcastSectionContent({ talentId, publishedVersion, pendingVersion, displayName }) {
  const isEditablePending =
    pendingVersion?.status === VERSION_STATUS.DRAFT || pendingVersion?.status === VERSION_STATUS.PROPOSED;
  const editableVersionId = isEditablePending ? pendingVersion.id : null;

  return (
    <PodcastTab
      talentId={talentId}
      versionId={editableVersionId}
      versionStatus={isEditablePending ? pendingVersion.status : null}
      groups={buildPodcastGroups(publishedVersion, pendingVersion)}
      podcastImageUrl={publishedVersion?.podcastImageAsset?.blobUrl ?? null}
      podcastVideoEmbedUrl={publishedVersion?.podcastVideoEmbedUrl ?? null}
      hasPodcastData={Boolean(
        publishedVersion?.podcastTitle ||
          publishedVersion?.podcastDescriptionHe ||
          publishedVersion?.podcastDescriptionEn ||
          publishedVersion?.podcastImageAsset?.blobUrl ||
          publishedVersion?.podcastVideoEmbedUrl
      )}
      displayName={displayName}
    />
  );
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

/*
 * Talent Detail Header DB read-only mapping sprint — read-only profile
 * facts block (birth date / computed age), rendered once below the
 * workspace header, above the tabs. Deliberately separate from
 * buildDetailsGroups/<TalentDetailsEditor> above: this is plain display,
 * not wired to ComparisonView's Save Draft/Submit machinery, and shows
 * only the current Published version's values (matching the rest of this
 * page's header, which already reads from `publishedVersion`) — never a
 * pending Draft/Proposed value, so there is no "which column" ambiguity
 * for a block with no comparison view at all.
 *
 * Profile Image section sprint — the small circular avatar that used to
 * live in this block moved out into its own dedicated
 * <ProfileImagePanel> (rendered separately below).
 *
 * "Location & age" cleanup sprint — this standalone facts block (birth
 * date / computed age) is now removed entirely. It felt disconnected
 * floating between Profile Image and Podcast; birthDate/age now render
 * inside the "מיקום וגיל" group in buildDetailsGroups above instead (see
 * that function's `location` group), reusing the existing Details
 * tab/ComparisonView machinery rather than a one-off block. No DB read
 * changed either time — still the same `publishedVersion.birthDate`.
 */

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
    if (section.key === 'podcast') {
      return {
        ...section,
        content: (
          <PodcastSectionContent
            talentId={talent.id}
            publishedVersion={publishedVersion}
            pendingVersion={pendingVersion}
            displayName={displayName}
          />
        ),
      };
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

      {publishedVersion ? (
        <ProfileImagePanel
          imageUrl={publishedVersion.profileImageAsset?.blobUrl ?? null}
          profileImagePosition={publishedVersion.profileImagePosition}
          profileImageScale={publishedVersion.profileImageScale}
          displayName={displayName}
        />
      ) : null}

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
