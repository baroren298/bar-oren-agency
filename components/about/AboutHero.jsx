import { siteConfig } from '@/data/site';
import styles from './AboutHero.module.css';

export default function AboutHero() {
  const { headline } = siteConfig.about;

  return (
    <div className={styles.pageHeader}>
      <div className="container">
        <h1 className={styles.pageTitle}>{headline}</h1>
      </div>
    </div>
  );
}
