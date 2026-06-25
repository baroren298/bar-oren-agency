'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { siteConfig } from '@/data/site';
import { getLocaleFromPathname, getStrings, homeHref, localizeHref } from '@/lib/i18n';
import styles from './Footer.module.css';

export default function Footer() {
  const year = new Date().getFullYear();
  const pathname = usePathname() || '/';
  const locale = getLocaleFromPathname(pathname);
  const t = getStrings(locale);
  /* Mobile footer direction is locale-aware: Hebrew keeps its existing
     direction: rtl (unchanged), English gets direction: ltr instead.
     Desktop is untouched — its direction: ltr is already unconditional. */
  const innerClassName = locale === 'en'
    ? `${styles.inner} ${styles.englishLayout}`
    : styles.inner;

  return (
    <footer className={styles.footer}>
      <div className={innerClassName}>
        <span className={styles.copy}>
          © {siteConfig.agencyName} {year}
        </span>

        <nav className={styles.links} aria-label={t.aria.footerLinks}>
          <Link href={`mailto:${siteConfig.contact.email}`} className={styles.link}>
            {siteConfig.contact.email}
          </Link>
          <span className={styles.dot} aria-hidden="true">·</span>
          <Link href={siteConfig.contact.instagram} target="_blank" rel="noopener noreferrer" className={styles.link}>
            Instagram
          </Link>
          <span className={styles.dot} aria-hidden="true">·</span>
          <Link href={localizeHref('/accessibility', locale)} className={styles.link}>
            {t.footer.accessibility}
          </Link>
          <span className={styles.dot} aria-hidden="true">·</span>
          <Link href={localizeHref('/privacy-policy', locale)} className={styles.link}>
            {t.footer.privacyPolicy}
          </Link>
        </nav>

        <div className={styles.wordmark}>
          <Link href={homeHref(locale)} aria-label={t.aria.logoHome}>
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
