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

import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { versionService } from '@/lib/admin/engine/versionService';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';
import { eventRepository } from '@/lib/admin/repository/eventRepository';
import { userRepository } from '@/lib/admin/repository/userRepository';
import { isDatabaseConfigured } from '@/lib/admin/db';
import { isUploadAvailable } from '@/lib/storage/availability';
import { getSessionUser } from '@/lib/admin/auth/authorize';
import AdminShell from '../../AdminShell';
import PageHeader from '@/components/admin/PageHeader';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';
import StartEditingButton from '@/components/admin/StartEditingButton';
import CancelEditingButton from '@/components/admin/CancelEditingButton';
import TalentVisibilityAction from '@/components/admin/TalentVisibilityAction';
import TalentArchiveAction from '@/components/admin/TalentArchiveAction';
import PodcastTab from '@/components/admin/PodcastTab';
import TalentDetailsEditor from '@/components/admin/TalentDetailsEditor';
import MediaGalleryEditor from '@/components/admin/MediaGalleryEditor';
import GalleryOwnerReview from '@/components/admin/GalleryOwnerReview';
import SocialLinksEditor from '@/components/admin/SocialLinksEditor';
import SocialLinksOwnerReview from '@/components/admin/SocialLinksOwnerReview';
import SeoEditor from '@/components/admin/SeoEditor';
import Timeline from '@/components/admin/Timeline';
// Website CMS Focus Cleanup — the Campaigns tab import (TalentCampaignsTab)
// was removed here, along with its workspace section entry and the
// conditional render below: Campaigns is a My Agency business module, not
// Website CMS content. The prototype component file
// (app/admin/campaigns/TalentCampaignsTab.jsx) is intentionally left in
// place, just no longer imported or rendered.
import { Suspense } from 'react';
import TalentWorkspaceTabs from './TalentWorkspaceTabs';
import {
  TALENT_WORKSPACE_SECTIONS,
  deriveDetailWorkflowStatus,
  deriveLastUpdated,
  formatHebrewDate,
  calculateAge,
  deriveCurrentRejectionNote,
  deriveCurrentVisibility,
  selectDetailBadge,
} from '@/lib/admin/talent-workspace';
import {
  buildTalentHistoryTimelineItems,
  collectEventActorIds,
  buildActorDisplayMap,
} from '@/lib/admin/talent-history';
import { he } from '@/lib/admin/i18n/he';
import { resolveAdminTalentRoute } from '@/lib/admin/talent-route';
import { buildGalleryImages } from '@/lib/admin/gallery-images';
import { isGlobalEditingStatus } from '@/lib/admin/edit-mode';
import { VERSION_STATUS, TALENT_VISIBILITY, ENTITY_TYPE, LIFECYCLE_STATUS } from '@/lib/admin/constants/enums';
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
export function buildDetailsGroups(publishedVersion, pendingVersion, options = {}) {
  const pending = pendingVersion || {};
  const published = publishedVersion || {};
  // Talent Details Lifecycle Unification sprint — Profile Image is now a
  // field inside this same groups array/ComparisonView instance instead of
  // the separate <ProfileImagePanel> lifecycle it used to own (see the
  // "profileImage" group below). uploadsEnabled/displayName are the two
  // bits of caller context that field needs and buildDetailsGroups' other
  // fields never did; both are optional so every existing call site
  // (including this file's own detailsSectionContent.test.jsx) keeps
  // working unchanged.
  const { uploadsEnabled = true, displayName = '' } = options;

  return [
    {
      // Talent Details Lifecycle Unification sprint — Profile Image moves
      // from its own <ProfileImagePanel> lifecycle (separate Save Draft/
      // Submit/Cancel) into this single Details-tab ComparisonView
      // lifecycle, as one "image" field. Its own group (not folded into
      // "basic") so it keeps the same visual section heading
      // ("תמונת פרופיל") the old panel rendered. ComparisonView's new
      // "image" field type renders it via the exact same, unmodified
      // <ImageAssetEditor> the old panel used — only lifecycle ownership
      // moved, not the image editing UI itself.
      key: 'profileImage',
      label: he.talent.detail.profile.image.sectionTitle,
      fields: [
        {
          key: 'profileImage',
          type: 'image',
          value: {
            assetUrl: published.profileImageAsset?.blobUrl ?? null,
            position: published.profileImagePosition ?? null,
            scale: published.profileImageScale ?? null,
          },
          // Same "undefined means fall back to published" convention every
          // other field's draftValue already uses — only seeded from the
          // pending version once one actually exists.
          draftValue: pendingVersion
            ? {
                assetUrl: pending.profileImageAsset?.blobUrl ?? null,
                position: pending.profileImagePosition ?? null,
                scale: pending.profileImageScale ?? null,
              }
            : undefined,
          // Rendering-only metadata for ComparisonView's "image" field
          // branch — mirrors exactly what <ProfileImagePanel> used to pass
          // to <ImageAssetEditor> itself.
          image: {
            purpose: 'profile',
            alt: he.talent.detail.profile.imageAlt(displayName),
            defaultPosition: 'center top',
            uploadDisabled: !uploadsEnabled,
            copy: {
              viewEyebrowIcon: he.media.viewEyebrowIcon,
              viewEyebrowTitle: he.media.viewEyebrowTitle,
              viewSubtitle: he.media.viewSubtitle,
              editingEyebrowIcon: he.media.editingEyebrowIcon,
              editingEyebrowTitle: he.media.editingEyebrowTitle,
              editingSubtitle: he.media.editingSubtitle,
              noImage: he.talent.detail.profile.noImage,
              uploadArea: he.media.uploadArea,
              preview: he.media.preview,
              positionControls: he.media.positionControls,
              disabledHint: he.talent.detail.profile.image.noEditableVersionHint,
              uploadsDisabledHint: he.media.uploadsDisabledHint,
              errors: he.media.errors,
            },
          },
        },
      ],
    },
    {
      key: 'basic',
      label: he.talent.detailGroups.basic,
      fields: [
        {
          key: 'name',
          label: he.talent.fields.name,
          type: 'text',
          value: published.name,
          draftValue: pendingVersion ? pending.name : undefined,
        },
        {
          key: 'nameEn',
          label: he.talent.fields.nameEn,
          type: 'text',
          value: published.nameEn,
          draftValue: pendingVersion ? pending.nameEn : undefined,
        },
        {
          key: 'featured',
          label: he.talent.fields.featured,
          type: 'boolean',
          value: Boolean(published.featured),
          draftValue: pendingVersion ? Boolean(pending.featured) : undefined,
        },
        // Talent Detail Foundation sprint — sortOrder/featuredOrder are
        // real, already-writable TalentVersion columns (both already in
        // talentRepository.updateTalentVersionFields's WRITABLE_COLUMNS
        // allowlist) that previously had no edit control anywhere in the
        // admin. Exposed here as plain "number" fields (ComparisonView's
        // new type, sibling to "date"/"boolean") right next to `featured`,
        // since both describe how this talent is ordered/surfaced rather
        // than its actual profile content — no new group needed for two
        // fields. Labels are deliberately non-technical (see he.js) — the
        // column names never appear in the UI.
        {
          key: 'sortOrder',
          label: he.talent.fields.sortOrder,
          type: 'number',
          value: published.sortOrder,
          draftValue: pendingVersion ? pending.sortOrder : undefined,
        },
        {
          key: 'featuredOrder',
          label: he.talent.fields.featuredOrder,
          type: 'number',
          value: published.featuredOrder,
          draftValue: pendingVersion ? pending.featuredOrder : undefined,
        },
        // Talent Visibility sprint (admin UI) — requirement #4: visibility
        // appears as another comparison row, using the same
        // Published-vs-Proposed layout/diff styling every other field here
        // already has. Read-only in both columns (ComparisonView's new
        // "visibility" type) — the real mutation path is the header's
        // Hide/Restore action (TalentVisibilityAction), which PATCHes this
        // same draft's `visibility` field directly; this row exists purely
        // so the change is visible here too, not to provide a second way to
        // make it. Falls back to TALENT_VISIBILITY.VISIBLE for a published
        // version predating this field (schema default).
        {
          key: 'visibility',
          label: he.talent.fields.visibility,
          type: 'visibility',
          value: published.visibility || TALENT_VISIBILITY.VISIBLE,
          draftValue: pendingVersion ? pending.visibility || TALENT_VISIBILITY.VISIBLE : undefined,
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
          value: published.bioHe,
          draftValue: pendingVersion ? pending.bioHe : undefined,
        },
        {
          key: 'bioEn',
          label: he.talent.fields.bioEn,
          type: 'textarea',
          value: published.bioEn,
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
          value: published.category,
          draftValue: pendingVersion ? pending.category : undefined,
        },
        {
          key: 'tags',
          label: he.talent.fields.tags,
          type: 'list',
          value: published.tags,
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
          value: published.location,
          draftValue: pendingVersion ? pending.location : undefined,
        },
        {
          key: 'locationEn',
          label: he.talent.fields.locationEn,
          type: 'text',
          value: published.locationEn,
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
          value: published.birthDate,
          draftValue: pendingVersion ? pending.birthDate : undefined,
        },
        {
          key: 'age',
          label: he.talent.fields.age,
          type: 'computed',
          value: calculateAge(published.birthDate),
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
export function DetailsSectionContent({ talentId, publishedVersion, pendingVersion, displayName, role, uploadsEnabled }) {
  const isEditablePending =
    pendingVersion?.status === VERSION_STATUS.DRAFT || pendingVersion?.status === VERSION_STATUS.PROPOSED;

  // New-Talent Draft Details fix — a brand-new Talent has no published
  // version yet, but its very first TalentVersion is created as an
  // editable DRAFT (talentRepository.createTalentWithInitialVersion). The
  // empty state is only correct when there is truly nothing to show or
  // edit: no published version AND no editable pending version. Whenever
  // an editable DRAFT/PROPOSED exists, the editors below render with the
  // published column empty ("—") and the proposed column holding the
  // pending version's values (buildDetailsGroups/ProfileImagePanel are
  // both null-safe on the published side for exactly this case).
  if (!publishedVersion && !isEditablePending) {
    return (
      <EmptyState
        title={he.talent.detail.noPublishedVersionTitle}
        description={he.talent.detail.noPublishedVersionDescription}
      />
    );
  }

  const editableVersionId = isEditablePending ? pendingVersion.id : null;

  return (
    // Talent Details Lifecycle Unification sprint — Profile Image no
    // longer renders as its own sibling <ProfileImagePanel> with an
    // independent Save Draft/Submit/Cancel lifecycle. It is now the first
    // field/group buildDetailsGroups returns, so <TalentDetailsEditor>'s
    // single <ComparisonView> instance is the Details tab's only
    // save/submit/cancel action surface (see that function's "profileImage"
    // group above for exactly what moved and why).
    <TalentDetailsEditor
      talentId={talentId}
      versionId={editableVersionId}
      versionStatus={isEditablePending ? pendingVersion.status : null}
      groups={buildDetailsGroups(publishedVersion, pendingVersion, { uploadsEnabled, displayName })}
      role={role}
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
 * data/talent/index.js read with the real published gallery rows,
 * normalized into the flat row shape the gallery components expect.
 *
 * Gallery UX Completion sprint — the buildGalleryImages normalizer that
 * lived right here moved verbatim to lib/admin/gallery-images.js (imported
 * above), because MediaGalleryEditor.handleSaveDraft now needs the exact
 * same normalization for the gallery PATCH response — see that module's
 * header for the shape-divergence bug this closes. This page's usage is
 * unchanged: same calls, same arguments, same output.
 */

/*
 * Gallery Sprint 1 — mirrors SocialsSectionContent exactly: a read-only
 * <GalleryOwnerReview> (renders nothing when there's no submitted
 * proposal) above the now persistence-aware <MediaGalleryEditor>, fed by
 * the three new pure-read talentAdapter calls below
 * (getDraftOrProposedGalleryImages/getProposedGalleryImages/
 * getRejectedGalleryImages — same "SELECT only, nothing written as a side
 * effect of viewing this page" guarantee every other read on this page
 * already has).
 */
/*
 * Global Edit Mode UX sprint — `globalEditing` now also flows through (here
 * and in SocialsSectionContent/SeoSectionContent below): one derived boolean
 * from the same `pendingVersion` this page already reads (see
 * isGlobalEditingStatus in lib/admin/edit-mode.js — the exact rule
 * DetailsSectionContent's isEditablePending already applies). Purely a UX
 * signal: it opens each tab's editable surface immediately and removes the
 * duplicate local "התחל בעריכה" CTA, while every module keeps its own draft
 * store and Save/Submit/Publish flows untouched.
 */
function GallerySectionContent({
  talentId,
  galleryImages,
  draftGalleryImages,
  proposedGalleryImages,
  rejectedGalleryImages,
  displayName,
  role,
  uploadsEnabled,
  globalEditing,
}) {
  const publishedImages = buildGalleryImages(galleryImages, displayName);
  const draftImages = buildGalleryImages(draftGalleryImages, displayName);
  const proposedImages = buildGalleryImages(proposedGalleryImages, displayName);
  const rejectedImages = buildGalleryImages(rejectedGalleryImages, displayName);

  return (
    <>
      <GalleryOwnerReview talentId={talentId} publishedImages={publishedImages} proposedImages={proposedImages} />
      <MediaGalleryEditor
        talentId={talentId}
        displayName={displayName}
        publishedImages={publishedImages}
        draftImages={draftImages}
        rejectedImages={rejectedImages}
        role={role}
        uploadsEnabled={uploadsEnabled}
        globalEditing={globalEditing}
      />
    </>
  );
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
 *
 * Social Links persistence sprint — `talentId`/`draftSocials` now also flow
 * through. `draftSocials` is whichever DRAFT or PROPOSED TalentSocial rows
 * already exist for this talent (talentAdapter.getDraftOrProposedSocials,
 * a pure read, same "never created as a side effect of viewing this page"
 * guarantee `loadPendingVersion` above already documents for TalentVersion)
 * — when that list is non-empty, SocialLinksEditor seeds its proposed
 * column from it instead of from `socials`, so a saved-but-not-yet-
 * submitted draft survives a page refresh.
 *
 * Owner Review (Social Links) sprint — `proposedSocials` now also flows
 * through (talentAdapter.getProposedSocials, another pure read, same
 * guarantee as above: a SELECT filtered to versionStatus=PROPOSED, nothing
 * written as a side effect of viewing this page). When non-empty, a
 * read-only <SocialLinksOwnerReview> panel renders above the existing
 * editor, showing the Owner exactly what the submitted proposal changes.
 * <SocialLinksOwnerReview> renders nothing itself when proposedSocials is
 * empty, so this is purely additive — <SocialLinksEditor>'s own behavior is
 * untouched.
 *
 * Owner Approve/Reject (Social Links) sprint — `talentId` now also flows
 * into <SocialLinksOwnerReview> (its new Approve/Request-changes buttons
 * need it to know where to POST), and `rejectedSocials` flows into
 * <SocialLinksEditor> (talentAdapter.getRejectedSocials, another pure read)
 * so a rejected account's Owner note renders right above the editor instead
 * of only being visible in the History tab.
 */
function SocialsSectionContent({ talentId, socials, draftSocials, proposedSocials, rejectedSocials, role, globalEditing }) {
  return (
    <>
      <SocialLinksOwnerReview
        talentId={talentId}
        publishedSocials={socials || []}
        proposedSocials={proposedSocials || []}
      />
      <SocialLinksEditor
        talentId={talentId}
        publishedSocials={socials || []}
        draftSocials={draftSocials || []}
        rejectedSocials={rejectedSocials || []}
        role={role}
        globalEditing={globalEditing}
      />
    </>
  );
}

/*
 * Enable Podcast Save sprint — the four podcast scalar fields' ComparisonView
 * group, same shape buildDetailsGroups above already produces for the
 * פרטים tab. Deliberately a single unlabeled group (no sub-groups needed for
 * just four fields) and deliberately only these four: podcastImageAssetId
 * is still not a ComparisonView field — since the Podcast Image Upload
 * sprint it's edited through <PodcastTab>'s own "החלף תמונה" upload control
 * (an id-typed column has nothing meaningful to show in a text comparison
 * row), which PATCHes it through the same proposals/[versionId] route.
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
/*
 * Podcast Image Upload sprint — `uploadsEnabled` (the same server-computed
 * gate DetailsSectionContent/GallerySectionContent already receive) and
 * `pendingPodcastImageUrl` now flow through too. The pending URL comes off
 * the same `pendingVersion` this page already reads (loadPendingVersion →
 * listVersionsForParent, whose repository query now includes the
 * podcastImageAsset relation) — no extra database read is made for it.
 */
function PodcastSectionContent({ talentId, publishedVersion, pendingVersion, displayName, role, uploadsEnabled }) {
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
      pendingPodcastImageUrl={isEditablePending ? pendingVersion?.podcastImageAsset?.blobUrl ?? null : null}
      uploadsEnabled={uploadsEnabled}
      podcastVideoEmbedUrl={publishedVersion?.podcastVideoEmbedUrl ?? null}
      hasPodcastData={Boolean(
        publishedVersion?.podcastTitle ||
          publishedVersion?.podcastDescriptionHe ||
          publishedVersion?.podcastDescriptionEn ||
          publishedVersion?.podcastImageAsset?.blobUrl ||
          publishedVersion?.podcastVideoEmbedUrl
      )}
      displayName={displayName}
      role={role}
    />
  );
}

/*
 * Talent SEO + Slug Management sprint — the SEO tab now reads and writes
 * real, versioned data. The SEO block (and the proposed slug) live as
 * normal columns on the same TalentVersion rows this page already loads
 * (publishedVersion / pendingVersion) — no extra query. Field keys match
 * the column names, so this mapping is a plain pick.
 */
function buildSeoValues(version) {
  if (!version) return {};
  return {
    seoTitle: version.seoTitle ?? null,
    seoDescription: version.seoDescription ?? null,
    seoCanonicalUrl: version.seoCanonicalUrl ?? null,
    seoOgTitle: version.seoOgTitle ?? null,
    seoOgDescription: version.seoOgDescription ?? null,
    seoOgImageUrl: version.seoOgImageUrl ?? null,
    seoNoindex: version.seoNoindex ?? false,
  };
}

/*
 * Talent SEO + Slug Management sprint — mirrors DetailsSectionContent/
 * PodcastSectionContent's wiring exactly: `versionId`/`versionStatus` only
 * ever point at an editable DRAFT/PROPOSED version, `role` gates the
 * Owner-only Publish Now button, and the same proposals API routes carry
 * Save Draft / Submit / Publish. `defaults` feeds the sprint's smart
 * defaults (empty SEO title → talent name, empty description → bio, empty
 * OG image → profile image, empty canonical → the public URL) into the
 * live Google/Open Graph previews, matching what lib/public/seo.js applies
 * on the live page. `publishedSlug` is the parent Talent.slug — the live
 * public URL, which only ever changes when a version proposing a new slug
 * is actually published.
 */
function SeoSectionContent({ talent, publishedVersion, pendingVersion, role, globalEditing }) {
  const isEditablePending =
    pendingVersion?.status === VERSION_STATUS.DRAFT || pendingVersion?.status === VERSION_STATUS.PROPOSED;

  return (
    <SeoEditor
      talentId={talent.id}
      versionId={isEditablePending ? pendingVersion.id : null}
      versionStatus={isEditablePending ? pendingVersion.status : null}
      role={role}
      globalEditing={globalEditing}
      publishedSlug={talent.slug}
      publishedSeo={buildSeoValues(publishedVersion)}
      draftSeo={isEditablePending ? buildSeoValues(pendingVersion) : null}
      draftSlug={isEditablePending ? pendingVersion.slug ?? talent.slug : null}
      defaults={{
        name: publishedVersion?.name ?? pendingVersion?.name ?? null,
        nameEn: publishedVersion?.nameEn ?? pendingVersion?.nameEn ?? null,
        bio: publishedVersion?.bioHe ?? publishedVersion?.bioEn ?? null,
        profileImage: publishedVersion?.profileImageAsset?.blobUrl ?? null,
      }}
    />
  );
}

/*
 * Sprint 2: Real Event-Based History Timeline — the History tab now renders
 * from the stored, append-only Event log instead of one item per
 * TalentVersion row (whose current-status projection collapsed a
 * DRAFT → PROPOSED → PUBLISHED journey into a single "Published" item).
 *
 * Flow (all pure reads, all upstream of this component):
 *   1. loadTalentEvents(id) below — eventRepository.listForEntity(
 *      ENTITY_TYPE.TALENT, id), the existing read path, newest first.
 *   2. Distinct non-null actorIds are collected off those rows and resolved
 *      in ONE batched userRepository.getSafeByIds() call — no N+1. A null
 *      actorId or a user that no longer resolves displays as "—".
 *   3. buildTalentHistoryTimelineItems (lib/admin/talent-history.js)
 *      projects events → timeline items (Hebrew labels + existing tones),
 *      hiding ProposalUpdated/AssetUploaded by noise policy and skipping
 *      unknown types, then falls back to the previous version-row
 *      projection (buildVersionHistoryTimelineItems) when no visible event
 *      items exist — so an older/imported talent never shows an empty tab
 *      while it still has version history.
 *
 * <Timeline> itself is unchanged — same component, same RTL styling; it
 * still renders an EmptyState for a brand-new talent with no history at
 * all.
 */
function HistorySectionContent({ items }) {
  return <Timeline items={items} />;
}

/*
 * Sprint 2: Real Event-Based History Timeline — pure read of the talent's
 * stored Event rows via the existing eventRepository.listForEntity
 * (newest first, per that method's own contract). Never throws, same
 * degrade-gracefully pattern as loadPendingVersion above: a transient read
 * failure falls back to [] — which downstream resolves to the version-row
 * history projection rather than a broken page.
 */
async function loadTalentEvents(talentId) {
  try {
    return await eventRepository.listForEntity(ENTITY_TYPE.TALENT, talentId);
  } catch (error) {
    console.error('[AdminTalentDetailPage] loadTalentEvents failed, falling back to version-row history:', error);
    return [];
  }
}

/*
 * Sprint 2: Real Event-Based History Timeline — one batched, safe
 * (passwordHash never selected) user lookup for the event actors. Never
 * throws: on failure every actor renders as "—" instead of breaking the
 * page.
 */
async function loadEventActors(events) {
  try {
    const actorIds = collectEventActorIds(events);
    if (actorIds.length === 0) return new Map();
    const users = await userRepository.getSafeByIds(actorIds);
    return buildActorDisplayMap(users);
  } catch (error) {
    console.error('[AdminTalentDetailPage] loadEventActors failed, actors will display as "—":', error);
    return new Map();
  }
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
 * <ProfileImagePanel>. That panel initially rendered globally above the
 * tabs; the "Profile Image scoped to Details" fix later moved it inside
 * <DetailsSectionContent>, so it now renders only in the פרטים tab.
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

  /*
   * Clean Admin Talent URL sprint — the dynamic segment now accepts either
   * the internal database ID (legacy links, backwards-compatible) or the
   * current published slug (the canonical form). Resolution is exact-ID
   * first, then slug (see lib/admin/talent-route.js); a legacy ID URL is
   * redirected to /admin/talent/<current-published-slug> before any data
   * loading. The folder deliberately stays [id] — only interpretation of
   * the parameter widened. Everything below keeps using `talent.id`
   * (`id` alias) for data reads and component props, so every API call and
   * authorization check is unchanged.
   */
  const { id: routeParam } = await params;

  const { talent, redirectTo } = await resolveAdminTalentRoute(routeParam, {
    getParent: (value) => talentAdapter.getParent(value),
    getParentBySlug: (value) => talentAdapter.getParentBySlug(value),
  });
  if (!talent) {
    notFound();
  }
  if (redirectTo) {
    redirect(redirectTo);
  }

  const id = talent.id;

  // Owner Direct Publish UX sprint — the one place this page reads the
  // session, mirroring every other read here ("pure read, nothing written").
  // Middleware already guarantees a logged-in user reached this far; this
  // just reads which role they have so it can be prop-drilled down to the
  // editor components exactly like talentId/versionId already are. This is
  // UI-only convenience — every actual publish/approve call is still
  // independently re-checked server-side (requireOwner / assertActorIsOwner).
  const session = await getSessionUser({ cookies: await cookies() });
  const role = session?.role ?? null;

  // Pre-merge blocker fix sprint (QA finding #1) — computed once here on
  // the server (reads STORAGE_PROVIDER/NODE_ENV, which client components
  // can't) and prop-drilled to the Profile Image and Gallery upload
  // surfaces below. False only when the active storage provider is `local`
  // in a production build; local development is unaffected. UI-only
  // convenience — the upload route re-checks this independently (503).
  const uploadsEnabled = isUploadAvailable();

  // Pure reads only — no version is ever created as a side effect of
  // loading this page (see loadPendingVersion's header comment above).
  // socials/galleryImages added by the Talent Detail DB Read Integration
  // sprint, same pure-read guarantee: talentAdapter.getSocials/
  // getGalleryImages call nothing but a SELECT. draftSocials added by the
  // Social Links persistence sprint, same guarantee:
  // getDraftOrProposedSocials also calls nothing but a SELECT.
  // proposedSocials added by the Owner Review (Social Links) sprint, same
  // guarantee: getProposedSocials also calls nothing but a SELECT.
  // rejectedSocials added by the Owner Approve/Reject (Social Links)
  // sprint, same guarantee: getRejectedSocials also calls nothing but a
  // SELECT. draftGalleryImages/proposedGalleryImages/rejectedGalleryImages
  // added by Gallery Sprint 1, same guarantee as their Social Links
  // siblings — each is a SELECT via talentAdapter, nothing written.
  const [
    publishedVersion,
    pendingVersion,
    versions,
    socials,
    galleryImages,
    draftSocials,
    proposedSocials,
    rejectedSocials,
    draftGalleryImages,
    proposedGalleryImages,
    rejectedGalleryImages,
    events,
  ] = await Promise.all([
      versionService.getCurrentPublished(talentAdapter, id),
      loadPendingVersion(talent),
      versionService.listVersionHistory(talentAdapter, id),
      talentAdapter.getSocials(talent.id),
      talentAdapter.getGalleryImages(talent.id),
      talentAdapter.getDraftOrProposedSocials(talent.id),
      talentAdapter.getProposedSocials(talent.id),
      talentAdapter.getRejectedSocials(talent.id),
      talentAdapter.getDraftOrProposedGalleryImages(talent.id),
      talentAdapter.getProposedGalleryImages(talent.id),
      talentAdapter.getRejectedGalleryImages(talent.id),
      // Sprint 2: Real Event-Based History Timeline — pure read of the
      // stored Event rows for this talent (see loadTalentEvents above).
      loadTalentEvents(talent.id),
    ]);

  // Sprint 2: Real Event-Based History Timeline — resolve actor identities
  // in one batched query (must run after `events` resolves, hence not part
  // of the Promise.all above), then project events → timeline items with
  // the version-row fallback for talents that predate event emission.
  const eventActorsById = await loadEventActors(events);
  const historyItems = buildTalentHistoryTimelineItems(events, eventActorsById, versions);

  const status = deriveDetailWorkflowStatus(versions);
  const lastUpdated = deriveLastUpdated(versions, talent);
  const displayName = publishedVersion?.name || talent.slug;
  const rejectionNote = deriveCurrentRejectionNote(versions);

  // Global Edit Mode UX sprint — the page's single edit-activation signal,
  // derived (never stored) from the same `pendingVersion` loadPendingVersion
  // already read above for the header's StartEditingButton and the Details/
  // Podcast tabs. True exactly when a DRAFT or PROPOSED TalentVersion
  // exists — i.e. the page-level "Start Editing" flow is active. Passed to
  // the Gallery/Socials/SEO sections so their editable surfaces open
  // immediately instead of showing a second "התחל בעריכה" button. Pure
  // derivation of an existing read: no new query, no write, no draft is
  // ever created by rendering this page.
  const globalEditing = isGlobalEditingStatus(pendingVersion?.status ?? null);

  const sections = TALENT_WORKSPACE_SECTIONS.map((section) => {
    if (section.key === 'details') {
      return {
        ...section,
        content: (
          <DetailsSectionContent
            talentId={talent.id}
            publishedVersion={publishedVersion}
            pendingVersion={pendingVersion}
            displayName={displayName}
            role={role}
            uploadsEnabled={uploadsEnabled}
          />
        ),
      };
    }
    // Website CMS Focus Cleanup — the `campaigns` section render was removed
    // here (My Agency business module, not Website CMS content). The section
    // is also no longer present in TALENT_WORKSPACE_SECTIONS, so this branch
    // is unnecessary; the prototype component stays on disk, just unused.
    if (section.key === 'gallery') {
      return {
        ...section,
        content: (
          <GallerySectionContent
            talentId={talent.id}
            galleryImages={galleryImages}
            draftGalleryImages={draftGalleryImages}
            proposedGalleryImages={proposedGalleryImages}
            rejectedGalleryImages={rejectedGalleryImages}
            displayName={displayName}
            role={role}
            uploadsEnabled={uploadsEnabled}
            globalEditing={globalEditing}
          />
        ),
      };
    }
    if (section.key === 'socials') {
      return {
        ...section,
        content: (
          <SocialsSectionContent
            talentId={talent.id}
            socials={socials}
            draftSocials={draftSocials}
            proposedSocials={proposedSocials}
            rejectedSocials={rejectedSocials}
            role={role}
            globalEditing={globalEditing}
          />
        ),
      };
    }
    if (section.key === 'seo') {
      return {
        ...section,
        content: (
          <SeoSectionContent
            talent={talent}
            publishedVersion={publishedVersion}
            pendingVersion={pendingVersion}
            role={role}
            globalEditing={globalEditing}
          />
        ),
      };
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
            role={role}
            uploadsEnabled={uploadsEnabled}
          />
        ),
      };
    }
    if (section.key === 'history') {
      return { ...section, content: <HistorySectionContent items={historyItems} /> };
    }
    return { ...section, content: <PlaceholderSectionContent label={section.label} /> };
  });

  // Talent Visibility sprint (admin UI) — single source of truth for the
  // header's Hide/Restore action button (see deriveCurrentVisibility's own
  // header comment for the "pending wins over published" rule). Also feeds
  // the single header badge below.
  const currentVisibility = deriveCurrentVisibility(publishedVersion, pendingVersion);

  // Talent Detail single-badge sprint — one header chip instead of the
  // previous workflow + visibility pair, via the same shared decision the
  // Talent List card uses (lib/admin/talent-workspace.js's
  // selectStatusBadge, through this detail-specific wrapper). Status/
  // visibility derivation themselves are unchanged; this only picks which
  // already-computed one wins. The Details tab's Current/Proposed
  // visibility comparison row is untouched — it renders independently in
  // ComparisonView, not from this badge.
  // Talent Archive & Restore feature — an archived talent's badge replaces
  // (not joins) the usual workflow/visibility badge, same "one badge, most
  // important state wins" rule selectDetailBadge itself already follows
  // for Hidden vs. Published. Archive is a stronger, entity-level state
  // than any content-workflow status, so it takes precedence over all of
  // them here rather than being combined with selectDetailBadge's result.
  const talentArchived = talent.status === LIFECYCLE_STATUS.ARCHIVED;
  const headerBadge = talentArchived
    ? { label: he.talent.detail.archiveAction.archivedBadge, tone: 'neutral' }
    : selectDetailBadge(status, currentVisibility);

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
            {/*
              Talent Detail single-badge sprint — replaces the previous two
              chips here (workflow status, then a separate visibility chip)
              with one badge, for consistency with the Talent List card.
              Hidden replaces Published rather than joining it; see
              selectDetailBadge's header comment.
            */}
            <StatusBadge label={headerBadge.label} tone={headerBadge.tone} />
            {/*
              Start Editing sprint — explicit user action only, never a side
              effect of this (pure-read) page load. `pendingVersion` here is
              exactly the same value loadPendingVersion() already fetched
              above for the comparison view; this button makes no engine
              calls of its own, it just reflects that existing read.
            */}
            <StartEditingButton talentId={talent.id} pendingStatus={pendingVersion?.status ?? null} />
            {/*
              Cancel Editing / Discard Draft sprint — a clear top-level
              action to abandon the whole editing session, not just unsaved
              field edits (that's the separate, unaffected bottom form
              Cancel). Only rendered when there's a DRAFT to discard — a
              PROPOSED version has no top-level cancel here at all; Owner
              Reject is the only way to withdraw that.
            */}
            {pendingVersion?.status === VERSION_STATUS.DRAFT ? (
              <CancelEditingButton talentId={talent.id} versionId={pendingVersion.id} />
            ) : null}
            {/*
              Talent Visibility sprint (admin UI) — requirement #2: the real
              Hide-from-Public-Site / Restore-Visibility action. Only
              rendered once a Published version exists (same publishedVersion
              guard <DetailsSectionContent> uses) — there is nothing
              meaningful to hide/restore for a talent that has never been
              published and has no draft either. Never publishes by itself;
              see TalentVisibilityAction.jsx for exactly what it does.
            */}
            {publishedVersion && !talentArchived ? (
              <TalentVisibilityAction
                talentId={talent.id}
                role={role}
                currentVisibility={currentVisibility}
                pendingVersionId={pendingVersion?.id ?? null}
                pendingVersionStatus={pendingVersion?.status ?? null}
              />
            ) : null}
            {/*
              Talent Archive & Restore feature — the OWNER-only Archive /
              Restore action. Always rendered (for OWNER; the component
              itself renders nothing for EMPLOYEE) regardless of
              published/draft state, unlike TalentVisibilityAction above —
              there is always something meaningful to archive (even a
              never-published talent), and always something to restore once
              archived.
            */}
            <TalentArchiveAction talentId={talent.id} role={role} archived={talentArchived} />
          </div>
        }
      />

      {talentArchived ? (
        <div className={styles.rejectionNotice} role="note">
          <p className={styles.rejectionNoticeTitle}>
            {he.talent.detail.archiveAction.archivedNoticeTitle}
          </p>
          <p className={styles.rejectionNoticeBody}>
            {he.talent.detail.archiveAction.archivedNoticeBody}
          </p>
        </div>
      ) : null}

      {rejectionNote ? (
        <div className={styles.rejectionNotice} role="note">
          <p className={styles.rejectionNoticeTitle}>{he.talent.detail.rejectionNote}</p>
          <p className={styles.rejectionNoticeBody}>{rejectionNote}</p>
        </div>
      ) : null}

      {/*
        Active-tab persistence sprint — TalentWorkspaceTabs now reads/writes
        the active tab via the URL (`?tab=`) instead of component-local
        state alone, so a refresh or Back/Forward keeps the same tab open
        instead of always resetting to פרטים. It needs `useSearchParams()`
        for that, which Next.js requires to sit under a Suspense boundary
        (this page is already `force-dynamic`, so this is a build-time
        requirement, not a real loading state — the fallback is never
        visibly shown since `sections` is already fully resolved above).
      */}
      <Suspense fallback={null}>
        <TalentWorkspaceTabs sections={sections} />
      </Suspense>

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
