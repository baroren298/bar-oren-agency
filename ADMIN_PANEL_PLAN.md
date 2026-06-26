# Architecture Status

**Architecture Status:** LOCKED ✅
**Current Version:** v1.4

| Phase                                          | Status         |
| ----------------------------------------------- | -------------- |
| Phase 1 – Foundations                           | ✅ Completed   |
| Phase 2 – Authentication & Security             | ✅ Completed   |
| Phase 3A – Core Content Engine Architecture     | ✅ Completed   |
| Phase 3B – Core Content Engine Implementation   | ⏳ Not Started |

**Last Architecture Review:** 2026-06-26

---

## Architecture Freeze

This architecture is now considered frozen.

From this point forward, architectural changes should only be introduced if they solve a real problem discovered during implementation.

New ideas alone are not sufficient reason to change the architecture.

The objective is to preserve long-term consistency, minimize unnecessary refactoring, and ensure that every implementation phase builds upon a stable foundation.

---

# Bar Oren Talent Agency — Admin Panel Architecture v1.4

Branch: `feature/admin-panel`. Status: Phase 1 (Foundations) and Phase 2 (Auth/Security) are implemented and committed. Phase 3 (Core Content Engine, Section 13 below) is planning only — no implementation yet. Supersedes v1.3; changes are tracked inline where a decision was revised.

**Decisions locked in v1.2** (previously open questions, now settled): the admin launches Owner-only, with the schema already supporting an Editor role so adding one later needs no migration; the stack is Postgres + Prisma, not a multi-option recommendation; optimistic locking ships in v1 from the start rather than being deferred to Hardening; Migration Day happens only after the admin has been fully tested running in parallel with the live `data/*.js`-backed site — no fixed calendar date, the trigger is "tested," not "scheduled."

**Decisions locked in v1.3** (Phase 3 architecture, Section 13): the proposal/approval/publish machinery is reframed as the **Core Content Engine**, scoped to the full pipeline **Content → Version → Proposal → Approval → Publish → Events**, not just "the proposal engine." `Approval` and `Publish` remain two separate services even though v1's composition has approval call publish immediately, in the same transaction — this is so "approve now, publish later," scheduled publishing, and manual publish-after-approval are future compositions of existing services, not rewrites. Every `Event` carries a dedicated, top-level `correlationId` so every event produced by one user action/transaction can be grouped, and an `Event`'s `payload` (business data) is kept structurally separate from its `metadata` (technical/request context — IP, user agent, request id, correlation id, duration). Every adapter declares a `capabilities` object (`supportsPreview`, `supportsScheduling`, `supportsSEO`, `supportsGallery`, `supportsSoftDelete`, `supportsPublishing`, `supportsArchive`) so generic services and future UI can ask "what does this content type support" without an entity-specific `if` statement anywhere in engine code.

**Decisions locked in v1.4** (architectural refinements ahead of Phase 3 implementation, Sections 13.15–13.18): the system has five mandatory architecture layers — Presentation → Core Content Engine → Repositories → Prisma → Database — each depending only on the layer directly below it, never skipping or reversing (Section 13.15). Eight Design Principles govern the whole platform, not just Phase 3 (Section 13.16). Phase 3 is not "done" on a calendar date — it is done only when eight measurable success criteria are all met, including at least two adapters using the engine with zero engine modifications (Section 13.17). A set of architectural guardrails names prohibited patterns explicitly — e.g. no business logic in routes, no entity-specific branching in engine services, no Event or AuditLog writes outside their owning service (Section 13.18). This version is documentation-only: no implementation code, schema, or `data/*.js` changes.

## 0. Codebase findings that shape this plan

The public site is Next.js App Router (v16) with a single dynamic locale segment, `app/[locale]/`, rewritten at the edge so Hebrew is unprefixed (`/`) and English lives at `/en` (see `next.config.mjs`). All content lives in four plain JS modules under `data/`: `data/site.js` (global config, nav, per-page copy, SEO meta, legal pages), `data/talent/index.js` (the talent roster array plus helper exports like `getFeaturedTalent`), `data/collaborations.js` (brand list, currently placeholder and disabled), and `data/i18n/strings.js` (chrome/UI strings). Pages import these modules directly at build/request time — there is no API layer, no database, and no auth in the repo today. Images live under `public/images/{talent,about,brand}/...` and are referenced by hand-written relative paths inside the talent objects (`profileImage`, `gallery[].src`), including per-image crop/position/scale overrides baked into the data. The only existing server route is `app/api/contact/route.js`, a stateless form handler using Resend. `middleware.js` only stamps a pathname header for 404 handling — it does not gate any routes today. There's no ORM, no `.env` beyond the contact form's two variables, and no admin code on `feature/admin-panel` yet.

This confirms the project's framing: data files are the real source of truth, and any database introduced now must be additive and inert with respect to the public site until Migration Day.

## 1. Recommended admin architecture

Run the admin panel as routes inside the same Next.js app rather than a separate project, so it shares the deployment, environment, and (eventually) data layer, while staying fully isolated from public rendering paths:

