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
      // "Editable PROPOSED" sprint — same button, different label once the
      // version being edited is already PROPOSED rather than DRAFT (the
      // underlying action is still the same in-place field update; see
      // proposalService.update()'s widened status guard).
      updateProposal: "עדכן הצעה",
      submit: "שלח לאישור",
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
      moveUp: "הזז למעלה",
      moveDown: "הזז למטה",
      addImage: "+ הוסף תמונה",
    },
    removeHint: "ההסרה משפיעה על התצוגה המקדימה בלבד ואינה נשמרת.",
    moveHint: "ההזזה משפיעה על התצוגה המקדימה בלבד ואינה נשמרת.",
    replaceComingSoon: "החלפת תמונה עדיין לא זמינה כאן.",
    addImageComingSoon: "הוספת תמונה עדיין לא זמינה כאן.",
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
    notSet: "לא קיים",
    charCountSuffix: "תווים",
    intro:
      "הפרטים האלה לא מופיעים בעמוד עצמו — הם מה שגוגל ורשתות חברתיות מציגים כשהעמוד הזה מופיע בתוצאות חיפוש או משותף.",
    groups: {
      search: "תוצאות חיפוש (גוגל)",
      social: "שיתוף ברשתות חברתיות",
    },
    fields: {
      title: "כותרת SEO",
      titleHelper: "הכותרת שתוצג בכותרת תוצאת החיפוש בגוגל. מומלץ עד כ-60 תווים.",
      description: "תיאור SEO",
      descriptionHelper: "התקציר שיוצג מתחת לכותרת בתוצאת החיפוש בגוגל. מומלץ עד כ-160 תווים.",
      keywords: "מילות מפתח / תגיות",
      keywordsHelper: "מילים שמתארות את התוכן, מופרדות בפסיק. עוזרות לארגון הפנימי בלבד.",
      ogTitle: "כותרת לשיתוף (Open Graph)",
      ogTitleHelper: "הכותרת שתוצג כששולחים את הקישור לעמוד הזה בוואטסאפ, פייסבוק או אינסטגרם.",
      ogDescription: "תיאור לשיתוף (Open Graph)",
      ogDescriptionHelper: "התיאור שיוצג מתחת לכותרת כששולחים את הקישור לעמוד הזה ברשתות חברתיות.",
    },
    preview: {
      title: "תצוגה מקדימה של תוצאת חיפוש",
      subtitle: "הדמיה בלבד — כך זה עשוי להיראות בגוגל, בהתאם לכותרת ולתיאור המוצעים.",
      untitled: "(אין כותרת עדיין)",
      noDescription: "(אין תיאור עדיין)",
    },
    // Admin Talent Editor UX polish sprint — same honesty pattern Gallery
    // and Socials already established with their own <PreviewModeNotice>:
    // SEO has no save/submit path yet either (publishedSeo is still
    // hardcoded `null`s — see app/admin/talent/[id]/page.jsx's
    // buildSeoFields), so this tab should say so explicitly instead of
    // relying on the now-retired, silent <EditorHelperNote>.
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
      // lib/admin/talent-workspace.js's isListTalentDraft. "hidden" is a
      // deliberately separate, not-yet-real concept (an explicit Owner
      // visibility toggle) — see isListTalentHidden's doc comment for why
      // it always counts (0) today.
      filters: {
        groupLabel: "סינון לפי סטטוס",
        all: "הכל",
        published: "פורסמו",
        hidden: "מוסתרים",
        draft: "טיוטות",
      },
      // Add New Talent sprint — the PageHeader action button that links to
      // /admin/talent/new.
      addNew: "הוסף מיוצג חדש",
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
      pageTitle: "הוספת מיוצג חדש",
      pageDescription:
        "בשלב הזה ניצור כרטיס מיוצג ראשוני. לאחר מכן תועברו לעמוד המיוצג להשלמת פרטים, תמונות, רשתות חברתיות ו־SEO לפני שליחה לאישור.",
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
      },
      submit: "צור מיוצג",
      submitting: "יוצר…",
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
      visibilityStatus: "סטטוס נראות",
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
          comingSoonHint: "החלפת התמונה, החיתוך והזום עדיין לא זמינים כאן.",
          controls: {
            replace: "החלפת תמונה",
            crop: "חיתוך / מיקום",
            zoom: "זום / קנה מידה",
          },
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
        comingSoonHint: "החלפת תמונת הפודקאסט עדיין לא זמינה כאן.",
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
    },
  },
};

export default he;
