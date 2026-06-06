import Image from 'next/image';
import ScrollReveal from '@/components/ui/ScrollReveal';
import styles from './ProfileGallery.module.css';

export default function ProfileGallery({ talent }) {
  if (!talent.gallery || talent.gallery.length === 0) return null;

  return (
    <section className={`${styles.section} section`} aria-label="גלריה">
      <div className={styles.grid}>
        {talent.gallery.map((img, i) => {
          /* Accept both plain string paths and { src, alt } objects */
          const src = typeof img === 'string' ? img : img.src;
          const alt = typeof img === 'string'
            ? `${talent.name} — תמונה ${i + 1}`
            : (img.alt || `${talent.name} — תמונה ${i + 1}`);
          return (
            <ScrollReveal key={i} delay={i * 0.07} className={styles.item}>
              <div className={styles.imageWrapper}>
                <Image
                  src={src}
                  alt={alt}
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 50vw, 33vw"
                  className={styles.image}
                />
              </div>
            </ScrollReveal>
          );
        })}
      </div>
    </section>
  );
}