- All admin UI and APIs live under `app/admin/...` and `app/api/admin/...`. Because `next.config.mjs`'s catch-all rewrite is `/:path*` → `/he/:path*`, `/admin` must be added as a passthrough rule (alongside the existing `/en` passthroughs) before any admin route will resolve — this is the one required touch to `next.config.mjs`, additive only.
- The admin reads from and writes to a new persistence layer (a database) entirely separate from `data/*.js`. Until Migration Day, the public site keeps importing `data/*.js` directly, untouched. The admin's database is "shadow" infrastructure during build-out: real, testable, but not yet authoritative.
- A repository layer (`lib/admin/repository/*.js`) sits between route handlers and the database, per entity type (see Section 3's normalized model) — route handlers never issue raw queries.
- **Decided in v1.2:** stack is Postgres (managed — Vercel Postgres / Neon / Supabase, host TBD but the engine choice is final) plus Prisma for schema, migrations, and the query layer. Prisma's schema file becomes the single source of truth for the Section 3 model and is what the repository layer (above) wraps.
- **Decided in v1.2:** auth is Owner-only at launch. The `User`/session model still carries a `role` field (`owner`, `editor`) from day one so an Editor role is a data-entry and permission-check change later, not a schema migration — see Section 11.
- Image uploads use a blob store (Vercel Blob, S3, or Cloudinary), never runtime writes into `public/`, so a proposed image can be previewed without touching the live asset.
- **New in v1.1 — public component reuse is a first-class constraint, not an afterthought.** Because Live Preview (Section 7) now requires rendering real public components against proposed data, the admin's data-fetching boundary should be designed from day one so that any public component already accepting data as props (most do — see `page.jsx` passing `talent={featuredTalent}`) can be fed either `data/*.js` output or repository output through the same shape. This mainly means: keep the JSON shape returned by repositories byte-compatible with the existing `data/*.js` object shapes, so no public component needs to branch on where its data came from.

## 2. Suggested admin routes/pages

All under `/admin`, gated by auth (Section 10):

- `/admin/login` — Owner authentication.
- `/admin` — dashboard: pending proposals, recent activity, locked/conflicted entities, quick links.
- `/admin/talent` — roster list, with status badges (active / hidden / archived, plus pending-change indicator).
- `/admin/talent/[id]` — talent editor: profile fields, images, gallery, socials, bio (he/en), tags/category — rendered as Current Published / Proposed Update / Live Preview (Section 7).
- `/admin/talent/new` — create-talent flow ("Proposed Update with no Current Published counterpart").
- `/admin/site` — global config fields: homepage copy, nav labels, categories, contact info, footer.
- `/admin/site/seo` — meta titles/descriptions/OG fields per page.
- `/admin/site/legal` — accessibility statement and privacy policy sections.
- `/admin/collaborations` — brand list management.
- `/admin/socials` — agency-level social links, separate from per-talent socials.
- `/admin/proposals` — unified queue of all pending Proposed Updates, each linking to its diff for approval/rejection.
- `/admin/proposals/[id]` — proposal detail: diff view, approve/reject/request-changes actions, conflict warnings (Section 6), audit trail.
- `/admin/history` — published version history per entity, for rollback reference.
- `/admin/trash` — **new in v1.1**: soft-deleted/archived entities, with restore action, surfacing the statuses introduced in Section 5.
- `/admin/migration` (internal/dev-only, locked down after Migration Day) — the controlled tool performing the one-time import described in Section 8.

## 3. Data model: normalized entities + shared versioning

**Decision change from v1.0:** v1.0 proposed a single generic `EntityVersion.content` JSON blob for every content type. That is kept only as the *shared mechanism for versioning and approval state* — not as the primary storage shape for structured, frequently-queried, or reportable content. Talent, images, socials, SEO, and legal pages get dedicated normalized tables. The generic JSON-blob path is retained only for content that is genuinely free-form and low-query-need (e.g. the legal page body sections, which are arrays of heading/paragraph objects with no need for cross-record filtering).

Rationale: a pure JSON-blob model makes it impossible to, e.g., query "all talents with a missing English bio," report follower counts across the roster, filter by category, or validate a gallery image's crop fields against a schema — all reasonable asks for a talent agency admin. Normalized tables get this for free; a blob does not.

### 3.1 Shared versioning primitives

`Entity` — one row per editable "thing," keyed by `entityType` + `entityId` (nullable/constant `entityId` for singletons like `SiteContent`). Holds a pointer to its current published version/record and its current lifecycle `status` (Section 5).

`EntityVersion` — used for content types that don't warrant their own dedicated version table (legal page sections, agency-level social links, collaborations list). One row per snapshot, `content` JSON, `status` (`published` / `proposed` / `rejected` / `superseded`), `createdBy`, `createdAt`, `approvedBy`, `approvedAt`, `basedOnVersionId` (see Section 6 for its role in conflict detection).

`ProposalAuditLog` — see Section 4, expanded substantially in v1.1.

### 3.2 Dedicated normalized models

`Talent` — the stable record: `id`, `slug`, `status` (Section 5), `currentPublishedVersionId`, `createdAt`, `updatedAt`. Slug and id are stable across versions so URLs and foreign keys never need to change when content changes.

`TalentVersion` — one row per proposed/published snapshot of a talent's field set: `name`, `nameEn`, `category[]`, `tags[]`, `featured`, `featuredOrder`, `sortOrder`, `location`, `locationEn`, `birthDate`, `bioHe`, `bioEn`, `status` (`published`/`proposed`/`rejected`/`superseded`), `basedOnVersionId`, `createdBy`, `createdAt`, `approvedBy`, `approvedAt`. This mirrors the field reference already documented in `data/talent/index.js`, so the mapping at Migration Day is close to 1:1.

`TalentSocial` — one row per platform per talent: `talentId`, `platform` (`instagram`/`tiktok`/`youtube`), `url`, `followerCount` (internal-only, matches the existing `followers` field which is explicitly not shown publicly), `status` (active/hidden/archived/deleted — Section 5), version metadata (`proposedValue`, `publishedValue`, or its own lightweight version row if socials turn out to change often enough to need full history — start with the simpler proposed/published pair and promote to full versioning only if needed).

`TalentGalleryImage` — one row per gallery image: `talentId`, `imageAssetId` (FK to `ImageAsset`), `order` (replaces the implicit array order in `data/talent/index.js`), `altHe`, `altEn`, `position` (crop, e.g. `'center 36%'`), `scale`, `mobileOrder`, `status`, plus the same published/proposed split as everything else. This directly generalizes the per-image overrides already present in the current data (`position`, `scale`, `galleryMobileOrder`).

`SiteContent` — normalized rows for the structured, repeatable parts of `site.js` that benefit from querying (nav links, category list, homepage copy blocks) rather than one giant blob. Each row: `section` (`nav`, `homepage`, `talentPage`, `contactPage`, ...), `key`, `valueHe`, `valueEn`, version/status fields. Free-form long-form sections (the About founder bio paragraphs, for instance) can stay as ordered text-block rows rather than full normalization — granularity is chosen per field based on whether it's ever filtered/reported on, not dogmatically.

`SEO` — one row per page/route: `entityType` + `entityId` (so a talent's SEO and a static page's SEO use the same table), `metaTitle`, `metaTitleEn`, `metaDescription`, `metaDescriptionEn`, `ogTitle`, `ogTitleEn`, `ogAlt`, `ogAltEn`, `canonicalPath`, version/status fields. Kept separate from `SiteContent`/`TalentVersion` specifically so SEO can be reviewed and reported on independently (e.g. "show me every page missing an English meta description") without parsing through unrelated content fields.

`LegalPage` — `slug` (`accessibility`, `privacy-policy`), `sections` (ordered JSON array of heading/paragraph/list blocks — this is the one place a JSON blob is still the right tool, since legal page structure is genuinely free-form and not queried field-by-field), version/status fields.

`ImageAsset` — the canonical record for every uploaded file regardless of where it's used: `id`, `blobUrl`, `width`, `height`, `mimeType`, `sizeBytes`, `uploadedBy`, `uploadedAt`, `status` (Section 5). Referenced by `TalentGalleryImage`, a talent's profile image field, the About founder photo, brand logos, etc. — never duplicated per use site. See Section 6 for how image *versions* (replacement, crop changes) are handled on top of this.

### 3.3 Why both `EntityVersion` and dedicated version tables coexist

Every dedicated table above still follows the same published/proposed/rejected/superseded status convention and the same `basedOnVersionId` pattern as generic `EntityVersion` rows — so the approval engine (Section 4), audit log (Section 4.1), and conflict detection (Section 6) are written once against that shared *shape*, not once per table. The difference is only storage: dedicated columns instead of a blob, for the content types where structure matters.

## 4. Approval model

**Decision (v1.1):** v1 ships whole-proposal approval only. The schema is built so field-level approval can be added later without a breaking migration.

How v1 works: a proposal is the full set of changed fields for one entity (e.g. one `TalentVersion` row plus its associated `TalentSocial`/`TalentGalleryImage` proposed rows). The Owner reviews the whole set and approves or rejects it as a unit. This matches the brief's "v1 simplicity" requirement and is enough to ship a usable admin quickly.

Why the schema doesn't block field-level approval later: because content is already normalized per Section 3 (separate rows for socials, separate rows for each gallery image, separate `SEO` row from `TalentVersion` row), "field-level" approval is largely already "row-level" approval at the data layer — the missing piece for true field-level (e.g. approve a bio edit but reject a sortOrder change within the *same* `TalentVersion`) is a `ProposalLineItem` join table that doesn't exist in v1 but can be added additively: `ProposalLineItem(proposalId, targetTable, targetRowId, fieldName, fromValue, toValue, decision)`. Until that table exists, a proposal's unit of approval is the row; once it exists, the UI can offer per-field checkboxes inside a proposal without changing how `Talent`, `TalentVersion`, etc. are structured. This is the concrete "evolves later" path the brief asked for.

Approval transaction (v1): the proposed row's status flips to `published`, the prior published row flips to `superseded`, and the parent (`Talent.currentPublishedVersionId` or equivalent) is repointed — atomically, so there is never a moment with zero or two published rows for the same entity. Rejection flips status to `rejected` with a required `rejectionNote`; nothing about the published pointer changes.

## 4.1 Audit log — expanded scope

**New in v1.1.** v1.0's `ProposalAuditLog` only tracked status transitions. That's insufficient for a real operational record, so `ProposalAuditLog` (or a renamed `AuditLog`, since its scope now extends beyond proposals to deletes/restores/logins) captures one row per action with:

`actionType` (`created`, `updated`, `proposed`, `approved`, `rejected`, `deleted`, `restored`, `archived`, `login`, `login_failed`), `entityType`, `entityId`, `targetVersionId` (which `TalentVersion`/`EntityVersion`/etc. row this action concerns, where applicable), `createdBy` / `updatedBy` / `approvedBy` / `rejectedBy` / `deletedBy` (only the field relevant to `actionType` is populated; all are nullable), `createdAt` (the log row's own timestamp — immutable, never edited), `ipAddress`, `userAgent` (raw string, parsed into device/browser at display time rather than at write time, so the raw value is always preserved even if parsing logic changes later), and `metadataBefore` / `metadataAfter` (JSON snapshots of the relevant fields immediately before and after the action, not the entire row — e.g. for an `approved` action, the proposed values that just became published). The log is append-only — no row is ever updated or deleted, including when the entity it refers to is later archived or soft-deleted, so history survives independent of the current state of the thing it describes.

This single table, queried by `entityType`+`entityId`, is what powers `/admin/history` (Section 2) and the per-proposal audit trail shown in `/admin/proposals/[id]`.

## 5. Soft delete / archive model

**New in v1.1.** Nothing important is hard-deleted. Every entity that can be removed from public view carries a `status` enum, applied consistently across `Talent`, `TalentSocial`, `TalentGalleryImage`, `ImageAsset`, and `SiteContent`:

- `active` — live/normal.
- `hidden` — exists, fully editable, intentionally excluded from public rendering (e.g. a talent the Owner wants off the roster temporarily without losing their profile).
- `archived` — retired, kept for record/reporting/export, not shown in default admin lists either (surfaced only in `/admin/trash` or an explicit "show archived" filter).
- `deleted` (soft) — marked for removal; retained in the database with a `deletedAt`/`deletedBy` pair for a recovery window, excluded from every default view including `/admin/trash`'s default filter (which defaults to `archived`), recoverable by an explicit "show deleted" toggle for some defined retention period before a separate, deliberate hard-delete process (out of scope for v1 — manual DB operation only, never exposed as a one-click admin action).

This status lives on the *entity* (`Talent`, `ImageAsset`, etc.), not on individual versions — a version's own `status` field (published/proposed/rejected/superseded) is a separate concern about approval state, while the entity's status is about visibility/lifecycle. A talent can be `active` with a `proposed` pending edit, or `hidden` with no pending edits at all; the two axes are independent.

## 6. Concurrent editing and conflict handling

**Decided in v1.2:** optimistic locking ships in v1, not deferred to Hardening. Even with a single Owner at launch, the Owner can plausibly have two browser tabs open on the same talent, or an Editor could be added before Hardening is reached — building this in from the start avoids a second pass through the data layer later. Given the possibility of more editors over time, the plan adopts optimistic concurrency rather than hard locking, since hard locks create their own UX problem (someone leaves a tab open and blocks everyone else indefinitely):

- Every version row (`TalentVersion`, etc.) carries the `basedOnVersionId` already introduced in Section 3, plus a simple incrementing `revisionNumber` on the parent entity (`Talent.revisionNumber`, bumped on every publish).
- When an editor opens an entity to propose a change, the client records the entity's current `revisionNumber`. On submit, the server compares that recorded number to the entity's live `revisionNumber`. If they still match, the proposal is created normally. If they don't match — meaning someone else published a change to this entity while the editor was working — the server rejects the naive save and returns a conflict response instead of silently overwriting anything.
- On conflict, the UI shows a clear resolution screen: the editor's in-progress changes, the version they originally started from, and the version that was actually published in the meantime — so the editor can re-base their edits on top of the new published version rather than lose work or silently clobber it. This is "warn when `basedOnVersionId` is stale" from the brief, made concrete.
- Editing locks are not used for v1 (added complexity, and the optimistic-concurrency path already prevents silent data loss), but the schema doesn't preclude adding a soft, time-boxed "currently being edited by X, last active at Y" indicator later purely as an informational UI hint — that needs no schema beyond a `lastEditedBy`/`lastEditedAt` pair on the entity, so it's cheap to add post-v1 if multiple editors make it worth doing.
- Two simultaneous *proposals* on the same entity (as opposed to one proposal racing a publish) are allowed to coexist in v1 — the proposals queue shows both, and approving one should prompt the Owner to explicitly decide what happens to the other (typically: reject it and ask the editor to redo it against the new published version), rather than the system silently picking a winner.

## 7. Live Preview — promoted to a core, planned capability

**Decision change from v1.0:** Live Preview is no longer "optional/later." The long-term target view for any editable entity is three-way: Current Published, Proposed Update, Live Preview — and the architecture is designed from day one to support this, even though the actual preview UI is still built in a later implementation phase (Section 9).

What makes this architecturally load-bearing now, not just a future nice-to-have: Live Preview must render the *real* public-facing components (e.g. the actual `ProfileHero`, `ProfileGallery`, `TalentRoster` components under `components/talent/`) fed with proposed data — not a separate mockup/preview-only component tree, since a mockup can drift from the real site and stops being trustworthy. That requirement constrains Section 3's data shapes now: every repository read (whether returning Current Published or Proposed Update data) must return objects shaped exactly like the props those components already expect from `data/talent/index.js` today. Practically: a `mapTalentVersionToPublicShape(talentVersion, socials, galleryImages)` function in the repository layer is part of the foundations phase, even though no preview route calls it until the Live Preview phase — this keeps the preview feature additive (a new route plus this already-tested mapping function) rather than a retrofit that touches the data layer again.

Preview route shape: `/admin/preview/talent/[id]` renders the real talent profile page tree with the Proposed Update's mapped data passed as props, alongside (not replacing) the Current Published render for comparison — likely as a tab or side-by-side toggle, finalized in the Live Preview phase's design pass, not now.

## 8. Migration Day strategy

Migration Day is the single moment the database becomes authoritative — scripted, reversible, dry-run-able, never manual. **v1.1 adds explicit, named checks (4 below) that were implicit in v1.0. Decided in v1.2: the trigger condition for Migration Day is "fully tested," not a calendar date** — concretely, Migration Day is not scheduled until the admin has been used in parallel with the live `data/*.js`-backed site for a deliberate trial period covering every content type in Section 3 (not just talent), all four verification checks below have been run at least once successfully against current production data, and the Owner has personally exercised the full propose → approve → (eventually) preview loop on a real edit for each content type. No fixed date is set in this document; the condition above is the gate, and whoever runs Migration Day re-runs the checks fresh immediately before step 4 regardless of how long the trial period ran.

1. Freeze content changes to `data/*.js` shortly before Migration Day.
2. Run an import script mapping every `data/*.js` record into the Section 3 normalized model (`Talent`+`TalentVersion`+`TalentSocial`+`TalentGalleryImage` per talent, `SiteContent` rows, `SEO` rows, `LegalPage` rows), inserted as `published` with no proposed counterpart — "the first Published Version" for every entity, mirroring current production exactly. Image references are copied as `ImageAsset` rows pointing at the existing `public/images/...` paths, not re-uploaded.
3. **Dry-run verification gate**, expanded in v1.1 to explicit named checks, all of which must pass before step 4:
   - **Structural/visual equivalence** — render the database-backed view of every page and diff it against the current `data/*.js`-rendered output (byte-for-byte or structurally).
   - **Bilingual parity check** — for every imported entity, assert every `*En` field that exists in `data/*.js` survived the import with the same value, and flag (don't silently drop) any field that was empty in source — this is a known existing condition (e.g. some talents may have partial English data) and the check's job is to make it visible, not to fix it.
   - **SEO and sitemap/robots data-source check** — `app/sitemap.js` and `app/robots.js` currently derive from `data/site.js` (and presumably the talent list, for per-talent URLs). These must be re-pointed to the repository layer in the *same* deploy as step 4, not left reading stale `data/*.js` after the rest of the site has switched — verify generated sitemap URLs and the SEO fields on every page match pre-migration output exactly.
   - **Image reference and crop-setting check** — verify every `profileImage`, `gallery[].src`, and the associated `position`/`scale`/`galleryMobileOrder` overrides resolved into `ImageAsset` + `TalentGalleryImage` rows render identical crops/positions to the current site, not just that the file paths resolved.
4. Only after all four checks pass, switch the public site's data-loading layer from `import ... from '@/data/...'` to the repository layer. One small, separately reviewable deploy.
5. **Rollback plan**, made explicit in v1.1: keep `data/*.js` in the repo (read-only, marked deprecated) for a defined minimum window (e.g. two full release cycles) rather than deleting it. Rollback is simply reverting the one data-source-switch deploy from step 4 — since steps 1–3 only ever read from `data/*.js` and wrote to the new database, nothing about `data/*.js` itself is ever mutated, so a rollback is risk-free with respect to data loss. The database content created in step 2 is not deleted on rollback either — it stays as a tested, ready import for whenever Migration Day is retried.
6. Decide in advance who can still write directly to `data/*.js` after Migration Day (recommendation: no one).

## 9. Implementation phases

**Updated in v1.1** to separate concerns the brief called out explicitly (auth/security as its own phase, normalized data model as its own phase before talent admin, image versioning as its own phase, live preview elevated but still sequenced after the approval core is proven):

1. **Foundations** *(done)* — database, ORM/migrations, repository-layer skeleton, the shared versioning primitives (`Entity`/`EntityVersion`, status/audit conventions from Sections 3–4), and the `mapTalentVersionToPublicShape`-style mapping functions that Live Preview will later depend on. Add the `/admin` rewrite passthrough to `next.config.mjs`. This phase also shipped the full Section 3 normalized data model (`Talent`, `TalentVersion`, `TalentSocial`, `TalentGalleryImage`, `SiteContent`, `SEO`, `LegalPage`, `ImageAsset`) up front rather than deferring it — **superseding this list's original phase-3 description below**, which is repurposed in v1.3 for the Core Content Engine instead. No UI yet.
2. **Auth/security** *(done)* — Owner login, session handling, `/admin/*` and `/api/admin/*` gating in `middleware.js`, environment-variable wiring for secrets (Section 11). Done before any real admin UI is built, not after, since every later phase assumes the admin is already access-controlled.
3. **Core Content Engine** *(architecture in Section 13, not yet implemented)* — the generic `ProposalService`/`VersionService`/`ApprovalService`/`PublishService`/`ConflictService`/`EventService`/`AuditService` layer plus the first adapter (Talent), the `Event` model (with its `payload`/`metadata`/`correlationId` split), the `DRAFT` version-status addition, and the Adapter Capabilities convention — all described in Section 13. This phase exists so that phases 4–5 below consume a proven generic engine instead of each building its own ad hoc propose/approve logic.
4. **Talent admin (read + propose)** — `/admin/talent` list and `/admin/talent/[id]` editor, built on top of the Phase 3 engine via the Talent adapter, producing proposed `TalentVersion`/`TalentSocial`/`TalentGalleryImage` rows; conflict-detection UI from Section 6 included here since it's intrinsic to "propose a change," not a later add-on.
5. **Approval queue** — `/admin/proposals`, diff rendering, approve/reject transactions via `ApprovalService`, the expanded audit log (Section 4.1, now a projection of the Event stream per Section 13.6). Validated thoroughly on talent before extending to other content types.
6. **Image upload/versioning** — blob storage integration, `ImageAsset` lifecycle, proposed-vs-published image comparison, crop/alt/order editing per Section 6's image-versioning model below.
7. **Remaining content types** — `SiteContent`, `SEO`, `LegalPage`, collaborations, agency socials — mostly UI, reusing the machinery already proven on talent.
8. **Live Preview** — `/admin/preview/talent/[id]` and equivalents for other entity types, built on the mapping functions seeded in phase 1.
9. **Hardening** — multi-editor roles if warranted by then, rate limiting, backup/restore drill, accessibility pass on the admin UI itself, trash/archive cleanup tooling.
10. **Migration Day** — Section 8 in full, including its four named verification checks, as a distinct scheduled phase after the admin has run in parallel with the live `data/*.js`-backed site for a meaningful stretch.

## 10. Image versioning (detail, referenced from Sections 3, 6, 9)

Images follow the same Current Published / Proposed Update approval model as text content, not a separate ad hoc path:

- **Replacement**: proposing a new profile image creates a new `ImageAsset` row (new upload) and a proposed pointer from the talent's profile-image field to it; the existing published `ImageAsset` is untouched and remains what the public site renders until the proposal is approved. On approval, the talent's published profile-image pointer repoints to the new asset; the old asset's status moves toward `archived` (not deleted — Section 5) so it remains available for rollback/history.
- **Gallery changes**: adding, removing, or reordering gallery images is modeled as proposed changes to the set of `TalentGalleryImage` rows (new rows for additions, status changes for removals, `order` field changes for reordering) tied to the same proposal as any other talent edit, so a gallery reorder and a bio edit can be reviewed together or separately depending on how they were batched by the editor.
- **Crop/alt/order edits without a new upload**: changing `position`, `scale`, `altHe`/`altEn`, or `order` on an existing `TalentGalleryImage` is a metadata-only proposed change — no new `ImageAsset` upload needed, but it still goes through the identical proposed → reviewed → approved pipeline, since a crop change can meaningfully alter how a photo reads (the existing data already shows crop overrides being treated as deliberate, reviewed decisions — e.g. the documented headroom-trimming adjustments in `data/talent/index.js`).
- **Removal**: removing an image from a gallery sets that `TalentGalleryImage` row's status to `archived` or `deleted` (Section 5) rather than deleting the row outright, preserving history and making "undo" trivial before the change is even published.

## 11. Security/auth considerations

The admin currently has zero auth in the codebase — greenfield. **Decided in v1.2:** a credentials-based session (NextAuth/Auth.js with a credentials provider, or a hand-rolled signed-session-cookie + bcrypt password) backed by a `User` table with `role` (`owner` | `editor`). Launch ships with exactly one `owner` user and no `editor` users provisioned — there is no Editor-facing UI distinction to build yet — but every authorization check in `/api/admin/*` routes is written against `role`, not against "is this the one Owner account," so adding an `editor` user later is a data change (insert a row, assign permissions) rather than a code change to the auth/permission logic. Where the two roles will differ once Editor exists: Owner can approve/reject proposals and manage users; Editor can only create/edit proposals. That split is designed now (Section 4's approval transaction is gated on `role === 'owner'`) even though only Owner exists at launch.

Non-negotiables, restated and unchanged from v1.0 per the brief's explicit re-confirmation: every `/admin` page and every `/api/admin/*` route must be gated server-side (in `middleware.js` and/or per-route checks) — an unauthenticated or unauthorized request must never reach admin data, and no admin API may rely on a client-supplied flag (e.g. an `isOwner` boolean from the browser) for authorization decisions. All secrets (session secret, database URL, blob storage token) live only in environment variables, following the existing `.env.local.example` convention already used for the contact form's `RESEND_API_KEY`/`CONTACT_EMAIL` — `.env.local.example` gets new placeholder entries documenting the required variable names, but no real value is ever committed, matching the existing file's pattern exactly. Rate-limit the login endpoint. Validate uploaded files server-side (type/size) and store them outside `public/`, so an unapproved upload can never be served as live site content.

## 12. Risks, edge cases, and things to avoid

Two simultaneous proposals on one entity: handled per Section 6 — both are visible in the queue, approving one prompts explicit handling of the other rather than a silent overwrite. Partial-approval scope creep: v1 deliberately ships whole-proposal approval only (Section 4); resist the temptation to half-build field-level approval before the `ProposalLineItem` path is actually needed. Image lifecycle bloat: archived/soft-deleted `ImageAsset` rows accumulate by design (Section 5) — plan a periodic reporting/cleanup process for genuinely stale assets even though nothing is auto-deleted. Locale parity: every bilingual field must be flagged, not silently allowed to ship incomplete (Section 8's bilingual parity check exists specifically because this was already an open risk in v1.0). Migration Day reversibility: never delete or overwrite `data/*.js` as part of the switch (Section 8). Schema drift during build-out: any manual edits made directly to `data/*.js` while the admin is built in parallel must be reconciled or re-imported before the final migration, or they're lost — worth a standing reminder to whoever still touches those files during the build-out window. SEO/sitemap source-switch risk: explicitly checked in Section 8's gate rather than assumed. Over-generalizing the data model: Section 3's normalized tables are scoped to this site's known content types; resist adding a generic visual schema builder or fully dynamic field system — that's scope creep beyond "admin panel for one agency's site." Hard-delete temptation: no admin-facing action should ever issue a real `DELETE` against `Talent`, `TalentVersion`, `ImageAsset`, etc. — only status transitions (Section 5); a genuine hard-delete, if ever needed, stays a manual, deliberate, logged operation outside the admin UI.

## 13. Phase 3 — Core Content Engine

**New in v1.3.** This section is the architecture and implementation plan for Phase 3, the generic engine that every future content type (Talent, Gallery, Images, SEO, Social links, Homepage, About, Contact, Legal pages, and later brands/campaigns/blog/contracts) builds on. **Planning only — nothing in this section has been implemented, and nothing in it changes the public site.** The public site keeps reading `data/*.js` exclusively until Migration Day (Section 8); this section does not touch `data/*.js`, does not switch any public data loading, does not build admin UI, and does not implement Migration Day.

### 13.1 Pipeline and scope: Content → Version → Proposal → Approval → Publish → Events

The engine's scope is renamed from "Proposal Engine" to the **Core Content Engine**, because its job spans the full lifecycle of a piece of content, not just the proposal step. The named pipeline is:

`Content` (the stable entity — `Talent`, a `SiteContent` row, a `Seo` row, a `LegalPage`) → `Version` (a snapshot, `DRAFT`/`PROPOSED`/`PUBLISHED`/`REJECTED`/`SUPERSEDED`) → `Proposal` (a version in `DRAFT` or `PROPOSED` state, not yet decided) → `Approval` (an Owner decision on a proposal) → `Publish` (the decided version becomes the live one, old one is superseded) → `Events` (every step along the way emits an `Event`, which is the substrate for the audit log, and later an activity feed, notifications, webhooks, and analytics).

This reframing changes nothing about the data already in `prisma/schema.prisma` (Section 3) — it is a naming and layering decision for the *services* that operate on that data, described below.

### 13.2 Layering and files

```
lib/admin/engine/
  proposalService.js       — create/update a DRAFT or PROPOSED version
  versionService.js        — read current published / proposed / draft versions, version history, getVersionForPreview()
  approvalService.js       — approve/reject a proposal (decision only — see 13.5)
  publishService.js        — flip a version to PUBLISHED, supersede the prior one, repoint the parent (the only thing that ever sets status = PUBLISHED)
  conflictService.js       — pure revision-comparison helper, used both at proposal-creation time (non-blocking) and inside publishService's transaction (authoritative)
  eventService.js          — emit(type, {...}) — the only way an Event row is created; calls registered listeners synchronously
  auditService.js          — read-side queries over the Event stream (Section 13.6) for /admin/history-style consumers
  eventTypes.js             — the catalog of valid event type strings (e.g. ProposalCreated, ProposalApproved, VersionPublished) — plain strings, not a Postgres enum, since this list is expected to grow continuously
  listeners/
    auditLogListener.js     — the one listener registered in Phase 3; turns each Event into an AuditLog row (Section 4.1) — the only writer of AuditLog rows
  adapters/
    adapterContract.js      — the shape every adapter must implement (13.10), plus the capabilities object shape (13.4)
    talentAdapter.js         — first real adapter, used to prove the contract
    siteContentAdapter.js    — stub, proves the contract generalizes beyond Talent
    seoAdapter.js             — stub
    legalPageAdapter.js       — stub
    entityAdapter.js          — generic adapter for the shared Entity/EntityVersion primitives (Section 3.1), parameterized per entityType
```

`prisma/schema.prisma` changes proposed for this phase (not yet applied): add an `Event` model (13.3.1) and add `DRAFT` to the `VersionStatus` enum (purely additive — no migration of existing rows, since no row uses it yet).

No route handlers, no admin pages, and no edits to `data/*.js` are part of this phase.

### 13.3 Proposal design

A proposal is just a version row in `DRAFT` or `PROPOSED` status, created via `proposalService.create(adapter, { parentId, fields, actorId, basedOnVersionId, basedOnRevisionNumber, correlationId })`. `DRAFT` (new in v1.3) represents a proposal the author is still working on and hasn't submitted for review; `proposalService.submit(proposalId)` flips `DRAFT` → `PROPOSED`, which is the point a proposal becomes visible to the approval queue. This split lets an editor save partial work without it appearing as "pending Owner review."

#### 13.3.1 Event shape

```
Event
  id            String  @id @default(cuid())
  type          String                // validated against eventTypes.js, not a DB enum
  entityType    EntityType
  entityId      String
  actorId       String?               // null for system-generated events
  correlationId String                // dedicated, indexed column — see 13.6
  payload       Json                  // business data only
  metadata      Json                  // technical/request context only
  createdAt     DateTime @default(now())

  @@index([entityType, entityId])
  @@index([correlationId])
```

### 13.4 Adapter Capabilities

**New in v1.3.** Every adapter declares a `capabilities` object so generic services and any future UI can ask "does this content type support X" instead of an entity-specific `if` statement appearing anywhere in `lib/admin/engine/`:

```
capabilities: {
  supportsPreview:    boolean,  // can adapter.mapToPublicShape() feed Live Preview (Section 7)?
  supportsScheduling: boolean,  // can publish be deferred to a future timestamp?
  supportsSEO:        boolean,  // does this content type carry its own SEO fields?
  supportsGallery:    boolean,  // does it have an associated image collection?
  supportsSoftDelete: boolean,  // does Section 5's status enum apply to this entity?
  supportsPublishing: boolean,  // can it be published at all, or is it read-only/system-managed?
  supportsArchive:    boolean,  // can it move to `archived` (Section 5), independent of soft-delete?
}
```

Starting values, to be confirmed when each adapter is actually written:

- `talentAdapter`: preview ✓, scheduling ✗ (v1), SEO ✗ (SEO is its own adapter/table), gallery ✓, softDelete ✓, publishing ✓, archive ✓.
- `siteContentAdapter`: preview ✓, scheduling ✗, SEO ✗, gallery ✗, softDelete ✗ (rows aren't independently soft-deletable today), publishing ✓, archive ✗.
- `seoAdapter`: preview ✗ (SEO fields aren't independently rendered — they describe someone else's page), scheduling ✗, SEO ✓ (trivially), gallery ✗, softDelete ✗, publishing ✓, archive ✗.
- `legalPageAdapter`: preview ✓, scheduling ✗, SEO ✗, gallery ✗, softDelete ✗, publishing ✓, archive ✗.
- `entityAdapter` (generic): capabilities are declared per `entityType` instantiation, not fixed for the whole adapter file.

A capability flag describes what the adapter *claims* to support; the adapter itself must still enforce it server-side (e.g. `publishService` calling `conflictService` regardless of what a capability flag says) — capabilities are a routing/UI convenience, not a substitute for validation (also noted as a risk in 13.13).

### 13.5 Approval and Publish: kept as two services, composed together in v1

**Reaffirmed in v1.3 per explicit instruction.** `approvalService` and `publishService` are separate files/objects, not one merged "approve-and-publish" function, even though v1's behavior is: `approvalService.approve()` sets `approvedAt`/`approvedById` on the proposal, then calls `publishService.publish()` in the same database transaction, so approving a v1 proposal is published immediately.

This separation is what lets the same two services support, without rewriting either one, three flows not built in v1 but anticipated:

- **Approve now, publish later** — `approvalService.approve()` runs alone; a separate, later, explicit action calls `publishService.publish()`.
- **Scheduled publishing** — approval sets a `publishAt` timestamp instead of calling publish; a future scheduled job calls `publishService.publish()` when due.
- **Manual publish after approval** — identical data path to the above, just triggered by a "Publish now" UI action rather than a schedule.

To make this composable without a schema branch today: `publishService.publish()` remains the *only* code path that ever sets a version's status to `PUBLISHED`. "Approved but not yet published" needs no new `VersionStatus` value — it's represented as `status = PROPOSED` with `approvedAt`/`approvedById` already set, and publish is a distinct, idempotent later step. This is recorded here as the decided approach, closing what would otherwise be an open question.

### 13.6 Event architecture: correlationId, payload vs metadata

**New in v1.3.** `eventService.emit(type, { entityType, entityId, actorId, correlationId, payload, metadata })` is the only way an `Event` row is created. Two splits, both requested explicitly:

- **`correlationId`** is a dedicated, indexed, top-level column (13.3.1), not buried inside `metadata` — so every event produced by one user action or transaction (e.g. a single proposal submission that emits both `ProposalCreated` and `ProposalUpdated`) can be queried and grouped directly, without unpacking JSON. Engine service calls accept an optional `correlationId` and generate a fresh one if none is supplied, so even an isolated single-service call (a test script, a one-off admin action) produces a valid, queryable id. Whether `correlationId` is generated once per HTTP request (via an explicit param threaded through service calls, or `AsyncLocalStorage`) is a Phase 4+ decision, deferred until route handlers actually exist — explicit param-passing is the simpler, more testable default unless it proves unwieldy.
- **`payload`** is business data only — the fields that changed, the entity affected, before/after values relevant to the action itself.
- **`metadata`** is technical/request context only — IP address, user agent, request id, duration, and (contextually) the same `correlationId` already present as its own column. Keeping `metadata` strictly technical means a consumer (the audit log, a future webhook) can always trust that `payload` alone describes "what happened," without filtering out request plumbing first.

### 13.7 Audit log as a projection of the Event stream

`AuditLog` (Section 4.1) is not written to directly by any engine service. `auditLogListener.js` is registered with `eventService` and is the only thing that ever inserts an `AuditLog` row, built from whichever `Event` triggered it. This avoids a dual-write bug (an engine service forgetting to write the audit row, or writing one that disagrees with the Event it should correspond to) and means the audit log can be regenerated/backfilled later by replaying the Event stream if the listener's mapping logic changes.

### 13.8 Conflict resolution

Unchanged from Section 6's design, formalized as `conflictService.checkRevision(adapter, { parentId, basedOnRevisionNumber })`, a pure comparison with no side effects, returning `{ conflict: false }` or a structured conflict result. Called twice: early and non-blocking when a proposal is created (so the UI can warn immediately), and again, authoritatively and blocking, inside `publishService.publish()`'s own transaction — the early check is a UX convenience, the in-transaction check is the one that actually prevents a lost update, since only the in-transaction read is guaranteed not to race another publish.

### 13.9 Generic services vs entity-specific adapters

Everything in `lib/admin/engine/*.js` (13.2) is free of any entity name or type check. All entity-specific logic — field validation, the capabilities object (13.4), and the mapping between DB rows and the adapter contract — lives only in `lib/admin/engine/adapters/*.js`. A future content type (brands, campaigns, blog posts, contracts) is "plugged in" by writing one new adapter file that implements the fixed contract (13.10); no engine service file is ever edited to add a new content type.

### 13.10 Adapter contract

Every adapter implements: `getParent(id)`, `getVersion(versionId)`, `listVersionsForParent(parentId)`, `insertProposedVersion(fields, meta)`, `validate(fields)`, `mapToPublicShape(version, related)` (used by Live Preview, Section 7 — only meaningful where `capabilities.supportsPreview` is true), and the static `capabilities` object (13.4).

### 13.11 Live Preview preparation

Unchanged in substance from Section 7: `versionService.getVersionForPreview(adapter, versionId)` calls `adapter.mapToPublicShape()`, reusing the same mapping functions seeded in Phase 1 Foundations (`mapTalentVersionToPublicShape` and friends). New in v1.3: `getVersionForPreview` first checks `adapter.capabilities.supportsPreview` and short-circuits cleanly (rather than every caller needing to separately know which entities support preview) if false.

### 13.12 How future entities plug in

A new content type (e.g. `Brand`) gets: a normalized table (if it warrants one, per Section 3.3's rationale) or use of the generic `Entity`/`EntityVersion` pair; one adapter file implementing the 13.10 contract and declaring its `capabilities`; and nothing else — no changes to `proposalService`, `approvalService`, `publishService`, `conflictService`, `eventService`, or `auditService`. The same `eventTypes.js` catalog gains a few new entries (e.g. `BrandUpdated`) but the `Event` model and `eventService.emit()` mechanism are unchanged.

### 13.13 Risks and edge cases specific to the engine

A capability flag that the adapter doesn't actually enforce server-side is worse than no flag at all — it would let a generic UI assume a guarantee the backend doesn't provide; every capability claim must be backed by real validation in the adapter. `correlationId` generation strategy (explicit param vs `AsyncLocalStorage`) needs to be picked before route handlers are built in Phase 4, or different parts of one request could end up with inconsistent ids. `eventTypes.js` growing unboundedly without naming discipline (e.g. `ProposalUpdated` vs `TalentProposalUpdated` for the same conceptual event) would make the catalog hard to query against later — a naming convention (`<Entity><Action>` or `<Action>` for cross-entity events) should be fixed when the first few real event types are added, not left ad hoc. The `auditLogListener` being the *only* writer of `AuditLog` means a bug or exception inside the listener silently breaks the audit trail unless `eventService.emit()` treats listener failures as loud, logged errors rather than swallowing them — listener failure handling needs to be explicit in implementation, not assumed safe by default. Approve-now/publish-later and scheduled publishing both imply a window where a version is `PROPOSED` + `approvedAt` set but not yet live — any future UI must render that state distinctly from a not-yet-decided proposal, or Owners will be confused about why an "approved" change isn't on the site yet.

### 13.14 Implementation sub-phases (within Phase 3)

1. Add the `Event` model and `DRAFT` `VersionStatus` value to `prisma/schema.prisma`; migrate (additive only).
2. Build `eventService.js` + `eventTypes.js` + the `auditLogListener`; prove `AuditLog` rows are correctly derived for at least one event type before building anything else.
3. Build `conflictService.js` as a pure function, unit-testable without a database transaction.
4. Build `adapterContract.js` and `talentAdapter.js` (with its `capabilities` object), since Talent is the most fully fleshed-out model in Section 3.
5. Build `versionService.js` and `proposalService.js` against the Talent adapter.
6. Build `approvalService.js` and `publishService.js` as separate files, wired so `approve()` calls `publish()` in the same transaction for v1, per 13.5.
7. Add `siteContentAdapter.js`, `seoAdapter.js`, `legalPageAdapter.js` as stubs that implement the contract minimally, to prove the abstraction generalizes before any of their UIs are built (Phase 7).
8. Write `versionService.getVersionForPreview()` against `talentAdapter.mapToPublicShape()`, with no preview route yet — proves the Live Preview data path (Section 7) end-to-end at the service layer.

### 13.15 Architecture layers

**New in v1.4.** Five mandatory layers, in strict order:

```
Presentation Layer        (app/admin/**, app/api/admin/** route handlers)
        ↓
Core Content Engine       (lib/admin/engine/** — Section 13.2)
        ↓
Repositories               (lib/admin/repository/** — Section 1)
        ↓
Prisma                     (prisma/schema.prisma, the generated client)
        ↓
Database                   (Postgres)
```

Dependency rules, binding on all implementation from Phase 3 onward:

- A layer may only call directly into the layer immediately below it. Presentation never calls a repository directly, and never imports `@prisma/client` itself — it goes through the Core Content Engine, which goes through repositories, which go through Prisma. Skipping a layer (e.g. a route handler running a Prisma query inline "just this once") is a violation, not a shortcut, regardless of how small the query is.
- Dependencies point downward only. Repositories never import from `lib/admin/engine/`; the engine never imports from `app/admin/` or `app/api/admin/`. A lower layer must remain usable (and testable) with no knowledge that any particular upper layer exists.
- The Core Content Engine is the only layer permitted to contain business logic (proposal/approval/publish/conflict/event rules — Section 13.16's "services own business logic"). Repositories are a thin data-access layer over Prisma — query construction and shape-mapping only, no approval/publish/version-transition decisions. Presentation is rendering and request/response handling only — no business rules, no direct database access of any kind.
- This layering applies uniformly to every content type, current and future — there is no "small entity" exception that gets to skip the engine or repository layer because its CRUD looks trivial.

### 13.16 Design principles

**New in v1.4.** These are the platform's core philosophy — they apply beyond Phase 3, to every phase and every future content type:

- **Generic before specific.** Default to a generic, reusable solution in the engine; entity-specific code is the exception, confined to adapters, never the default approach.
- **Composition over duplication.** New behavior is built by composing existing services (e.g. Section 13.5's approve-then-publish composition) rather than copy-pasting a service and modifying the copy for one entity.
- **Version everything.** Every piece of editable content has a version history (Section 3); nothing is edited in place with no record of what it looked like before.
- **Events are append-only.** No `Event` row is ever updated or deleted after being written (consistent with `AuditLog`'s append-only rule in Section 4.1) — corrections are new events, not edits to old ones.
- **Never delete business history.** No hard deletes of business data (Talent, versions, proposals, images, audit/event rows) from any admin-facing action — only status transitions (Section 5), consistent with Section 12's "hard-delete temptation" risk.
- **Public website remains isolated until Migration Day.** Every phase, including all of Phase 3, leaves `data/*.js` and the public data-loading path untouched; the database is shadow infrastructure until the single, deliberate switch in Section 8.
- **Services own business logic.** `proposalService`, `approvalService`, `publishService`, `conflictService`, `eventService`, and `auditService` are where lifecycle rules and decisions live (Section 13.9) — not in adapters, not in repositories, not in routes.
- **Adapters own translation only.** An adapter's job is shape translation between the engine's generic contract (Section 13.10) and a specific entity's storage shape (or its public-facing shape, for preview) — never a decision about whether something is allowed to publish, conflict, or be approved. If an adapter starts making a business decision, that logic belongs in a service instead.

### 13.17 Phase 3 success criteria

**New in v1.4.** Phase 3 is complete only when all of the following are true — this replaces any date-based notion of "done" for this phase, consistent with how Migration Day's own gate (Section 8) is condition-based, not calendar-based:

1. The full proposal lifecycle works end-to-end (`DRAFT` → `PROPOSED`, Section 13.3) against at least one real adapter.
2. Approval works — `approvalService.approve()` records a decision and is independently testable from publish (Section 13.5).
3. Publish works — `publishService.publish()` is the only code path that sets `PUBLISHED`, supersedes the prior version, and repoints the parent, inside one transaction (Sections 4, 13.5).
4. Version history works — `versionService` can list every version (published, proposed, rejected, superseded, draft) for a given parent, in order.
5. Events are emitted for every lifecycle action (proposal created/updated, approved, rejected, published) via `eventService.emit()`, never written ad hoc (Section 13.6).
6. `AuditLog` rows are generated from the Event stream by `auditLogListener`, never written directly by any other code path (Section 13.7).
7. The engine (`lib/admin/engine/*.js`, excluding `adapters/`) contains no entity-specific branching — no `if (entityType === 'TALENT')` or equivalent anywhere outside an adapter file (Section 13.9).
8. At least two different adapters (e.g. `talentAdapter` and one of `siteContentAdapter`/`seoAdapter`/`legalPageAdapter`) exercise the full lifecycle above through the same, unmodified engine services — proving genericness empirically, not just by design intent.

Until all eight are demonstrably true (ideally backed by tests, not just manual spot-checks), Phase 3 is not considered complete and Phase 4 (Talent admin UI) should not begin building against the engine as if it were stable.

### 13.18 Architectural guardrails

**New in v1.4.** Prohibited patterns, binding from Phase 3 onward — these are the enforceable, specific form of Sections 13.15–13.16's layering and principles:

- No business logic inside route handlers (`app/api/admin/**`). A route parses the request, calls into the Core Content Engine, and shapes the response — nothing else.
- No repository access from Presentation. UI code and route handlers never import `lib/admin/repository/*.js` directly; they only ever go through the engine.
- No entity-specific branching inside engine services. Any `if`/`switch` on entity type or adapter identity inside `lib/admin/engine/*.js` (outside `adapters/`) is a defect, not a style nit — the fix is always to push the distinction into the adapter's contract (capabilities, Section 13.4) or its data, never into the service.
- No direct `AuditLog` writes outside `auditService`/`auditLogListener`. Every `AuditLog` row originates from the Event stream (Section 13.7) — nothing else is permitted to `INSERT` into that table.
- No `Event` writes outside `eventService`. `eventService.emit()` is the sole entry point that creates `Event` rows; no service, adapter, or route is permitted to write one directly.
- No bypassing the Proposal/Approval flow. There is no code path that mutates a published version's content without first going through `proposalService` → `approvalService` → `publishService` — including for "trivial" or "obviously safe" edits.
- No coupling to the public website before Migration Day. Nothing in the Core Content Engine, repositories, or Prisma schema may be imported by, or change the behavior of, any file under `app/[locale]/**` or `data/*.js` until the single Section 8 switch — Phase 3 work must remain provably inert from the public site's perspective.

## 14. Open questions before implementation

**Resolved in v1.2** (kept here for traceability, no longer open): Owner-only at launch with Editor-ready schema (Section 11); Postgres + Prisma as the stack (Section 1); optimistic locking ships in v1, not deferred (Section 6); Migration Day is gated on "fully tested in parallel," not a calendar date (Section 8).

**Resolved in v1.3** (kept here for traceability): "Proposal Engine" is renamed Core Content Engine, framed as Content → Version → Proposal → Approval → Publish → Events (Section 13.1); Approval and Publish stay separate services with v1 composing them in one transaction (Section 13.5); every Event gets a dedicated `correlationId` column plus a `payload`/`metadata` split (Section 13.6); adapters declare a `capabilities` object (Section 13.4).

Still open from v1.2: which managed Postgres host specifically (Vercel Postgres / Neon / Supabase) — the engine is decided, the host isn't. Is the v1 whole-proposal-approval decision acceptable as final for launch, or is there a specific field (e.g. images) where partial approval is needed sooner than the general `ProposalLineItem` mechanism described in Section 4? What retention window should soft-deleted items sit in before they're eligible for a manual hard-delete (Section 5)? Should the Owner receive proposal-submitted notifications (email/Slack), or is checking `/admin/proposals` manually sufficient for now? Are there image size/format constraints to enforce on upload, matching the `next/image` AVIF/WebP formats already configured in `next.config.mjs`? Concretely, what does "fully tested" mean as a checklist for Migration Day's trigger condition (Section 8) — is the criteria described there (every content type exercised, all four verification checks passed, Owner has run the full loop once per type) sufficient, or should it be stricter (e.g. a minimum number of real-world edit cycles, a minimum elapsed time)? Should `/admin` live on the same deployment as the public site (simplest, per Section 1), or does anything argue for splitting it out?

New from v1.3 (Section 13): should `correlationId` generation use an explicit threaded parameter or `AsyncLocalStorage` once route handlers exist (13.6, 13.13)? What naming convention should `eventTypes.js` follow as it grows (`<Entity><Action>` vs free-form) — needs to be fixed early, not after a dozen ad hoc names exist (13.13)? Should listener failures inside `eventService.emit()` ever block the triggering action (e.g. should a broken `auditLogListener` be allowed to fail a publish), or should listener errors always be logged-and-swallowed so a derived-data bug never blocks the primary action (13.13)? When "approve now, publish later" is eventually built, does the UI need a distinct visible state for "approved, awaiting publish," or is that fully out of scope until that flow is actually implemented?
