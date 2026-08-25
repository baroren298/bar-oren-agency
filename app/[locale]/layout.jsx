import { notFound } from 'next/navigation';
import { Frank_Ruhl_Libre, Heebo, Cormorant_Garamond, DM_Sans } from 'next/font/google';
import '@/styles/globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import FloatingWhatsApp from '@/components/ui/FloatingWhatsApp';
import ScrollToTopButton from '@/components/common/ScrollToTopButton';
import JsonLd from '@/components/ui/JsonLd';
import { siteConfig } from '@/data/site';
import { getStrings, SUPPORTED_LOCALES } from '@/lib/i18n';

/*
 * Supported locales:
 *   he — Hebrew, primary language, served unprefixed at "/" via the
 *        next.config.mjs rewrites (public URL has no "/he").
 *   en — English, served at "/en".
 *
 * generateStaticParams pre-renders both locale trees at build time. Any
 * other first path segment also structurally matches this [locale] route
 * (Next.js dynamic segments match any string), so unsupported locales are
 * rejected explicitly by the notFound() guard in RootLayout below.
 *
 * This layout used to reject them with a `dynamicParams = false` route
 * segment config instead. That export had to be removed: dynamicParams is
 * NOT scoped to the segment that declares it. Next resolves it once for
 * the whole route chain —
 *
 *   node_modules/next/dist/build/static-paths/app.js
 *   const dynamicParams = segments.every((s) => s.config?.dynamicParams !== false)
 *   const fallbackMode  = dynamicParams ? ... : FallbackMode.NOT_FOUND
 *
 * (the TODO directly above that line notes per-segment granularity does
 * not exist yet) — so this one export also put every dynamic route nested
 * under [locale], including /[locale]/talent/[slug], into fallback mode
 * NOT_FOUND. Only slugs returned by generateStaticParams *at build time*
 * existed publicly: a talent published from the CMS after a deployment
 * 404'd at the routing layer before its page component ever ran, and
 * neither the page's ISR `revalidate` window nor the publish flow's
 * revalidatePath() call could fix it, because on-demand revalidation
 * cannot create a path that was never prerendered.
 *
 * The locale allowlist itself is unchanged — it just moved from a route
 * segment config to an explicit runtime check, so it constrains the
 * `locale` param only instead of every dynamic segment below it.
 * SUPPORTED_LOCALES is imported from lib/i18n.js (the canonical list this
 * routing layer already shares with getLocaleFromPathname/localizeHref)
 * rather than redeclared here.
 */
export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

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

const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--loaded-cormorant',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--loaded-dm-sans',
  display: 'swap',
});

const OG_IMAGE = {
  url: '/og-image.jpg',
  width: 1200,
  height: 630,
  alt: siteConfig.meta.title,
};

export const viewport = {
  width:        'device-width',
  initialScale:  1,
};

/*
 * Resolve the canonical base URL for this deployment.
 *
 * Priority:
 *   1. VERCEL_PROJECT_PRODUCTION_URL — Vercel's primary production domain
 *      (e.g. "baroren.co.il" once the custom domain is wired up, or
 *       "bar-oren-agency.vercel.app" until then). No https:// prefix.
 *   2. VERCEL_URL — unique URL for this specific Vercel deployment build.
 *      Use as a fallback so preview deployments also get correct absolute OG URLs.
 *   3. siteConfig.meta.url — local development fallback.
 */
const metaBase =
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : siteConfig.meta.url;

/*
 * generateMetadata (not a static `metadata` export) so openGraph.locale can
 * reflect the actual locale tree being rendered ('he_IL' vs 'en_US')
 * instead of always advertising Hebrew, even on /en/* pages. Page-level
 * generateMetadata (home, talent, etc.) still overrides title/description/
 * url per page — this just supplies the site-wide defaults + the
 * locale-correct fallback.
 */
export async function generateMetadata({ params }) {
  const { locale } = await params;
  const isEnglish = locale === 'en';
  const description = isEnglish ? siteConfig.meta.descriptionEn : siteConfig.meta.description;
  const ogLocale = isEnglish ? 'en_US' : 'he_IL';

  return {
    metadataBase: new URL(metaBase),

    title: {
      default:  siteConfig.meta.title,
      template: `%s | ${siteConfig.name}`,
    },
    description,

    keywords: siteConfig.meta.keywords,

    authors:   [{ name: siteConfig.name }],
    creator:    siteConfig.name,
    publisher:  siteConfig.agencyName,

    openGraph: {
      type:        'website',
      locale:       ogLocale,
      siteName:     siteConfig.agencyName,
      title:        siteConfig.meta.title,
      description,
      url:          siteConfig.meta.url,
      images:       [OG_IMAGE],
    },

    twitter: {
      card:        'summary_large_image',
      title:        siteConfig.meta.title,
      description,
      images:      [{ url: '/og-image.jpg', alt: siteConfig.meta.title }],
    },

    robots: {
      index:  true,
      follow: true,
      googleBot: {
        index:               true,
        follow:              true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet':       -1,
      },
    },
  };
}

const BASE = siteConfig.meta.url;

function buildSiteSchema(locale) {
  return [
    {
      '@context': 'https://schema.org',
      '@type':    'WebSite',
      '@id':      `${BASE}/#website`,
      name:        siteConfig.agencyName,
      url:         BASE,
      inLanguage:  locale === 'en' ? 'en' : 'he',
      publisher: { '@id': `${BASE}/#organization` },
    },
    {
      '@context': 'https://schema.org',
      '@type':    'Organization',
      '@id':      `${BASE}/#organization`,
      name:        siteConfig.agencyName,
      url:         BASE,
      logo: {
        '@type':  'ImageObject',
        url:      `${BASE}/images/brand/logo3.png`,
        width:    600,
        height:   240,
      },
      description: locale === 'en' ? siteConfig.meta.descriptionEn : siteConfig.meta.description,
      founder: {
        '@type': 'Person',
        name:     siteConfig.about.founder.name,
      },
      address: {
        '@type':         'PostalAddress',
        addressLocality: 'Tel Aviv',
        addressCountry:  'IL',
      },
      contactPoint: {
        '@type':       'ContactPoint',
        email:          siteConfig.contact.email,
        contactType:   'booking',
      },
      sameAs: [
        siteConfig.contact.instagram,
        siteConfig.contact.tiktok,
      ].filter(Boolean),
    },
  ];
}

export default async function RootLayout({ children, params }) {
  const { locale } = await params;

  /* Fail closed on an unsupported locale. Replaces the removed
   * `dynamicParams = false` route segment config (see this file's header
   * comment for why that export could not stay); the allowlist is the
   * same one generateStaticParams pre-renders. */
  if (!SUPPORTED_LOCALES.includes(locale)) notFound();

  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const t = getStrings(locale);

  const fontClasses = [
    frankRuhlLibre.variable,
    heebo.variable,
    cormorantGaramond.variable,
    dmSans.variable,
  ].join(' ');

  return (
    <html lang={locale} dir={dir} className={fontClasses}>
      <body>
        {/* Accessibility: skip past fixed nav directly to content. */}
        <a href="#main-content" className="skip-link">
          {t.skipLink}
        </a>

        <Header />
        <main id="main-content">{children}</main>
        <Footer />
        {/* Scroll-to-top sits directly above WhatsApp, which stays the primary, lowest CTA */}
        <ScrollToTopButton locale={locale} />
        {/* Single site-wide WhatsApp entry point — rendered once, available on every page */}
        <FloatingWhatsApp locale={locale} />

        <JsonLd data={buildSiteSchema(locale)} />
      </body>
    </html>
  );
}
