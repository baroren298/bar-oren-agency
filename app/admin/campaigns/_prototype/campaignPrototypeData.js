/*
 * ============================================================================
 * PROTOTYPE ONLY — Sprint 8A (Campaigns UI Prototype).
 * ============================================================================
 *
 * Fake, in-memory demo data + a tiny module-scope store for the Campaigns
 * UI prototype. NOTHING here touches Prisma, the database, or any API
 * route — and nothing here may ever be imported by production data code.
 *
 * How persistence works (and deliberately doesn't):
 *   - The store is a plain module-scope array seeded from DEMO_CAMPAIGNS.
 *   - Client-side navigations (next/link, router.push) keep the same JS
 *     module instance alive, so a campaign created in the New Campaign flow
 *     IS visible on its detail page and in the talent tab.
 *   - A hard refresh re-evaluates the module and resets to the seed data.
 *     That is intentional and allowed by the sprint ("No data needs to
 *     survive a page refresh").
 *
 * Every name below is clearly fake ("לקוח דמו", "מיוצג דמו") — no real
 * client, brand, campaign, pricing, or commercial information.
 *
 * When the real Campaigns backend sprint happens, this entire _prototype/
 * folder is deleted and replaced by real services — the UI components were
 * written against the shapes here so the swap is contained.
 */

/* ---------------------------------------------------------------------- */
/* Status vocabularies — still under product validation, keep easy to edit */
/* ---------------------------------------------------------------------- */

// Business status — the commercial state of the deal.
export const BUSINESS_STATUS = {
  LEAD: "LEAD",
  NEGOTIATION: "NEGOTIATION",
  CLOSED: "CLOSED",
  CANCELLED: "CANCELLED",
};

// Operational status — the execution state of the work.
export const OPERATIONAL_STATUS = {
  WAITING_CONTENT: "WAITING_CONTENT",
  WAITING_APPROVAL: "WAITING_APPROVAL",
  LIVE: "LIVE",
  COMPLETED: "COMPLETED",
};

// Approval workflow (future EMPLOYEE draft → OWNER approval). Visual only
// in this sprint — no authorization or backend workflow logic.
export const APPROVAL_STATUS = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  RETURNED: "RETURNED",
};

// Deliverable platform/type. UGC/OTHER intentionally included — the list
// is a prototype vocabulary, not a schema.
export const DELIVERABLE_TYPE = {
  INSTAGRAM_REEL: "INSTAGRAM_REEL",
  STORY_SEQUENCE: "STORY_SEQUENCE",
  REMINDER_STORY: "REMINDER_STORY",
  TIKTOK: "TIKTOK",
  POST: "POST",
  YOUTUBE: "YOUTUBE",
  UGC: "UGC",
  OTHER: "OTHER",
};

/* ---------------------------------------------------------------------- */
/* Demo entities (all fake)                                               */
/* ---------------------------------------------------------------------- */

export const DEMO_CLIENTS = [
  {
    id: "demo-client-a",
    name: "לקוח דמו א׳",
    brands: [
      { id: "demo-brand-summer", name: "מותג דמו קיץ" },
      { id: "demo-brand-winter", name: "מותג דמו חורף" },
    ],
  },
  {
    id: "demo-client-b",
    name: "לקוח דמו ב׳",
    brands: [{ id: "demo-brand-sport", name: "מותג דמו ספורט" }],
  },
  {
    id: "demo-client-c",
    name: "לקוח דמו ג׳",
    brands: [
      { id: "demo-brand-beauty", name: "מותג דמו יופי" },
      { id: "demo-brand-home", name: "מותג דמו בית" },
    ],
  },
];

export const DEMO_TALENTS = [
  { id: "demo-talent-1", name: "מיוצגת דמו 1" },
  { id: "demo-talent-2", name: "מיוצג דמו 2" },
  { id: "demo-talent-3", name: "מיוצגת דמו 3" },
  { id: "demo-talent-4", name: "מיוצג דמו 4" },
];

/*
 * The talent-profile Campaigns tab aliases whichever real talent is open
 * to this fixed demo talent, so the tab always has meaningful demo rows to
 * evaluate. See TalentCampaignsTab.jsx.
 */
export const CURRENT_PROFILE_DEMO_TALENT_ID = "demo-talent-1";

/* ---------------------------------------------------------------------- */
/* Seed campaigns                                                          */
/* ---------------------------------------------------------------------- */

/*
 * Campaign shape (prototype contract for all Sprint 8A UI):
 * {
 *   id, clientId, brandId, name,
 *   month: "YYYY-MM",
 *   relevantDate: "YYYY-MM-DD" | null,   // provisional field, meaning TBD
 *   businessStatus, operationalStatus, approvalStatus,
 *   notes: string[],
 *   participants: [{
 *     talentId, operationalStatus, notes,
 *     deliverables: [{ id, type, quantity, description, status, notes }]
 *   }],
 *   history: [{ id, date: "YYYY-MM-DD", text }]
 * }
 */
