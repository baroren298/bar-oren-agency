# Administration — Phase 1 Engineering Plan (Users Module)

**Status:** Awaiting approval. Engineering begins on approval.
**Architecture:** Frozen (Administration: Users / Sessions / Audit Log). This plan changes nothing architecturally.
**Scope:** Users module only. Sessions and Audit Log modules are out of scope; future modules (Roles & Permissions, Security Policies, Platform) remain reserved concepts only.
**Ground rules carried from project principles:** build for today, design for tomorrow; small production-quality increments; every feature ends with QA + Feature Hardening before merge; the public website is completely unaffected; the existing approval workflow is preserved; no changes to secrets, environment configuration, or unrelated infrastructure.

---

## 1. Phased Implementation Plan

Phase 1 is delivered in four sub-phases. Each sub-phase is independently mergeable, ends behind admin authentication, and closes with its own QA + Hardening pass.

**Phase 1.A — Module shell + read-only Users view.**
Establish the Administration section entry point and the Users module boundary, then render a read-only view of existing admin users. No mutations. This proves the module seam that Sessions and Audit Log will later plug into, using only what the frozen architecture already defines.

**Phase 1.B — User lifecycle mutations.**
Create user and activate/deactivate user, flowing through the existing authorization and audit conventions. Every mutation is audit-visible from day one.

**Phase 1.C — Profile and credential administration.**
Edit user details and owner-issued credential reset, respecting the credential rules already committed to in the security roadmap (forced rotation of temporary credentials is a dependency to coordinate with, not rebuild).

**Phase 1.D — Integration hardening and release.**
Full-module QA sweep, the Users Feature Hardening checklist (Section 6), regression of the approval workflow and public site, and documentation. Exit gate for Phase 1.

Ordering rationale: read before write, write before credentials, credentials before release. Each step is the smallest increment that produces production-quality value and de-risks the next.

## 2. Recommended Sprint Breakdown

| Sprint | Delivers | Merge gate |
|---|---|---|
| **Sprint 1** | Phase 1.A — module shell + read-only Users view | QA + Hardening pass for 1.A |
| **Sprint 2** | Phase 1.B — create + activate/deactivate | QA + Hardening pass for 1.B |
| **Sprint 3** | Phase 1.C — edit + credential reset | QA + Hardening pass for 1.C |
| **Sprint 4** | Phase 1.D — integration hardening, regression, docs, release sign-off | Full Users hardening checklist (Section 6) |

Each sprint merges independently. No sprint depends on a later one being planned in detail before it can start.

## 3. Smallest Possible First Sprint (Sprint 1)

**Deliverable:** The Administration → Users module exists, is reachable only by an authenticated, authorized admin, and displays the real list of admin users with their essential status information. Read-only. No create, no edit, no deactivate, no credential actions.

Why this is the right smallest sprint: it forces every structural decision (navigation entry, module boundary, authorization at the entry point, data flow into the admin UI) while carrying zero risk of corrupting user state, and it gives every later sprint a place to land.

## 4. Definition of Done — Sprint 1

Sprint 1 is done when all of the following are true:

1. An authorized admin can navigate to Administration → Users and see the actual list of admin users with identity and active/inactive status.
2. Unauthenticated access and unauthorized access to the Users module (both the view and any data it reads) are denied, verified by test, not by inspection.
3. The view handles the realistic states: populated list, single user, and error-on-load, each verified.
4. Zero changes to public website routes, pages, assets, or behavior — verified by diff review and by loading the public site.
5. The existing approval workflow passes its existing tests unchanged; no engine services or approval paths were modified.
6. No secrets, environment configuration, or unrelated infrastructure were touched — verified in code review.
7. The QA checklist (Section 5) and the Sprint-1-applicable items of the Hardening checklist (Section 6) pass.
8. Reviewed, approved, and merged; the module renders correctly in the production-like environment.
9. A short module README/status note records what exists and what is deliberately deferred.

Anything not on this list is not required for Sprint 1 and must not delay merge.

## 5. QA Checklist (run at the end of every sprint)

