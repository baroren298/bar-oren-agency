import Link from 'next/link';
import ScrollReveal from '@/components/ui/ScrollReveal';
import TalentCard from './TalentCard';
import { siteConfig } from '@/data/site';
import { localizeHref } from '@/lib/i18n';
import styles from './FeaturedTalent.module.css';

export default function FeaturedTalent({ talent = [], locale = 'he' }) {
  const isEnglish = locale === 'en';
  const sectionLabel = isEnglish ? 'Represented Talent' : 'מיוצגים';
  const ctaLabel     = isEnglish ? 'View All Talent' : 'לכל המיוצגים';
  const title         = isEnglish ? siteConfig.homepage.featuredTitleEn : siteConfig.homepage.featuredTitle;
  const ctaText       = isEnglish ? siteConfig.homepage.featuredCtaEn   : siteConfig.homepage.featuredCta;
  const talentHref    = localizeHref('/talent', locale);

  return (
    <section className={`${styles.section} section`} aria-label={sectionLabel}>
      <div className={`${styles.inner} container`}>
        {/* Header row */}
        <ScrollReveal>
          <div className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
            <Link href={talentHref} className={`${styles.ctaLink} ${styles.ctaLinkHeader}`} aria-label={ctaLabel}>
              <span>{ctaText}</span>
              <span className={styles.arrow} aria-hidden="true">←</span>
            </Link>
          </div>
        </ScrollReveal>

        {/* Uniform 3-column portfolio grid — cards navigate to /talent/[slug] */}
        {talent.length > 0 && (
          <div className={styles.grid}>
            {talent.map((t, i) => (
              <ScrollReveal key={t.id} delay={i * 0.08}>
                <TalentCard talent={t} aspectRatio="3/4" />
              </ScrollReveal>
            ))}
          </div>
        )}

        {/* Mobile-only: CTA link repeated below the featured cards so it's
            visible right after scrolling through them, without needing to
            scroll back up to the header row. Hidden on desktop. */}
        {talent.length > 0 && (
          <div className={styles.ctaLinkMobileRow}>
            <Link href={talentHref} className={styles.ctaLink} aria-label={ctaLabel}>
              <span>{ctaText}</span>
              <span className={styles.arrow} aria-hidden="true">←</span>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
