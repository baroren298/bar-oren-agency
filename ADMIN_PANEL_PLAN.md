# Bar Oren Talent Agency — Admin Panel Architecture v1.2

Branch: `feature/admin-panel`. Status: planning only, no implementation yet. Supersedes v1.1; changes are tracked inline where a decision was revised.

**Decisions locked in v1.2** (previously open questions, now settled): the admin launches Owner-only, with the schema already supporting an Editor role so adding one later needs no migration; the stack is Postgres + Prisma, not a multi-option recommendation; optimistic locking ships in v1 from the start rather than being deferred to Hardening; Migration Day happens only after the admin has been fully tested running in parallel with the live `data/*.js`-backed site — no fixed calendar date, the trigger is "tested," not "scheduled."

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

1. **Foundations** — database, ORM/migrations, repository-layer skeleton, the shared versioning primitives (`Entity`/`EntityVersion`, status/audit conventions from Sections 3–4), and the `mapTalentVersionToPublicShape`-style mapping functions that Live Preview will later depend on. Add the `/admin` rewrite passthrough to `next.config.mjs`. No UI yet.
2. **Auth/security** — Owner login, session handling, `/admin/*` and `/api/admin/*` gating in `middleware.js`, environment-variable wiring for secrets (Section 10). Done before any real admin UI is built, not after, since every later phase assumes the admin is already access-controlled.
3. **Normalized data model** — `Talent`, `TalentVersion`, `TalentSocial`, `TalentGalleryImage`, `SiteContent`, `SEO`, `LegalPage`, `ImageAsset` tables and their repositories, plus the soft-delete/status enum (Section 5) and the optimistic-concurrency fields (Section 6) from the start, since retrofitting `revisionNumber`/`basedOnVersionId` onto live tables later is more disruptive than including them now.
4. **Talent admin (read + propose)** — `/admin/talent` list and `/admin/talent/[id]` editor producing proposed `TalentVersion`/`TalentSocial`/`TalentGalleryImage` rows; conflict-detection UI from Section 6 included here since it's intrinsic to "propose a change," not a later add-on.
5. **Approval queue** — `/admin/proposals`, diff rendering, approve/reject transactions, the expanded audit log (Section 4.1). Validated thoroughly on talent before extending to other content types.
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

## 13. Open questions before implementation

**Resolved in v1.2** (kept here for traceability, no longer open): Owner-only at launch with Editor-ready schema (Section 11); Postgres + Prisma as the stack (Section 1); optimistic locking ships in v1, not deferred (Section 6); Migration Day is gated on "fully tested in parallel," not a calendar date (Section 8).

Still open: which managed Postgres host specifically (Vercel Postgres / Neon / Supabase) — the engine is decided, the host isn't. Is the v1 whole-proposal-approval decision acceptable as final for launch, or is there a specific field (e.g. images) where partial approval is needed sooner than the general `ProposalLineItem` mechanism described in Section 4? What retention window should soft-deleted items sit in before they're eligible for a manual hard-delete (Section 5)? Should the Owner receive proposal-submitted notifications (email/Slack), or is checking `/admin/proposals` manually sufficient for now? Are there image size/format constraints to enforce on upload, matching the `next/image` AVIF/WebP formats already configured in `next.config.mjs`? Concretely, what does "fully tested" mean as a checklist for Migration Day's trigger condition (Section 8) — is the criteria described there (every content type exercised, all four verification checks passed, Owner has run the full loop once per type) sufficient, or should it be stricter (e.g. a minimum number of real-world edit cycles, a minimum elapsed time)? Should `/admin` live on the same deployment as the public site (simplest, per Section 1), or does anything argue for splitting it out?
