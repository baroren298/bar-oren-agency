/*
 * Talent mapper — Admin Panel Architecture v1.2, Section 7 (Live Preview)
 * and Section 1 ("keep the JSON shape returned by repositories
 * byte-compatible with the existing data/*.js object shapes").
 *
 * `mapTalentVersionToPublicShape` turns a normalized
 * TalentVersion + TalentSocial[] + TalentGalleryImage[] (the database
 * shape, per prisma/schema.prisma) into the exact object shape the public
 * site's components already expect — the same shape as one entry in
 * data/talent/index.js's `talentList` array.
 *
 * PHASE 1 NOTE: this function is not called anywhere yet. It is not
 * imported by any route, page, or component, and the public site
 * continues to import talent data from data/talent/index.js directly.
 * This mapper exists now so that when Live Preview (Phase 8) and the
 * Migration Day import script (Phase 10) need it, the shape has already
 * been designed and is not being retrofitted under deadline pressure.
 *
 * Field-for-field correspondence with data/talent/index.js (see that
 * file's "FIELD REFERENCE" comment block):
 *   id, slug, name, nameEn, category, tags, featured, featuredOrder,
 *   sortOrder, location, locationEn, birthDate, profileImage, gallery,
 *   bioHe, bioEn, instagram, tiktok, youtube, followers.
 */

/**
 * @param {object} talentVersion - a TalentVersion row (published or proposed)
 * @param {object} [related]
 * @param {object[]} [related.socials] - TalentSocial rows for this talent
 * @param {object[]} [related.galleryImages] - TalentGalleryImage rows (each
 *   with its `imageAsset` relation already included) for this talent
 * @param {string} [related.talentId] - the parent Talent.id
 * @param {string} [related.slug] - the parent Talent.slug (stable across versions)
 * @returns {object} an object shaped exactly like a data/talent/index.js entry
 */
export function mapTalentVersionToPublicShape(talentVersion, related = {}) {
  if (!talentVersion) return null;

  const { socials = [], galleryImages = [], talentId, slug } = related;

  const findSocialUrl = (platform) =>
    socials.find((s) => s.platform === platform)?.publishedUrl ?? null;

  const findFollowerCount = (platform) =>
    socials.find((s) => s.platform === platform)?.followerCount ?? null;

  const gallery = [...galleryImages]
    .sort((a, b) => a.order - b.order)
    .map((g) => {
      const src = g.imageAsset?.blobUrl ?? null;
      // Matches data/talent/index.js's pattern of either a plain string
      // src, or an { src, position, scale } object when an override is
      // present — only emit the object form when there's actually an
      // override, to stay byte-compatible with existing entries that use
      // plain strings for images with no crop adjustment.
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

  return {
    id: talentId ?? talentVersion.talentId,
    slug: slug ?? null,

    name: talentVersion.name,
    nameEn: talentVersion.nameEn ?? null,

    category: talentVersion.category ?? [],
    tags: talentVersion.tags ?? [],

    featured: talentVersion.featured ?? false,
    featuredOrder: talentVersion.featuredOrder ?? null,
    sortOrder: talentVersion.sortOrder ?? null,

    location: talentVersion.location ?? null,
    locationEn: talentVersion.locationEn ?? null,
    birthDate: talentVersion.birthDate ?? null,

    profileImage: talentVersion.profileImageAsset?.blobUrl ?? null,
    imagePosition: talentVersion.profileImagePosition ?? undefined,

    gallery,
    ...(galleryMobileOrder ? { galleryMobileOrder } : {}),

    bioHe: talentVersion.bioHe ?? null,
    bioEn: talentVersion.bioEn ?? null,

    instagram: findSocialUrl('INSTAGRAM'),
    tiktok: findSocialUrl('TIKTOK'),
    youtube: findSocialUrl('YOUTUBE'),

    followers: {
      instagram: findFollowerCount('INSTAGRAM'),
      tiktok: findFollowerCount('TIKTOK'),
      youtube: findFollowerCount('YOUTUBE'),
    },
  };
}

export default mapTalentVersionToPublicShape;
