import { siteConfig } from '@/data/site';
import PageHeader from '@/components/common/PageHeader';
import { localizeHref } from '@/lib/i18n';
import styles from '@/styles/legal.module.css';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const isEnglish = locale === 'en';
  const { accessibilityPage: a } = siteConfig;
  const title       = isEnglish ? a.metaTitleEn       : a.metaTitle;
  const description = isEnglish ? a.metaDescriptionEn : a.metaDescription;
  const ogTitle      = isEnglish ? a.ogTitleEn         : a.ogTitle;
  const ogAlt         = isEnglish ? a.ogAltEn           : a.ogAlt;
  const canonical     = localizeHref('/accessibility', locale);

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

export default async function AccessibilityPage({ params }) {
  const { locale } = await params;
  const isEnglish = locale === 'en';
  const { email } = siteConfig.contact;
  const a = siteConfig.accessibilityPage;

  const h1               = isEnglish ? a.h1En               : a.h1;
  const updated           = isEnglish ? a.updatedEn           : a.updated;
  const intro             = isEnglish ? a.introEn             : a.intro;
  const whatHeading       = isEnglish ? a.whatHeadingEn       : a.whatHeading;
  const whatItems         = isEnglish ? a.whatItemsEn         : a.whatItems;
  const techHeading       = isEnglish ? a.techHeadingEn       : a.techHeading;
  const techParagraph     = isEnglish ? a.techParagraphEn     : a.techParagraph;
  const limitationsHeading   = isEnglish ? a.limitationsHeadingEn   : a.limitationsHeading;
  const limitationsParagraph = isEnglish ? a.limitationsParagraphEn : a.limitationsParagraph;
  const contactHeading    = isEnglish ? a.contactHeadingEn    : a.contactHeading;
  const contactIntro      = isEnglish ? a.contactIntroEn      : a.contactIntro;
  const emailLabel        = isEnglish ? a.emailLabelEn        : a.emailLabel;
  const emailAriaTemplate = isEnglish ? a.emailAriaTemplateEn : a.emailAriaTemplate;
  const closingLine       = isEnglish ? a.closingLineEn       : a.closingLine;

  return (
    <div className={styles.page}>
      <PageHeader title={h1} />

      <div className="container">
        <div className={styles.content}>
          <p className={styles.updated}>{updated}</p>

          <p>{intro}</p>

          <h2>{whatHeading}</h2>
          <ul>
            {whatItems.map((item, i) =>
              typeof item === 'string' ? (
                <li key={i}>{item}</li>
              ) : (
                <li key={i}>
                  {item.text}
                  <code>{item.code}</code>
                  {item.suffix || ''}
                </li>
              )
            )}
          </ul>

          <h2>{techHeading}</h2>
          <p>{techParagraph}</p>

          <h2>{limitationsHeading}</h2>
          <p>{limitationsParagraph}</p>

          <h2>{contactHeading}</h2>
          <p>{contactIntro}</p>
          <ul>
            <li>
              {emailLabel}{' '}
              <a href={`mailto:${email}`} aria-label={emailAriaTemplate.replace('{email}', email)}>
                {email}
              </a>
            </li>
          </ul>
          <p>{closingLine}</p>
        </div>
      </div>
    </div>
  );
}
