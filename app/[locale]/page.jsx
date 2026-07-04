import { getPublicFeaturedTalent } from '@/lib/public/talent';
import { siteConfig } from '@/data/site';
import { localizeHref } from '@/lib/i18n';
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
  const canonical   = localizeHref('/', locale);

  return {
    title:       { absolute: siteConfig.meta.title },
    description,
    alternates:  { canonical },
    openGraph: {
      title:       siteConfig.meta.title,
      description,
      url:         canonical,
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
  // Talent Visibility — Issue 1 fix: was `getFeaturedTalent(3)` from the
  // static data/talent/index.js (no visibility awareness — see
  // lib/public/talent.js's getPublicFeaturedTalent header comment). Now
  // resolved from the same DB-or-static, visibility-filtered source as the
  // public /talent roster, so a Hidden talent disappears from the homepage
  // too, not just the roster.
  const featuredTalent = await getPublicFeaturedTalent(3);

  return (
    <>
      <HeroSection locale={locale} />
      <FeaturedTalent talent={featuredTalent} locale={locale} />
      {/* <Collaborations brands={collaborations} /> — hidden for launch */}
      <ContactInvite locale={locale} />
    </>
  );
}
