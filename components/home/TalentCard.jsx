'use client';

import Link from 'next/link';
import TalentImage from '@/components/ui/TalentImage';
import { siteConfig } from '@/data/site';
import styles from './TalentCard.module.css';

function getCategoryLabel(categories) {
  const cat = siteConfig.categories.find((c) => categories.includes(c.key) && c.key !== 'all');
  return cat?.label ?? '';
}

export default function TalentCard({ talent, className = '', aspectRatio = '2/3', onOpen }) {
  const imageSrc = talent.profileImage || null;

  /* If onOpen is provided (roster page), intercept left-click to open modal.
   * The href is kept for SEO, right-click → open in new tab, middle-click. */
  const handleClick = onOpen
    ? (e) => { e.preventDefault(); onOpen(talent); }
    : undefined;

  return (
    <Link
      href={`/talent/${talent.slug}`}
      className={`${styles.card} ${className}`}
      aria-label={`${talent.name} — עמוד כישרון`}
      onClick={handleClick}
    >
      {/* Portrait */}
      <div className={styles.imageWrapper} style={{ aspectRatio }}>
        <TalentImage
          src={imageSrc}
          alt={talent.name}
          fallbackIndex={talent.sortOrder}
          sizes="(max-width: 479px) 100vw, (max-width: 1023px) 50vw, 33vw"
          objectPosition={talent.imagePosition || 'center top'}
          className={styles.cardImage}
        />
        <div className={styles.hoverOverlay} aria-hidden="true" />
      </div>

      {/* Text */}
      <div className={styles.info}>
        <p className={styles.name}>{talent.name}</p>
        {/* Category hidden for launch — restore when roster filters return.
        <p className={styles.category}>{getCategoryLabel(talent.category)}</p> */}
      </div>
    </Link>
  );
}
