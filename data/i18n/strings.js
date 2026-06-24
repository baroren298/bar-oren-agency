/*
 * UI string dictionary — chrome/navigation copy (Header, Footer,
 * language switcher, skip link) plus the 404 page. This intentionally
 * does NOT cover page content (About bio, talent profiles, contact copy,
 * etc.) — that is a separate phase. Hebrew strings here are verbatim
 * copies of what was previously hardcoded inline in each component, so
 * the Hebrew render stays byte-for-byte identical after wiring
 * components to this file.
 */
export const strings = {
  he: {
    skipLink: 'דלג לתוכן הראשי',
    nav: {
      home: 'דף הבית',
    },
    aria: {
      mainNav: 'ניווט ראשי',
      mobileNav: 'ניווט ראשי — נייד',
      mobileMenu: 'תפריט ניווט',
      openMenu: 'פתח תפריט',
      closeMenu: 'סגור תפריט',
      logoHome: 'Bar Oren Talent Agency — דף הבית',
      footerLinks: 'קישורי footer',
    },
    footer: {
      accessibility: 'נגישות',
      privacyPolicy: 'מדיניות פרטיות',
    },
    languageSwitcher: {
      switchToHebrew: 'עבור לעברית',
      switchToEnglish: 'עבור לאנגלית',
    },
    notFound: {
      title: 'הדף לא נמצא',
      link: 'חזרה לדף הבית',
    },
  },
  en: {
    skipLink: 'Skip to main content',
    nav: {
      home: 'Home',
    },
    aria: {
      mainNav: 'Main navigation',
      mobileNav: 'Main navigation — mobile',
      mobileMenu: 'Navigation menu',
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
      logoHome: 'Bar Oren Talent Agency — Home',
      footerLinks: 'Footer links',
    },
    footer: {
      accessibility: 'Accessibility',
      privacyPolicy: 'Privacy Policy',
    },
    languageSwitcher: {
      switchToHebrew: 'Switch to Hebrew',
      switchToEnglish: 'Switch to English',
    },
    notFound: {
      title: 'Page Not Found',
      link: 'Back to Homepage',
    },
  },
};
