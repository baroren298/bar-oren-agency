/*
 * Public talent data helper — Phase 1 of "connect published CMS content to
 * the public site" (read-only).
 *
 * Goal: the public roster (`app/[locale]/talent/page.jsx`) and public
 * profile (`app/[locale]/talent/[slug]/page.jsx`) pages should read each
 * talent's current PUBLISHED database content when it is available, and
 * fall back to the existing static `data/talent/index.js` file when it
 * isn't — so the public site never breaks if the database is unreachable,
 * unconfigured, or simply doesn't have a given talent published yet.
 *
 * Design notes:
 *   - Read-only. Nothing here ever writes to the database. No admin
 *     publish/approve/reject logic is touched or duplicated.
 *   - "Published" means: Talent.status === ACTIVE, Talent.deletedAt is
 *     null, and Talent.currentPublishedVersionId points at a real
 *     TalentVersion row. `currentPublishedVersionId` is only ever set by
 *     the existing admin publish flow (lib/admin/engine/*Service.js via
 *     talentRepository.publishTalentVersion) — this file never decides
 *     what counts as "published," it only reads the result of that
 *     decision.
 *   - Fallback granularity is "whole list," not "per talent": if the DB
 *     read fails, is not configured, or returns zero published talents,
 *     every consumer of this module falls back to the static
 *     `talentList` in its entirety. We deliberately do NOT mix DB talents
 *     with static talents in the same response — a partial mix would make
 *     prev/next navigation, sort order, and "is this number right" checks
 *     unreliable. This also makes today's safe state (DATABASE_URL unset,
 *     per lib/admin/db.js) behave exactly as before: 100% static data.
 *   - Field shape matches data/talent/index.js's documented FIELD
 *     REFERENCE as closely as the current schema allows. See the
 *     "Known gaps" comment near `mapPublishedTalentToPublicShape` for the
 *     handful of fields that cannot be sourced from the database yet.
 *   - Asset URLs: this reuses the exact pattern already established (but
 *     not yet wired to the public site) in lib/admin/mappers/talentMapper.js
 *     and lib/admin/repository/talentRepository.js — `Asset.blobUrl` is
 *     used directly as an <Image> `src`, with no extra resolution step.
 *     That is the project's one existing convention for turning an Asset
 *     row into a usable URL; nothing here invents a new one.
 *
 * Caching: wrapped in React's `cache()` so a single request (page +
 * generateMetadata, which both need talent data) only hits the database
 * once. The pages themselves additionally set `export const revalidate`
 * for ISR, so production traffic doesn't hit Postgres on every request.
 */

import { cache } from 'react';
import { prisma, isDatabaseConfigured } from '@/lib/admin/db';
import { LIFECYCLE_STATUS, VERSION_STATUS, SOCIAL_PLATFORM, TALENT_VISIBILITY } from '@/lib/admin/constants/enums';
import { talentList as staticTalentList, getTalentBySlug as getStaticTalentBySlug } from '@/data/talent';

/**
 * Suggested ISR revalidate window (seconds) for the two public talent
 * pages. Exported so both page files share one source of truth instead of
 * two hand-copied numbers.
 */
export const TALENT_REVALIDATE_SECONDS = 60;

/**
 * Turn one Talent row (with currentPublishedVersion + socials + gallery
 * already included) into the exact object shape data/talent/index.js's
 * `talentList` entries use, so every existing public component
 * (TalentRoster, TalentCard, ProfileHero, ProfileGallery, PodcastSection,
 * ProfileCTA, ProfileNav, JsonLd builder, generateMetadata) can consume it
 * with zero changes.
 *
 * Known gaps vs. the static file (documented, not silently dropped):
 *   - `extraSocials` (e.g. a second "Spam" Instagram account) has no
 *     schema column today — always omitted for DB-sourced talent.
 *   - `followers` only covers the first PUBLISHED+ACTIVE social row per
 *     platform; the static file's `followers` is a flat per-platform
 *     number, which matches today's single-account-per-platform talents
 *     but would under-represent a talent with multiple published
 *     accounts on the same platform.
 *   - `birthDate` is normalized to a 'YYYY-MM-DD' string (matching the
 *     static file) from Postgres's DateTime so `getAge()` keeps behaving
 *     identically either way.
 */
