export const siteConfig = {
  name: 'Bar Oren',
  agencyName: 'Bar Oren Talent Agency',
  tagline: 'Talent Agency',
  descriptor: 'ניהול אישי ומקצועי ליוצרי תוכן, משפיענים, דוגמנים ושחקנים.',
  descriptorEn: 'Personal and professional management for content creators, influencers, models and actors.',

  contact: {
    whatsapp: 'https://wa.me/972548311818',
    email: 'bar@baroren.co.il',
    phone: null,
    instagram: 'https://instagram.com/baroren',
    tiktok: null,
    linkedin: null,
    address: 'תל אביב, ישראל',
  },

  meta: {
    title: 'Bar Oren Talent Agency',
    description: 'ניהול אישי ומקצועי ליוצרי תוכן, משפיענים, דוגמנים ושחקנים.',
    descriptionEn: 'Personal and professional talent management. Content creators, influencers, models and actors.',
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
    subheadline: 'ניהול מיוצגים ברמה הגבוהה ביותר.',

    story: [
      'בר אורן טאלנט אייג\'נסי היא סוכנות ייצוג בוטיק המתמחה בניהול אישי ומקצועי של מיוצגים. אנחנו מאמינים שייצוג אמיתי מתחיל בהבנה עמוקה של כל אחד מהמיוצגים שלנו — לא רק מה שהם עושים, אלא מי שהם.',
      'כל מיוצג שמצטרף לסוכנות עובר תהליך בחירה אישי. אנחנו לא מחפשים כמות — אנחנו מחפשים אנשים שאי אפשר להתעלם מהם. שיתופי פעולה שיוצאים מהסוכנות מבוססים על הבנה אמיתית, יחסים ארוכי טווח ומחויבות מלאה לשני הצדדים.',
    ],

    philosophy: [
      'ייצוג טוב מתחיל בהבנה. לא של מה שהמיוצג עושה — אלא של מי שהוא.',
      'כל אחד מהמיוצגים שלנו נבחר באופן אישי. אנו מאמינים בעבודה קרובה, ביחסים ארוכי טווח, ובשיתופי פעולה שנוצרים מתוך הבנה אמיתית של המותג ושל האדם שמייצג אותו.',
      'בר אורן מנהל את הסוכנות באופן אישי. כל שיתוף פעולה, כל קאסטינג, כל קמפיין — עובר דרכו.',
    ],

    founder: {
      name: 'בר אורן',
      title: 'מייסד ומנהל הסוכנות',
      statement: 'הקמתי את הסוכנות מתוך אמונה שכישרון ישראלי ראוי לייצוג ברמה הגבוהה ביותר. כל שיתוף פעולה שאני בונה — בין מיוצג לבין מותג — מבוסס על הבנה אמיתית, יחסים ארוכי טווח, ומחויבות מלאה.',
      image: null, // add image path when ready: '/images/about/bar-oren.jpg'
    },

    services: [
      {
        number: '01',
        title: 'ניהול מיוצגים',
        description: 'ניהול מקצועי ואישי מלא — אסטרטגיה, תמחור, חוזים ופיתוח קריירה לטווח ארוך.',
      },
      {
        number: '02',
        title: 'שיתופי פעולה עם מותגים',
        description: 'חיבור בין מיוצגים לבין מותגים מובילים, מתוך הבנה עמוקה של שני הצדדים.',
      },
      {
        number: '03',
        title: 'קמפיינים UGC',
        description: 'הפקת תוכן אותנטי ואיכותי לצרכי מותגים, עם מיוצגים שמדברים אל הקהל הנכון.',
      },
      {
        number: '04',
        title: 'קאסטינג וייצוג',
        description: 'שירותי קאסטינג לפרסומות, קמפיינים ופרויקטים יצירתיים — עם עין קפדנית לפרטים.',
      },
    ],
  },

  contactPage: {
    headline: 'בואו נדבר.',
    subheadline: 'לשיתופי פעולה, קאסטינג ופניות מותגים — בר אורן זמין ישירות.',
    formTitle: 'שלחו הודעה',
    directTitle: 'ישירות',
  },
};
