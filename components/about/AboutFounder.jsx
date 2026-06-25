import Image from 'next/image';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { siteConfig } from '@/data/site';
import styles from './AboutFounder.module.css';

export default function AboutFounder({ locale = 'he' }) {
  const isEnglish = locale === 'en';
  const { founder } = siteConfig.about;
  /* Each field falls back to its Hebrew value if the English copy hasn't
     been added to data/site.js yet — keeps the alt text from rendering
     blank, or the paragraph map from breaking, once founder.nameEn /
     bioEn land. (founder.title isn't rendered here, same as before.) */
  const name = isEnglish ? (founder.nameEn || founder.name) : founder.name;
  const bio  = isEnglish ? (founder.bioEn  || founder.bio)  : founder.bio;

  return (
    <section className={`${styles.section} section`} aria-label={isEnglish ? 'The Founder' : 'המייסד'}>
      <div className={`${styles.inner} container`}>

        {/* Founder portrait — shared image across both locales */}
        {founder.image && (
          <ScrollReveal className={styles.imageCell}>
            <div className={styles.imageWrapper}>
              <Image
                src={founder.image}
                alt={name}
                fill
                sizes="(max-width: 860px) 100vw, 480px"
                className={styles.image}
              />
            </div>
          </ScrollReveal>
        )}

        {/* Text block */}
        <div className={`${styles.textCell} ${!founder.image ? styles.textCellFull : ''}`}>
          <div className={styles.bio}>
            {bio.map((paragraph, i) => (
              <ScrollReveal key={i} delay={0.06 + i * 0.05}>
                <p
                  className={
                    i === 0
                      ? styles.leadParagraph
                      : i === bio.length - 1
                      ? styles.closingParagraph
                      : styles.paragraph
                  }
                >
                  {paragraph}
                </p>
              </ScrollReveal>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
