# Asset Model Migration Plan (`ImageAsset` → `Asset`)

Status: plan only. No schema changes, no code changes, no git commands have been run. This is the investigation and decision record to act on before Gallery Upload is implemented.

## 1. Investigation — every usage of `ImageAsset` found

Searched: `prisma/schema.prisma`, `prisma/migrations/**`, `lib/admin/repository/**`, `lib/admin/engine/**` (services + adapters), `lib/admin/mappers/**`, `app/api/admin/**`, `components/admin/**`, `scripts/**`, plus project docs.

**Schema / migrations:**
- `prisma/schema.prisma` — defines `model ImageAsset`, plus FK fields `TalentGalleryImage.imageAssetId`, `TalentVersion.profileImageAssetId`, `TalentVersion.podcastImageAssetId`, relation fields `profileImageAsset`, `podcastImageAsset`, `galleryUses`, `profileUseOf`, `podcastUseOf`, and `EntityType.IMAGE_ASSET`.
- `prisma/migrations/20260626130753_init_admin_schema/migration.sql` — creates `image_assets` table, its FKs, and the `IMAGE_ASSET` enum value.
- `prisma/migrations/20260627133950_talent_social_versioning_and_podcast/migration.sql` — adds `podcastImageAssetId` FK to `image_assets`.

**Actual Prisma Client model accessor (`prisma.imageAsset.*` / `tx.imageAsset.*`) — the thing that actually breaks on a model rename:**
- `scripts/migrate-day-import.mjs` — **the only place in the entire codebase that calls the live Prisma accessor**: `tx.imageAsset.create` (line 222), `prisma.imageAsset.delete` (line 743), `prisma.imageAsset.findMany` (line 975).
- `lib/admin/repository/imageAssetRepository.js` — does **not** call Prisma at all. Every method (`uploadImage`, `getImageAssetById`, `archiveImageAsset`) is a `notImplemented()` stub. This is the intended home for the future upload code, currently empty.

**Field/relation name usages (these reference relation names, not the model name — independent of the rename):**
- `lib/admin/repository/talentRepository.js` — heavy use of `imageAssetId`, `profileImageAsset: { select: { blobUrl } }`, `podcastImageAsset: { select: { blobUrl } }`, `profileImageAssetId`.
- `lib/admin/talent-workspace.js`, `lib/admin/mappers/talentMapper.js` — read `profileImageAssetId` / `profileImageAsset?.blobUrl` to build mapped DTOs for the UI.
- `lib/admin/engine/adapters/talentAdapter.js`, `lib/admin/gallery-review.js`, `lib/admin/engine/galleryService.js` — pass `imageAssetId` through as an opaque FK value; never touch the model name.
- `components/admin/PodcastTab.jsx`, `components/admin/ProfileImagePanel.jsx`, `app/admin/talent/[id]/page.jsx` — consume already-mapped props (`profileImageUrl`, `podcastImageUrl`, etc.), never reference `ImageAsset` directly.
- `app/api/admin/talent/[id]/gallery/**` routes — no `ImageAsset` references at all; they go through `galleryService`/`talentAdapter`.

**Other:**
- `lib/admin/constants/enums.js` — JS mirror of `EntityType`, includes `IMAGE_ASSET: 'IMAGE_ASSET'`.
- `lib/admin/engine/__tests__/engineGenericity.test.js` — a regex assertion that checks the engine never hardcodes entity-type strings; the regex literal includes `IMAGE_ASSET` as one of the known values.
- `scripts/seed-dev-talent.mjs` — no `ImageAsset` references found.
- Docs: `ADMIN_PANEL_PLAN.md`, `MIGRATION_DAY_IMPORTER_DESIGN.md` describe the current model in prose (documentation only, not executable).
- `.env`/`.env.local`/`.env.local.example` exist but were not opened, per instructions.

**Key finding that drives the whole plan:** the real CMS write path for images (`imageAssetRepository.js`) has never been implemented. The only code that has ever actually created an `ImageAsset` row through Prisma is the one-time import script. That means the blast radius of this rename, today, is about as small as it will ever be — this is true regardless of how big the architecture eventually gets.

## 2. Migration path decision

Three options were on the table:

