import Image from 'next/image';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { siteConfig } from '@/data/site';
import styles from './AboutFounder.module.css';

export default function AboutFounder() {
  const { founder } = siteConfig.about;

  return (
    <section className={`${styles.section} section`} aria-label="המייסד">
      <div className={`${styles.inner} container`}>

        {/* Optional founder portrait */}
        {founder.image && (
          <ScrollReveal className={styles.imageCell}>
            <div className={styles.imageWrapper}>
              <Image
                src={founder.image}
                alt={founder.name}
                fill
                sizes="(max-width: 768px) 100vw, 400px"
                className={styles.image}
              />
            </div>
          </ScrollReveal>
        )}

        {/* Text block */}
        <div className={`${styles.textCell} ${!founder.image ? styles.textCellFull : ''}`}>
          <ScrollReveal>
            <h2 className={styles.sectionLabel}>המייסד</h2>
          </ScrollReveal>

          <ScrollReveal delay={0.08}>
            <blockquote className={styles.statement}>
              <p className={styles.statementText}>
                &ldquo;{founder.statement}&rdquo;
              </p>
            </blockquote>
          </ScrollReveal>

          <ScrollReveal delay={0.16}>
            <div className={styles.attribution}>
              <p className={styles.founderName}>{founder.name}</p>
              <p className={styles.founderTitle}>{founder.title}</p>
            </div>
          </ScrollReveal>
        </div>

      </div>
    </section>
  );
}
