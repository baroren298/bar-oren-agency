import { notFound } from 'next/navigation';
import { talentList, getTalentBySlug } from '@/data/talent';
import { siteConfig } from '@/data/site';
import ProfileHero from '@/components/talent/ProfileHero';
import ProfileBio from '@/components/talent/ProfileBio';
import ProfileGallery from '@/components/talent/ProfileGallery';
import ProfileMeta from '@/components/talent/ProfileMeta';
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
  const ogImage     = talent.profileImage || '/og-image.jpg';
  const canonical   = `/talent/${slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type:        'profile',
      title:       `${talent.name} | Bar Oren`,
      description,
      url:          canonical,
      images: [
        {
          url:    ogImage,
          width:  1200,
          height: 800,
          alt:    talent.name,
        },
      ],
    },
    twitter: {
      card:        'summary_large_image',
      title:       `${talent.name} | Bar Oren`,
      description,
      images:      [ogImage],
    },
  };
}

/* Person structured data */
function buildPersonSchema(talent) {
  const categoryLabels = siteConfig.categories
    .filter((c) => talent.category.includes(c.key) && c.key !== 'all')
    .map((c) => c.labelEn);

  return {
    '@context': 'https://schema.org',
    '@type':    'Person',
    name:        talent.nameEn,
    description: talent.bioEn || talent.bioHe,
    jobTitle:    categoryLabels.join(', '),
    image:       talent.profileImage || undefined,
    url:        `${siteConfig.meta.url}/talent/${talent.slug}`,
    worksFor: {
      '@type': 'Organization',
      name:     siteConfig.agencyName,
      url:      siteConfig.meta.url,
    },
    sameAs: [
      talent.instagram,
      talent.tiktok,
      talent.youtube,
    ].filter(Boolean),
  };
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
      <ProfileBio     talent={talent} />
      <ProfileGallery talent={talent} />
      <ProfileMeta    talent={talent} />
      <ProfileCTA     talent={talent} />
      <ProfileNav     prev={prev} next={next} />
      <JsonLd data={buildPersonSchema(talent)} />
    </>
  );
}
