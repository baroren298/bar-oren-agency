'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { siteConfig } from '@/data/site';
import { getLocaleFromPathname, getStrings, homeHref, localizeHref } from '@/lib/i18n';
import LanguageSwitcher from './LanguageSwitcher';
import styles from './Header.module.css';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname   = usePathname();
  const toggleRef    = useRef(null);
  const firstLinkRef = useRef(null);
  const menuMounted  = useRef(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  /* ESC closes the mobile menu */
  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [menuOpen]);

  /* Auto-focus first nav link when menu opens; restore focus to toggle on close */
  useEffect(() => {
    if (!menuMounted.current) { menuMounted.current = true; return; }
    if (menuOpen) {
      firstLinkRef.current?.focus();
    } else {
      toggleRef.current?.focus();
    }
  }, [menuOpen]);

  const locale = getLocaleFromPathname(pathname);
  const t = getStrings(locale);
  const home = homeHref(locale);
  const isHome = pathname === home;

  const handleLogoClick = (e) => {
    if (!isHome) return;            // other pages: let Link navigate normally
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ''} ${isHome ? styles.onHero : ''}`}>
      <div className={styles.inner}>
        <div className={styles.logoGroup}>
          <Link href={home} className={styles.wordmark} aria-label={t.aria.logoHome} onClick={handleLogoClick}>
            <Image
              src="/images/brand/logo3.png"
              alt="Bar Oren Talent Agency"
              width={600}
              height={240}
              priority
              className={styles.logo}
            />
          </Link>
          <LanguageSwitcher />
        </div>

        <nav className={styles.nav} aria-label={t.aria.mainNav}>
          <ul className={styles.navList}>
            {/* Home — active only on exact home path so /talent doesn't light it up */}
            <li>
              <Link
                href={home}
                className={`${styles.navLink} ${pathname === home ? styles.active : ''}`}
              >
                {t.nav.home}
              </Link>
            </li>
            {siteConfig.nav.links.map((link) => {
              const href = localizeHref(link.href, locale);
              return (
                <li key={link.href}>
                  <Link
                    href={href}
                    className={`${styles.navLink} ${pathname.startsWith(href) ? styles.active : ''}`}
                  >
                    {locale === 'he' ? link.label : link.labelEn}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <button
          ref={toggleRef}
          className={`${styles.menuToggle} ${menuOpen ? styles.menuOpen : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? t.aria.closeMenu : t.aria.openMenu}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          type="button"
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>

      {menuOpen && (
        <div id="mobile-menu" className={styles.mobileMenu} aria-label={t.aria.mobileMenu}>
          <nav aria-label={t.aria.mobileNav}>
            <ul className={styles.mobileNavList}>
              {/* Home link — always first, active only on exact home path */}
              <li>
                <Link
                  ref={firstLinkRef}
                  href={home}
                  className={`${styles.mobileNavLink} ${pathname === home ? styles.active : ''}`}
                >
                  {t.nav.home}
                </Link>
              </li>
              {siteConfig.nav.links.map((link) => {
                const href = localizeHref(link.href, locale);
                return (
                  <li key={link.href}>
                    <Link
                      href={href}
                      className={`${styles.mobileNavLink} ${pathname.startsWith(href) ? styles.active : ''}`}
                    >
                      {locale === 'he' ? link.label : link.labelEn}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      )}
    </header>
  );
}
