import Link from 'next/link';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { siteConfig } from '@/data/site';
import styles from './ContactInvite.module.css';

export default function ContactInvite() {
  const { contactHeadline, contactBody } = siteConfig.homepage;
  const { email } = siteConfig.contact;

  return (
    <section className={`${styles.section} section-lg`} aria-label="צור קשר">
      <div className={`${styles.inner} container`}>
        <ScrollReveal>
          <p className={styles.headline}>{contactHeadline}</p>
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <p className={styles.body}>{contactBody}</p>
        </ScrollReveal>

        <ScrollReveal delay={0.18}>
          <div className={styles.actions}>
            <Link
              href={`mailto:${email}`}
              className={styles.emailLink}
              aria-label={`שלח אימייל ל-${email}`}
            >
              {email}
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
