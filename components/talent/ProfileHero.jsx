import TalentImage from '@/components/ui/TalentImage';
import { siteConfig } from '@/data/site';
import styles from './ProfileHero.module.css';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function getCategories(categories) {
  return siteConfig.categories
    .filter((c) => categories.includes(c.key) && c.key !== 'all')
    .map((c) => c.label)
    .join(' · ');
}

/** First sentence only — full bio lives in ProfileBio below. */
function getExcerpt(text) {
  if (!text) return '';
  const dot = text.indexOf('.');
  if (dot > 0) return text.slice(0, dot + 1);
  if (text.length <= 110) return text;
  const cut = text.slice(0, 110);
  return cut.slice(0, cut.lastIndexOf(' ')) + '…';
}

/* ── Icons ───────────────────────────────────────────────────────────────── */

function InstagramIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" strokeWidth="2.5" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M16.6 5.82a4.28 4.28 0 0 1-2.9-1.08V15.28a5.74 5.74 0 0 1-5.74 5.74 5.74 5.74 0 0 1-5.74-5.74 5.74 5.74 0 0 1 5.74-5.74c.27 0 .53.02.79.06v3.1a2.59 2.59 0 0 0-.79-.1 2.59 2.59 0 0 0-2.59 2.59 2.59 2.59 0 0 0 2.59 2.59 2.59 2.59 0 0 0 2.59-2.5V3h3.09a4.28 4.28 0 0 0 2.96 2.82V10a7.34 7.34 0 0 1-4.3-1.37v6.6a5.74 5.74 0 0 1-5.74 5.74V10a7.34 7.34 0 0 0 7.34-7.34h.7v3.16z" />
    </svg>
  );
}

/* ── Component ───────────────────────────────────────────────────────────── */

export default function ProfileHero({ talent }) {
  const categoryLine = getCategories(talent.category);
  const excerpt      = getExcerpt(talent.bioHe);
  const hasSocials   = talent.instagram || talent.tiktok;

  return (
    <section
      className={styles.hero}
      aria-label={`${talent.name} — פרופיל`}
    >
      <div className={styles.inner}>

        {/* ── Content column — right in RTL ──────────────────────────── */}
        <div className={styles.content}>
          {/* Category label hidden for launch — data/logic kept for future
              filter reactivation. Re-enable by uncommenting the block below.
          {categoryLine && (
            <p className={styles.categoryLabel}>{categoryLine}</p>
          )} */}

          <h1 className={styles.name}>{talent.name}</h1>

          {excerpt && (
            <p className={styles.excerpt}>{excerpt}</p>
          )}

          {hasSocials && (
            <div className={styles.socials} aria-label="רשתות חברתיות">
              {talent.instagram && (
                <a
                  href={talent.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  aria-label="Instagram"
                >
                  <InstagramIcon />
                </a>
              )}
              {talent.tiktok && (
                <a
                  href={talent.tiktok}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  aria-label="TikTok"
                >
                  <TikTokIcon />
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── Image column — left in RTL ──────────────────────────────── */}
        <div className={styles.imageCol}>
          <TalentImage
            src={talent.profileImage || null}
            alt={talent.name}
            fallbackIndex={talent.sortOrder}
            priority
            sizes="(max-width: 768px) 90vw, 44vw"
            objectPosition="center top"
            className={styles.image}
          />
        </div>

      </div>
    </section>
  );
}
