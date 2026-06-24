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
  /* English field may be missing on a given talent — fall back to the
     Hebrew name rather than rendering nothing. */
  const prevName   = prev ? (isEnglish ? (prev.nameEn || prev.name) : prev.name) : null;
  const nextName   = next ? (isEnglish ? (next.nameEn || next.name) : next.name) : null;

  return (
    <nav className={styles.nav} aria-label={isEnglish ? 'Talent Navigation' : 'ניווט בין מיוצגים'}>
      <div className={`${styles.inner} container`}>
        {/* Previous talent — right side in RTL, left side in LTR */}
        <div className={styles.slot}>
          {prev && (
            <Link
              href={localizeHref(`/talent/${prev.slug}`, locale)}
              className={styles.link}
              aria-label={isEnglish ? `Previous talent: ${prevName}` : `מיוצג קודם: ${prevName}`}
            >
              <span className={styles.direction} aria-hidden="true">{prevArrow}</span>
              <span className={styles.meta}>
                <span className={styles.label}>{isEnglish ? 'Previous' : 'הקודם'}</span>
                <span className={styles.talentName}>{prevName}</span>
              </span>
            </Link>
          )}
        </div>

        <div className={styles.divider} aria-hidden="true" />

        {/* Next talent — left side in RTL, right side in LTR */}
        <div className={`${styles.slot} ${styles.slotNext}`}>
          {next && (
            <Link
              href={localizeHref(`/talent/${next.slug}`, locale)}
              className={`${styles.link} ${styles.linkNext}`}
              aria-label={isEnglish ? `Next talent: ${nextName}` : `מיוצג הבא: ${nextName}`}
            >
              <span className={styles.meta}>
                <span className={styles.label}>{isEnglish ? 'Next' : 'הבא'}</span>
                <span className={styles.talentName}>{nextName}</span>
              </span>
              <span className={styles.direction} aria-hidden="true">{nextArrow}</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
