import styles from './PageHeader.module.css';

/*
 * Shared page header — same layout/typography/spacing/divider used by the
 * About and Contact pages. Centralizing it here so other simple pages
 * (Privacy Policy, Accessibility Statement, …) stay visually consistent
 * without re-declaring the same CSS.
 */
export default function PageHeader({ title }) {
  return (
    <div className={styles.pageHeader}>
      <div className="container">
        <h1 className={styles.pageTitle}>{title}</h1>
      </div>
    </div>
  );
}
