import Link from 'next/link';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <div className={styles.page}>
      <div className="container">
        <p className={styles.code}>404</p>
        <h1 className={styles.title}>הדף לא נמצא</h1>
        <Link href="/" className={styles.link}>
          חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
}
