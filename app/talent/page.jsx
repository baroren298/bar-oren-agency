import { Suspense } from 'react';
import { talentList } from '@/data/talent';
import TalentRoster from '@/components/talent/TalentRoster';
import styles from './talent.module.css';

const DESCRIPTION = 'כישרונות נבחרים בניהולה האישי של בר אורן — יוצרי תוכן, משפיענים, דוגמנים ושחקנים.';

export const metadata = {
  title:       'הכישרונות',
  description:  DESCRIPTION,
  alternates:  { canonical: '/talent' },
  openGraph: {
    title:       'הכישרונות | Bar Oren',
    description:  DESCRIPTION,
    url:         '/talent',
    images:      [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Bar Oren — הכישרונות' }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'הכישרונות | Bar Oren',
    description:  DESCRIPTION,
    images:      ['/og-image.jpg'],
  },
};

export default function TalentPage() {
  const sorted = [...talentList].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className={styles.page}>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <div className="container">
          <h1 className={styles.pageTitle}>הכישרונות</h1>
        </div>
      </div>

      {/* Suspense required for useSearchParams inside TalentRoster */}
      <Suspense>
        <TalentRoster talent={sorted} />
      </Suspense>
    </div>
  );
}
