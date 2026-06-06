import { siteConfig } from '@/data/site';
import styles from '@/styles/legal.module.css';

const DESCRIPTION = 'הצהרת נגישות של Bar Oren Talent Agency — מחויבותנו לנגישות דיגיטלית, תאימות WCAG 2.1 ואפשרויות יצירת קשר לדיווח על בעיות נגישות.';

export const metadata = {
  title: 'הצהרת נגישות',
  description: DESCRIPTION,
  alternates: { canonical: '/accessibility' },
  openGraph: {
    title:       'הצהרת נגישות | Bar Oren',
    description:  DESCRIPTION,
    url:         '/accessibility',
    images:      [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Bar Oren — הצהרת נגישות' }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'הצהרת נגישות | Bar Oren',
    description:  DESCRIPTION,
    images:      ['/og-image.jpg'],
  },
};

export default function AccessibilityPage() {
  const { email } = siteConfig.contact;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className="container">
          <h1 className={styles.pageTitle}>הצהרת נגישות</h1>
        </div>
      </div>

      <div className="container">
        <div className={styles.content}>
          <p className={styles.updated}>עודכן לאחרונה: יוני 2026</p>

          <p>
            Bar Oren Talent Agency מחויבת להנגיש את האתר לכלל המשתמשים, לרבות
            אנשים עם מוגבלויות. אנו פועלים בהתאם לתקן הנגישות הבינלאומי
            WCAG 2.1 ברמה AA ולדרישות חוק שוויון זכויות לאנשים עם מוגבלות,
            התשנ"ח-1998.
          </p>

          <h2>מה ביצענו</h2>
          <ul>
            <li>מבנה HTML סמנטי עם היררכיית כותרות ברורה (H1–H3)</li>
            <li>תוויות ARIA וטקסט חלופי לכל התמונות הפונקציונליות</li>
            <li>ניווט מקלדת מלא — כל הפעולות נגישות ללא עכבר</li>
            <li>מחוון מיקוד גלוי בכל אלמנט אינטראקטיבי</li>
            <li>ניהול מיקוד בחלונות מודאל — פתיחה, מלכוד, סגירה והחזרת מיקוד</li>
            <li>תמיכה בכיוון RTL ובשפה העברית</li>
            <li>יחסי ניגוד צבע העומדים בדרישות WCAG AA</li>
            <li>טופס יצירת קשר עם תוויות, הודעות שגיאה ותכונת <code>required</code></li>
            <li>קישור "דלג לתוכן" בראש כל עמוד</li>
          </ul>

          <h2>טכנולוגיות נשענות</h2>
          <p>
            האתר בנוי עם Next.js ומשתמש ב-HTML סמנטי, CSS לעיצוב ו-JavaScript
            לאינטראקציות. האתר תומך בקוראי מסך כגון VoiceOver (macOS / iOS)
            ו-NVDA (Windows) ובדפדפנים מודרניים.
          </p>

          <h2>מגבלות ידועות</h2>
          <p>
            אנו עובדים באופן שוטף על שיפור הנגישות. אם נתקלתם בקושי כלשהו
            בגישה לתוכן, נשמח לשמוע ולטפל בכך בהקדם.
          </p>

          <h2>יצירת קשר בנושא נגישות</h2>
          <p>
            לדיווח על בעיית נגישות, בקשה לתוכן בפורמט חלופי, או כל שאלה בנושא —
            ניתן לפנות אלינו:
          </p>
          <ul>
            <li>
              אימייל:{' '}
              <a href={`mailto:${email}`} aria-label={`שלח אימייל לנגישות ל-${email}`}>
                {email}
              </a>
            </li>
          </ul>
          <p>נשתדל להשיב תוך 5 ימי עסקים.</p>
        </div>
      </div>
    </div>
  );
}
