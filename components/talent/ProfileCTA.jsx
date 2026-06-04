import Link from 'next/link';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { siteConfig } from '@/data/site';
import styles from './ProfileCTA.module.css';

export default function ProfileCTA({ talent }) {
  return (
    <section className={`${styles.section} section`} aria-label="יצירת קשר">
      <div className={`${styles.inner} container`}>
        <ScrollReveal>
          <p className={styles.prompt}>
            מעוניינים לעבוד עם{' '}
            <span className={styles.talentName}>{talent.name}</span>?
          </p>
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <Link
            href={siteConfig.contact.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.ctaBtn}
            aria-label={`צרו קשר עם בר אורן לגבי ${talent.name}`}
          >
            צרו קשר עם בר אורן
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}
