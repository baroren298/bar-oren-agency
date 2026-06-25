import { siteConfig } from '@/data/site';
import styles from './AboutHero.module.css';

export default function AboutHero({ locale = 'he' }) {
  const isEnglish = locale === 'en';
  const { headline, headlineEn } = siteConfig.about;
  /* Falls back to the Hebrew headline if no English copy has been added
     yet — keeps the page from rendering blank once headlineEn lands. */
  const title = isEnglish ? (headlineEn || headline) : headline;

  return (
    <div className={styles.pageHeader}>
      <div className="container">
        <h1 className={styles.pageTitle}>{title}</h1>
      </div>
    </div>
  );
}