const SEED_CAMPAIGNS = [
  {
    id: "demo-campaign-1",
    clientId: "demo-client-a",
    brandId: "demo-brand-summer",
    name: "השקת קיץ (דמו)",
    month: "2026-06",
    relevantDate: "2026-06-15",
    businessStatus: BUSINESS_STATUS.CLOSED,
    operationalStatus: OPERATIONAL_STATUS.LIVE,
    approvalStatus: APPROVAL_STATUS.APPROVED,
    notes: ["קמפיין דמו לצורך בחינת המסכים בלבד."],
    participants: [
      {
        talentId: "demo-talent-1",
        operationalStatus: OPERATIONAL_STATUS.LIVE,
        notes: "דמו: התוכן הראשון כבר עלה.",
        deliverables: [
          {
            id: "demo-del-1",
            type: DELIVERABLE_TYPE.INSTAGRAM_REEL,
            quantity: 1,
            description: "רילס השקה עם הצגת המוצר (דמו)",
            status: OPERATIONAL_STATUS.LIVE,
            notes: "",
          },
          {
            id: "demo-del-2",
            type: DELIVERABLE_TYPE.STORY_SEQUENCE,
            quantity: 3,
            description: "רצף סטוריז ליום ההשקה (דמו)",
            status: OPERATIONAL_STATUS.WAITING_APPROVAL,
            notes: "ממתין לאישור הלקוח (דמו)",
          },
        ],
      },
      {
        talentId: "demo-talent-2",
        operationalStatus: OPERATIONAL_STATUS.WAITING_CONTENT,
        notes: "",
        deliverables: [
          {
            id: "demo-del-3",
            type: DELIVERABLE_TYPE.TIKTOK,
            quantity: 1,
            description: "סרטון טיקטוק ראשי (דמו)",
            status: OPERATIONAL_STATUS.WAITING_CONTENT,
            notes: "",
          },
          {
            id: "demo-del-4",
            type: DELIVERABLE_TYPE.REMINDER_STORY,
            quantity: 1,
            description: "סטורי תזכורת יום אחרי (דמו)",
            status: OPERATIONAL_STATUS.WAITING_CONTENT,
            notes: "",
          },
        ],
      },
    ],
    history: [
      { id: "demo-h-1", date: "2026-05-02", text: "הקמפיין נוצר (דמו)" },
      { id: "demo-h-2", date: "2026-05-10", text: "הוגש לאישור הבעלים (דמו)" },
      { id: "demo-h-3", date: "2026-05-12", text: "אושר על ידי הבעלים (דמו)" },
    ],
  },
  {
    id: "demo-campaign-2",
    clientId: "demo-client-b",
    brandId: "demo-brand-sport",
    name: "קמפיין חזרה לשגרה (דמו)",
    month: "2026-08",
    relevantDate: null,
    businessStatus: BUSINESS_STATUS.NEGOTIATION,
    operationalStatus: OPERATIONAL_STATUS.WAITING_CONTENT,
    approvalStatus: APPROVAL_STATUS.SUBMITTED,
    notes: [],
    participants: [
      {
        talentId: "demo-talent-1",
        operationalStatus: OPERATIONAL_STATUS.WAITING_CONTENT,
        notes: "",
        deliverables: [
          {
            id: "demo-del-5",
            type: DELIVERABLE_TYPE.STORY_SEQUENCE,
            quantity: 2,
            description: "רצף סטוריז בלבד (דמו)",
            status: OPERATIONAL_STATUS.WAITING_CONTENT,
            notes: "",
          },
        ],
      },
      {
        talentId: "demo-talent-3",
        operationalStatus: OPERATIONAL_STATUS.WAITING_CONTENT,
        notes: "דמו: מחכים לבריף סופי.",
        deliverables: [
          {
            id: "demo-del-6",
            type: DELIVERABLE_TYPE.INSTAGRAM_REEL,
            quantity: 1,
            description: "רילס אימון (דמו)",
            status: OPERATIONAL_STATUS.WAITING_CONTENT,
            notes: "",
          },
          {
            id: "demo-del-7",
            type: DELIVERABLE_TYPE.POST,
            quantity: 1,
            description: "פוסט שיתוף פעולה (דמו)",
            status: OPERATIONAL_STATUS.WAITING_CONTENT,
            notes: "",
          },
        ],
      },
    ],
    history: [
      { id: "demo-h-4", date: "2026-06-20", text: "הקמפיין נוצר (דמו)" },
      { id: "demo-h-5", date: "2026-07-01", text: "הוגש לאישור הבעלים (דמו)" },
    ],
  },
  {
    id: "demo-campaign-3",
    clientId: "demo-client-c",
    brandId: "demo-brand-beauty",
    name: "השקת סתיו (דמו)",
    month: "2026-09",
    relevantDate: "2026-09-01",
    businessStatus: BUSINESS_STATUS.LEAD,
    operationalStatus: OPERATIONAL_STATUS.WAITING_CONTENT,
    approvalStatus: APPROVAL_STATUS.DRAFT,
    notes: ["ליד ראשוני — טרם נסגר (דמו)."],
    participants: [
      {
        talentId: "demo-talent-4",
        operationalStatus: OPERATIONAL_STATUS.WAITING_CONTENT,
        notes: "",
        deliverables: [
          {
            id: "demo-del-8",
            type: DELIVERABLE_TYPE.UGC,
            quantity: 2,
            description: "תוכן UGC לשימוש הלקוח (דמו)",
            status: OPERATIONAL_STATUS.WAITING_CONTENT,
            notes: "",
          },
        ],
      },
    ],
    history: [{ id: "demo-h-6", date: "2026-07-10", text: "הקמפיין נוצר (דמו)" }],
  },
  {
    id: "demo-campaign-4",
    clientId: "demo-client-a",
    brandId: "demo-brand-winter",
    name: "קמפיין חורף מוקדם (דמו)",
    month: "2026-11",
    relevantDate: null,
    businessStatus: BUSINESS_STATUS.CANCELLED,
    operationalStatus: OPERATIONAL_STATUS.COMPLETED,
    approvalStatus: APPROVAL_STATUS.RETURNED,
    notes: ["בוטל לצורך הדגמת סטטוסים (דמו)."],
    participants: [
      {
        talentId: "demo-talent-2",
        operationalStatus: OPERATIONAL_STATUS.COMPLETED,
        notes: "",
        deliverables: [
          {
            id: "demo-del-9",
            type: DELIVERABLE_TYPE.YOUTUBE,
            quantity: 1,
            description: "סרטון יוטיוב (דמו)",
            status: OPERATIONAL_STATUS.COMPLETED,
            notes: "",
          },
        ],
      },
    ],
    history: [
      { id: "demo-h-7", date: "2026-04-01", text: "הקמפיין נוצר (דמו)" },
      { id: "demo-h-8", date: "2026-04-15", text: "הוחזר לתיקון על ידי הבעלים (דמו)" },
      { id: "demo-h-9", date: "2026-05-01", text: "הקמפיין בוטל (דמו)" },
    ],
  },
];

