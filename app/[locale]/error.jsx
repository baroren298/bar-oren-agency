'use client';

/*
 * Locale-aware error boundary for the public site — CMS Error & Loading
 * Boundaries sprint.
 *
 * Lives at app/[locale]/error.jsx and mirrors app/[locale]/not-found.jsx's
 * exact approach: error.jsx receives no route params (only {error, reset}),
 * so locale is derived from the current path the same way not-found.jsx
 * already does — usePathname() + getLocaleFromPathname() — rather than
 * inventing a second mechanism.
 *
 * Because this file nests inside app/[locale]/layout.jsx rather than
 * replacing it, Header and Footer (rendered by that layout, around
 * {children}) stay mounted — only the <main> content area this boundary
 * wraps is replaced. Unlike the admin boundary, there is no "chrome
 * disappears" concern here.
 *
 * Deliberately never reads `error.message` / `error.stack` / `error.digest`
 * — only `reset` is used; see app/admin/error.jsx's header comment for the
 * same reasoning (never surface raw error detail to the site visitor).
 *
 * No app/global-error.jsx this sprint — see the design review §6:
 * app/[locale]/layout.jsx's only failure-prone call (getStrings) already
 * has a hard DEFAULT_LOCALE fallback, and dynamicParams = false rejects any
 * unsupported locale before this layout ever runs, so the remaining risk of
 * an error escaping the layout itself is low enough to accept for CMS v1.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getLocaleFromPathname, getStrings, homeHref } from '@/lib/i18n';
import { siteConfig } from '@/data/site';
import styles from './error.module.css';

export default function PublicError({ reset }) {
  const pathname = usePathname() || '';
  const locale = getLocaleFromPathname(pathname);
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const t = getStrings(locale);

  useEffect(() => {
    document.title = `${t.error.title} | ${siteConfig.name}`;
  }, [t.error.title]);

  return (
    <div className={styles.page} dir={dir}>
      <div className="container">
        <h1 className={styles.title}>{t.error.title}</h1>
        <p className={styles.body}>{t.error.body}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.retry} onClick={reset}>
            {t.error.retry}
          </button>
          {/* Reuses the existing 404 page's home-link copy/destination
              rather than duplicating a second "home" string. */}
          <Link href={homeHref(locale)} className={styles.link}>
            {t.notFound.link}
          </Link>
        </div>
      </div>
    </div>
  );
}
