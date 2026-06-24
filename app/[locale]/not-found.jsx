'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getLocaleFromPathname, getStrings, homeHref } from '@/lib/i18n';
import styles from './not-found.module.css';

/*
 * Locale-aware 404.
 *
 * Lives at app/[locale]/not-found.jsx (not app/not-found.jsx) — see the
 * routing notes in app/[locale]/layout.jsx for why a root-level
 * not-found.jsx can't coexist with this layout owning <html>/<body>.
 *
 * This renders whenever notFound() is thrown by a child of an already
 * validly-rendered /he or /en route (e.g. an unknown talent slug) — that
 * case is unambiguous, so a plain nested not-found.jsx works correctly.
 * It will NOT be hit for invalid locale segments (those 404 earlier, at
 * the routing layer, via `dynamicParams = false`) or for unmatched
 * multi-segment URLs (e.g. /foo/bar) — both fall back to Next's built-in
 * generic 404, an accepted trade-off rather than using the experimental
 * `global-not-found.js` feature.
 *
 * not-found.jsx doesn't receive route params, so locale is read from the
 * current path via usePathname() — Next's own docs call this out as the
 * supported way to make a not-found page path-aware.
 *
 * Copy now comes from the shared UI string dictionary (data/i18n/strings.js)
 * via getStrings(), same as Header/Footer.
 */
export default function NotFound() {
  const pathname = usePathname() || '';
  const locale = getLocaleFromPathname(pathname);
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const t = getStrings(locale);

  return (
    <div className={styles.page} dir={dir}>
      <div className="container">
        <p className={styles.code}>404</p>
        <h1 className={styles.title}>{t.notFound.title}</h1>
        <Link href={homeHref(locale)} className={styles.link}>
          {t.notFound.link}
        </Link>
      </div>
    </div>
  );
}
