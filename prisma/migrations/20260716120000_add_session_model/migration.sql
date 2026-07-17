-- Sprint 3a (Session Security Foundation) — additive only.
-- Creates the `sessions` table backing revocable admin logins
-- (SPRINT_3A_SESSION_SECURITY_PLAN.md Section B). No existing table,
-- column, enum, or migration is touched.
--
-- `id` is the JWT `sid` claim: generated app-side by
-- lib/admin/auth/sessionService.js via crypto.randomUUID(), so there is
-- deliberately no DB-side default. The raw JWT is never stored.

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessions_userId_revokedAt_idx" ON "sessions"("userId", "revokedAt");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
