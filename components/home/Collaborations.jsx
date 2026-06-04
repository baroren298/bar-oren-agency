import ScrollReveal from '@/components/ui/ScrollReveal';
import { siteConfig } from '@/data/site';
import styles from './Collaborations.module.css';

export default function Collaborations({ brands = [] }) {
  if (brands.length === 0) return null;

  return (
    <section className={`${styles.section} section`} aria-label="שיתופי פעולה נבחרים">
      <div className={`${styles.inner} container`}>
        <ScrollReveal>
          <p className={styles.label}>{siteConfig.homepage.collaborationsTitle}</p>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <ul className={styles.brandList} aria-label="מותגים ושותפים">
            {brands.map((brand, i) => (
              <li key={i} className={styles.brandItem}>
                <span className={styles.brand}>{brand}</span>
                {i < brands.length - 1 && (
                  <span className={styles.dot} aria-hidden="true">·</span>
                )}
              </li>
            ))}
          </ul>
        </ScrollReveal>
      </div>
    </section>
  );
}