/* ---------------------------------------------------------------------- */
/* In-memory store                                                         */
/* ---------------------------------------------------------------------- */

// Deep-ish copy so mutations (added campaigns/notes) never touch the seed
// constants — a refresh always resets to pristine seed data.
let campaigns = SEED_CAMPAIGNS.map((campaign) => ({
  ...campaign,
  notes: [...campaign.notes],
  participants: campaign.participants.map((participant) => ({
    ...participant,
    deliverables: participant.deliverables.map((deliverable) => ({ ...deliverable })),
  })),
  history: [...campaign.history],
}));

let idCounter = 1;

export function listCampaigns() {
  return campaigns;
}

export function getCampaign(id) {
  return campaigns.find((campaign) => campaign.id === id) || null;
}

export function listCampaignsForTalent(talentId) {
  return campaigns.filter((campaign) =>
    campaign.participants.some((participant) => participant.talentId === talentId)
  );
}

/*
 * Adds a campaign to the in-memory list. `input` follows the Campaign
 * shape above minus id/history. Returns the created campaign.
 * The same campaign is shared across every entry point — creating from a
 * talent profile adds ONE campaign with multiple participants, never a
 * duplicate per talent.
 */
export function addCampaign(input) {
  const id = `local-campaign-${idCounter++}`;
  const today = new Date().toISOString().slice(0, 10);
  const campaign = {
    id,
    ...input,
    notes: input.notes ? [...input.notes] : [],
    history: [{ id: `${id}-h1`, date: today, text: "הקמפיין נוצר (אב-טיפוס, נתונים מקומיים)" }],
  };
  campaigns = [campaign, ...campaigns];
  return campaign;
}

export function addCampaignNote(campaignId, text) {
  const campaign = getCampaign(campaignId);
  if (!campaign || !text.trim()) return;
  campaign.notes = [...campaign.notes, text.trim()];
}

/* ---------------------------------------------------------------------- */
/* Lookup + formatting helpers                                             */
/* ---------------------------------------------------------------------- */

export function getClientById(clientId) {
  return DEMO_CLIENTS.find((client) => client.id === clientId) || null;
}

export function getBrandById(clientId, brandId) {
  const client = getClientById(clientId);
  return client?.brands.find((brand) => brand.id === brandId) || null;
}

export function getTalentById(talentId) {
  return DEMO_TALENTS.find((talent) => talent.id === talentId) || null;
}

const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

// "2026-06" → "יוני 2026"
export function formatCampaignMonth(month) {
  if (!month) return "—";
  const [year, monthPart] = month.split("-");
  const index = Number(monthPart) - 1;
  if (!year || index < 0 || index > 11 || Number.isNaN(index)) return month;
  return `${HEBREW_MONTHS[index]} ${year}`;
}

// "2026-06-15" → "15.6.2026" (matches the admin's day.month.year habit)
export function formatCampaignDate(date) {
  if (!date) return "—";
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return `${day}.${month}.${year}`;
}

// Distinct deliverable-type labels for a participant → "רילס + רצף סטוריז"
export function formatMediaMix(participant, typeLabels) {
  const types = [];
  for (const deliverable of participant?.deliverables || []) {
    const label = typeLabels[deliverable.type] || deliverable.type;
    if (!types.includes(label)) types.push(label);
  }
  return types.length > 0 ? types.join(" + ") : "—";
}
