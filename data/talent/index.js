/*
 * ─────────────────────────────────────────────────────────────────────────────
 * TALENT DATA  —  single source of truth for all talent on the site.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * TO ADD A NEW TALENT — edit only this file:
 *   1. Copy a talent object below and fill in the fields.
 *   2. Add their image to: /public/images/talent/[slug]/
 *        profile.jpg   — portrait, used everywhere (roster grid + profile page)
 *        gallery-1.jpg — optional additional photos
 *   3. Set featured: true to show on the homepage (max 3 at a time).
 *   4. Run `git push` — Vercel auto-deploys.
 *
 * FIELD REFERENCE
 *
 *   slug          — URL path: /talent/[slug]  (lowercase, hyphenated)
 *   name          — Hebrew display name
 *   nameEn        — English display name
 *   category      — array of: 'content' | 'influencer' | 'model' | 'actor'
 *   tags          — Hebrew work-area labels shown on the profile page
 *   featured      — show on homepage featured grid (keep to max 3)
 *   sortOrder     — roster display order (lower = earlier)
 *
 *   profileImage  — path relative to /public  e.g. '/images/talent/slug/profile.jpg'
 *                   set to null to show warm gradient placeholder
 *   gallery       — array of { src, alt } objects
 *
 *   bioHe         — Hebrew biography (editorial tone, 2–4 sentences)
 *   bioEn         — English biography
 *
 *   instagram     — full URL or null
 *   tiktok        — full URL or null
 *   youtube       — full URL or null
 *
 *   followers     — internal reference only; NOT shown on the public site
 *                   { instagram: number|null, tiktok: number|null, youtube: number|null }
 */

