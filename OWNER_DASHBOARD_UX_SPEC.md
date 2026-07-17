# Owner Dashboard — Product & UX Specification

Status: **Proposed specification for the Owner Dashboard.** Specification only — no code changes accompany this document. Companion to `DRAFT_PUBLISH_UX_SPEC.md`; all state names (Pending Review, Draft, Rejected) refer to the lifecycle defined there.

Scope note: this document specifies the **Owner Dashboard only**. The Employee Dashboard is a different product with different goals and is explicitly out of scope. No section, component, or copy defined here may be reused for the Employee Dashboard without its own specification.

---

## 0. Purpose and Design Philosophy

The dashboard answers exactly one question: **"What should I deal with right now?"**

It is not an analytics screen, not a reporting screen, and not a workspace. It is a **triage screen** — the first thing the Owner sees after login, whose only job is to convert "I just logged in" into "I know what needs my attention, in what order, and where to go to handle it."

Three consequences follow, and every later section is derived from them:

1. **Every section is a queue, not a statistic.** A section exists because items in it are *waiting on the Owner* (or waiting on someone the Owner supervises). If nothing is waiting, the section says so plainly and takes up minimal space. We never pad a quiet dashboard with decoration.
2. **The dashboard is where decisions begin, not where work happens.** No inline editing, no inline approving, no modals that replicate other screens. Every item and every CTA is a doorway into the screen where the real action lives (Approvals, Drafts, Rejected Items, Activity). The dashboard's success metric is how fast the Owner *leaves* it in the right direction.
3. **Empty is a valid, calm, successful state.** "Nothing needs you" is good news and must look like good news — not like a broken or unfinished page.

Anti-goals, stated up front: no charts, no KPIs, no trends, no counters that exist to look impressive, no "insights." If a piece of information does not change what the Owner does in the next five minutes, it does not belong on this screen.

---

## 1. Page Hierarchy

The page is a single vertical column (RTL, Hebrew) with five zones, in fixed order:

```
┌──────────────────────────────────────────────┐
│ 1. Greeting + attention summary              │  ← orientation
├──────────────────────────────────────────────┤
│ 2. Pending Approvals            (dominant)   │  ← decisions only the Owner can make
├──────────────────────────────────────────────┤
│ 3. Rejected Items                            │  ← work stuck, waiting on corrections
├──────────────────────────────────────────────┤
│ 4. Employee Drafts                           │  ← work in progress, supervision
├──────────────────────────────────────────────┤
│ 5. Recent Activity                           │  ← ambient awareness, lowest priority
└──────────────────────────────────────────────┘
```

Ordering rationale — the column is sorted by **"how directly does this block someone":**

- **Pending Approvals** blocks employees *and* the site content — only the Owner can unblock. It comes first and is the largest.
- **Rejected Items** is deliberately placed **above** Employee Drafts (a change from the original section order). Rationale: a rejected item is work that already consumed effort and is now stalled; drafts are healthy work-in-progress. Stalled beats healthy in a triage view. If the team decides rejection follow-up is the employee's own responsibility, this section may drop below Drafts — but the principle (stalled work outranks in-progress work) should be decided once and kept stable.
- **Employee Drafts** is supervisory awareness — nothing is blocked, so it sits below the two blocking sections.
- **Recent Activity** is context, not a queue. Always last, always the most visually quiet.

Fixed order, always. Sections never reorder themselves based on counts. The Owner should build muscle memory: "approvals are always at the top, activity is always at the bottom." A dashboard that rearranges itself daily forces re-scanning every login and destroys the triage habit.

Each section shows **at most 5 items** (Recent Activity: at most 7 events). Beyond that, the section CTA ("View all…") carries the overflow. The dashboard is a summary of queues, never the full queue.

---

## 2. Visual Hierarchy

Three visual tiers, top to bottom:

**Tier 1 — Greeting.** Large, warm, one heading plus one sentence. It is the only element on the page allowed personality (the 👋). It must never look like a widget or a card — it is text on the page background, anchoring the page as "yours."

