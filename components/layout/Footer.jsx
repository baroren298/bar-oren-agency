import Image from 'next/image';
import Link from 'next/link';
import { siteConfig } from '@/data/site';
import styles from './Footer.module.css';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.wordmark}>
          <Link href="/" aria-label="Bar Oren Talent Agency — דף הבית">
            <Image
              src="/images/brand/logo3.png"
              alt="Bar Oren Talent Agency"
              width={600}
              height={240}
              className={styles.logo}
            />
          </Link>
        </div>

        <nav className={styles.links} aria-label="קישורי footer">
          <Link href={siteConfig.contact.instagram} target="_blank" rel="noopener noreferrer" className={styles.link}>
            Instagram
          </Link>
          <span className={styles.dot} aria-hidden="true">·</span>
          <Link href={`mailto:${siteConfig.contact.email}`} className={styles.link}>
            {siteConfig.contact.email}
          </Link>
        </nav>

        <p className={styles.copy}>
          © {year} {siteConfig.agencyName}
        </p>
      </div>

      <div className={styles.legalRow}>
        <Link href="/accessibility" className={styles.legalLink}>
          נגישות
        </Link>
        <Link href="/privacy-policy" className={styles.legalLink}>
          מדיניות פרטיות
        </Link>
      </div>
    </footer>
  );
}
