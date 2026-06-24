import Link from 'next/link';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { localizeHref } from '@/lib/i18n';
import styles from './ProfileCTA.module.css';

export default function ProfileCTA({ talent, locale = 'he' }) {
  const isEnglish   = locale === 'en';
  const contactHref = localizeHref('/contact', locale);
  /* English field may be missing on a given talent — fall back to the
     Hebrew name rather than rendering nothing. */
  const displayName = isEnglish ? (talent.nameEn || talent.name) : talent.name;

  return (
    <section className={`${styles.section} section`} aria-label={isEnglish ? 'Contact Us' : 'יצירת קשר'}>
      <div className={`${styles.inner} container`}>
        <ScrollReveal>
          <p className={styles.prompt}>
            {isEnglish ? (
              <>Interested in working with{' '}<span className={styles.talentName}>{displayName}</span>?</>
            ) : (
              <>מעוניינים לעבוד עם{' '}<span className={styles.talentName}>{displayName}</span>?</>
            )}
          </p>
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <Link
            href={contactHref}
            className={styles.ctaBtn}
            aria-label={isEnglish ? `Contact us regarding ${displayName}` : `צרו קשר לגבי ${displayName}`}
          >
            {isEnglish ? 'Contact Us' : 'צרו קשר'}
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}