**Tier 2 — Actionable queues (Approvals, Rejected, Drafts).** Card-based sections with a clear section title, an item count where meaningful, list rows, and one CTA. Pending Approvals gets the strongest treatment: largest card, most breathing room, and the only section permitted an accent border or subtle accent background. Rejected Items uses a restrained warning tint on its status element only (never a whole red card — red panels read as system errors, not as a to-do). Employee Drafts is neutral.

**Tier 3 — Recent Activity.** Visually lightest: no card chrome or a very light one, smaller type, muted color, simple timeline. It should feel like a footer you *can* read, not content demanding to be read.

Rules that keep the hierarchy honest:

- **One accent color, one owner.** Only Pending Approvals may use the primary accent. If everything is highlighted, nothing is.
- **Counts are text, not badges-as-decoration.** A count appears next to a section title ("ממתינים לאישור · 3") in the same type family — no oversized colored circles competing for attention.
- **Row density over card sprawl.** Items inside a section are compact rows (single line each on desktop), not individual cards. The section is the card; items are rows.
- **Whitespace signals rank.** More padding around Approvals, progressively tighter downward. The eye should land on Approvals within one second of page load.

---

## 3. Section Priority

Priority order and the reasoning, stated as a table for implementers and future designers:

| Priority | Section | Why it ranks here | What the Owner decides |
|---|---|---|---|
| 1 | Greeting + summary | Orientation: "do I need to be here?" | Whether to engage at all |
| 2 | Pending Approvals | Only the Owner can act; blocks publishing | Approve/reject — go decide |
| 3 | Rejected Items | Work is stalled; risk of being forgotten | Follow up, or nudge the employee |
| 4 | Employee Drafts | Supervisory: is work progressing? | Whether to check in on someone |
| 5 | Recent Activity | Ambient awareness only | Nothing — read or skip |

The greeting's item count in "יש כרגע 3 פריטים שממתינים להתייחסותך" counts **Pending Approvals only**. It must not sum approvals + rejected + drafts into one number: a blended number is unanswerable ("3 of what?") and inflates urgency. The sentence is a promise about the Approvals section specifically; the other sections speak for themselves.

Within each section, item ordering:

- **Pending Approvals: oldest first.** The item waiting longest is the one most at risk of embarrassing the agency. Newest-first hides the aging item at the bottom forever.
- **Rejected Items: oldest first**, same logic — the longest-stalled correction is the biggest risk.
- **Employee Drafts: most recently updated group first** — recency is what a supervisor scans for ("who touched what, lately?").
- **Recent Activity: newest first**, as any timeline.

---

## 4. Empty States

Empty states are designed, not defaulted. Two levels:

### 4.1 Global empty (nothing anywhere needs attention)

When Approvals = 0, Rejected = 0, and Drafts = 0, the page collapses to:

- Greeting: **שלום בר 👋**
- Summary: **אין כרגע פריטים שממתינים להתייחסותך.**
- The three queue sections render as a single-line quiet version each (see 4.2) — they do **not** disappear entirely, so the page keeps its stable shape and the Owner still gets confirmation that each queue was checked, not skipped.
- Recent Activity still renders normally (the agency being quiet for the Owner ≠ the agency being idle).

Tone: calm and affirmative. No illustration of an empty inbox, no confetti, no "כל הכבוד!". The absence of demands *is* the reward.

### 4.2 Per-section empty

Each section keeps its title and shrinks to one quiet line. The line is informative, not apologetic:

- Pending Approvals: **אין פריטים שממתינים לאישור.**
- Rejected Items: **אין פריטים שממתינים לתיקון.**
- Employee Drafts: **אין טיוטות פתוחות כרגע.**
- Recent Activity: **עדיין אין פעילות להצגה.** (realistically only pre-launch / new system)

Per-section CTAs are hidden when the section is empty — "View all approvals" pointing at an empty list is a dead end. Exception: Recent Activity's CTA may remain if history exists beyond the window shown.

Never render an empty table header, an empty card with a lonely CTA, or a zero-count badge ("0 ממתינים" is noise; the quiet line already says it).

---

## 5. Loading States

Principles: **no spinners, no layout shift, no blank flash.**

