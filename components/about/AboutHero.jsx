import { siteConfig } from '@/data/site';
import styles from './AboutHero.module.css';

export default function AboutHero() {
  const { headline, subheadline } = siteConfig.about;

  return (
    <div className={styles.hero}>
      <div className={`${styles.inner} container`}>
        <p className={styles.eyebrow}>{siteConfig.name}</p>
        <h1 className={styles.headline}>{headline}</h1>
        <p className={styles.subheadline}>{subheadline}</p>
      </div>
    </div>
  );
}
