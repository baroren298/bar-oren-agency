# Sprint 3b — Session Management API (Design Plan)

**Status: PLANNING ONLY — nothing in this document is implemented. Awaiting Owner approval.**

Builds on Sprint 3a (Session Security Foundation): DB-backed `Session` rows, login/logout
lifecycle, per-request DB validation (`sessionService.getValidSessionUser`), and atomic
revoke-on-deactivate / revoke-on-password-reset. This sprint adds the OWNER-only API for
*viewing and revoking* sessions. No UI, no proxy.js changes, no auth redesign, no idle
timeout, no MFA, no public-site changes.

---

## 1. Proposed architecture

### 1.1 Layering (unchanged conventions)

```
route handlers (app/api/admin/users/[id]/sessions/...)
  → requireOwner(request)                      ← gate #1 (HTTP)
  → sessionManagementService (NEW)             ← gate #2 (assertActorIsOwner) + policy
      → sessionRepository (extended)           ← policy-free data access
      → eventService.emit(...)                 ← audit events (after commit, never blocking)
```

- **`sessionService` (auth path) is NOT touched.** Its fail-closed, null-returning contract
  is for the per-request predicate. Management operations have opposite error semantics
  (throw with `statusCode`/`code`, like `userService`), so they get their own service.
- **New: `lib/admin/sessionManagementService.js`** — mirrors `userService`'s shape:
  `assertActorIsOwner` second gate, target-user existence check, safe DTO projection,
  event emission after the write.
- **`sessionRepository` extended** with read/scoped-revoke methods; stays policy-free.

### 1.2 API routes (OWNER-only, all under the existing users surface)

Nested under `/api/admin/users/[id]` because sessions are managed *per user*, matching the
existing Owner-only user-management surface. Revocation uses POST action subroutes (the
codebase convention — approve/reject/publish are POST subroutes; users route deliberately
has no DELETE), and because revoke is an idempotent state transition, not a deletion.

| Route | Method | Purpose |
|---|---|---|
| `/api/admin/users/[id]/sessions` | GET | List the user's **active** sessions (not revoked, not expired), newest first |
| `/api/admin/users/[id]/sessions/[sessionId]/revoke` | POST | Revoke one session |
| `/api/admin/users/[id]/sessions/revoke-all` | POST | Revoke all of the user's active sessions (self-targeting keeps the current session — see 1.5) |

`sessionId` cannot collide with `revoke-all` as a dynamic segment value in practice
(sids are UUIDs), and Next.js resolves the static `revoke-all` segment ahead of
`[sessionId]` anyway.

### 1.3 Session DTO (list response)

```json
{
  "sessions": [
    { "id": "<sid>", "createdAt": "ISO", "expiresAt": "ISO", "isCurrent": true }
  ]
}
```

- `isCurrent` = row id === acting Owner's own `sid` (already returned by `requireOwner`
  as `session.sid` — no extra work). Only ever true when the Owner views their own list.
- **Exposing the sid**: acceptable — a sid alone cannot authenticate (the cookie carries a
  JWT *signed* over the sid with `SESSION_SECRET`; possessing a sid does not let anyone
  mint a valid token). It is also required as the revoke target. The DTO exposes nothing
  else: no `userId` (implied by the URL), no `revokedAt` (always null for listed rows).
- No IP/user-agent/lastSeen fields — those columns don't exist and this sprint adds none.

### 1.4 Repository responsibilities (extend `sessionRepository`, policy-free)

- `listActiveForUser(userId, now = new Date())` — `where: { userId, revokedAt: null,
  expiresAt: { gt: now } }`, `orderBy: { createdAt: 'desc' }`, hard `take` cap (50).
  Uses the existing `(userId, revokedAt)` index.
- `getForUser(sessionId, userId)` — single row scoped to BOTH ids (IDOR guard primitive).
- `revokeForUser(sessionId, userId, when)` — `updateMany({ id, userId, revokedAt: null })`,
  returns count. The **userId in the WHERE clause** is what makes cross-user revocation
  impossible at the data layer, not just at the service layer.
- `revokeAllForUserExcept(userId, exceptSid, when)` — `updateMany({ userId,
  revokedAt: null, id: { not: exceptSid } })`, returns count.
