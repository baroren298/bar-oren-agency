# Draft / Publish UX Specification — Official Standard

Status: **Adopted as the official long-term Draft/Publish UX standard for the admin panel.** Applies to all current talent admin modules (Basic Details/Bio, Profile Image, Social Links, Gallery Metadata, Podcast) and is the required reference for every future CMS module (SEO, documents, campaigns, homepage content, legal pages, and beyond). Specification only — no code changes accompany this document.

---

## 0. Core Design Principle: Published vs Proposed

This is the foundational philosophy of the entire system and should be treated as a design principle, not an implementation detail — every other section in this document exists in service of it.

Unlike a traditional CMS where a user edits "the content" directly, every editable module in this system maintains two distinct things at once:

- **Current Published** — what is live right now, what visitors actually see.
- **Proposed Version** — the draft the editor is working on, which has no public effect until it is published.

The user should never be confused about which of these they're looking at, and should always be able to answer three questions at a glance, without needing to click anything:

1. **What is currently live?** — the Current Published block, always rendered read-only, always labeled, always available to view regardless of what state the draft is in.
2. **What is only proposed?** — the Proposed Version block, visually distinct (highlighted/accented) from the Current Published block, editable, and clearly not yet in effect.
3. **What will become live after Publish?** — exactly the contents of the Proposed Version, nothing more, nothing less. Publish should never be a mysterious or partial operation; the side-by-side view is itself the preview of "what happens if I publish."

**Why this matters as a principle, not just a layout choice:** it removes an entire class of user anxiety common in traditional CMSs ("did I just change the live page?"). Because Current Published and Proposed are always visually separated, editing always feels safe — nothing goes live until a deliberate Publish action, and the user can see exactly what that action will do before doing it.

**Application to future modules:** any future module — documents, campaigns, homepage content, legal pages — must preserve this same two-pane (or equivalent) mental model: a read-only "what's live" reference and a distinct, clearly-labeled "what's proposed" working copy, shown together wherever the content is complex enough to benefit from comparison (text, structured fields, ordering), and at minimum as a labeled state distinction even where a full side-by-side isn't practical (e.g. a single image swap can show a small "currently live" thumbnail next to the new upload rather than a full comparison layout). The principle — live and proposed are always distinguishable, never merged — is non-negotiable; the exact visual treatment can scale to the module's complexity.

---

## 1. The Lifecycle States (Primary State Model)

Pending Review is a first-class state in this model, not a secondary annotation. The complete lifecycle is:

```
Published
   ↓ (user edits a field)
Editing (Unsaved)
   ↓ (Save Draft)
Draft
   ↓ (Employee: Submit)              ↓ (Owner: Publish Now)
Pending Review                       Publishing
   ↓ (Owner: Approve & Publish)         ↓
Publishing                           Published
   ↓                                    
Published                            
   ↓ (Owner: Reject, at Pending Review)
Rejected
   ↓ (Continue Editing)
Draft → ... (re-enters the cycle)
```

Two paths reach Publishing: an Owner can go directly from Draft to Publishing via Publish Now, or an Employee's Draft must pass through Pending Review and an Owner's approval first. Both paths converge on the same Publishing → Published behavior described in Section 6.

Every module, regardless of data shape or role, is at all times in exactly one of these states: **Published, Editing (Unsaved), Draft, Pending Review, Publishing, Published (again), or Rejected.** The status chip (Section 11) always reflects exactly one of these seven labels — never a blend, never an absence.

---

## 2. State-by-State User Journey

### 2.1 Published (clean)

**What the user sees:** the live content, rendered as it appears publicly, with no edit-mode chrome. Per Section 0, this remains visible as the "Current Published" reference even once editing begins — it doesn't disappear at this stage, it's simply the only block present since there's no Proposed Version yet.

**Status:** chip reads "Published" (visual treatment in Sprint B; for now, distinguishable as its own labeled state).

**Buttons:** only Edit is visible. Save Draft, Submit, Publish, Cancel Editing, Continue Editing are hidden, not disabled.

**Actions available:** Edit only.

