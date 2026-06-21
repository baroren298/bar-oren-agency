import { notFound } from 'next/navigation';
import { talentList, getTalentBySlug } from '@/data/talent';
import { siteConfig } from '@/data/site';
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

/* Per-profile SEO metadata */
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const talent = getTalentBySlug(slug);
  if (!talent) return {};

  const title       = talent.name;
  const description = talent.bioHe || talent.bioEn || '';
  const canonical   = `/talent/${slug}`;

  /* Use profile image when available; fall back to the branded OG image.
   * Profile images are portrait — omit explicit dimensions so crawlers
   * measure the real size. Fallback og-image.jpg is known 1200×630. */
  const ogImage = talent.profileImage
    ? { url: talent.profileImage, alt: talent.name }
    : { url: '/og-image.jpg', width: 1200, height: 630, alt: talent.name };

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type:        'profile',
      title:       `${talent.name} | Bar Oren`,
      description,
      url:          canonical,
      images:      [ogImage],
    },
    twitter: {
      card:        'summary_large_image',
      title:       `${talent.name} | Bar Oren`,
      description,
      images:      [ogImage],
    },
  };
}

/* Person + BreadcrumbList structured data */
function buildProfileSchemas(talent) {
  const BASE = siteConfig.meta.url;
  const pageUrl = `${BASE}/talent/${talent.slug}`;

  const categoryLabels = siteConfig.categories
    .filter((c) => talent.category.includes(c.key) && c.key !== 'all')
    .map((c) => c.labelEn);

  const person = {
    '@context': 'https://schema.org',
    '@type':    'Person',
    '@id':       pageUrl,
    name:        talent.nameEn,
    description: talent.bioEn || talent.bioHe,
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
        name:     'דף הבית',
        item:      BASE,
      },
      {
        '@type':  'ListItem',
        position:  2,
        name:     'מיוצגים',
        item:     `${BASE}/talent`,
      },
      {
        '@type':  'ListItem',
        position:  3,
        name:      talent.name,
        item:      pageUrl,
      },
    ],
  };

  return [person, breadcrumb];
}

export default async function TalentProfilePage({ params }) {
  const { slug } = await params;
  const talent = getTalentBySlug(slug);

  if (!talent) notFound();

  /* Adjacent talent for prev/next navigation */
  const sorted = [...talentList].sort((a, b) => a.sortOrder - b.sortOrder);
  const idx    = sorted.findIndex((t) => t.slug === slug);
  const prev   = idx > 0 ? sorted[idx - 1] : null;
  const next   = idx < sorted.length - 1 ? sorted[idx + 1] : null;

  return (
    <>
      <ProfileHero    talent={talent} />
      <ProfileGallery talent={talent} />
      {/* Podcast section is data-driven: it renders only when talent.podcast
          exists (currently only on Michal Ben David's profile), so it has
          no effect on any other talent page. */}
      <PodcastSection talent={talent} />
      {/* ProfileMeta hidden for launch — tags/categories kept in data/talent
          for future filtering; removed from profile UI until roster filters
          are reactivated. */}
      <ProfileCTA     talent={talent} />
      <ProfileNav     prev={prev} next={next} />
      <JsonLd data={buildProfileSchemas(talent)} />
    </>
  );
}
