import { getFeaturedTalent } from '@/data/talent';
import { collaborations } from '@/data/collaborations';
import HeroSection from '@/components/home/HeroSection';
import FeaturedTalent from '@/components/home/FeaturedTalent';
import Collaborations from '@/components/home/Collaborations';
import ContactInvite from '@/components/home/ContactInvite';

export const metadata = {
  title: 'Bar Oren Talent Agency',
  description: 'ניהול אישי ומקצועי ליוצרי תוכן, משפיענים, דוגמנים ושחקנים. סוכנות ייצוג בוטיק.',
  alternates: { canonical: '/' },
  openGraph: {
    title:       'Bar Oren Talent Agency',
    description: 'ניהול אישי ומקצועי ליוצרי תוכן, משפיענים, דוגמנים ושחקנים.',
    url:         '/',
    images:      [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Bar Oren Talent Agency' }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'Bar Oren Talent Agency',
    description: 'ניהול אישי ומקצועי ליוצרי תוכן, משפיענים, דוגמנים ושחקנים.',
    images:      ['/og-image.jpg'],
  },
};

export default function HomePage() {
  const featuredTalent = getFeaturedTalent(3);

  return (
    <>
      <HeroSection />
      <FeaturedTalent talent={featuredTalent} />
      <Collaborations brands={collaborations} />
      <ContactInvite />
    </>
  );
}