- **Skeleton rows, exact geometry.** Each section renders immediately with its title and 2–3 skeleton rows shaped like real rows (avatar dot + two text bars). The page skeleton must match the loaded page's layout so nothing jumps when data arrives.
- **The greeting loads first and never skeletons its text.** "שלום בר" is known from the session — render it instantly. Only the summary sentence's count waits for data; while waiting, show the sentence area as a single short skeleton bar, never "יש כרגע … פריטים" with a spinner inside a sentence.
- **Sections resolve independently.** If approvals return before activity, approvals render; a slow query in one section must not hold the whole page hostage.
- **Failure state per section, not per page.** If one section's data fails: keep the section title, show one line — **לא הצלחנו לטעון את הנתונים. נסו לרענן.** — with an inline "רענון" action for that section only. Never replace the whole dashboard with an error page because one queue failed; the other queues are still decisions waiting to happen.
- **Perceived-speed budget.** Target: greeting instant, queues < 1s. If a queue reliably takes longer, fix the query, not the skeleton.

---

## 6. What Must Never Appear on This Dashboard

This list is normative. Any future request to add one of these gets a "no" by default and requires revisiting this document:

1. **Charts, graphs, sparklines** — any visualization of change over time.
2. **KPIs / vanity metrics** — total talents, total gallery items, "items published this month," visitor counts.
3. **Trends and comparisons** — "↑ 12% from last week."
4. **Raw technical events** — `PROPOSAL_CREATED`, entity IDs, enum values, JSON. The audit log exists elsewhere; the dashboard speaks Hebrew, not schema.
5. **Inline editing or inline approval.** Approving from the dashboard without seeing the full proposal invites blind approvals. The dashboard routes; the Approvals screen decides. (See §9 for the single deliberate exception considered and rejected.)
6. **Employee-facing content** — the Owner Dashboard never shows "your drafts" as if the Owner is an employee, and never borrows Employee Dashboard modules.
7. **Notifications/announcements from the system itself** — release notes, feature tips, upgrade banners. Nothing competes with the queues.
8. **Anything requiring scrolling to discover whether action is needed.** All section titles and counts must be reachable within the first screenful on a laptop; long lists truncate at 5 with a CTA.
9. **Duplicated items across sections.** An item lives in exactly one queue (its lifecycle state determines which). The same gallery must never appear in both Approvals and Activity's *actionable* framing — it may appear in Activity as a past event, since Activity is narrative, not a queue.
10. **Configuration/settings widgets** — user management shortcuts, permission toggles. Those are destinations, reachable from navigation, not dashboard content.

---

## 7. Micro-copy Recommendations

Language: Hebrew, second person, warm but economical. The dashboard never scolds and never celebrates excessively. All copy below is recommended final copy.

**Greeting:**

- With items: **שלום בר 👋** / **יש כרגע 3 פריטים שממתינים לאישורך.** ("לאישורך" is preferred over "להתייחסותך" when the count refers to approvals specifically — it tells the Owner *what kind* of attention.)
- Singular: **יש כרגע פריט אחד שממתין לאישורך.** (proper singular, never "1 פריטים").
- Empty: **אין כרגע פריטים שממתינים להתייחסותך.**
- Time-of-day variants (בוקר טוב / ערב טוב) are optional flavor for v2; "שלום" is always correct and never wrong late at night.

**Section titles** — noun phrases, no verbs, no exclamation:

- **ממתינים לאישור** (Pending Approvals)
- **הוחזרו לתיקון** (Rejected Items — "הוחזרו לתיקון" frames rejection as a returned task, softer and more accurate than "נדחו")
- **טיוטות של העובדים** (Employee Drafts)
- **פעילות אחרונה** (Recent Activity)

**Row copy — Approvals:** one line per item: `{סוג עבודה} של {טאלנט} · הוגש על ידי {עובד} · {זמן יחסי}` → e.g. **גלריה של קים · הוגשה על ידי נועה · לפני שעתיים.** Relative time up to 48h ("לפני שעתיים", "אתמול"), absolute date beyond ("2 ביולי"). An item waiting more than 3 days gets a quiet textual flag: **ממתין 5 ימים** — text emphasis only, no alarm colors.