### 2.2 Editing (Unsaved)

The moment any field changes from its last-saved value:

- Status changes to "Unsaved changes."
- A **persistent inline notice appears in the action bar** — not a hover tooltip — explaining that changes are unsaved and Save Draft is needed before Submit/Publish becomes available.
- Publish (and Submit) become disabled, explained by that same persistent notice rather than a `title`-attribute tooltip.
- The Current Published block (Section 0) remains visible and untouched; only the Proposed Version block reflects the in-progress edits.

**Placement rationale (behavioral, not visual):** the notice belongs in the action bar because that's where the user looks to take the next step — co-locating the blocking reason with the blocked action. This is a behavioral requirement (Sprint A): the notice must be persistent and located in a fixed, predictable slot. Its color, icon, and animation are Sprint B concerns.

### 2.3 Draft (saved, clean)

- Status changes to "Draft."
- Current Published remains visible per Section 0. Proposed Version is now a real, persisted draft and should be visually distinguished from the Current Published reference as the "working" version.
- Buttons: Edit is replaced by Continue Editing + Cancel Editing (destructive, confirm before discarding). Submit (Employee) and/or Publish Now (Owner) become enabled, since the draft is internally clean (no edits since last save).
- The unsaved-changes notice is replaced by a brief, non-blocking confirmation that the draft was saved, then clears — there's nothing left to act on.

### 2.4 Pending Review (Employee path only)

- Reached when a non-owner clicks Submit on a clean Draft.
- Status changes to "Pending Review" — a distinct, persistent state, not a transient sub-state of Draft.
- The Proposed Version remains visible and read-only at this point — editing further should pull the module back out of Pending Review into Draft (re-editing implicitly withdraws the pending submission; resubmission is required). This is the simplest, least-surprising behavior and avoids needing a "stacked versions" concept.
- Buttons for the Employee: Continue Editing (which withdraws the pending state per above) remains available. Submit/Publish are hidden — there's nothing further to submit while already pending.
- Buttons for the Owner, viewing someone else's Pending submission: Approve & Publish and Reject appear, in addition to the standard read view of both Current Published and Proposed.
- This state must persist clearly until an Owner acts — it is not acceptable for "Pending Review" to be visually indistinguishable from "Draft," since they imply different next actions for different roles.

### 2.5 Publish Available

Publish (or Approve & Publish) becomes enabled exactly when the relevant version is in a clean Draft (Owner, direct path) or a Pending Review awaiting Owner action. At this point the user should understand: clicking Publish makes the Proposed Version (visible right now in the comparison view, per Section 0) the new Current Published, immediately, with no further confirmation step beyond the click itself (unless a module-specific reason requires a confirm dialog — not the default).

### 2.6 Publish Clicked (Sprint A — Lighter-Weight Interaction)

Revised per product decision: publishing should feel light, not heavy.

- **All action buttons disable immediately** on click (Save Draft, Submit, Publish, Cancel Editing, Continue Editing) — this is the key requirement, and is sufficient on its own to prevent duplicate actions and conflicting in-flight requests.
- **The form fields do NOT freeze/lock.** The editor remains visually and interactively normal during the publish request unless a specific module has a concrete technical reason to lock fields (e.g. a field whose value the publish payload has already captured and where further edits could desync the in-flight request) — such exceptions must be justified per-module, not applied as a system-wide default.
- The Publish button shows its own loading state (label changes to "Publishing…", inline spinner) — this is the only visual indicator required at the behavioral level; styling of that spinner is Sprint B.
- Status changes to "Publishing."

This is intentionally lighter than the original "freeze the whole editor" proposal — the only hard requirement is no duplicate submissions and a visible in-progress signal on the action itself.

### 2.7 Publish Succeeded — Lightweight, Non-Interrupting (Sprint A behavior + Sprint B polish)

Revised per product decision:

