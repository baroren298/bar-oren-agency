'use client';

/*
 * Locale-aware loading boundary for the public site — CMS Error & Loading
 * Boundaries sprint.
 *
 * Next.js's automatic Suspense fallback for pages under app/[locale]/** —
 * e.g. the talent list's ISR-backed read (lib/public/talent.js,
 * `revalidate = 60`). Nests inside app/[locale]/layout.jsx, so Header and
 * Footer stay mounted; only the <main> content area is replaced, same as
 * error.jsx.
 *
 * loading.jsx receives no params, so — same as error.jsx and the existing
 * not-found.jsx — direction is derived from usePathname() rather than an
 * unavailable params prop. The spinner itself needs no per-locale copy;
 * only its accessible status label does.
 *
 * No fabricated content: a plain spinner with a fixed min-height, nothing
 * shaped like real talent cards or text, so it never implies data that
 * hasn't loaded yet.
 */

import { usePathname } from 'next/navigation';
import { getLocaleFromPathname, getStrings } from '@/lib/i18n';
import styles from './loading.module.css';

export default function PublicLoading() {
  const pathname = usePathname() || '';
  const locale = getLocaleFromPathname(pathname);
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const t = getStrings(locale);

  return (
    <div className={styles.page} dir={dir}>
      <div className={styles.spinner} aria-hidden="true" />
      <span className={styles.visuallyHidden} role="status" aria-live="polite">
        {t.loading}
      </span>
    </div>
  );
}
