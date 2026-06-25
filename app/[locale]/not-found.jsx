'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getLocaleFromPathname, getStrings, homeHref } from '@/lib/i18n';
import { siteConfig } from '@/data/site';
import styles from './not-found.module.css';

/*
 * Locale-aware 404.
 *
 * Lives at app/[locale]/not-found.jsx (not app/not-found.jsx) — see the
 * routing notes in app/[locale]/layout.jsx for why a root-level
 * not-found.jsx can't coexist with this layout owning <html>/<body>.
 *
 * IMPORTANT — this is NOT the primary mechanism for unmatched URLs
 * anymore. Verified directly (see the TODO this replaced in
 * app/[locale]/talent/[slug]/page.jsx): because this app has no root
 * app/layout.jsx — app/[locale]/layout.jsx is the de-facto root — Next.js
 * cannot reliably compose this nested not-found.jsx for fully unmatched
 * routes or even for explicit notFound() throws on a full page load; it
 * silently falls back to its own generic 404 instead. That's exactly the
 * scenario Next's docs call out for app/global-not-found.jsx (see that
 * file + the `experimental.globalNotFound` flag in next.config.mjs),
 * which is now the actual fix for "/not-existing-page" and
 * "/en/not-existing-page".
 *
 * This file is kept as a defense-in-depth fallback for notFound() thrown
 * during client-side (soft) navigation within an already-rendered /he or
 * /en route tree, where React can still mount a nested boundary without a
 * full document reload.
 *
 * not-found.jsx doesn't receive route params, so locale is read from the
 * current path via usePathname() — Next's own docs call this out as the
 * supported way to make a not-found page path-aware.
 *
 * Copy now comes from the shared UI string dictionary (data/i18n/strings.js)
 * via getStrings(), same as Header/Footer.
 *
 * generateMetadata isn't available here (not-found.jsx is a Client
 * Component and receives no params), so the locale-aware <title> is set
 * imperatively via document.title, mirroring the "%s | {siteConfig.name}"
 * template used by the metadata API elsewhere on the site.
 */
export default function NotFound() {
  const pathname = usePathname() || '';
  const locale = getLocaleFromPathname(pathname);
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const t = getStrings(locale);

  useEffect(() => {
    document.title = `${t.notFound.title} | ${siteConfig.name}`;
  }, [t.notFound.title]);

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
