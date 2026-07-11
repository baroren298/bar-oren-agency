/*
 * Public talent SEO metadata — Talent SEO + Slug Management sprint.
 *
 * The one place that decides what a talent profile page's <head> metadata
 * looks like, extracted from app/[locale]/talent/[slug]/page.jsx's
 * generateMetadata into a pure function so the smart-default rules are
 * unit-testable without Next's runtime.
 *
 * Smart defaults (sprint requirement — every empty SEO field falls back so
 * a page always has good SEO even with zero manual customization):
 *   - SEO title        → talent name (locale-aware, same as before)
 *   - meta description → talent bio (locale-aware, same as before)
 *   - canonical        → the current public talent URL (same as before)
 *   - OG title         → "<name> | Bar Oren" (same as before)
 *   - OG description   → meta description
 *   - OG image         → profile image, then the branded /og-image.jpg
 *   - noindex          → only when explicitly published as noindex
 *
 * A talent with no `seo` object at all (static data/talent/index.js
 * entries, or DB rows published before the migration) produces byte-for-
 * byte the same metadata this page generated before this sprint — public
 * behavior only changes once a version carrying SEO values is PUBLISHED.
 *
 * Pure: no I/O, no Next imports. The caller supplies the already-localized
 * canonical path (localizeHref stays in the page, where locale routing
 * belongs).
 */

/**
 * @param {object} params
 * @param {object} params.talent - public-shape talent (lib/public/talent.js)
 * @param {string} params.locale - 'he' | 'en'
 * @param {string} params.canonicalPath - already-localized default canonical
 *   path for this page (e.g. '/talent/noa-kirel' or '/en/talent/noa-kirel')
 * @returns {object} Next.js Metadata object
 */
export function buildTalentSeoMetadata({ talent, locale, canonicalPath }) {
  if (!talent) return {};

  const seo = talent.seo || {};
  const isEnglish = locale === 'en';

  const name = isEnglish ? talent.nameEn || talent.name : talent.name;
  const bioDescription = isEnglish
    ? talent.bioEn || talent.bioHe || ''
    : talent.bioHe || talent.bioEn || '';

  const title = seo.title?.trim() || name;
  const description = seo.description?.trim() || bioDescription;
  const canonical = seo.canonicalUrl?.trim() || canonicalPath;
  const ogTitle = seo.ogTitle?.trim() || `${name} | Bar Oren`;
  const ogDescription = seo.ogDescription?.trim() || description;

  /* OG image chain: explicit published OG image URL → profile image →
   * branded fallback. Profile images are portrait — omit explicit
   * dimensions so crawlers measure the real size; the branded fallback is
   * known 1200×630 (both behaviors unchanged from before this sprint). */
  const customOgImage = seo.ogImageUrl?.trim() || null;
  const ogImage = customOgImage
    ? { url: customOgImage, alt: ogTitle }
    : talent.profileImage
      ? { url: talent.profileImage, alt: name }
      : { url: '/og-image.jpg', width: 1200, height: 630, alt: name };

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'profile',
      title: ogTitle,
      description: ogDescription,
      url: canonical,
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDescription,
      images: [ogImage],
    },
    ...(seo.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

export default buildTalentSeoMetadata;
