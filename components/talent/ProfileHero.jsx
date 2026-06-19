import TalentImage from '@/components/ui/TalentImage';
import { siteConfig } from '@/data/site';
import { getAge } from '@/data/talent';
import styles from './ProfileHero.module.css';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function getCategories(categories) {
  return siteConfig.categories
    .filter((c) => categories.includes(c.key) && c.key !== 'all')
    .map((c) => c.label)
    .join(' · ');
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

function LocationIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function YouTubeIcon() {
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
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
      <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" />
    </svg>
  );
}

/* ── Component ───────────────────────────────────────────────────────────── */

export default function ProfileHero({ talent }) {
  const categoryLine = getCategories(talent.category);
  const hasSocials   = talent.instagram || talent.tiktok || talent.youtube || talent.extraSocials?.length > 0;
  const age          = getAge(talent.birthDate);
  const hasMeta       = Boolean(talent.location) || age !== null;

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

          {hasMeta && (
            <div className={styles.meta} aria-label="פרטים">
              {talent.location && (
                <span className={styles.metaItem}>
                  <LocationIcon />
                  {talent.location}
                </span>
              )}
              {age !== null && (
                <span className={styles.metaItem}>
                  <CalendarIcon />
                  {age}
                </span>
              )}
            </div>
          )}

          {talent.bioHe && (
            <p className={styles.excerpt}>{talent.bioHe}</p>
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
              {talent.youtube && (
                <a
                  href={talent.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  aria-label="YouTube"
                >
                  <YouTubeIcon />
                </a>
              )}
              {talent.extraSocials?.map((s, i) => (
                <div key={`extra-${i}`} className={styles.socialLinkItem}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.socialLink}
                    aria-label={s.displayLabel ? `${s.label} — ${s.displayLabel}` : s.label}
                  >
                    {s.label === 'TikTok'   ? <TikTokIcon />   :
                     s.label === 'YouTube'  ? <YouTubeIcon />  :
                                              <InstagramIcon />}
                  </a>
                  {s.displayLabel && (
                    <span className={styles.socialDisplayLabel}>{s.displayLabel}</span>
                  )}
                </div>
              ))}
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
