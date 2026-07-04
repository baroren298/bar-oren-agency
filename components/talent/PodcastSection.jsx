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

/*
 * Security (pre-merge hardening, audit finding S2): `videoEmbedUrl` can
 * originate from admin-entered DB content (TalentVersion.podcastVideoEmbedUrl,
 * which the proposal flow deliberately never validates on save) and is
 * rendered straight into an <iframe src>. Guard at render time — so legacy
 * static data is covered too — and only render the iframe for URLs that:
 *   - parse successfully,
 *   - use https:, and
 *   - point at a known YouTube embed host.
 * Anything else renders no iframe at all (fail closed, page otherwise
 * unaffected).
 */
const ALLOWED_EMBED_HOSTS = new Set(['www.youtube.com', 'www.youtube-nocookie.com']);

function getSafeEmbedUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (!ALLOWED_EMBED_HOSTS.has(parsed.hostname)) return null;
  return parsed.href;
}

export default function PodcastSection({ talent, locale = 'he' }) {
  const { podcast } = talent;
  if (!podcast) return null;

  const isEnglish = locale === 'en';
  const fallbackLabel = isEnglish ? 'The Podcast' : 'הפודקאסט';
  /* Show title is the same proper noun in both locales (do not translate).
     Description has no English field in the data yet for any current
     talent — fall back to the Hebrew copy rather than hiding the section. */
  const title       = podcast.title;
  const description = isEnglish ? (podcast.descriptionEn || podcast.description) : podcast.description;
  const safeEmbedUrl = getSafeEmbedUrl(podcast.videoEmbedUrl);

  return (
    <section className={`${styles.section} section`} aria-label={fallbackLabel}>
      <div className={`${styles.inner} container`}>
        <div className={styles.row}>
          {/* ── Podcast title — right in RTL desktop; after the artwork
                 on mobile ──────────────────────────────────────────────── */}
          <ScrollReveal delay={0.05} className={styles.titleCell}>
            <p className={styles.podcastTitle}>{title}</p>
          </ScrollReveal>

          {/* ── Artwork — left in RTL desktop; opens the section on mobile,
                 acting as its visual introduction ─────────────────────────── */}
          {podcast.image && (
            <ScrollReveal delay={0.05} className={styles.imageCell}>
              <div className={styles.imageWrapper}>
                <Image
                  src={podcast.image}
                  alt={title || fallbackLabel}
                  fill
                  sizes="160px"
                  className={styles.image}
                />
              </div>
            </ScrollReveal>
          )}

          {/* ── Description — right in RTL desktop; last on mobile ──────── */}
          {description && (
            <ScrollReveal delay={0.1} className={styles.descCell}>
              <p className={styles.paragraph}>{description}</p>
            </ScrollReveal>
          )}
        </div>

        {/* ── Embedded video ─────────────────────────────────────────────── */}
        {safeEmbedUrl && (
          <ScrollReveal delay={0.1} className={styles.videoCell}>
            <div className={styles.videoWrapper}>
              <iframe
                src={safeEmbedUrl}
                title={title || fallbackLabel}
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
