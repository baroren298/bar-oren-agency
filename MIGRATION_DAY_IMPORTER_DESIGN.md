# Migration Day Importer — Design (no implementation yet)

Status: **design only**. Nothing in this document has been built. No Git commands were run to produce it, no `.env*` file was read or modified, no data was imported, and no file under `app/[locale]/**` or `data/*.js` was changed. This is the design pass referenced by `ADMIN_PANEL_PLAN.md` Section 8, step 2, written against the schema that now exists in `prisma/schema.prisma` (podcast fields on `TalentVersion`, fully versioned `TalentSocial`).

**Revision note:** this version replaces the original "skip if exists, forever" idempotency model with a reusable, multi-mode tool (`dry-run` / `create` / `sync` / `reset`), per explicit feedback that a one-shot, permanently-skip-existing importer would make it hard to fix importer bugs or correct mapping mistakes after the first run. See Section 3 for the full mode design; every other section has been updated to stay consistent with it.

---

## 1. Script file: where it lives and how it's run

**File:** `scripts/migrate-day-import.mjs`

Same folder and style as the two existing scripts (`scripts/create-owner.mjs`, `scripts/seed-dev-talent.mjs`):

- Plain `.mjs`, not importing `lib/admin/*` directly — the project has no `"type": "module"` in `package.json`, so `lib/admin/*` (which uses `import`/`export`) can't be loaded by a bare Node script the way `@prisma/client` can. Any shared logic the importer needs from `lib/admin/*` gets duplicated locally in the script (small surface: enum string values) rather than changing the project's module config for one script.
- Reads `data/talent/index.js`, `data/site.js`, `data/collaborations.js` directly via dynamic `import()` (these *are* ES modules, so a relative `import()` from a `.mjs` file works even without the project-wide flag).
- Guards mirroring `seed-dev-talent.mjs`: refuses to run if `DATABASE_URL` is unset, refuses to run if no Owner `User` row exists (every created/approved row needs `createdById`). The `NODE_ENV=production` guard from the original design is now mode-specific — see Section 3 (`reset` is blocked in production outright; `create`/`sync` are allowed in production but always default to a dry preview first, per Section 1's CLI design below).
- `package.json` gets one new script entry: `"admin:migrate-day-import": "node scripts/migrate-day-import.mjs"`. Not referenced anywhere else — no route, no middleware, no build step — same isolation discipline as the existing two scripts.

### CLI surface

```
node scripts/migrate-day-import.mjs [--mode=dry-run|create|sync|reset] [--commit] [--owner-email=<email>] [--report-path=<file>] [--confirm-production] [--confirm-reset]
```

- `--mode` selects the behavior (Section 3). **Default: `dry-run`.** Running the script with no flags at all is always safe — it reads and validates everything and writes nothing.
- `--commit` is required, *in addition to* `--mode=create|sync|reset`, before anything is written. `--mode=create` (or `sync`, or `reset`) **without** `--commit` still only previews — it computes and prints exactly what that mode *would* do (creates/updates/deletes, itemized) without touching the database. This means there is no way to accidentally write data with a single flag — two independent, explicit flags must both be set. (`--mode=dry-run` ignores `--commit` entirely; it never writes, by definition.)
- `--owner-email=<email>` — attributes every created/approved row to this `User`; defaults to the single seeded Owner if exactly one exists, errors out if zero or more than one exist and none was specified.
- `--report-path=<file>` — also writes the end-of-run report (Section 9) as JSON, in addition to stdout.
- `--confirm-production` — required (on top of everything else) if `DATABASE_URL` resolves to a host the script doesn't recognize as a known local/dev/staging pattern, for `create` and `sync`. This is a heuristic safety net, not a hard guarantee (see Risks), but it stops the most common accident: running the script against the wrong `DATABASE_URL` without realizing it.
- `--confirm-reset` — required, on top of `--mode=reset --commit`, for the `reset` mode specifically (Section 3.4). `reset` additionally refuses to run at all if `NODE_ENV=production`, with no override — there is no flag combination that makes `reset` run against a production `NODE_ENV`.

A companion file, `scripts/migrate-day-import.report.md` (or `.json`), is not part of the script itself — it's the output artifact the report in Section 9 gets written to, so a human can review it without re-running anything.

A second companion file, `scripts/.migration-day-import.manifest.json` (git-ignored), is written by `create` and `sync` whenever they run with `--commit`. It is the bookkeeping `reset` mode reads to know exactly which rows this tool is responsible for — see Section 3.4.

## 2. Reading the existing data sources

| Source | What's read | Notes |
|---|---|---|
| `data/talent/index.js` | `talentList` array — one object per talent (`slug`, `name`/`nameEn`, `category`, `tags`, `featured`/`featuredOrder`/`sortOrder`, `location`/`locationEn`, `birthDate`, `profileImage` + `imagePosition`/`profileImageScale` overrides, `gallery[]` (string or `{src, position, scale}`), `galleryMobileOrder[]`, `bioHe`/`bioEn`, `instagram`/`tiktok`/`youtube`, `extraSocials[]`, `followers{}`, optional `podcast{}`) | This is the primary, highest-cardinality source. Imported via `import { talentList } from '../data/talent/index.js'`. |
| `data/site.js` | Whatever structured nav/homepage/page-copy fields exist | Out of scope for *this* importer's first pass per the task (talent-focused); noted here only so the script's module boundary is clear — a separate `SiteContent` import pass is a distinct, smaller script reusing the same connection/report pattern, not bolted onto this one. |
| `data/collaborations.js` | `collaborations` array of brand-name strings | Currently all 8 entries are literal placeholder text `'BRAND NAME'` — see Section 8. |
| `public/images/**` | Not read as data — used to **verify** that every path referenced by `data/talent/index.js` actually exists on disk before creating an `ImageAsset` row for it | Walked via `fs.existsSync` per resolved path, not globbed wholesale; the importer never invents `ImageAsset` rows for files that aren't referenced from `data/talent/index.js`, even if they sit in `public/images/talent/<slug>/`. |

Talent image paths in `data/talent/index.js` are root-relative (e.g. `/images/talent/kim-chorilov/profile.jpg`); the importer resolves them against `public/` (`path.join(process.cwd(), 'public', profileImage)`) to check existence, but stores the **original root-relative path** as `ImageAsset.blobUrl` — Section 8's import step is explicit that "image references are copied as `ImageAsset` rows pointing at the existing `public/images/...` paths, not re-uploaded," so `blobUrl` here is a path string, not a real blob-storage URL yet. (When the agency later moves to real blob storage, `blobUrl` values get updated in place — that's a separate, future migration, not part of this one.)

