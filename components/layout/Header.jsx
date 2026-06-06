'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { siteConfig } from '@/data/site';
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

  const isHome = pathname === '/';

  const handleLogoClick = (e) => {
    if (!isHome) return;            // other pages: let Link navigate normally
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ''} ${isHome ? styles.onHero : ''}`}>
      <div className={styles.inner}>
        <Link href="/" className={styles.wordmark} aria-label="Bar Oren Talent Agency — דף הבית" onClick={handleLogoClick}>
          <Image
            src="/images/brand/logo3.png"
            alt="Bar Oren Talent Agency"
            width={600}
            height={240}
            priority
            className={styles.logo}
          />
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
          ref={toggleRef}
          className={`${styles.menuToggle} ${menuOpen ? styles.menuOpen : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? 'סגור תפריט' : 'פתח תפריט'}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          type="button"
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>

      {menuOpen && (
        <div id="mobile-menu" className={styles.mobileMenu} aria-label="תפריט ניווט">
          <nav aria-label="ניווט ראשי — נייד">
            <ul className={styles.mobileNavList}>
              {siteConfig.nav.links.map((link, i) => (
                <li key={link.href}>
                  <Link
                    ref={i === 0 ? firstLinkRef : undefined}
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
