import Link from 'next/link';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { siteConfig } from '@/data/site';
import styles from './AboutServices.module.css';

export default function AboutServices() {
  const { services } = siteConfig.about;

  return (
    <section className={`${styles.section} section`} aria-label="שירותים">
      <div className={`${styles.inner} container`}>

        <ScrollReveal>
          <div className={styles.header}>
            <p className={styles.sectionLabel}>מה אנחנו עושים</p>
          </div>
        </ScrollReveal>

        <div className={styles.grid}>
          {services.map((service, i) => (
            <ScrollReveal key={service.number} delay={0.06 * i}>
              <article className={styles.serviceCard} aria-label={service.title}>
                <p className={styles.number} aria-hidden="true">{service.number}</p>
                <div className={styles.cardBody}>
                  <h3 className={styles.title}>{service.title}</h3>
                  <p className={styles.description}>{service.description}</p>
                </div>
              </article>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={0.1}>
          <div className={styles.footer}>
            <Link href="/contact" className={styles.ctaLink} aria-label="לפרטים נוספים — צרו קשר">
              לפרטים נוספים
              <span className={styles.arrow} aria-hidden="true">←</span>
            </Link>
          </div>
        </ScrollReveal>

      </div>
    </section>
  );
}
