import Link from 'next/link';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { siteConfig } from '@/data/site';
import styles from './CategoryNav.module.css';

export default function CategoryNav() {
  return (
    <section className={styles.section} aria-label="קטגוריות">
      <div className={`${styles.inner} container`}>
        <ScrollReveal>
          <nav aria-label="ניווט לפי קטגוריה">
            <ul className={styles.list}>
              {siteConfig.categories.map((cat, index) => (
                <li key={cat.key} className={styles.item}>
                  <Link
                    href={cat.key === 'all' ? '/talent' : `/talent?category=${cat.key}`}
                    className={styles.link}
                  >
                    {cat.label}
                  </Link>
                  {index < siteConfig.categories.length - 1 && (
                    <span className={styles.divider} aria-hidden="true">·</span>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </ScrollReveal>
      </div>
    </section>
  );
}
