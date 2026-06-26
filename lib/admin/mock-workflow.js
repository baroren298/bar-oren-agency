import { he } from "./i18n/he";

/*
 * Mock "My Work" workflow data — Phase 2 (Agency Workflow) foundation.
 *
 * Local, hardcoded stand-in for what will eventually be a real query
 * against the Core Content Engine (proposals/versions across Talent, Site
 * Content, SEO, etc. — see lib/admin/README.md). No database, no Prisma,
 * no API route: app/admin/my-work/page.jsx imports straight from this file,
 * the same "Presentation layer can read directly" pattern already used by
 * app/admin/talent/page.jsx for real data.
 *
 * Kept deliberately separate from any page component per this sprint's
 * architecture request, so the mock array itself isn't buried inside JSX,
 * and so swapping this file's exports for a real data-fetch later (e.g.
 * `versionService.listForOwner()`) doesn't touch the page's rendering code
 * at all — the page only ever consumes WORKFLOW_STATUS, STATUS_LABEL,
 * STATUS_TONE, and getWorkflowSections().
 *
 * WORKFLOW_STATUS values are plain readable strings chosen to map 1:1 onto
 * future real DB statuses (e.g. a TalentVersion/Proposal `status` column):
 *   draft               -> DRAFT
 *   waiting_for_approval -> PROPOSED
 *   changes_requested   -> REJECTED (with a rejectionNote)
 *   approved            -> APPROVED (approved, not yet live)
 *   published           -> PUBLISHED
 */

export const WORKFLOW_STATUS = {
  DRAFT: "draft",
  WAITING_FOR_APPROVAL: "waiting_for_approval",
  CHANGES_REQUESTED: "changes_requested",
  APPROVED: "approved",
  PUBLISHED: "published",
};

export const STATUS_LABEL = {
  [WORKFLOW_STATUS.DRAFT]: he.workflow.statusLabel.draft,
  [WORKFLOW_STATUS.WAITING_FOR_APPROVAL]: he.workflow.statusLabel.waiting_for_approval,
  [WORKFLOW_STATUS.CHANGES_REQUESTED]: he.workflow.statusLabel.changes_requested,
  [WORKFLOW_STATUS.APPROVED]: he.workflow.statusLabel.approved,
  [WORKFLOW_STATUS.PUBLISHED]: he.workflow.statusLabel.published,
};

// Maps each status onto an existing StatusBadge tone (components/admin/StatusBadge.jsx).
// Purely presentational — no business meaning beyond "how should this read at a glance".
export const STATUS_TONE = {
  [WORKFLOW_STATUS.DRAFT]: "neutral",
  [WORKFLOW_STATUS.WAITING_FOR_APPROVAL]: "warning",
  [WORKFLOW_STATUS.CHANGES_REQUESTED]: "danger",
  [WORKFLOW_STATUS.APPROVED]: "info",
  [WORKFLOW_STATUS.PUBLISHED]: "success",
};

