import AboutHero from '@/components/about/AboutHero';
import AboutFounder from '@/components/about/AboutFounder';
import ContactInvite from '@/components/home/ContactInvite';
import styles from './about.module.css';

const DESCRIPTION = 'בר אורן טאלנט אייג׳נסי — סוכנות ייצוג בוטיק לניהול אישי ומקצועי של מיוצגים. הכירו את בר אורן והגישה האישית שמובילה את הסוכנות.';

export const metadata = {
  title:       'אודות',
  description:  DESCRIPTION,
  alternates:  { canonical: '/about' },
  openGraph: {
    title:       'אודות | Bar Oren',
    description:  DESCRIPTION,
    url:         '/about',
    images:      [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Bar Oren Talent Agency — אודות' }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'אודות | Bar Oren',
    description:  DESCRIPTION,
    images:      [{ url: '/og-image.jpg', alt: 'Bar Oren Talent Agency — אודות' }],
  },
};

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <AboutHero />
      <AboutFounder />
      <ContactInvite />
    </div>
  );
}
