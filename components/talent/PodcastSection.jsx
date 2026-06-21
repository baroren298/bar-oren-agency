import Image from 'next/image';
import ScrollReveal from '@/components/ui/ScrollReveal';
import styles from './PodcastSection.module.css';

/*
 * PodcastSection — reusable, data-driven podcast block for talent profiles.
 *
 * Renders only when talent.podcast exists, so it has zero effect on any
 * profile that doesn't define a `podcast` object in data/talent/index.js.
 *
 * Expected shape:
 *   podcast: {
 *     title:          string,
 *     description:    string,   // \n separates paragraphs
 *     image:          string,   // path relative to /public
 *     videoEmbedUrl:  string | null,  // manually configured YouTube embed URL
 *   }
 */
export default function PodcastSection({ talent }) {
  const { podcast } = talent;
  if (!podcast) return null;

  return (
    <section className={`${styles.section} section`} aria-label="הפודקאסט">
      <div className={`${styles.inner} container`}>
        <ScrollReveal>
          <h2 className={styles.heading}>הפודקאסט של {talent.name.split(' ')[0]}</h2>
        </ScrollReveal>

        <div className={styles.row}>
          {/* ── Podcast title — right in RTL desktop; between section title
                 and artwork on mobile ───────────────────────────────────── */}
          <ScrollReveal delay={0.05} className={styles.titleCell}>
            <p className={styles.podcastTitle}>{podcast.title}</p>
          </ScrollReveal>

          {/* ── Artwork — left in RTL desktop; right after the section
                 title on mobile ───────────────────────────────────────────── */}
          {podcast.image && (
            <ScrollReveal delay={0.05} className={styles.imageCell}>
              <div className={styles.imageWrapper}>
                <Image
                  src={podcast.image}
                  alt={podcast.title || 'הפודקאסט'}
                  fill
                  sizes="160px"
                  className={styles.image}
                />
              </div>
            </ScrollReveal>
          )}

          {/* ── Description — right in RTL desktop; last on mobile ──────── */}
          {podcast.description && (
            <ScrollReveal delay={0.1} className={styles.descCell}>
              <p className={styles.paragraph}>{podcast.description}</p>
            </ScrollReveal>
          )}
        </div>

        {/* ── Embedded video ─────────────────────────────────────────────── */}
        {podcast.videoEmbedUrl && (
          <ScrollReveal delay={0.1} className={styles.videoCell}>
            <div className={styles.videoWrapper}>
              <iframe
                src={podcast.videoEmbedUrl}
                title={podcast.title || 'הפודקאסט'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
                className={styles.video}
              />
            </div>
          </ScrollReveal>
        )}
      </div>
    </section>
  );
}
