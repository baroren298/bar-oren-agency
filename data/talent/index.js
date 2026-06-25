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
 *   location      — Hebrew location label (profile meta row)
 *   locationEn    — English location label (profile meta row, English locale)
 *
 *   profileImage  — path relative to /public  e.g. '/images/talent/slug/profile.jpg'
 *                   set to null to show warm gradient placeholder
 *   gallery       — array of { src, alt } objects
 *   galleryMobileOrder — optional, per-talent. Array same length as gallery;
 *                   galleryMobileOrder[i] is the CSS `order` value applied to
 *                   gallery[i] only at the mobile breakpoint (≤640px), to
 *                   visually re-pair images in the 2-column mobile grid
 *                   without changing the desktop/tablet order or the
 *                   underlying data order.
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
    locationEn: 'Herzliya',
    birthDate: '2002-07-23',

    profileImage: '/images/talent/kim-chorilov/profile.jpg',
    // 02 (center) and 03 (right) keep a per-image object-position override
    // to trim excess headroom — the crop window shifts down slightly so the
    // subject sits a bit higher in the 4:5 card. 01 (left) is back on the
    // TalentImage default ('center top') per the earlier revert.
    // 02 also gets a subtle static zoom (--img-scale) layered under the
    // existing hover zoom, independent of its vertical position.
    // 03's upward shift has been re-applied twice more at the same +12pt
    // step (12% → 24% → 36%) to further reduce headroom.
    gallery: [
      '/images/talent/kim-chorilov/gallery/01.jpg',
      { src: '/images/talent/kim-chorilov/gallery/02.jpg', position: 'center 20%', scale: 1.05 },
      { src: '/images/talent/kim-chorilov/gallery/03.jpg', position: 'center 36%' },
      '/images/talent/kim-chorilov/gallery/04.jpg',
      '/images/talent/kim-chorilov/gallery/05.jpg',
      '/images/talent/kim-chorilov/gallery/06.jpg',
    ],

    bioHe: 'יוצרת תוכן, משפיענית ושחקנית. קים פועלת בתחומי הביוטי, האופנה והלייף סטייל ומשלבת בין תוכן יומיומי, המלצות אותנטיות וטרנדים, תוך יצירת חיבור אישי עם קהילת העוקבות שלה. התוכן שלה מאופיין באסתטיקה נקייה, נוכחות טבעית ויכולת לייצר אמון ומעורבות גבוהה.',
    bioEn: 'A content creator, influencer, and actress specializing in beauty, fashion, and lifestyle. Kim combines authentic recommendations, everyday storytelling, and emerging trends to create meaningful connections with her audience. Her content is defined by a clean aesthetic, natural on-screen presence, and strong audience engagement.',

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

    location: 'אזור המרכז',
    locationEn: 'Central District',
    birthDate: '1997-02-23',

    profileImage: '/images/talent/topaz-falah/profile-v2.jpg',
    // Crop focus override — source photo has excess empty space above the
    // head; shift the visible window down to bring her higher in the frame.
    // Nudged from 25% → 35% to trim a bit more headroom (mobile hero in
    // particular had too much empty space above her head); hands remain
    // fully visible since this shifts the crop window up, not down.
    // All other talents keep the TalentImage default ('center top').
    imagePosition: 'center 35%',
    gallery: [
      '/images/talent/topaz-falah/gallery/01.jpg',
      '/images/talent/topaz-falah/gallery/02.JPEG',
      '/images/talent/topaz-falah/gallery/03.jpg',
      '/images/talent/topaz-falah/gallery/04.jpeg',
      // Source photo has excess empty space above the family at the default
      // 'center top' crop; shift the visible window down so the subjects
      // sit higher in the frame (same technique used for gal-azar's gallery).
      { src: '/images/talent/topaz-falah/gallery/05.jpeg', position: 'center bottom' },
      '/images/talent/topaz-falah/gallery/06.jpg',
    ],

    bioHe: 'יוצרת תוכן מובילה בתחום האמהות והלייף סטייל, המביאה למסך את חיי המשפחה האמיתיים בגובה העיניים. בעמודיה היא משתפת ברגעים יום-יומיים ואותנטיים לצד בעלה ניסים והילדים, ומציעה הצצה לשגרת הורות מעוררת השראה, טיפים לחיים ומתכונים ביתיים ונגישים. בזכות אנרגיה חמה וחיבור אמיתי, טופז סחפה אחריה קהילה נאמנה של אמהות ונשים שמחפשות השראה יום-יומית.',
    bioEn: 'A leading motherhood and lifestyle content creator, Topaz shares the realities of family life with authenticity, warmth, and relatability. Through everyday moments with her husband Nissim and their children, she offers parenting inspiration, practical life tips, and easy-to-follow home recipes. Her genuine personality and strong connection with her audience have helped her build a loyal community of mothers and women looking for everyday inspiration.',

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
    locationEn: 'Holon',
    birthDate: '2003-06-02',

    profileImage: '/images/talent/gal-azar/profile-v2.jpg',
    // Gallery photos have generous empty headroom above the subject at the
    // default 'center top' crop; shifting the object-position toward the
    // bottom trims that empty space so subjects sit higher in the 4:5 cards
    // (most noticeable on the 3rd / right-most image in the desktop grid).
    gallery: [
      { src: '/images/talent/gal-azar/gallery/01.jpg', position: 'center bottom' },
      { src: '/images/talent/gal-azar/gallery/02.jpg', position: 'center bottom' },
      { src: '/images/talent/gal-azar/gallery/03.jpg', position: 'center bottom' },
    ],

    bioHe: 'יוצרת תוכן ומשפיענית בתחום הלייף סטייל, אופנה, ביוטי וטרוול. גל ידועה בזכות סרטוני ASMR וטרנדים קולינריים ייחודיים שמתפוצצים ברשת וגורפים מיליוני צפיות. התוכן שלה קריאטיבי, אסתטי ומעורר השראה, והיא מתאפיינת בחשיבה מחוץ לקופסה ורמת הפקה גבוהה שיוצרת חיבור מיידי עם הקהל.',
    bioEn: 'A lifestyle, fashion, beauty, and travel content creator, Gal is best known for her viral ASMR content and unique food trends that have generated millions of views across social media. Her content blends creativity, strong visual storytelling, and high production value, reflecting an innovative approach that consistently captures audience attention and engagement.',

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
    locationEn: 'Hod HaSharon',
    birthDate: '2003-10-24',

    profileImage: '/images/talent/michal-bendavid/profile.jpg',
    gallery: [
      '/images/talent/michal-bendavid/gallery/01.jpg',
      '/images/talent/michal-bendavid/gallery/02.jpg',
      '/images/talent/michal-bendavid/gallery/03.jpg',
    ],

    bioHe: 'יוצרת תוכן ומשפיענית בתחומי הביוטי, האופנה והלייף סטייל, עם זווית בינלאומית ייחודית שמחברת בין התרבות הישראלית לאמריקאית. מיכל מביאה למסך שילוב של סטייל אישי, אותנטיות, הומור ורגעים אמיתיים מחיי היום יום.\nבנוסף, מיכל יוצרת תוכן גם בשפה האנגלית ומנחה את הפודקאסט “Hetzi חצי”, שצבר מיליוני צפיות ברשתות.',
    bioEn: 'Michal is a content creator and influencer in beauty, fashion, and lifestyle, with a distinctive international perspective that bridges Israeli and American culture. Her content blends personal style, authenticity, humor, and genuine everyday moments. In addition to her Hebrew content, Michal also creates content in English and hosts the podcast Hetzi | חצי, which has amassed millions of views across social media.',

    instagram: 'https://www.instagram.com/michalbd1/',
    tiktok:    'https://www.tiktok.com/@michalbd1',
    youtube:   null,

    followers: { instagram: 38_000, tiktok: 284_200, youtube: null },

    // Podcast section — shown only on Michal's profile page.
    // Leave podcastVideoEmbedUrl empty/null to hide the video block.
    // titleEn intentionally omitted: the show title "Hetzi | חצי" is a
    // proper noun and stays the same in both locales (per translation doc).
    podcast: {
      title:       'Hetzi | חצי',
      description: 'מקום שבו האנגלית והעברית נפגשים, כל הבלאגן של חו״ל והארץ הופך לסיפור מעניין, מצחיק וקורע.\nהפודקאסט כבש את הרשת עם מיליוני צפיות והפך לשיחת היום בקרב קהילת העולים הצעירים וגם הישראלים.\nמיכל מארחת בכל שבוע את האנשים הכי מעניינים ברשת לשיחה על המעבר, החיים בישראל, ג׳וס, בלי פילטרים, עם המון הומור ובווייב הכי קליל וכיפי שיש.',
      descriptionEn: 'Where English meets Hebrew and life abroad meets life in Israel. What starts as culture shock, awkward moments, and everyday chaos quickly turns into stories that are funny, relatable, and endlessly entertaining.\nWith millions of views across social media, Hetzi | חצי has become a cultural phenomenon among young immigrants and Israelis alike.\nEvery week, Michal hosts some of the internet’s most interesting personalities for honest conversations about moving to Israel, life between cultures, relationships, hot topics, and all the juicy details, delivered with no filters, plenty of humor, and the most easygoing vibe around.',
      image:       '/images/talent/michal-bendavid/podcast.jpg',
      videoEmbedUrl: 'https://www.youtube.com/embed/uSUlHPMywXM',
    },
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
    locationEn: 'Herzliya',
    birthDate: '2008-01-21',

    profileImage: '/images/talent/emma-weinberg/profile-v2.jpg',
    gallery: [
      '/images/talent/emma-weinberg/gallery/01.jpg',
      '/images/talent/emma-weinberg/gallery/02.jpg',
      '/images/talent/emma-weinberg/gallery/03.jpg',
      '/images/talent/emma-weinberg/gallery/04.jpg',
      '/images/talent/emma-weinberg/gallery/05.jpg',
      '/images/talent/emma-weinberg/gallery/06.jpg',
    ],
    // Mobile-only visual reorder (≤640px): pairs the two beige/tan-backdrop
    // shots (04 + 06) into the same grid row on the 2-column mobile layout.
    // Desktop/tablet order above is untouched — this only feeds the CSS
    // `order` property at the mobile breakpoint (see ProfileGallery).
    // galleryMobileOrder[i] = the order value assigned to gallery[i] on mobile;
    // resulting visual sequence: 01, 02, 03, 05, 04, 06.
    galleryMobileOrder: [0, 1, 2, 4, 3, 5],

    bioHe: 'יוצרת תוכן ומשפיענית בתחום הביוטי פאשן ולייף סטייל. משתפת טיפים יום יומיים, סטיילינג, תוכן הומוריסטי ואת חיי היום יום. לאמה יש קהילת בנות שעוקבות אחרי ההמלצות שלה.',
    bioEn: 'A beauty, fashion, and lifestyle content creator, Emma shares everyday tips, styling inspiration, humor, and authentic moments from her daily life. Her relatable approach and genuine connection with her audience have helped her build a loyal community of young women who regularly engage with her content and recommendations.',

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
    locationEn: "Be'er Ya'akov",
    birthDate: '1996-10-10',

    profileImage: '/images/talent/ordan-nahari/profile.jpg',
    // Crop focus override — source photo has excess empty space above the
    // head; shift the visible window down to bring her higher in the frame.
    // All other talents keep the TalentImage default ('center top').
    imagePosition: 'center 25%',
    gallery: [
      '/images/talent/ordan-nahari/gallery/01.jpg',
      '/images/talent/ordan-nahari/gallery/02.JPG',
      '/images/talent/ordan-nahari/gallery/03.JPG',
      '/images/talent/ordan-nahari/gallery/04.jpg',
      '/images/talent/ordan-nahari/gallery/05.jpg',
      '/images/talent/ordan-nahari/gallery/06.JPG',
    ],

    bioHe: 'יוצרת תוכן מעוררת השראה בתחום האמהות והלייף סטייל. בעמודיה היא מציגה תוכן משפחתי, יום-יומי ואסתטי במיוחד, המשלב את בעלה אורי ושני בניהם. התוכן של אורדן מאופיין בוויב חם, נעים ומזמין, המדגיש את החיבור המשפחתי האמיתי והרגעים הקטנים של החיים בסטייל בלתי מתפשר. בזכות שילוב של אותנטיות ואסתטיקה גבוהה, אורדן מייצרת חיבור עמוק עם קהל של אמהות ונשים.',
    bioEn: 'An inspiring motherhood and lifestyle content creator, Ordan shares beautifully curated family life through authentic and aesthetically driven content. Featuring her husband Uri and their two sons, her content captures the warmth of family connection and the beauty of everyday moments. Defined by a refined aesthetic and genuine storytelling, Ordan has built a meaningful connection with a community of mothers and women who relate to her lifestyle and values.',

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
    locationEn: 'Hadera',
    birthDate: '2003-04-01',

    profileImage: '/images/talent/alma-weizman/profile-v2.jpg',
    gallery: [
      '/images/talent/alma-weizman/gallery/01.jpg',
      '/images/talent/alma-weizman/gallery/02.jpg',
      '/images/talent/alma-weizman/gallery/03.jpg',
    ],

    bioHe: 'יוצרת תוכן בתחומי האופנה, הביוטי, והלייף סטייל. עלמא משלבת בתוכן שלה סטייל אישי, יצירתיות ואסתטיקה חזקה, לצד רגעים מחיי היום-יום.',
    bioEn: 'A fashion, beauty, and lifestyle content creator, Alma combines personal style, creativity, and a distinctive visual aesthetic with authentic moments from everyday life.',

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
    locationEn: 'Kibbutz Dvira',
    birthDate: '1997-08-18',

    profileImage: '/images/talent/shilav-jorin/profile.jpg',
    gallery:      [],

    bioHe: 'יוצרת תוכן ומשפיענית בתחום לייף סטייל, אופנה וזוגיות. בעמודיה היא משתפת את הקהל ברגעים אישיים, לצד סרטוני סיטואציות קריאטיביים והומוריסטיים המציגים את הכימיה המטורפת עם בעלה עידן. שילב מייצרת תוכן זוגי, אותנטי וסוחף בגובה העיניים, שיוצר חיבור מיידי ועמוק עם הקהל שלה.',
    bioEn: 'A lifestyle, fashion, and couples content creator, Shilav shares personal moments alongside creative and humorous videos that highlight the unique chemistry she shares with her husband, Idan. Through authentic, relatable, and engaging content, she offers an honest glimpse into everyday life and relationships, building a strong connection with her audience.',

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
    nameEn: 'Shaked Hodara',

    category: ['content', 'influencer'],
    tags: ['לייף סטייל', 'תיירות', 'אוכל'],

    featured: false,
    sortOrder: 8,

    location: 'בת ים',
    locationEn: 'Bat Yam',
    birthDate: '1999-05-19',

    profileImage: '/images/talent/shaked-hudra/profile-v2.jpg',
    gallery: [
      '/images/talent/shaked-hudra/gallery/01.jpg',
      '/images/talent/shaked-hudra/gallery/02.jpg',
      '/images/talent/shaked-hudra/gallery/03.jpg',
    ],

    bioHe: 'יוצרת תוכן ומשפיענית בתחומי הלייף סטייל, האופנה וה-UGC. שקד מתמחה ביצירת תוכן אותנטי ומדויק עבור מותגים, לצד שיתוף חוויות, המלצות ותוכן יומיומי.',
    bioEn: 'A lifestyle, fashion, and UGC content creator, Shaked specializes in producing authentic and engaging content for brands. Alongside her commercial work, she shares everyday experiences, recommendations, and lifestyle content that resonates with her audience.',

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
    locationEn: 'Holon',
    birthDate: '2002-03-03',

    profileImage: '/images/talent/gal-arad/profile-v2.jpg',
    gallery: [
      '/images/talent/gal-arad/gallery/01.jpg',
      '/images/talent/gal-arad/gallery/02.jpg',
      '/images/talent/gal-arad/gallery/03.jpg',
    ],

    bioHe: 'יוצר תוכן מבטיח ומרענן בעולמות הלייף סטייל והספורט. גל מביא אל הרשת חשיבה מחוץ לקופסה, קריאייטיב מקורי וסרטונים הומוריסטיים שאי אפשר להישאר אליהם אדישים. התוכן שלו מאופיין בוויב סוחף, קליל ומעניין, המשלב בין עולם הספורט לחיי היום-יום בצורה חכמה ומצחיקה. בזכות האנרגיה הייחודית שלו, גל מייצר חיבור מיידי עם הקהל ומסתמן כהבטחה גדולה ברשת.',
    bioEn: 'A rising content creator in the lifestyle and sports space, Gal brings a fresh perspective, original creativity, and a strong sense of humor to his content. His videos combine sports, everyday life, and entertaining storytelling in a way that feels both engaging and relatable. With his distinctive energy and natural on-screen presence, Gal has quickly built a strong connection with his audience and continues to establish himself as an emerging talent in the digital space.',

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
