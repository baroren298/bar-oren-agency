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
    // Sprint 7B (Clients & Brands Foundation) — top-level nav item, visible
    // to both OWNER and EMPLOYEE (view/create/edit are shared; only archive
    // is Owner-only, enforced server-side).
    clients: "לקוחות",
    // Sprint 8A (Campaigns UI Prototype) — nav label for the PROTOTYPE
    // Campaigns module (/admin/campaigns, fake local data only). The rest
    // of the Campaigns copy deliberately lives in
    // app/admin/campaigns/_prototype/copy.js so the prototype deletes
    // cleanly; only strings that touch shared components (this nav item,
    // talent.sections.campaigns) live here.
    campaigns: "קמפיינים",
    // Administration Sprint 1 — Owner-only nav *section* heading (frozen
    // Administration architecture: Users / Sessions / Audit Log live under
    // one "Administration" group). Rendered by AdminNavLinks as a
    // non-interactive label, only when role === ROLE.OWNER.
    administration: "ניהול מערכת",
    // Sprint 3: Users UI — Owner-only nav item, shown by AdminNavLinks only
    // when role === ROLE.OWNER (see that file's header comment). Since
    // Administration Sprint 1 it renders under the "administration" section
    // heading above rather than as a flat top-level item.
    users: "משתמשים",
    // Administration Sprint 2c — Owner-only Audit Log nav item, rendered
    // under the "administration" section heading, same visibility rules as
    // `users` above.
    auditLog: "יומן פעילות",
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

  // Sprint 4 — Admin Idle Timeout & Automatic Logout. Copy for the warning
  // dialog AdminIdleTimeoutManager/IdleWarningDialog show after 2 minutes of
  // inactivity, with a 60-second countdown before an automatic logout.
  idleTimeout: {
    title: "החיבור עומד להסתיים",
    body: "מטעמי אבטחה, בשל חוסר פעילות תנותק ההתחברות למערכת בעוד:",
    countdownUnit: "שניות",
    stayLoggedIn: "הישאר מחובר",
    logoutNow: "התנתק עכשיו",
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
    // My Work — real data sprint: same phrasing convention as the other
    // per-area dbNotConfigured pairs (dashboard.owner, talent.list).
    dbNotConfiguredTitle: "מסד הנתונים עדיין לא מחובר",
    dbNotConfiguredDescription:
      "המשימות שלך יופיעו כאן ברגע שמסד הנתונים יוגדר בסביבה הזו.",
    // Rejected items show the Owner's note as the card description.
    rejectionNote: (note) => `הערת הבעלים: ${note}`,
  },

  meta: {
    status: "סטטוס",
    type: "סוג",
    lastUpdated: "עודכן לאחרונה",
    assignedTo: "בטיפול של",
    submittedBy: "נשלח על־ידי",
  },

  dashboard: {
    // Dashboard UX refinement — replaces the static "שלום X 👋" greeting.
    // The page picks a key by the current hour (see greetingPeriod() in
    // app/admin/page.jsx); copy lives here so no Hebrew is hardcoded in JSX.
    timeGreeting: {
      morning: (firstName) => `בוקר טוב, ${firstName} 👋`,
      afternoon: (firstName) => `צהריים טובים, ${firstName} ☀️`,
      evening: (firstName) => `ערב טוב, ${firstName} 🌇`,
      night: (firstName) => `לילה טוב, ${firstName} 🌙`,
    },
    subline: "הנה מה שמחכה לטיפול היום.",
    summary: {
      waitingForApproval: "ממתינים לאישור",
      changesRequested: "נדרשו תיקונים",
      recentlyPublished: "פורסמו לאחרונה",
    },

    // Owner Dashboard Sprint 1 (OWNER_DASHBOARD_UX_SPEC.md §7 micro-copy).
    // The greeting summary still counts Pending Approvals ONLY (spec §3).
    // Dashboard UX refinement — reworded to the calmer "ממתינים לטיפול"
    // phrasing shown under the new time-based greeting.
    owner: {
      // Fallback for Owner accounts predating User.displayName — the sole
      // Owner today is Bar (the previous hardcoded greeting used 'בר' too).
      defaultDisplayName: "בר",
      summaryNone: "אין כרגע פריטים שממתינים להתייחסות.",
      summaryOne: "יש לך פריט אחד שממתין לטיפול.",
      summaryMany: (count) => `יש לך ${count} פריטים שממתינים לטיפול.`,
      sections: {
        pendingApprovals: "ממתינים לאישור",
        rejectedItems: "הוחזרו לתיקון",
        employeeDrafts: "טיוטות של העובדים",
        // Sprint 5a — "Recent Publishes".
        recentPublishes: "פורסמו לאחרונה",
      },
      empty: {
        pendingApprovals: "אין פריטים שממתינים לאישור.",
        rejectedItems: "אין פריטים שממתינים לתיקון.",
        employeeDrafts: "אין טיוטות פתוחות כרגע.",
        recentPublishes: "אין פרסומים אחרונים.",
      },
      cta: {
        pendingApprovals: "לכל האישורים",
        rejectedItems: "לפריטים שממתינים לתיקון",
        employeeDrafts: "לכל הטיוטות",
        recentPublishes: "לכל המיוצגים",
      },
      workTypes: {
        DETAILS: "פרטי מיוצג",
        SOCIALS: "רשתות חברתיות",
        GALLERY: "גלריה",
      },
      itemCount: (count) => (count === 1 ? "פריט אחד" : `${count} פריטים`),
      draftCount: (count) => (count === 1 ? "טיוטה אחת" : `${count} טיוטות`),
      submittedBy: (name) => `הוגש על ידי ${name}`,
      rejectedBy: (name) => (name ? `נדחה על ידי ${name}` : "נדחה"),
      // Sprint 5a — Recent Publishes row attribution; null approvedBy
      // (historical rows / unattributed publishes) renders as "פורסם" with
      // no name, same "—"-style fallback as rejectedBy above.
      publishedBy: (name) => (name ? `פורסם על ידי ${name}` : "פורסם"),
      lastUpdated: (when) => `עדכון אחרון: ${when}`,
      // Owner Dashboard Sprint 2 (spec §7/§3) — quiet textual flag for a
      // Pending Approvals item waiting more than 3 days. Text emphasis
      // only, never a color/alarm treatment (spec §7, §11: color is never
      // the only signal).
      agingFlag: (days) => (days === 1 ? "ממתין יום אחד" : `ממתין ${days} ימים`),
      dbNotConfiguredTitle: "מסד הנתונים עדיין לא מחובר",
      dbNotConfiguredDescription:
        "לוח הבקרה יציג נתונים אמיתיים ברגע שמסד הנתונים יוגדר בסביבה הזו.",
      // Sprint 5a — static Quick Actions block. Deliberately just labels for
      // four fixed destinations (/admin/talent/new, /admin/talent,
      // /admin/users, /admin/audit-log) — no data behind these, so no
      // service/repository involvement, unlike every other dashboard.owner
      // key above.
      quickActions: {
        title: "פעולות מהירות",
        addTalent: "הוסף מיוצג חדש",
        talents: "מיוצגים",
        users: "משתמשים",
        auditLog: "יומן פעילות",
      },
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
      // Owner vs Employee UX Refinement sprint — renamed from "ביטול
      // שינויים" ("Cancel Changes"). Once a Draft exists, this button exits
      // the whole editing session (discards the draft), not just unsaved
      // local field edits — the old label undersold what clicking it
      // actually does. Wording-only change: `onCancel`'s behavior in
      // ComparisonView.handleCancel is untouched (still resets local state;
      // any "exit the session" semantics live wherever the caller wires
      // `onCancel`, which this sprint does not change).
      cancel: "בטל עריכה",
      saveDraft: "שמור כטיוטה",
      // "Editable PROPOSED" sprint — same button, different label once the
      // version being edited is already PROPOSED rather than DRAFT (the
      // underlying action is still the same in-place field update; see
      // proposalService.update()'s widened status guard).
      updateProposal: "עדכן הצעה",
      submit: "שלח לאישור",
      // Owner Direct Publish UX sprint — Owner-only action, shown alongside
      // (not instead of) Submit. Owner can still use Submit/Approve for
      // testing; this is the everyday shortcut straight to PUBLISHED.
      publishNow: "פרסם מיד",
      // Single-Section Editing UX sprint — generic "enter edit mode" trigger
      // for any tab whose editing session is purely local UI state (Gallery/
      // Social Links/SEO), as opposed to he.talent.detail.startEditing's
      // wording, which is specific to actually creating a TalentVersion
      // Draft row server-side. Clicking this never calls an API — it only
      // flips the section from its read-only view into its editable form;
      // the real persistence step is still the existing Save Draft button.
      startEditing: "התחל בעריכה",
    },
    // Admin Talent Editor UX polish sprint — `comingSoon` used to be the
    // catch-all disabled-button tooltip for *every* reason a Save/Submit
    // button could be disabled, including "this feature literally doesn't
    // exist yet" wording ("future sprint") shown even on Details/Podcast,
    // where Save/Submit are real and working. It's no longer used as a
    // tooltip by EditorActionBar (see that file: the caller now supplies an
    // accurate, situation-specific reason via `saveDraftDisabledReason`/
    // `submitDisabledReason` — see the new keys below). Left here, reworded
    // to drop the internal "sprint" language, for any other caller that may
    // still reference it.
    comingSoon: "האפשרות הזו עדיין לא זמינה.",
    // Talent Detail UX Refactor, Phase 1 — copy for ComparisonView's single
    // section, replacing the old always-visible "גרסה מפורסמת" / "עדכון
    // מוצע" pair. `sectionViewLabel`/`sectionViewSubtitle` show when there is
    // no editable Draft/Proposed version (the section is a read-only
    // preview of what's published); `sectionEditingLabel`/
    // `sectionEditingSubtitle` show once one exists and the same fields
    // become editable. Deliberately no "proposed"/"current" wording here —
    // that comparison framing is reserved for GalleryOwnerReview/
    // SocialLinksOwnerReview-style review surfaces, not this day-to-day
    // editor.
    sectionViewLabel: "הגרסה המפורסמת",
    sectionViewSubtitle: "כך זה מוצג באתר כרגע.",
    sectionEditingLabel: "במצב עריכה",
    sectionEditingSubtitle: "השינויים נשמרים כטיוטה. שום דבר לא מתפרסם באתר לפני אישור.",
    helperNote: {
      body: "זה עדכון מוצע — שום דבר לא מתפרסם באתר לפני שהבעלים מאשר אותו. אפשר לשמור כטיוטה ולהמשיך בכל שלב, אין צורך לסיים הכול בבת אחת.",
    },
    // Save Draft sprint — feedback shown next to the "שמור כטיוטה" button
    // while saving / after a successful or failed save, plus the
    // non-blocking conflict notice. Lives here (not under `talent`) since
    // ComparisonView/EditorActionBar are entity-agnostic and this copy is
    // generic enough to reuse for any future Save Draft integration.
    saveDraft: {
      saving: "שומר…",
      saved: "הטיוטה נשמרה",
      // "Editable PROPOSED" sprint — shown instead of `saved` above when the
      // version being saved is already PROPOSED, so the confirmation text
      // doesn't call it a "draft" when it isn't one.
      savedProposal: "ההצעה עודכנה",
      error: "השמירה נכשלה. נסה שוב.",
      unsavedHint: "יש שינויים שלא נשמרו",
      conflictNotice:
        "מישהו אחר עדכן את הפרופיל הזה בזמן שעבדת עליו. הטיוטה נשמרה בכל זאת — מומלץ לרענן ולבדוק שהכול מסונכרן.",
      // Admin Talent Editor UX polish sprint — accurate tooltips for the two
      // real reasons Save Draft is disabled on an editor that *is* wired up
      // (Details/Podcast), replacing the old generic "future sprint" tooltip.
      disabledNoVersion: "כדי לשמור יש להתחיל בעריכה למיוצג הזה (ראו \"התחל בעריכה\" למעלה).",
      disabledNoChanges: "אין שינויים לשמירה כרגע.",
    },
    // Submit for Approval sprint (Sprint 1) — feedback shown next to the
    // "שלח לאישור" button while submitting / after a successful or failed
    // submit, plus the hint shown while the button is disabled because of
    // unsaved local edits. Lives here for the same reason saveDraft does:
    // entity-agnostic, reusable by any future ComparisonView-based editor.
    submit: {
      submitting: "שולח לאישור…",
      submitted: "נשלח לאישור",
      error: "השליחה לאישור נכשלה. נסה שוב.",
      unsavedHint: "שמור כטיוטה לפני שליחה לאישור",
      // Admin Talent Editor UX polish sprint — same reasoning as
      // saveDraft.disabledNoVersion/disabledNoChanges above.
      disabledNoVersion: "כדי לשלוח לאישור יש להתחיל בעריכה למיוצג הזה.",
      disabledProposedLocked: "ההצעה הזו ממתינה כבר לאישור הבעלים. אפשר לשלוח הצעה חדשה רק אחרי שתתקבל הכרעה.",
    },
    // Owner Direct Publish UX sprint — feedback for the Owner-only "פרסם
    // מיד" button. Mirrors submit's shape exactly (idle/publishing/
    // published/error), entity-agnostic for the same reason saveDraft/submit
    // are: reused by TalentDetailsEditor (via ComparisonView), and by
    // MediaGalleryEditor/SocialLinksEditor directly.
    publish: {
      publishing: "מפרסם…",
      published: "פורסם באתר",
      error: "הפרסום נכשל. נסה שוב.",
      unsavedHint: "שמור כטיוטה לפני פרסום",
      disabledNoVersion: "כדי לפרסם יש להתחיל בעריכה למיוצג הזה.",
      disabledNothingToPublish: "אין כרגע מה לפרסם.",
    },
  },

  // Profile Image Management sprint — generic copy for the reusable
  // single-image editing system (ImageAssetEditor/ImageEditorCard/
  // ImageUploadArea/ImagePositionControls — see components/admin/). Lives
  // at this top level, not under `talent`, for the same reason `editor` and
  // `gallery` do: none of these components know what entity they're
  // editing an image for, so a future Cover Image / Hero Image / Gallery
  // Replace module reuses this exact copy (or overrides individual keys via
  // props) instead of duplicating it. Mirrors `gallery`'s published/
  // proposed eyebrow pattern exactly, since that's the same visual
  // "Current Published / Proposed Update" language ComparisonView and
  // MediaGalleryEditor already establish — this is that same language
  // applied to a single image instead of a field list or a grid.
  media: {
    publishedEyebrowIcon: "🌍",
    publishedEyebrowTitle: "גרסה מפורסמת",
    publishedSubtitle: "כך התמונה הזו מוצגת באתר כרגע.",
    proposedEyebrowIcon: "✏️",
    proposedEyebrowTitle: "עדכון מוצע",
    proposedSubtitle: "התמונה המוצעת לא תתפרסם באתר לפני אישור.",
    // Talent Detail UX Refactor, Phase 2 — copy for ImageAssetEditor's
    // single section, mirroring he.editor.section*/ComparisonView's Phase 1
    // copy exactly. `viewEyebrowTitle`/`viewSubtitle` show when there is no
    // editable Draft/Proposed version (a read-only preview of the published
    // image); `editingEyebrowIcon`/`editingEyebrowTitle`/`editingSubtitle`
    // show once one exists and the same frame becomes the upload/zoom
    // surface. The old published*/proposed* keys above are left in place
    // (still documented as reusable for a future Cover/Hero module) but are
    // no longer read by ImageAssetEditor/ProfileImagePanel.
    viewEyebrowIcon: "🌍",
    viewEyebrowTitle: "התמונה הנוכחית",
    viewSubtitle: "כך התמונה מוצגת באתר כרגע.",
    editingEyebrowIcon: "✏️",
    editingEyebrowTitle: "במצב עריכה",
    editingSubtitle: "השינויים נשמרים כטיוטה. שום דבר לא מתפרסם באתר לפני אישור.",
    noImage: "אין תמונה",
    uploadArea: {
      dropHint: "גרור תמונה לכאן",
      or: "או",
      chooseImage: "בחר תמונה",
      replaceHint: "גרור תמונה לכאן או לחץ על \"בחר תמונה\" כדי להחליף",
      uploading: "מעלה תמונה…",
      dragActiveHint: "שחרר כאן להעלאה",
    },
    preview: {
      proposedLabel: "תצוגה מקדימה",
    },
    // Single-Section Editing UX sprint — the old `positionLabel`/`cropHint`/
    // `positions` keys described the now-removed 3×3 keyword grid (see
    // ImagePositionControls' header comment for why it was replaced).
    // `dragHint` is the new copy: a short instruction shown directly on the
    // live preview, since positioning is now done by dragging the photo
    // itself rather than picking from 9 presets.
    positionControls: {
      zoomLabel: "זום",
      dragHint: "גרור את התמונה כדי למקם אותה במסגרת",
    },
    disabledHint:
      "כדי להחליף את התמונה יש להתחיל עריכה (טיוטה) קודם — אותו תהליך המשמש לעריכת שאר השדות.",
    // Pre-merge blocker fix sprint (QA finding #1) — shown in the upload
    // area when uploads are unavailable in this environment (local storage
    // provider in a production build, e.g. Vercel). Positioning/zoom and
    // every other edit keep working; only new file uploads are blocked.
    uploadsDisabledHint:
      "העלאת תמונות מושבתת בסביבה זו — אחסון קבצים בענן עדיין לא הוגדר. שאר העריכה עובדת כרגיל.",
    errors: {
      invalidType: "סוג קובץ לא נתמך. אפשר להעלות תמונות JPEG, PNG או WebP בלבד.",
      tooLarge: (maxMb) => `הקובץ גדול מהמותר (עד ${maxMb}MB).`,
      genericUploadError: "העלאת התמונה נכשלה. נסה שוב.",
      networkError: "תקלת תקשורת — בדוק את החיבור ונסה שוב.",
    },
  },

  // Gallery Editor Foundation sprint — generic copy for any
  // "Current Published / Proposed Update" *image gallery* editor
  // (MediaGalleryEditor + its card components). Lives at this top level,
  // not under `talent`, because the component is entity-agnostic and is
  // meant to be reused for talent galleries, profile image, hero image,
  // logo, and other homepage media collections later.
  gallery: {
    publishedEyebrowIcon: "🌍",
    publishedEyebrowTitle: "גלריה מפורסמת",
    publishedSubtitle: "כך הגלריה הזו מוצגת באתר כרגע.",
    proposedEyebrowIcon: "✏️",
    proposedEyebrowTitle: "תצוגה מקדימה של עדכון",
    proposedSubtitle: "תצוגה מקדימה בלבד — שום שינוי כאן עדיין לא נשמר.",
    // Gallery UX Polish sprint — replaces the generic, shared
    // <EditorHelperNote> in this tab specifically (that component's copy
    // talks about saving a draft and an owner approving it, which doesn't
    // apply here yet: there is no draft-save or approval path for gallery
    // changes at all today). This is the one explicit, honest disclosure
    // for the whole tab — short, professional, and matches exactly what
    // is and isn't possible right now. Title/body kept separate so the
    // note can use the same bordered-hint visual language as
    // PodcastTab.module.css's .noEditableVersionHint without needing a
    // heavier component.
    previewModeNotice: {
      title: "מצב תצוגה מקדימה",
      body: "עורך הגלריה נמצא כרגע במצב תצוגה מקדימה. אפשר לסדר ולהסיר תמונות כאן, אך העלאה והחלפה של תמונות עדיין לא זמינות, ושום דבר כאן לא נשמר באתר.",
    },
    // Shown on every card in the proposed grid — reordering and removing
    // really do update this in-memory grid (see GalleryImageCard.jsx), but
    // nothing here persists past a page refresh, so each card carries its
    // own small reminder rather than relying on the section-level notice
    // alone.
    previewBadge: "לא נשמר",
    noPublishedImagesTitle: "אין עדיין גלריה מפורסמת",
    noPublishedImagesDescription: "כשתתפרסם גלריה, התמונות שלה יוצגו כאן.",
    noProposedImagesTitle: "אין תמונות בתצוגה המקדימה",
    noProposedImagesDescription: "הוספת תמונות חדשות עדיין לא זמינה כאן.",
    imageAlt: (label, index) => `${label} — תמונה ${index + 1}`,
    actions: {
      replace: "החלף",
      remove: "הסר",
      addImage: "+ הוסף תמונה",
      // Gallery UX Polish sprint — AddImageCard's modern drop-zone copy,
      // replacing the old single-line "+ העלה תמונה" button label now that
      // the card is a full click-or-drop zone (see AddImageCard.jsx).
      uploadImage: "לחץ לבחירת קבצים",
      uploading: "מעלה...",
      dropHint: "גרור תמונות לכאן",
      or: "או",
      // Per-file uploading-queue card (UploadingImageCard.jsx) — dismisses
      // a failed upload's placeholder without affecting any other file.
      dismissUpload: "סגור",
    },
    // Gallery Image Removal sprint — was "removal only affects the preview
    // and isn't saved," accurate before this sprint; removal now persists
    // (see MediaGalleryEditor.jsx's header comment).
    removeHint: "התמונה תוסר מהגלריה. אם היא כבר מפורסמת באתר, ההסרה תיכנס לתוקף רק לאחר אישור הבעלים.",
    // Gallery UX Polish sprint — the Up/Down reorder buttons and their
    // moveUp/moveDown/moveHint copy were removed along with
    // GalleryImageCard's onMoveUp/onMoveDown props; reordering is now drag
    // and drop (see GalleryImageCard.jsx + MediaGalleryEditor.jsx), which
    // needs no button label or tooltip.
    dragReorderHint: "גרור לשינוי הסדר",
    // Gallery UX Completion sprint — copy for the interactive positioning
    // surface every proposed card now renders (ImagePreview in editable
    // mode + ImagePositionControls zoom slider + a reset action — see
    // GalleryImageCard.jsx). Deliberately gallery-scoped rather than
    // reusing he.media.positionControls: that copy belongs to the
    // single-image Profile Image module, and the two surfaces should be
    // free to diverge.
    positionControls: {
      dragHint: "גרור למיקום התמונה",
      zoomLabel: "זום",
      resetAction: "איפוס מיקום",
      resetHint: "מחזיר את המיקום למרכז ואת הזום לגודל המקורי.",
    },
    replaceComingSoon: "החלפת תמונה עדיין לא זמינה כאן.",
    addImageComingSoon: "הוספת תמונה עדיין לא זמינה כאן.",
    // Gallery Upload Sprint 2 — copy for the new client-side upload flow in
    // MediaGalleryEditor/AddImageCard. Mirrors the existing upload* keys in
    // `errors` below in tone; these two are UI-state labels rather than
    // server error strings, so they live alongside `actions`/`fields`
    // instead.
    newImageAlt: "תמונה חדשה שהועלתה",
    uploadGenericError: "העלאת התמונה נכשלה. נסה שוב.",
    // Gallery Sprint 1 — field labels for the metadata an editor can now
    // actually edit per image (order/altHe/altEn/position/scale/
    // mobileOrder). Mirrors `social.fields`'s role exactly: one set of
    // labels shared between the editable card and (read-only, via
    // gallery.review below) the Owner Review panel.
    //
    // Gallery UX Completion sprint — GalleryImageCard's raw position/scale
    // text inputs were replaced by the interactive surface (see
    // positionControls above), so positionPlaceholder/positionHelper/
    // scaleHelper are no longer read by the card; `position`/`scale`
    // labels themselves are still read by GalleryOwnerReview's diff rows,
    // so everything here stays.
    fields: {
      altHe: "טקסט חלופי (עברית)",
      altHePlaceholder: "תיאור קצר של התמונה",
      altEn: "טקסט חלופי (אנגלית)",
      altEnPlaceholder: "Short image description",
      position: "מיקום החיתוך",
      positionPlaceholder: "לדוגמה: center 36%",
      positionHelper: "מתאים את נקודת החיתוך של התמונה, כמו ערכי CSS object-position.",
      scale: "הגדלה",
      scaleHelper: "מספר חיובי, לדוגמה 1 (גודל מקורי) או 1.2 (הגדלה של 20%).",
      mobileOrder: "סדר תצוגה בנייד",
      mobileOrderHelper: "סדר שונה לתצוגה בנייד בלבד; ריק = אותו סדר כמו במחשב.",
      // Gallery Upload Sprint 2 fix-up — GalleryImageCard's metadata block
      // (altHe/altEn/position/scale/mobileOrder) is collapsed behind this
      // toggle by default so a proposed card stays visually compact (one
      // thumbnail + action row) the way it did before the Add Image button
      // made the proposed grid get more day-to-day attention. Toggling
      // never clears or resets any field's value — it only shows/hides the
      // same inputs already wired to onChange.
      detailsToggleShow: "ערוך פרטים נוספים",
      detailsToggleHide: "סגור פרטים נוספים",
    },
    // Gallery Sprint 1 — replaces the now-inaccurate Gallery Editor
    // Foundation sprint's blanket previewModeNotice when real persistence
    // exists (talentId is supplied) — mirrors social's
    // PreviewModeNotice/PersistenceModeNote split exactly (see
    // SocialLinksEditor.jsx). previewModeNotice above is kept as-is for any
    // future standalone/no-talentId render of this editor.
    persistenceModeNote: {
      title: "שמירה ואישור",
      body:
        "אפשר לסדר תמונות, להסיר אותן מהתצוגה המקדימה, ולערוך טקסט חלופי / מיקום חיתוך / הגדלה / סדר בנייד, " +
        "ולשמור כטיוטה או לשלוח לאישור הבעלים. הוספת תמונה חדשה, החלפת תמונה והעלאת קבצים עדיין לא זמינות כאן.",
    },
    // Gallery Sprint 1 — Hebrew validation/error copy for the real Save
    // Draft / Submit network calls (galleryService.js +
    // app/api/admin/talent/[id]/gallery/*), mirroring `social.errors`'s
    // structure/tone exactly.
    errors: {
      notAuthenticated: "ההתחברות פגה. יש להתחבר מחדש.",
      invalidBody: "הנתונים שנשלחו לא תקינים.",
      validationSummary: "יש לתקן את התמונות המסומנות ולנסות שוב.",
      // Gallery Upload Sprint 1: wording updated — a new image CAN now be
      // attached via `imageAssetId` (an already-uploaded Asset), so the old
      // "only existing images can be edited" phrasing is no longer accurate.
      // This now fires only when an entry has neither `id` nor
      // `imageAssetId` — nothing identifiable to save at all.
      missingImageId: "לכל תמונה צריך להיות מזהה תמונה קיימת או imageAssetId של קובץ שהועלה.",
      invalidOrder: "סדר התמונה אינו תקין.",
      invalidMobileOrder: "סדר התצוגה בנייד אינו תקין.",
      invalidScale: "ערך ההגדלה חייב להיות מספר חיובי.",
      invalidPosition: "מיקום החיתוך אינו תקין.",
      notFound: "התמונה המבוקשת לא נמצאה.",
      notEditable: "אי אפשר לערוך את התמונה הזו כרגע.",
      nothingToSubmit: "אין טיוטת גלריה לשליחה לאישור כרגע.",
      serverError: "משהו נכשל בשמירה. נסה שוב.",
      networkError: "תקלת תקשורת — בדוק את החיבור ונסה שוב.",
      // Owner Approve/Reject (Gallery) sprint.
      notOwner: "רק לבעלים יש הרשאה לפעולה זו.",
      // Auth Hardening + Draft Ownership Sprint 1 — an EMPLOYEE tried to
      // edit/submit/discard/resume a draft created by a different user.
      notDraftOwner: "אפשר לערוך רק טיוטות שיצרת בעצמך.",
      notProposable: "אפשר לאשר או לדחות רק בקשות שעדיין מחכות לאישור.",
      rejectionNoteRequired: "יש להזין הערה לפני דחיית הבקשה.",
      // Gallery Upload Sprint 1 — POST /api/admin/assets/upload +
      // assetService.uploadAsset(), mirroring this same errors block's
      // structure/tone exactly.
      uploadMissingFile: "יש לבחור קובץ להעלאה.",
      uploadMissingPurpose: "חסר שדה purpose בבקשת ההעלאה.",
      uploadEmptyFile: "הקובץ שנבחר ריק.",
      uploadFileTooLarge: "הקובץ גדול מהמותר.",
      uploadUnsupportedType: "סוג הקובץ אינו נתמך.",
      // Pre-merge blocker fix sprint (QA finding #1) — returned by
      // POST /api/admin/assets/upload (503) when the active storage
      // provider is `local` in a production build (no durable filesystem,
      // e.g. Vercel — see lib/storage/availability.js). Also shown as the
      // gallery editor's upload notice.
      uploadsDisabled:
        "העלאת תמונות מושבתת בסביבה זו עד שיוגדר אחסון קבצים בענן. שאר העריכה עובדת כרגיל.",
      // Production Upload Enablement sprint — returned by
      // POST /api/admin/assets/upload (429) when one user sends too many
      // uploads inside the rate-limit window
      // (lib/admin/auth/uploadRateLimit.js).
      uploadRateLimited: "יותר מדי העלאות בזמן קצר. יש להמתין רגע ולנסות שוב.",
    },
    // Owner Review (Gallery) sprint — read-only copy for the new panel that
    // shows an Owner exactly what a submitted Gallery proposal changes.
    // Mirrors `social.review` exactly.
    review: {
      eyebrowIcon: "🔍",
      title: "בקשת עדכון לגלריה",
      subtitle: "כך תיראה הגלריה של הטאלנט אם הבקשה הזו תאושר.",
      pendingNote: "הבקשה הזו עדיין מחכה לאישור. שום דבר לא פורסם באתר.",
      noProposalTitle: "אין בקשת עדכון פתוחה",
      noProposalDescription: "כשתישלח בקשה לעדכון הגלריה, היא תוצג כאן לבדיקה.",
      summary: {
        added: "תמונות חדשות",
        changed: "תמונות ששונו",
        unchanged: "תמונות ללא שינוי",
        removed: "תמונות להסרה",
      },
      status: {
        ADDED: "תמונה חדשה",
        CHANGED: "השתנה",
        UNCHANGED: "ללא שינוי",
        UNCHANGED_PUBLISHED_ONLY: "ללא שינוי",
        REMOVED: "מוצעת להסרה",
      },
      currentColumnTitle: "מצב נוכחי",
      proposedColumnTitle: "מוצע",
      noCurrentImage: "תמונה חדשה — אינה קיימת כיום",
      proposedBy: "הוצע על ידי",
      proposedAt: "בתאריך",
      changedFieldNote: "שונה",
      // Gallery Image Removal sprint — was "illustrative only, no write
      // path exists yet," accurate before this sprint. A REMOVED item shown
      // here is now a real, actionable proposal — see
      // lib/admin/gallery-review.js's header comment.
      removalLimitationNote:
        "אישור בקשה זו יסיר את התמונה לצמיתות מהאתר הציבורי.",
      actions: {
        approve: "אשר ופרסם",
        approving: "מאשר...",
        approved: "התמונה אושרה ופורסמה באתר.",
        requestChanges: "בקש שינויים",
        rejectionNoteLabel: "הערה לעורך (חובה)",
        rejectionNotePlaceholder: "מה צריך לתקן?",
        confirmReject: "שלח דחייה",
        rejecting: "שולח...",
        rejected: "הבקשה נדחתה וההערה נשלחה לעורך.",
        cancel: "ביטול",
        genericError: "משהו נכשל. נסה שוב.",
      },
    },
    // Owner Approve/Reject (Gallery) sprint — surfaces a rejected image's
    // Owner note above the Gallery editor. Mirrors `social.rejectionNotice`
    // exactly.
    rejectionNotice: {
      eyebrowIcon: "⚠️",
      title: "הבעלים בקש שינויים בתמונה הזו",
      subtitle: "אפשר לערוך ולשלוח את התמונה מחדש לאישור.",
      noteLabel: "הערת הבעלים",
      resumeAction: "המשך תיקון",
      resuming: "פותח טיוטה לתיקון...",
      resumeError: "לא הצלחנו לפתוח טיוטה לתיקון. נסה שוב.",
    },
  },

  // Social Links Editor Foundation sprint — generic copy for any
  // "Current Published / Proposed Update" *social links* editor
  // (SocialLinksEditor + SocialLinkRow). Lives at this top level, not under
  // `talent`, for the same reason `gallery` does: the components are
  // entity-agnostic and meant to be reused for agency social links, contact
  // info, footer links, and brand pages later — only the talent workspace's
  // רשתות tab uses it this sprint.
  social: {
    publishedEyebrowIcon: "🌍",
    publishedEyebrowTitle: "רשתות מפורסמות",
    publishedSubtitle: "כך הרשתות החברתיות מוצגות באתר כרגע.",
    proposedEyebrowIcon: "✏️",
    proposedEyebrowTitle: "עדכון מוצע",
    proposedSubtitle: "אלו החשבונות שאתה מציע. שום דבר לא יתפרסם באתר לפני אישור.",
    notSet: "לא קיים",
    comingSoon: "האפשרות הזו עדיין לא זמינה.",
    actions: {
      openLink: "פתח קישור",
      copyLink: "העתק קישור",
    },
    platforms: {
      instagram: "אינסטגרם",
      tiktok: "טיקטוק",
      youtube: "יוטיוב",
      facebook: "פייסבוק",
      website: "אתר אינטרנט",
      // Socials Tab Multi-Account UI sprint — schema already had THREADS
      // (SocialPlatform enum); this is the first UI slot for it.
      threads: "ת'רדס",
    },
    // Socials Tab Multi-Account UI sprint — mirrors the Prisma
    // `SocialAccountLabel` enum 1:1 (see SOCIAL_ACCOUNT_LABELS in
    // lib/admin/social-platforms.js). Keys are deliberately the raw
    // uppercase enum values, not camelCase, so there's no translation step
    // between a DB row's `label` and this lookup.
    labels: {
      MAIN: "ראשי",
      SECONDARY: "משני",
      SPAM: "ספאם",
      BRAND: "מותג",
      PERSONAL: "אישי",
      OTHER: "אחר",
    },
    // Field copy shared between a published/proposed SocialAccountCard and
    // the new "add platform" form — one set of labels for "handle" / "url" /
    // "custom label" everywhere they appear.
    fields: {
      handle: "שם משתמש",
      // Socials Tab handle UX sprint — the field now takes the username
      // only (no "@"), so the placeholder no longer shows one either.
      handlePlaceholder: "שם_משתמש",
      url: "קישור",
      urlPlaceholder: "https://…",
      label: "סוג חשבון",
      customLabel: "תווית מותאמת",
      customLabelPlaceholder: "לדוגמה: חשבון מעריצים",
      customLabelHelper: "מוצג רק כשבוחרים בסוג החשבון \"אחר\".",
      preview: "תצוגה מקדימה",
    },
    noPreview: "אין עדיין שם משתמש או קישור",
    noPublishedAccountsTitle: "אין עדיין חשבונות מפורסמים",
    noPublishedAccountsDescription: "כשיתפרסם חשבון רשת חברתית, הוא יוצג כאן.",
    noProposedAccountsTitle: "אין חשבונות בתצוגה המקדימה",
    noProposedAccountsDescription: "אפשר להוסיף פלטפורמה חדשה כדי להתחיל.",
    // Gallery UX Polish sprint's honesty pattern, reused here (Socials Tab
    // Multi-Account UI sprint) now that this tab does more than swap text
    // in five fixed fields: replaces the retired shared <EditorHelperNote>
    // for this tab specifically, same reasoning MediaGalleryEditor's
    // <PreviewModeNotice> already documents.
    previewModeNotice: {
      title: "מצב תצוגה מקדימה",
      body: "עורך הרשתות החברתיות נמצא כרגע במצב תצוגה מקדימה. הוספה ועריכה כאן הן מקומיות בלבד — שום דבר לא נשמר ולא מתפרסם באתר.",
    },
    previewBadge: "לא נשמר",
    // "+ הוסף פלטפורמה" trigger + the form it reveals.
    addAccount: {
      trigger: "+ הוסף פלטפורמה",
      formTitle: "הוספת חשבון",
      platformLabel: "פלטפורמה",
      duplicatePlatformHint:
        "אפשר לבחור פלטפורמה שכבר קיימת — היא תתווסף כחשבון נוסף, בלי להחליף את הקיים.",
      submit: "הוסף",
      cancel: "ביטול",
    },
    // Social Links persistence sprint — Hebrew validation/error copy for the
    // real Save Draft / Submit network calls (socialsService.js +
    // app/api/admin/talent/[id]/socials/*), mirroring
    // `talent.create.errors`'s structure/tone exactly (same key names where
    // the situation matches: notAuthenticated/invalidBody/
    // validationSummary/serverError/networkError), plus a few keys specific
    // to a social account's own fields (platform/label/customLabel/
    // handle-or-url/url) and to this multi-row flow (notFound/notEditable/
    // nothingToSubmit).
    errors: {
      notAuthenticated: "ההתחברות פגה. יש להתחבר מחדש.",
      invalidBody: "הנתונים שנשלחו לא תקינים.",
      validationSummary: "יש לתקן את החשבונות המסומנים ולנסות שוב.",
      invalidPlatform: "יש לבחור פלטפורמה תקינה.",
      invalidLabel: "יש לבחור סוג חשבון תקין.",
      customLabelRequired: "יש להזין תווית מותאמת כשבוחרים בסוג החשבון \"אחר\".",
      missingHandleOrUrl: "יש להזין שם משתמש או קישור לפחות.",
      invalidUrl: "הקישור שהוזן אינו תקין. יש להזין כתובת שמתחילה ב-http:// או https://.",
      notFound: "החשבון המבוקש לא נמצא.",
      notEditable: "אי אפשר לערוך את החשבון הזה כרגע.",
      nothingToSubmit: "אין טיוטה לרשתות חברתיות לשליחה לאישור כרגע.",
      serverError: "משהו נכשל בשמירה. נסה שוב.",
      networkError: "תקלת תקשורת — בדוק את החיבור ונסה שוב.",
      // Owner Approve/Reject (Social Links) sprint.
      notOwner: "רק לבעלים יש הרשאה לפעולה זו.",
      // Auth Hardening + Draft Ownership Sprint 1 — an EMPLOYEE tried to
      // edit/submit/discard/resume a draft created by a different user.
      notDraftOwner: "אפשר לערוך רק טיוטות שיצרת בעצמך.",
      notProposable: "אפשר לאשר או לדחות רק בקשות שעדיין מחכות לאישור.",
      rejectionNoteRequired: "יש להזין הערה לפני דחיית הבקשה.",
    },
    // Owner Review (Social Links) sprint — read-only copy for the new panel
    // that shows an Owner exactly what a submitted Social Links proposal
    // changes, before any approve/reject action exists. Lives under
    // `social`, not a new top-level key, since this is still "social links"
    // copy — just for the review surface instead of the editor.
    review: {
      eyebrowIcon: "🔍",
      title: "בקשת עדכון לרשתות חברתיות",
      subtitle: "כך ייראו הרשתות החברתיות של הטאלנט אם הבקשה הזו תאושר.",
      pendingNote: "הבקשה הזו עדיין מחכה לאישור. שום דבר לא פורסם באתר.",
      noProposalTitle: "אין בקשת עדכון פתוחה",
      noProposalDescription: "כשתישלח בקשה לעדכון רשתות חברתיות, היא תוצג כאן לבדיקה.",
      summary: {
        added: "חשבונות חדשים",
        changed: "חשבונות ששונו",
        unchanged: "חשבונות ללא שינוי",
        removed: "חשבונות להסרה",
      },
      status: {
        ADDED: "חשבון חדש",
        CHANGED: "השתנה",
        UNCHANGED: "ללא שינוי",
        UNCHANGED_PUBLISHED_ONLY: "ללא שינוי",
        REMOVED: "מוצע להסרה",
      },
      currentColumnTitle: "מצב נוכחי",
      proposedColumnTitle: "מוצע",
      noCurrentAccount: "חשבון חדש — אינו קיים כיום",
      proposedBy: "הוצע על ידי",
      proposedAt: "בתאריך",
      changedFieldNote: "שונה",
      // Limitation note shown only if a REMOVED item ever actually appears
      // (see lib/admin/social-review.js's header comment — not reachable
      // via any current write path, kept here for forward compatibility).
      removalLimitationNote:
        "הסרת חשבון מסומנת כאן להמחשה בלבד — אין עדיין דרך ביישום ליצור בקשת הסרה כזו.",
      // Owner Approve/Reject (Social Links) sprint — labels/states for the
      // new per-account Approve / Request changes controls.
      actions: {
        approve: "אשר ופרסם",
        approving: "מאשר...",
        approved: "החשבון אושר ופורסם באתר.",
        requestChanges: "בקש שינויים",
        rejectionNoteLabel: "הערה לעורך (חובה)",
        rejectionNotePlaceholder: "מה צריך לתקן?",
        confirmReject: "שלח דחייה",
        rejecting: "שולח...",
        rejected: "הבקשה נדחתה וההערה נשלחה לעורך.",
        cancel: "ביטול",
        genericError: "משהו נכשל. נסה שוב.",
      },
    },
    // Owner Approve/Reject (Social Links) sprint — surfaces a rejected
    // account's Owner note right above the Socials editor, the same way
    // he.talent.detail's rejection notice surfaces a rejected TalentVersion
    // near the Details editor. Plural-agnostic copy (works for one or
    // several rejected accounts) since rejection here is per-account, not
    // per-talent.
    rejectionNotice: {
      eyebrowIcon: "⚠️",
      title: "הבעלים בקש שינויים בחשבון הזה",
      subtitle: "אפשר לערוך ולשלוח את החשבון מחדש לאישור.",
      noteLabel: "הערת הבעלים",
      // Rejected Resubmission Recovery sprint — the "Continue fixing"
      // action that turns a REJECTED row into a fresh, editable DRAFT (see
      // socialsService.resumeRejected). Lives alongside the read-only
      // copy above; this is the only interactive control this notice has.
      resumeAction: "המשך תיקון",
      resuming: "פותח טיוטה לתיקון...",
      resumeError: "לא הצלחנו לפתוח טיוטה לתיקון. נסה שוב.",
    },
  },

  // SEO Editor Foundation sprint — generic copy for any "Current Published
  // / Proposed Update" *SEO metadata* editor (SeoEditor + SeoFieldRow +
  // SearchResultPreview). Lives at this top level, not under `talent`, for
  // the same reason `gallery`/`social` do: the components are
  // entity-agnostic and meant to be reused for talent pages, the homepage,
  // about/contact/legal pages later — only the talent workspace's SEO tab
  // uses it this sprint.
  seo: {
    publishedEyebrowIcon: "🌍",
    publishedEyebrowTitle: "SEO מפורסם",
    publishedSubtitle: "כך הפרטים האלה מוצגים באתר כרגע.",
    proposedEyebrowIcon: "✏️",
    proposedEyebrowTitle: "עדכון מוצע",
    proposedSubtitle: "אלו הפרטים שאתה מציע. שום דבר לא יתפרסם באתר לפני אישור.",
    charCountSuffix: "תווים",
    intro:
      "הפרטים האלה לא מופיעים בעמוד עצמו — הם מה שגוגל ורשתות חברתיות מציגים כשהעמוד הזה מופיע בתוצאות חיפוש או משותף.",
    groups: {
      search: "תוצאות חיפוש (גוגל)",
      social: "שיתוף ברשתות חברתיות",
      indexing: "הצגה במנועי חיפוש",
    },
    fields: {
      title: "כותרת SEO",
      titleHelper: "הכותרת שתוצג בכותרת תוצאת החיפוש בגוגל. מומלץ עד כ-60 תווים.",
      description: "תיאור SEO",
      descriptionHelper: "התקציר שיוצג מתחת לכותרת בתוצאת החיפוש בגוגל. מומלץ עד כ-160 תווים.",
      canonicalUrl: "כתובת קנונית (Canonical)",
      canonicalUrlHelper:
        "הכתובת הרשמית של העמוד עבור מנועי חיפוש. משאירים ריק כדי להשתמש אוטומטית בכתובת הציבורית של העמוד.",
      ogTitle: "כותרת לשיתוף (Open Graph)",
      ogTitleHelper: "הכותרת שתוצג כששולחים את הקישור לעמוד הזה בוואטסאפ, פייסבוק או אינסטגרם.",
      ogDescription: "תיאור לשיתוף (Open Graph)",
      ogDescriptionHelper: "התיאור שיוצג מתחת לכותרת כששולחים את הקישור לעמוד הזה ברשתות חברתיות.",
      ogImage: "תמונה לשיתוף (Open Graph)",
      ogImageHelper:
        "כתובת (URL) של התמונה שתוצג כשמשתפים את העמוד. משאירים ריק כדי להשתמש אוטומטית בתמונת הפרופיל.",
      noindex: "להסתיר את העמוד ממנועי חיפוש (Noindex)",
      noindexHelper:
        "כשמסומן, גוגל ומנועי חיפוש אחרים יתבקשו לא להציג את העמוד הזה בתוצאות החיפוש. העמוד עצמו נשאר נגיש למי שיש לו קישור.",
    },
    // Talent SEO + Slug Management sprint — describes the SOURCE of an
    // empty field's automatic value (used as the edit-mode placeholder):
    // "empty" means the smart default applies, never "broken".
    defaults: {
      name: "שם המיוצג/ת",
      bio: "הביוגרפיה",
      profileImage: "תמונת הפרופיל",
      publicUrl: "הכתובת הציבורית של העמוד",
    },
    // SEO effective-value presentation sprint — the read-only view always
    // shows the value the public page will actually render, with a small
    // status badge saying where it came from. The old
    // "לא קיים — ברירת מחדל אוטומטית: ..." wording read like an error and
    // is intentionally gone.
    effective: {
      automatic: "אוטומטי",
      custom: "מותאם אישית",
      // Truly-nothing case (no stored value AND no smart default source,
      // e.g. OG image for a talent with no profile image yet) — a calm
      // em dash, never "לא קיים".
      none: "—",
    },
    preview: {
      title: "תצוגה מקדימה של תוצאת חיפוש",
      subtitle: "הדמיה בלבד — כך זה עשוי להיראות בגוגל, בהתאם לכותרת ולתיאור המוצעים.",
      untitled: "(אין כותרת עדיין)",
      noDescription: "(אין תיאור עדיין)",
    },
    ogPreview: {
      title: "תצוגה מקדימה של שיתוף (Open Graph)",
      subtitle: "הדמיה בלבד — כך הקישור עשוי להיראות כשמשתפים אותו בוואטסאפ או בפייסבוק.",
      noImage: "אין תמונה — תוצג תמונת הפרופיל",
    },
    // Talent SEO + Slug Management sprint — the Slug editor's copy. The
    // slug is the technical tail of the public URL, so all machinery labels
    // stay plain-language.
    slug: {
      sectionTitle: "כתובת העמוד (Slug)",
      helper:
        "החלק האחרון של כתובת העמוד הציבורי. מותר להשתמש רק באותיות באנגלית (a-z), ספרות ומקפים בודדים.",
      urlPreviewLabel: "כתובת ציבורית",
      publishedLabel: "כתובת מפורסמת",
      inputLabel: "Slug",
      generateFromName: "יצירה משם המיוצג/ת",
      resetToPublished: "איפוס לכתובת המפורסמת",
      generateFailed: "לא ניתן ליצור כתובת מהשם — נדרש שם באנגלית.",
      urlChangeNotice: "הכתובת הציבורית תשתנה רק לאחר פרסום.",
      checking: "בודק זמינות…",
      available: "הכתובת פנויה ✓",
      taken: "הכתובת הזו כבר בשימוש אצל מיוצג/ת אחר/ת — לא ניתן יהיה לפרסם איתה.",
      checkFailed: "לא ניתן לבדוק זמינות כרגע. הבדיקה הסופית תתבצע בעת הפרסום.",
      errors: {
        EMPTY: "חובה להזין כתובת (slug).",
        INVALID_CHARACTERS: "מותר להשתמש רק באותיות באנגלית (a-z), ספרות ומקפים.",
        UPPERCASE: "אותיות גדולות אינן מותרות — הכל באותיות קטנות.",
        WHITESPACE: "רווחים אינם מותרים — השתמשו במקף במקום.",
        UNDERSCORE: "קו תחתון (_) אינו מותר — השתמשו במקף במקום.",
        DOUBLE_HYPHEN: "אין להשתמש בשני מקפים רצופים.",
        EDGE_HYPHEN: "הכתובת לא יכולה להתחיל או להסתיים במקף.",
      },
    },
    // Kept for reference by older tests/surfaces; the SEO tab itself now has
    // a real save/submit/publish path (Talent SEO + Slug Management sprint)
    // and no longer renders this notice.
    previewModeNotice: {
      title: "מצב תצוגה מקדימה",
      body: "עורך ה-SEO נמצא כרגע במצב תצוגה מקדימה. אפשר להקליד ולראות תצוגה מקדימה של תוצאת החיפוש, אך שום שינוי כאן לא נשמר ולא מתפרסם באתר.",
    },
  },

  // History Tab Foundation sprint — generic copy for any entity's
  // <Timeline> view (components/admin/Timeline.jsx) over mock history
  // events (lib/admin/mock-history.js). Lives at this top level, not under
  // `talent`, for the same reason `gallery`/`social`/`seo` do: the
  // component is entity-agnostic and meant to be reused for site content,
  // SEO, and homepage history later — only the talent workspace's היסטוריה
  // tab uses it this sprint.
  history: {
    intro: "מה השתנה, מי שינה, ומתי — כל הפעולות על הפרופיל הזה, מהחדשה לישנה.",
    emptyTitle: "אין עדיין היסטוריה",
    emptyDescription: "פעולות על הפרופיל הזה יופיעו כאן לפי הסדר שבו הן קרו.",
    actionLabel: {
      draft_saved: "טיוטה נשמרה",
      submitted: "נשלח לאישור",
      changes_requested: "נדרשו תיקונים",
      approved: "אושר לפרסום",
      published: "גרסה פורסמה",
    },
    // Sprint 2: Real Event-Based History Timeline — labels for the stored
    // Event types (lib/admin/engine/eventTypes.js) the timeline now renders
    // from, via lib/admin/talent-history.js. Deliberately a separate map
    // from actionLabel above (which describes mock/version-row vocabulary):
    // these keys are 1:1 with EVENT_TYPE values, so a future event type
    // added to the catalog needs an explicit entry here before it appears
    // in the timeline — unknown types are skipped, never guessed at.
    eventLabel: {
      proposal_created: "עריכה החלה",
      submitted: "נשלח לאישור",
      approved: "אושר לפרסום",
      rejected: "נדרשו תיקונים",
      discarded: "העריכה בוטלה",
      published: "גרסה פורסמה",
    },
    // Which part of the workspace an event touched, derived only from data
    // already stored on the Event payload (never inferred) — see
    // resolveEventDomain in lib/admin/talent-history.js.
    domainLabel: {
      details: "פרטי הפרופיל",
      gallery: "גלריה",
      socials: "רשתות",
      podcast: "פודקאסט",
    },
    // Shown when an actorId is missing or the user row no longer resolves.
    unknownActor: "—",
    // History timeline default-length limit sprint (components/admin/
    // Timeline.jsx): copy for the expand/collapse control shown only when
    // the projected timeline (event-based or version-row fallback) has more
    // than DEFAULT_VISIBLE_COUNT items.
    showFullHistory: "הצג היסטוריה מלאה",
    showLess: "הצג פחות",
  },

  // Talent Workspace Foundation sprint — list + detail copy. Reuses
  // workflow.statusLabel above for the status badge text rather than
  // redefining the same four labels twice.
  talent: {
    list: {
      title: "מיוצגים",
      emptyTitle: "אין עדיין מיוצגים",
      emptyDescription: "כשיתחילו להתווסף פרופילים, הם יופיעו כאן כתור עבודה.",
      dbNotConfiguredTitle: "מסד הנתונים עדיין לא מחובר",
      dbNotConfiguredDescription: "אזור המיוצגים יתעורר לחיים לאחר חיבור מסד הנתונים.",
      openFolder: "פתח תיק",
      // Admin Read Sprint — row-level labels for the fields newly read from
      // the DB (category/tags, location, social preview). Kept under
      // `list` (not the existing `fields`/`meta` groups) since these are
      // specifically how the read-only roster row presents them, not the
      // editor field labels.
      noLocation: "מיקום לא מוגדר",
      noCategory: "קטגוריה לא מוגדרת",
      noSocial: "אין רשת חברתית מפורסמת",
      // Talent List Polish sprint — client-side search box copy. Search
      // matches name, location, category/tags, and social handle — see
      // TalentListClient.jsx's buildSearchHaystack for the exact field list.
      searchPlaceholder: "חיפוש לפי שם, מיקום, קטגוריה או רשת חברתית…",
      searchLabel: "חיפוש מיוצגים",
      searchEmptyTitle: "אין תוצאות",
      searchEmptyDescription: "לא נמצאו מיוצגים שמתאימים לחיפוש. נסה מילה אחרת.",
      // Talent List Filters sprint, corrected by the Talent List Polish
      // (read-only) sprint — status filter pills below the search box.
      // "draft" = no published version yet (still being prepared); see
      // lib/admin/talent-workspace.js's isListTalentDraft. "hidden" reads
      // the real `visibility` field (isListTalentHidden) as of the Talent
      // Visibility sprint.
      //
      // Talent Visibility UI Polish sprint — "hidden" is an attribute of an
      // already-published talent (visibility lives on the *published*
      // version), not a fourth, mutually-exclusive lifecycle bucket like
      // "draft" — a Hidden talent is always also counted in "published".
      // The four pill labels below are unchanged (still correct on their
      // own), but `publishedHint`/`hiddenHint` were added as `title`
      // tooltips on those two pills (see TalentListClient.jsx) so an Owner
      // hovering either one sees that overlap spelled out, instead of
      // reading "פורסמו (10) / מוסתרים (1)" as if they were two disjoint
      // counts of 11.
      filters: {
        groupLabel: "סינון לפי סטטוס",
        all: "הכל",
        published: "פורסמו",
        publishedHint: "כל המיוצגים עם גרסה שפורסמה — כולל מי שמוסתר מהאתר הציבורי",
        hidden: "מוסתרים",
        hiddenHint: "מיוצגים מפורסמים שהוסתרו מהאתר הציבורי (תת-קבוצה של \"פורסמו\")",
        draft: "טיוטות",
      },
      // Add New Talent sprint — the PageHeader action button that links to
      // /admin/talent/new.
      addNew: "הוסף מיוצג חדש",
      // Talent Visibility sprint (admin UI) — muted badge shown beside a
      // Hidden talent's card (TalentQueueRow.jsx), driven by
      // isListTalentHidden now reading the real `visibility` field. No
      // badge at all for a Visible talent — see that file's header comment
      // on why an extra "Visible" badge would be visual noise.
      hiddenBadge: "מוסתר",
    },
    // Add New Talent sprint — copy for the new /admin/talent/new page and
    // its form (NewTalentForm.jsx). Kept as its own top-level group under
    // `talent` (sibling of `list`/`detail`), since it's a third, distinct
    // page rather than a variant of either.
    //
    // Add New Talent flow revision (product decision): this page now only
    // collects the true initial fields — Hebrew name, English name, slug.
    // Category, location, birth date, and bio are no longer collected here
    // at all; they're added afterward on the talent detail page, along
    // with gallery/socials/SEO, before the normal approval/publish workflow
    // applies. `pageDescription` replaces the old "saves and publishes
    // directly" notice with an explanation of this draft-first flow.
    create: {
      // Create Talent Screen Polish sprint — "הוספת" ("adding") implied an
      // already-finished record; "יצירת" ("creating") matches what this
      // screen actually produces: a brand-new Draft, not a finished/
      // published talent. pageDescription reworded to name the Draft state
      // explicitly instead of only describing the next steps.
      pageTitle: "יצירת מיוצג חדש",
      pageDescription:
        "בשלב הזה ניצור כרטיס מיוצג ראשוני במצב טיוטה. שום דבר לא יתפרסם באתר. לאחר השמירה תועברו לעמוד המיוצג להשלמת פרטים, תמונות, רשתות חברתיות ו־SEO לפני שליחה לאישור.",
      backToList: "→ חזרה למיוצגים",
      fields: {
        name: "שם בעברית",
        namePlaceholder: "לדוגמה: נועה כהן",
        nameEn: "שם באנגלית",
        nameEnPlaceholder: "Noa Cohen",
        slug: "כתובת עמוד",
        slugPlaceholder: "noa-cohen",
        slugHelper: "הכתובת הקבועה של עמוד המיוצג באתר. לדוגמה: noa-cohen",
        slugPreviewPrefix: "/talent/",
        // Create Talent Sprint 1 — Profile Image + Short Bio, the two
        // remaining fields this sprint adds to the create form. Profile
        // image reuses the same upload endpoint/copy tone as the Gallery
        // editor (he.gallery.actions/errors) rather than duplicating new
        // strings for the same upload behavior; only the section label and
        // a couple of create-specific hints live here.
        profileImage: "תמונת פרופיל",
        profileImageHint: "אופציונלי. ניתן להעלות או להחליף תמונה גם בהמשך, בעמוד המיוצג.",
        // Create Talent Screen Polish sprint — modern click-or-drop zone
        // copy, same tone/shape as he.gallery.actions's dropHint/or/
        // uploadImage (AddImageCard.jsx) but worded for a single profile
        // photo rather than multiple gallery images.
        profileImageDropHint: "גרור תמונה לכאן",
        profileImageOr: "או",
        profileImageUpload: "לחץ לבחירת תמונה",
        profileImageUploading: "מעלה תמונה…",
        profileImageReplace: "החלף תמונה",
        profileImageRemove: "הסר תמונה",
        profileImageAlt: "תצוגה מקדימה של תמונת הפרופיל",
        bioHe: "תקציר ביוגרפי (עברית)",
        bioHePlaceholder: "כמה משפטים קצרים על המיוצג…",
      },
      // Create Talent Screen Polish sprint — "צור מיוצג" ("create talent")
      // read as if this publishes a finished profile; "שמור כטיוטה" ("save
      // as draft") names the actual, unchanged behavior (see
      // talentRepository.createTalentWithInitialVersion's header comment:
      // the first version is always written DRAFT, never published).
      submit: "שמור כטיוטה",
      submitting: "שומר…",
      cancel: "ביטול",
      successRedirecting: "נוצר בהצלחה — עוברים לפרופיל…",
      dbNotConfiguredTitle: "מסד הנתונים עדיין לא מחובר",
      dbNotConfiguredDescription: "לא ניתן להוסיף מיוצג חדש לפני שמסד הנתונים מחובר.",
      errors: {
        notAuthenticated: "ההתחברות פגה. יש להתחבר מחדש.",
        invalidBody: "הנתונים שנשלחו לא תקינים.",
        validationSummary: "יש לתקן את השדות המסומנים ולנסות שוב.",
        nameRequired: "יש להזין שם בעברית.",
        slugRequired: "יש להזין כתובת עמוד (slug).",
        slugInvalid: "כתובת יכולה להכיל רק אותיות לטיניות קטנות, מספרים ומקפים, לדוגמה noa-cohen.",
        slugTaken: "כתובת עמוד זו תפוסה. נסה כתובת אחרת.",
        serverError: "משהו נכשל בשמירה. נסה שוב.",
        networkError: "תקלת תקשורת — בדוק את החיבור ונסה שוב.",
      },
    },
    detail: {
      backToList: "→ חזרה למיוצגים",
      notFoundDescription: "המיוצג הזה לא נמצא.",
      dbNotConfiguredDescription: "מסד הנתונים עדיין לא מחובר.",
      slug: "כתובת (Slug)",
      technicalInfo: "מידע טכני",
      technicalInfoHint: "פרטים פנימיים — לשימוש טכני בלבד",
      noPublishedVersionTitle: "אין עדיין גרסה מפורסמת",
      noPublishedVersionDescription: "כשתאושר ותתפרסם גרסה ראשונה, הפרטים שלה יוצגו כאן.",
      rejectionNote: "הערת תיקון מהבעלים",
      // "Start Editing" sprint — copy for StartEditingButton.jsx's three
      // states (no pending version / DRAFT already exists / PROPOSED already
      // exists). Lives under `detail` since it's specific to this workspace
      // page, not a generic entity-agnostic editor like `editor` above.
      startEditing: {
        startLabel: "התחל בעריכה",
        startLoading: "יוצר טיוטה…",
        continueLabel: "המשך בעריכה",
        continueLoading: "טוען טיוטה…",
        proposedBlockedLabel: "ממתין לאישור — לא ניתן להתחיל טיוטה חדשה",
        proposedBlockedHint: "יש כאן גרסה מוצעת שמחכה לבדיקת הבעלים. אפשר להתחיל טיוטה חדשה רק אחרי שתתקבל הכרעה.",
        genericError: "משהו נכשל. נסה שוב.",
      },
      // Cancel Editing / Discard Draft sprint — copy for
      // CancelEditingButton.jsx, the top-level "בטל עריכה" action shown next
      // to StartEditingButton above whenever a DRAFT exists (both OWNER and
      // EMPLOYEE see it; PROPOSED has its own Owner Reject flow and is
      // unaffected). Lives under `detail` for the same reason `startEditing`
      // does — specific to this workspace page's header, not the generic
      // entity-agnostic `editor` copy above.
      cancelEditing: {
        label: "בטל עריכה",
        loading: "מבטל…",
        genericError: "משהו נכשל. נסה שוב.",
        // Pre-merge blocker fix sprint (QA finding #2) — confirmation
        // dialog (ConfirmDialog) shown before the DRAFT row is actually
        // deleted. The copy is explicit that this erases the whole draft —
        // saved and unsaved edits alike, across all tabs — not just unsaved
        // field changes, because that is exactly what POST .../discard
        // does. The published version is untouched, and that's said too.
        confirmTitle: "לבטל את העריכה ולמחוק את הטיוטה?",
        confirmBody:
          "הפעולה תמחק את הטיוטה כולה — כולל שינויים שכבר נשמרו בה (פרטים, פודקאסט, נראוּת ועוד), ולא רק שינויים שטרם נשמרו. הגרסה המפורסמת באתר לא תושפע. טיוטה שנמחקה אינה ניתנת לשחזור.",
        confirmLabel: "מחק את הטיוטה",
        confirmCancelLabel: "המשך עריכה",
      },
      // Talent Visibility sprint (admin UI) — copy for the header's
      // Hide-from-Public-Site / Restore-Visibility action and its
      // confirmation dialog. Lives under `detail` for the same reason
      // `startEditing`/`cancelEditing` do: specific to this workspace
      // page's header, not the generic entity-agnostic `editor` copy above.
      //
      // The action never publishes immediately for either role — it only
      // ever creates/updates the current Draft's `visibility` field,
      // exactly like editing any other field (see
      // components/admin/TalentVisibilityAction.jsx). Owner vs Employee
      // copy differs only to set accurate expectations about what happens
      // *next*: an Owner is one "פרסם מיד" click away from this taking
      // effect on the live site; an Employee's change still needs to be
      // submitted and approved first.
      visibilityAction: {
        hideLabel: "הסתר מהאתר הציבורי",
        restoreLabel: "השב נראות לאתר",
        hideLoading: "מסתיר…",
        restoreLoading: "משיב נראות…",
        genericError: "משהו נכשל. נסה שוב.",
        confirmHideTitle: "להסתיר את המיוצג מהאתר הציבורי?",
        confirmRestoreTitle: "להשיב את המיוצג לנראות באתר הציבורי?",
        confirmHideBodyOwner:
          "המיוצג יוסר מהאתר הציבורי לאחר פרסום. שום מידע לא יימחק — אפשר להשיב את הנראות בכל שלב. השינוי ייכנס לתוקף באופן מיידי אם תבחר/י לפרסם מיד.",
        confirmHideBodyEmployee:
          "המיוצג יוסר מהאתר הציבורי לאחר פרסום. שום מידע לא יימחק. השינוי ישמר כטיוטה ויידרש שליחה לאישור הבעלים לפני שייכנס לתוקף.",
        confirmRestoreBodyOwner:
          "המיוצג יהיה גלוי לציבור מחדש לאחר פרסום. השינוי ייכנס לתוקף באופן מיידי אם תבחר/י לפרסם מיד.",
        confirmRestoreBodyEmployee:
          "המיוצג יהיה גלוי לציבור מחדש לאחר פרסום. השינוי ישמר כטיוטה ויידרש שליחה לאישור הבעלים לפני שייכנס לתוקף.",
        confirmHideCta: "הסתר",
        confirmRestoreCta: "השב נראות",
        confirmCancel: "ביטול",
      },
      // Talent Detail Header DB read-only mapping sprint — copy for the new
      // read-only profile summary block (photo / birth date / computed
      // age) shown below the workspace header, above the tabs. No editing
      // copy here on purpose — this block has no Save/Submit action.
      profile: {
        imageAlt: (name) => `תמונת הפרופיל של ${name}`,
        noImage: "אין תמונת פרופיל",
        birthDate: "תאריך לידה",
        age: "גיל",
        ageYears: (age) => `${age}`,
        notSet: "—",
        // Profile Image section sprint — dedicated section (no longer a
        // small header avatar). Copy clarifies this is the talent's primary
        // published image, and labels the reserved (disabled) controls for
        // the future upload/crop/zoom sprint — none of those are wired up
        // yet, this is layout-only.
        image: {
          sectionTitle: "תמונת פרופיל",
          previewLabel: "תצוגה מקדימה",
          // Profile Image Replace sprint — "replace" is now a live
          // click/drag-and-drop upload (mirrors the Gallery upload
          // experience); crop/zoom remain out of scope, so their hint stays.
          comingSoonHint: "החיתוך והזום עדיין לא זמינים כאן.",
          controls: {
            replace: "החלפת תמונה",
            crop: "חיתוך / מיקום",
            zoom: "זום / קנה מידה",
          },
          // Profile Image Replace sprint — copy for the new interactive
          // click-to-replace / drag-and-drop upload flow, mirroring
          // gallery.actions's tone exactly. The upload route itself already
          // returns a ready-to-display Hebrew `error` string (sourced from
          // he.gallery.errors.* server-side — see
          // app/api/admin/assets/upload/route.js), so the client only needs
          // one generic fallback for the rare case a response has no body.
          dropHint: "גרור תמונה לכאן",
          clickHint: "לחץ להחלפת התמונה",
          dragActiveHint: "שחרר כאן להעלאה",
          uploading: "מעלה תמונה...",
          uploadGenericError: "העלאת התמונה נכשלה. נסה שוב.",
          networkError: "תקלת תקשורת — בדוק את החיבור ונסה שוב.",
          noEditableVersionHint:
            "כדי להחליף את תמונת הפרופיל יש להתחיל עריכה (טיוטה) למיוצג הזה — אותו תהליך המשמש לעריכת הכרטיסייה פרטים.",
        },
      },
      // Podcast tab sprint — copy for the dedicated, editable "פודקאסט" tab
      // (sibling of פרטים/גלריה/רשתות/SEO/היסטוריה).
      //
      // Enable Podcast Save sprint — the four text fields themselves are no
      // longer rendered by this tab's own markup; they're now a
      // ComparisonView field group (via <TalentDetailsEditor>, the exact
      // same Save Draft/Submit machinery the פרטים tab already uses), so
      // their labels live in `talent.fields` instead (see
      // buildPodcastGroups in app/admin/talent/[id]/page.jsx). What's left
      // here is just the surrounding chrome this tab still owns directly:
      // the empty-state banner, the image preview/placeholder, and the
      // still-disabled image-replace control.
      //
      // Podcast Panel Removal cleanup sprint — the standalone read-only
      // top-of-page preview (formerly `detail.podcast`) is gone; this tab
      // is now the only place podcast data is shown or edited, so
      // `imageAlt` moved here from that removed block (still the only
      // place it's used) instead of being deleted outright.
      //
      // Podcast tab UX polish sprint — when the published version has no
      // podcast data at all, the tab now shows this empty-state copy
      // instead of the placeholder-filled preview (see PodcastTab.jsx);
      // emptyDescription updated to reflect that framing.
      podcastTab: {
        emptyTitle: "אין עדיין נתוני פודקאסט",
        emptyDescription: "למיוצג זה עדיין לא הוגדר פודקאסט. אפשר להתחיל עריכה ולהוסיף אותו בעתיד.",
        viewOnYoutube: "צפייה ביוטיוב",
        noVideoLink: "אין קישור לוידאו",
        imageLabel: "תמונת פודקאסט",
        noImage: "אין תמונה לפודקאסט",
        imageAlt: (name) => `תמונת הפודקאסט של ${name}`,
        replaceImage: "החלף תמונה",
        // Podcast Image Upload sprint — the "החלף תמונה" control is a real
        // upload flow now (was a disabled placeholder with a "coming soon"
        // hint, formerly `comingSoonHint` here). Generic upload-error copy
        // stays in he.media.errors (shared with profile/gallery); only the
        // states specific to this tab's own chrome live here.
        uploading: "מעלה תמונה...",
        uploadSaved: "התמונה הועלתה ונשמרה בטיוטה.",
        pendingImageHint: "מוצגת תמונה חדשה מהטיוטה — תפורסם רק לאחר אישור.",
        replaceImageNoVersionHint:
          "כדי להחליף את התמונה יש להתחיל עריכה (טיוטה) קודם — אותו תהליך המשמש לעריכת שאר השדות.",
        noEditableVersionHint:
          "כדי לערוך את שדות הפודקאסט יש להתחיל עריכה (טיוטה) למיוצג הזה — אותו תהליך המשמש לעריכת הכרטיסייה פרטים.",
      },
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
      // Sprint 8A (Campaigns UI Prototype) — the talent workspace's
      // Campaigns tab (prototype-only content, fake local data).
      campaigns: "קמפיינים",
      gallery: "גלריה",
      socials: "רשתות",
      seo: "SEO",
      podcast: "פודקאסט",
      history: "היסטוריה",
    },
    sectionPlaceholder: {
      title: "האזור הזה בבנייה",
      description: (label) => `אזור "${label}" עדיין בבנייה ויתעורר לחיים בקרוב.`,
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
      // "Location & age" cleanup sprint — birthDate/age moved into this
      // same fields map from the now-removed `detail.profile` block, so
      // they render inside the "מיקום וגיל" group like every other field
      // here.
      birthDate: "תאריך לידה",
      age: "גיל",
      featured: "מומלץ",
      // Talent Detail Foundation sprint — exposes the existing sortOrder/
      // featuredOrder columns for the first time. Deliberately
      // user-facing, non-technical labels (no "sortOrder"/"featuredOrder"
      // anywhere in the UI) — these describe what the number controls, not
      // the column name.
      sortOrder: "סדר תצוגה באתר",
      featuredOrder: "סדר בתוך מיוצגים נבחרים",
      bio: "ביוגרפיה",
      bioEn: "ביוגרפיה (אנגלית)",
      yes: "כן",
      no: "לא",
      empty: "—",
      // Enable Podcast Save sprint — labels for the podcast tab's
      // ComparisonView field group (buildPodcastGroups in
      // app/admin/talent/[id]/page.jsx), same fields map every other
      // editable field already uses.
      podcastTitle: "כותרת הפודקאסט",
      podcastDescriptionHe: "תיאור (עברית)",
      podcastDescriptionEn: "תיאור (אנגלית)",
      podcastVideoEmbedUrl: "קישור להטמעת וידאו",
      // Talent Visibility sprint (admin UI) — the ComparisonView row for
      // TalentVersion.visibility (buildDetailsGroups' "basic" group). Read-
      // only in both columns (type "visibility", same read-only pattern as
      // "computed"/age) — the actual change happens via the header's
      // Hide/Restore action + confirm dialog, not by typing in this row,
      // so there is exactly one place that mutates visibility, per the
      // "do not create a second workflow for visibility" constraint.
      visibility: "נראות באתר",
      visibilityVisible: "גלוי",
      visibilityHidden: "מוסתר",
    },
  },

  // Sprint 3: Users UI — Owner-only /admin/users page (app/admin/users/
  // page.jsx + UsersPageClient.jsx) and its API routes
  // (app/api/admin/users/*). Employees never see this page or its copy
  // (redirected before render — see page.jsx's header comment).
  users: {
    title: "משתמשים",
    description: "ניהול חשבונות עובדים. הרשאות בעלים בלבד.",
    dbNotConfiguredTitle: "מסד הנתונים עדיין לא מחובר",
    dbNotConfiguredDescription: "ניהול המשתמשים יתעורר לחיים לאחר חיבור מסד הנתונים.",
    emptyTitle: "אין עדיין משתמשים",
    emptyDescription: "משתמשים שייווצרו יופיעו כאן.",
    table: {
      email: "אימייל",
      displayName: "שם תצוגה",
      noDisplayName: "—",
      role: "תפקיד",
      status: "סטטוס",
      lastLogin: "התחברות אחרונה",
      createdAt: "נוצר בתאריך",
      actions: "פעולות",
      never: "מעולם לא",
      you: "(אתה)",
    },
    status: {
      active: "פעיל",
      inactive: "מושבת",
    },
    addEmployee: {
      trigger: "+ הוסף עובד",
      formTitle: "הוספת עובד חדש",
      fields: {
        email: "אימייל",
        emailPlaceholder: "name@example.com",
        displayName: "שם תצוגה",
        displayNamePlaceholder: "לדוגמה: נועה כהן",
        temporaryPassword: "סיסמה זמנית",
        temporaryPasswordPlaceholder: "לפחות 8 תווים",
        temporaryPasswordHelper: "מסרו לעובד באופן מאובטח. אין עדיין תהליך איפוס סיסמה עצמאי — שמרו את הסיסמה במקום בטוח.",
      },
      submit: "צור משתמש",
      submitting: "יוצר…",
      cancel: "ביטול",
    },
    // Sprint 3.2: User Detail UX Cleanup — replaces the old per-field
    // `editDisplayName` inline trigger with one top-level "Edit profile"
    // mode covering both displayName and email together (Save/Cancel),
    // matching the Talent editor's "click Edit, fields become editable
    // together" feel instead of a separate inline edit link per row.
    editProfile: {
      trigger: "ערוך פרופיל",
      save: "שמור",
      saving: "שומר…",
      cancel: "ביטול",
    },
    activation: {
      activate: "הפעל",
      deactivate: "השבת",
      activating: "מפעיל…",
      deactivating: "משבית…",
      confirmDeactivateTitle: "להשבית את המשתמש?",
      confirmDeactivateBody: "המשתמש לא יוכל להתחבר יותר עד שיופעל מחדש.",
      confirmActivateTitle: "להפעיל את המשתמש מחדש?",
      confirmActivateBody: "המשתמש יוכל להתחבר שוב מיד.",
      confirmCancelLabel: "ביטול",
      ownerHint: "לא ניתן להשבית חשבון בעלים דרך מסך זה.",
    },
    errors: {
      notAuthenticated: "ההתחברות פגה. יש להתחבר מחדש.",
      notOwner: "רק לבעלים יש הרשאה לפעולה זו.",
      invalidBody: "הנתונים שנשלחו לא תקינים.",
      validationSummary: "יש לתקן את השדות המסומנים ולנסות שוב.",
      emailTaken: "קיים כבר משתמש עם אימייל זה.",
      serverError: "משהו נכשל. נסה שוב.",
      networkError: "תקלת תקשורת — בדוק את החיבור ונסה שוב.",
      cannotDisableSelf: "אי אפשר להשבית את החשבון שלך.",
      cannotDisableOnlyOwner: "אי אפשר להשבית את חשבון הבעלים היחיד.",
    },
    // Sprint 3.1: User Details Page — /admin/users/[id]. The list row's
    // "עריכה"/toggle now link here instead of editing inline (see
    // UsersPageClient.jsx); this block holds all of that page's copy.
    detail: {
      // Sprint 3.2 QA fix: this admin UI is RTL (dir="rtl") — "back" should
      // point right, mirroring how he.talent.detail.backToList already does
      // it. The old "←" was a leftover LTR convention.
      backToList: "→ חזרה לרשימת המשתמשים",
      title: "פרטי משתמש",
      manage: "ניהול",
      fields: {
        email: "אימייל",
        displayName: "שם תצוגה",
        role: "תפקיד",
        status: "סטטוס",
        lastLoginAt: "התחברות אחרונה",
        createdAt: "נוצר בתאריך",
      },
      sections: {
        profile: "פרופיל",
        role: "תפקיד והרשאות",
        security: "אבטחה",
        status: "סטטוס",
        sessions: "התחברויות",
      },
      profile: {
        // Sprint 3.2: email is now editable together with displayName via
        // the single "ערוך פרופיל" mode below — updated from the old
        // "אינו ניתן לעריכה כאן" (email is not editable here) wording.
        description: "שם התצוגה מוצג בכל מקום במסך הניהול. האימייל משמש להתחברות למערכת — שינוי האימייל משנה גם את פרטי ההתחברות של המשתמש.",
      },
      role: {
        description: "תפקיד קובע אילו פעולות ניהול זמינות למשתמש.",
        // Sprint 3.2 QA fix: the old readOnlyNote was a long explanatory
        // paragraph — shortened heavily to a single sentence. Full reasoning
        // for why role editing is deferred (needs the same last-active-Owner
        // guardrails setActive already has) still lives in this file's
        // history / the sprint notes, not in end-user-facing copy.
        readOnlyNote: "עריכת תפקידים תתווסף בעדכון עתידי.",
      },
      security: {
        // Sprint 3.2 QA fix: clarify the flow from the employee's
        // perspective — there is no forced password change on first login
        // (explicitly out of scope), so the copy says plainly that the
        // employee logs in directly with the temporary password, same as
        // any other password, until it's changed again.
        description:
          "קביעת סיסמה זמנית חדשה למשתמש. יש למסור לו אותה באופן מאובטח — הוא יתחבר איתה ישירות, בדיוק כמו סיסמה רגילה. אין כרגע שלב שמחייב אותו להחליף אותה בכניסה הראשונה.",
        newPasswordLabel: "סיסמה זמנית חדשה",
        newPasswordPlaceholder: "לפחות 8 תווים",
        submit: "אפס סיסמה",
        submitting: "מאפס…",
        success: "הסיסמה אופסה בהצלחה. מסרו אותה למשתמש באופן מאובטח — הוא יוכל להתחבר איתה מיד.",
      },
      status: {
        description: "השבתת משתמש חוסמת התחברות עד להפעלה מחדש. לא ניתן למחוק משתמשים במסך זה.",
      },
      // Sprint 3c: Session Management UI — the "התחברויות" card on the User
      // Details page. Only safe, already-approved fields are ever shown
      // (creation/expiry dates, a current-session badge) — no session ids,
      // tokens, IPs, or device/browser guesses appear anywhere in this
      // copy or the component that renders it.
      sessions: {
        description:
          "רשימת ההתחברויות הפעילות של המשתמש. ניתוק התחברות אינו משבית את החשבון ואינו חוסם כניסה עתידית.",
        loading: "טוען התחברויות…",
        empty: "אין התחברויות פעילות.",
        fields: {
          createdAt: "נוצרה בתאריך",
          expiresAt: "בתוקף עד",
        },
        currentBadge: "ההתחברות הנוכחית",
        currentHint: "לא ניתן לנתק את ההתחברות הנוכחית דרך מסך זה. כדי לסיים אותה יש להתנתק.",
        revokeOne: "נתק התחברות",
        revokingOne: "מנתק…",
        revokeAllSelf: "נתק את כל שאר ההתחברויות",
        revokeAllOther: "נתק את כל ההתחברויות",
        revokingAll: "מנתק הכול…",
        confirmOne: {
          title: "לנתק את ההתחברות הזו?",
          body: "ההתחברות הזו תסתיים והמשתמש ייאלץ להתחבר מחדש במכשיר הזה. החשבון לא יושבת והוא יוכל להתחבר שוב מיד.",
        },
        confirmAllSelf: {
          title: "לנתק את כל שאר ההתחברויות שלך?",
          body: "כל ההתחברויות שלך פרט להתחברות הנוכחית ינותקו. ההתחברות הנוכחית שלך תישמר ולא תושפע. החשבון שלך לא יושבת.",
        },
        confirmAllOther: {
          title: "לנתק את כל ההתחברויות של המשתמש?",
          body: "כל ההתחברויות הפעילות של המשתמש ינותקו והוא ייאלץ להתחבר מחדש בכל מקום. החשבון לא יושבת והוא יוכל להתחבר שוב מיד.",
        },
        confirmCancelLabel: "ביטול",
        errors: {
          cannotRevokeCurrent: "לא ניתן לנתק את ההתחברות הנוכחית.",
          sessionGone: "ההתחברות כבר אינה פעילה. הרשימה תתעדכן.",
        },
      },
      notFoundTitle: "המשתמש לא נמצא",
      notFoundDescription: "ייתכן שהמשתמש הוסר או שהקישור שגוי.",
    },
  },

  // Sprint 7B (Clients & Brands Foundation) — Clients module
  // (/admin/clients). Internal operational records: OWNER and EMPLOYEE may
  // view/create/edit; archive is OWNER-only. The `errors` block here is
  // also imported server-side by lib/admin/clientService.js — the friendly
  // Hebrew validation errors the sprint requires are produced at the
  // service layer and passed through by the API routes, so UI and API
  // speak identical copy.
  clients: {
    title: "לקוחות",
    description: "ניהול לקוחות ומותגים.",
    dbNotConfiguredTitle: "מסד הנתונים עדיין לא מחובר",
    dbNotConfiguredDescription: "ניהול הלקוחות יתעורר לחיים לאחר חיבור מסד הנתונים.",
    // Sprint 7B.1 (UX polish) — the empty state actively encourages
    // creating the first client (rendered with a create CTA button).
    emptyTitle: "אין עדיין לקוחות",
    emptyDescription: "עדיין לא נוצרו לקוחות במערכת. צרו את הלקוח הראשון כדי להתחיל.",
    emptyCta: "צור לקוח ראשון",
    searchPlaceholder: "חיפוש לפי שם לקוח או איש קשר…",
    noSearchResults: "לא נמצאו לקוחות התואמים את החיפוש.",
    showArchived: "הצג גם בארכיון",
    table: {
      name: "שם הלקוח",
      contactName: "איש קשר",
      noContactName: "—",
      activeBrands: "מותגים פעילים",
      status: "סטטוס",
      actions: "פעולות",
      view: "פרטים",
    },
    status: {
      active: "פעיל",
      archived: "בארכיון",
    },
    addClient: {
      trigger: "+ הוסף לקוח",
      formTitle: "הוספת לקוח חדש",
      fields: {
        name: "שם הלקוח",
        namePlaceholder: "לדוגמה: לקוח דמו א׳",
        contactName: "שם איש קשר (אופציונלי)",
        contactEmail: "אימייל איש קשר (אופציונלי)",
        contactPhone: "טלפון איש קשר (אופציונלי)",
        notes: "הערות (אופציונלי)",
      },
      submit: "צור לקוח",
      submitting: "יוצר…",
      cancel: "ביטול",
    },
    detail: {
      backToList: "→ חזרה לרשימת הלקוחות",
      title: "פרטי לקוח",
      notFoundTitle: "הלקוח לא נמצא",
      notFoundDescription: "ייתכן שהלקוח הוסר או שהקישור שגוי.",
      edit: "ערוך פרטים",
      save: "שמור",
      saving: "שומר…",
      cancel: "ביטול",
      archivedBadge: "בארכיון",
      archive: {
        trigger: "העבר לארכיון",
        archiving: "מעביר לארכיון…",
        confirmTitle: "להעביר את הלקוח לארכיון?",
        confirmBody:
          "הלקוח יוסתר מהרשימות הפעילות אך יישמר לצורך תיעוד היסטורי. שם הלקוח יישאר שמור ולא ניתן יהיה להשתמש בו שוב. אין אפשרות לשחזר מהארכיון בשלב זה.",
        confirmCancelLabel: "ביטול",
      },
    },
    brands: {
      sectionTitle: "מותגים",
      emptyTitle: "אין עדיין מותגים ללקוח זה",
      // Sprint 7B.1 (UX polish) — friendlier, action-oriented copy.
      emptyDescription: "הוסיפו מותג ראשון ללקוח זה כדי להתחיל.",
      table: {
        name: "שם המותג",
        status: "סטטוס",
        actions: "פעולות",
      },
      addBrand: {
        trigger: "+ הוסף מותג",
        formTitle: "הוספת מותג חדש",
        fields: {
          name: "שם המותג",
          namePlaceholder: "לדוגמה: מותג דמו קיץ",
          notes: "הערות (אופציונלי)",
        },
        submit: "צור מותג",
        submitting: "יוצר…",
        cancel: "ביטול",
      },
      edit: "ערוך",
      save: "שמור",
      saving: "שומר…",
      cancel: "ביטול",
      archive: {
        trigger: "העבר לארכיון",
        archiving: "מעביר לארכיון…",
        confirmTitle: "להעביר את המותג לארכיון?",
        confirmBody:
          "המותג יוסתר מהרשימות הפעילות אך יישמר לצורך תיעוד היסטורי. שם המותג יישאר שמור תחת לקוח זה. אין אפשרות לשחזר מהארכיון בשלב זה.",
        confirmCancelLabel: "ביטול",
      },
    },
    errors: {
      notAuthenticated: "ההתחברות פגה. יש להתחבר מחדש.",
      forbidden: "אין לך הרשאה לפעולה זו.",
      archiveOwnerOnly: "רק לבעלים יש הרשאה להעביר לארכיון.",
      invalidBody: "הנתונים שנשלחו לא תקינים.",
      validationSummary: "יש לתקן את השדות המסומנים ולנסות שוב.",
      clientNameRequired: "יש להזין שם לקוח.",
      // Sprint 7B.1 (UX polish) — approved duplicate-name wording.
      clientNameTaken: "כבר קיים לקוח בשם זה (כולל לקוחות בארכיון).",
      clientNotFound: "הלקוח לא נמצא.",
      clientArchived: "הלקוח נמצא בארכיון ולא ניתן לערוך אותו.",
      clientAlreadyArchived: "הלקוח כבר נמצא בארכיון.",
      contactEmailInvalid: "כתובת האימייל של איש הקשר אינה תקינה.",
      brandNameRequired: "יש להזין שם מותג.",
      // Sprint 7B.1 (UX polish) — approved duplicate-name wording. The
      // archived-included rule still applies (enforced by the composite
      // unique constraint); the message is simply the approved shorter copy.
      brandNameTaken: "כבר קיים מותג בשם זה עבור לקוח זה.",
      brandNotFound: "המותג לא נמצא.",
      brandArchived: "המותג נמצא בארכיון ולא ניתן לערוך אותו.",
      brandAlreadyArchived: "המותג כבר נמצא בארכיון.",
      serverError: "משהו נכשל. נסה שוב.",
      networkError: "תקלת תקשורת — בדוק את החיבור ונסה שוב.",
    },
  },

  // Administration Sprint 2c — Audit Log module (/admin/audit-log,
  // Owner-only, read-only). All copy for the page, the narrative templates
  // consumed by lib/admin/audit-log-display.js, and the graceful fallbacks
  // for unknown/future ActionType/EntityType values.
  auditLog: {
    title: "יומן פעילות",
    description: "תיעוד פעולות במערכת. לקריאה בלבד, הרשאות בעלים בלבד.",
    dbNotConfiguredTitle: "מסד הנתונים עדיין לא מחובר",
    dbNotConfiguredDescription: "יומן הפעילות יתעורר לחיים לאחר חיבור מסד הנתונים.",
    emptyTitle: "אין עדיין רשומות ביומן",
    emptyDescription: "פעולות שיתועדו במערכת יופיעו כאן.",
    loadError: "טעינת יומן הפעילות נכשלה. נסה שוב.",
    retry: "נסה שוב",
    loadMore: "טען עוד",
    loadingMore: "טוען…",
    detailsToggleShow: "פרטים",
    detailsToggleHide: "הסתר פרטים",
    // Actor fallbacks — a null/system actor or one whose User row no longer
    // resolves is never guessed at (same rule as talent-history.js).
    systemActor: "המערכת",
    // Target-noun fallbacks used when no safe label resolved.
    targetNoun: {
      USER: "משתמש",
      TALENT: "מיוצג",
      SITE_CONTENT: "תוכן האתר",
      SEO: "הגדרות SEO",
      LEGAL_PAGE: "עמוד משפטי",
      COLLABORATIONS: "שיתופי פעולה",
      AGENCY_SOCIAL: "רשתות חברתיות של הסוכנות",
      IMAGE_ASSET: "תמונה",
      // Sprint 7B (Clients & Brands Foundation) — client/brand audit rows.
      // Nouns only: their narratives use the existing graceful fallback
      // template; dedicated narrative templates are a future sprint.
      CLIENT: "לקוח",
      BRAND: "מותג",
      unknown: "פריט במערכת",
    },
    // Narrative templates. {actor} / {target} are replaced by
    // audit-log-display.js. USER narratives follow the sprint's approved
    // style ("בר יצר עובד חדש"), with the resolved target name appended
    // when available.
    narrative: {
      user: {
        CREATED: "{actor} יצר עובד חדש: {target}",
        CREATED_NO_TARGET: "{actor} יצר עובד חדש",
        UPDATED_EMAIL: "{actor} עדכן את כתובת האימייל של {target}",
        UPDATED_DISPLAY_NAME: "{actor} עדכן את שם התצוגה של {target}",
        UPDATED: "{actor} עדכן את הפרטים של {target}",
        ACTIVATED: "{actor} הפעיל את {target}",
        DEACTIVATED: "{actor} השבית את {target}",
        PASSWORD_RESET: "{actor} איפס סיסמה עבור {target}",
        SESSION_REVOKED: "{actor} ביטל התחברות פעילה של {target}",
        SESSIONS_REVOKED: "{actor} ניתק את כל ההתחברויות הפעילות של {target}",
      },
      content: {
        CREATED: "{actor} יצר טיוטה עבור {target}",
        UPDATED: "{actor} עדכן טיוטה עבור {target}",
        PROPOSED: "{actor} הגיש הצעה לאישור עבור {target}",
        APPROVED: "{actor} אישר הצעה עבור {target}",
        REJECTED: "{actor} דחה הצעה עבור {target}",
        DELETED: "{actor} מחק טיוטה עבור {target}",
      },
      // Graceful fallback for any (entityType, actionType) combination with
      // no dedicated template — including future enum values this build
      // doesn't know about. The action badge still shows the raw value.
      fallback: "{actor} ביצע פעולה על {target}",
    },
    badge: {
      CREATED: "יצירה",
      UPDATED: "עדכון",
      PROPOSED: "הגשה",
      APPROVED: "אישור",
      REJECTED: "דחייה",
      DELETED: "מחיקה",
      RESTORED: "שחזור",
      ARCHIVED: "העברה לארכיון",
      LOGIN: "התחברות",
      LOGIN_FAILED: "התחברות שנכשלה",
      ACTIVATED: "הפעלה",
      DEACTIVATED: "השבתה",
      PASSWORD_RESET: "איפוס סיסמה",
      SESSION_REVOKED: "ביטול התחברות",
      SESSIONS_REVOKED: "ניתוק כל ההתחברויות",
    },
    details: {
      email: "אימייל",
      displayName: "שם תצוגה",
      role: "תפקיד",
      before: "לפני",
      after: "אחרי",
      emptyValue: "—",
      // Sprint 3b — revoke-all count (UserSessionsRevoked detail row).
      revokedCount: "מספר התחברויות שנותקו",
    },
    // Sprint 2c UI-polish — relative-time labels (audit-log-display.js's
    // formatRelativeTime). Entries older than "אתמול" show the exact date
    // instead; {count} is replaced with the number.
    time: {
      justNow: "ממש עכשיו",
      minuteAgo: "לפני דקה",
      minutesAgo: "לפני {count} דקות",
      hourAgo: "לפני שעה",
      twoHoursAgo: "לפני שעתיים",
      hoursAgo: "לפני {count} שעות",
      yesterday: "אתמול",
    },
  },
};

export default he;
