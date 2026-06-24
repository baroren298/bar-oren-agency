'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getLocaleFromPathname, getStrings, getAlternatePath } from '@/lib/i18n';
import styles from './LanguageSwitcher.module.css';

/*
 * Always-visible "HE | EN" switcher, sits next to the logo. The active
 * language is darker/bolder, the inactive one lighter — no border,
 * background, or pill styling, so it reads as brand chrome rather than
 * a UI control. Same markup is used on desktop and mobile (it lives
 * outside the collapsible nav, so no separate mobile variant is needed).
 */
export default function LanguageSwitcher() {
  const pathname = usePathname() || '/';
  const locale = getLocaleFromPathname(pathname);
  const t = getStrings(locale);
  const otherPath = getAlternatePath(pathname);
  const hePath = locale === 'he' ? pathname : otherPath;
  const enPath = locale === 'en' ? pathname : otherPath;

  return (
    <div className={styles.switcher}>
      <Link
        href={hePath}
        className={locale === 'he' ? styles.active : styles.inactive}
        aria-current={locale === 'he' ? 'true' : undefined}
        aria-label={t.languageSwitcher.switchToHebrew}
        hrefLang="he"
      >
        HE
      </Link>
      <span className={styles.divider} aria-hidden="true">|</span>
      <Link
        href={enPath}
        className={locale === 'en' ? styles.active : styles.inactive}
        aria-current={locale === 'en' ? 'true' : undefined}
        aria-label={t.languageSwitcher.switchToEnglish}
        hrefLang="en"
      >
        EN
      </Link>
    </div>
  );
}