function mapPublishedTalentToPublicShape(talent) {
  const version = talent.currentPublishedVersion;
  if (!version) return null;

  const socials = talent.socials || [];
  const galleryImages = talent.galleryImages || [];

  const findSocial = (platform) => socials.find((s) => s.platform === platform) || null;
  const instagramSocial = findSocial(SOCIAL_PLATFORM.INSTAGRAM);
  const tiktokSocial = findSocial(SOCIAL_PLATFORM.TIKTOK);
  const youtubeSocial = findSocial(SOCIAL_PLATFORM.YOUTUBE);

  const gallery = [...galleryImages]
    .sort((a, b) => a.order - b.order)
    .map((g) => {
      const src = g.imageAsset?.blobUrl ?? null;
      const hasOverride = Boolean(g.position) || Boolean(g.scale);
      if (!hasOverride) return src;
      return {
        src,
        ...(g.position ? { position: g.position } : {}),
        ...(g.scale ? { scale: g.scale } : {}),
      };
    });

  const galleryMobileOrder = galleryImages.some((g) => g.mobileOrder != null)
    ? [...galleryImages].sort((a, b) => a.order - b.order).map((g) => g.mobileOrder ?? null)
    : undefined;

  const birthDate = version.birthDate
    ? new Date(version.birthDate).toISOString().slice(0, 10)
    : null;

  const podcast = version.podcastTitle
    ? {
        title: version.podcastTitle,
        description: version.podcastDescriptionHe ?? null,
        descriptionEn: version.podcastDescriptionEn ?? null,
        image: version.podcastImageAsset?.blobUrl ?? null,
        videoEmbedUrl: version.podcastVideoEmbedUrl ?? null,
      }
    : undefined;

  return {
    id: talent.id,
    slug: talent.slug,

    name: version.name,
    nameEn: version.nameEn ?? null,

    category: version.category ?? [],
    tags: version.tags ?? [],

    featured: version.featured ?? false,
    featuredOrder: version.featuredOrder ?? null,
    sortOrder: version.sortOrder ?? null,

    location: version.location ?? null,
    locationEn: version.locationEn ?? null,
    birthDate,

    profileImage: version.profileImageAsset?.blobUrl ?? null,
    imagePosition: version.profileImagePosition ?? undefined,

    gallery,
    ...(galleryMobileOrder ? { galleryMobileOrder } : {}),

    bioHe: version.bioHe ?? null,
    bioEn: version.bioEn ?? null,

    instagram: instagramSocial?.url ?? null,
    tiktok: tiktokSocial?.url ?? null,
    youtube: youtubeSocial?.url ?? null,

    followers: {
      instagram: instagramSocial?.followerCount ?? null,
      tiktok: tiktokSocial?.followerCount ?? null,
      youtube: youtubeSocial?.followerCount ?? null,
    },

    // Talent SEO + Slug Management sprint — the PUBLISHED version's SEO
    // fields, exposed so generateMetadata (via lib/public/seo.js) can apply
    // them with smart-default fallbacks. Only the *published* version is
    // ever read here, so nothing an employee drafts/proposes can affect the
    // public site before Publish. Static-file talents simply have no `seo`
    // key — buildTalentSeoMetadata treats that identically to "every field
    // empty" and falls back to the same defaults as before this sprint.
    seo: {
      title: version.seoTitle ?? null,
      description: version.seoDescription ?? null,
      canonicalUrl: version.seoCanonicalUrl ?? null,
      ogTitle: version.seoOgTitle ?? null,
      ogDescription: version.seoOgDescription ?? null,
      ogImageUrl: version.seoOgImageUrl ?? null,
      noindex: version.seoNoindex ?? false,
    },

    ...(podcast ? { podcast } : {}),
  };
}

