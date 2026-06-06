import Link from 'next/link';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { siteConfig } from '@/data/site';
import styles from './ContactInvite.module.css';

export default function ContactInvite() {
  const { contactHeadline } = siteConfig.homepage;

  return (
    <section className={`${styles.section} section-lg`} aria-label="צור קשר">
      <div className={`${styles.inner} container`}>
        <ScrollReveal>
          <p className={styles.headline}>{contactHeadline}</p>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <Link href="/contact" className={styles.ctaBtn} aria-label="עמוד יצירת קשר">
            צור קשר
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}
