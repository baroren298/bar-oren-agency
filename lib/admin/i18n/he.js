/*
 * Hebrew admin UI strings — Admin Hebrew + Friendly Home sprint.
 *
 * Single source of truth for admin-facing copy so labels aren't hardcoded
 * inside individual components/pages. The admin UI is Hebrew-only today
 * (see app/admin/layout.jsx: lang="he" dir="rtl"), but keeping the strings
 * in one plain object — rather than scattering them across JSX — means a
 * future `en.js` + a small lookup-by-locale helper can be added later
 * without rewriting every screen. No language switcher, no locale
 * detection, no i18n library: just a flat object, per this sprint's scope.
 */

export const he = {
  nav: {
    dashboard: "לוח בקרה",
    myWork: "המשימות שלי",
    talent: "מיוצגים",
  },

  roles: {
    owner: "בעלים",
    employee: "עובד",
  },

  shell: {
    brand: "בר אורן — ניהול",
    headerTitle: "ניהול סוכנות בר אורן",
    logout: "התנתק",
    loggingOut: "מתנתק…",
  },

  workflow: {
    statusLabel: {
      draft: "טיוטה",
      waiting_for_approval: "ממתינים לאישור",
      changes_requested: "נדרשו תיקונים",
      approved: "אושר",
      published: "פורסם",
    },
    sections: {
      draft: {
        label: "טיוטות",
        description: "עבודה בתהליך שעדיין לא הוגשה.",
      },
      waiting_for_approval: {
        label: "ממתינים לאישור",
        description: "הוגש וממתין לבדיקת הבעלים.",
      },
      changes_requested: {
        label: "נדרשו תיקונים",
        description: "הוחזר עם הערות — דורש עוד סבב לפני הגשה חוזרת.",
      },
      approved_published: {
        label: "אושרו / פורסמו",
        description: "אושר על־ידי הבעלים, כולל כל מה שכבר באוויר.",
      },
    },
    emptyState: {
      title: "אין כאן כלום כרגע",
      description: (sectionLabel) => `אין פריטים כרגע בקטגוריית "${sectionLabel}".`,
    },
  },

  meta: {
    status: "סטטוס",
    type: "סוג",
    lastUpdated: "עודכן לאחרונה",
    assignedTo: "בטיפול של",
    submittedBy: "נשלח על־ידי",
  },

  dashboard: {
    greeting: (firstName) => `שלום ${firstName} 👋`,
    subline: "הנה מה שמחכה לטיפול היום.",
    summary: {
      waitingForApproval: "ממתינים לאישור",
      changesRequested: "נדרשו תיקונים",
      recentlyPublished: "פורסמו לאחרונה",
    },
  },

  // Profile Editor Foundation sprint — generic copy for any "Current
  // Published / Proposed Update" editor (ComparisonView + its helper note
  // and action bar). Lives here rather than under `talent` because it's
  // entity-agnostic: the same three button labels and the same reassuring
  // note apply whether the editor is for talent details, gallery, SEO, or
  // anything else added later.
  editor: {
    actions: {
      cancel: "ביטול שינויים",
      saveDraft: "שמור כטיוטה",
      submit: "שלח לאישור",
    },
    comingSoon: "האפשרות הזו תתחבר בספרינט עתידי.",
    helperNote: {
      body: "זה עדכון מוצע — שום דבר לא מתפרסם באתר לפני שהבעלים מאשר אותו. אפשר לשמור כטיוטה ולהמשיך בכל שלב, אין צורך לסיים הכול בבת אחת.",
    },
  },

  // Talent Workspace Foundation sprint — list + detail copy. Reuses
  // workflow.statusLabel above for the status badge text rather than
  // redefining the same four labels twice.
  talent: {
    list: {
      title: "מיוצגים",
      description: "תור העבודה של כל הפרופילים — מי פורסם, מי מחכה לאישור, ומי עדיין בעבודה.",
      emptyTitle: "אין עדיין מיוצגים",
      emptyDescription: "כשיתחילו להתווסף פרופילים, הם יופיעו כאן כתור עבודה.",
      dbNotConfiguredTitle: "מסד הנתונים עדיין לא מחובר",
      dbNotConfiguredDescription: "אזור המיוצגים יתעורר לחיים לאחר חיבור מסד הנתונים.",
      openFolder: "פתח תיק",
    },
    detail: {
      backToList: "← חזרה למיוצגים",
      notFoundDescription: "המיוצג הזה לא נמצא.",
      dbNotConfiguredDescription: "מסד הנתונים עדיין לא מחובר.",
      slug: "כתובת (Slug)",
      visibilityStatus: "סטטוס נראות",
      technicalInfo: "מידע טכני",
      technicalInfoHint: "פרטים פנימיים — לשימוש טכני בלבד",
      noPublishedVersionTitle: "אין עדיין גרסה מפורסמת",
      noPublishedVersionDescription: "כשתאושר ותתפרסם גרסה ראשונה, הפרטים שלה יוצגו כאן.",
      rejectionNote: "הערת תיקון מהבעלים",
    },
    meta: {
      lastUpdated: "עודכן לאחרונה",
      noDateYet: "—",
      noPublishedVersion: "אין עדיין גרסה מפורסמת",
      pendingChanges: "יש גרסה בעבודה שמחכה לבדיקה",
      changesRequested: "הוחזר עם הערות לתיקון",
      upToDate: "התוכן המפורסם עדכני",
    },
    sections: {
      details: "פרטים",
      gallery: "גלריה",
      socials: "רשתות",
      seo: "SEO",
      history: "היסטוריה",
    },
    sectionPlaceholder: {
      title: "האזור הזה בבנייה",
      description: (label) => `מסך "${label}" יתחבר בספרינט עתידי — המבנה כבר מוכן לקבל אותו.`,
    },
    // Profile Editor Foundation sprint — field group labels for the
    // פרטים editor, so name/featured, bio, category/tags, and
    // location read as distinct sections instead of one long list.
    detailGroups: {
      basic: "מידע בסיסי",
      bio: "ביוגרפיה",
      categories: "קטגוריות / תגיות",
      location: "מיקום וגיל",
    },
    fields: {
      name: "שם",
      nameEn: "שם (אנגלית)",
      category: "קטגוריה",
      tags: "תגיות",
      location: "מיקום",
      locationEn: "מיקום (אנגלית)",
      featured: "מומלץ",
      bio: "ביוגרפיה",
      bioEn: "ביוגרפיה (אנגלית)",
      yes: "כן",
      no: "לא",
      empty: "—",
    },
  },
};

export default he;
