import Image from 'next/image';
import Link from 'next/link';
import { siteConfig } from '@/data/site';
import styles from './Footer.module.css';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.copy}>
          © {siteConfig.agencyName} {year}
        </span>

        <nav className={styles.links} aria-label="קישורי footer">
          <Link href={siteConfig.contact.instagram} target="_blank" rel="noopener noreferrer" className={styles.link}>
            Instagram
          </Link>
          <span className={styles.dot} aria-hidden="true">·</span>
          <Link href="/accessibility" className={styles.link}>
            נגישות
          </Link>
          <span className={styles.dot} aria-hidden="true">·</span>
          <Link href="/privacy-policy" className={styles.link}>
            מדיניות פרטיות
          </Link>
          <span className={styles.dot} aria-hidden="true">·</span>
          <Link href={`mailto:${siteConfig.contact.email}`} className={styles.link}>
            {siteConfig.contact.email}
          </Link>
        </nav>

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
      </div>
    </footer>
  );
}