- A lightweight confirmation appears — "✓ Published successfully" — lasting roughly 2 seconds.
- It does not block or interrupt the editing surface; the user should be able to keep looking at their content through it.
- After the ~2 second window, the UI automatically returns to the normal Published (clean) state described in Section 2.1: no lingering banner, no manual dismissal required.
- Behaviorally (Sprint A, non-negotiable regardless of how the confirmation looks): status resets to "Published," all draft indicators disappear (Proposed Version highlight, Draft/Pending chip, unsaved notice — none should remain), the action bar reverts to Edit-only, Current Published content refreshes in place to the newly published values, the former Proposed Version becomes the new Current Published (no separate proposed block remains), Continue Editing/Cancel Editing disappear, and any local component state is rebased onto the newly published values as the new comparison baseline for future edits.
- The 2-second toast (Sprint B styling) is the visual expression of this reset; the reset itself must happen correctly even if the toast were removed entirely — this is the actual fix for the "stuck in Draft" bug, and is not allowed to depend on the toast's presence.
- This reset must extend to every representation of the content, not just the editor surface the user happens to be looking at — see Section 8 for the full synchronization requirement.

### 2.8 Publish Failed

- Status reverts to "Draft" (or "Pending Review," if that's where the publish attempt originated from an Owner's Approve & Publish action) — never left stranded on "Publishing."
- A specific, persistent error message appears in the same action-bar notice slot used for unsaved-changes and rejection messages — reassuring the user nothing was lost: "Publish failed: [reason]. Your draft has been kept."
- All buttons re-enable to their pre-publish-attempt state. Editing (already unfrozen per 2.6) continues to be available with no special unfreezing step needed.
- This message persists until the user's next action — it should not auto-dismiss like the success toast does, since it may require the user to actually do something.

### 2.9 Rejected

- Reached when an Owner rejects a Pending Review submission.
- Status changes to "Rejected" — a distinct, persistent state in the primary model (Section 1), not folded into "Draft."
- The rejection reason, if provided, appears in the same persistent notice slot as unsaved-changes/failure messages.
- Continue Editing is immediately available, pre-populated with the rejected content (not reverted to last-published) so feedback can be addressed without losing work.
- Re-editing from Rejected moves the module back into Draft, and from there follows the same Submit/Pending Review path as any first-time submission — no special "resubmit" affordance needed.

---

## 3. Owner vs Employee

- **Employee:** Edit, Save Draft, Submit. Never sees Publish Now. After Submit, sees "Pending Review" and Continue Editing (which withdraws the submission back to Draft, per 2.4).
- **Owner:** everything an Employee sees, plus Publish Now (direct path, skips Pending Review entirely), and — when viewing another user's Pending submission — Approve & Publish and Reject.
- The distinction is expressed entirely through which buttons render for a given role in a given state (Section 5) — the status chip vocabulary and the Published/Proposed comparison view (Section 0) are identical for both roles. An Owner and an Employee looking at the same module in the same state see the same status and the same comparison; only the available actions differ.

---

## 4. Two Implementation Sprints

This specification deliberately separates **behavioral requirements** (must be correct regardless of visual treatment) from **visual polish** (can be iterated on independently, swapped, or restyled without touching state logic). Future implementation should follow this split.

### Sprint A — Behavior / State Consistency

In scope:
- State synchronization: every module's local state must correctly resync from updated server data after any save/submit/publish/reject action — no stale local state surviving a `router.refresh()` or equivalent.
- Post-publish reset: the full reset described in Section 2.7, independent of toast styling.
- Dirty-state tracking: a reliable, ideally computed (not manually toggled) dirty check per module.
- Publish flow: button-disable-on-click, no field freezing (per 2.6), Publish blocked while dirty, prevention of duplicate in-flight requests.
- Action bar behavior: which buttons appear/hide/disable in which of the seven states (Section 5), for both roles (Section 3).
- Pending Review and Rejected as real, distinguishable, persisted states (Section 1), not UI-only labels layered on top of Draft.
- The persistent (non-hover) notice mechanism itself — a fixed slot in the action bar that can carry unsaved/saved/failure/rejection messages — as a functional requirement, independent of its eventual color/icon treatment.

