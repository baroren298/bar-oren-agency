import ContactForm from '@/components/contact/ContactForm';
import ContactInfo from '@/components/contact/ContactInfo';
import { siteConfig } from '@/data/site';
import styles from './contact.module.css';

const DESCRIPTION = 'לשיתופי פעולה, קאסטינג ופניות מותגים — צרו קשר ישירות עם בר אורן.';

export const metadata = {
  title:       'צור קשר',
  description:  DESCRIPTION,
  alternates:  { canonical: '/contact' },
  openGraph: {
    title:       'צור קשר | Bar Oren',
    description:  DESCRIPTION,
    url:         '/contact',
    images:      [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'צור קשר — Bar Oren' }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'צור קשר | Bar Oren',
    description:  DESCRIPTION,
    images:      [{ url: '/og-image.jpg', alt: 'צור קשר — Bar Oren' }],
  },
};

export default function ContactPage() {
  const { contactPage } = siteConfig;

  return (
    <div className={styles.page}>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <div className="container">
          <h1 className={styles.headline}>{contactPage.headline}</h1>
          <p className={styles.subheadline}>{contactPage.subheadline}</p>
        </div>
      </div>

      {/* Two-column contact layout */}
      <section className={`${styles.body} section`} aria-label="יצירת קשר">
        <div className={`${styles.grid} container`}>
          {/* Right column (RTL first): direct contact */}
          <div className={styles.infoCol}>
            <ContactInfo />
          </div>

          {/* Left column (RTL second): form */}
          <div className={styles.formCol}>
            <ContactForm title={contactPage.formTitle} />
          </div>
        </div>
      </section>
    </div>
  );
}