- Existing `revokeAllForUser(userId)` reused for the non-self revoke-all path.

All revokes keep 3a's invariants: filtered on `revokedAt: null` (idempotent, set-once,
never resurrect), never throw on 0 rows.

### 1.5 Service responsibilities (`sessionManagementService`)

- `listSessions(targetUserId, actorContext)` — assert OWNER; 404 if target user doesn't
  exist; project DTOs; stamp `isCurrent` from `actorContext.sid`.
- `revokeSession(targetUserId, sessionId, actorContext)` — assert OWNER; 404 if target
  user doesn't exist; **409 `CANNOT_REVOKE_CURRENT_SESSION`** if
  `sessionId === actorContext.sid` (see Design decision below); scoped revoke; resolve
  idempotency (see 1.6); emit audit event on count === 1.
- `revokeAllSessions(targetUserId, actorContext)` — assert OWNER; 404 if target missing;
  if `targetUserId === actorContext.actorId` use `revokeAllForUserExcept(..., actorContext.sid)`
  (Owner keeps the session they're acting from), else `revokeAllForUser`; emit audit event
  with the count (including count 0 — the intent is still auditable); return `{ revoked: n }`.

**Design decision — preventing accidental self-revocation (required by spec):**
single-session revoke of the *current* session is **rejected with 409
`CANNOT_REVOKE_CURRENT_SESSION`** ("Use logout to end your current session."). Rationale:
identical philosophy to `CANNOT_DISABLE_SELF` / `CANNOT_DISABLE_ONLY_OWNER` — an explicit,
distinct action (logout) exists for ending your own session, and a 409 makes the UI (next
sprint) render a disabled state instead of a surprise logout. Revoke-all on yourself is
allowed but **spares the current session** ("sign out everywhere else"), so the Owner can
never lock themself out mid-request. Ending truly *everything* remains possible via
revoke-all + logout.

### 1.6 Error model (reuses the established shape)

`{ error: string, code?: string, fieldErrors?: object }` with `statusCode` mapped by the
same `authErrorResponse` / `serviceErrorResponse` helpers the users routes use.

| Case | Status | `code` |
|---|---|---|
| No/invalid session | 401 | — (generic "Not authenticated.") |
| Non-OWNER actor | 403 | `FORBIDDEN_ROLE` |
| Target user id unknown | 404 | `USER_NOT_FOUND` |
| Session id not found **for that user** (never existed, or belongs to someone else) | 404 | `SESSION_NOT_FOUND` |
| Session already revoked/expired | 200 | idempotent success, `{ revoked: 0 }` |
| Revoking own current session (single) | 409 | `CANNOT_REVOKE_CURRENT_SESSION` |
| Unexpected | 500 | generic message, details only server-side logged |

Distinguishing 404 vs idempotent-200 needs one scoped read after a 0-row revoke
(`getForUser`): row exists for this user → 200 `{ revoked: 0 }`; otherwise → 404. A
session belonging to a *different* user returns the same 404 as a nonexistent one — no
cross-user existence oracle. (Enumeration value is low anyway — the caller is already
OWNER — but the guarantee costs nothing.)

401/403 bodies stay generic (no revoked-vs-expired-vs-missing distinction), preserving
3a's non-enumeration contract.

### 1.7 Audit Log events

Two new `EVENT_TYPE` entries (plain strings — **no migration for the catalog itself**),
emitted by `sessionManagementService` after the write, same fire-and-log-on-failure
semantics as `emitUserEvent`:

- `UserSessionRevoked` — payload `{ scope: 'single' }`
- `UserSessionsRevoked` — payload `{ scope: 'all', revokedCount: n }`

Entity: `USER` / target user's id; actor: the acting Owner (`updatedById`, same reuse
pattern as ACTIVATED/DEACTIVATED/PASSWORD_RESET). **Log hygiene: the sid is never put in
the payload** — the narrative is "Owner revoked a session / all sessions of user X",
which is complete without it.

Projection to `ActionType` (Postgres enum) — two options, see §3.

Read side: `auditLogService.buildSafeDetails` gets two named-key additions
(`scope`, `revokedCount`) and `audit-log-display.js` gets narrative labels. Allowlist
convention preserved (named keys only, nothing spread).

### 1.8 Pagination