/**
 * Fetch every ACTIVE, non-deleted, currently-PUBLISHED, and
 * publicly-VISIBLE talent from Postgres, mapped to the public shape.
 *
 * Talent Visibility Phase 2: visibility is a field on the *version*
 * (`currentPublishedVersion.visibility`), not on `Talent` itself — see
 * prisma/schema.prisma's `TalentVisibility` header comment. It is
 * deliberately unrelated to `Talent.status` (LifecycleStatus), which this
 * query already filters on separately. The Prisma `where` below uses a
 * to-one relation filter (`currentPublishedVersion: { is: { visibility: ... } }`)
 * — not the to-many `some`/`none` syntax used for `socials`/`galleryImages`
 * elsewhere in this query, since `currentPublishedVersion` is a single
 * required-at-query-time relation, not a list.
 *
 * Returns `{ status, talents }` instead of a bare array/null so callers can
 * tell apart three distinct cases that all used to collapse into one
 * "fall back to static" decision:
 *   - status: 'unconfigured' — no DATABASE_URL; talents: null.
 *   - status: 'error'        — DB reachable check failed/threw; talents: null.
 *   - status: 'ok'           — DB read succeeded; talents: object[] (which
 *                              may legitimately be an empty array, e.g.
 *                              every published talent is currently HIDDEN).
 * Only 'unconfigured' and 'error' should fall back to static data — see
 * `resolveTalentSource()` below for why 'ok' + empty must NOT fall back.
 *
 * Wrapped in React's `cache()` so repeated calls within one request/render
 * (roster page, detail page, generateMetadata) reuse the same query.
 */
const fetchPublishedTalents = cache(async function fetchPublishedTalents() {
  if (!isDatabaseConfigured) return { status: 'unconfigured', talents: null };

  try {
    const talents = await prisma.talent.findMany({
      where: {
        status: LIFECYCLE_STATUS.ACTIVE,
        deletedAt: null,
        currentPublishedVersionId: { not: null },
        // Talent Publishing Status sprint (Phase 2) — only talents whose
        // PUBLISHED version is publicly VISIBLE may reach the public site.
        // This is a to-one relation filter (currentPublishedVersion is a
        // single relation, not a list), so it takes a plain field object
        // (or the equivalent `is: {...}`), unlike the to-many `where`
        // clauses inside `include` for `socials`/`galleryImages` below.
        currentPublishedVersion: {
          is: { visibility: TALENT_VISIBILITY.VISIBLE },
        },
      },
      include: {
        currentPublishedVersion: {
          include: {
            profileImageAsset: { select: { blobUrl: true } },
            podcastImageAsset: { select: { blobUrl: true } },
          },
        },
        socials: {
          where: {
            versionStatus: VERSION_STATUS.PUBLISHED,
            lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
          },
        },
        galleryImages: {
          where: {
            versionStatus: VERSION_STATUS.PUBLISHED,
            lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
          },
          orderBy: { order: 'asc' },
          include: { imageAsset: { select: { blobUrl: true } } },
        },
      },
    });

    return {
      status: 'ok',
      talents: talents.map(mapPublishedTalentToPublicShape).filter((t) => t !== null),
    };
  } catch (error) {
    // Read-only safety net: any DB error (unreachable, schema drift,
    // connection pool exhaustion, etc.) falls back to static data rather
    // than breaking the public site. Logged so the failure is visible in
    // server logs without surfacing to visitors.
    console.error('[lib/public/talent] failed to read published talent data, falling back to static data/talent/index.js:', error);
    return { status: 'error', talents: null };
  }
});

/**
 * Resolves which talent list the public site should render.
 *
 * Talent Visibility Phase 2 change: this used to fall back to static data
 * any time the DB query returned zero talents, for any reason. That is
 * still correct when the DB is unconfigured or the read failed (status
 * 'unconfigured'/'error') — the public site must keep working exactly as
 * before in those cases. But once the DB is reachable and the query ran
 * (status 'ok'), the DB is the authoritative source even if it returns
 * zero talents — e.g. every published talent's version is currently
 * HIDDEN. Falling back to the static roster in that case would silently
 * resurrect every static-file talent on a site that has explicitly hidden
 * all of its DB talent, which is the opposite of what visibility is for.
 *
 * Every exported function below is built on top of this single decision
 * so the roster, detail page, and sitemap never disagree about which
 * source is "live" for a given request.
 *
 * @returns {Promise<{ source: 'db' | 'static', talents: object[] }>}
 */
const resolveTalentSource = cache(async function resolveTalentSource() {
  const { status, talents } = await fetchPublishedTalents();
  if (status === 'unconfigured' || status === 'error') {
    return { source: 'static', talents: staticTalentList };
  }
  // status === 'ok': DB is authoritative, even if `talents` is `[]`
  // (e.g. all published talents are currently HIDDEN).
  return { source: 'db', talents };
});

