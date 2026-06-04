'use client';

import { siteConfig } from '@/data/site';
import styles from './CategoryFilter.module.css';

export default function CategoryFilter({ selected, onChange }) {
  return (
    <nav className={styles.nav} aria-label="סינון לפי קטגוריה">
      <ul className={styles.list}>
        {siteConfig.categories.map((cat) => {
          const isActive = selected === cat.key;
          return (
            <li key={cat.key}>
              <button
                className={`${styles.btn} ${isActive ? styles.active : ''}`}
                onClick={() => onChange(cat.key)}
                aria-pressed={isActive}
                aria-label={`הצג ${cat.label}`}
              >
                {cat.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