1. **Rename the Prisma model only, keep the DB table name** (`model Asset { ... @@map("image_assets") }`). Zero data movement, zero table-level SQL. The only generated migration is the additive `kind` column.
2. **Rename both the Prisma model and the DB table** (`image_assets` → `assets`). Prisma can generate this as a clean `ALTER TABLE ... RENAME TO ...` with no data loss, but it also requires renaming every FK constraint that references `image_assets` (`talent_versions_profileImageAssetId_fkey`, `talent_gallery_images_imageAssetId_fkey`, `image_assets_uploadedById_fkey`, `image_assets_pkey`) and carries a brief lock during the rename. No functional benefit today.
3. **Create a new `assets` table and migrate rows into it, then drop the old table.** The heaviest and riskiest option, normally reserved for cases where the column shape itself is incompatible. Not justified here — the column shape isn't changing, only the model's name and one additive column.

**Decision: Option 1.** Rename the Prisma model to `Asset`, keep `@@map("image_assets")` so the database table itself is untouched. This makes the rename a pure application-layer relabeling — the database doesn't know anything changed. Defer the physical table rename (option 2) indefinitely; revisit only if there's a concrete reason (e.g. a DBA/dashboard convention), not as part of this change.

## 3. `kind` discriminator

Add as a new, additive, defaulted column — never a manual backfill:

```
enum AssetKind {
  IMAGE
  DOCUMENT
  VIDEO
  AUDIO
  OTHER
}
```

`Asset.kind AssetKind @default(IMAGE)`. Because every existing row is in fact an image, the default backfills all current rows correctly with a single `ALTER TABLE ... ADD COLUMN ... DEFAULT 'IMAGE'` — no data migration script needed for this column.

## 4. FK naming: `imageAssetId` vs `assetId`

**Decision: keep `imageAssetId`, `profileImageAssetId`, `podcastImageAssetId`, and the relation names `profileImageAsset`/`podcastImageAsset`/`galleryUses`/`profileUseOf`/`podcastUseOf` exactly as they are.** Only their *type* changes, from `ImageAsset` to `Asset`. This is a deliberate, documented inconsistency (a field literally named `imageAssetId` pointing at a model called `Asset`) — and it's the right trade here: renaming those fields touches every file listed in Section 1's third group (talentRepository, talent-workspace, talentMapper, talentAdapter, gallery-review, galleryService — six files with zero functional need to change) purely for cosmetic consistency. That rename can happen later, in its own small, isolated, easy-to-review change, whenever there's spare cycles — it is not a prerequisite for Gallery Upload and should not be bundled with this migration.

## 5. Files that will change

**Functional changes required:**
- `prisma/schema.prisma` — rename `model ImageAsset` → `model Asset`, add `@@map("image_assets")`, add `kind AssetKind @default(IMAGE)`, add `enum AssetKind`, update the type of `profileImageAsset`/`podcastImageAsset`/`galleryUses`/`profileUseOf`/`podcastUseOf`/`uploadedImages` relation fields from `ImageAsset`/`ImageAsset[]` to `Asset`/`Asset[]` (names unchanged, only the referenced type).
- A new generated migration file under `prisma/migrations/` (additive only — new enum type + new column, no renames, no drops).
- `scripts/migrate-day-import.mjs` — 3 call sites: `tx.imageAsset.create` → `tx.asset.create` (line 222), `prisma.imageAsset.delete` → `prisma.asset.delete` (line 743), `prisma.imageAsset.findMany` → `prisma.asset.findMany` (line 975).

**Recommended, cheap-now cleanup (optional but low-risk, worth bundling since the file is currently empty logic):**
- `lib/admin/repository/imageAssetRepository.js` — rename to `assetRepository.js`; it's still all `notImplemented()` stubs, so this is a pure rename with no logic risk. Doing it now avoids ever having a file named after the old model.
- `lib/admin/constants/enums.js` — optionally rename `EntityType.IMAGE_ASSET` → `ASSET`. Confirmed zero code paths currently write this value to any row (no `EntityType.IMAGE_ASSET` audit-log/entity-version writes exist yet), so this is free today and will not be free later once an upload feature starts writing audit logs tagged with it.
- `lib/admin/engine/__tests__/engineGenericity.test.js` — if the enum value above is renamed, update the regex literal (`IMAGE_ASSET` → `ASSET`) in the same change, or the test will fail.

**Confirmed — no change needed (verified by direct inspection, not assumption):**
`lib/admin/repository/talentRepository.js`, `lib/admin/talent-workspace.js`, `lib/admin/mappers/talentMapper.js`, `lib/admin/engine/adapters/talentAdapter.js`, `lib/admin/gallery-review.js`, `lib/admin/engine/galleryService.js`, `components/admin/PodcastTab.jsx`, `components/admin/ProfileImagePanel.jsx`, `app/admin/talent/[id]/page.jsx`, all of `app/api/admin/talent/[id]/gallery/**`, `scripts/seed-dev-talent.mjs`. All of these key off field/relation names that stay identical (Section 4).

