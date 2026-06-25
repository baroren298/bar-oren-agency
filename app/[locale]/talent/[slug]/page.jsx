import { notFound } from 'next/navigation';
import { talentList, getTalentBySlug } from '@/data/talent';
import { siteConfig } from '@/data/site';
import { localizeHref } from '@/lib/i18n';
import ProfileHero from '@/components/talent/ProfileHero';
import ProfileGallery from '@/components/talent/ProfileGallery';
import PodcastSection from '@/components/talent/PodcastSection';
/* ProfileMeta import removed for launch — component kept at
   components/talent/ProfileMeta.jsx for future reuse when
   tag/category filtering is reactivated on the roster page. */
import ProfileCTA from '@/components/talent/ProfileCTA';
import ProfileNav from '@/components/talent/ProfileNav';
import JsonLd from '@/components/ui/JsonLd';

/* Pre-render every talent profile at build time */
export async function generateStaticParams() {
  return talentList.map((t) => ({ slug: t.slug }));
}

/*
 * TODO(404 architecture, QA/hardening pass): unknown talent slugs (and
 * unmatched paths generally) currently render Next.js's built-in default
 * 404 instead of app/[locale]/not-found.jsx. Root cause: there is no
 * root-level app/not-found.js (or app/layout.js) — only app/[locale]/
 * versions exist — and Next's custom-404 pipeline appears to require a
 * root not-found.js to activate at all; a nested one alone isn't
 * sufficient (notFound() in this page already fires correctly, this was
 * verified directly). Fixing this properly means promoting a thin
 * app/layout.jsx to the true root, demoting app/[locale]/layout.jsx to a
 * normal nested layout, and adding a root app/not-found.jsx. Deferred
 * until then — not blocking the current i18n translation work.
 */

/* Per-profile SEO metadata */
export async function generateMetadata({ params }) {
  const { slug, locale } = await params;
  const talent = getTalentBySlug(slug);
  if (!talent) return {};

  const isEnglish = locale === 'en';
  /* English name/bio fall back to the Hebrew field when missing for a
     given talent, so the page never renders blank metadata. */
  const name        = isEnglish ? (talent.nameEn || talent.name) : talent.name;
  const description = isEnglish
    ? (talent.bioEn || talent.bioHe || '')
    : (talent.bioHe || talent.bioEn || '');
  const canonical   = localizeHref(`/talent/${slug}`, locale);

  /* Use profile image when available; fall back to the branded OG image.
   * Profile images are portrait — omit explicit dimensions so crawlers
   * measure the real size. Fallback og-image.jpg is known 1200×630. */
  const ogImage = talent.profileImage
    ? { url: talent.profileImage, alt: name }
    : { url: '/og-image.jpg', width: 1200, height: 630, alt: name };

  return {
    title: name,
    description,
    alternates: { canonical },
    openGraph: {
      type:        'profile',
      title:       `${name} | Bar Oren`,
      description,
      url:          canonical,
      images:      [ogImage],
    },
    twitter: {
      card:        'summary_large_image',
      title:       `${name} | Bar Oren`,
      description,
      images:      [ogImage],
    },
  };
}

/* Person + BreadcrumbList structured data */
function buildProfileSchemas(talent, locale = 'he') {
  const isEnglish = locale === 'en';
  const BASE = siteConfig.meta.url;
  const pageUrl = `${BASE}${localizeHref(`/talent/${talent.slug}`, locale)}`;

  const categoryLabels = siteConfig.categories
    .filter((c) => talent.category.includes(c.key) && c.key !== 'all')
    .map((c) => (isEnglish ? c.labelEn : c.label));

  const personName = isEnglish ? (talent.nameEn || talent.name) : talent.name;

  const person = {
    '@context': 'https://schema.org',
    '@type':    'Person',
    '@id':       pageUrl,
    name:        personName,
    description: isEnglish ? (talent.bioEn || talent.bioHe) : (talent.bioHe || talent.bioEn),
    jobTitle:    categoryLabels.join(', '),
    image:       talent.profileImage ? `${BASE}${talent.profileImage}` : undefined,
    url:         pageUrl,
    worksFor: {
      '@type': 'Organization',
      '@id':   `${BASE}/#organization`,
      name:     siteConfig.agencyName,
      url:      BASE,
    },
    sameAs: [
      talent.instagram,
      talent.tiktok,
      talent.youtube,
    ].filter(Boolean),
  };

  const breadcrumb = {
    '@context':        'https://schema.org',
    '@type':           'BreadcrumbList',
    itemListElement: [
      {
        '@type':  'ListItem',
        position:  1,
        name:      isEnglish ? 'Home' : 'דף הבית',
        item:      `${BASE}${localizeHref('/', locale)}`,
      },
      {
        '@type':  'ListItem',
        position:  2,
        name:      isEnglish ? 'Talent' : 'מיוצגים',
        item:     `${BASE}${localizeHref('/talent', locale)}`,
      },
      {
        '@type':  'ListItem',
        position:  3,
        name:      personName,
        item:      pageUrl,
      },
    ],
  };

  return [person, breadcrumb];
}

export default async function TalentProfilePage({ params }) {
  const { locale, slug } = await params;
  const talent = getTalentBySlug(slug);

  if (!talent) notFound();

  /* Adjacent talent for prev/next navigation */
  const sorted = [...talentList].sort((a, b) => a.sortOrder - b.sortOrder);
  const idx    = sorted.findIndex((t) => t.slug === slug);
  const prev   = idx > 0 ? sorted[idx - 1] : null;
  const next   = idx < sorted.length - 1 ? sorted[idx + 1] : null;

  return (
    <>
      <ProfileHero    talent={talent} locale={locale} />
      <ProfileGallery talent={talent} locale={locale} />
      {/* Podcast section is data-driven: it renders only when talent.podcast
          exists (currently only on Michal Ben David's profile), so it has
          no effect on any other talent page. */}
      <PodcastSection talent={talent} locale={locale} />
      {/* ProfileMeta hidden for launch — tags/categories kept in data/talent
          for future filtering; removed from profile UI until roster filters
          are reactivated. */}
      <ProfileCTA     talent={talent} locale={locale} />
      <ProfileNav     prev={prev} next={next} locale={locale} />
      <JsonLd data={buildProfileSchemas(talent, locale)} />
    </>
  );
}
