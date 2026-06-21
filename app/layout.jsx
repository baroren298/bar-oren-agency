import { Frank_Ruhl_Libre, Heebo, Cormorant_Garamond, DM_Sans } from 'next/font/google';
import '../styles/globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import FloatingWhatsApp from '@/components/ui/FloatingWhatsApp';
import ScrollToTopButton from '@/components/common/ScrollToTopButton';
import JsonLd from '@/components/ui/JsonLd';
import { siteConfig } from '@/data/site';

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

export const metadata = {
  metadataBase: new URL(metaBase),

  title: {
    default:  siteConfig.meta.title,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.meta.description,

  keywords: [
    'סוכנות כישרונות',
    'ניהול כישרונות',
    'יוצרי תוכן',
    'משפיענים',
    'talent agency Israel',
    'influencer management',
    'content creator',
  ],

  authors:   [{ name: siteConfig.name }],
  creator:    siteConfig.name,
  publisher:  siteConfig.agencyName,

  openGraph: {
    type:        'website',
    locale:       siteConfig.meta.locale,
    siteName:     siteConfig.agencyName,
    title:        siteConfig.meta.title,
    description:  siteConfig.meta.description,
    url:          siteConfig.meta.url,
    images:       [OG_IMAGE],
  },

  twitter: {
    card:        'summary_large_image',
    title:        siteConfig.meta.title,
    description:  siteConfig.meta.description,
    images:       [{ url: '/og-image.jpg', alt: siteConfig.meta.title }],
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

const BASE = siteConfig.meta.url;

const siteSchema = [
  {
    '@context': 'https://schema.org',
    '@type':    'WebSite',
    '@id':      `${BASE}/#website`,
    name:        siteConfig.agencyName,
    url:         BASE,
    inLanguage:  'he',
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
    description: siteConfig.meta.description,
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

export default function RootLayout({ children }) {
  const fontClasses = [
    frankRuhlLibre.variable,
    heebo.variable,
    cormorantGaramond.variable,
    dmSans.variable,
  ].join(' ');

  return (
    <html lang="he" dir="rtl" className={fontClasses}>
      <body>
        {/* Accessibility: skip past fixed nav directly to content */}
        <a href="#main-content" className="skip-link">
          דלג לתוכן הראשי
        </a>

        <Header />
        <main id="main-content">{children}</main>
        <Footer />
        {/* Scroll-to-top sits directly above WhatsApp, which stays the primary, lowest CTA */}
        <ScrollToTopButton />
        {/* Single site-wide WhatsApp entry point — rendered once, available on every page */}
        <FloatingWhatsApp />

        <JsonLd data={siteSchema} />
      </body>
    </html>
  );
}
