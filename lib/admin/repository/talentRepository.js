/*
 * Talent repository — skeleton only (Phase 1: Foundations), plus sets of
 * thin primitives added in Sprint 3.3 and Sprint 3.4 for the Core Content
 * Engine's `talentAdapter` (lib/admin/engine/adapters/talentAdapter.js).
 *
 * The original stub methods below (`listTalents`, `getTalentById`,
 * `proposeTalentVersion`, `approveTalentVersion`, `rejectTalentVersion`,
 * etc.) defined the planned API surface for Phase 4/5 route handlers per
 * ADMIN_PANEL_PLAN.md Sections 3, 4, 5, 6, written before the v1.4
 * layering rules (Section 13.15) existed. They are left untouched here —
 * still stubs, still throwing via notImplemented() — since deciding
 * whether Phase 4 calls them directly or rebuilds equivalent behavior on
 * top of the engine/adapter is a Phase 4 decision, not this sprint's. Note
 * the Sprint 3.4 primitives below are deliberately named differently
 * (`publishTalentVersion`, `setTalentVersionRejection`) to avoid colliding
 * with these pre-existing stub names while that reconciliation is pending.
 *
 * The "Sprint 3.3"/"Sprint 3.4" methods below are intentionally lower-level
 * and decision-free where the data shape allows it (Section 13.15:
 * "Repositories are a thin data-access layer over Prisma — query
 * construction and shape-mapping only, no approval/publish/version-
 * transition decisions") — they exist solely so `talentAdapter` has
 * something real to call. The one necessary exception is
 * `publishTalentVersion`'s in-transaction revision comparison: Section
 * 13.8 requires the authoritative conflict check to run inside
 * publishService.publish()'s own transaction, not as a separate read-then-
 * write, and only the repository's `prisma.$transaction` callback can
 * provide that atomicity. That comparison is mechanical (does a live
 * column equal an expected number?), not a judgment call — the actual
 * decision of what a conflict *means* and how to respond still lives in
 * `publishService` (Section 13.16: "services own business logic"), which
 * is why the repository communicates it by throwing a tagged error
 * (`REVISION_CONFLICT_ERROR_CODE`) rather than silently choosing a winner.
 * Every other status/conflict/validation decision lives in the engine
 * (`proposalService`, `conflictService`, `publishService`,
 * `approvalService`), never here.
 *
 * Not wired to the public site, which continues reading
 * data/talent/index.js directly.
 */

import { prisma } from '../db';
import { notImplemented } from './_notImplemented';
import {
  VERSION_STATUS,
  LIFECYCLE_STATUS,
  TALENT_VISIBILITY,
  REVISION_CONFLICT_ERROR_CODE,
  SLUG_CONFLICT_ERROR_CODE,
  SLUG_INVALID_ERROR_CODE,
} from '../constants/enums';
import { isValidSlug } from '../slug';

/**
 * Talent Visibility sprint (Issue 2 fix) — explicit platform priority for
 * `listTalents`'s "pick one social row for the list preview" mapping below.
 * Mirrors the display order of lib/admin/social-platforms.js's
 * SOCIAL_PLATFORMS registry (instagram, tiktok, youtube, facebook, website,
 * threads), written out as a literal here rather than imported: that module
 * also pulls in he.js (Hebrew i18n labels) for its admin <select> UI, which
 * is a presentation-layer concern this data-access repository (Section
 * 13.15: "thin data-access layer ... no entity-specific branching/decisions
 * beyond query construction and shape-mapping") has no reason to depend on.
 * If a platform is ever added/reordered in that registry, update this list
 * to match.
 *
 * Previously, when no social was explicitly labeled "MAIN", the list fell
 * back to `talent.socials[0]` — whichever row Postgres happened to return
 * first for that `findMany` (no `orderBy` on the `socials` include), which
 * is not a stable/predictable order. This makes that fallback deterministic.
 */
