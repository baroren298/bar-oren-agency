# Administration — Migration Plan (Current Implementation → Approved Architecture)

**Written:** Administration Sprint 1 (2026-07-14).
**Approach approved by Owner:** the existing Users module is the implementation baseline. Evolutionary improvement, not a rewrite. Nothing working gets rebuilt or removed.

## Frozen target architecture

```
Administration
├── Users            (v1)
├── Sessions         (v1)
└── Audit Log        (v1)
```

Reserved concepts (no code, no placeholders): Roles & Permissions, Security Policies, Platform.

## What already exists (baseline, shipped by earlier Sprints 3–3.2)

- `/admin/users` — Owner-only list (email, display name, role, status, last login, created) + add-employee form.
- `/admin/users/[id]` — Owner-only management page: edit display name and email, activate/deactivate, password reset.
- API: `POST /api/admin/users`, `GET/PATCH /api/admin/users/[id]`, `POST /api/admin/users/[id]/password` — all with route tests.
- `lib/admin/userService.js` + `lib/admin/repository/userRepository.js` — service re-checks OWNER independently of routes; safe projection (never returns password hashes).
- Safety rules already enforced in the service: an Owner cannot disable their own account; the last active Owner can never be disabled; only EMPLOYEE accounts can be created through the UI (Owner provisioning stays script-only).

## Gap analysis vs the freeze

| # | Area | Finding | Disposition |
|---|------|---------|-------------|
| 1 | Navigation | Users was a flat top-level nav item; the freeze groups it under Administration. | **Closed in Sprint 1** — Owner-only "ניהול מערכת" nav section added; Users link moved under it. Presentation-only change. |
| 2 | Audit visibility | User mutations (create, edit, activate/deactivate, password reset) emit no events and write no AuditLog rows. The existing audit pipeline (`eventService` → `auditLogListener`) covers content-proposal events only. | **Deferred** to the Audit Log module sprint (Step 2 below). Recorded as technical debt. |
| 3 | Sessions module | Does not exist. Also functionally blocked: sessions are cookie-based with no server-side session state to list or revoke (SECURITY_ROADMAP.md item 2.1). | **Deferred** to Step 3 below; must be co-planned with roadmap 2.1 (session revocation). |
| 4 | URL namespace | `/admin/users` is flat, not nested under an Administration path segment. | **Accepted deviation.** The freeze defines a module structure, not URLs. Renaming routes breaks bookmarks/tests for zero architectural gain. All Administration modules will follow the same convention (`/admin/<module>`), grouped only in the nav. |
| 5 | Roles & Permissions | Reserved in the freeze. Existing UI displays role read-only; no role editing anywhere; schema already supports the Employee role. | **Compliant.** No action. |
| 6 | Credential policy | Temporary passwords never expire or force rotation; 8-char floor (SECURITY_ROADMAP.md item 1.3, launch-blocking). | Not an architecture mismatch — a security roadmap item that lives inside Users. Scheduled as Step 4; must not be forgotten because "Users looks done." |

## Migration steps

Each step is one small sprint, independently mergeable, QA + Hardening before merge, public site and approval workflow untouched throughout.

**Step 1 — Nav restructure (this sprint, done).** Administration section in the nav; Users under it. No functional change.

**Step 2 — Audit Log module.** Two halves: (a) make user mutations audit-visible by emitting events through the existing event path so AuditLog rows are projected, never written directly (the established rule); (b) an Owner-only read-side `/admin/audit-log` page under the Administration nav section. Half (a) is the debt from gap #2; note the known related gap that `ActionType` lacks values for non-proposal actions (see ADMIN_PANEL_PLAN.md Sprint 3.7 note) — resolving that is part of this step's planning, not this document.

**Step 3 — Sessions module.** Owner-only view of active sessions with revocation. Prerequisite: server-side session representation (security roadmap 2.1 — deactivation/password reset must actually cut access). Do the security work first; the module UI is its natural read-side.

**Step 4 — Credential policy hardening inside Users.** Forced rotation on first login for temporary passwords + raised length floor (security roadmap 1.3). Touches login flow + Users; no new module.

**Later — reserved modules.** Roles & Permissions, Security Policies, Platform each become a new entry in `ADMINISTRATION_NAV_ITEMS` (AdminNavLinks.jsx) plus their own `/admin/<module>` route when — and only when — they are actually planned. No scaffolding beforehand.

## Rules carried through every step

- The nav section is the only shared "Administration framework" — deliberately. No generic admin-module abstraction gets built until a third module proves the pattern.
- Every step reuses the existing authorization layering (proxy → page redirect → route `requireOwner()` → service assert) unchanged.
- No schema change happens inside a step that wasn't planned for it (Step 2 will need one for `ActionType`; plan it there explicitly).
