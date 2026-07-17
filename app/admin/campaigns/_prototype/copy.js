/*
 * ============================================================================
 * PROTOTYPE ONLY — Sprint 8A (Campaigns UI Prototype).
 * ============================================================================
 *
 * Hebrew copy for the Campaigns prototype screens. Deliberately kept OUT of
 * lib/admin/i18n/he.js (the admin's single source of truth for copy) so the
 * entire prototype — data, copy, and screens — deletes cleanly when the
 * real Campaigns module is built. When Campaigns graduates to a real
 * module, merge this object into he.js as `campaigns` and delete this file.
 * Only the nav item + talent-tab labels live in he.js (they touch shared
 * components).
 *
 * Status label maps are keyed by the enum-like constants in
 * campaignPrototypeData.js. The lists are still under product validation —
 * keep them easy to revise.
 */

import {
  BUSINESS_STATUS,
  OPERATIONAL_STATUS,
  APPROVAL_STATUS,
  DELIVERABLE_TYPE,
} from "./campaignPrototypeData";

export const campaignsCopy = {
  title: "קמפיינים",
  description: "ניהול קמפיינים לפי לקוח ומותג. (אב-טיפוס — נתוני דמו בלבד)",
  prototypeNote: "תצוגת אב-טיפוס: כל הנתונים במסך זה הם נתוני דמו מקומיים ואינם נשמרים.",

  searchPlaceholder: "חיפוש לפי לקוח, מותג או שם קמפיין…",
  noSearchResults: "לא נמצאו קמפיינים התואמים את החיפוש והסינון.",
  emptyTitle: "אין עדיין קמפיינים",
  emptyDescription: "צרו את הקמפיין הראשון כדי להתחיל.",
  emptyCta: "צור קמפיין ראשון",
  newCampaign: "+ קמפיין חדש",

  filters: {
    month: "חודש קמפיין",
    client: "לקוח",
    brand: "מותג",
    status: "סטטוס עסקי",
    all: "הכל",
    clear: "נקה סינון",
  },

  table: {
    client: "לקוח",
    brand: "מותג",
    campaign: "קמפיין",
    month: "חודש קמפיין",
    status: "סטטוס",
    talentsCount: "מיוצגים",
    actions: "פעולות",
    view: "פרטים",
  },

  businessStatus: {
    [BUSINESS_STATUS.LEAD]: "ליד",
    [BUSINESS_STATUS.NEGOTIATION]: "משא ומתן",
    [BUSINESS_STATUS.CLOSED]: "נסגר",
    [BUSINESS_STATUS.CANCELLED]: "בוטל",
  },
  // StatusBadge tone per business status (caller decides tone, per the
  // component's contract).
  businessStatusTone: {
    [BUSINESS_STATUS.LEAD]: "info",
    [BUSINESS_STATUS.NEGOTIATION]: "warning",
    [BUSINESS_STATUS.CLOSED]: "success",
    [BUSINESS_STATUS.CANCELLED]: "neutral",
  },

  operationalStatus: {
    [OPERATIONAL_STATUS.WAITING_CONTENT]: "ממתין לתוכן",
    [OPERATIONAL_STATUS.WAITING_APPROVAL]: "ממתין לאישור",
    [OPERATIONAL_STATUS.LIVE]: "באוויר",
    [OPERATIONAL_STATUS.COMPLETED]: "הושלם",
  },
  operationalStatusTone: {
    [OPERATIONAL_STATUS.WAITING_CONTENT]: "warning",
    [OPERATIONAL_STATUS.WAITING_APPROVAL]: "info",
    [OPERATIONAL_STATUS.LIVE]: "success",
    [OPERATIONAL_STATUS.COMPLETED]: "neutral",
  },

  approvalStatus: {
    [APPROVAL_STATUS.DRAFT]: "טיוטה",
    [APPROVAL_STATUS.SUBMITTED]: "הוגש לאישור",
    [APPROVAL_STATUS.APPROVED]: "אושר",
    [APPROVAL_STATUS.RETURNED]: "הוחזר לתיקון",
  },
  approvalStatusTone: {
    [APPROVAL_STATUS.DRAFT]: "neutral",
    [APPROVAL_STATUS.SUBMITTED]: "info",
    [APPROVAL_STATUS.APPROVED]: "success",
    [APPROVAL_STATUS.RETURNED]: "warning",
  },

  deliverableType: {
    [DELIVERABLE_TYPE.INSTAGRAM_REEL]: "רילס באינסטגרם",
    [DELIVERABLE_TYPE.STORY_SEQUENCE]: "רצף סטוריז",
    [DELIVERABLE_TYPE.REMINDER_STORY]: "סטורי תזכורת",
    [DELIVERABLE_TYPE.TIKTOK]: "טיקטוק",
    [DELIVERABLE_TYPE.POST]: "פוסט",
    [DELIVERABLE_TYPE.YOUTUBE]: "יוטיוב",
    [DELIVERABLE_TYPE.UGC]: "תוכן UGC",
    [DELIVERABLE_TYPE.OTHER]: "אחר",
  },

  detail: {
    backToList: "→ חזרה לרשימת הקמפיינים",
    notFoundTitle: "הקמפיין לא נמצא",
    notFoundDescription:
      "באב-טיפוס זה קמפיינים שנוצרו מקומית אינם נשמרים לאחר רענון הדף. חזרו לרשימת הקמפיינים.",
    // Hierarchy line: Client → Brand → Campaign
    hierarchySeparator: "‹",
    tabs: {
      details: "פרטים",
      talents: "מיוצגים",
      deliverables: "תוצרים",
      notes: "הערות",
      history: "היסטוריה",
    },
    fields: {
      client: "לקוח",
      brand: "מותג",
      name: "שם הקמפיין",
      month: "חודש קמפיין",
      // Provisional label on purpose — the meaning of this date has NOT
      // been finalized (it is NOT defined as a publication date).
      relevantDate: "תאריך רלוונטי (שדה זמני)",
      businessStatus: "סטטוס עסקי",
      operationalStatus: "סטטוס תפעולי",
      approvalStatus: "סטטוס אישור",
      talentsCount: "מספר מיוצגים",
    },
    talents: {
      empty: "אין מיוצגים המשויכים לקמפיין זה.",
      mediaMix: "תמהיל מדיה",
      operationalStatus: "סטטוס תפעולי",
      notes: "הערות",
      noNotes: "—",
      deliverablesTitle: "תוצרים של המיוצג/ת",
    },
    deliverables: {
      empty: "אין עדיין תוצרים בקמפיין זה.",
      table: {
        talent: "מיוצג/ת",
        type: "פלטפורמה / סוג",
        quantity: "כמות",
        description: "תיאור / הנחיות",
        status: "סטטוס",
        notes: "הערות",
      },
    },
    notes: {
      empty: "אין עדיין הערות לקמפיין זה.",
      addPlaceholder: "הוספת הערה (לא נשמר לאחר רענון)…",
      addButton: "הוסף הערה",
    },
    history: {
      empty: "אין עדיין היסטוריה לקמפיין זה.",
    },
  },

  talentTab: {
    demoNote:
      "תצוגת אב-טיפוס: הקמפיינים המוצגים כאן הם נתוני דמו מקומיים המשויכים למיוצג/ת דמו — לא נתונים אמיתיים של פרופיל זה.",
    empty: "אין קמפיינים המשויכים למיוצג/ת זה/זו.",
    addCampaign: "+ הוסף קמפיין",
    table: {
      client: "לקוח",
      brand: "מותג",
      campaign: "קמפיין",
      month: "חודש קמפיין",
      mediaMix: "תמהיל מדיה",
      status: "סטטוס",
      view: "פרטים",
    },
  },

  form: {
    title: "קמפיין חדש (אב-טיפוס)",
    note: "טופס אב-טיפוס — הקמפיין יתווסף לרשימה המקומית בלבד ולא יישמר לאחר רענון.",
    fields: {
      client: "לקוח",
      clientPlaceholder: "בחרו לקוח…",
      brand: "מותג",
      brandPlaceholder: "בחרו מותג…",
      brandDisabledHint: "בחרו קודם לקוח",
      name: "שם הקמפיין",
      namePlaceholder: "לדוגמה: השקת קיץ",
      month: "חודש קמפיין",
      relevantDate: "תאריך רלוונטי (שדה זמני)",
      businessStatus: "סטטוס עסקי",
      talents: "מיוצגים בקמפיין",
      talentsHint: "ניתן לבחור יותר ממיוצג/ת אחד/ת.",
      currentTalentTag: "נבחר/ה מראש",
    },
    perTalent: {
      title: (name) => `תוצרים וסטטוס — ${name}`,
      operationalStatus: "סטטוס תפעולי",
      addDeliverable: "+ הוסף תוצר",
      removeDeliverable: "הסר",
      type: "פלטפורמה / סוג",
      quantity: "כמות",
      description: "תיאור / הנחיות",
      deliverableStatus: "סטטוס",
      noDeliverables: "אין עדיין תוצרים — הוסיפו תוצר ראשון.",
    },
    errors: {
      clientRequired: "יש לבחור לקוח.",
      brandRequired: "יש לבחור מותג.",
      nameRequired: "יש להזין שם קמפיין.",
      talentsRequired: "יש לבחור לפחות מיוצג/ת אחד/ת.",
    },
    submit: "צור קמפיין",
    cancel: "ביטול",
  },
};

export default campaignsCopy;