## 3. Operating modes — the core of this revision

The importer is designed as a **reusable tool with four explicit modes**, not a one-shot script that silently no-ops on every run after the first. All four modes read and validate the exact same source data (Section 2) through the exact same mapping logic (Sections 4–8) — only what happens with the *result* of that mapping differs.

### 3.1 `dry-run` (default)

Reads every source file, runs the full mapping logic, diffs the result against whatever currently exists in the database (same diff engine `sync` uses — see 3.3), and prints the report (Section 9) showing exactly what would be created, updated, archived, and skipped. **Writes nothing, ever, regardless of other flags.** This is the safe default specifically so that running the script with no arguments — or experimenting with flags while learning the tool — can never mutate data.

### 3.2 `create`

Creates rows that don't yet exist (new talents, new image assets, new social rows, new gallery rows). **Never modifies or overwrites a row that already exists** — if a `Talent` with a given `slug` is already present, `create` mode leaves that talent's `Talent`/`TalentVersion`/`TalentSocial`/`TalentGalleryImage` rows completely untouched, even if the corresponding source object in `data/talent/index.js` has since changed. This is the direct equivalent of the original design's "skip if exists" behavior — kept, but now named and scoped as one mode among several rather than the *only* behavior, so reaching for "actually update the existing rows" doesn't require changing the importer itself — it just means running it in `sync` mode instead.

Use case: the first-ever run (nothing exists yet, so `create` and `sync` behave identically that first time), or any later run where the goal is specifically "pick up newly-added talents, leave everything else alone."

### 3.3 `sync` — makes the database match `data/*.js`, safely

