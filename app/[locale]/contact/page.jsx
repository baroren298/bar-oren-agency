import ContactForm from '@/components/contact/ContactForm';
import ContactInfo from '@/components/contact/ContactInfo';
import { siteConfig } from '@/data/site';
import { getStrings, localizeHref } from '@/lib/i18n';
import styles from './contact.module.css';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const isEnglish    = locale === 'en';
  const { contactPage } = siteConfig;
  const title       = isEnglish ? contactPage.metaTitleEn       : contactPage.metaTitle;
  const description = isEnglish ? contactPage.metaDescriptionEn : contactPage.metaDescription;
  const ogTitle      = isEnglish ? `${contactPage.metaTitleEn} | Bar Oren` : `${contactPage.metaTitle} | Bar Oren`;
  const ogAlt         = isEnglish ? `Bar Oren — ${contactPage.metaTitleEn}` : `Bar Oren — ${contactPage.metaTitle}`;
  const canonical     = localizeHref('/contact', locale);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title:       ogTitle,
      description,
      url:         canonical,
      images:      [{ url: '/og-image.jpg', width: 1200, height: 630, alt: ogAlt }],
    },
    twitter: {
      card:        'summary_large_image',
      title:       ogTitle,
      description,
      images:      [{ url: '/og-image.jpg', alt: ogAlt }],
    },
  };
}

export default async function ContactPage({ params }) {
  const { locale } = await params;
  const isEnglish = locale === 'en';
  const { contactPage } = siteConfig;
  const t = getStrings(locale).contact;
  const headline = isEnglish ? contactPage.headlineEn : contactPage.headline;
  const formTitle = isEnglish ? contactPage.formTitleEn : contactPage.formTitle;

  return (
    <div className={styles.page}>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <div className="container">
          <h1 className={styles.headline}>{headline}</h1>
          {/* subheadline hidden for launch — text kept in siteConfig.contactPage.subheadline */}
        </div>
      </div>

      {/* Two-column contact layout */}
      <section className={`${styles.body} section`} aria-label={t.sectionLabel}>
        <div className={`${styles.grid} container`}>
          {/* Right column (RTL first): form — primary action */}
          <div className={styles.formCol}>
            <ContactForm title={formTitle} locale={locale} />
          </div>

          {/* Left column (RTL second): direct contact details */}
          <div className={styles.infoCol}>
            <ContactInfo locale={locale} />
          </div>
        </div>
      </section>
    </div>
  );
}
