import Image from 'next/image';
import ScrollReveal from '@/components/ui/ScrollReveal';
import styles from './ProfileGallery.module.css';

export default function ProfileGallery({ talent }) {
  if (!talent.gallery || talent.gallery.length === 0) return null;

  return (
    <section className={`${styles.section} section`} aria-label="גלריה">
      <div className={styles.grid}>
        {talent.gallery.map((img, i) => (
          <ScrollReveal key={i} delay={i * 0.07} className={styles.item}>
            <div className={styles.imageWrapper}>
              <Image
                src={img.src}
                alt={img.alt || `${talent.name} — תמונה ${i + 1}`}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                className={styles.image}
              />
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