- [ ] All new behavior covered by automated tests; full existing test suite green.
- [ ] Authorization verified at every new entry point: correct role sees it, others are denied (tested for both UI reachability and direct data access).
- [ ] All user-visible states exercised: normal, empty/minimal, loading, and failure — with graceful, non-leaking error presentation.
- [ ] Session edge cases: expired session mid-use redirects/denies cleanly; no partial content exposure.
- [ ] Public website regression: public pages load unchanged; no new references from public code into admin code.
- [ ] Approval workflow regression: existing proposal → approval → publish flow works end to end, untouched.
- [ ] Every mutation added this sprint produces the expected audit record (from Sprint 2 onward).
- [ ] Manual pass in the primary supported browser at desktop resolution; no console errors.
- [ ] Code review confirms: no schema-affecting changes beyond what the sprint explicitly approved, no secret/env/infra edits, no drive-by refactors of unrelated code.

## 6. Feature Hardening Checklist — Users Module

Run incrementally per sprint; complete in full before Phase 1 release.

**Authorization & self-protection**

- [ ] Every Users read and mutation independently enforces authorization (no reliance on UI hiding alone).
- [ ] The owner cannot deactivate their own account, and the last active owner-level account can never be deactivated (no self-lockout path).
- [ ] Privilege changes to one's own account are blocked or explicitly safe.

**Credential & account safety**

- [ ] Owner-issued credentials follow the committed policy: forced rotation on first login, minimum strength enforced — coordinated with the security roadmap, not reimplemented.
- [ ] Deactivation behavior against live sessions is explicitly decided and documented — including, if the known revocation gap remains, the accepted exposure window and its ticket.
- [ ] No user-enumeration signal: errors and timing don't reveal whether an account exists.

**Data & audit integrity**

- [ ] Every Users mutation is recorded in the audit trail via the established event path — never written directly.
- [ ] All input on user fields is validated and safely rendered (names/emails can't inject into the admin UI).
- [ ] Error messages and logs never expose credentials, tokens, or internal identifiers.

**Isolation**

- [ ] No admin code or Users data is reachable from any public bundle, route, or page.
- [ ] Rate limiting and login protections are functionally unchanged by this module.

## 7. Risks to Avoid During Implementation

1. **Scope creep into reserved modules.** Users work will keep suggesting "just add a role editor / session viewer." Roles & Permissions, Sessions, Security Policies stay reserved. New ideas are not sufficient reason to expand scope (per the freeze).
2. **Speculative plumbing for future modules.** Design the seam, don't build the plugs. Abstractions for modules that don't exist yet violate "build for today."
3. **Touching the auth/session layer "while we're in there."** The Users module consumes existing auth; it does not modify it. Session revocation is a tracked roadmap item, not a Users-sprint side quest.
4. **Destabilizing the approval workflow.** Reuse established conventions without modifying engine services. Any change to shared engine code is a red flag in review.
5. **Self-lockout.** A mutation path that can deactivate or demote the only owner is the single most dangerous bug this module can ship.
6. **Big-bang delivery.** Resisting merge until "the whole module is done" defeats the sprint structure. Each sprint merges on its own gate.
7. **Silent security-policy drift.** Reinventing credential rules inside Users instead of aligning with the security roadmap creates two sources of truth.
8. **Public-site contamination.** Any import, route, or asset change that couples public code to admin code — even accidentally via shared components.

## 8. Explicitly NOT Built in Sprint 1

- Any mutation: no create, edit, deactivate, or credential actions (Sprints 2–3).
- Sessions module and Audit Log module (separate Phase-1-adjacent v1 items, planned after Users ships).
- Roles & Permissions in any form — no role editing UI, no permission matrix. Existing roles are displayed, never managed.
- MFA, password-policy configuration, invites, or self-service flows (security roadmap / Security Policies territory).
- Search, filtering, sorting, pagination, or bulk operations on the user list.
- Any external/public API surface for user data.
- Session revocation mechanics (tracked in the security roadmap as its own item).
- Generic "admin CRUD framework" intended for future modules.

---

*Next step on approval: open Sprint 1 with the deliverable in Section 3 and the Definition of Done in Section 4.*