// Item "type" is a free-text category today (Talent Profile, Gallery Update,
// Site Content, SEO, ...) — not yet tied to lib/admin/constants/enums.js's
// EntityType, since several of these (Gallery Update, SEO) don't have a
// real adapter/entity yet. Revisit once more adapters exist.
const MOCK_WORKFLOW_ITEMS = [
  {
    id: "wf-1",
    title: "מאיה כהן — עריכת ביוגרפיה",
    type: "פרופיל מיוצג",
    status: WORKFLOW_STATUS.DRAFT,
    lastUpdated: "2026-06-24",
    owner: "נועה לוי",
    description: "כתיבת ביוגרפיה מעודכנת וחיתוך תמונת פרופיל; עדיין לא מוכן להגשה לבדיקה.",
  },
  {
    id: "wf-2",
    title: "עדכון גלריית קיץ 2026",
    type: "עדכון גלריה",
    status: WORKFLOW_STATUS.DRAFT,
    lastUpdated: "2026-06-22",
    owner: "איתי בן־דוד",
    description: "בחירה וסידור של תמונות קמפיין חדשות לפני שליחה לאישור.",
  },
  {
    id: "wf-3",
    title: "דניאל אזולאי — פרופיל מיוצג חדש",
    type: "פרופיל מיוצג",
    status: WORKFLOW_STATUS.WAITING_FOR_APPROVAL,
    lastUpdated: "2026-06-23",
    owner: "נועה לוי",
    description: "פרופיל מלא הוגש לבדיקת הבעלים — ביוגרפיה, נתונים ושלוש תמונות חדשות.",
  },
  {
    id: "wf-4",
    title: "עדכון טקסט ראשי בעמוד הבית",
    type: "תוכן האתר",
    status: WORKFLOW_STATUS.WAITING_FOR_APPROVAL,
    lastUpdated: "2026-06-21",
    owner: "שיר מזרחי",
    description: "הוגשו כותרת ותת־כותרת מעודכנות לעמוד הבית.",
  },
  {
    id: "wf-5",
    title: "תיאורי מטא לרשימת המיוצגים",
    type: "SEO",
    status: WORKFLOW_STATUS.CHANGES_REQUESTED,
    lastUpdated: "2026-06-20",
    owner: "שיר מזרחי",
    description: "הבעלים בקש תיאורי מטא קצרים יותר (מתחת ל־155 תווים) ב־4 פרופילים.",
  },
  {
    id: "wf-6",
    title: "ליאור כץ — מידות מעודכנות",
    type: "פרופיל מיוצג",
    status: WORKFLOW_STATUS.CHANGES_REQUESTED,
    lastUpdated: "2026-06-19",
    owner: "איתי בן־דוד",
    description: "הבעלים סימן אי־התאמה לגיליון הפנימי של הסוכנות — דורש בדיקה חוזרת לפני הגשה מחדש.",
  },
  {
    id: "wf-7",
    title: "עדכון כתובת בעמוד צור קשר",
    type: "תוכן האתר",
    status: WORKFLOW_STATUS.APPROVED,
    lastUpdated: "2026-06-18",
    owner: "נועה לוי",
    description: "אושר על־ידי הבעלים; ממתין לפרסום בסבב הבא.",
  },
  {
    id: "wf-8",
    title: "מאיה כהן — סט תמונות פרופיל",
    type: "פרופיל מיוצג",
    status: WORKFLOW_STATUS.PUBLISHED,
    lastUpdated: "2026-06-15",
    owner: "נועה לוי",
    description: "באוויר באתר הציבורי מה־15 ביוני.",
  },
];

// The four "My Work" sections, in display order, with the items already
// filtered+sorted (most recently updated first) for each. Approved and
// Published are intentionally combined into one section per this sprint's
// requirements (section 4: "Approved / Published").
export function getWorkflowSections(items = MOCK_WORKFLOW_ITEMS) {
  const byRecency = (a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated);

  return [
    {
      key: "draft",
      label: he.workflow.sections.draft.label,
      description: he.workflow.sections.draft.description,
      items: items.filter((item) => item.status === WORKFLOW_STATUS.DRAFT).sort(byRecency),
    },
    {
      key: "waiting_for_approval",
      label: he.workflow.sections.waiting_for_approval.label,
      description: he.workflow.sections.waiting_for_approval.description,
      items: items
        .filter((item) => item.status === WORKFLOW_STATUS.WAITING_FOR_APPROVAL)
        .sort(byRecency),
    },
    {
      key: "changes_requested",
      label: he.workflow.sections.changes_requested.label,
      description: he.workflow.sections.changes_requested.description,
      items: items
        .filter((item) => item.status === WORKFLOW_STATUS.CHANGES_REQUESTED)
        .sort(byRecency),
    },
    {
      key: "approved_published",
      label: he.workflow.sections.approved_published.label,
      description: he.workflow.sections.approved_published.description,
      items: items
        .filter(
          (item) =>
            item.status === WORKFLOW_STATUS.APPROVED || item.status === WORKFLOW_STATUS.PUBLISHED
        )
        .sort(byRecency),
    },
  ];
}

export default MOCK_WORKFLOW_ITEMS;
