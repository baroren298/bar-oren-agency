import Image from 'next/image';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { siteConfig } from '@/data/site';
import styles from './AboutFounder.module.css';

export default function AboutFounder() {
  const { founder } = siteConfig.about;

  return (
    <section className={`${styles.section} section`} aria-label="המייסד">
      <div className={`${styles.inner} container`}>

        {/* Founder portrait */}
        {founder.image && (
          <ScrollReveal className={styles.imageCell}>
            <div className={styles.imageWrapper}>
              <Image
                src={founder.image}
                alt={founder.name}
                fill
                sizes="(max-width: 860px) 100vw, 480px"
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

          <div className={styles.bio}>
            {founder.bio.map((paragraph, i) => (
              <ScrollReveal key={i} delay={0.06 + i * 0.05}>
                <p
                  className={
                    i === 0
                      ? styles.leadParagraph
                      : i === founder.bio.length - 1
                      ? styles.closingParagraph
                      : styles.paragraph
                  }
                >
                  {paragraph}
                </p>
              </ScrollReveal>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
