import { Suspense } from 'react';
import { talentList } from '@/data/talent';
import TalentRoster from '@/components/talent/TalentRoster';
import styles from './talent.module.css';

const DESCRIPTION = 'מיוצגים בניהולו האישי של בר אורן — יוצרי תוכן, משפיענים, דוגמנים ושחקנים.';

export const metadata = {
  title:       'המיוצגים',
  description:  DESCRIPTION,
  alternates:  { canonical: '/talent' },
  openGraph: {
    title:       'המיוצגים | Bar Oren',
    description:  DESCRIPTION,
    url:         '/talent',
    images:      [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Bar Oren — המיוצגים' }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'המיוצגים | Bar Oren',
    description:  DESCRIPTION,
    images:      [{ url: '/og-image.jpg', alt: 'Bar Oren — המיוצגים' }],
  },
};

export default function TalentPage() {
  const sorted = [...talentList].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className={styles.page}>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <div className="container">
          <h1 className={styles.pageTitle}>המיוצגים</h1>
        </div>
      </div>

      {/* Suspense required for useSearchParams inside TalentRoster */}
      <Suspense>
        <TalentRoster talent={sorted} mode="page" />
      </Suspense>
    </div>
  );
}
