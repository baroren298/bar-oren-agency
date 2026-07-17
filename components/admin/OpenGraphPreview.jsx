/*
 * OpenGraphPreview — Talent SEO + Slug Management sprint.
 *
 * The social-share sibling of SearchResultPreview: a small, calm card
 * showing roughly how the page's link will look when shared on WhatsApp/
 * Facebook (image on top, domain, bold title, description below). Purely
 * illustrative UI — no real Open Graph scraping, no external calls.
 *
 * Graceful fallbacks (the sprint's smart defaults, applied by the CALLER —
 * SeoEditor resolves proposed value → smart default before passing props,
 * so this component stays a dumb renderer):
 *   - no image  → a quiet placeholder block with an explanatory line
 *   - no title / no description → the same "(אין ... עדיין)" copy the
 *     Google preview already uses
 *
 * Entity-agnostic, same reasoning as SearchResultPreview: knows nothing
 * about "talent," only an image/title/description/url to render.
 *
 * Props:
 *   - imageUrl (string|null)
 *   - title (string|null)
 *   - description (string|null)
 *   - url (string, optional) — display-only domain/URL line
 */

import styles from "./OpenGraphPreview.module.css";
import { he } from "@/lib/admin/i18n/he";

export default function OpenGraphPreview({ imageUrl, title, description, url = "baroren.co.il" }) {
  return (
    <div className={styles.card} aria-label={he.seo.ogPreview.title}>
      <div className={styles.header}>
        <span className={styles.label}>{he.seo.ogPreview.title}</span>
        <span className={styles.subtitle}>{he.seo.ogPreview.subtitle}</span>
      </div>

      <div className={styles.shareCard}>
        {imageUrl ? (
          // Plain <img>, not next/image: this is an admin-only, illustrative
          // preview of an arbitrary (possibly external) URL — no remote-
          // domain allowlisting or optimization pipeline should apply.
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.image} src={imageUrl} alt="" />
        ) : (
          <div className={styles.imagePlaceholder}>{he.seo.ogPreview.noImage}</div>
        )}
        <div className={styles.body}>
          <span className={styles.url} dir="ltr">
            {url}
          </span>
          <span className={styles.title}>{title?.trim() || he.seo.preview.untitled}</span>
          <span className={styles.description}>
            {description?.trim() || he.seo.preview.noDescription}
          </span>
        </div>
      </div>
    </div>
  );
}
