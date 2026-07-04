/*
  Talent Publishing Status sprint (Phase 1) — adds public-website
  visibility as a normal versioned field on TalentVersion.

  New enum `TalentVisibility` (VISIBLE | HIDDEN) is deliberately separate
  from the existing `LifecycleStatus` enum, whose own HIDDEN value is an
  unrelated entity-level soft-delete/lifecycle concept — see
  prisma/schema.prisma's header comments on both enums for the full
  rationale. Nothing about LifecycleStatus or any LifecycleStatus column
  changes in this migration.

  Backfill-safety: the new `visibility` column on talent_versions is added
  NOT NULL with DEFAULT 'VISIBLE'. Postgres backfills every existing row —
  published, draft, proposed, and superseded alike — to VISIBLE as part of
  this single ALTER TABLE statement, atomically, before the column becomes
  queryable. There is no separate UPDATE step and no window where any row
  has a null/undefined visibility, so no existing published talent can
  disappear from the public site once a later phase starts filtering on
  this column (Phase 1 itself adds no such filter — see lib/public/talent.js,
  untouched this phase).
*/

-- CreateEnum
CREATE TYPE "TalentVisibility" AS ENUM ('VISIBLE', 'HIDDEN');

-- AlterTable
ALTER TABLE "talent_versions" ADD COLUMN "visibility" "TalentVisibility" NOT NULL DEFAULT 'VISIBLE';