/**
 * Deterministic ordering for the public Talent list — Talent Published
 * Sort Order sprint. `sortOrder` ascending; null sorts LAST (matches the
 * admin list's own NULLS LAST, and the publish-time "null = end of list"
 * contract in lib/admin/published-order.js); any tie — including a
 * still-duplicate value, before the roster is normalized — is broken by
 * slug ascending, so the result never depends on the order Prisma/Postgres
 * happened to return rows in (fetchPublishedTalents issues its query with
 * no `orderBy`; that used to leave ties to non-deterministic row order).
 *
 * Deliberately NOT used by getPublicFeaturedTalent below — featured
 * ordering keeps its own `featuredOrder ?? sortOrder` behavior unchanged.
 *
 * Exported for direct unit testing (see talent.orderComparator.test.js).
 */
export function comparePublicTalentOrder(a, b) {
  const aOrder = a.sortOrder;
  const bOrder = b.sortOrder;

  if (aOrder == null && bOrder == null) {
    return String(a.slug).localeCompare(String(b.slug));
  }
  if (aOrder == null) return 1;
  if (bOrder == null) return -1;
  if (aOrder !== bOrder) return aOrder - bOrder;

  return String(a.slug).localeCompare(String(b.slug));
}

/**
 * Full talent list for the public site, sorted with `comparePublicTalentOrder`
 * above. Mirrors `data/talent/index.js`'s exported `talentList`, just
 * resolved from DB-or-static.
 *
 * @returns {Promise<object[]>}
 */
export async function getPublicTalentList() {
  const { talents } = await resolveTalentSource();
  return [...talents].sort(comparePublicTalentOrder);
}

/**
 * One talent by slug, resolved from the same DB-or-static source as
 * `getPublicTalentList()` (never mixed). Falls back to the static file's
 * own `getTalentBySlug` only when the static file is the active source —
 * if the DB is active but a specific slug isn't in it, this returns null
 * (the talent isn't published), matching `notFound()` behavior the detail
 * page already expects.
 *
 * @param {string} slug
 * @returns {Promise<object|null>}
 */
export async function getPublicTalentBySlug(slug) {
  if (!slug) return null;
  const { source, talents } = await resolveTalentSource();
  if (source === 'static') {
    return getStaticTalentBySlug(slug);
  }
  return talents.find((t) => t.slug === slug) ?? null;
}

/**
 * Every talent slug from the active source — for
 * `generateStaticParams()` in the detail page.
 *
 * @returns {Promise<string[]>}
 */
export async function getPublicTalentSlugs() {
  const { talents } = await resolveTalentSource();
  return talents.map((t) => t.slug);
}

/**
 * Which source is currently backing the public site ('db' or 'static') —
 * exposed only for diagnostics/logging, not for branching presentation
 * logic in components.
 *
 * @returns {Promise<'db' | 'static'>}
 */
export async function getPublicTalentSource() {
  const { source } = await resolveTalentSource();
  return source;
}

/**
 * Featured talent for the homepage, resolved from the same DB-or-static
 * source as `getPublicTalentList()` (never mixed, same `resolveTalentSource`
 * call everything else here is built on).
 *
 * Talent Visibility — Issue 1 fix: the homepage previously imported
 * `getFeaturedTalent` directly from `data/talent/index.js`, which has no
 * `visibility` field and is never filtered — so a talent hidden via the
 * admin Hide action kept appearing on the homepage even after it correctly
 * disappeared from `/talent`. This function closes that gap by applying the
 * exact same "featured" selection `data/talent/index.js`'s own
 * `getFeaturedTalent()` uses (`featured: true`, sorted by
 * `featuredOrder ?? sortOrder`, limited), but over whichever list
 * `resolveTalentSource()` says is authoritative right now — the
 * visibility-filtered DB list when the DB is configured and reachable, or
 * the static list (unfiltered, as today) only in the same
 * unconfigured/error fallback cases `getPublicTalentList()` already falls
 * back in. No new fallback rule is introduced.
 *
 * @param {number} [limit=3]
 * @returns {Promise<object[]>}
 */
export async function getPublicFeaturedTalent(limit = 3) {
  const { talents } = await resolveTalentSource();
  return [...talents]
    .filter((t) => t.featured)
    .sort((a, b) => (a.featuredOrder ?? a.sortOrder ?? 0) - (b.featuredOrder ?? b.sortOrder ?? 0))
    .slice(0, limit);
}
