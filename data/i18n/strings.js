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
      whatsapp: 'שליחת הודעה בוואטסאפ',
      scrollToTop: 'חזרה לראש העמוד',
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
    contact: {
      sectionLabel: 'יצירת קשר',
      form: {
        ariaLabel: 'טופס יצירת קשר',
        labels: {
          name: 'שם מלא',
          email: 'אימייל',
          phone: 'טלפון',
          message: 'הודעה',
        },
        placeholders: {
          name: 'ישראל ישראלי',
          email: 'name@example.com',
          phone: '050-000-0000',
          message: 'ספרו לנו במה אתם מעוניינים...',
        },
        consent: {
          prefix: 'אני מאשר/ת את',
          linkText: 'מדיניות הפרטיות',
          suffix: 'של האתר ומסכים/ה להעברת פרטיי לצורך יצירת קשר.',
        },
        submit: 'שלחו הודעה',
        submitting: 'שולח...',
        success: {
          title: 'ההודעה נשלחה.',
          body: 'בר אורן ייצור איתכם קשר בהקדם.',
        },
        errors: {
          name: 'נא להזין שם מלא',
          email: 'נא להזין כתובת אימייל',
          emailInvalid: 'כתובת אימייל לא תקינה',
          phone: 'נא להזין מספר טלפון',
          message: 'נא להזין הודעה',
          consent: 'יש לאשר את מדיניות הפרטיות לפני שליחת הטופס.',
          network: 'אירעה שגיאה. אנא נסו שוב.',
          server: 'אירעה שגיאה. אנא נסו שוב או צרו קשר ישירות.',
        },
      },
      info: {
        emailLabel: 'אימייל',
        phoneLabel: 'טלפון',
        locationLabel: 'מיקום',
        followLabel: 'עקבו אחרינו',
        emailAriaPrefix: 'שלח אימייל ל-',
        phoneAriaPrefix: 'התקשר ל-',
        socialAriaSuffix: '— בר אורן',
      },
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
      whatsapp: 'Send a WhatsApp message',
      scrollToTop: 'Back to top',
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
    contact: {
      sectionLabel: 'Contact',
      form: {
        ariaLabel: 'Contact form',
        labels: {
          name: 'Full Name',
          email: 'Email',
          phone: 'Phone',
          message: 'Message',
        },
        placeholders: {
          name: 'John Smith',
          email: 'name@example.com',
          phone: '050-000-0000',
          message: "Tell us what you're interested in...",
        },
        consent: {
          prefix: 'I agree to the',
          linkText: 'Privacy Policy',
          suffix: 'and consent to my details being used to respond to this inquiry.',
        },
        submit: 'Send Message',
        submitting: 'Sending...',
        success: {
          title: 'Message sent.',
          body: 'Bar Oren will get back to you shortly.',
        },
        errors: {
          name: 'Please enter your full name',
          email: 'Please enter your email address',
          emailInvalid: 'Please enter a valid email address',
          phone: 'Please enter your phone number',
          message: 'Please enter a message',
          consent: 'Please accept the privacy policy before submitting the form.',
          network: 'Something went wrong. Please try again.',
          server: 'Something went wrong. Please try again or contact us directly.',
        },
      },
      info: {
        emailLabel: 'Email',
        phoneLabel: 'Phone',
        locationLabel: 'Location',
        followLabel: 'Follow Us',
        emailAriaPrefix: 'Send an email to ',
        phoneAriaPrefix: 'Call ',
        socialAriaSuffix: '— Bar Oren',
      },
    },
  },
};