export const talentList = [

  // ─── 1 ─ Kim Chorilov ──────────────────────────────────────────────────────
  {
    id: '6',
    slug: 'kim-chorilov',
    name: 'קים צ׳ורילוב',
    nameEn: 'Kim Chorilov',

    category: ['content', 'influencer', 'model'],
    tags: ['לייף סטייל', 'אופנה', 'ביוטי'],

    featured: true,
    featuredOrder: 2,
    sortOrder: 1,

    location: 'הרצליה',
    birthDate: '2002-07-23',

    profileImage: '/images/talent/kim-chorilov/profile.jpg',
    gallery: [
      '/images/talent/kim-chorilov/gallery/01.jpg',
      '/images/talent/kim-chorilov/gallery/02.jpg',
      '/images/talent/kim-chorilov/gallery/03.jpg',
      '/images/talent/kim-chorilov/gallery/04.jpg',
      '/images/talent/kim-chorilov/gallery/05.jpg',
      '/images/talent/kim-chorilov/gallery/06.jpg',
    ],

    bioHe: 'יוצרת תוכן ומשפיענית בתחומי הביוטי, האופנה והלייף סטייל. קים משלבת בין תוכן יומיומי, המלצות אותנטיות וטרנדים, תוך יצירת חיבור אישי עם קהילת העוקבות שלה. התוכן שלה מאופיין באסתטיקה נקייה, נוכחות טבעית ויכולת לייצר אמון ומעורבות גבוהה.',
    bioEn: 'Kim Chorilov is a content creator and model with a natural presence, clean aesthetic and personal style rooted in lifestyle, fashion and beauty.',

    instagram: 'https://www.instagram.com/kimchourilov',
    tiktok:    'https://www.tiktok.com/@kimchourilov',
    youtube:   'https://www.youtube.com/@kimchourilov',

    followers: { instagram: null, tiktok: null, youtube: null },
  },


  // ─── 7 ─ Topaz Falah ───────────────────────────────────────────────────────
  {
    id: '7',
    slug: 'topaz-falah',
    name: 'טופז פלח',
    nameEn: 'Topaz Falah',

    category: ['content', 'influencer'],
    tags: ['אמהות', 'לייף סטייל', 'יצירת תוכן'],

    featured: false,
    sortOrder: 3,

    location: 'מושב יגל',
    birthDate: '1997-02-23',

    profileImage: '/images/talent/topaz-falah/profile.jpg',
    gallery:      [],

    bioHe: 'יוצרת תוכן מובילה בתחום האמהות והלייף סטייל, המביאה למסך את חיי המשפחה האמיתיים בגובה העיניים. בעמודיה היא משתפת ברגעים יום-יומיים ואותנטיים לצד בעלה ניסים והילדים, ומציעה הצצה לשגרת הורות מעוררת השראה, טיפים לחיים ומתכונים ביתיים ונגישים. בזכות אנרגיה חמה וחיבור אמיתי, טופז סחפה אחריה קהילה נאמנה של אמהות ונשים שמחפשות השראה יום-יומית.',
    bioEn: null,

    instagram: 'https://www.instagram.com/topaz_falah',
    tiktok:    'https://www.tiktok.com/@topaz_falah',
    youtube:   null,

    followers: { instagram: 52_400, tiktok: 62_100, youtube: null },
  },

  // ─── 8 ─ Gal Azar ──────────────────────────────────────────────────────────
  {
    id: '8',
    slug: 'gal-azar',
    name: 'גל עזר',
    nameEn: 'Gal Azar',

    category: ['content', 'influencer'],
    tags: ['לייף סטייל', 'אופנה', 'ביוטי', 'אוכל', 'טרוול'],

    featured: true,
    featuredOrder: 1,
    sortOrder: 0,

    location: 'חולון',
    birthDate: '2003-06-02',

    profileImage: '/images/talent/gal-azar/profile.jpg',
    gallery:      [],

    bioHe: 'יוצרת תוכן ומשפיענית בתחום הלייף סטייל, אופנה, ביוטי וטרוול. גל ידועה בזכות סרטוני ASMR וטרנדים קולינריים ייחודיים שמתפוצצים ברשת וגורפים מיליוני צפיות. התוכן שלה קריאטיבי, אסתטי ומעורר השראה, והיא מתאפיינת בחשיבה מחוץ לקופסה ורמת הפקה גבוהה שיוצרת חיבור מיידי עם הקהל.',
    bioEn: null,

    instagram: 'https://www.instagram.com/gal__azar/',
    tiktok:    'https://www.tiktok.com/@gal.azar',
    youtube:   'https://www.youtube.com/@gal_azar',

    followers: { instagram: 30_100, tiktok: 243_900, youtube: 14_700 },
  },

  // ─── 9 ─ Michal Ben David ──────────────────────────────────────────────────
  {
    id: '9',
    slug: 'michal-ben-david',
    name: 'מיכל בן דוד',
    nameEn: 'Michal Ben David',

    category: ['content', 'influencer'],
    tags: ['ביוטי', 'אופנה', 'לייף סטייל'],

    featured: true,
    featuredOrder: 3,
    sortOrder: 2,

    location: 'הוד השרון',
    birthDate: '2003-10-24',

    profileImage: '/images/talent/michal-bendavid/profile.jpg',
    gallery: [
      '/images/talent/michal-bendavid/gallery/01.jpg',
      '/images/talent/michal-bendavid/gallery/02.jpg',
      '/images/talent/michal-bendavid/gallery/03.jpg',
    ],

    bioHe: 'יוצרת תוכן ומשפיענית בתחומי הביוטי, האופנה והלייף סטייל, עם זווית בינלאומית ייחודית שמחברת בין התרבות הישראלית לאמריקאית. מיכל מביאה למסך שילוב של סטייל אישי, אותנטיות, הומור ורגעים אמיתיים מחיי היום יום.\nבנוסף, מיכל יוצרת תוכן גם בשפה האנגלית ומנחה את הפודקאסט “Hetzi חצי”, שצבר מיליוני צפיות ברשתות.',
    bioEn: null,

    instagram: 'https://www.instagram.com/michalbd1/',
    tiktok:    'https://www.tiktok.com/@michalbd1',
    youtube:   null,

    followers: { instagram: 38_000, tiktok: 284_200, youtube: null },
  },

  // ─── 10 ─ Emma Weinberg ─────────────────────────────────────────────────────
  {
    id: '10',
    slug: 'emma-weinberg',
    name: 'אמה וינברג',
    nameEn: 'Emma Weinberg',

    category: ['content', 'influencer'],
    tags: ['ביוטי', 'אופנה', 'לייף סטייל'],

    featured: false,
    sortOrder: 4,

    location: 'הרצליה',
    birthDate: '2008-01-21',

    profileImage: '/images/talent/emma-weinberg/profile-v2.jpg',
    gallery:      [],

    bioHe: 'יוצרת תוכן ומשפיענית בתחום הביוטי פאשן ולייף סטייל. משתפת טיפים יום יומיים, סטיילינג, תוכן הומוריסטי ואת חיי היום יום. לאמה יש קהילת בנות שעוקבות אחרי ההמלצות שלה.',
    bioEn: null,

    instagram: 'https://www.instagram.com/emma_weinberg/',
    tiktok:    'https://www.tiktok.com/@emmush_xoxo',
    youtube:   null,

    followers: { instagram: 16_200, tiktok: 76_800, youtube: null },
  },

  // ─── 11 ─ Ordan Nahari ──────────────────────────────────────────────────────
  {
    id: '11',
    slug: 'ordan-nahari',
    name: 'אורדן נהרי',
    nameEn: 'Ordan Nahari',

    category: ['content', 'influencer'],
    tags: ['אמהות', 'לייף סטייל', 'יצירת תוכן'],

    featured: false,
    sortOrder: 5,

    location: 'באר יעקב',
    birthDate: '1996-10-10',

    profileImage: '/images/talent/ordan-nahari/profile.jpg',
    // Crop focus override — source photo has excess empty space above the
    // head; shift the visible window down to bring her higher in the frame.
    // All other talents keep the TalentImage default ('center top').
    imagePosition: 'center 25%',
    gallery:      [],

    bioHe: 'יוצרת תוכן מעוררת השראה בתחום האמהות והלייף סטייל. בעמודיה היא מציגה תוכן משפחתי, יום-יומי ואסתטי במיוחד, המשלב את בעלה אורי ושני בניהם. התוכן של אורדן מאופיין בוויב חם, נעים ומזמין, המדגיש את החיבור המשפחתי האמיתי והרגעים הקטנים של החיים בסטייל בלתי מתפשר. בזכות שילוב של אותנטיות ואסתטיקה גבוהה, אורדן מייצרת חיבור עמוק עם קהל של אמהות ונשים.',
    bioEn: null,

    instagram: 'https://www.instagram.com/ordan__n/',
    tiktok:    'https://www.tiktok.com/@ordan__n',
    youtube:   null,

    followers: { instagram: 47_400, tiktok: 81_700, youtube: null },
  },

  // ─── 12 ─ Alma Weizman ──────────────────────────────────────────────────────
  {
    id: '12',
    slug: 'alma-weizman',
    name: 'עלמא ויצמן',
    nameEn: 'Alma Weizman',

    category: ['content', 'influencer'],
    tags: ['ספורט', 'לייף סטייל', 'יצירת תוכן'],

    featured: false,
    sortOrder: 6,

    location: 'חדרה',
    birthDate: '2003-04-01',

    profileImage: '/images/talent/alma-weizman/profile-v2.jpg',
    gallery:      [],

    bioHe: 'יוצרת תוכן בתחומי האופנה, הביוטי, והלייף סטייל. עלמא משלבת בתוכן שלה סטייל אישי, יצירתיות ואסתטיקה חזקה, לצד רגעים מחיי היום-יום.',
    bioEn: null,

    instagram: 'https://www.instagram.com/almavay',
    tiktok:    'https://www.tiktok.com/@almavay',
    youtube:   null,

    // Extra social links rendered after the main links (supports optional displayLabel)
    extraSocials: [
      { url: 'https://www.instagram.com/almachillz', label: 'Instagram', displayLabel: 'Spam' },
    ],

    followers: { instagram: 17_600, tiktok: 42_300, youtube: null },
  },

  // ─── 13 ─ Shilav Jurin ──────────────────────────────────────────────────────
  {
    id: '13',
    slug: 'shilav-jurin',
    name: 'שילב חורין',
    nameEn: 'Shilav Jurin',

    category: ['content', 'influencer'],
    tags: ['אופנה', 'לייף סטייל', 'זוגיות'],

    featured: false,
    sortOrder: 7,

    location: 'קיבוץ דבירה',
    birthDate: '1997-08-18',

    profileImage: '/images/talent/shilav-jorin/profile.jpg',
    gallery:      [],

    bioHe: 'יוצרת תוכן ומשפיענית בתחום לייף סטייל, אופנה וזוגיות. בעמודיה היא משתפת את הקהל ברגעים אישיים, לצד סרטוני סיטואציות קריאטיביים והומוריסטיים המציגים את הכימיה המטורפת עם בעלה עידן. שילב מייצרת תוכן זוגי, אותנטי וסוחף בגובה העיניים, שיוצר חיבור מיידי ועמוק עם הקהל שלה.',
    bioEn: null,

    instagram: 'https://www.instagram.com/shilav_jurin',
    tiktok:    'https://www.tiktok.com/@shilshillllll',
    youtube:   null,

    followers: { instagram: 32_700, tiktok: 66_200, youtube: null },
  },

  // ─── 14 ─ Shaked Hodra ──────────────────────────────────────────────────────
  {
    id: '14',
    slug: 'shaked-hodra',
    name: 'שקד חודרה',
    nameEn: 'Shaked Hodra',

    category: ['content', 'influencer'],
    tags: ['לייף סטייל', 'תיירות', 'אוכל'],

    featured: false,
    sortOrder: 8,

    location: 'בת ים',
    birthDate: '1999-05-19',

    profileImage: '/images/talent/shaked-hudra/profile-v2.jpg',
    gallery:      [],

    bioHe: 'יוצרת תוכן ומשפיענית בתחומי הלייף סטייל, האופנה וה-UGC. שקד מתמחה ביצירת תוכן אותנטי ומדויק עבור מותגים, לצד שיתוף חוויות, המלצות ותוכן יומיומי.',
    bioEn: null,

    instagram: 'https://www.instagram.com/shaked__h/',
    tiktok:    'https://www.tiktok.com/@shaked__h',
    youtube:   null,

    followers: { instagram: 16_800, tiktok: 20_400, youtube: null },
  },

  // ─── 15 ─ Gal Arad ──────────────────────────────────────────────────────────
  {
    id: '15',
    slug: 'gal-arad',
    name: 'גל ארד',
    nameEn: 'Gal Arad',

    category: ['content', 'influencer'],
    tags: ['לייף סטייל', 'הומור', 'ספורט'],

    featured: false,
    sortOrder: 9,

    location: 'חולון',
    birthDate: '2002-03-03',

    profileImage: '/images/talent/gal-arad/profile-v2.jpg',
    gallery:      [],

    bioHe: 'יוצר תוכן מבטיח ומרענן בעולמות הלייף סטייל והספורט. גל מביא אל הרשת חשיבה מחוץ לקופסה, קריאייטיב מקורי וסרטונים הומוריסטיים שאי אפשר להישאר אליהם אדישים. התוכן שלו מאופיין בוויב סוחף, קליל ומעניין, המשלב בין עולם הספורט לחיי היום-יום בצורה חכמה ומצחיקה. בזכות האנרגיה הייחודית שלו, גל מייצר חיבור מיידי עם הקהל ומסתמן כהבטחה גדולה ברשת.',
    bioEn: null,

    instagram: 'https://www.instagram.com/galarad33/',
    tiktok:    'https://www.tiktok.com/@galarad',
    youtube:   null,

    followers: { instagram: null, tiktok: null, youtube: null },
  },

];

// ─── Helper functions ────────────────────────────────────────────────────────

export function getTalentBySlug(slug) {
  return talentList.find((t) => t.slug === slug) ?? null;
}

export function getFeaturedTalent(limit = 3) {
  return talentList
    .filter((t) => t.featured)
    .sort((a, b) => {
      const ao = a.featuredOrder ?? a.sortOrder;
      const bo = b.featuredOrder ?? b.sortOrder;
      return ao - bo;
    })
    .slice(0, limit);
}

export function getTalentByCategory(category) {
  const sorted = [...talentList].sort((a, b) => a.sortOrder - b.sortOrder);
  if (!category || category === 'all') return sorted;
  return sorted.filter((t) => t.category.includes(category));
}

export function getAllSlugs() {
  return talentList.map((t) => t.slug);
}

/**
 * Calculates current age from a birthDate ('YYYY-MM-DD').
 * Recomputed at render time, so the displayed age updates automatically
 * every year without any content edit.
 */
export function getAge(birthDate) {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const hadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}
