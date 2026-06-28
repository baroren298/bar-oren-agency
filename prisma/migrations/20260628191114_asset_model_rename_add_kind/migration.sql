/*
  Asset Model Migration — see ASSET_MODEL_MIGRATION_PLAN.md.

  The Prisma model was renamed ImageAsset -> Asset, with @@map("image_assets")
  kept in place, so the table itself is untouched by this migration. The
  only real change here is additive: a new `kind` discriminator column on
  the existing `image_assets` table, defaulted to 'IMAGE' so every existing
  row backfills correctly with no manual data migration.

  Written by hand (not via `prisma migrate dev`) because this database has
  an unrelated extra table (`playing_with_neon`, a Neon-provisioned sample
  table) that made `migrate dev`'s full-schema drift detection unusable
  here. `migrate deploy` does not perform that drift check — it only
  applies pending migration files in order — so this hand-authored file is
  applied the same way a CLI-generated one would be, without requiring a
  reset.

  No existing data is modified or dropped by this migration.
*/

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('IMAGE', 'DOCUMENT', 'VIDEO', 'AUDIO', 'OTHER');

-- AlterTable
ALTER TABLE "image_assets" ADD COLUMN     "kind" "AssetKind" NOT NULL DEFAULT 'IMAGE';
