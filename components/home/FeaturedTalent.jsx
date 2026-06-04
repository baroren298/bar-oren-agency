import Link from 'next/link';
import ScrollReveal from '@/components/ui/ScrollReveal';
import TalentCard from './TalentCard';
import { siteConfig } from '@/data/site';
import styles from './FeaturedTalent.module.css';

export default function FeaturedTalent({ talent = [] }) {
  const [primary, ...rest] = talent;

  return (
    <section className={`${styles.section} section`} aria-label="כישרונות נבחרים">
      <div className={`${styles.inner} container`}>
        {/* Header row */}
        <ScrollReveal>
          <div className={styles.header}>
            <h2 className={styles.title}>{siteConfig.homepage.featuredTitle}</h2>
            <Link href="/talent" className={styles.ctaLink} aria-label="לכל הכישרונות">
              <span>{siteConfig.homepage.featuredCta}</span>
              <span className={styles.arrow} aria-hidden="true">←</span>
            </Link>
          </div>
        </ScrollReveal>

        {/* Asymmetric editorial grid */}
        {talent.length > 0 && (
          <div className={styles.grid}>
            {/* Primary — tall portrait (left column in RTL) */}
            {primary && (
              <ScrollReveal delay={0.05}>
                <TalentCard talent={primary} aspectRatio="2/3" />
              </ScrollReveal>
            )}

            {/* Secondary — two shorter portraits stacked */}
            {rest.length > 0 && (
              <div className={styles.secondaryColumn}>
                {rest.slice(0, 2).map((t, i) => (
                  <ScrollReveal key={t.id} delay={0.1 + i * 0.08}>
                    <TalentCard talent={t} aspectRatio="4/5" />
                  </ScrollReveal>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
