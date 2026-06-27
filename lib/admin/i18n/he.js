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
    comingSoon: "האפשרות הזו תתחבר בספרינט עתידי.",
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
    proposedEyebrowTitle: "עדכון מוצע",
    proposedSubtitle: "זו הגלריה שאתה מציע. שום דבר לא יתפרסם באתר לפני אישור.",
    noPublishedImagesTitle: "אין עדיין גלריה מפורסמת",
    noPublishedImagesDescription: "כשתתפרסם גלריה, התמונות שלה יוצגו כאן.",
    noProposedImagesTitle: "אין תמונות בעדכון המוצע",
    noProposedImagesDescription: "הוסף תמונה כדי להתחיל לבנות את הגלריה המוצעת.",
    imageAlt: (label, index) => `${label} — תמונה ${index + 1}`,
    actions: {
      replace: "החלף",
      remove: "הסר",
      moveUp: "הזז למעלה",
      moveDown: "הזז למטה",
      addImage: "+ הוסף תמונה",
    },
    replaceComingSoon: "החלפת תמונה תתחבר בספרינט עתידי (העלאת קבצים).",
    addImageComingSoon: "הוספת תמונה תתחבר בספרינט עתידי (העלאת קבצים).",
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
    proposedSubtitle: "אלו הרשתות שאתה מציע. שום דבר לא יתפרסם באתר לפני אישור.",
    notSet: "לא קיים",
    inputPlaceholder: (label) => `הוסף קישור או שם משתמש ל${label}`,
    comingSoon: "האפשרות הזו תתחבר בספרינט עתידי.",
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
          sectionDescription: "זו תמונת הפרופיל הראשית של המיוצג, כפי שהיא מוצגת באתר הציבורי.",
          previewLabel: "תצוגה מקדימה",
          comingSoonHint: "בקרות העריכה יתחברו בספרינט עתידי — המבנה כבר מוכן לקבל אותן.",
          controls: {
            replace: "החלפת תמונה",
            crop: "חיתוך / מיקום",
            zoom: "זום / קנה מידה",
          },
        },
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
