/*
  Gallery Upload Sprint 1 — see GALLERY_UPLOAD_SPRINT_1_ARCHITECTURE.md §3
  and §11.

  Additive only: three new nullable/defaulted columns on the existing
  `image_assets` table (Prisma model `Asset`). No rename, no drop, no
  existing data modified.

  - `provider` identifies which lib/storage/ StorageProvider implementation
    manages a given row (needed once more than one provider can exist).
    Defaulted to 'local' (Upload Sprint 1's only wired-up provider) so every
    pre-existing row — all written by the one-time Migration Day import,
    which predates any real upload code — backfills correctly with no
    manual data migration, exactly like the `kind` column's
    `DEFAULT 'IMAGE'` in the prior migration.
  - `providerKey` is the provider's own management identifier for the file
    (distinct from `blobUrl`, the URL a browser loads) — nullable, since
    pre-existing rows have no equivalent value to backfill.
  - `originalFilename` is display/audit only — nullable for the same
    reason.

  Written by hand (not via `prisma migrate dev`), following the same
  precedent as prisma/migrations/20260628191114_asset_model_rename_add_kind
  (that migration's own header comment): this database has an unrelated
  extra table that makes `migrate dev`'s full-schema drift detection
  unusable here. `migrate deploy` only applies pending migration files in
  order and does not perform that drift check, so this hand-authored file
  applies the same way a CLI-generated one would.

  No existing data is modified or dropped by this migration.
*/

-- AlterTable
ALTER TABLE "image_assets" ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "image_assets" ADD COLUMN     "providerKey" TEXT;
ALTER TABLE "image_assets" ADD COLUMN     "originalFilename" TEXT;
