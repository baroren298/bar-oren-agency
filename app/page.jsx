import { getFeaturedTalent } from '@/data/talent';
import HeroSection from '@/components/home/HeroSection';
import FeaturedTalent from '@/components/home/FeaturedTalent';
/* Collaborations hidden for launch — restore by uncommenting the two lines below:
import { collaborations } from '@/data/collaborations';
import Collaborations from '@/components/home/Collaborations'; */
import ContactInvite from '@/components/home/ContactInvite';

const DESCRIPTION = 'ניהול אישי ומקצועי ליוצרי תוכן, משפיענים, דוגמנים ושחקנים. סוכנות ייצוג בוטיק.';
const OG_IMAGE    = { url: '/og-image.jpg', width: 1200, height: 630, alt: 'Bar Oren Talent Agency' };

export const metadata = {
  title:       { absolute: 'Bar Oren Talent Agency' },
  description:  DESCRIPTION,
  alternates:  { canonical: '/' },
  openGraph: {
    title:       'Bar Oren Talent Agency',
    description:  DESCRIPTION,
    url:         '/',
    images:      [OG_IMAGE],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'Bar Oren Talent Agency',
    description:  DESCRIPTION,
    images:      [{ url: '/og-image.jpg', alt: 'Bar Oren Talent Agency' }],
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
