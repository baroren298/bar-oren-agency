# Sprint 3a — Session Security Foundation: Final Engineering Plan

**Status:** Planning output only — no implementation performed.
**Basis:** SECURITY_ROADMAP.md item 2.1 (session revocation), grounded in the current code: `lib/admin/auth/session.js` (stateless HS256 JWT, 8h), `lib/admin/auth/authorize.js`, `proxy.js`, `app/api/admin/auth/login|logout/route.js`, `lib/admin/userService.js`, `lib/admin/repository/userRepository.js`, `prisma/schema.prisma` (10 existing migrations).

---

## A. Final Sprint 3a scope

1. One additive migration adding a DB-backed `Session` model (new table only; no existing table altered).
2. New JWTs carry a unique `sid` claim referencing the Session row.
3. Minimal `sessionRepository` (data access) and `sessionService` (security decisions).
4. Node-side authorization validates per request: session exists, not revoked, not expired, user exists and `isActive`, and role is read from the current DB user — never from the JWT claim.
5. Login creates a Session row and issues a JWT containing its `sid`.
6. Logout revokes the current Session before clearing the cookie.
7. Deactivation (`userService.setActive(…, false)`) and owner-issued password reset (`userService.resetPassword`) revoke all of the target user's active Sessions atomically with the user mutation.
8. Legacy JWTs (no `sid`) fail closed everywhere → documented one-time logout after deployment.
9. Focused security tests (Section F) plus regression coverage (Section G).

Everything under "Explicitly out of scope" in the sprint brief is deferred (Section L). `proxy.js` is **not edited** — see C/D for how legacy-token rejection reaches the Edge without touching it.

## B. Minimal Session data model