This is the new mode that directly answers the feedback: a way to fix importer bugs or re-import corrected mappings without needing the original "fresh database" assumption.

**Diff-based, not destructive-by-default.** For every talent in `data/talent/index.js`, `sync` computes the same mapped shape `create` would produce, then compares it field-by-field against the talent's *current published* `TalentVersion` (and current `TalentSocial`/`TalentGalleryImage` rows). Three outcomes per talent:

- **No existing `Talent`** → behaves exactly like `create`: inserts a brand-new `Talent` + first `TalentVersion` (Section 5).
- **Existing `Talent`, mapped shape unchanged** → no write at all; reported as `unchanged`.
- **Existing `Talent`, mapped shape differs** → creates a **new** `TalentVersion` row (`status: PUBLISHED`, `basedOnVersionId` = the previous published version's id, `createdById`/`approvedById` = the running Owner), then:
  - sets the previous `TalentVersion.status` to `SUPERSEDED`,
  - repoints `Talent.currentPublishedVersionId` at the new version,
  - bumps `Talent.revisionNumber`.

  This reuses the exact pattern `publishService` will eventually implement (`ADMIN_PANEL_PLAN.md` Section 13.5: "`publishService.publish()` remains the only code path that ever sets a version's status to `PUBLISHED`" and supersedes the prior one) — `sync` is, in effect, a script-driven publish of a system-generated proposal, not a special update path that bypasses the versioning model. **`sync` never runs a SQL `UPDATE` on the scalar fields of an existing, already-published `TalentVersion` row** — published rows are treated as immutable history, exactly as the rest of the schema assumes elsewhere. Re-running the import after fixing an importer bug therefore produces a clean new version with full provenance (`basedOnVersionId` chain), not a silently-altered historical record.

**Same diff-then-supersede pattern for `TalentSocial` and `TalentGalleryImage`**, matched by natural key:

- `TalentSocial` natural key: `(talentId, platform, label)` (matching how the schema comment already describes identity — "multiple rows legitimately share that triple across history," so the diff always compares against the *current* `versionStatus: PUBLISHED` row for that key, never a superseded one).
  - Key present in source, no current published row for it → create new (`PUBLISHED`, `basedOnVersionId: null`).
  - Key present in both, fields differ (`url`, `handle`, `followerCount`, `sortOrder`) → create new row (`PUBLISHED`, `basedOnVersionId` = old row's id), set old row's `versionStatus: SUPERSEDED`.
  - Key present in both, fields identical → no write.
  - Key existed in a prior published row but is **absent from source now** (e.g. a social account removed from `data/talent/index.js`) → `sync` sets that row's `lifecycleStatus: ARCHIVED` (never `DELETED` — Section 5's soft-delete convention, never a hard delete outside `reset` mode). It does **not** touch `versionStatus`, since the row's metadata wasn't necessarily wrong, it's just no longer current.
- `TalentGalleryImage` natural key: the resolved `imageAssetId` (i.e., the underlying file path) within a given talent — same three outcomes (create / supersede-on-change / archive-on-removal), plus `order` changes (a pure reorder, no other field changed) are treated as a metadata-only change exactly like a crop/position edit, going through the same supersede path rather than a special "just touch the order column" shortcut, so the history stays consistent.

**Duplicate avoidance.** Because every comparison is keyed (talent `slug`; social `(platform, label)`; gallery image's underlying file path) and always reads the *current* state before deciding to write, running `sync` twice in a row with no source changes between runs produces zero writes on the second run — `sync` converges, it doesn't accumulate. This is the concrete test for "safe and predictable": run it twice back-to-back against unchanged source data and the second run's report must show 100% `unchanged`.

**`ImageAsset` rows** are still deduplicated purely by `blobUrl` (Section 4) regardless of mode — an `ImageAsset` row is never superseded or versioned itself (it's a content-addressed-by-path record, not a versioned entity in the schema), so `sync` simply reuses the existing row if the path already has one, or creates a new one if not — same as `create`.

### 3.4 `reset` — dev/staging only, explicit confirmation required

Optional, future-leaning mode for local iteration on the importer itself: deletes everything this tool previously created (via `create` or `sync`, tracked by the manifest file from Section 1) and re-runs `create` from a clean slate.

- **Never available against a production database.** Hard-blocked if `NODE_ENV=production` — no flag overrides this. Additionally requires `--confirm-reset` even in non-production environments, so it's never triggered by a mistyped `--mode` value or a copy-pasted command.
- **Scope of deletion is the manifest, not a blanket table wipe.** `reset` reads `scripts/.migration-day-import.manifest.json` (written by every prior `create`/`sync --commit` run; records the ids of every `Talent`, `TalentVersion`, `TalentSocial`, `TalentGalleryImage`, and `ImageAsset` row this tool has ever created) and deletes exactly those rows, in FK-safe order (gallery images and socials and versions before their parent `Talent`; `ImageAsset` last, and only if nothing else still references it). It never deletes a row that wasn't created by this tool — so manually-created admin content (e.g. a real proposal made through the future admin UI) is never touched by `reset`, even if it happens to reference the same talent slug.
- **This is the one place a real `DELETE` is intentionally issued**, which is otherwise forbidden for admin-facing actions per `ADMIN_PANEL_PLAN.md` Section 12 ("no admin-facing action should ever issue a real `DELETE`... a genuine hard-delete, if ever needed, stays a manual, deliberate, logged operation outside the admin UI"). `reset` is exactly that: manual, deliberate, logged (it appends to the same report/manifest mechanism), and outside the admin UI — a dev tool for iterating on the importer, not a feature exposed to an Owner.
- After deletion, `reset` immediately runs the equivalent of `create` (still gated by the same `--commit` requirement) so "reset" means "start over cleanly," not "leave the database empty."

A run is therefore safe to execute repeatedly in any mode: `dry-run` never writes; `create` only ever adds; `sync` converges to match source and only touches rows it can prove are stale, never silently overwriting published history; `reset` is deliberately narrow-scoped and production-blocked. The report (Section 9) names the active mode on every run so output is never ambiguous about what happened.

## 4. Linking ImageAsset rows to profile / gallery / podcast images

One shared helper, conceptually:

```
getOrCreateImageAsset(rootRelativePath, uploadedById) → ImageAsset.id | null
```

- Resolves `rootRelativePath` against `public/`; if the file doesn't exist on disk, returns `null` and the caller records a `missingImages` entry (talent slug + field + path) instead of throwing — a missing image must not abort the whole import (Section 9).
- If it exists, looks up by `blobUrl` (Section 3) and returns the existing id, or creates a new `ImageAsset` (`blobUrl`, `width`/`height`/`mimeType`/`sizeBytes` left `null` for now — populating real dimensions would require decoding every file, which this design defers; a follow-up pass can backfill them) with `uploadedById` set to the Owner running the import and `status: ACTIVE`.
- This helper behaves identically in `create` and `sync` modes — `ImageAsset` lookup/creation is mode-independent (Section 3.3).

Linking per use site, all within the same `TalentVersion` creation/supersession step (Section 5):

- **Profile image** — `talent.profileImage` → `TalentVersion.profileImageAssetId`. The existing `imagePosition`/`profileImageScale` overrides in `data/talent/index.js` map straight to `TalentVersion.profileImagePosition`/`profileImageScale`. A change to *only* the crop/position fields (no new file) still counts as a "mapped shape differs" case under `sync` (Section 3.3) and produces a new superseding `TalentVersion`, consistent with `ADMIN_PANEL_PLAN.md` Section 10 treating crop changes as real, reviewed content changes.
- **Gallery images** — each `gallery[]` entry (plain string or `{src, position, scale}`) → one `TalentGalleryImage` row with `imageAssetId` from the helper, `order` = array index, `position`/`scale` copied from the object form (`null` for plain-string entries, matching current default behavior), `mobileOrder` = the corresponding `galleryMobileOrder[i]` if present. `altHe`/`altEn` are `null` — the source data has no alt text today, so the importer doesn't invent any; this is a real data gap worth flagging in the bilingual-parity sense, even though it's not a `*En` field — noted as a follow-up, not blocked on.
- **Podcast image** — `talent.podcast.image` (today, only `michal-ben-david`) → `TalentVersion.podcastImageAssetId`, same helper, same missing-image handling.

## 5. Creating (and, under `sync`, superseding) the Published TalentVersion per talent

**`create` mode, or `sync` mode encountering a brand-new talent** — for each new talent, inside one Prisma transaction:

1. Create `Talent` (`slug`, `status: ACTIVE`, `revisionNumber: 1`).
2. Resolve all image assets for that talent (profile, every gallery entry, podcast image if present) via the helper in Section 4.
3. Create `TalentVersion` with `status: PUBLISHED`, `talentId`, all scalar fields copied 1:1 from the source object (`name`, `nameEn`, `category`, `tags`, `featured`, `featuredOrder`, `sortOrder`, `location`, `locationEn`, `birthDate` parsed to `DateTime`, `bioHe`, `bioEn`), `profileImageAssetId`/`profileImagePosition`/`profileImageScale`, podcast fields (Section 7), `createdById` = the Owner, `createdAt: now()`, `approvedById` = the same Owner, `approvedAt: now()` (mirroring Section 8's "inserted as published with no proposed counterpart — the first Published Version for every entity"), `basedOnVersionId: null` (nothing precedes it).
4. Create the `TalentGalleryImage` rows from Section 4, each `versionStatus: PUBLISHED`, `lifecycleStatus: ACTIVE`.
5. Create the `TalentSocial` rows (Section 6).
6. Update `Talent.currentPublishedVersionId` to point at the new `TalentVersion.id` (this is the one moment a self-referential FK gets satisfied — `Talent` must exist before `TalentVersion`, and `TalentVersion.id` must exist before `Talent.currentPublishedVersionId` can be set, hence the two-step create-then-update rather than a single nested write).
7. Append the new row ids to the manifest file (Section 3.4).

**`sync` mode encountering an existing talent whose mapped shape changed** — inside one Prisma transaction:

1. Re-resolve image assets for any changed image fields (unchanged paths reuse the existing `ImageAsset` row, per Section 4).
2. Create the new `TalentVersion` (`status: PUBLISHED`, `basedOnVersionId` = current published version's id, `createdById`/`approvedById` = the running Owner, all fields = the freshly mapped values — not a partial patch, a full new snapshot, matching how every other `TalentVersion` row in the schema is a complete snapshot, not a diff).
3. Set the previous `TalentVersion.status` to `SUPERSEDED`.
4. Diff and write `TalentSocial`/`TalentGalleryImage` changes per Section 3.3's natural-key rules.
5. Repoint `Talent.currentPublishedVersionId`, bump `Talent.revisionNumber`.
6. Append the new row ids to the manifest file; the manifest also drops superseded/archived ids it no longer needs to track for `reset` purposes (superseded `TalentVersion` rows are still real history and aren't deleted by `reset` unless their `Talent` itself is being reset — see Section 3.4's FK-safe ordering note).

Wrapping each talent's work in `prisma.$transaction(...)` means a failure partway through one talent (e.g. a thrown error, not a missing-image soft-failure) rolls back cleanly rather than leaving an orphaned or half-superseded record — the per-talent transaction boundary is the unit of atomicity, not the whole import run (so one bad talent doesn't block the others), in every mode.

## 6. Creating TalentSocial rows, including Alma's second Instagram as SPAM

Per talent, one `TalentSocial` row per non-null platform field plus one per `extraSocials[]` entry — mapping logic is identical across `create` and `sync`; only whether a given mapped row is a brand-new insert or a supersession of an existing row differs (Section 3.3):

- `instagram`/`tiktok`/`youtube` (when not `null`) → one row each: `platform: INSTAGRAM|TIKTOK|YOUTUBE`, `label: MAIN`, `url` = the source URL, `handle` = derived from the URL path segment (best-effort parse, e.g. `https://www.instagram.com/kimchourilov` → `@kimchourilov`; left `null` if parsing is ambiguous rather than guessed wrong), `followerCount` = the matching key in `followers{}` (already explicitly internal-only per the schema comment and the source-file field reference), `versionStatus: PUBLISHED`, `lifecycleStatus: ACTIVE`, `createdById`/`approvedById` = Owner.
- `extraSocials[]` entries → one row each, `platform` parsed from `displayLabel`/`label`/URL shape (today only `'Instagram'`), and **the account label**:
  - **Alma Weizman's `extraSocials[0]`** (`url: 'https://www.instagram.com/almachillz'`, `displayLabel: 'Spam'`) maps explicitly to `label: SPAM`, `customLabel: null` (no need for `customLabel` since `SPAM` is already a controlled enum value — `customLabel` is reserved for `label: OTHER` only, per the schema comment). This is the one talent in the current source data that exercises this path, so the importer's mapping table should have a direct, named test case for `alma-weizman` rather than relying only on generic `displayLabel` string-matching logic.
  - General rule for any *other* talent's future `extraSocials` entries: map `displayLabel` (case-insensitively) against the `SocialAccountLabel` enum values (`Main`, `Secondary`, `Spam`, `Brand`, `Personal`); anything that doesn't match one of those falls to `label: OTHER` with `customLabel` set to the original `displayLabel` text verbatim — this is exactly the "escape hatch" the schema comment describes, so the importer never has to guess or drop an unrecognized label.
  - `url`/`followerCount` for `extraSocials` rows: `followerCount: null` (the source `followers{}` object is keyed by platform, not by account, so a secondary account on the same platform has no separate follower count in the source data today — not a bug, just a known gap to report, not silently fill with the main account's number).
- **Under `sync`:** if a talent's `extraSocials` entry is later removed from `data/talent/index.js` (e.g. Alma's spam account is dropped from the source file), the matching `TalentSocial` row's `lifecycleStatus` moves to `ARCHIVED`, not deleted — Section 3.3's natural-key removal rule, applied to this concrete case by name since it's the one explicitly called out in the task.

## 7. Michal's podcast fields

Only `michal-ben-david` has a `podcast` object today; every other talent's `TalentVersion.podcast*` columns stay `null`, which the schema already supports (all podcast fields are optional).

Mapping, 1:1 with the schema comment's stated intent:

| Source (`talent.podcast.*`) | Target (`TalentVersion.*`) |
|---|---|
| `title` | `podcastTitle` |
| `description` | `podcastDescriptionHe` |
| `descriptionEn` | `podcastDescriptionEn` |
| `image` | resolved via `getOrCreateImageAsset` → `podcastImageAssetId` |
| `videoEmbedUrl` | `podcastVideoEmbedUrl` |

No `podcastTitleEn` target field exists (the schema comment explains why: the show title is a proper noun, identical in both locales by design) — the importer must **not** invent one or try to write `title` into a non-existent column; this is a deliberate schema asymmetry, not an oversight to "fix" during import.

Because podcast fields live directly on `TalentVersion` (not a separate model), any future change to Michal's podcast description/title/embed under `sync` mode is just one more field comparison in Section 3.3's "mapped shape differs" check — it produces a new superseding `TalentVersion` exactly like a bio edit would, with no special-cased podcast diff path needed.

## 8. Placeholder collaborations — skip or draft

`data/collaborations.js` today contains 8 entries, every single one the literal string `'BRAND NAME'` — i.e., 100% placeholder, zero real data.

Recommended handling: **skip entirely, with a loud report line**, rather than importing 8 `Entity`/`EntityVersion` rows that just say "BRAND NAME" eight times. Concretely:

- The importer checks each entry against a placeholder pattern (`/^BRAND NAME$/i`, or more generally "exact string match against a known placeholder token list") and excludes matches from creation, in every mode.
- If, after filtering, zero real collaborations remain (today's case), the importer creates **no** `Entity`/`EntityVersion` row for `COLLABORATIONS` at all — there is nothing real to mark as "first published version of." Creating a published `EntityVersion` whose `content` is `["BRAND NAME", "BRAND NAME", ...]` would be actively wrong: it's not real production data, and Section 8's structural-equivalence check would then be diffing the live site's empty/placeholder collaborations row against a database row claiming to be "published," which is a misleading state to ship.
- The report (Section 9) surfaces this explicitly: `skippedPlaceholders: { collaborations: 8 }` so a human reviewing the run output sees clearly that collaborations were *not* imported and *why*, rather than assuming silence means "nothing to import."
- **Under `sync`:** if real brand names are filled in before Migration Day actually runs, a later `sync` run picks them up exactly like any other source change — the one `Entity`/`EntityVersion` row for `COLLABORATIONS` would be created fresh at that point (no existing row to supersede yet), and a further edit after that would supersede it the same way a `TalentVersion` change does. Nothing about the mode design is collaboration-specific; it's the same diff engine.

Alternative considered and rejected for now: importing them as `DRAFT` `EntityVersion` rows so an Owner can review/discard each one in the admin UI. Rejected because the Core Content Engine's `entityAdapter`/proposal UI for `COLLABORATIONS` isn't built yet (`ADMIN_PANEL_PLAN.md` Section 13.14 step 7 marks `siteContentAdapter`/`seoAdapter`/`legalPageAdapter` as stubs and doesn't even mention a collaborations-specific adapter) — there would be nowhere for an Owner to actually act on a draft row yet. Worth revisiting once that adapter exists.

## 9. End-of-run validation / report

Printed to stdout (and optionally written to `--report-path`) as a structured summary, not just scattered log lines, so it can be read as the Section 8 dry-run gate's evidence. The report always names the **mode** and whether it was a preview (`--commit` not set) or a real write, so output is never ambiguous about what happened or would happen:

```
Migration Day Import Report — <timestamp>, mode: dry-run | create | sync | reset, write: preview | committed

TALENTS
  created:             <n>   (slugs: ...)
  updated (synced):    <n>   (slugs: ..., each with a short field-level diff summary)
  unchanged:           <n>   (slugs: ...)
  skipped (existing, create mode only): <n>   (slugs: ...)

IMAGES
  linked:              <n>   (profile: <n>, gallery: <n>, podcast: <n>)
  deduped (reused existing ImageAsset): <n>
  missing on disk:     <n>   — talent slug, field, expected path, for each

SOCIALS
  created:             <n>   (by platform: instagram <n>, tiktok <n>, youtube <n>)
  updated (superseded): <n>
  archived (removed from source): <n>
  labeled SPAM/SECONDARY/OTHER: <n>  (explicit listing: e.g. "alma-weizman: instagram → SPAM")
  follower counts present: <n> / missing: <n>

GALLERY IMAGES
  created: <n>  updated (re-ordered/re-cropped): <n>  archived (removed from source): <n>

PODCAST
  talents with podcast data imported/updated: <n>   (slugs: ...)

COLLABORATIONS
  skipped placeholders: <n>
  real entries imported/updated: <n>

RESET (reset mode only)
  rows deleted (from manifest): <n>, by model: Talent <n>, TalentVersion <n>, TalentSocial <n>, TalentGalleryImage <n>, ImageAsset <n>

BILINGUAL PARITY (Section 8 check, run inline)
  talents missing nameEn/locationEn/bioEn: <list, or "none">

ERRORS
  <n>  — any row that failed to import (talent slug + reason); these do NOT
        abort the run for other talents (Section 5's per-talent transaction
        boundary), but a non-zero count here means the run is NOT considered
        a clean pass for Section 8's dry-run gate.
```

This is intentionally the same four-check spirit as `ADMIN_PANEL_PLAN.md` Section 8's dry-run gate (structural/visual equivalence, bilingual parity, SEO/sitemap source check, image reference/crop check) — this script's report covers the **data-integrity** half of those checks (bilingual parity, image resolution) inline as it runs; the **structural/visual diff** and **SEO/sitemap source check** are separate, page-rendering-level checks that compare database-backed rendering against `data/*.js`-backed rendering and can't be done by this import script alone — they belong to a follow-up verification script/manual pass once the importer itself is built and run once in dry-run mode.

A `sync` run with no source changes since the prior run must produce a report where every section reads `0 created / 0 updated`, only `unchanged` counts — that's the concrete acceptance test for "safe and predictable" called out in the task.

---

## Risks and open questions

- **No real `width`/`height`/`mimeType`/`sizeBytes` on imported `ImageAsset` rows.** Deferred rather than decoding every file during import; flagged in the report as a known gap, not silently left unmentioned.
- **`handle` parsing from URLs is best-effort.** A malformed or unusual URL shape should leave `handle: null` rather than guess wrong — wrong data is worse than missing data here, especially since `handle` is editable independently of `url` per the schema comment.
- **`sync`'s field-level diff must be exact and explicit about what counts as "changed."** A naive deep-equality check across all mapped fields is the right default, but whitespace-only differences in `bioHe`/`bioEn` (e.g. a trailing space added by hand-editing `data/talent/index.js`) would trigger an unnecessary new `TalentVersion`. Worth normalizing whitespace before comparing, and noting in the script's own comments that the diff is intentionally strict otherwise (no fuzzy/semantic comparison) — a wrong silent "unchanged" verdict is worse than one extra harmless version row.
- **Manual admin edits vs. `sync` overwriting them.** Once the admin UI (not yet built) starts producing real proposals/approvals on top of imported talents, a later `sync` run must not blindly overwrite an Owner's manual edit just because it differs from `data/talent/index.js` — but by Migration Day's own design (`ADMIN_PANEL_PLAN.md` Section 8 step 6: "decide who can still write directly to `data/*.js` after Migration Day — recommendation: no one"), `data/*.js` is expected to stop being edited once the database is authoritative, so this risk is real only *during* the parallel-running period before the final switch, not after. Worth a loud warning in the script's `--help` output and in this design: don't run `sync` against a database that already has real admin-made edits diverging from `data/*.js` on purpose, unless that divergence is meant to be discarded.
- **Collaborations placeholder detection is a string match.** If a real brand is ever literally named "Brand Name" (extremely unlikely), it would be incorrectly skipped — acceptable risk, callable out explicitly in the script's comments.
- **The manifest file is the only record of "what this tool created."** If it's deleted or gets out of sync with the database (e.g. someone manually deletes a row the manifest still references), `reset` will hit "row already gone" errors. `reset` should treat a missing target row as a no-op (already gone, fine) rather than a hard failure, and the script should warn loudly if the manifest file itself is missing or unreadable rather than silently treating that as "nothing to reset."
- **The `--confirm-production` host-pattern check is a heuristic, not a guarantee.** A `DATABASE_URL` can point at a real production database without an obviously "production-looking" hostname. This flag is a speed bump for the common mistake, not a substitute for operational discipline (the person running `sync --commit` is still responsible for knowing which database `DATABASE_URL` points at).
- **Owner attribution.** Every created/approved row needs a real `User.id`. The script should accept `--owner-email=<email>` (defaulting to the single seeded Owner if only one exists) rather than hardcoding an id, so it stays usable across environments.

## Recommended execution plan (still design-only — listed for sequencing, not started)

1. Implement `scripts/migrate-day-import.mjs` per this design, defaulting to `--mode=dry-run`.
2. Run `dry-run` against current `data/talent/index.js`; review the report by hand — especially `missing on disk` and `bilingual parity` sections — before touching anything else.
3. Fix any source-data issues the dry-run surfaces (missing image files, bad URLs) directly in `data/talent/index.js` — not by special-casing them in the importer.
4. Re-run `dry-run` until the report is clean (zero errors, zero unexplained missing images).
5. Run `--mode=create --commit` against a local/dev database first, never production on the first real run.
6. Manually spot-check a few imported talents (including Alma's SPAM social and Michal's podcast block) directly via Prisma Studio or a read query before considering this importer "proven."
7. Deliberately introduce a small source-data fix (e.g. correct a bio typo, add a missing gallery image) and run `--mode=sync --commit` against the same dev database; verify the report shows exactly one `updated` talent, the previous `TalentVersion` is now `SUPERSEDED`, and a second `sync` run immediately after shows `0 updated / 1 unchanged` — this is the concrete proof that `sync` converges and doesn't accumulate duplicate versions.
8. Exercise `reset` in a throwaway/dev environment only: confirm it refuses without `--confirm-reset`, refuses outright under `NODE_ENV=production`, and that re-running `create` afterward reproduces the same dataset.
9. Only then is this importer a candidate input to `ADMIN_PANEL_PLAN.md` Section 8's full dry-run verification gate (structural/visual equivalence, SEO/sitemap source check) — those remain separate, not built by this script.
