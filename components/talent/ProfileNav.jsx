import Link from 'next/link';
import styles from './ProfileNav.module.css';

export default function ProfileNav({ prev, next }) {
  if (!prev && !next) return null;

  return (
    <nav className={styles.nav} aria-label="ניווט בין כישרונות">
      <div className={`${styles.inner} container`}>
        {/* Previous talent — right side in RTL */}
        <div className={styles.slot}>
          {prev && (
            <Link href={`/talent/${prev.slug}`} className={styles.link} aria-label={`כישרון קודם: ${prev.name}`}>
              <span className={styles.direction} aria-hidden="true">→</span>
              <span className={styles.meta}>
                <span className={styles.label}>הקודם</span>
                <span className={styles.talentName}>{prev.name}</span>
              </span>
            </Link>
          )}
        </div>

        <div className={styles.divider} aria-hidden="true" />

        {/* Next talent — left side in RTL */}
        <div className={`${styles.slot} ${styles.slotNext}`}>
          {next && (
            <Link href={`/talent/${next.slug}`} className={`${styles.link} ${styles.linkNext}`} aria-label={`כישרון הבא: ${next.name}`}>
              <span className={styles.meta}>
                <span className={styles.label}>הבא</span>
                <span className={styles.talentName}>{next.name}</span>
              </span>
              <span className={styles.direction} aria-hidden="true">←</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
