/*
  Brings TalentGalleryImage's audit trail up to parity with TalentSocial so
  every collection module (Social Links, Gallery, and future ones) shares
  the same Draft -> Proposed -> Approved/Rejected lifecycle contract.

  Backfill-safety fix: talent_gallery_images already has rows from before
  this migration (historical/imported gallery data with no recorded
  author). Adding `createdById` as NOT NULL fails against that existing
  data ("column ... contains null values") because there is no default and
  no safe value to backfill it with. All four audit columns are therefore
  added NULLABLE:
    - createdById   — required for every NEW row going forward (enforced
                       in application code, galleryService.
                       insertDraftGalleryImage), but left nullable at the
                       column level so existing historical rows keep a
                       null author instead of being fabricated one.
    - approvedById, approvedAt, rejectionNote — were already optional by
                       design (a row may never be approved/rejected), kept
                       unchanged.

  No existing data is modified or dropped by this migration.
*/

-- AlterTable
ALTER TABLE "talent_gallery_images" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "rejectionNote" TEXT;

-- CreateIndex
CREATE INDEX "talent_gallery_images_talentId_idx" ON "talent_gallery_images"("talentId");

-- AddForeignKey
-- SET NULL (not RESTRICT) because createdById is nullable here, matching
-- the existing audit_logs_createdById_fkey convention for nullable
-- createdById columns elsewhere in this schema.
ALTER TABLE "talent_gallery_images" ADD CONSTRAINT "talent_gallery_images_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_gallery_images" ADD CONSTRAINT "talent_gallery_images_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
