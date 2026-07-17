/*
  Talent SEO + Slug Management sprint — adds the versioned slug and SEO
  fields to TalentVersion, so both ride the existing Draft → Proposed →
  Published workflow (same pattern as the earlier `visibility` migration).

  Purely additive and backfill-safe:
    - Seven new nullable TEXT columns. NULL on an existing row means
      "no value proposed": `slug` falls back to the parent talents.slug
      (the public URL is unchanged until a version proposing a new slug is
      actually published), and every seo* field falls back to the smart
      defaults derived from the talent's own name/bio/profile image at
      render time.
    - `seoNoindex` is NOT NULL DEFAULT false — Postgres backfills every
      existing row atomically inside the ALTER TABLE, so no published page
      can accidentally become noindexed by this migration.

  talents.slug itself (and its UNIQUE constraint) is untouched — it remains
  the single authoritative public slug, only ever rewritten inside
  talentRepository.publishTalentVersion's transaction.
*/

-- AlterTable
ALTER TABLE "talent_versions" ADD COLUMN "slug" TEXT;
ALTER TABLE "talent_versions" ADD COLUMN "seoTitle" TEXT;
ALTER TABLE "talent_versions" ADD COLUMN "seoDescription" TEXT;
ALTER TABLE "talent_versions" ADD COLUMN "seoCanonicalUrl" TEXT;
ALTER TABLE "talent_versions" ADD COLUMN "seoOgTitle" TEXT;
ALTER TABLE "talent_versions" ADD COLUMN "seoOgDescription" TEXT;
ALTER TABLE "talent_versions" ADD COLUMN "seoOgImageUrl" TEXT;
ALTER TABLE "talent_versions" ADD COLUMN "seoNoindex" BOOLEAN NOT NULL DEFAULT false;
