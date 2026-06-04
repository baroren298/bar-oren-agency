import Link from 'next/link';
import ScrollReveal from '@/components/ui/ScrollReveal';
import styles from './ProfileMeta.module.css';

/* Social channels — ordered by priority */
const SOCIAL_CHANNELS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok',    label: 'TikTok'    },
  { key: 'youtube',   label: 'YouTube'   },
];

export default function ProfileMeta({ talent }) {
  const hasTags    = talent.tags?.length > 0;
  const socials    = SOCIAL_CHANNELS.filter((ch) => Boolean(talent[ch.key]));
  const hasSocials = socials.length > 0;

  if (!hasTags && !hasSocials) return null;

  return (
    <section className={`${styles.section} section`} aria-label="תחומי פעילות ורשתות חברתיות">
      <div className={`${styles.inner} container`}>

        {/* Work area tags */}
        {hasTags && (
          <ScrollReveal>
            <div className={styles.group}>
              <p className={styles.groupLabel}>תחומי פעילות</p>
              <ul className={styles.tagList} aria-label="תחומי עבודה">
                {talent.tags.map((tag) => (
                  <li key={tag} className={styles.tag}>{tag}</li>
                ))}
              </ul>
            </div>
          </ScrollReveal>
        )}

        {/* Social presence */}
        {hasSocials && (
          <ScrollReveal delay={0.08}>
            <div className={styles.group}>
              <p className={styles.groupLabel}>נוכחות דיגיטלית</p>
              <div className={styles.socialList}>
                {socials.map((ch) => (
                  <Link
                    key={ch.key}
                    href={talent[ch.key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.socialLink}
                    aria-label={`${ch.label} של ${talent.name}`}
                  >
                    {ch.label}
                    <span className={styles.socialArrow} aria-hidden="true">←</span>
                  </Link>
                ))}
              </div>
            </div>
          </ScrollReveal>
        )}

      </div>
    </section>
  );
}
