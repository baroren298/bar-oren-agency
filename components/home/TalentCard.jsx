'use client';

import Link from 'next/link';
import TalentImage from '@/components/ui/TalentImage';
import { siteConfig } from '@/data/site';
import styles from './TalentCard.module.css';

function getCategoryLabel(categories) {
  const cat = siteConfig.categories.find((c) => categories.includes(c.key) && c.key !== 'all');
  return cat?.label ?? '';
}

export default function TalentCard({ talent, className = '', aspectRatio = '2/3' }) {
  /* Prefer the square-ish profile crop; fall back to hero if only one exists */
  const imageSrc = talent.profileImage || talent.heroImage || null;

  return (
    <Link
      href={`/talent/${talent.slug}`}
      className={`${styles.card} ${className}`}
      aria-label={`${talent.name} — עמוד כישרון`}
    >
      {/* Portrait */}
      <div className={styles.imageWrapper} style={{ aspectRatio }}>
        <TalentImage
          src={imageSrc}
          alt={talent.name}
          fallbackIndex={talent.sortOrder}
          sizes="(max-width: 479px) 100vw, (max-width: 1023px) 50vw, 33vw"
          className={styles.cardImage}
        />
        <div className={styles.hoverOverlay} aria-hidden="true" />
      </div>

      {/* Text */}
      <div className={styles.info}>
        <p className={styles.name}>{talent.name}</p>
        <p className={styles.category}>{getCategoryLabel(talent.category)}</p>
      </div>
    </Link>
  );
}
