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

  // ─── 1 ─ Maya Cohen ────────────────────────────────────────────────────────
  {
    id: '1',
    slug: 'maya-cohen',
    name: 'מאיה כהן',
    nameEn: 'Maya Cohen',

    category: ['content', 'influencer'],
    tags: ['אורח חיים', 'יצירת תוכן', 'פנאי'],

    featured: true,
    sortOrder: 1,

    profileImage: null, // '/images/talent/maya-cohen/profile.jpg'
    gallery:      [],

    bioHe: 'יוצרת תוכן עם עין ייחודית לאסתטיקה ואורח חיים. מאיה בונה קהילה נאמנה מתוך אותנטיות וסיפור אמיתי — ושיתופי הפעולה שלה מצליחים כי הם מרגישים כמו חלק ממנה.',
    bioEn: 'A content creator with a distinctive eye for aesthetics and lifestyle. Maya builds a loyal community through authenticity and real storytelling — her collaborations work because they feel genuinely hers.',

    instagram: 'https://www.instagram.com/mayacohen',
    tiktok:    'https://www.tiktok.com/@mayacohen',
    youtube:   null,

    // Internal — not rendered on the public site
    followers: { instagram: 125_000, tiktok: 89_000, youtube: null },
  },

  // ─── 2 ─ Noa Levi ──────────────────────────────────────────────────────────
  {
    id: '2',
    slug: 'noa-levi',
    name: 'נועה לוי',
    nameEn: 'Noa Levi',

    category: ['model', 'influencer'],
    tags: ['אופנה', 'יוקרה', 'ויז\'ואל'],

    featured: true,
    sortOrder: 2,

    profileImage: null, // '/images/talent/noa-levi/profile.jpg'
    gallery:      [],

    bioHe: 'דוגמנית ויוצרת תוכן שמשלבת בין עולם האופנה לבין נוכחות דיגיטלית עמוקה. נועה עובדת עם מותגי אופנה ומוצרי יוקרה, ומביאה אסתטיקה ייחודית וסיפור ויז\'ואל חד לכל פרויקט.',
    bioEn: 'A model and content creator bridging high fashion and digital presence. Noa collaborates with luxury and fashion brands, bringing a distinctive aesthetic and sharp visual storytelling to every project.',

    instagram: 'https://www.instagram.com/noalevi',
    tiktok:    null,
    youtube:   null,

    followers: { instagram: 210_000, tiktok: null, youtube: null },
  },

  // ─── 3 ─ Yarden Bar ────────────────────────────────────────────────────────
  {
    id: '3',
    slug: 'yarden-bar',
    name: 'ירדן בר',
    nameEn: 'Yarden Bar',

    category: ['actor', 'content'],
    tags: ['משחק', 'פרסום', 'הפקה'],

    featured: true,
    sortOrder: 3,

    profileImage: null, // '/images/talent/yarden-bar/profile.jpg'
    gallery:      [],

    bioHe: 'שחקן ויוצר תוכן בעל נוכחות כריזמטית ועוצמה טבעית. ירדן מביא עומק ואמינות לכל פרויקט — מפרסומות ועד הפקות דרמטיות — ומצליח לגעת בקהל מכל טווח גיל.',
    bioEn: 'An actor and content creator with natural charisma and compelling screen presence. Yarden brings depth and authenticity to every project — from commercials to dramatic productions.',

    instagram: 'https://www.instagram.com/yardenbar',
    tiktok:    'https://www.tiktok.com/@yardenbar',
    youtube:   null,

    followers: { instagram: 78_000, tiktok: 145_000, youtube: null },
  },

  // ─── 4 ─ Dana Katz ─────────────────────────────────────────────────────────
  {
    id: '4',
    slug: 'dana-katz',
    name: 'דנה כץ',
    nameEn: 'Dana Katz',

    category: ['content', 'influencer'],
    tags: ['ביוטי', 'אורח חיים', 'בריאות'],

    featured: false,
    sortOrder: 4,

    profileImage: null, // '/images/talent/dana-katz/profile.jpg'
    gallery:      [],

    bioHe: 'יוצרת תוכן המתמחה בביוטי, בריאות ואורח חיים. דנה מאמינה שתוכן אמיתי מגיע מחיים אמיתיים — והקהל שלה מרגיש את זה. כל שיתוף פעולה שהיא בוחרת משקף את הערכים שהיא מייצגת.',
    bioEn: 'A content creator specialising in beauty, wellness and lifestyle. Dana believes authentic content comes from authentic living — her audience feels the difference. Every partnership she chooses reflects the values she represents.',

    instagram: 'https://www.instagram.com/danakatz',
    tiktok:    'https://www.tiktok.com/@danakatz',
    youtube:   'https://www.youtube.com/@danakatz',

    followers: { instagram: 95_000, tiktok: 180_000, youtube: 42_000 },
  },

  // ─── 5 ─ Lior Ben-David ────────────────────────────────────────────────────
  {
    id: '5',
    slug: 'lior-ben-david',
    name: 'ליאור בן-דוד',
    nameEn: 'Lior Ben-David',

    category: ['model', 'influencer'],
    tags: ['אופנה', 'מנסוויר', 'ספורט'],

    featured: false,
    sortOrder: 5,

    profileImage: null, // '/images/talent/lior-ben-david/profile.jpg'
    gallery:      [],

    bioHe: 'דוגמן ומשפיען אופנה עם נוכחות ייחודית ומרשימה. ליאור עובד עם מותגי אופנה, ספורט ולייפסטייל מובילים, ומביא פרשנות עכשווית ואמינה לכל קמפיין.',
    bioEn: 'A model and fashion influencer with a distinctive, commanding presence. Lior works with leading fashion, sport and lifestyle brands, bringing a contemporary and credible perspective to every campaign.',

    instagram: 'https://www.instagram.com/liorbd',
    tiktok:    'https://www.tiktok.com/@liorbd',
    youtube:   null,

    followers: { instagram: 160_000, tiktok: 95_000, youtube: null },
  },

  // ─── 6 ─ Kim Chorilov ──────────────────────────────────────────────────────
  {
    id: '6',
    slug: 'kim-chorilov',
    name: 'קים צ׳ורילוב',
    nameEn: 'Kim Chorilov',

    category: ['content', 'influencer', 'model'],
    tags: ['לייף סטייל', 'אופנה', 'ביוטי'],

    featured: false,
    sortOrder: 6,

    profileImage: '/images/talent/kim-chorilov/profile.jpg',
    gallery:      [],

    bioHe: 'קים צ׳ורילוב היא יוצרת תוכן ודוגמנית עם נוכחות טבעית, אסתטיקה נקייה וסגנון אישי שמתחבר לעולמות הלייף סטייל, האופנה והביוטי.',
    bioEn: 'Kim Chorilov is a content creator and model with a natural presence, clean aesthetic and personal style rooted in lifestyle, fashion and beauty.',

    instagram: null,
    tiktok:    null,
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
    .sort((a, b) => a.sortOrder - b.sortOrder)
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
