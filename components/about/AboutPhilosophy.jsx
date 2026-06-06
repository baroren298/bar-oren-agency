import ScrollReveal from '@/components/ui/ScrollReveal';
import { siteConfig } from '@/data/site';
import styles from './AboutPhilosophy.module.css';

export default function AboutPhilosophy() {
  const { story } = siteConfig.about;

  return (
    <section className={`${styles.section} section`} aria-label="הסיפור שלנו">
      <div className={`${styles.inner} container`}>
        <ScrollReveal>
          <h2 className={styles.sectionLabel}>הסיפור שלנו</h2>
        </ScrollReveal>

        <div className={styles.content}>
          {story.map((paragraph, i) => (
            <ScrollReveal key={i} delay={0.08 + i * 0.1}>
              <p className={i === 0 ? styles.leadParagraph : styles.paragraph}>
                {paragraph}
              </p>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