**Row copy — Rejected:** **גלריה של קים · נדחתה על ידי בר · לפני יום.** If the Owner is the rejecter, still name them ("על ידיך") — the dashboard reports facts.

**Row copy — Drafts (grouped by employee):** **נועה · 3 טיוטות · עדכון אחרון לפני שעה.**

**Activity copy:** subject-verb-object, human names, no IDs: **נועה הגישה גלריה של קים** / **בר אישר את הביוגרפיה של דנה** / **נועה עדכנה טיוטה של קישורים חברתיים עבור קים.** Every event template must be written by a human; never string-concatenate enum names into Hebrew.

**CTAs** — verb-first, specific, one per section:

- **לכל האישורים** (View all approvals)
- **לפריטים שממתינים לתיקון** (Open rejected items)
- **לכל הטיוטות** (View employee drafts)
- **לפעילות המלאה** (View full activity)

Never "ראה עוד", never "לחץ כאן".

---

## 8. Navigation Recommendations

- **The dashboard is the Owner's post-login landing page.** Always. No "remember last visited page" — the whole design premise is that login begins with triage.
- **Every row is a link, and the whole row is the hit area.** An approval row opens that item's review screen directly (deep link), not the approvals list. The section CTA opens the *list*. Rule: **rows deep-link to the item, CTAs go to the queue.** Drafts rows are the exception: a row for "נועה · 3 טיוטות" opens the drafts list *filtered to נועה*, since the row represents a group.
- **Navigation is one-way by design; "back" must be cheap.** Screens the dashboard links to should offer an obvious return path (breadcrumb or back affordance) so the Owner's rhythm becomes: dashboard → handle item → back → next item.
- **"דשבורד" / home is always visible in primary navigation** and marked active while on the page.
- **No dashboard-internal anchor nav or tabs.** Five sections in a known order don't need a table of contents; adding one would imply the page is long, which it must never be.
- **Post-action return:** after the Owner approves or rejects an item they reached from the dashboard, the ideal return destination is the dashboard (refreshed), reinforcing the triage loop. If the Approvals screen has its own next-item flow, that flow wins while inside it — the dashboard doesn't fight the queue screen.

---

## 9. Interaction Recommendations

- **Read-and-route only.** The interactive vocabulary of the entire page is: click a row, click a CTA, click a failed section's refresh. Nothing else. No drag, no inline expand-and-edit, no context menus.
- **No quick-approve on the dashboard.** Considered and rejected: an "אשר" button on approval rows. It optimizes for speed at the cost of blind approvals of content the Owner hasn't seen. The approval decision belongs on the screen that shows the actual proposed content (per the Published/Proposed comparison in `DRAFT_PUBLISH_UX_SPEC.md`). This is a product decision, not a technical limitation.
- **Hover states communicate "this is a doorway":** row hover elevates/tints subtly and shows a chevron (pointing left, RTL). The affordance says "go", not "select".
- **Optional row preview, strictly read-only (v1.5 candidate):** hover tooltip or focus popover showing a thumbnail for gallery items. Must never grow buttons. If in doubt, ship without it.
- **Counts update on load and on return-navigation.** Live push updates are unnecessary in v1; a dashboard that visibly changes while being read is unsettling. Refreshing on focus/return is enough. If an item was handled elsewhere and the Owner clicks its now-stale row, the destination screen states plainly: **הפריט כבר טופל.**
- **Recent Activity rows may be non-clickable in v1** if event→screen mapping is ambiguous; a timeline that routes badly is worse than one that doesn't route. The section CTA always works.
- **No confirmation dialogs anywhere on the dashboard** — nothing on it is destructive.

---

## 10. Mobile Behaviour

The Owner checks the dashboard from a phone constantly (agency owners live on WhatsApp and Instagram); mobile is a first-class layout, not a squeezed desktop.

