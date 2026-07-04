# Admin Talent Detail — Consistency Audit

Research only. No code, schema, or content was changed. Based on a read-through of `app/admin/talent/[id]/page.jsx`, `TalentWorkspaceTabs.jsx`, `lib/admin/talent-workspace.js`, `lib/admin/i18n/he.js`, and the relevant `components/admin/*` (ComparisonView, MediaGalleryEditor, SocialLinksEditor, SeoEditor, PodcastTab, ProfileImagePanel, EditorActionBar, Timeline, StatusBadge, EmptyState, PageHeader) and their CSS modules.

## Must fix

**"Sprint" jargon is shown directly to admin users, across almost every tab.**
`lib/admin/i18n/he.js` has several user-facing strings that literally say "בספרינט עתידי" ("in a future sprint"): `editor.comingSoon`, `gallery.replaceComingSoon`, `gallery.addImageComingSoon`, `gallery.previewModeNotice.body`, `social.comingSoon`, `profile.image.comingSoonHint`, `podcastTab.comingSoonHint`, `sectionPlaceholder.description`. An agency employee has no reason to know what a "sprint" is — this reads as internal dev-team language leaking into the product. Appears on Profile Image, Gallery, Socials, Podcast, and the placeholder tab message.

**The disabled Save/Submit tooltip is now factually wrong on Details and Podcast.** `EditorActionBar`'s disabled Save Draft button shows `title={he.editor.comingSoon}` ("this will connect in a future sprint") whenever it's disabled — but on Details and Podcast, Save Draft and Submit are *already wired up and working* (per the "Enable Podcast Save" / "Editable PROPOSED" sprints). The button is far more often disabled simply because nothing is dirty yet, not because the feature doesn't exist. The tooltip actively misleads the one place it would matter most.

**Gallery, Socials, and SEO show fully-dressed, real-looking Save Draft / Submit buttons that never do anything.** `EditorActionBar` (with its real-looking primary/secondary buttons and disabled-state styling identical to Details/Podcast) is rendered at the bottom of `MediaGalleryEditor`, `SocialLinksEditor`, and `SeoEditor` with no `onSaveDraft`/`onSubmit` at all — they're permanently inert. Visually these buttons are indistinguishable from the real, working ones on Details/Podcast. A user has no way to tell, just by looking, which "Save Draft" button actually saves something.

**A "changes requested" status has no visible reason anywhere on the page.** `deriveDetailWorkflowStatus` correctly detects a REJECTED version and shows a "נדרשו תיקונים" badge, and `he.talent.detail.rejectionNote` ("הערת תיקון מהבעלים") exists as a label — but nothing on the page actually renders `version.rejectionNote`. An employee can see they've been asked for changes with no way to see what the owner actually wrote. (The History tab does show the rejection note as that row's summary, so the information isn't entirely lost — but it's buried in a timeline entry rather than surfaced where it's actionable, next to the Details/Podcast editor.)

## Nice to fix

**SEO is missing the honest "preview only" disclosure that Gallery and Socials got.** Per their own UX-polish sprints, Gallery and Socials each replaced the generic `EditorHelperNote` with a tab-specific `PreviewModeNotice` explaining that nothing here is saved. `SeoEditor.jsx` still renders the old `<EditorHelperNote />`, which is now a permanent no-op (it was retired to return `null` everywhere) — so the SEO tab is the only one of the three fully-local tabs that gives the user *zero* indication their edits aren't going anywhere.

**Inconsistent "nothing set" copy between tabs.** Details/Podcast (`ComparisonView.formatReadOnlyValue`) show empty fields as "—". Socials and SEO show empty fields as the word "לא קיים" ("doesn't exist"). Same concept, two different visual/verbal treatments depending on which tab you're in.

