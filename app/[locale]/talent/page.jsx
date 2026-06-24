import { Suspense } from 'react';
import { talentList } from '@/data/talent';
import { siteConfig } from '@/data/site';
import { localizeHref } from '@/lib/i18n';
import TalentRoster from '@/components/talent/TalentRoster';
import styles from './talent.module.css';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const isEnglish   = locale === 'en';
  const title       = isEnglish ? siteConfig.talentPage.titleEn       : siteConfig.talentPage.title;
  const description = isEnglish ? siteConfig.talentPage.descriptionEn : siteConfig.talentPage.description;
  const ogTitle      = isEnglish ? `${siteConfig.talentPage.titleEn} | Bar Oren` : `${siteConfig.talentPage.title} | Bar Oren`;
  const ogAlt         = isEnglish ? 'Bar Oren — Our Talent' : 'Bar Oren — מיוצגי הסוכנות';
  const canonical     = localizeHref('/talent', locale);

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

export default async function TalentPage({ params }) {
  const { locale } = await params;
  const isEnglish = locale === 'en';
  const sorted = [...talentList].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className={styles.page}>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <div className="container">
          <h1 className={styles.pageTitle}>
            {isEnglish ? siteConfig.talentPage.titleEn : siteConfig.talentPage.title}
          </h1>
        </div>
      </div>

      {/* Suspense required for useSearchParams inside TalentRoster */}
      <Suspense>
        <TalentRoster talent={sorted} mode="page" locale={locale} />
      </Suspense>
    </div>
  );
}
