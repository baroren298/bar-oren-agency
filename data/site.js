export const siteConfig = {
  name: 'Bar Oren',
  agencyName: 'Bar Oren Talent Agency',
  tagline: 'Talent Agency',
  descriptor: 'סוכנות בוטיק לייצוג וניהול אישי\nליוצרי תוכן, משפיענים ושחקנים.',
  descriptorEn: 'A boutique agency for personal representation and management for content creators, influencers, and actors.',

  contact: {
    whatsapp: 'https://wa.me/972548311818',
    email: 'bar@baroren.co.il',
    phone: null,
    instagram: 'https://www.instagram.com/barorenagency',
    tiktok: null,
    linkedin: null,
    address: 'תל אביב, ישראל',
    addressEn: 'Tel Aviv, Israel',
  },

  meta: {
    title: 'Bar Oren Talent Agency',
    description: 'סוכנות בוטיק לייצוג וניהול אישי ליוצרי תוכן, משפיענים ושחקנים.',
    descriptionEn: 'A boutique agency offering personal representation and management for content creators, influencers, and actors.',
    keywords: [
      'סוכנות כישרונות',
      'ניהול כישרונות',
      'יוצרי תוכן',
      'משפיענים',
      'talent agency Israel',
      'influencer management',
      'content creator',
    ],
    url: 'https://baroren.co.il',
    locale: 'he_IL',
  },

  nav: {
    links: [
      { label: 'מיוצגים', labelEn: 'Talent', mobileLabelEn: 'Talents', href: '/talent'  },
      { label: 'אודות',    labelEn: 'About',   href: '/about'   },
      { label: 'צור קשר',  labelEn: 'Contact', href: '/contact' },
    ],
  },

  homepage: {
    voiceHeadline: 'כישרון נבחר. ייצוג אישי.',
    voiceHeadlineEn: 'Hand-Picked Talent. Personal Representation.',
    voiceBody: 'אנחנו מייצגים אנשים שאי אפשר להתעלם מהם.',
    voiceBodyEn: 'We represent talent impossible to ignore.',
    featuredTitle: 'מיוצגים',
    featuredTitleEn: 'Our Talents',
    featuredCta: 'לכל המיוצגים',
    featuredCtaEn: 'View All Talents',
    collaborationsTitle: 'שיתופי פעולה נבחרים',
    collaborationsTitleEn: 'Selected Collaborations',
    contactHeadline: 'מעוניינים בשיתוף פעולה?',
    contactHeadlineEn: 'Interested in Working Together?',
    contactBody: 'צרו קשר ישירות עם בר אורן.',
    contactBodyEn: 'Get in touch directly with Bar Oren.',
  },

  talentPage: {
    title: 'מיוצגי הסוכנות',
    titleEn: 'Our Talents',
    description: 'מיוצגים בניהולו האישי של בר אורן — יוצרי תוכן, משפיענים, דוגמנים ושחקנים.',
    descriptionEn: "Talent under Bar Oren's personal management — content creators, influencers, models, and actors.",
  },

  categories: [
    { key: 'all',        label: 'הכל',          labelEn: 'All'              },
    { key: 'content',    label: 'יוצרי תוכן',    labelEn: 'Content Creators' },
    { key: 'influencer', label: 'משפיענים',       labelEn: 'Influencers'      },
    { key: 'model',      label: 'דוגמנות',        labelEn: 'Models'           },
    { key: 'actor',      label: 'שחקנים',         labelEn: 'Actors'           },
  ],

  about: {
    headline: 'אודות הסוכנות',
    headlineEn: 'About the Agency',

    /* SEO / Open Graph — mirrors the pattern used by talentPage/contactPage.
       Hebrew values match what was previously hardcoded directly in
       app/[locale]/about/page.jsx; English values are the approved
       translation from the translation document. */
    metaTitle: 'אודות | Bar Oren Talent Agency',
    metaTitleEn: 'About | Bar Oren Talent Agency',
    ogTitle: 'אודות | Bar Oren',
    ogTitleEn: 'About | Bar Oren',
    metaDescription: 'סוכנות בוטיק לייצוג וניהול אישי ליוצרי תוכן, משפיענים ושחקנים. הכירו את בר אורן ואת הגישה האישית שמובילה את הסוכנות.',
    metaDescriptionEn: 'A boutique agency for personal representation and management of content creators, influencers, and actors. Meet Bar Oren and the personal approach behind the agency.',
    ogAlt: 'Bar Oren Talent Agency — אודות',
    ogAltEn: 'Bar Oren Talent Agency — About',

    founder: {
      name: 'בר אורן',
      /* "Bar Oren" is a proper noun (per translation doc: do not translate) —
         nameEn simply renders it in Latin script for the English locale
         instead of the Hebrew spelling. */
      nameEn: 'Bar Oren',
      title: 'מייסד ומנהל הסוכנות',
      titleEn: 'Founder & Managing Director',
      bio: [
        'היי, אני בר אורן.',
        'הקמתי את הסוכנות מתוך אמונה שייצוג טוב מתחיל קודם כל באנשים. לפני מספרים, לפני צפיות ולפני קמפיינים. חשוב לי להכיר את האדם שמאחורי התוכן, להבין את השאיפות שלו ולבנות יחד דרך שמתאימה לו.',
        'הסוכנות פועלת במודל בוטיק ומייצגת יוצרי תוכן, משפיענים ושחקנים ממגוון תחומים. אני בוחר לעבוד עם מספר מצומצם של מיוצגים, כדי להעניק לכל אחד ואחת ליווי אישי, זמינות מלאה וחשיבה אסטרטגית לטווח ארוך.',
        'העבודה שלי משלבת בין ניהול הזדמנויות מסחריות, בניית מותג אישי ופיתוח קריירה, תוך שמירה על אותנטיות ועל הערכים שהפכו כל מיוצג למה שהוא.',
        'אני מאמין שלא כל שיתוף פעולה הוא שיתוף פעולה נכון, ולא כל הזדמנות היא הזדמנות שכדאי לקחת. לכן הדגש בסוכנות הוא על חיבורים מדויקים, מערכות יחסים ארוכות טווח וצמיחה יציבה לאורך זמן.',
        'הסוכנות שלי היא בית ליוצרים, משפיענים ושחקנים שמחפשים ליווי אישי, מקצועי ואמין עם יחס בגובה העיניים ודרך משותפת שנבנית יחד.',
        'ברוכים הבאים.',
      ],
      /* Approved English translation, pulled verbatim from
         translations-english-draft.docx → "About Page" → "Founder Section". */
      bioEn: [
        "Hi, I'm Bar Oren.",
        'I founded this agency on the belief that great representation starts with people. Before the numbers, before the views, and before the campaigns. I believe in getting to know the person behind the content, understanding their ambitions, and building a path that reflects who they are and where they want to go.',
        'The agency operates as a boutique talent agency, representing content creators, influencers, and actors across a variety of fields. I intentionally work with a select roster of talent to provide each individual with personal guidance, dedicated attention, and long-term strategic support.',
        'My work combines commercial representation, personal brand development, and long-term career growth, while preserving the authenticity and values that make each talent unique.',
        "I believe that not every collaboration is the right fit, and not every opportunity is worth pursuing. That's why I focus on meaningful partnerships, long-term relationships, and sustainable growth.",
        'This agency is a home for creators, influencers, and actors seeking personal, professional, and trusted representation — built on genuine relationships, mutual respect, and a shared journey of growth.',
        'Welcome.',
      ],
      image: '/images/about/profile.jpg',
    },
  },

  contactPage: {
    headline: 'בואו נדבר.',
    headlineEn: "Let's Talk.",
    subheadline: 'לשיתופי פעולה, קאסטינג ופניות מותגים — בר אורן זמין ישירות.',
    subheadlineEn: 'For collaborations, casting, and brand inquiries — Bar Oren is available directly.',
    formTitle: 'שלחו הודעה',
    formTitleEn: 'Send a Message',
    directTitle: 'ישירות',
    directTitleEn: 'Direct',
    metaTitle: 'צור קשר',
    metaTitleEn: 'Contact',
    metaDescription: 'לשיתופי פעולה, קאסטינג ופניות מותגים — צרו קשר ישירות עם בר אורן.',
    metaDescriptionEn: 'For collaborations, casting, and brand inquiries — get in touch directly with Bar Oren.',
  },

  /* Accessibility Statement (/accessibility). English copy pulled verbatim
     from translations-english-draft.docx → "Accessibility Statement" →
     Table 46. Hebrew values match what was previously hardcoded directly
     in app/[locale]/accessibility/page.jsx. */
  accessibilityPage: {
    metaTitle: 'הצהרת נגישות',
    metaTitleEn: 'Accessibility Statement',
    ogTitle: 'הצהרת נגישות | Bar Oren',
    ogTitleEn: 'Accessibility Statement | Bar Oren',
    metaDescription: 'הצהרת נגישות של Bar Oren Talent Agency — מחויבותנו לנגישות דיגיטלית, תאימות WCAG 2.1 ואפשרויות יצירת קשר לדיווח על בעיות נגישות.',
    metaDescriptionEn: 'Accessibility Statement for Bar Oren Talent Agency — our commitment to digital accessibility, WCAG 2.1 compliance, and how to contact us to report accessibility issues.',
    ogAlt: 'Bar Oren — הצהרת נגישות',
    ogAltEn: 'Bar Oren — Accessibility Statement',

    h1: 'הצהרת נגישות',
    h1En: 'Accessibility Statement',
    updated: 'עודכן לאחרונה: יוני 2026',
    updatedEn: 'Last updated: June 2026',
    intro: 'Bar Oren Talent Agency מחויבת להנגיש את האתר לכלל המשתמשים, לרבות אנשים עם מוגבלויות. אנו פועלים בהתאם לתקן הנגישות הבינלאומי WCAG 2.1 ברמה AA ולדרישות חוק שוויון זכויות לאנשים עם מוגבלות, התשנ"ח-1998.',
    introEn: "Bar Oren Talent Agency is committed to making this website accessible to all users, including people with disabilities. We work in accordance with the international WCAG 2.1 Level AA accessibility standard and the requirements of Israel's Equal Rights for Persons with Disabilities Law, 1998.",

    whatHeading: 'מה ביצענו',
    whatHeadingEn: "What We've Done",
    /* Items are plain strings, except the one item that carries an inline
       <code> tag in the existing markup (the "required" attribute) — that
       one is an object {text, code} so the page can render the <code> tag
       without embedding JSX in this data file. */
    whatItems: [
      'מבנה HTML סמנטי עם היררכיית כותרות ברורה (H1–H3)',
      'תוויות ARIA וטקסט חלופי לכל התמונות הפונקציונליות',
      'ניווט מקלדת מלא — כל הפעולות נגישות ללא עכבר',
      'מחוון מיקוד גלוי בכל אלמנט אינטראקטיבי',
      'ניהול מיקוד בחלונות מודאל — פתיחה, מלכוד, סגירה והחזרת מיקוד',
      'תמיכה בכיוון RTL ובשפה העברית',
      'יחסי ניגוד צבע העומדים בדרישות WCAG AA',
      { text: 'טופס יצירת קשר עם תוויות, הודעות שגיאה ותכונת ', code: 'required' },
      'קישור "דלג לתוכן" בראש כל עמוד',
    ],
    whatItemsEn: [
      'Semantic HTML structure with a clear heading hierarchy (H1–H3)',
      'ARIA labels and alt text for all functional images',
      'Full keyboard navigation — every action is accessible without a mouse',
      'A visible focus indicator on every interactive element',
      'Focus management in modal windows — on open, trap, close, and focus return',
      'Support for RTL direction and the Hebrew language',
      'Color contrast ratios that meet WCAG AA requirements',
      { text: 'A contact form with labels, error messages, and the ', code: 'required', suffix: ' attribute' },
      'A "skip to content" link at the top of every page',
    ],

    techHeading: 'טכנולוגיות נשענות',
    techHeadingEn: 'Technologies Used',
    techParagraph: 'האתר בנוי עם Next.js ומשתמש ב-HTML סמנטי, CSS לעיצוב ו-JavaScript לאינטראקציות. האתר תומך בקוראי מסך כגון VoiceOver (macOS / iOS) ו-NVDA (Windows) ובדפדפנים מודרניים.',
    techParagraphEn: 'This website is built with Next.js and uses semantic HTML, CSS for styling, and JavaScript for interactivity. The site supports screen readers such as VoiceOver (macOS/iOS) and NVDA (Windows), as well as modern browsers.',

    limitationsHeading: 'מגבלות ידועות',
    limitationsHeadingEn: 'Known Limitations',
    limitationsParagraph: 'אנו עובדים באופן שוטף על שיפור הנגישות. אם נתקלתם בקושי כלשהו בגישה לתוכן, נשמח לשמוע ולטפל בכך בהקדם.',
    limitationsParagraphEn: "We are continually working to improve accessibility. If you encounter any difficulty accessing our content, we'd welcome hearing from you so we can address it promptly.",

    contactHeading: 'יצירת קשר בנושא נגישות',
    contactHeadingEn: 'Accessibility Contact',
    contactIntro: 'לדיווח על בעיית נגישות, בקשה לתוכן בפורמט חלופי, או כל שאלה בנושא — ניתן לפנות אלינו:',
    contactIntroEn: 'To report an accessibility issue, request content in an alternative format, or ask any related question, please contact us:',
    emailLabel: 'אימייל:',
    emailLabelEn: 'Email:',
    /* {email} is replaced with the live siteConfig.contact.email value */
    emailAriaTemplate: 'שלח אימייל לנגישות ל-{email}',
    emailAriaTemplateEn: 'Send an accessibility email to {email}',
    closingLine: 'נשתדל להשיב תוך 5 ימי עסקים.',
    closingLineEn: 'We aim to respond within 5 business days.',
  },

  /* Privacy Policy (/privacy-policy). English copy pulled verbatim from
     translations-english-draft.docx → "Privacy Policy" → Table 47. Hebrew
     values match what was previously hardcoded directly in
     app/[locale]/privacy-policy/page.jsx. */
  privacyPage: {
    metaTitle: 'מדיניות פרטיות',
    metaTitleEn: 'Privacy Policy',
    ogTitle: 'מדיניות פרטיות | Bar Oren',
    ogTitleEn: 'Privacy Policy | Bar Oren',
    metaDescription: 'מדיניות הפרטיות של Bar Oren Talent Agency — מה נאסף, כיצד נשמר, ומהן זכויותיכם בהתאם לחוק הגנת הפרטיות הישראלי.',
    metaDescriptionEn: "Bar Oren Talent Agency's Privacy Policy — what information is collected, how it's stored, and your rights under Israeli privacy law.",
    ogAlt: 'Bar Oren — מדיניות פרטיות',
    ogAltEn: 'Bar Oren — Privacy Policy',

    h1: 'מדיניות פרטיות',
    h1En: 'Privacy Policy',
    updated: 'עודכן לאחרונה: יוני 2026',
    updatedEn: 'Last updated: June 2026',
    /* Intro is split around the live site URL link, same approach the
       existing Hebrew markup already uses (the <a> sits mid-sentence). */
    introPrefix: 'מדיניות פרטיות זו מתארת כיצד Bar Oren Talent Agency ("הסוכנות", "אנחנו") אוספת, משתמשת ומגנה על המידע האישי שמוסר לנו דרך האתר ',
    introPrefixEn: 'This Privacy Policy describes how Bar Oren Talent Agency (“the Agency,” “we”) collects, uses, and protects the personal information you provide to us through our website ',
    introSuffix: '. השימוש באתר מהווה הסכמה למדיניות זו.',
    introSuffixEn: '. Use of the website constitutes acceptance of this policy.',

    sections: [
      {
        heading: 'מידע שאנו אוספים',
        headingEn: 'Information We Collect',
        intro: 'אנו אוספים מידע רק כאשר אתם פונים אלינו ישירות:',
        introEn: 'We only collect information when you contact us directly:',
        items: [
          { lead: 'טופס יצירת קשר', text: 'שם מלא, כתובת אימייל, מספר טלפון (אופציונלי) והודעה שנשלחים מרצונכם החופשי.' },
          { lead: 'WhatsApp / אימייל ישיר', text: 'פרטי התקשרות שמוסרים במהלך שיחה ישירה עם הסוכנות.' },
        ],
        itemsEn: [
          { lead: 'Contact form', text: 'full name, email address, phone number (optional), and the message you choose to send.' },
          { lead: 'WhatsApp / direct email', text: 'contact details shared during a direct conversation with the Agency.' },
        ],
        outro: 'אין אנו אוספים קובצי Cookie, נתוני גלישה, כתובות IP לצרכי מעקב, או כל מידע אחר ללא ידיעתכם.',
        outroEn: 'We do not collect cookies, browsing data, IP addresses for tracking purposes, or any other information without your knowledge.',
      },
      {
        heading: 'מטרת השימוש במידע',
        headingEn: 'How We Use Your Information',
        intro: 'המידע שנמסר משמש אך ורק:',
        introEn: 'The information provided is used solely:',
        items: [
          { text: 'למענה לפנייתכם — שיתופי פעולה, קאסטינג, שאלות כלליות' },
          { text: 'לניהול קשר עסקי שוטף עם מיוצגים ושותפים' },
        ],
        itemsEn: [
          { text: 'To respond to your inquiry — collaborations, casting, or general questions' },
          { text: 'To manage ongoing business relationships with talent and partners' },
        ],
        outro: 'לא נשתמש במידעכם לצרכי שיווק ישיר ללא הסכמתכם המפורשת.',
        outroEn: 'We will not use your information for direct marketing purposes without your explicit consent.',
      },
      {
        heading: 'שיתוף מידע עם צדדים שלישיים',
        headingEn: 'Sharing Information with Third Parties',
        intro: 'אנו לא מוכרים, סוחרים או מעבירים את פרטיכם לגורמים חיצוניים, למעט:',
        introEn: 'We do not sell, trade, or transfer your information to outside parties, except:',
        items: [
          { lead: 'WhatsApp (Meta Platforms)', text: 'כאשר אתם יוזמים שיחה דרך הקישור באתר, תוכן השיחה כפוף למדיניות הפרטיות של Meta.' },
          { text: 'ספקי שירות טכנולוגיים הנדרשים להפעלת האתר (Vercel לאירוח), שמחויבים לסודיות.' },
          { text: 'גורמים מוסמכים על פי חוק, אם נדרש על ידי רשות מוסמכת.' },
        ],
        itemsEn: [
          { lead: 'WhatsApp (Meta Platforms)', text: "when you initiate a conversation through the link on our website, the content of that conversation is subject to Meta's privacy policy." },
          { text: 'Technology service providers required to operate the website (Vercel for hosting), who are bound by confidentiality.' },
          { text: 'Authorities entitled by law, if required by a competent authority.' },
        ],
      },
    ],

    securityHeading: 'אבטחת מידע',
    securityHeadingEn: 'Data Security',
    securityParagraph: 'האתר פועל תחת חיבור מאובטח (HTTPS). המידע שנשלח בטופס יצירת הקשר מועבר באופן מוצפן. אנו נוקטים אמצעי זהירות סבירים לשמירה על המידע, אולם אין ביכולתנו להבטיח אבטחה מוחלטת של כל העברת מידע.',
    securityParagraphEn: 'This website operates over a secure connection (HTTPS). Information submitted through the contact form is transmitted in encrypted form. We take reasonable precautions to protect your information; however, we cannot guarantee the absolute security of any data transmission.',

    retentionHeading: 'שמירת מידע',
    retentionHeadingEn: 'Data Retention',
    retentionParagraph: 'מידע שנמסר בטופס יצירת קשר נשמר רק כל עוד הוא רלוונטי לצורך שלשמו נמסר, ולא מעבר לכך. ניתן לבקש מחיקת המידע בכל עת.',
    retentionParagraphEn: 'Information submitted through the contact form is retained only for as long as it remains relevant to the purpose for which it was provided, and no longer. You may request deletion of your information at any time.',

    rightsHeading: 'זכויותיכם',
    rightsHeadingEn: 'Your Rights',
    rightsIntro: 'בהתאם לחוק הגנת הפרטיות, התשמ"א-1981, עומדות לכם הזכויות הבאות:',
    rightsIntroEn: "Under Israel's Privacy Protection Law, 1981, you are entitled to the following rights:",
    rightsItems: [
      'לעיין במידע שנשמר אודותיכם',
      'לבקש תיקון מידע שגוי',
      'לבקש מחיקת מידעכם',
    ],
    rightsItemsEn: [
      'To review the information held about you',
      'To request correction of inaccurate information',
      'To request deletion of your information',
    ],
    rightsOutro: 'לממוש זכויות אלו, פנו אלינו בכתב לכתובת האימייל המופיעה למטה.',
    rightsOutroEn: 'To exercise these rights, please contact us in writing at the email address listed below.',

    changesHeading: 'שינויים במדיניות',
    changesHeadingEn: 'Changes to This Policy',
    changesParagraph: 'אנו עשויים לעדכן מדיניות זו מעת לעת. השינויים ייכנסו לתוקף עם פרסומם בעמוד זה. ממשיכים להשתמש באתר לאחר עדכון המדיניות? הרי זו הסכמה לתנאים המעודכנים.',
    changesParagraphEn: 'We may update this policy from time to time. Changes take effect once posted to this page. Continued use of the website after the policy is updated constitutes acceptance of the revised terms.',

    contactHeading: 'יצירת קשר',
    contactHeadingEn: 'Contact Us',
    contactIntro: 'לכל שאלה בנושא פרטיות, ניתן לפנות אלינו:',
    contactIntroEn: 'For any privacy-related questions, please contact us:',
    emailLabel: 'אימייל:',
    emailLabelEn: 'Email:',
    emailAriaTemplate: 'שלח אימייל ל-{email}',
    emailAriaTemplateEn: 'Send an email to {email}',
    addressLabel: 'כתובת:',
    addressLabelEn: 'Address:',
  },
};
