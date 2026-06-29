import { Suspense } from 'react';
import { siteConfig } from '@/data/site';
import { localizeHref } from '@/lib/i18n';
import TalentRoster from '@/components/talent/TalentRoster';
import { getPublicTalentList } from '@/lib/public/talent';
import styles from './talent.module.css';

/*
 * Phase 1 of the CMS connection (read-only): this page now reads talent
 * data through lib/public/talent.js, which prefers Postgres's current
 * PUBLISHED talents and falls back to the static data/talent/index.js
 * list whenever the database isn't configured, has no published talent
 * yet, or a read fails. See that file's header comment for the fallback
 * contract. ISR keeps the page from hitting the database on every request
 * while still picking up new Publishes within TALENT_REVALIDATE_SECONDS.
 *
 * NOTE: Next.js's route segment config exports (revalidate, dynamic, etc.)
 * must be statically analyzable literals — it rejects an exported
 * reference to an imported variable ("Invalid segment configuration
 * export detected") even though the value is a plain number at runtime.
 * So this is hardcoded to match TALENT_REVALIDATE_SECONDS rather than
 * importing it directly; keep the two in sync if that constant changes.
 */
export const revalidate = 60; // keep in sync with TALENT_REVALIDATE_SECONDS in lib/public/talent.js

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const isEnglish   = locale === 'en';
  const title       = isEnglish ? siteConfig.talentPage.titleEn       : siteConfig.talentPage.title;
  const description = isEnglish ? siteConfig.talentPage.descriptionEn : siteConfig.talentPage.description;
  const ogTitle      = isEnglish ? `${siteConfig.talentPage.titleEn} | Bar Oren` : `${siteConfig.talentPage.title} | Bar Oren`;
  const ogAlt         = isEnglish ? `Bar Oren — ${siteConfig.talentPage.titleEn}` : `Bar Oren — ${siteConfig.talentPage.title}`;
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
  // getPublicTalentList() already sorts by sortOrder — see lib/public/talent.js.
  const sorted = await getPublicTalentList();

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
