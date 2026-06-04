import TalentImage from '@/components/ui/TalentImage';
import { siteConfig } from '@/data/site';
import styles from './ProfileHero.module.css';

function getCategoryLabel(categories) {
  const cat = siteConfig.categories.find((c) => categories.includes(c.key) && c.key !== 'all');
  return cat?.label ?? '';
}

export default function ProfileHero({ talent }) {
  return (
    <section className={styles.hero} aria-label={`${talent.name} — תמונת פרופיל`}>
      {/* Background — TalentImage fills the absolute container */}
      <div className={styles.bg}>
        <TalentImage
          src={talent.heroImage || talent.profileImage || null}
          alt={talent.name}
          fallbackIndex={talent.sortOrder}
          priority
          sizes="100vw"
          objectPosition="center top"
          className={styles.bgImage}
        />
        <div className={styles.overlay} aria-hidden="true" />
      </div>

      {/* Name block — anchored to bottom of hero */}
      <div className={styles.inner}>
        <div className={styles.nameBlock}>
          <p className={styles.categoryLabel}>{getCategoryLabel(talent.category)}</p>
          <h1 className={styles.name}>{talent.name}</h1>
        </div>
      </div>
    </section>
  );
}
