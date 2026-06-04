import { Frank_Ruhl_Libre, Heebo, Cormorant_Garamond, DM_Sans } from 'next/font/google';
import '../styles/globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import JsonLd from '@/components/ui/JsonLd';
import { siteConfig } from '@/data/site';

const frankRuhlLibre = Frank_Ruhl_Libre({
  subsets: ['latin', 'hebrew'],
  weight: ['300', '400', '500'],
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
  url: '/og-image.jpg', // place a 1200×630 image at /public/og-image.jpg before launch
  width: 1200,
  height: 630,
  alt: siteConfig.meta.title,
};

export const metadata = {
  metadataBase: new URL(siteConfig.meta.url),

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
    images:       ['/og-image.jpg'],
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

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type':    'Organization',
  name:        siteConfig.agencyName,
  url:         siteConfig.meta.url,
  logo:       `${siteConfig.meta.url}/og-image.jpg`,
  description: siteConfig.meta.description,
  address: {
    '@type':         'PostalAddress',
    addressLocality: 'Tel Aviv',
    addressCountry:  'IL',
  },
  contactPoint: {
    '@type':      'ContactPoint',
    email:         siteConfig.contact.email,
    contactType:  'booking',
  },
  sameAs: [
    siteConfig.contact.instagram,
    siteConfig.contact.tiktok,
  ].filter(Boolean),
};

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

        <JsonLd data={organizationSchema} />
      </body>
    </html>
  );
}
