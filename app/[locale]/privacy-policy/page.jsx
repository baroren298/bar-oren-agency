import { siteConfig } from '@/data/site';
import PageHeader from '@/components/common/PageHeader';
import { localizeHref } from '@/lib/i18n';
import styles from '@/styles/legal.module.css';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const isEnglish = locale === 'en';
  const { privacyPage: p } = siteConfig;
  const title       = isEnglish ? p.metaTitleEn       : p.metaTitle;
  const description = isEnglish ? p.metaDescriptionEn : p.metaDescription;
  const ogTitle      = isEnglish ? p.ogTitleEn         : p.ogTitle;
  const ogAlt         = isEnglish ? p.ogAltEn           : p.ogAlt;
  const canonical     = localizeHref('/privacy-policy', locale);

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

export default async function PrivacyPolicyPage({ params }) {
  const { locale } = await params;
  const isEnglish = locale === 'en';
  const { email, address } = siteConfig.contact;
  const p = siteConfig.privacyPage;

  const h1           = isEnglish ? p.h1En           : p.h1;
  const updated       = isEnglish ? p.updatedEn       : p.updated;
  const introPrefix   = isEnglish ? p.introPrefixEn   : p.introPrefix;
  const introSuffix   = isEnglish ? p.introSuffixEn   : p.introSuffix;
  const securityHeading      = isEnglish ? p.securityHeadingEn      : p.securityHeading;
  const securityParagraph    = isEnglish ? p.securityParagraphEn    : p.securityParagraph;
  const retentionHeading     = isEnglish ? p.retentionHeadingEn     : p.retentionHeading;
  const retentionParagraph   = isEnglish ? p.retentionParagraphEn   : p.retentionParagraph;
  const rightsHeading        = isEnglish ? p.rightsHeadingEn        : p.rightsHeading;
  const rightsIntro          = isEnglish ? p.rightsIntroEn          : p.rightsIntro;
  const rightsItems          = isEnglish ? p.rightsItemsEn          : p.rightsItems;
  const rightsOutro          = isEnglish ? p.rightsOutroEn          : p.rightsOutro;
  const changesHeading       = isEnglish ? p.changesHeadingEn       : p.changesHeading;
  const changesParagraph     = isEnglish ? p.changesParagraphEn     : p.changesParagraph;
  const contactHeading       = isEnglish ? p.contactHeadingEn       : p.contactHeading;
  const contactIntro         = isEnglish ? p.contactIntroEn         : p.contactIntro;
  const emailLabel           = isEnglish ? p.emailLabelEn           : p.emailLabel;
  const emailAriaTemplate    = isEnglish ? p.emailAriaTemplateEn    : p.emailAriaTemplate;
  const addressLabel         = isEnglish ? p.addressLabelEn         : p.addressLabel;

  return (
    <div className={styles.page}>
      <PageHeader title={h1} />

      <div className="container">
        <div className={styles.content}>
          <p className={styles.updated}>{updated}</p>

          <p>
            {introPrefix}
            <a href={siteConfig.meta.url}>{siteConfig.meta.url}</a>
            {introSuffix}
          </p>

          {p.sections.map((section, i) => {
            const heading = isEnglish ? section.headingEn : section.heading;
            const intro   = isEnglish ? section.introEn   : section.intro;
            const items   = isEnglish ? section.itemsEn   : section.items;
            const outro   = isEnglish ? section.outroEn   : section.outro;
            return (
              <div key={i}>
                <h2>{heading}</h2>
                {intro && <p>{intro}</p>}
                <ul>
                  {items.map((item, j) => (
                    <li key={j}>
                      {item.lead ? (
                        <>
                          <strong>{item.lead}</strong> — {item.text}
                        </>
                      ) : (
                        item.text
                      )}
                    </li>
                  ))}
                </ul>
                {outro && <p>{outro}</p>}
              </div>
            );
          })}

          <h2>{securityHeading}</h2>
          <p>{securityParagraph}</p>

          <h2>{retentionHeading}</h2>
          <p>{retentionParagraph}</p>

          <h2>{rightsHeading}</h2>
          <p>{rightsIntro}</p>
          <ul>
            {rightsItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          <p>{rightsOutro}</p>

          <h2>{changesHeading}</h2>
          <p>{changesParagraph}</p>

          <h2>{contactHeading}</h2>
          <p>{contactIntro}</p>
          <ul>
            <li>
              {emailLabel}{' '}
              <a href={`mailto:${email}`} aria-label={emailAriaTemplate.replace('{email}', email)}>
                {email}
              </a>
            </li>
            {address && <li>{addressLabel} {address}</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
