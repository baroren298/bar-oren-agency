import Link from 'next/link';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { siteConfig } from '@/data/site';
import { localizeHref } from '@/lib/i18n';
import styles from './ContactInvite.module.css';

export default function ContactInvite({ locale = 'he' }) {
  const isEnglish = locale === 'en';
  const { contactHeadline, contactHeadlineEn } = siteConfig.homepage;
  const headline    = isEnglish ? contactHeadlineEn : contactHeadline;
  const contactHref = localizeHref('/contact', locale);
  /* English copy is longer than the Hebrew headline and wraps at the same
     size — apply a smaller English-only font-size class. Hebrew keeps the
     base .headline class unchanged. */
  const headlineClassName = isEnglish ? `${styles.headline} ${styles.headlineEn}` : styles.headline;

  return (
    <section className={`${styles.section} section-lg`} aria-label={isEnglish ? 'Contact Us' : 'צור קשר'}>
      <div className={`${styles.inner} container`}>
        <ScrollReveal>
          <p className={headlineClassName}>{headline}</p>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <Link href={contactHref} className={styles.ctaBtn} aria-label={isEnglish ? 'Contact Page' : 'עמוד יצירת קשר'}>
            {isEnglish ? 'Contact the Agency' : 'צור קשר עם הסוכנות'}
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}