**Not needed.** Sessions per user are bounded by the 8h TTL — realistically a handful of
rows. The list endpoint hard-caps at 50 (newest first) as a safety valve; if that cap is
ever hit something is wrong (login-loop bug), not under-paginated. Cursor pagination like
the audit log's can be added later without breaking the response shape.
(Related, deliberately out of scope: expired-row cleanup/retention — noted in §6 Risks.)

### 1.9 Future compatibility — Idle Timeout (not built now)

The design leaves clean seams:

- A future `lastSeenAt` column is **additive** (nullable, no backfill); the DTO grows a
  `lastSeenAt` field additively; the list query is unchanged.
- The idle predicate would live in the one existing place —
  `sessionService.getValidSessionUser` — untouched by this sprint.
- The revoke primitives (single/all/except) are exactly what an idle-reaper or
  "sign out stale devices" feature would call.

Nothing in this sprint hard-codes assumptions that idle timeout would break.

---

## 2. Files that would change

| File | Change |
|---|---|
| `app/api/admin/users/[id]/sessions/route.js` | **NEW** — GET (list) |
| `app/api/admin/users/[id]/sessions/[sessionId]/revoke/route.js` | **NEW** — POST (revoke one) |
| `app/api/admin/users/[id]/sessions/revoke-all/route.js` | **NEW** — POST (revoke all) |
| `lib/admin/sessionManagementService.js` | **NEW** — policy layer described above |
| `lib/admin/repository/sessionRepository.js` | Extend: `listActiveForUser`, `getForUser`, `revokeForUser`, `revokeAllForUserExcept` |
| `lib/admin/engine/eventTypes.js` | Add `USER_SESSION_REVOKED`, `USER_SESSIONS_REVOKED` |
| `lib/admin/engine/listeners/auditLogListener.js` | Map the two new event types (+ actor field) |
| `lib/admin/auditLogService.js` | `buildSafeDetails`: allowlist `scope` / `revokedCount` |
| `lib/admin/audit-log-display.js` | Narrative labels for the new action(s) |
| Tests | New: route tests ×3, sessionManagementService test, sessionRepository additions test; extend audit display tests |
| *(Option B only)* `prisma/schema.prisma`, `lib/admin/constants/enums.js`, new migration | Additive `ActionType` values |

Explicitly **unchanged**: `proxy.js`, `lib/admin/auth/session.js`,
`lib/admin/auth/sessionService.js`, `lib/admin/auth/authorize.js`, login/logout routes,
Session table shape, all public-site code, all UI.

---

## 3. Is a Prisma migration required?

**For the API itself: NO.** The Sprint 3a `Session` model and its `(userId, revokedAt)`
index already support every query and write above. The event-type catalog is plain
strings, also migration-free.

**One decision point — audit `ActionType` projection** (Postgres enum, so new values need
a migration):

- **Option A — zero migration:** project both new events to the existing
  `ActionType.UPDATED` (actor already lands in `updatedById`), with `scope`/`revokedCount`
  in details carrying the meaning. Satisfies "no schema changes" literally; narrative reads
  "updated user X", which is vague.
- **Option B — one additive enum migration:** add `SESSION_REVOKED` and
  `SESSIONS_REVOKED` to `ActionType` (+ mirror in `constants/enums.js`). This follows the
  codebase's own precedent — ACTIVATED/DEACTIVATED were added rather than reusing
  RESTORED/ARCHIVED explicitly "so the audit narrative stays honest." Additive enum values
  touch no table, no data, no existing rows.

**Recommendation: Option B**, but it is the only schema change on the table and is
strictly optional — flag for approval; Option A ships with zero migrations.

---

## 4. Functional work

1. Repository: four new methods + tests (idempotency, scoping, ordering, cap).
2. Service: three methods with OWNER assertion, 404/409 policy, DTO projection,
   `isCurrent` stamping, event emission + tests.
3. Routes: three handlers using `requireOwner` + `buildRequestAuditContext` +
   `serviceErrorResponse`, matching the users routes' structure + tests.
4. Audit read path: allowlist keys + display labels + tests.
5. Event catalog + listener mapping (+ enum/migration if Option B).

---

## 5. Security work (review findings)

