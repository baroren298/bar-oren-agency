import AboutHero from '@/components/about/AboutHero';
import AboutFounder from '@/components/about/AboutFounder';
import ContactInvite from '@/components/home/ContactInvite';
import { siteConfig } from '@/data/site';
import { localizeHref } from '@/lib/i18n';
import styles from './about.module.css';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const isEnglish = locale === 'en';
  const { about } = siteConfig;
  const title       = isEnglish ? about.metaTitleEn       : about.metaTitle;
  const description = isEnglish ? about.metaDescriptionEn : about.metaDescription;
  const ogTitle      = isEnglish ? about.ogTitleEn         : about.ogTitle;
  const ogAlt         = isEnglish ? about.ogAltEn           : about.ogAlt;
  const canonical     = localizeHref('/about', locale);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title:       ogTitle,
      description,
      url:         canonical,
      images:      [{ url: '/og-image.jpg', width: 1200, height: 630, alt: ogAlt }],
    },
    twitter: {
      card:        'summary_large_image',
      title:       ogTitle,
      description,
      images:      [{ url: '/og-image.jpg', alt: ogAlt }],
    },
  };
}

export default async function AboutPage({ params }) {
  const { locale } = await params;

  return (
    <div className={styles.page}>
      <AboutHero locale={locale} />
      <AboutFounder locale={locale} />
      <ContactInvite locale={locale} />
    </div>
  );
}
