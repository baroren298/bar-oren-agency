import { Frank_Ruhl_Libre, Heebo, Cormorant_Garamond, DM_Sans } from 'next/font/google';
import '@/styles/globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import FloatingWhatsApp from '@/components/ui/FloatingWhatsApp';
import ScrollToTopButton from '@/components/common/ScrollToTopButton';
import JsonLd from '@/components/ui/JsonLd';
import { siteConfig } from '@/data/site';
import { getStrings } from '@/lib/i18n';

/*
 * Supported locales:
 *   he — Hebrew, primary language, served unprefixed at "/" via the
 *        next.config.mjs rewrites (public URL has no "/he").
 *   en — English, served at "/en".
 *
 * generateStaticParams pre-renders both locale trees at build time. Any
 * other first path segment would otherwise also match this [locale]
 * route (Next.js dynamic segments match any string) — `dynamicParams =
 * false` below tells Next to treat any locale NOT returned here as a
 * standard unmatched route (Next's generic 404), instead of rendering it.
 *
 * We deliberately do NOT call notFound() inside this layout to reject bad
 * locales: this layout owns <html>/<body> as the de-facto root layout
 * (there's no app/layout.jsx above it), and throwing notFound() from the
 * component that owns the document shell creates an ambiguous "who
 * renders <html> now" situation. `dynamicParams = false` avoids that
 * entirely — invalid locales are 404'd at the routing layer, before this
 * component ever runs.
 */
const SUPPORTED_LOCALES = ['he', 'en'];

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export const dynamicParams = false;

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

  /* dynamicParams = false above guarantees `locale` is always 'he' or
   * 'en' here — anything else 404s before this component runs. */
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