- **IDOR:** Double-keyed everywhere. The revoke `WHERE` clause carries `{ id, userId }`
  from the URL pair, so a session id pasted under the wrong user's URL revokes nothing and
  404s identically to a nonexistent id (no cross-user oracle). List is keyed by `userId`
  only from the path, gated twice by OWNER checks. No raw DB errors surface.
- **Replay:** Listing exposes sids, but a sid is not a credential — authentication
  requires the signed JWT (HMAC over the sid with `SESSION_SECRET`), so a leaked list
  response cannot be replayed into a session. Revoked sessions stay dead (`revokedAt`
  set-once, never cleared; reactivation never resurrects — 3a invariant preserved).
  Revocation takes effect on the target's next request via the existing per-request DB
  check; the residual window is one in-flight request, same as 3a documented.
- **Race conditions:**
  - *Concurrent revokes of the same session:* both `updateMany` calls are atomic; one
    returns count 1, the other count 0 → idempotent 200s. No error, no double audit
    (event only on count === 1).
  - *Revoke-all racing a fresh login:* a session created after the `updateMany` snapshot
    survives. Acceptable — revoke-all is "end current sessions", not "ban future logins";
    the atomic ban path already exists (deactivate, which revokes in the same
    transaction). Documented, not fought.
  - *Revoke racing the target's in-flight request:* the request already past the auth
    gate completes; next request 401s. Same one-request exposure as 3a.
- **Self-revocation:** current session can't be single-revoked (409 → use logout, which
  also clears the cookie — revoking without clearing the cookie would leave a dangling
  token that then 401s confusingly). Self revoke-all spares the current session, so the
  acting Owner can never strand themself mid-session; full sign-out remains logout.
- **Multi-tab:** all tabs share the one cookie/sid. Revoking that sid (or revoke-all from
  another device) kills every tab on its next request — 401 → login redirect via existing
  handling. No per-tab state exists to desynchronize.
- **Concurrent revoke requests (double-click / two admins):** idempotent by construction;
  second caller gets 200 `{ revoked: 0 }`. Audit shows one event per effective revoke.
- **Least privilege:** OWNER-only at two independent gates (route `requireOwner` +
  service `assertActorIsOwner`), same defense-in-depth as userService — an EMPLOYEE
  session can't reach this even if one gate is dropped in a refactor. No self-service
  employee session management this sprint (future sprint can relax deliberately, not
  accidentally). DTO is minimal; audit payloads contain no sids/tokens; error bodies stay
  generic at 401/403.

---

## 6. Risks

- **Sid exposure in list responses** — mitigated (not a credential), but it widens where
  sids appear (Owner's browser memory/devtools). Alternative (opaque per-row handle) adds
  a lookup table or encryption for marginal gain; not recommended now. Revisit if
  sessions ever become bearer-usable without the JWT.
- **Revoke-all ≠ login ban** — an Owner may expect revoke-all to keep the user out. It
  doesn't (by design); the UI sprint must label it "sign out of all sessions" and point
  to Deactivate for the ban. Risk is UX-expectation, addressed in copy next sprint.
- **Session table growth** — expired/revoked rows are never deleted. Not new to this
  sprint and unaffected by it; a retention/cleanup job is future work worth scheduling.
- **Option B migration timing** — enum migration must be applied before deploy of code
  emitting the new action types (standard additive-migration ordering; same as Sprint 2a).
- **Cap without pagination** — if a pathological client loops logins, the list truncates
  at 50 newest. Acceptable; revoke-all still kills all rows regardless of the cap.

---

## 7. Recommendation

Proceed with the design above:

1. New `sessionManagementService` + extended `sessionRepository`; auth-path modules
   untouched.
2. Three routes nested under `/api/admin/users/[id]/sessions` using POST action subroutes.
3. 409-block single self-revoke; self revoke-all spares the current session.
4. Idempotent 200 `{ revoked: 0 }` for already-dead sessions; scoped 404 for
   unknown/foreign session ids.
5. No pagination; hard cap 50.
6. **Approve Option B** (two additive `ActionType` enum values, one small migration) for
   an honest audit narrative — or say the word and it ships as Option A with zero
   migrations.

Estimated blast radius: 5 new files, 4 edited files (+3 if Option B), no changes to any
existing security-critical path.

*Awaiting approval before any implementation.*