**Documentation only (update for consistency, not urgent, no functional risk either way):**
`ADMIN_PANEL_PLAN.md`, `MIGRATION_DAY_IMPORTER_DESIGN.md`, `ASSET_MANAGEMENT_ARCHITECTURE.md` — all currently describe `ImageAsset` in prose.

## 6. Risks and rollback

- **Biggest real risk is Prisma misreading the rename as a table rename instead of a relabel.** If `@@map("image_assets")` is omitted, `prisma migrate dev` will detect that the default table name implied by `model Asset` (`assets`) differs from the existing table (`image_assets`) and may prompt to rename the table and every FK constraint pointing at it. Mitigation: add `@@map` in the same schema edit that renames the model, before ever running `migrate dev`, and manually read the generated SQL file before applying — it should contain only a `CREATE TYPE "AssetKind" ...` and an `ALTER TABLE "image_assets" ADD COLUMN "kind" ...`. If it contains `RENAME TO` or `DROP`, stop and fix the schema instead of accepting the prompt.
- **Silent runtime breakage, not compile-time.** This is a JavaScript codebase (no TypeScript), so a missed `prisma.imageAsset.*` call site won't be caught by a type-checker — it fails at runtime the first time that code path executes, as `prisma.imageAsset` will simply be `undefined` on the regenerated client. Mitigation: the call-site inventory in Section 1 is exhaustive (3 sites, 1 file) from a repo-wide grep; re-run `grep -rn "\.imageAsset\."` after editing as a verification step, not as the discovery step.
- **`EntityType.IMAGE_ASSET` rename, if done, changes a Postgres enum value (`ALTER TYPE ... RENAME VALUE`).** Confirmed via grep that nothing currently writes this value, but that's a code-level guarantee, not a database-level one — verify against the actual database (e.g. `SELECT count(*) FROM audit_logs WHERE "entityType" = 'IMAGE_ASSET'`) before assuming it's safe, since dev/staging data outside this repo's code history could exist.
- **Existing data at risk: none, by design.** Nothing in this plan deletes, renames, or rewrites a single existing row. The `kind` column is additive with a default; the model rename with `@@map` is a no-op at the SQL level. The only thing that could put data "at risk" is choosing option 2 or 3 from Section 2 instead of option 1 — which is exactly why option 1 was chosen.
- **Unknown, not assumed:** the actual row count and contents of `image_assets` in any real environment were not inspected (no database access in this review, and `.env` was intentionally not read). Before running this in an environment that matters, confirm row count and take a database snapshot/backup through whatever mechanism the Postgres host provides — standard practice for any schema migration, independent of how low-risk this one looks on paper.
- **Rollback path:** revert `prisma/schema.prisma` and the 3 call sites in `migrate-day-import.mjs`; the additive `kind` column can simply be left in place (unused) or dropped in a follow-up migration — there is no data-loss step to undo.

## 7. Should this happen before Gallery Upload? Yes.

`imageAssetRepository.js` is currently empty — Gallery Upload has not been built against the old name yet. This is the cheapest point in the project's lifetime to make this change: the only other touch point is a 3-line fix in a one-time import script. Building the upload endpoint, its validation config, and any new UI against `ImageAsset` first — and renaming afterward — would mean redoing this same rename across all of that new code too, which is precisely the rework this review exists to avoid.

## 8. Commands that will be needed (not run yet)

In order, once this plan is approved:

1. Edit `prisma/schema.prisma` per Section 5 (manual edit).
2. `npx prisma format` — sanity-check schema syntax.
3. `npx prisma migrate dev --name rename_image_asset_to_asset_add_kind` — generates the migration; **read the generated SQL before confirming** (Section 6).
4. `npx prisma generate` — regenerate the Prisma Client so `prisma.asset` exists.
5. Edit `scripts/migrate-day-import.mjs` (3 call sites, Section 5).
6. Optionally rename `lib/admin/repository/imageAssetRepository.js` → `assetRepository.js`, and optionally rename `EntityType.IMAGE_ASSET` in `lib/admin/constants/enums.js` + the regex in `engineGenericity.test.js`.
7. `grep -rn "\.imageAsset\." --include="*.js" --include="*.mjs"` — verification pass, expect zero results.
8. `npm run admin:migrate-day-import` against a local/dev database — confirm the import script still runs end-to-end post-rename.
9. `npx vitest run` — confirm the full suite, including `engineGenericity.test.js`, still passes.
10. Take a database backup/snapshot through your Postgres host's own mechanism before applying any of this against an environment with real data (host-specific; not prescribed here since identifying it would require reading `.env`).
