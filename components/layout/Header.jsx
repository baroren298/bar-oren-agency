'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { siteConfig } from '@/data/site';
import styles from './Header.module.css';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

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

  const isHome = pathname === '/';

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ''} ${isHome ? styles.onHero : ''}`}>
      <div className={styles.inner}>
        <Link href="/" className={styles.wordmark} aria-label="Bar Oren Talent Agency — דף הבית">
          <span className={styles.name}>{siteConfig.name}</span>
          <span className={styles.agency}>{siteConfig.tagline}</span>
        </Link>

        <nav className={styles.nav} aria-label="ניווט ראשי">
          <ul className={styles.navList}>
            {siteConfig.nav.links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`${styles.navLink} ${pathname.startsWith(link.href) ? styles.active : ''}`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <button
          className={`${styles.menuToggle} ${menuOpen ? styles.menuOpen : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? 'סגור תפריט' : 'פתח תפריט'}
          aria-expanded={menuOpen}
        >
          <span />
          <span />
        </button>
      </div>

      {menuOpen && (
        <div className={styles.mobileMenu} role="dialog" aria-modal="true" aria-label="תפריט ניווט">
          <nav>
            <ul className={styles.mobileNavList}>
              {siteConfig.nav.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`${styles.mobileNavLink} ${pathname.startsWith(link.href) ? styles.active : ''}`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </header>
  );
}
