/*
  User Model Completion sprint (Sprint 2) — adds profile/management
  fields to the existing `users` table:

    - displayName: nullable, no backfill needed/possible (no source of
      truth for existing users' display names).
    - isActive: NOT NULL DEFAULT true, so every existing user (the
      current Owner account(s)) keeps logging in exactly as before this
      migration — no existing row is locked out.
    - lastLoginAt: nullable, populated going forward by the login route
      on every successful login. Existing rows stay null until their
      next successful login.

  Purely additive — no existing column, table, enum, or constraint is
  touched. Safe to run against a database with existing user rows.
*/

-- AlterTable
ALTER TABLE "users" ADD COLUMN "displayName" TEXT,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "lastLoginAt" TIMESTAMP(3);