const PLATFORM_PRIORITY = ['INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'FACEBOOK', 'WEBSITE', 'THREADS'];

/**
 * Pick "the" social account to preview for one talent in the list
 * (talentRepository.listTalents below). Decision-free shape mapping per
 * Section 13.15 — same classification the prior inline version already
 * carried, just made deterministic:
 *
 *   1. If one or more published socials are explicitly labeled MAIN, prefer
 *      those — an editor setting MAIN is an explicit signal about which
 *      account is the talent's primary one, and that signal should win over
 *      any platform-priority guess. This is unchanged product behavior from
 *      before this fix.
 *   2. Among the candidate set (the MAIN-labeled rows, or every published
 *      row if none is labeled MAIN), pick the one whose platform sorts
 *      first in PLATFORM_PRIORITY. A platform not in that list (forward
 *      compatibility with a future enum value) sorts last rather than
 *      throwing.
 *   3. Ties (e.g. two MAIN-labeled Instagram rows) fall back to array order,
 *      same as Array.prototype.sort's stable-sort guarantee — still
 *      deterministic, just not a meaningfully different choice between two
 *      otherwise-identical-priority rows.
 *
 * @param {Array<{ platform: string, label: string, handle: string|null, url: string|null }>} socials
 * @returns {{ platform: string, label: string, handle: string|null, url: string|null }|null}
 */
function pickMainSocial(socials) {
  if (!socials || socials.length === 0) return null;

  const mainLabeled = socials.filter((social) => social.label === 'MAIN');
  const candidates = mainLabeled.length > 0 ? mainLabeled : socials;

  const priorityIndex = (social) => {
    const index = PLATFORM_PRIORITY.indexOf(social.platform);
    return index === -1 ? PLATFORM_PRIORITY.length : index;
  };

  return [...candidates].sort((a, b) => priorityIndex(a) - priorityIndex(b))[0];
}

export const talentRepository = {
  /**
   * List talents for /admin/talent (Sprint 4.1 — read-only roster list,
   * ADMIN_PANEL_PLAN.md Section 2), with optional lifecycle status filter.
   * Decision-free per Section 13.15 ("thin data-access layer ... query
   * construction and shape-mapping only"): just selects the current
   * published version's display name and checks for the existence of any
   * DRAFT/PROPOSED version — it does not decide what "pending" means or
   * resolve full version content; that distinction stays in the
   * engine/adapter layer above.
   *
   * @param {object} [opts]
   * @param {string} [opts.status] - LIFECYCLE_STATUS filter, e.g. ACTIVE
   * @returns {Promise<Array<{
   *   id: string, slug: string, status: string,
   *   name: string|null, nameEn: string|null,
   *   category: string[], tags: string[],
   *   location: string|null, locationEn: string|null,
   *   profileImageUrl: string|null,
   *   socialPreview: { platform: string, label: string, handle: string|null, url: string|null }|null,
   *   hasPublishedVersion: boolean, hasPendingChanges: boolean,
   * }>>}
   */
  async listTalents({ status } = {}) {
    const talents = await prisma.talent.findMany({
      where: status ? { status } : undefined,
      // Admin Talent List Polish sprint: match the public site's ordering
      // (app/[locale]/talent/page.jsx sorts `[...talentList].sort((a, b) =>
      // a.sortOrder - b.sortOrder)`) instead of the DB-default `createdAt
      // desc`, so the admin roster reflects the same order visitors see —
      // not creation order, which has no relationship to display order.
      // `sortOrder` lives on TalentVersion (not Talent itself), so this is
      // a one-to-one relation orderBy (supported by Prisma for a non-list
      // relation like currentPublishedVersion). A talent with no published
      // version yet (sortOrder resolves to null) sorts last, same as
      // Postgres's default NULLS LAST for ascending order — deliberately
      // not "first", so an unpublished/never-finished profile doesn't jump
      // to the top of the work queue. `createdAt asc` is a stable
      // tie-breaker only (equal/missing sortOrder), not a ranking decision.
      orderBy: [
        { currentPublishedVersion: { sortOrder: 'asc' } },
        { createdAt: 'asc' },
      ],
      include: {
        // Admin Read Sprint: widened beyond name/nameEn to carry the rest
        // of the admin talent list's required columns (category, tags,
        // location, profile image). Still a straight select + one nested
        // relation — no decision-making added (Section 13.15).
        currentPublishedVersion: {
          select: {
            name: true,
            nameEn: true,
            category: true,
            tags: true,
            location: true,
            locationEn: true,
            sortOrder: true,
            featuredOrder: true,
            profileImageAsset: { select: { blobUrl: true } },
            // Talent Publishing Status sprint (Phase 1) — selected so
            // admin-list consumers (e.g. lib/admin/talent-workspace.js's
            // isListTalentHidden, once wired to real data in a later
            // phase) have the data available. No badge/filter UI reads
            // this yet this phase.
            visibility: true,
          },
        },
        versions: {
          where: { status: { in: [VERSION_STATUS.DRAFT, VERSION_STATUS.PROPOSED] } },
          select: { id: true },
          take: 1,
        },
        // "Social preview if already easy" (Admin Read Sprint requirement
        // #3): only PUBLISHED + ACTIVE rows, so a proposed/rejected/hidden
        // social account never leaks into the read-only list. Picking
        // *which one* of possibly several published socials counts as
        // "the" preview (MAIN label preferred) is decision-free shape
        // mapping done below, not a query-level filter — see the .map().
        socials: {
          where: {
            versionStatus: VERSION_STATUS.PUBLISHED,
            lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
          },
          select: { platform: true, label: true, handle: true, url: true },
        },
      },
    });

    return talents.map((talent) => {
      const version = talent.currentPublishedVersion;
      const mainSocial = pickMainSocial(talent.socials);

      return {
        id: talent.id,
        slug: talent.slug,
        status: talent.status,
        name: version?.name ?? null,
        nameEn: version?.nameEn ?? null,
        category: version?.category ?? [],
        tags: version?.tags ?? [],
        location: version?.location ?? null,
        locationEn: version?.locationEn ?? null,
        sortOrder: version?.sortOrder ?? null,
        featuredOrder: version?.featuredOrder ?? null,
        profileImageUrl: version?.profileImageAsset?.blobUrl ?? null,
        // Talent Publishing Status sprint (Phase 1) — carried through for
        // later phases' badge/filter UI; `null` when there is no published
        // version yet, same fallback convention as the other version-only
        // fields above.
        visibility: version?.visibility ?? null,
        socialPreview: mainSocial
          ? {
              platform: mainSocial.platform,
              label: mainSocial.label,
              handle: mainSocial.handle,
              url: mainSocial.url,
            }
          : null,
        hasPublishedVersion: Boolean(talent.currentPublishedVersionId),
        hasPendingChanges: talent.versions.length > 0,
      };
    });
  },

  /** Fetch one talent plus its current published version, socials, gallery. (Phase 4) */
  async getTalentById(/* talentId */) {
    return notImplemented('talentRepository.getTalentById');
  },

  /**
   * Fetch one talent by slug — mirrors the public site's lookup pattern.
   *
   * Add New Talent sprint: implemented (was a Phase 4 stub) — the new
   * "Add New Talent" form needs this for its pre-write slug-uniqueness
   * check. Decision-free per Section 13.15: a single `findUnique`, no
   * version/content resolution.
   *
   * @param {string} slug
   * @returns {Promise<object|null>}
   */
  async getTalentBySlug(slug) {
    if (!slug) return null;
    return prisma.talent.findUnique({ where: { slug } });
  },

  /**
   * Create a proposed TalentVersion for an existing talent. Performs the
   * optimistic-locking check from Section 6: compares `basedOnRevisionNumber`
   * against the talent's live `revisionNumber` and returns a conflict
   * result (not a throw) if stale, so the caller can render the
   * conflict-resolution screen. (Phase 4)
   */
  async proposeTalentVersion(/* talentId, fields, { basedOnRevisionNumber, createdById } */) {
    return notImplemented('talentRepository.proposeTalentVersion');
  },

  /** Create a brand-new talent as a proposal with no published counterpart yet. (Phase 4) */
  async proposeNewTalent(/* fields, { createdById } */) {
    return notImplemented('talentRepository.proposeNewTalent');
  },

  /**
   * Approve a proposed TalentVersion: flips it to PUBLISHED, flips the
   * prior published version to SUPERSEDED, repoints
   * Talent.currentPublishedVersionId, and bumps Talent.revisionNumber —
   * all in one transaction (Section 4). Also writes the AuditLog row
   * (Section 4.1). (Phase 5)
   */
  async approveTalentVersion(/* talentVersionId, { approvedById, ip, userAgent } */) {
    return notImplemented('talentRepository.approveTalentVersion');
  },

  /** Reject a proposed TalentVersion with a required rejectionNote (Section 4). (Phase 5) */
  async rejectTalentVersion(/* talentVersionId, { rejectedById, rejectionNote, ip, userAgent } */) {
    return notImplemented('talentRepository.rejectTalentVersion');
  },

  /** Soft-delete/archive/hide/restore a talent — status transition only, never a real DELETE (Section 5). (Phase 4) */
  async setTalentLifecycleStatus(/* talentId, status, { actorId, ip, userAgent } */) {
    return notImplemented('talentRepository.setTalentLifecycleStatus');
  },

  /** Propose social link changes for a talent (Section 3.2). (Phase 4) */
  async proposeTalentSocial(/* talentId, platform, proposedUrl, followerCount */) {
    return notImplemented('talentRepository.proposeTalentSocial');
  },

  /** Propose gallery additions/removals/reordering/crop edits (Section 10). (Phase 6) */
  async proposeGalleryChange(/* talentId, change */) {
    return notImplemented('talentRepository.proposeGalleryChange');
  },

  // ───────────────────────────────────────────────────────────────────────
  // Sprint 3.3 — thin primitives for the Core Content Engine's
  // talentAdapter (lib/admin/engine/adapters/talentAdapter.js). See header
  // comment: no version-transition or conflict decisions here.
  // ───────────────────────────────────────────────────────────────────────

  /** Fetch the bare Talent row (for adapter.getParent / conflictService's revisionNumber read). */
  async getParentTalent(talentId) {
    if (!talentId) return null;
    return prisma.talent.findUnique({ where: { id: talentId } });
  },

  /**
   * Talent Archive & Restore — status transition only, never a real DELETE
   * (Section 5). Mirrors clientRepository.archiveClient's shape/stamp
   * convention exactly: flips Talent.status to ARCHIVED and stamps the
   * conventional deletedAt/deletedBy attribution. No cascade — every
   * TalentVersion/TalentSocial/TalentGalleryImage row, and this Talent's
   * own currentPublishedVersionId/revisionNumber, are left completely
   * untouched, so history/media/socials/SEO are preserved by construction.
   * Eligibility/idempotence decisions (already archived? who may archive?)
   * belong to the caller (talentArchiveService), not here — same split
   * clientRepository.archiveClient documents.
   */
  async archiveTalent(talentId, archivedByUserId) {
    if (!talentId) return null;
    return prisma.talent.update({
      where: { id: talentId },
      data: {
        status: LIFECYCLE_STATUS.ARCHIVED,
        deletedAt: new Date(),
        deletedBy: archivedByUserId ?? null,
      },
    });
  },

  /**
   * Talent Archive & Restore — the inverse transition: ARCHIVED -> ACTIVE,
   * clearing the soft-delete stamp. Same no-cascade guarantee as
   * archiveTalent above — restoring only ever flips the parent row's own
   * status back, so the exact published version/history/media/socials/SEO
   * that existed before archiving reappear unchanged, with no re-publish
   * step required.
   */
  async restoreTalent(talentId) {
    if (!talentId) return null;
    return prisma.talent.update({
      where: { id: talentId },
      data: {
        status: LIFECYCLE_STATUS.ACTIVE,
        deletedAt: null,
        deletedBy: null,
      },
    });
  },

  /**
   * Fetch one TalentVersion row by id (for adapter.getVersion).
   *
   * Talent Detail Header DB read-only mapping sprint: widened with a
   * decision-free `include` of the linked ImageAsset's `blobUrl` (Section
   * 13.15 — shape mapping, not a query/business decision) so the workspace
   * header can display the profile photo without a second round trip.
   * Every other column on the version row (birthDate, profileImagePosition,
   * profileImageScale, etc.) is already a plain scalar returned by default
   * — only the image relation needed an explicit include. No write, no new
   * caller-visible shape removed, purely additive.
   *
   * Admin Talent Detail Podcast (read-only) sprint: same reasoning applied
   * to `podcastImageAsset` — podcastTitle/podcastDescriptionHe/
   * podcastDescriptionEn/podcastImageAssetId/podcastVideoEmbedUrl are plain
   * scalars on TalentVersion already returned by default; only the
   * podcastImageAsset relation (for its blobUrl) needed an explicit
   * include, mirroring profileImageAsset above. Still no write.
   */
  async getTalentVersionById(versionId) {
    if (!versionId) return null;
    return prisma.talentVersion.findUnique({
      where: { id: versionId },
      include: {
        profileImageAsset: { select: { blobUrl: true } },
        podcastImageAsset: { select: { blobUrl: true } },
      },
    });
  },

  /**
   * List every TalentVersion for a talent, newest first (for
   * adapter.listVersionsForParent). Includes `createdBy`/`approvedBy`
   * (User.email only — Section 11: never select passwordHash) so callers
   * can render a meaningful "who" for each row (History Tab Real Data
   * sprint) instead of a raw `createdById`/`approvedById` string. Still
   * decision-free per Section 13.15: this is query shape only, no
   * status/version-transition logic added.
   */
  async listTalentVersionsForTalent(talentId) {
    return prisma.talentVersion.findMany({
      where: { talentId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { email: true } },
        approvedBy: { select: { email: true } },
        // Podcast Image Upload sprint — the pending DRAFT/PROPOSED version
        // the admin talent detail page reads comes from this list query
        // (versionService.getCurrentDraftOrProposed → listVersionsForParent),
        // so the podcast image relation rides along here rather than
        // requiring a second per-version read just to resolve the pending
        // cover's blobUrl after a refresh. Same additive-include reasoning
        // as getTalentVersionById above; blobUrl only, still a pure read.
        podcastImageAsset: { select: { blobUrl: true } },
      },
    });
  },

  /**
   * Insert a new TalentVersion row exactly as given — no status/conflict
   * decision is made here, that's `proposalService`'s job. Used by
   * adapter.insertProposedVersion.
   */
  async insertTalentVersion({
    talentId,
    fields,
    status,
    basedOnVersionId,
    basedOnRevisionNumber,
    createdById,
  }) {
    return prisma.talentVersion.create({
      data: {
        talentId,
        status,
        basedOnVersionId: basedOnVersionId || null,
        basedOnRevisionNumber: basedOnRevisionNumber ?? null,
        createdById,
        name: fields.name,
        nameEn: fields.nameEn,
        category: fields.category || [],
        tags: fields.tags || [],
        featured: fields.featured ?? false,
        featuredOrder: fields.featuredOrder,
        sortOrder: fields.sortOrder,
        location: fields.location,
        locationEn: fields.locationEn,
        birthDate: fields.birthDate,
        bioHe: fields.bioHe,
        bioEn: fields.bioEn,
        profileImageAssetId: fields.profileImageAssetId,
        profileImagePosition: fields.profileImagePosition,
        profileImageScale: fields.profileImageScale,
        // Podcast prefill bugfix — persist the podcast columns when a Draft
        // is seeded from a Published version (extractTalentVersionFields).
        // These were previously dropped here even if the caller supplied
        // them, so a "Start Editing" Draft always had null podcast data:
        // the Podcast tab's edit form opened empty, and publishing that
        // Draft would wipe the live podcast fields. Callers that don't set
        // these keys (e.g. creating a brand-new talent) pass `undefined`,
        // which Prisma treats as "not provided" — the columns default to
        // null exactly as before, so no other flow changes.
        podcastTitle: fields.podcastTitle,
        podcastDescriptionHe: fields.podcastDescriptionHe,
        podcastDescriptionEn: fields.podcastDescriptionEn,
        podcastVideoEmbedUrl: fields.podcastVideoEmbedUrl,
        podcastImageAssetId: fields.podcastImageAssetId,
        // Talent SEO + Slug Management sprint — persist the versioned slug
        // + SEO columns when a Draft is seeded from a Published version
        // (extractTalentVersionFields), same "full snapshot" reasoning as
        // the podcast columns above: without these, publishing a Draft
        // seeded after this sprint would silently wipe live SEO values.
        // Callers that don't set these keys pass `undefined`, which Prisma
        // treats as "not provided" — columns default to null/false.
        slug: fields.slug,
        seoTitle: fields.seoTitle,
        seoDescription: fields.seoDescription,
        seoCanonicalUrl: fields.seoCanonicalUrl,
        seoOgTitle: fields.seoOgTitle,
        seoOgDescription: fields.seoOgDescription,
        seoOgImageUrl: fields.seoOgImageUrl,
        seoNoindex: fields.seoNoindex,
        // Talent Publishing Status sprint (Phase 1) — explicit default
        // mirrors the schema column's @default(VISIBLE) so a caller that
        // omits `visibility` entirely (every caller today) still gets a
        // well-defined value rather than relying solely on the DB default,
        // matching this method's existing "no field is left implicit"
        // pattern for the other scalars above.
        visibility: fields.visibility ?? TALENT_VISIBILITY.VISIBLE,
      },
    });
  },

  /**
   * Flip a TalentVersion's status — no decision about whether the flip is
   * allowed happens here, that's `proposalService.submit()`'s job. Used by
   * adapter.submitVersion.
   */
  async updateTalentVersionStatus(versionId, status) {
    return prisma.talentVersion.update({
      where: { id: versionId },
      data: { status },
    });
  },

  /**
   * Save Draft sprint — partial-field update for a TalentVersion. No
   * status/conflict decision happens here, that's `proposalService.update()`'s
   * job; this is pure data-access (Section 13.15).
   *
   * COLUMN-CLOBBER PROTECTION (required safeguard): builds the Prisma `data`
   * object using only the keys actually present in `fields` — never writes
   * a column the caller didn't include. This matters because the Details
   * editor only surfaces 9 of TalentVersion's ~12 business columns; a naive
   * `data: { ...fields }` or a full-row update would silently null out
   * `profileImageAssetId`/`profileImagePosition`/`profileImageScale` (and
   * any future gallery/social/SEO columns added to this same row) every
   * time someone saved a Details draft. Uses `Object.prototype.hasOwnProperty`
   * (not `fields.x !== undefined`) so an explicit `null`/`""` the caller
   * does intend to write is preserved, while a key that's simply absent
   * from the payload is left untouched on the row.
   *
   * @param {string} versionId
   * @param {object} fields - partial TalentVersion business fields; only
   *   own-keys present are written
   * @returns {Promise<object>} the updated TalentVersion row
   */
  async updateTalentVersionFields(versionId, fields) {
    if (!versionId) {
      throw new Error('[talentRepository.updateTalentVersionFields] versionId is required.');
    }
    if (!fields || typeof fields !== 'object') {
      throw new Error('[talentRepository.updateTalentVersionFields] fields must be an object.');
    }

    // Every column this method is allowed to touch. Deliberately an
    // allowlist (not "every key in fields") so an unexpected/typo'd key in
    // the payload is silently ignored rather than passed straight through
    // to Prisma's `data` object.
    const WRITABLE_COLUMNS = [
      'name',
      'nameEn',
      'category',
      'tags',
      'featured',
      'featuredOrder',
      'sortOrder',
      'location',
      'locationEn',
      'birthDate',
      'bioHe',
      'bioEn',
      'profileImageAssetId',
      'profileImagePosition',
      'profileImageScale',
      // Enable Podcast Save sprint — the four podcast scalar columns the
      // Podcast tab's editor (buildPodcastGroups, app/admin/talent/[id]/
      // page.jsx) now writes through this same allowlisted update path.
      'podcastTitle',
      'podcastDescriptionHe',
      'podcastDescriptionEn',
      'podcastVideoEmbedUrl',
      // Podcast Image Upload sprint — podcastImageAssetId joins the
      // allowlist now that a safe picker/upload flow exists for it:
      // PodcastTab.jsx's "החלף תמונה" uploads via the shared
      // /api/admin/assets/upload endpoint (purpose="podcast", see
      // lib/storage/utils/validationProfiles.js) and then PATCHes only
      // { podcastImageAssetId } through this same allowlisted path — the
      // exact profileImageAssetId precedent above. No other field widened.
      'podcastImageAssetId',
      // Talent Publishing Status sprint (Phase 1) — visibility is a normal
      // versioned field, written through this exact allowlisted path like
      // every other column above. No new write mechanism, per the approved
      // spec's "treat visibility like any other versioned field" rule.
      'visibility',
      // Talent SEO + Slug Management sprint — slug + the SEO block join the
      // allowlist as normal versioned fields, written through this exact
      // same path by the SEO tab's editor (components/admin/SeoEditor.jsx →
      // PATCH proposals/[versionId]). Note `slug` here is only ever the
      // version's PROPOSED slug — Talent.slug (the live public URL) is
      // untouched by this method and only ever rewritten inside
      // publishTalentVersion's transaction below.
      'slug',
      'seoTitle',
      'seoDescription',
      'seoCanonicalUrl',
      'seoOgTitle',
      'seoOgDescription',
      'seoOgImageUrl',
      'seoNoindex',
    ];

    const data = {};
    for (const key of WRITABLE_COLUMNS) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) {
        data[key] = fields[key];
      }
    }

    if (Object.keys(data).length === 0) {
      // Nothing to write — return the current row unchanged rather than
      // issuing a no-op Prisma update.
      return prisma.talentVersion.findUnique({ where: { id: versionId } });
    }

    return prisma.talentVersion.update({
      where: { id: versionId },
      data,
    });
  },

  // ───────────────────────────────────────────────────────────────────────
  // Sprint 3.4 — thin primitives for publishService/approvalService, via
  // talentAdapter.publishVersion / talentAdapter.rejectVersion. See header
  // comment for why publishTalentVersion's revision comparison is the one
  // exception to "decision-free."
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Atomically publish a PROPOSED TalentVersion (Sections 4, 13.5,
   * 13.17#3): supersede the talent's current published version (if any),
   * flip the target version to PUBLISHED with approvedById/approvedAt set,
   * repoint Talent.currentPublishedVersionId at it, and bump
   * Talent.revisionNumber — all inside one `prisma.$transaction`.
   *
   * Section 13.8's authoritative conflict check happens here, at the start
   * of the same transaction: if `expectedRevisionNumber` is supplied and no
   * longer matches the talent's live `revisionNumber`, this throws before
   * any write — which aborts the whole transaction — rather than returning
   * a result the caller has to remember to check. The thrown error carries
   * `code: REVISION_CONFLICT_ERROR_CODE` plus `currentRevisionNumber` /
   * `expectedRevisionNumber` so `publishService.publish()` can recognize it
   * and translate it into the same conflict shape `conflictService` uses,
   * without this repository importing anything from the engine layer.
   *
   * `expectedRevisionNumber == null` means "no base to compare against"
   * (e.g. a brand-new entity's first publish) — skipped, not treated as a
   * conflict, mirroring `conflictService.checkRevision`'s own behavior.
   *
   * @param {string} versionId
   * @param {object} params
   * @param {number|null} [params.expectedRevisionNumber]
   * @param {string} params.approvedById
   * @returns {Promise<{ version: object, parent: object }>}
   */
  async publishTalentVersion(versionId, { expectedRevisionNumber, approvedById } = {}) {
    if (!versionId) {
      throw new Error('[talentRepository.publishTalentVersion] versionId is required.');
    }
    if (!approvedById) {
      throw new Error('[talentRepository.publishTalentVersion] approvedById is required.');
    }

    return prisma.$transaction(async (tx) => {
      const version = await tx.talentVersion.findUnique({ where: { id: versionId } });
      if (!version) {
        throw new Error(
          `[talentRepository.publishTalentVersion] no TalentVersion found for id "${versionId}".`
        );
      }

      const talent = await tx.talent.findUnique({ where: { id: version.talentId } });
      if (!talent) {
        throw new Error(
          `[talentRepository.publishTalentVersion] no parent Talent found for id "${version.talentId}".`
        );
      }

      if (expectedRevisionNumber != null && talent.revisionNumber !== expectedRevisionNumber) {
        throw Object.assign(
          new Error(
            `[talentRepository.publishTalentVersion] revision conflict: talent "${talent.id}" ` +
              `is at revisionNumber ${talent.revisionNumber}, expected ${expectedRevisionNumber}.`
          ),
          {
            code: REVISION_CONFLICT_ERROR_CODE,
            currentRevisionNumber: talent.revisionNumber,
            expectedRevisionNumber,
          }
        );
      }

      // Talent SEO + Slug Management sprint — the authoritative slug gate,
      // inside the same transaction as the publish itself (mirroring the
      // revision-conflict check above: mechanical comparisons, tagged
      // errors, no judgment calls — what a slug conflict *means* is the
      // caller's business).
      //
      // `version.slug == null` means "this version proposes no slug change"
      // (every pre-migration row, and any draft that never touched the
      // slug) — the parent keeps its current slug, exactly as today.
      // Otherwise:
      //   - format is re-validated server-side (the editor normalizes
      //     as-you-type, but the transaction can't trust the client);
      //   - if the proposed slug differs from the parent's current one,
      //     no other Talent row may already own it. The check runs inside
      //     the transaction so two concurrent publishes can't both pass;
      //     Talent.slug's @unique constraint remains the final backstop
      //     (a P2002 would abort the transaction anyway).
      // Only when both gates pass does the parent update below carry the
      // new slug — this is the single moment the public URL ever changes.
      let slugUpdate = {};
      if (version.slug != null) {
        if (!isValidSlug(version.slug)) {
          throw Object.assign(
            new Error(
              `[talentRepository.publishTalentVersion] proposed slug "${version.slug}" is not a ` +
                'valid slug (allowed: a-z, 0-9, single hyphens; no leading/trailing hyphen).'
            ),
            { code: SLUG_INVALID_ERROR_CODE, slug: version.slug }
          );
        }

        if (version.slug !== talent.slug) {
          const slugOwner = await tx.talent.findFirst({
            where: { slug: version.slug, id: { not: talent.id } },
            select: { id: true, slug: true },
          });
          if (slugOwner) {
            throw Object.assign(
              new Error(
                `[talentRepository.publishTalentVersion] slug "${version.slug}" is already owned ` +
                  `by talent "${slugOwner.id}" — publishing is not allowed while another talent ` +
                  'holds the same slug.'
              ),
              { code: SLUG_CONFLICT_ERROR_CODE, slug: version.slug, conflictingTalentId: slugOwner.id }
            );
          }
          slugUpdate = { slug: version.slug };
        }
      }

      if (talent.currentPublishedVersionId && talent.currentPublishedVersionId !== versionId) {
        await tx.talentVersion.update({
          where: { id: talent.currentPublishedVersionId },
          data: { status: VERSION_STATUS.SUPERSEDED },
        });
      }

      const publishedVersion = await tx.talentVersion.update({
        where: { id: versionId },
        data: {
          status: VERSION_STATUS.PUBLISHED,
          approvedById,
          approvedAt: new Date(),
        },
      });

      const publishedTalent = await tx.talent.update({
        where: { id: talent.id },
        data: {
          currentPublishedVersionId: versionId,
          revisionNumber: { increment: 1 },
          ...slugUpdate,
        },
      });

      return { version: publishedVersion, parent: publishedTalent };
    });
  },

  // ───────────────────────────────────────────────────────────────────────
  // Add New Talent sprint — the one gap left in this repository: nothing
  // above could create a brand-new *parent* Talent row. insertTalentVersion
  // (Sprint 3.3) requires an existing talentId, and the original Phase 1
  // stub `proposeNewTalent` (above) was never implemented. This is that
  // smallest safe addition.
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Create a brand-new Talent (parent row) together with its first
   * TalentVersion, atomically.
   *
   * Add New Talent flow revision (product decision): creating a talent
   * must NOT publish it directly. The first version is written as DRAFT —
   * an initial, editable admin record only — and `Talent.
   * currentPublishedVersionId` is deliberately left null. The admin/
   * employee then completes profile details, gallery, socials, and SEO on
   * the talent detail page, and only the normal Draft -> Proposed ->
   * Approve -> Publish flow (unchanged, see `publishTalentVersion` below)
   * can ever set `currentPublishedVersionId` and make the talent visible
   * anywhere a "published" read applies. The public site doesn't read this
   * table at all today (it reads data/talent/index.js directly), so this
   * change has no public-site effect either way — see this file's header
   * comment.
   *
   * No schema change was needed for this: `Talent.currentPublishedVersionId`
   * is already nullable, and the admin list/detail UI already has copy and
   * branching for "no published version yet" (he.talent.list.filters.draft,
   * he.talent.detail.noPublishedVersionTitle) — a freshly created talent
   * simply lands in that existing state.
   *
   * Mirrors `publishTalentVersion`'s shape: one `prisma.$transaction`
   * covering the Talent insert and the TalentVersion insert, so a
   * half-created talent (parent row with no version, or vice versa) can
   * never be observed.
   *
   * Slug uniqueness is enforced by the `Talent.slug` `@unique` constraint
   * already in the schema — a duplicate slug surfaces here as a Prisma
   * P2002 error, which the caller (the new POST /api/admin/talent route)
   * catches and translates into a Hebrew 409 response.
   *
   * @param {object} params
   * @param {string} params.slug
   * @param {object} params.fields - TalentVersion business fields (name, nameEn, ...)
   * @param {string} params.createdById
   * @returns {Promise<{ talent: object, version: object }>}
   */
  async createTalentWithInitialVersion({ slug, fields, createdById }) {
    if (!slug) {
      throw new Error('[talentRepository.createTalentWithInitialVersion] slug is required.');
    }
    if (!createdById) {
      throw new Error('[talentRepository.createTalentWithInitialVersion] createdById is required.');
    }
    if (!fields || typeof fields !== 'object') {
      throw new Error('[talentRepository.createTalentWithInitialVersion] fields must be an object.');
    }

    return prisma.$transaction(async (tx) => {
      const talent = await tx.talent.create({
        data: {
          slug,
          status: LIFECYCLE_STATUS.ACTIVE,
          revisionNumber: 1,
        },
      });

      const version = await tx.talentVersion.create({
        data: {
          talentId: talent.id,
          status: VERSION_STATUS.DRAFT,
          createdById,
          name: fields.name,
          nameEn: fields.nameEn,
          category: fields.category || [],
          tags: fields.tags || [],
          featured: fields.featured ?? false,
          featuredOrder: fields.featuredOrder,
          sortOrder: fields.sortOrder,
          location: fields.location,
          locationEn: fields.locationEn,
          birthDate: fields.birthDate,
          bioHe: fields.bioHe,
          bioEn: fields.bioEn,
          profileImageAssetId: fields.profileImageAssetId,
          profileImagePosition: fields.profileImagePosition,
          profileImageScale: fields.profileImageScale,
          // Talent SEO + Slug Management sprint — the initial version's own
          // versioned slug snapshot mirrors the parent's slug at creation
          // time, so the Slug editor has a real baseline to show/edit and
          // publishing this first version is always a no-op slug-wise.
          slug: fields.slug ?? slug,
          // Talent Publishing Status sprint (Phase 1) — same explicit
          // default as insertTalentVersion above, for the same reason.
          visibility: fields.visibility ?? TALENT_VISIBILITY.VISIBLE,
        },
      });

      // Deliberately NOT updating talent.currentPublishedVersionId here —
      // that pointer is only ever set by the normal publish flow
      // (publishTalentVersion above), once an Owner approves a PROPOSED
      // version. A freshly created talent has none yet.
      return { talent, version };
    });
  },

  // ───────────────────────────────────────────────────────────────────────
  // Talent Detail DB Read Integration sprint — two more thin, decision-free
  // read primitives, same pattern as the Sprint 3.3 ones above, so the
  // talent workspace's Gallery/Socials tabs can read published rows from
  // Postgres instead of data/talent/index.js. Both filter to
  // versionStatus=PUBLISHED + lifecycleStatus=ACTIVE only (sprint
  // requirement: "display current Published data only") — no
  // draft/proposed/rejected/hidden/deleted row is ever returned here.
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Published, active social accounts for a talent, in display order.
   * Multiple rows per platform are expected and intentionally not
   * collapsed here (Section 13.15: shape mapping, not a "pick one"
   * decision) — the caller decides how to present multiple accounts on the
   * same platform.
   *
   * Rejected Resubmission Recovery sprint — widened to also select
   * `createdAt` and `basedOnVersionId`. Pure additive shape-mapping
   * (Section 13.15: still one `findMany`, no new filter/decision): these
   * two columns are what `social-review.js`'s `filterUnresolvedRejectedSocials`
   * needs to tell whether a REJECTED row has already been superseded by a
   * newer attempt in the same lineage (see that function's header comment).
   *
   * @param {string} talentId
   * @returns {Promise<Array<{ id, platform, label, customLabel, handle, url, sortOrder, createdAt, basedOnVersionId }>>}
   */
  async getPublishedSocialsForTalent(talentId) {
    if (!talentId) return [];
    return prisma.talentSocial.findMany({
      where: {
        talentId,
        versionStatus: VERSION_STATUS.PUBLISHED,
        lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        platform: true,
        label: true,
        customLabel: true,
        handle: true,
        url: true,
        sortOrder: true,
        createdAt: true,
        basedOnVersionId: true,
      },
    });
  },

  /**
   * Published, active gallery images for a talent, in display order, with
   * the backing ImageAsset's blobUrl already joined in (so callers never
   * need a second query to render a `src`).
   *
   * @param {string} talentId
   * @returns {Promise<Array<{ id, order, altHe, altEn, position, scale, mobileOrder, imageAsset: { blobUrl } }>>}
   */
  async getPublishedGalleryImagesForTalent(talentId) {
    if (!talentId) return [];
    return prisma.talentGalleryImage.findMany({
      where: {
        talentId,
        versionStatus: VERSION_STATUS.PUBLISHED,
        lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
      },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        order: true,
        altHe: true,
        altEn: true,
        position: true,
        scale: true,
        mobileOrder: true,
        imageAsset: { select: { blobUrl: true } },
      },
    });
  },

  // ───────────────────────────────────────────────────────────────────────
  // Social Links persistence sprint — thin primitives so TalentSocial rows
  // (each with its OWN versionStatus/basedOnVersionId — see schema header
  // comment on TalentSocial) can go through the same Draft -> Proposed ->
  // Published pattern TalentVersion already uses, one row at a time. The
  // generic engine (proposalService) assumes exactly one current version
  // row per parent, which doesn't fit "many independently-versioned social
  // rows per talent" — so lib/admin/engine/socialsService.js (a new,
  // dedicated service, not proposalService) owns the create/update/submit
  // decisions, calling these decision-free primitives via talentAdapter's
  // matching methods. Same Section 13.15 rule as every primitive above:
  // query construction and shape-mapping only, no status-transition
  // decisions made here.
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Draft or Proposed (not yet published, not rejected/superseded), active
   * social rows for a talent — the "Proposed Update" column's data source
   * once a save has happened. Same shape/ordering as
   * getPublishedSocialsForTalent, plus `versionStatus`/`basedOnVersionId` so
   * the caller can tell a DRAFT row from a PROPOSED one (submit-eligibility)
   * and a cloned-from-published row from a brand-new one.
   *
   * Rejected Resubmission Recovery sprint — widened to also select
   * `createdAt`, for the same reason documented on
   * `getPublishedSocialsForTalent` above: `filterUnresolvedRejectedSocials`
   * needs every row's `createdAt` to determine which one is newest in a
   * lineage chain.
   *
   * @param {string} talentId
   * @returns {Promise<Array<{ id, platform, label, customLabel, handle, url, sortOrder, versionStatus, basedOnVersionId, createdAt }>>}
   */
  async getDraftOrProposedSocialsForTalent(talentId) {
    if (!talentId) return [];
    return prisma.talentSocial.findMany({
      where: {
        talentId,
        versionStatus: { in: [VERSION_STATUS.DRAFT, VERSION_STATUS.PROPOSED] },
        lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        platform: true,
        label: true,
        customLabel: true,
        handle: true,
        url: true,
        sortOrder: true,
        versionStatus: true,
        basedOnVersionId: true,
        createdAt: true,
      },
    });
  },

  /**
   * Owner Review (Social Links) sprint — every PROPOSED TalentSocial row
   * for a talent, regardless of lifecycleStatus. Sibling to
   * getDraftOrProposedSocialsForTalent above, but narrower (PROPOSED only —
   * a review screen has no business showing an author's still-editable
   * DRAFT rows) and wider on lifecycleStatus (no ACTIVE filter), so that if
   * a future write path ever flips a PROPOSED row's lifecycleStatus away
   * from ACTIVE to represent "remove this account," this read still
   * surfaces it for the Owner instead of silently hiding it. Today nothing
   * writes lifecycleStatus on TalentSocial (updateTalentSocialFields's
   * WRITABLE_COLUMNS excludes it — see below), so in practice every row
   * this returns is ACTIVE; see lib/admin/social-review.js's header comment
   * for how that limitation is surfaced to callers.
   *
   * Also returns `createdBy`'s email (not just the id) — the review screen
   * shows who proposed each account, the same way other review surfaces
   * attribute a proposal to its author.
   *
   * @param {string} talentId
   * @returns {Promise<Array<{ id, platform, label, customLabel, handle, url, sortOrder, versionStatus, lifecycleStatus, basedOnVersionId, createdAt, createdBy: { email }|null }>>}
   */
  async getProposedSocialsForTalent(talentId) {
    if (!talentId) return [];
    return prisma.talentSocial.findMany({
      where: {
        talentId,
        versionStatus: VERSION_STATUS.PROPOSED,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        platform: true,
        label: true,
        customLabel: true,
        handle: true,
        url: true,
        sortOrder: true,
        versionStatus: true,
        lifecycleStatus: true,
        basedOnVersionId: true,
        createdAt: true,
        createdBy: { select: { email: true } },
      },
    });
  },

  /** Fetch one TalentSocial row by id, full shape (for ownership/status checks before an edit). */
  async getTalentSocialById(socialId) {
    if (!socialId) return null;
    return prisma.talentSocial.findUnique({ where: { id: socialId } });
  },

  /**
   * Insert a brand-new TalentSocial row in DRAFT status — either a
   * genuinely new account (basedOnVersionId null) or a draft clone of an
   * existing PUBLISHED row being edited for the first time
   * (basedOnVersionId = that published row's id), mirroring
   * insertTalentVersion's basedOnVersionId convention above. No
   * status/eligibility decision is made here — socialsService decides
   * which case applies before calling this.
   *
   * Social Remove sprint — `fields.lifecycleStatus` is now threaded through
   * (defaulting to ACTIVE), mirroring insertDraftGalleryImage's identical
   * change from the Gallery Image Removal sprint. This is what lets a
   * caller seed a clone of a PUBLISHED row directly as HIDDEN (the "remove
   * a live account" draft), while every other caller (plain edits,
   * brand-new accounts, resumeRejected) keeps the implicit ACTIVE default
   * it always had. Never a decision made here — socialsService decides the
   * value, this is still just a pass-through default.
   *
   * @param {object} params
   * @param {string} params.talentId
   * @param {object} params.fields - { platform, label, customLabel, handle, url, sortOrder, lifecycleStatus }
   * @param {string|null} [params.basedOnVersionId]
   * @param {string} params.createdById
   */
  async insertDraftSocial({ talentId, fields, basedOnVersionId, createdById }) {
    if (!talentId) {
      throw new Error('[talentRepository.insertDraftSocial] talentId is required.');
    }
    if (!createdById) {
      throw new Error('[talentRepository.insertDraftSocial] createdById is required.');
    }
    if (!fields || typeof fields !== 'object') {
      throw new Error('[talentRepository.insertDraftSocial] fields must be an object.');
    }

    return prisma.talentSocial.create({
      data: {
        talentId,
        platform: fields.platform,
        label: fields.label || 'MAIN',
        customLabel: fields.customLabel ?? null,
        handle: fields.handle ?? null,
        url: fields.url ?? null,
        sortOrder: fields.sortOrder ?? null,
        lifecycleStatus: fields.lifecycleStatus ?? LIFECYCLE_STATUS.ACTIVE,
        versionStatus: VERSION_STATUS.DRAFT,
        basedOnVersionId: basedOnVersionId || null,
        createdById,
      },
    });
  },

  /**
   * Partial-field update for an existing DRAFT or PROPOSED TalentSocial row
   * in place — same column-clobber protection as updateTalentVersionFields
   * above (allowlist + hasOwnProperty), and for the same reason: a caller
   * that only sends `{ handle, url }` must never silently null out
   * `label`/`customLabel`/`sortOrder`. No status decision here — the caller
   * must already know this row is editable.
   *
   * Social Remove sprint — `lifecycleStatus` added to the allowlist,
   * mirroring updateTalentGalleryImageFields's identical change from the
   * Gallery Image Removal sprint. This is what lets socialsService.saveDraft
   * mark an existing DRAFT/PROPOSED row HIDDEN in place (the "this row was
   * never published, so withdrawing it needs no clone and no approval"
   * case). Previously excluded on purpose (see social-review.js's
   * now-resolved "KNOWN LIMITATION" comment) because no caller could ever
   * produce a non-ACTIVE row; this sprint resolves that limitation.
   *
   * @param {string} socialId
   * @param {object} fields - partial TalentSocial business fields
   */
  async updateTalentSocialFields(socialId, fields) {
    if (!socialId) {
      throw new Error('[talentRepository.updateTalentSocialFields] socialId is required.');
    }
    if (!fields || typeof fields !== 'object') {
      throw new Error('[talentRepository.updateTalentSocialFields] fields must be an object.');
    }

    const WRITABLE_COLUMNS = ['platform', 'label', 'customLabel', 'handle', 'url', 'sortOrder', 'lifecycleStatus'];

    const data = {};
    for (const key of WRITABLE_COLUMNS) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) {
        data[key] = fields[key];
      }
    }

    if (Object.keys(data).length === 0) {
      return prisma.talentSocial.findUnique({ where: { id: socialId } });
    }

    return prisma.talentSocial.update({ where: { id: socialId }, data });
  },

  /**
   * Submit sprint — flip every DRAFT social row for a talent to PROPOSED in
   * one transaction, mirroring updateTalentVersionStatus's single-row flip
   * but applied to a whole talent's worth of rows at once, since "Submit"
   * for Social Links is one user action that should move every pending
   * draft account into review together (not one row at a time). PROPOSED
   * rows already submitted are left untouched (idempotent: a second submit
   * with no new drafts simply finds nothing to flip). No "is this allowed"
   * decision here — socialsService.submit() decides what an empty result
   * means.
   *
   * Pre-merge blocker fix sprint (QA finding #4) — optional `createdById`
   * narrows the flip to DRAFT rows authored by that user. Decision-free
   * per Section 13.15 (a mechanical WHERE clause, not a judgment call);
   * *whether* to scope is decided by the caller (the Owner direct-publish
   * routes pass the acting Owner's id so another author's half-finished
   * drafts are never swept into a publish; the plain Submit routes pass
   * nothing and behave exactly as before).
   *
   * @param {string} talentId
   * @param {object} [opts]
   * @param {string} [opts.createdById] - only flip DRAFT rows created by this user
   * @returns {Promise<object[]>} the rows that were just flipped to PROPOSED (empty if none were DRAFT)
   */
  async submitDraftSocialsForTalent(talentId, { createdById } = {}) {
    if (!talentId) {
      throw new Error('[talentRepository.submitDraftSocialsForTalent] talentId is required.');
    }

    return prisma.$transaction(async (tx) => {
      const drafts = await tx.talentSocial.findMany({
        where: {
          talentId,
          versionStatus: VERSION_STATUS.DRAFT,
          ...(createdById ? { createdById } : {}),
        },
        select: { id: true },
      });
      if (drafts.length === 0) return [];

      const ids = drafts.map((row) => row.id);
      await tx.talentSocial.updateMany({
        where: { id: { in: ids } },
        data: { versionStatus: VERSION_STATUS.PROPOSED },
      });

      return tx.talentSocial.findMany({ where: { id: { in: ids } } });
    });
  },

  /**
   * Flip a TalentVersion to REJECTED with its required rejectionNote
   * (Section 4: "Rejection flips status to rejected with a required
   * rejectionNote; nothing about the published pointer changes"). No
   * parent repoint, no transaction needed — a single-row update. Named
   * distinctly from the pre-existing `rejectTalentVersion` stub above to
   * avoid a collision; used by adapter.rejectVersion.
   */
  async setTalentVersionRejection(versionId, { rejectionNote } = {}) {
    if (!versionId) {
      throw new Error('[talentRepository.setTalentVersionRejection] versionId is required.');
    }
    if (!rejectionNote || !rejectionNote.trim()) {
      throw new Error('[talentRepository.setTalentVersionRejection] rejectionNote is required.');
    }

    return prisma.talentVersion.update({
      where: { id: versionId },
      data: { status: VERSION_STATUS.REJECTED, rejectionNote },
    });
  },

  /**
   * Cancel Editing / Discard Draft sprint — a real row delete, not a status
   * flip. Unlike REJECTED above, there is no "DISCARDED"/"VOID" VERSION_STATUS
   * value (adding one would be a schema migration, out of scope), and
   * reusing REJECTED would wrongly conflate this with the Owner Reject flow
   * (which has its own required rejectionNote and PROPOSED-only precondition
   * — see setTalentVersionRejection above). A DRAFT row is safe to delete
   * outright: nothing else in the schema points to it by FK (a fresh Draft
   * is always based on the current *Published* version, never on another
   * Draft — see proposalService.create's basedOnVersionId usage — and
   * Talent.currentPublishedVersionId only ever points at a PUBLISHED row),
   * and AuditLog.targetVersionId / Event.payload.versionId are plain
   * strings/JSON, not FK-enforced, so they're simply left pointing at a
   * since-deleted id, the same way they already would for any other
   * historical reference. No decision about whether the delete is allowed
   * happens here — that's proposalService.discard()'s job (DRAFT-only
   * guard), same split every other method in this file follows.
   *
   * @param {string} versionId
   */
  async deleteTalentVersion(versionId) {
    if (!versionId) {
      throw new Error('[talentRepository.deleteTalentVersion] versionId is required.');
    }

    return prisma.talentVersion.delete({
      where: { id: versionId },
    });
  },

  // ───────────────────────────────────────────────────────────────────────
  // Owner Approve/Reject (Social Links) sprint — the per-row equivalents of
  // publishTalentVersion/setTalentVersionRejection above, for TalentSocial.
  // TalentSocial has no parent-wide revisionNumber/currentPublishedVersionId
  // to repoint (each row is independently versioned — see schema header
  // comment on TalentSocial), so there is no optimistic-locking conflict
  // check here, only: supersede the specific prior Published row this
  // PROPOSED row was based on (if any), then publish the target row.
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Approve a PROPOSED TalentSocial row: if it was an edit of an existing
   * Published row (`basedOnVersionId` set), that prior row flips to
   * SUPERSEDED; the target row itself flips to PUBLISHED with
   * approvedById/approvedAt. Atomic — mirrors publishTalentVersion's
   * supersede+publish shape, scoped to one row instead of a parent+version
   * pair.
   *
   * @param {string} socialId
   * @param {object} params
   * @param {string} params.approvedById
   * @returns {Promise<object>} the published TalentSocial row
   */
  async approveTalentSocial(socialId, { approvedById } = {}) {
    if (!socialId) {
      throw new Error('[talentRepository.approveTalentSocial] socialId is required.');
    }
    if (!approvedById) {
      throw new Error('[talentRepository.approveTalentSocial] approvedById is required.');
    }

    return prisma.$transaction(async (tx) => {
      const social = await tx.talentSocial.findUnique({ where: { id: socialId } });
      if (!social) {
        throw new Error(
          `[talentRepository.approveTalentSocial] no TalentSocial found for id "${socialId}".`
        );
      }

      if (social.basedOnVersionId) {
        const priorPublished = await tx.talentSocial.findUnique({
          where: { id: social.basedOnVersionId },
        });
        if (priorPublished && priorPublished.versionStatus === VERSION_STATUS.PUBLISHED) {
          await tx.talentSocial.update({
            where: { id: priorPublished.id },
            data: { versionStatus: VERSION_STATUS.SUPERSEDED },
          });
        }
      }

      return tx.talentSocial.update({
        where: { id: socialId },
        data: {
          versionStatus: VERSION_STATUS.PUBLISHED,
          approvedById,
          approvedAt: new Date(),
        },
      });
    });
  },

  /**
   * Flip a TalentSocial row to REJECTED with its required rejectionNote —
   * same shape as setTalentVersionRejection above, for a per-row
   * TalentSocial instead of the single TalentVersion per parent.
   *
   * @param {string} socialId
   * @param {object} params
   * @param {string} params.rejectionNote
   */
  async setTalentSocialRejection(socialId, { rejectionNote } = {}) {
    if (!socialId) {
      throw new Error('[talentRepository.setTalentSocialRejection] socialId is required.');
    }
    if (!rejectionNote || !rejectionNote.trim()) {
      throw new Error('[talentRepository.setTalentSocialRejection] rejectionNote is required.');
    }

    return prisma.talentSocial.update({
      where: { id: socialId },
      data: { versionStatus: VERSION_STATUS.REJECTED, rejectionNote },
    });
  },

  /**
   * REJECTED TalentSocial rows for a talent, so the editor can surface the
   * Owner's rejectionNote next to the account it applies to. Sibling read to
   * getProposedSocialsForTalent above; same shape plus `rejectionNote`.
   *
   * @param {string} talentId
   * @returns {Promise<Array<{ id, platform, label, customLabel, handle, url, sortOrder, versionStatus, basedOnVersionId, rejectionNote, createdAt }>>}
   */
  async getRejectedSocialsForTalent(talentId) {
    if (!talentId) return [];
    return prisma.talentSocial.findMany({
      where: {
        talentId,
        versionStatus: VERSION_STATUS.REJECTED,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        platform: true,
        label: true,
        customLabel: true,
        handle: true,
        url: true,
        sortOrder: true,
        versionStatus: true,
        basedOnVersionId: true,
        rejectionNote: true,
        createdAt: true,
      },
    });
  },

  // ───────────────────────────────────────────────────────────────────────
  // Gallery Sprint 1 — thin primitives for TalentGalleryImage, one-for-one
  // mirroring the Social Links persistence + Owner Approve/Reject
  // primitives directly above (getDraftOrProposedSocialsForTalent ->
  // getDraftOrProposedGalleryImagesForTalent, insertDraftSocial ->
  // insertDraftGalleryImage, etc.). Same Section 13.15 rule: query
  // construction and shape-mapping only, no status-transition decisions —
  // those live in lib/admin/engine/galleryService.js, the Gallery sibling of
  // socialsService.js (see that file's header comment for why a dedicated
  // service exists instead of reusing proposalService: TalentGalleryImage,
  // like TalentSocial, carries its OWN versionStatus/basedOnVersionId per
  // row, not one per parent).
  //
  // Deliberately NOT mirrored: TalentSocial's "insert a row with no backing
  // asset yet" path. Every TalentGalleryImage row's `imageAssetId` is a
  // required FK (schema: `imageAssetId String`, not `String?`) — this
  // sprint only versions metadata (order/alt/position/scale/mobileOrder) for
  // EXISTING ImageAsset rows. Upload/replace is out of scope; see
  // galleryService.js's header comment.
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Draft or Proposed (not yet published, not rejected/superseded), active
   * gallery image rows for a talent — the "Proposed Update" grid's data
   * source once a save has happened. Same shape/ordering as
   * getPublishedGalleryImagesForTalent, plus `versionStatus`/
   * `basedOnVersionId` so the caller can tell a DRAFT row from a PROPOSED
   * one (submit-eligibility) and a cloned-from-published row from a
   * brand-new one. Mirrors getDraftOrProposedSocialsForTalent exactly.
   *
   * @param {string} talentId
   * @returns {Promise<Array<object>>}
   */
  async getDraftOrProposedGalleryImagesForTalent(talentId) {
    if (!talentId) return [];
    return prisma.talentGalleryImage.findMany({
      where: {
        talentId,
        versionStatus: { in: [VERSION_STATUS.DRAFT, VERSION_STATUS.PROPOSED] },
        lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        imageAssetId: true,
        order: true,
        altHe: true,
        altEn: true,
        position: true,
        scale: true,
        mobileOrder: true,
        versionStatus: true,
        basedOnVersionId: true,
        createdAt: true,
        imageAsset: { select: { blobUrl: true } },
      },
    });
  },

  /**
   * Owner Review (Gallery) sprint — every PROPOSED TalentGalleryImage row
   * for a talent, regardless of lifecycleStatus. Mirrors
   * getProposedSocialsForTalent exactly.
   *
   * Gallery Image Removal sprint — updateTalentGalleryImageFields's
   * WRITABLE_COLUMNS now includes lifecycleStatus, so a row returned here
   * CAN be HIDDEN (a submitted removal of a live image, or a withdrawn
   * never-published addition still sitting PROPOSED). This is deliberate:
   * the "regardless of lifecycleStatus" read is what lets
   * gallery-review.js's buildGalleryReviewItems see a hidden row at all —
   * it decides there whether that row is a reviewable REMOVED item
   * (matched to a live published row) or a silently-withdrawn one (no
   * match), not here.
   *
   * @param {string} talentId
   * @returns {Promise<Array<object>>}
   */
  async getProposedGalleryImagesForTalent(talentId) {
    if (!talentId) return [];
    return prisma.talentGalleryImage.findMany({
      where: {
        talentId,
        versionStatus: VERSION_STATUS.PROPOSED,
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        imageAssetId: true,
        order: true,
        altHe: true,
        altEn: true,
        position: true,
        scale: true,
        mobileOrder: true,
        versionStatus: true,
        lifecycleStatus: true,
        basedOnVersionId: true,
        createdAt: true,
        createdBy: { select: { email: true } },
        imageAsset: { select: { blobUrl: true } },
      },
    });
  },

  /** Fetch one TalentGalleryImage row by id, full shape (for ownership/status checks before an edit). */
  async getTalentGalleryImageById(imageId) {
    if (!imageId) return null;
    return prisma.talentGalleryImage.findUnique({
      where: { id: imageId },
      include: { imageAsset: { select: { blobUrl: true } } },
    });
  },

  /**
   * Insert a brand-new TalentGalleryImage row in DRAFT status — either a
   * genuinely new gallery entry for an EXISTING ImageAsset (basedOnVersionId
   * null) or a draft clone of an existing PUBLISHED row being edited for the
   * first time (basedOnVersionId = that published row's id). Mirrors
   * insertDraftSocial's convention exactly. No status/eligibility decision
   * made here — galleryService decides which case applies before calling
   * this.
   *
   * `fields.imageAssetId` is required (not optional like TalentSocial's
   * handle/url) — this sprint never creates a TalentGalleryImage row without
   * an existing backing ImageAsset; there is no upload path to leave it
   * null for.
   *
   * @param {object} params
   * @param {string} params.talentId
   * @param {object} params.fields - { imageAssetId, order, altHe, altEn, position, scale, mobileOrder }
   * @param {string|null} [params.basedOnVersionId]
   * @param {string} params.createdById
   */
  async insertDraftGalleryImage({ talentId, fields, basedOnVersionId, createdById }) {
    if (!talentId) {
      throw new Error('[talentRepository.insertDraftGalleryImage] talentId is required.');
    }
    if (!createdById) {
      throw new Error('[talentRepository.insertDraftGalleryImage] createdById is required.');
    }
    if (!fields || typeof fields !== 'object') {
      throw new Error('[talentRepository.insertDraftGalleryImage] fields must be an object.');
    }
    if (!fields.imageAssetId) {
      throw new Error(
        '[talentRepository.insertDraftGalleryImage] fields.imageAssetId is required — this sprint ' +
          'only versions metadata for existing image assets, never creates a row without one.'
      );
    }

    return prisma.talentGalleryImage.create({
      data: {
        talentId,
        imageAssetId: fields.imageAssetId,
        order: fields.order ?? 0,
        altHe: fields.altHe ?? null,
        altEn: fields.altEn ?? null,
        position: fields.position ?? null,
        scale: fields.scale ?? null,
        mobileOrder: fields.mobileOrder ?? null,
        // Gallery Image Removal sprint — lets a caller seed a clone of a
        // PUBLISHED row directly as HIDDEN (the "remove a live image"
        // draft), while every other caller (plain edits, brand-new
        // uploads, resumeRejected) keeps the implicit ACTIVE default it
        // always had. Never a decision made here — galleryService decides
        // the value, this is still just a pass-through default.
        lifecycleStatus: fields.lifecycleStatus ?? LIFECYCLE_STATUS.ACTIVE,
        versionStatus: VERSION_STATUS.DRAFT,
        basedOnVersionId: basedOnVersionId || null,
        createdById,
      },
      include: { imageAsset: { select: { blobUrl: true } } },
    });
  },

  /**
   * Partial-field update for an existing DRAFT or PROPOSED
   * TalentGalleryImage row in place — same column-clobber protection as
   * updateTalentSocialFields above (allowlist + hasOwnProperty). No status
   * decision here — the caller must already know this row is editable.
   * Deliberately excludes `imageAssetId` from the allowlist: this sprint
   * versions metadata only, never reassigns which asset a row points at
   * (that would be "replace image," explicitly out of scope).
   *
   * Gallery Image Removal sprint — `lifecycleStatus` added to the allowlist.
   * This is what lets galleryService.saveDraft mark an existing DRAFT/
   * PROPOSED row HIDDEN in place (the "this row was never published, so
   * withdrawing it needs no clone and no approval" case — see that
   * function's header comment). Previously excluded on purpose (see
   * gallery-review.js and getProposedGalleryImagesForTalent's now-stale
   * comments, both updated alongside this change) because no caller could
   * ever produce a non-ACTIVE row; that limitation is what this sprint
   * resolves.
   *
   * @param {string} imageId
   * @param {object} fields - partial TalentGalleryImage business fields
   */
  async updateTalentGalleryImageFields(imageId, fields) {
    if (!imageId) {
      throw new Error('[talentRepository.updateTalentGalleryImageFields] imageId is required.');
    }
    if (!fields || typeof fields !== 'object') {
      throw new Error('[talentRepository.updateTalentGalleryImageFields] fields must be an object.');
    }

    const WRITABLE_COLUMNS = ['order', 'altHe', 'altEn', 'position', 'scale', 'mobileOrder', 'lifecycleStatus'];

    const data = {};
    for (const key of WRITABLE_COLUMNS) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) {
        data[key] = fields[key];
      }
    }

    if (Object.keys(data).length === 0) {
      return prisma.talentGalleryImage.findUnique({
        where: { id: imageId },
        include: { imageAsset: { select: { blobUrl: true } } },
      });
    }

    return prisma.talentGalleryImage.update({
      where: { id: imageId },
      data,
      include: { imageAsset: { select: { blobUrl: true } } },
    });
  },

  /**
   * Submit sprint — flip every DRAFT gallery-image row for a talent to
   * PROPOSED in one transaction. Mirrors submitDraftSocialsForTalent
   * exactly, including its idempotency (PROPOSED rows already submitted are
   * left untouched) and — Pre-merge blocker fix sprint (QA finding #4) —
   * the same optional `createdById` scoping (see that method's header
   * comment; note TalentGalleryImage.createdById is nullable for historical
   * rows, so a scoped call also correctly skips author-less legacy drafts).
   *
   * @param {string} talentId
   * @param {object} [opts]
   * @param {string} [opts.createdById] - only flip DRAFT rows created by this user
   * @returns {Promise<object[]>}
   */
  async submitDraftGalleryImagesForTalent(talentId, { createdById } = {}) {
    if (!talentId) {
      throw new Error('[talentRepository.submitDraftGalleryImagesForTalent] talentId is required.');
    }

    return prisma.$transaction(async (tx) => {
      const drafts = await tx.talentGalleryImage.findMany({
        where: {
          talentId,
          versionStatus: VERSION_STATUS.DRAFT,
          ...(createdById ? { createdById } : {}),
        },
        select: { id: true },
      });
      if (drafts.length === 0) return [];

      const ids = drafts.map((row) => row.id);
      await tx.talentGalleryImage.updateMany({
        where: { id: { in: ids } },
        data: { versionStatus: VERSION_STATUS.PROPOSED },
      });

      return tx.talentGalleryImage.findMany({
        where: { id: { in: ids } },
        include: { imageAsset: { select: { blobUrl: true } } },
      });
    });
  },

  /**
   * Approve a PROPOSED TalentGalleryImage row: if it was an edit of an
   * existing Published row (`basedOnVersionId` set), that prior row flips to
   * SUPERSEDED; the target row itself flips to PUBLISHED with
   * approvedById/approvedAt. Atomic — mirrors approveTalentSocial exactly.
   *
   * @param {string} imageId
   * @param {object} params
   * @param {string} params.approvedById
   * @returns {Promise<object>} the published TalentGalleryImage row
   */
  async approveTalentGalleryImage(imageId, { approvedById } = {}) {
    if (!imageId) {
      throw new Error('[talentRepository.approveTalentGalleryImage] imageId is required.');
    }
    if (!approvedById) {
      throw new Error('[talentRepository.approveTalentGalleryImage] approvedById is required.');
    }

    return prisma.$transaction(async (tx) => {
      const image = await tx.talentGalleryImage.findUnique({ where: { id: imageId } });
      if (!image) {
        throw new Error(
          `[talentRepository.approveTalentGalleryImage] no TalentGalleryImage found for id "${imageId}".`
        );
      }

      if (image.basedOnVersionId) {
        const priorPublished = await tx.talentGalleryImage.findUnique({
          where: { id: image.basedOnVersionId },
        });
        if (priorPublished && priorPublished.versionStatus === VERSION_STATUS.PUBLISHED) {
          await tx.talentGalleryImage.update({
            where: { id: priorPublished.id },
            data: { versionStatus: VERSION_STATUS.SUPERSEDED },
          });
        }
      }

      return tx.talentGalleryImage.update({
        where: { id: imageId },
        data: {
          versionStatus: VERSION_STATUS.PUBLISHED,
          approvedById,
          approvedAt: new Date(),
        },
        include: { imageAsset: { select: { blobUrl: true } } },
      });
    });
  },

  /**
   * Flip a TalentGalleryImage row to REJECTED with its required
   * rejectionNote — same shape as setTalentSocialRejection above.
   *
   * @param {string} imageId
   * @param {object} params
   * @param {string} params.rejectionNote
   */
  async setTalentGalleryImageRejection(imageId, { rejectionNote } = {}) {
    if (!imageId) {
      throw new Error('[talentRepository.setTalentGalleryImageRejection] imageId is required.');
    }
    if (!rejectionNote || !rejectionNote.trim()) {
      throw new Error('[talentRepository.setTalentGalleryImageRejection] rejectionNote is required.');
    }

    return prisma.talentGalleryImage.update({
      where: { id: imageId },
      data: { versionStatus: VERSION_STATUS.REJECTED, rejectionNote },
      include: { imageAsset: { select: { blobUrl: true } } },
    });
  },

  /**
   * REJECTED TalentGalleryImage rows for a talent, so the editor can surface
   * the Owner's rejectionNote next to the image it applies to. Mirrors
   * getRejectedSocialsForTalent exactly.
   *
   * @param {string} talentId
   * @returns {Promise<Array<object>>}
   */
  async getRejectedGalleryImagesForTalent(talentId) {
    if (!talentId) return [];
    return prisma.talentGalleryImage.findMany({
      where: {
        talentId,
        versionStatus: VERSION_STATUS.REJECTED,
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        imageAssetId: true,
        order: true,
        altHe: true,
        altEn: true,
        position: true,
        scale: true,
        mobileOrder: true,
        versionStatus: true,
        basedOnVersionId: true,
        rejectionNote: true,
        createdAt: true,
        imageAsset: { select: { blobUrl: true } },
      },
    });
  },
};

export default talentRepository;