New model `Session` → table `sessions`. Additive migration only.

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id` | The `sid`. Generated app-side by `sessionService` via `crypto.randomUUID()` (128-bit CSPRNG — non-guessable). **No** `@default(cuid())`: cuid v1 is partially predictable and generation must be service-owned. |
| `userId` | `String` | FK → `users.id`, back-relation `sessions Session[]` on `User` (relation only; no column change to `users`). |
| `createdAt` | `DateTime @default(now())` | |
| `expiresAt` | `DateTime` | Set from the same `SESSION_MAX_AGE_SECONDS` value used for the JWT `exp`, so DB and token expiry never diverge. |
| `revokedAt` | `DateTime?` | `null` = active. Set-once; never un-set (reactivation does not resurrect sessions). |

Indexes: `@@index([userId, revokedAt])` (revoke-all + lookups). `@@map("sessions")`.

Deliberately absent (out of scope): device/UA fields, IP, location, `lastSeenAt`, raw token. **The raw JWT is never stored anywhere** — the DB holds only the random `sid` the signed token references.

## C. Authentication & authorization flow — before / after

**Before (current):**
- Login: credentials → `signSession({userId, role})` → httpOnly cookie. No server-side record.
- Edge (`proxy.js`): signature + expiry check only.
- Node routes (`requireUser`/`requireRole`/`requireOwner`) and Server Components (`getSessionUser({cookies})` in `AdminShell.jsx` and 6 admin pages): decode the JWT statelessly; **role and identity are trusted from the token; no DB check**. A deactivated user or reset password leaves old tokens valid up to 8h.

**After:**
- Login: credentials verified → `sid = randomUUID()` → JWT signed with `sub`, `sid` (see D for ordering) → Session row created → cookie set.
- `verifySession()` (Edge-safe, no DB): additionally requires a well-formed `sid` claim; tokens without one return `null`. Because `proxy.js` already calls `verifySession()`, legacy tokens are rejected at the Edge **with zero changes to proxy.js** (page → redirect to `/admin/login`; API → 401), and no genuine blocker forces a proxy edit.
- `getSessionUser()` becomes the Node-only, DB-backed gate (single `session.findUnique({ include: user })` round trip via `sessionService.getValidSessionUser(sid)`), returning `{ userId, role, sid }` only when **all** hold: token signature/expiry valid; `sid` present; Session row exists; `revokedAt` is null; `expiresAt` in the future; User row exists; `isActive === true`. **Role comes from the fetched User row**, never the JWT claim. Any failure → `null` (fail closed).
- Because `requireUser`/`requireRole`/`requireOwner`/`requireOwnerOrEmployee` all build on `getSessionUser`, every existing API route inherits DB-backed validation with no per-route edits. The 7 Server Component call sites (`AdminShell.jsx`, `app/admin/page.jsx`, `my-work`, `audit-log`, `users`, `users/[id]`, `talent/[id]`) also inherit it unchanged — their existing null-check → redirect paths become the enforcement point. Verification task: grep-confirm nothing Edge-bundled imports `authorize.js` (today only `proxy.js` is Edge and it imports `session.js` only).
- The JWT keeps a `role` claim solely so old/new token shapes stay similar; it is decorative — no authorization decision reads it. Edge gating remains "validly signed session token exists", exactly as today.
- Optional (non-blocking): wrap the new DB lookup in React `cache()` so AdminShell + page in one RSC render share a single query. Per-request only — never caches across requests (matters for prompt revocation).

## D. Transaction and consistency design

**Critical requirement — atomic mutation + revoke-all.** Two new composite methods on `userRepository` (mechanism only, no policy):

- `setActiveAndRevokeSessions(userId, isActive)` — one `prisma.$transaction`: `user.update({isActive})` + `session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } })`.
- `updatePasswordHashAndRevokeSessions(userId, passwordHash)` — same shape.

Both writes commit together or not at all: **deactivation/reset can never commit while revocation silently fails.** This matches the existing repo convention that transactions live inside repository methods (`talentRepository.publishTalentVersion` et al.). The **service** decides *when* to use them: `userService.setActive` uses the composite only when deactivating (reactivation uses plain `setActive` and revokes nothing); `userService.resetPassword` always uses its composite. Event emission (Sprint 2b `emitUserEvent`) stays post-commit and best-effort, unchanged. An Owner resetting their own password revokes their own sessions too — intended, security-correct; the UI lands on `/admin/login`.

**Login ordering** (Session created but signing/cookie fails):
1. Verify credentials, rate limit, `isActive` — unchanged.
2. Generate `sid`; **sign the JWT first** (the only realistic sign failure, missing `SESSION_SECRET`, now aborts before any DB write).
3. Create Session row (`expiresAt` from the same max-age constant). Failure → 500, no cookie, nothing issued.
4. Build response, set cookie.
5. `updateLastLoginAt` (kept awaited, as today).
Residual case: a failure after step 3 orphans one active Session row that no client holds a token for. It is unusable (authorization requires a *signed* JWT carrying that sid) and expires within 8h — accepted, documented, no cleanup job in scope.

**Logout semantics:** verify cookie token; if it yields a `sid`, revoke idempotently (`updateMany where revokedAt: null` — already-revoked/expired/unknown `sid` is a no-op). Then clear the cookie and return success **in all cases**: missing cookie, invalid signature, missing `sid` (legacy token), unknown/revoked/expired session — logout of a dead session is harmless and reveals nothing. If the revoke DB write itself throws, the cookie is still cleared and success returned, with a server-side `SECURITY GAP` error log (no token/sid contents) — the user's local logout intent is honored; the row still dies at `expiresAt`.

**Concurrent revoke vs in-flight request:** validation happens once, at the gate, per request; a request that passed before the revoke committed runs to completion. Exposure window = one request's duration (vs 8h today). No cross-request caching of validation results is introduced (see the `cache()` note — per-request only). Accepted; per-operation re-checks are out of scope.

**Repository stays policy-free:** `sessionRepository` = `create`, `getWithUser(sid)`, `revoke(sid)`, `revokeAllForUser(userId)` — pure data access. `sessionService` owns every security decision: sid generation, the full validity predicate, TTL alignment. Routes/pages consult `authorize.js`, which consults `sessionService`.

## E. Expected change categories

1. **Schema/migration** — `Session` model; one additive migration (`add_session_model`).
2. **`lib/admin/auth/session.js`** — `signSession` accepts/embeds `sid`; `verifySession` requires `sid` (stays Edge-safe, zero DB imports).
3. **New `lib/admin/repository/sessionRepository.js`** — 4 policy-free methods.
4. **New `lib/admin/auth/sessionService.js`** — sid generation + `getValidSessionUser(sid)` predicate + create/revoke orchestration.
5. **`lib/admin/auth/authorize.js`** — `getSessionUser` becomes DB-backed (Node-only); `require*` helpers unchanged in signature.
6. **`lib/admin/repository/userRepository.js`** — two composite transactional methods.
7. **`lib/admin/userService.js`** — `setActive` (deactivate path) and `resetPassword` call the composites.
8. **`app/api/admin/auth/login/route.js`** — ordering per Section D.
9. **`app/api/admin/auth/logout/route.js`** — revoke-then-clear per Section D.
10. **Tests** — new suites per Sections F/G. Existing route tests updated only where mocks assume stateless auth.

No changes to: `proxy.js`, any admin UI component, public site, other repositories/services, migration history.

## F. Security test matrix

| # | Case | Expected |
|---|---|---|
| S1 | New JWT contains `sid`; `sid` is a UUID from CSPRNG (format asserted) | pass |
| S2 | Legacy JWT (valid signature, no `sid`) → `verifySession` | `null` (fail closed) |
| S3 | Valid JWT, no Session row for `sid` | unauthorized |
| S4 | Valid JWT, Session `revokedAt` set | unauthorized |
| S5 | Valid JWT, Session `expiresAt` past (DB expiry independent of JWT exp) | unauthorized |
| S6 | Valid JWT + Session, user deleted or `isActive:false` | unauthorized |
| S7 | JWT `role` claim disagrees with DB role → authorization uses DB role | DB role wins |
| S8 | Deactivate user → all their active Sessions revoked in same tx; forced tx failure on revoke leg → user update **rolled back** | atomic |
| S9 | Owner password reset → same atomicity assertions as S8 | atomic |
| S10 | Login success → exactly one Session row; `expiresAt` matches max-age; cookie httpOnly/secure/lax |
| S11 | Login: Session-create failure → 500, no cookie, no row |
| S12 | Logout: valid sid → `revokedAt` set + cookie cleared; missing/invalid/legacy/revoked/expired sid → cookie cleared, success, no error leak; double logout idempotent |
| S13 | Reactivating a user does not clear `revokedAt` on old sessions |
| S14 | Tampered/foreign-signed JWT still rejected (signature path regression) |
| S15 | Log/response hygiene: no password, hash, raw JWT, cookie value, secret, full sid, or request body in any new log line or error body (assert on captured logs/responses in S8–S12) |

## G. Regression test matrix

| # | Case | Expected |
|---|---|---|
| R1 | Login: bad credentials → 401; deactivated account → 403; rate-limited → 429; enumeration-safe error text unchanged |
| R2 | Successful login still stamps `lastLoginAt` |
| R3 | Employee session on Owner-only route (e.g. `/api/admin/users`) → 403; Owner → 200 (defense-in-depth chain intact) |
| R4 | All existing `requireUser`/`requireOwner`/`requireOwnerOrEmployee` route tests green with DB-backed gate mocked/stubbed |
| R5 | Admin pages (`AdminShell` + 6 pages) render for a valid new-format session; redirect to `/admin/login` without one |
| R6 | Users UI flows: list/create/rename/email-change/activate work; self-disable and last-Owner guards still 409 |
| R7 | Sprint 2b event emission still fires post-commit for setActive/resetPassword (best-effort semantics preserved) |
| R8 | Public site routes and `proxy.js` x-pathname stamping untouched (no new behavior outside `/admin`, `/api/admin`) |
| R9 | Talent/gallery/socials proposal routes unaffected (spot-check one per cluster) |
| R10 | `prisma migrate status` clean after the new migration; no prior migration modified |

Note (sandbox constraint): tests are authored in-repo (vitest); execution is delegated to you with exact commands (`npm test`), since this environment cannot run vitest/Prisma engines.

## H. Migration and deployment plan

1. **Prerequisite:** `DIRECT_URL` must exist in `./.env` (known pending since the Infrastructure Cleanup sprint — Prisma CLI migrate commands fail without it). Owner action, before anything else.
2. Author migration via `npm run prisma:migrate:dev -- --name add_session_model` against the Neon dev branch (run by you, not the sandbox). Purely additive: `CREATE TABLE sessions` + FK + index. **No manual edits to existing migration files or `_prisma_migrations`.** If dev-branch drift (`playing_with_neon`) interferes, resolve per the documented manual fix — never by editing history.
3. `npm test` + `npm run build` locally (delegated).
4. Deploy order: `prisma migrate deploy` against production branch **first**, then deploy the app build. Old code + new empty table is harmless; new code without the table is not.
5. Post-deploy: confirm `migrate status` clean; log in once; verify a Session row exists; verify a pre-deploy cookie gets redirected to login (Section I).
6. Rollback: redeploy previous app build. The `sessions` table is additive and inert to old code — leave it (no down-migration/history edit).

## I. One-time logout behavior

At the first deploy, every existing cookie holds a legacy JWT with no `sid`. `verifySession` rejects it, so `proxy.js` (unchanged) redirects pages to `/admin/login` and 401s API calls; the Node gate independently rejects it too. Each user logs in once and receives a `sid` token — full recovery, no data loss, no support action. This is deliberate fail-closed behavior, not a bug: documented in the release note, and the Owner is told to expect exactly one forced re-login for every active user (max ~8h worth of outstanding tokens). No dual-accept/grace mode is provided — accepting sid-less tokens would recreate the unrevocable-session hole this sprint closes.

## J. Feature Hardening checklist

- [ ] Fail closed at every gate: any validation error/exception in the auth path yields 401/redirect, never a pass-through.
- [ ] Role for authorization read exclusively from the DB user row; grep-verify no decision reads the JWT `role` claim.
- [ ] No raw JWT persisted; DB stores random `sid` only; sid generated by CSPRNG.
- [ ] Log hygiene sweep of all touched files: no password/hash/token/cookie/secret/full-UA/request-body/full-sid in logs or error bodies.
- [ ] Error responses stay generic ("Not authenticated." / existing messages); no session-state enumeration (revoked vs expired vs missing all look identical to the client).
- [ ] `session.js` remains Edge-safe (no Prisma/Node-only imports); grep-verify no Edge module imports `authorize.js` or `sessionService`.
- [ ] Defense in depth preserved: proxy gate + route `require*` + service `assertActorIsOwner` all still fire.
- [ ] Cookie attributes unchanged (httpOnly, secure in prod, sameSite lax, path `/`).
- [ ] Rate limiting untouched.
- [ ] Transaction paths exercised by tests that force partial failure (S8/S9).
- [ ] No file outside Section E's list modified; no migration-history file touched.

## K. Definition of Done

1. All Section A items implemented; nothing from Section L started.
2. New migration applied cleanly to the dev branch; `prisma migrate status` clean; migration is one additive file.
3. Full vitest suite green locally (delegated run), including every S- and R-row above that is automatable; non-automatable rows covered by a written manual checklist executed against dev.
4. `npm run build` succeeds.
5. Manual dev-branch verification: login creates Session; logout revokes; deactivation and password reset kill live sessions immediately (second browser test); legacy cookie forces re-login.
6. Hardening checklist (J) fully checked.
7. Release note includes the one-time logout notice (I) and deploy ordering (H).

## L. Explicitly deferred work

Sessions listing API; Sessions UI; device/browser (UA) parsing; location display; `lastSeen` updates and idle timeout; LOGIN / LOGIN_FAILED audit events (roadmap 3.1); MFA (2.2); role-management UI; any `proxy.js` change; public-site changes; unrelated refactors; orphan-session cleanup job; per-request React `cache()` optimization (optional, may ride along only if zero-risk); log-hygiene retrofit of pre-existing login logs (roadmap 4.3); rate-limiter hardening (1.1/1.2).

## M. Final verdict

**APPROVED FOR IMPLEMENTATION** — with one execution prerequisite, not a design blocker: `DIRECT_URL` must be added to `./.env` before the migration can be created/applied (H.1). All other work is additive, isolated to the files in Section E, requires no proxy.js or migration-history changes, and fails closed by construction.
