/*
 * SearchResultPreview — SEO Editor Foundation sprint.
 *
 * A small, calm card showing roughly how the proposed SEO title/description
 * might look as a Google search result. Purely illustrative UI — no real
 * SEO scoring, no keyword analysis, no external API calls, no character
 * limit enforcement. It exists to make the abstract "SEO title/description"
 * fields concrete for an employee who has never thought about how Google
 * renders them, per this sprint's "the employee should understand what
 * Google/social platforms may show" goal.
 *
 * Entity-agnostic, same reasoning as SeoFieldRow: this component knows
 * nothing about "talent" specifically, only a title/description/url to
 * render, so it's reusable unchanged for any other page's SEO editor later.
 *
 * Props:
 *   - title (string|null) — proposed SEO title
 *   - description (string|null) — proposed SEO description
 *   - url (string, optional) — display-only URL shown above the title,
 *     defaults to a generic placeholder domain since no real page URL
 *     exists yet for unpublished content
 */

import styles from "./SearchResultPreview.module.css";
import { he } from "@/lib/admin/i18n/he";

export default function SearchResultPreview({ title, description, url = "baroren-agency.co.il" }) {
  return (
    <div className={styles.card} aria-label={he.seo.preview.title}>
      <div className={styles.header}>
        <span className={styles.label}>{he.seo.preview.title}</span>
        <span className={styles.subtitle}>{he.seo.preview.subtitle}</span>
      </div>

      <div className={styles.resultCard}>
        <span className={styles.resultUrl}>{url}</span>
        <span className={styles.resultTitle}>{title?.trim() || he.seo.preview.untitled}</span>
        <span className={styles.resultDescription}>
          {description?.trim() || he.seo.preview.noDescription}
        </span>
      </div>
    </div>
  );
}