- **Same order, same sections, single column.** No section is hidden on mobile — triage matters *more* on the go.
- **Rows become two lines:** line 1 — work type + talent (**גלריה של קים**); line 2 — muted metadata (**הוגשה על ידי נועה · לפני שעתיים**). Never truncate the talent name to keep one line.
- **Touch targets:** full-width rows, minimum 44px height, generous spacing between CTAs and rows to prevent mis-taps.
- **Greeting compresses:** smaller heading, summary sentence stays complete — it is the most important sentence on the page and is never truncated.
- **Recent Activity collapses to 3 events on mobile** behind the same CTA. It is the section most safely shortened.
- **No horizontal scrolling, no tables.** Row layouts must reflow, not scroll sideways.
- **Sticky elements: none.** The page is short by design; sticky headers/CTAs steal vertical space on phones for no benefit.
- **Pull-to-refresh** (if the shell supports it) is the natural mobile refresh gesture and maps cleanly to the "refresh on return" model.

---

## 11. Accessibility Considerations

- **RTL correctness end-to-end:** the page is Hebrew RTL; direction, chevron orientation (pointing left = "forward"), and timeline alignment all follow RTL. Mixed-direction strings (Hebrew sentence containing a Latin talent/brand name) must be tested for bidi rendering, especially with counts and times adjacent to Latin text.
- **Semantic structure:** one h1 (the greeting), each section an h2 within a labeled landmark/region, lists as lists. A screen-reader user should navigate section-by-section exactly as a sighted user scans.
- **The summary sentence is the accessible summary of the page.** Announce it right after the h1 so "יש כרגע 3 פריטים שממתינים לאישורך" is the second thing heard — the screen-reader experience mirrors the visual triage.
- **Rows are single links with a complete accessible name** ("גלריה של קים, הוגשה על ידי נועה, לפני שעתיים — פתיחה לאישור"), not three separately-focusable fragments.
- **Color is never the only signal.** Rejected status carries a text label, not just a red tint. Aging approvals carry the "ממתין 5 ימים" text, not only a color change.
- **Contrast:** muted Tier-3 (Activity) text still meets WCAG AA (4.5:1). "Visually quiet" is achieved with size and weight before lightness.
- **Keyboard:** everything reachable in DOM/visual order, visible focus ring, no focus traps. A "skip to pending approvals" link is a cheap, high-value addition.
- **Loading announcements:** when sections resolve, updates are polite (aria-live="polite") — never assertive interruptions for routine loads.
- **Motion:** skeleton shimmer and hover transitions respect reduced-motion preferences.

---

## 12. Future Expansion Points (v2)

Listed with the constraint that any addition must still answer "what should I deal with right now?" — anything that answers "what happened this month?" is rejected regardless of how nice it looks.

1. **Aging escalation.** Items waiting beyond a threshold (e.g., 5 days) get a distinct "מחכה כבר X ימים" treatment and float within their section. Same-queue behavior, sharper prioritization.
2. **Snooze / acknowledge on Rejected Items.** Let the Owner mark "אני מודע, בטיפול של נועה" to quiet an item they've already followed up on — the first legitimate write action the dashboard could earn, because its object is the *dashboard's own noise*, not content.
3. **Per-employee drill-in from Drafts** with slightly richer supervision context (drafts stagnant > N days), still no metrics.
4. **Time-of-day greeting** and lightweight personalization (בוקר טוב / ערב טוב).
5. **Digest parity.** A daily email/WhatsApp digest that is literally the greeting sentence + top approvals — the dashboard's summary escaping the app. High value for an owner who doesn't log in daily.
6. **Activity filtering** (by employee, by talent) on the *full* activity screen — not on the dashboard.
7. **New queue types as the product grows** (e.g., expiring contracts, unanswered inquiries) join as new Tier-2 sections under the same rules: it's a queue, it's actionable, it routes elsewhere, it has an empty state. The five-zone structure scales by adding queues, never by adding widgets.
8. **Considered and deliberately excluded even for v2:** charts, publish counts, "busiest employee," streaks, and any gamification. These convert a triage tool into a surveillance-and-vanity tool and are outside this product's identity.

---

*End of specification. Any conflict between this document and future implementation should be resolved by returning to §0: does the element help the Owner decide what to deal with right now? If not, it doesn't ship.*