Explicitly out of scope for Sprint A: colors, icons, animations, toast styling, banner visual design. Sprint A should be implementable and testable using plain, unstyled state indicators (even just text labels) and still be considered "done."

### Sprint B — Visual Polish

In scope:
- Status chip colors and icon set (Section 6).
- Toast/banner visual styling, including the 2-second success toast's animation and placement.
- Action bar notice styling (colors, icons, transitions).
- Loading-state visuals (spinner design, button transition states).
- Any micro-animations for state transitions (e.g. Proposed Version highlight fade-in).

Sprint B should be applied uniformly across all modules only after Sprint A behavior is verified correct in each — visual polish should never be used to paper over a behavioral gap (e.g. a nice toast that masks a state-sync bug is not an acceptable substitute for fixing the sync).

---

## 5. EditorActionBar — Behavioral Rules (Sprint A)

- **Edit:** visible only in Published (clean). Hidden otherwise.
- **Continue Editing:** visible in Draft, Pending Review (Employee — withdraws submission), and Rejected. Hidden in Published (clean) and during Publishing.
- **Cancel Editing:** visible whenever a draft exists in any form (Draft, Pending Review, Rejected). Disabled (not hidden) during Publishing, to avoid racing a discard against an in-flight publish.
- **Save Draft:** visible during Editing (Unsaved) and Draft. Disabled if there's nothing new to save. Hidden in Published (clean) and Pending Review (no active edit surface until Continue Editing is pressed).
- **Submit:** visible only for Employee role, only on a clean Draft. Disabled while dirty.
- **Publish Now:** visible only for Owner role, only on a clean Draft. Disabled while dirty, while Publishing, or when there is no proposed version to publish.
- **Approve & Publish / Reject:** visible only for Owner role, only when viewing another user's Pending Review submission.
- **The persistent notice slot:** one fixed location in the action bar, present in Editing (unsaved-changes message), Draft (save confirmation, brief), Publish Failed (error, persistent), and Rejected (reason, persistent). Content swaps; position and mechanism don't.

A button is **hidden** when it is conceptually irrelevant to the current state. A button is **disabled** when it is relevant but blocked by a specific condition — and every disabled button must pair with an explanation in the persistent notice slot, never a `title`-only tooltip as the sole explanation.

---

## 6. Shared UX Language (Sprint B)

**Status chips** — one consistent set, seven values matching the primary state model (Section 1):
- Published — green
- Unsaved changes — amber
- Draft — blue/grey
- Pending Review — purple
- Publishing — neutral grey, spinner
- Rejected — red/orange
- (Publish Failed is a transient banner state layered on Draft/Pending, not its own chip — the chip reverts to whichever state the failure returned to, per 2.8)

**Icons:** one consistent icon per chip, reused across all modules — checkmark (Published), pencil/dot (Unsaved), document (Draft), clock (Pending Review), spinner (Publishing), flag/X (Rejected).

**Notice types by severity/frequency:**
- Inline action-bar notice (persistent until resolved): unsaved changes, publish failure, rejection reason.
- Lightweight toast (auto-dismiss, ~2s): publish success only — non-interrupting by design (Section 2.7).
- Save-draft confirmation: brief inline text in the same notice slot, slightly longer-lived than the 2s success toast but still non-blocking.

**Message tone:** success messages are short and past-tense ("Draft saved," "Published successfully," "Submitted for review"). Error/rejection messages are specific about cause and explicit about reassurance ("Publish failed: [reason]. Your draft has been kept.") — never a bare "Something went wrong."

---

## 7. Unsaved Exit Protection

Editing (Unsaved) is the one state where leaving the page can destroy work that exists nowhere else — it hasn't been saved as a draft yet. The exit-protection rule is scoped precisely to this state.

**When a confirmation dialog is required:**
- Closing the browser tab/window while in Editing (Unsaved) — use the native `beforeunload` confirmation.
- Refreshing the page while in Editing (Unsaved) — same mechanism, since a refresh is functionally a full unload.
- Navigating away within the app (e.g. back to the talent list, switching to a different talent, switching to a different module/tab that fully unmounts the current editor) while in Editing (Unsaved) — an in-app confirmation dialog ("You have unsaved changes. Leave without saving?") with the option to stay, discard and leave, or save the draft and then leave.

