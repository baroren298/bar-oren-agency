import { getFeaturedTalent } from '@/data/talent';
import { siteConfig } from '@/data/site';
import HeroSection from '@/components/home/HeroSection';
import FeaturedTalent from '@/components/home/FeaturedTalent';
/* Collaborations hidden for launch — restore by uncommenting the two lines below:
import { collaborations } from '@/data/collaborations';
import Collaborations from '@/components/home/Collaborations'; */
import ContactInvite from '@/components/home/ContactInvite';

const OG_IMAGE = { url: '/og-image.jpg', width: 1200, height: 630, alt: siteConfig.meta.title };

export const metadata = {
  title:       { absolute: siteConfig.meta.title },
  description:  siteConfig.meta.description,
  alternates:  { canonical: '/' },
  openGraph: {
    title:       siteConfig.meta.title,
    description:  siteConfig.meta.description,
    url:         '/',
    images:      [OG_IMAGE],
  },
  twitter: {
    card:        'summary_large_image',
    title:       siteConfig.meta.title,
    description:  siteConfig.meta.description,
    images:      [{ url: '/og-image.jpg', alt: siteConfig.meta.title }],
  },
};

export default function HomePage() {
  const featuredTalent = getFeaturedTalent(3);

  return (
    <>
      <HeroSection />
      <FeaturedTalent talent={featuredTalent} />
      {/* <Collaborations brands={collaborations} /> — hidden for launch */}
      <ContactInvite />
    </>
  );
}
