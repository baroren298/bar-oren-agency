import { getFeaturedTalent } from '@/data/talent';
import { siteConfig } from '@/data/site';
import HeroSection from '@/components/home/HeroSection';
import FeaturedTalent from '@/components/home/FeaturedTalent';
/* Collaborations hidden for launch — restore by uncommenting the two lines below:
import { collaborations } from '@/data/collaborations';
import Collaborations from '@/components/home/Collaborations'; */
import ContactInvite from '@/components/home/ContactInvite';

const OG_IMAGE = { url: '/og-image.jpg', width: 1200, height: 630, alt: siteConfig.meta.title };

/* Title and OG/Twitter image alt stay the brand name in both locales (per
   translation doc — unchanged). Only the description differs by locale. */
export async function generateMetadata({ params }) {
  const { locale } = await params;
  const description = locale === 'en' ? siteConfig.meta.descriptionEn : siteConfig.meta.description;

  return {
    title:       { absolute: siteConfig.meta.title },
    description,
    alternates:  { canonical: '/' },
    openGraph: {
      title:       siteConfig.meta.title,
      description,
      url:         '/',
      images:      [OG_IMAGE],
    },
    twitter: {
      card:        'summary_large_image',
      title:       siteConfig.meta.title,
      description,
      images:      [{ url: '/og-image.jpg', alt: siteConfig.meta.title }],
    },
  };
}

export default async function HomePage({ params }) {
  const { locale } = await params;
  const featuredTalent = getFeaturedTalent(3);

  return (
    <>
      <HeroSection locale={locale} />
      <FeaturedTalent talent={featuredTalent} locale={locale} />
      {/* <Collaborations brands={collaborations} /> — hidden for launch */}
      <ContactInvite locale={locale} />
    </>
  );
}
