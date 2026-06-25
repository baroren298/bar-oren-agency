import Link from 'next/link';
import { headers } from 'next/headers';
import { Frank_Ruhl_Libre, Heebo } from 'next/font/google';
import '@/styles/globals.css';
import { getLocaleFromPathname, getStrings, homeHref } from '@/lib/i18n';
import { siteConfig } from '@/data/site';
import styles from './[locale]/not-found.module.css';

/*
 * App-wide 404, required because this app has no root app/layout.jsx
 * (app/[locale]/layout.jsx is the de-facto root). Per Next.js's own docs
 * for not-found.js: "global-not-found.js is useful when... your root
 * layout is defined using top-level dynamic segments (e.g.
 * app/[country]/layout.tsx), which makes composing a consistent 404 page
 * harder." That's exactly this app's shape — confirmed by direct testing
 * that app/[locale]/not-found.jsx alone never renders for unmatched URLs
 * or full-page-load notFound() throws.
 *
 * global-not-found.js bypasses normal layout/page rendering entirely
 * (per Next's docs), so it gets none of app/[locale]/layout.jsx's
 * <html>/<body>, fonts, or globals.css — all of that is reimported here
 * so the 404 page still looks like the rest of the site.
 *
 * It also receives no params and isn't rendered inside the Next.js router
 * tree, so usePathname() isn't available either (and this must be a
 * Server Component to support generateMetadata, ruling out client hooks
 * anyway). middleware.js stamps the original request pathname onto an
 * "x-pathname" header specifically so this component can recover it via
 * headers() and pick the right locale/copy — same convention as
 * getLocaleFromPathname() already uses elsewhere (checks for an "/en"
 * prefix on the public, pre-rewrite URL).
 */

const frankRuhlLibre = Frank_Ruhl_Libre({
  subsets: ['latin', 'hebrew'],
  weight: ['300', '400', '500', '700', '900'],
  variable: '--loaded-frank-ruhl',
  display: 'swap',
});

const heebo = Heebo({
  subsets: ['latin', 'hebrew'],
  weight: ['400', '500', '600'],
  variable: '--loaded-heebo',
  display: 'swap',
});

async function resolveLocale() {
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '';
  return getLocaleFromPathname(pathname);
}

export async function generateMetadata() {
  const locale = await resolveLocale();
  const t = getStrings(locale);

  return {
    title: `${t.notFound.title} | ${siteConfig.name}`,
  };
}

export default async function GlobalNotFound() {
  const locale = await resolveLocale();
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const t = getStrings(locale);
  const fontClasses = [frankRuhlLibre.variable, heebo.variable].join(' ');

  return (
    <html lang={locale} dir={dir} className={fontClasses}>
      <body>
        <div className={styles.page} dir={dir}>
          <div className="container">
            <p className={styles.code}>404</p>
            <h1 className={styles.title}>{t.notFound.title}</h1>
            <Link href={homeHref(locale)} className={styles.link}>
              {t.notFound.link}
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
