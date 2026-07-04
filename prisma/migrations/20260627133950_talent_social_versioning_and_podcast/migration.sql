/*
  Warnings:

  - You are about to drop the column `proposedUrl` on the `talent_socials` table. All the data in the column will be lost.
  - You are about to drop the column `publishedUrl` on the `talent_socials` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `talent_socials` table. All the data in the column will be lost.
  - Added the required column `createdById` to the `talent_socials` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SocialAccountLabel" AS ENUM ('MAIN', 'SECONDARY', 'SPAM', 'BRAND', 'PERSONAL', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SocialPlatform" ADD VALUE 'FACEBOOK';
ALTER TYPE "SocialPlatform" ADD VALUE 'WEBSITE';
ALTER TYPE "SocialPlatform" ADD VALUE 'THREADS';

-- DropIndex
DROP INDEX "talent_socials_talentId_platform_key";

-- AlterTable
ALTER TABLE "talent_socials" DROP COLUMN "proposedUrl",
DROP COLUMN "publishedUrl",
DROP COLUMN "status",
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "basedOnVersionId" TEXT,
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "customLabel" TEXT,
ADD COLUMN     "handle" TEXT,
ADD COLUMN     "label" "SocialAccountLabel" NOT NULL DEFAULT 'MAIN',
ADD COLUMN     "lifecycleStatus" "LifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "rejectionNote" TEXT,
ADD COLUMN     "sortOrder" INTEGER,
ADD COLUMN     "url" TEXT,
ADD COLUMN     "versionStatus" "VersionStatus" NOT NULL DEFAULT 'PUBLISHED';

-- AlterTable
ALTER TABLE "talent_versions" ADD COLUMN     "podcastDescriptionEn" TEXT,
ADD COLUMN     "podcastDescriptionHe" TEXT,
ADD COLUMN     "podcastImageAssetId" TEXT,
ADD COLUMN     "podcastTitle" TEXT,
ADD COLUMN     "podcastVideoEmbedUrl" TEXT;

-- CreateIndex
CREATE INDEX "talent_socials_talentId_platform_idx" ON "talent_socials"("talentId", "platform");

-- AddForeignKey
ALTER TABLE "talent_versions" ADD CONSTRAINT "talent_versions_podcastImageAssetId_fkey" FOREIGN KEY ("podcastImageAssetId") REFERENCES "image_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_socials" ADD CONSTRAINT "talent_socials_basedOnVersionId_fkey" FOREIGN KEY ("basedOnVersionId") REFERENCES "talent_socials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_socials" ADD CONSTRAINT "talent_socials_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_socials" ADD CONSTRAINT "talent_socials_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
