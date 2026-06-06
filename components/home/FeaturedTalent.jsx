import Link from 'next/link';
import ScrollReveal from '@/components/ui/ScrollReveal';
import TalentCard from './TalentCard';
import { siteConfig } from '@/data/site';
import styles from './FeaturedTalent.module.css';

export default function FeaturedTalent({ talent = [] }) {
  return (
    <section className={`${styles.section} section`} aria-label="מיוצגים">
      <div className={`${styles.inner} container`}>
        {/* Header row */}
        <ScrollReveal>
          <div className={styles.header}>
            <h2 className={styles.title}>{siteConfig.homepage.featuredTitle}</h2>
            <Link href="/talent" className={styles.ctaLink} aria-label="לכל המיוצגים">
              <span>{siteConfig.homepage.featuredCta}</span>
              <span className={styles.arrow} aria-hidden="true">←</span>
            </Link>
          </div>
        </ScrollReveal>

        {/* Uniform 3-column portfolio grid */}
        {talent.length > 0 && (
          <div className={styles.grid}>
            {talent.map((t, i) => (
              <ScrollReveal key={t.id} delay={i * 0.08}>
                <TalentCard talent={t} aspectRatio="3/4" />
              </ScrollReveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
