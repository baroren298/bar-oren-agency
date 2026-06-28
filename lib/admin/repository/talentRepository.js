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
  REVISION_CONFLICT_ERROR_CODE,
} from '../constants/enums';

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
      const mainSocial =
        talent.socials.find((social) => social.label === 'MAIN') || talent.socials[0] || null;

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
      // Deliberately NOT including podcastImageAssetId here yet — there is
      // no safe existing image picker/upload flow for podcast images to
      // route that through (the "החלף תמונה" control stays a disabled
      // placeholder), and adding one is out of this sprint's scope.
      'podcastTitle',
      'podcastDescriptionHe',
      'podcastDescriptionEn',
      'podcastVideoEmbedUrl',
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
   * @param {string} talentId
   * @returns {Promise<Array<{ id, platform, label, customLabel, handle, url, sortOrder }>>}
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
};

export default talentRepository;
