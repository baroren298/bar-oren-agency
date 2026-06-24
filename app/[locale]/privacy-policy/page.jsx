import { siteConfig } from '@/data/site';
import styles from '@/styles/legal.module.css';

const DESCRIPTION = 'מדיניות הפרטיות של Bar Oren Talent Agency — מה נאסף, כיצד נשמר, ומהן זכויותיכם בהתאם לחוק הגנת הפרטיות הישראלי.';

export const metadata = {
  title: 'מדיניות פרטיות',
  description: DESCRIPTION,
  alternates: { canonical: '/privacy-policy' },
  openGraph: {
    title:       'מדיניות פרטיות | Bar Oren',
    description:  DESCRIPTION,
    url:         '/privacy-policy',
    images:      [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Bar Oren — מדיניות פרטיות' }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'מדיניות פרטיות | Bar Oren',
    description:  DESCRIPTION,
    images:      [{ url: '/og-image.jpg', alt: 'Bar Oren — מדיניות פרטיות' }],
  },
};

export default function PrivacyPolicyPage() {
  const { email, address } = siteConfig.contact;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className="container">
          <h1 className={styles.pageTitle}>מדיניות פרטיות</h1>
        </div>
      </div>

      <div className="container">
        <div className={styles.content}>
          <p className={styles.updated}>עודכן לאחרונה: יוני 2026</p>

          <p>
            מדיניות פרטיות זו מתארת כיצד Bar Oren Talent Agency ("הסוכנות",
            "אנחנו") אוספת, משתמשת ומגנה על המידע האישי שמוסר לנו דרך האתר{' '}
            <a href={siteConfig.meta.url}>{siteConfig.meta.url}</a>.
            השימוש באתר מהווה הסכמה למדיניות זו.
          </p>

          <h2>מידע שאנו אוספים</h2>
          <p>אנו אוספים מידע רק כאשר אתם פונים אלינו ישירות:</p>
          <ul>
            <li>
              <strong>טופס יצירת קשר</strong> — שם מלא, כתובת אימייל, מספר
              טלפון (אופציונלי) והודעה שנשלחים מרצונכם החופשי.
            </li>
            <li>
              <strong>WhatsApp / אימייל ישיר</strong> — פרטי התקשרות שמוסרים
              במהלך שיחה ישירה עם הסוכנות.
            </li>
          </ul>
          <p>
            אין אנו אוספים קובצי Cookie, נתוני גלישה, כתובות IP לצרכי מעקב,
            או כל מידע אחר ללא ידיעתכם.
          </p>

          <h2>מטרת השימוש במידע</h2>
          <p>המידע שנמסר משמש אך ורק:</p>
          <ul>
            <li>למענה לפנייתכם — שיתופי פעולה, קאסטינג, שאלות כלליות</li>
            <li>לניהול קשר עסקי שוטף עם מיוצגים ושותפים</li>
          </ul>
          <p>לא נשתמש במידעכם לצרכי שיווק ישיר ללא הסכמתכם המפורשת.</p>

          <h2>שיתוף מידע עם צדדים שלישיים</h2>
          <p>
            אנו לא מוכרים, סוחרים או מעבירים את פרטיכם לגורמים חיצוניים, למעט:
          </p>
          <ul>
            <li>
              <strong>WhatsApp (Meta Platforms)</strong> — כאשר אתם יוזמים שיחה
              דרך הקישור באתר, תוכן השיחה כפוף למדיניות הפרטיות של Meta.
            </li>
            <li>
              ספקי שירות טכנולוגיים הנדרשים להפעלת האתר (Vercel לאירוח),
              שמחויבים לסודיות.
            </li>
            <li>
              גורמים מוסמכים על פי חוק, אם נדרש על ידי רשות מוסמכת.
            </li>
          </ul>

          <h2>אבטחת מידע</h2>
          <p>
            האתר פועל תחת חיבור מאובטח (HTTPS). המידע שנשלח בטופס יצירת הקשר
            מועבר באופן מוצפן. אנו נוקטים אמצעי זהירות סבירים לשמירה על המידע,
            אולם אין ביכולתנו להבטיח אבטחה מוחלטת של כל העברת מידע.
          </p>

          <h2>שמירת מידע</h2>
          <p>
            מידע שנמסר בטופס יצירת קשר נשמר רק כל עוד הוא רלוונטי לצורך שלשמו
            נמסר, ולא מעבר לכך. ניתן לבקש מחיקת המידע בכל עת.
          </p>

          <h2>זכויותיכם</h2>
          <p>
            בהתאם לחוק הגנת הפרטיות, התשמ"א-1981, עומדות לכם הזכויות הבאות:
          </p>
          <ul>
            <li>לעיין במידע שנשמר אודותיכם</li>
            <li>לבקש תיקון מידע שגוי</li>
            <li>לבקש מחיקת מידעכם</li>
          </ul>
          <p>
            לממוש זכויות אלו, פנו אלינו בכתב לכתובת האימייל המופיעה למטה.
          </p>

          <h2>שינויים במדיניות</h2>
          <p>
            אנו עשויים לעדכן מדיניות זו מעת לעת. השינויים ייכנסו לתוקף עם
            פרסומם בעמוד זה. ממשיכים להשתמש באתר לאחר עדכון המדיניות? הרי זו
            הסכמה לתנאים המעודכנים.
          </p>

          <h2>יצירת קשר</h2>
          <p>לכל שאלה בנושא פרטיות, ניתן לפנות אלינו:</p>
          <ul>
            <li>
              אימייל:{' '}
              <a href={`mailto:${email}`} aria-label={`שלח אימייל ל-${email}`}>
                {email}
              </a>
            </li>
            {address && <li>כתובת: {address}</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
