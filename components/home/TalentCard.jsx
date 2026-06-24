'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import TalentImage from '@/components/ui/TalentImage';
import { siteConfig } from '@/data/site';
import { getLocaleFromPathname, localizeHref } from '@/lib/i18n';
import styles from './TalentCard.module.css';

function getCategoryLabel(categories) {
  const cat = siteConfig.categories.find((c) => categories.includes(c.key) && c.key !== 'all');
  return cat?.label ?? '';
}

export default function TalentCard({ talent, className = '', aspectRatio = '2/3', onOpen }) {
  const imageSrc = talent.profileImage || null;
  /* Keep the current locale when navigating from a roster card to the
     individual profile page: on /en/talent this must link to
     /en/talent/[slug], on Hebrew it stays /talent/[slug] (unchanged). */
  const pathname = usePathname() || '/';
  const locale   = getLocaleFromPathname(pathname);
  const isEnglish = locale === 'en';
  const profileHref = localizeHref(`/talent/${talent.slug}`, locale);
  /* English field may be missing on a given talent — fall back to the
     Hebrew name rather than rendering nothing. */
  const displayName = isEnglish ? (talent.nameEn || talent.name) : talent.name;

  /* If onOpen is provided (roster page), intercept left-click to open modal.
   * The href is kept for SEO, right-click → open in new tab, middle-click. */
  const handleClick = onOpen
    ? (e) => { e.preventDefault(); onOpen(talent); }
    : undefined;

  return (
    <Link
      href={profileHref}
      className={`${styles.card} ${className}`}
      aria-label={isEnglish ? `${displayName} — Talent Profile` : `${displayName} — עמוד כישרון`}
      onClick={handleClick}
    >
      {/* Portrait */}
      <div className={styles.imageWrapper} style={{ aspectRatio }}>
        <TalentImage
          src={imageSrc}
          alt={displayName}
          fallbackIndex={talent.sortOrder}
          sizes="(max-width: 479px) 100vw, (max-width: 1023px) 50vw, 33vw"
          objectPosition={talent.imagePosition || 'center top'}
          className={styles.cardImage}
        />
        <div className={styles.hoverOverlay} aria-hidden="true" />
      </div>

      {/* Text */}
      <div className={styles.info}>
        <p className={styles.name}>{displayName}</p>
        {/* Category hidden for launch — restore when roster filters return.
        <p className={styles.category}>{getCategoryLabel(talent.category)}</p> */}
      </div>
    </Link>
  );
}
