export const siteConfig = {
  name: 'Bar Oren',
  agencyName: 'Bar Oren Talent Agency',
  tagline: 'Talent Agency',
  descriptor: 'סוכנות בוטיק לייצוג וניהול אישי\nליוצרי תוכן, משפיענים ושחקנים.',
  descriptorEn: 'Personal and professional management for content creators, influencers, models and actors.',

  contact: {
    whatsapp: 'https://wa.me/972548311818',
    email: 'bar@baroren.co.il',
    phone: null,
    instagram: 'https://www.instagram.com/barorenagency',
    tiktok: null,
    linkedin: null,
    address: 'תל אביב, ישראל',
  },

  meta: {
    title: 'Bar Oren Talent Agency',
    description: 'סוכנות בוטיק לייצוג וניהול אישי ליוצרי תוכן, משפיענים ושחקנים.',
    descriptionEn: 'Personal and professional talent management. Content creators, influencers, models and actors.',
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
      { label: 'מיוצגים', labelEn: 'Talent',  href: '/talent'  },
      { label: 'אודות',    labelEn: 'About',   href: '/about'   },
      { label: 'צור קשר',  labelEn: 'Contact', href: '/contact' },
    ],
  },

  homepage: {
    voiceHeadline: 'כישרון נבחר. ייצוג אישי.',
    voiceBody: 'אנחנו מייצגים אנשים שאי אפשר להתעלם מהם.',
    featuredTitle: 'מיוצגים',
    featuredCta: 'לכל המיוצגים',
    collaborationsTitle: 'שיתופי פעולה נבחרים',
    contactHeadline: 'מעוניינים בשיתוף פעולה?',
    contactBody: 'צרו קשר ישירות עם בר אורן.',
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

    founder: {
      name: 'בר אורן',
      title: 'מייסד ומנהל הסוכנות',
      bio: [
        'היי, אני בר אורן.',
        'הקמתי את הסוכנות מתוך אמונה שייצוג טוב מתחיל קודם כל באנשים. לפני מספרים, לפני צפיות ולפני קמפיינים. חשוב לי להכיר את האדם שמאחורי התוכן, להבין את השאיפות שלו ולבנות יחד דרך שמתאימה לו.',
        'הסוכנות פועלת במודל בוטיק ומייצגת יוצרי תוכן, משפיענים ושחקנים ממגוון תחומים. אני בוחר לעבוד עם מספר מצומצם של מיוצגים, כדי להעניק לכל אחד ואחת ליווי אישי, זמינות מלאה וחשיבה אסטרטגית לטווח ארוך.',
        'העבודה שלי משלבת בין ניהול הזדמנויות מסחריות, בניית מותג אישי ופיתוח קריירה, תוך שמירה על אותנטיות ועל הערכים שהפכו כל מיוצג למה שהוא.',
        'אני מאמין שלא כל שיתוף פעולה הוא שיתוף פעולה נכון, ולא כל הזדמנות היא הזדמנות שכדאי לקחת. לכן הדגש בסוכנות הוא על חיבורים מדויקים, מערכות יחסים ארוכות טווח וצמיחה יציבה לאורך זמן.',
        'הסוכנות שלי היא בית ליוצרים, משפיענים ושחקנים שמחפשים ליווי אישי, מקצועי ואמין עם יחס בגובה העיניים ודרך משותפת שנבנית יחד.',
        'ברוכים הבאים.',
      ],
      image: '/images/about/profile.jpg',
    },
  },

  contactPage: {
    headline: 'בואו נדבר.',
    subheadline: 'לשיתופי פעולה, קאסטינג ופניות מותגים — בר אורן זמין ישירות.',
    formTitle: 'שלחו הודעה',
    directTitle: 'ישירות',
  },
};
