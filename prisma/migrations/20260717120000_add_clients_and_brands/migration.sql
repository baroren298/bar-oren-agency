-- Sprint 7B (Clients & Brands Foundation) — additive only.
--
-- Adds the `clients` and `brands` tables (internal operational records,
-- outside the Draft → Proposed → Published workflow) plus the two
-- EntityType values their event/audit rows need. Strictly additive: no
-- existing table, column, enum value, or row is touched.
--
-- Uniqueness carries the confirmed product rule: normalized names are
-- unique INCLUDING archived rows (archive-only lifecycle, no hard delete,
-- no unarchive this sprint), so plain unique indexes — not partial ones —
-- are correct here.
--
-- Note: `ALTER TYPE ... ADD VALUE` is safe inside a transaction on
-- Postgres 12+ as long as the new value is not used in the same
-- transaction — true here: this migration only creates empty tables and
-- adds enum vocabulary; nothing inserts rows using the new values.

-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE 'CLIENT';
ALTER TYPE "EntityType" ADD VALUE 'BRAND';

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "notes" TEXT,
    "status" "LifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "notes" TEXT,
    "status" "LifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_normalizedName_key" ON "clients"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "brands_clientId_normalizedName_key" ON "brands"("clientId", "normalizedName");

-- CreateIndex
CREATE INDEX "brands_clientId_idx" ON "brands"("clientId");

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