**"Published vs proposed" framing sentences don't quite match across tabs.** Details/Podcast (hardcoded in `ComparisonView.jsx`): "כך הביקורים רואים את זה באתר כרגע" ("this is how visitors see this on the site now"). Gallery: "כך הגלריה הזו מוצגת באתר כרגע." Socials: "כך הרשתות החברתיות מוצגות באתר כרגע." SEO: "כך הפרטים האלה מוצגים באתר כרגע." All four say the same thing with a different verb/subject pattern — close enough to feel intentional, different enough to notice when flipping between tabs.

**Gallery's "proposed" eyebrow label breaks the pattern the other three use.** Socials and SEO both call the editable column "עדכון מוצע" ("proposed update"). Gallery alone calls it "תצוגה מקדימה של עדכון" ("preview of an update") — a third phrase for the same UI role.

**Top-level vertical spacing isn't consistent between the four editor tabs.** `MediaGalleryEditor.module.css` and `SocialLinksEditor.module.css` give their outer wrapper `gap: 3rem`; `SeoEditor.module.css`'s outer wrapper uses `gap: 2rem`; `ComparisonView.module.css`'s outer `.tokens` class sets no gap at all (it relies on each child's own margin). Switching between Details/Podcast and Gallery/Socials/SEO, the rhythm between sections visibly changes.

**Minor wording mismatch on the same action.** Profile Image's disabled control says "החלפת תמונה" ("image replacement"); Podcast's equivalent disabled control says "החלף תמונה" ("replace image") — same action, two grammatical forms.

## Future / lower priority

**Dead/unused copy in `he.js`.** `talent.detail.visibilityStatus`, `talent.detail.notFoundDescription`, and `talent.fields.empty` are defined but not referenced anywhere in the current page or its components — either leftover from a prior layout or written ahead of a feature that hasn't landed. Not visible to users today, but worth pruning or wiring up so the file doesn't accumulate stale entries.

**`EditorHelperNote` is imported by `ComparisonView.jsx` and `SeoEditor.jsx` purely as a no-op.** It was intentionally retired to return `null` rather than removing its ~3 call sites. Harmless today, but it's a small trap for a future reader who doesn't know to check the component before assuming it renders something.

**RTL handling looks correct where it was deliberately addressed** (e.g. `SocialLinkRow.jsx` forcing `dir="ltr"` on handles/URLs so usernames like `@almavay` don't visually reorder, `SearchResultPreview.module.css` forcing `direction: ltr` for the URL line) — no issues found there. Worth re-checking once gallery upload / podcast video URL fields become live-edited, since long English URLs/strings are exactly where RTL bugs tend to surface.

**Button strength reads correctly for what's real vs. not** — `PrimaryButton` is reserved for the one genuinely consequential action (Submit, "View on YouTube"), `SecondaryButton` for Cancel/Save Draft. The visual hierarchy itself isn't the problem; the issue is that on Gallery/Socials/SEO that same hierarchy is applied to buttons that don't do anything (see "Must fix" above).

## Recommended smallest next sprint

1. Sweep `lib/admin/i18n/he.js` for every "בספרינט עתידי" string and replace with calm, non-internal phrasing (e.g. "עוד לא זמין" / "יתאפשר בקרוב") — touches Profile Image, Gallery, Socials, Podcast, and the placeholder tab. Copy-only, no logic change.
2. Fix `EditorActionBar`'s disabled-button tooltip so it no longer claims "future sprint" when the real reason is just "nothing changed yet" on Details/Podcast.
3. Either hide the Save Draft/Submit buttons entirely on Gallery/Socials/SEO (where they're permanently inert) or replace them with a single disabled hint inside each tab's existing `PreviewModeNotice`, so a real button only ever appears where it's real.
4. Surface `rejectionNote` directly above the Details/Podcast editor when the talent's current status is "changes requested," instead of leaving it only in the History tab.
5. Give SEO the same `PreviewModeNotice` treatment Gallery/Socials already have, swapping out the dead `EditorHelperNote` import.

Items 1–4 are small, copy/markup-only changes with no schema or persistence impact; together they're a reasonable one-sprint scope. Item 5 can ride along in the same sprint since it reuses an existing pattern.