**When navigation may proceed silently:**
- Any state other than Editing (Unsaved) — Draft, Pending Review, Publishing, Published, Rejected — never blocks navigation. A saved Draft is, by definition, not at risk: it already persisted server-side, so leaving and returning later resumes from the same point with nothing lost.
- Switching between modules/tabs that do not unmount the editor (e.g. a tab switch implemented as a show/hide rather than a remount) does not need a warning, since the unsaved state is preserved in memory and resumes correctly on return — only an actual unmount or a full navigation away risks losing it.

**When no warning is necessary at all:**
- Programmatic navigation triggered by the system itself immediately after a successful Save Draft, Submit, or Publish — at that point the state is no longer Editing (Unsaved), so none of the above applies.
- Read-only views (Published clean, with no active edit) — there is nothing to protect.

**Why scope it this tightly:** warning on every navigation away from any module, regardless of state, trains users to reflexively dismiss the dialog and erodes its value exactly when it matters. Reserving the interruption for the one state where data loss is actually possible keeps it meaningful.

This applies uniformly to all current and future modules — any module with an Editing (Unsaved) state in this lifecycle inherits this exit-protection behavior without needing module-specific logic.

---

## 8. Lifecycle Synchronization After Publish

A successful Publish is a data event, not a visual transition — Section 2.7 describes what the user sees, but the underlying principle is broader and applies system-wide: **every representation of the content, anywhere it is shown, must reflect the new published state immediately and consistently.** None of the following should be allowed to lag behind or contradict another after Publish completes:

- **Current Published view** — shows the newly published content (Section 2.7).
- **Proposed Version state** — cleared; there is no longer a separate proposed block, since it has become the Current Published.
- **Version History** — the newly published version appears as the latest entry without requiring a manual refresh of the history list.
- **Audit Log** — the publish event is recorded and visible to anyone viewing the log, consistent with what Version History and Current Published now show.
- **Action Bar** — resets to the Published (clean) button set (Section 5), not left showing Draft/Pending-era actions.
- **Status (chip and any other status indicators on the page, including list/summary views of multiple modules or multiple talents)** — all read "Published," not just the status shown inside the editor that performed the publish.
- **Any local editor state** — rebased onto the new published values as the baseline for future edits (Section 2.7).

**The product principle:** the user should never be able to find a corner of the interface — a different tab, a history panel, a list view, a second browser tab open to the same record — that still appears to represent the pre-publish state once Publish has completed. Partial or delayed synchronization, even if eventually correct after a manual refresh, is treated as a bug, because it undermines trust that Publish actually did what it claimed to do. Consistency across every surface is what makes the Published-vs-Proposed model (Section 0) trustworthy — if Publish can leave stale representations behind, the comparison view stops being a reliable preview of reality.

This requirement belongs to Sprint A (Section 4) — it is a behavioral correctness requirement, not a visual one, and must hold true even before any Sprint B styling is applied.

---

## 9. Future-Proofing

Any future module — documents, campaigns, homepage content, legal pages, additional gallery-like uploads — adopts this specification by:

1. Preserving the Published-vs-Proposed comparison principle (Section 0) in whatever form suits its content's complexity.
2. Mapping its own lifecycle onto the same seven-state model (Section 1) — including Pending Review and Rejected as real states, even if a given module chooses to skip the review step entirely for all roles (that's a configuration choice within this state machine, not a new design).
3. Reusing the same status chip vocabulary, icon set, and notice-placement rules (Sections 5–6) without modification.
4. Implementing Sprint A behavior first and independently of Sprint B styling, so behavioral correctness can be verified before visual polish is applied.

This document does not prescribe a specific state-management implementation, API shape, or shared hook — those remain engineering decisions made per the existing implementation audit. This specification defines the contract the user experiences; it is the standard against which any module's Draft/Publish implementation should be judged correct.
