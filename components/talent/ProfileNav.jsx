import Link from 'next/link';
import { localizeHref } from '@/lib/i18n';
import styles from './ProfileNav.module.css';

export default function ProfileNav({ prev, next, locale = 'he' }) {
  if (!prev && !next) return null;

  /* Arrows point outward from center on both locales: in RTL, prev sits on
     the right (→ points further right) and next sits on the left (← points
     further left). In LTR the slots' physical sides flip (prev left, next
     right), so the glyphs flip too — DOM order/spacing/markup unchanged,
     only which character renders depends on locale. */
  const isEnglish  = locale === 'en';
  const prevArrow  = isEnglish ? '←' : '→';
  const nextArrow  = isEnglish ? '→' : '←';

  return (
    <nav className={styles.nav} aria-label="ניווט בין מיוצגים">
      <div className={`${styles.inner} container`}>
        {/* Previous talent — right side in RTL, left side in LTR */}
        <div className={styles.slot}>
          {prev && (
            <Link href={localizeHref(`/talent/${prev.slug}`, locale)} className={styles.link} aria-label={`מיוצג קודם: ${prev.name}`}>
              <span className={styles.direction} aria-hidden="true">{prevArrow}</span>
              <span className={styles.meta}>
                <span className={styles.label}>הקודם</span>
                <span className={styles.talentName}>{prev.name}</span>
              </span>
            </Link>
          )}
        </div>

        <div className={styles.divider} aria-hidden="true" />

        {/* Next talent — left side in RTL, right side in LTR */}
        <div className={`${styles.slot} ${styles.slotNext}`}>
          {next && (
            <Link href={localizeHref(`/talent/${next.slug}`, locale)} className={`${styles.link} ${styles.linkNext}`} aria-label={`מיוצג הבא: ${next.name}`}>
              <span className={styles.meta}>
                <span className={styles.label}>הבא</span>
                <span className={styles.talentName}>{next.name}</span>
              </span>
              <span className={styles.direction} aria-hidden="true">{nextArrow}</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
