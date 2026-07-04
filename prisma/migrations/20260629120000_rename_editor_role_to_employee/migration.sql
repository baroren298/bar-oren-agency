-- OWNER/EMPLOYEE Permission Model Sprint.
--
-- Renames the Role enum's placeholder value EDITOR to EMPLOYEE. Safe as a
-- single statement: Postgres 10+ supports ALTER TYPE ... RENAME VALUE, and
-- no User row has ever used "EDITOR" (the User.role column defaults to
-- OWNER and no application code has ever written "EDITOR" to it — see
-- scripts/create-owner.mjs, the only writer of User.role), so this is a
-- pure schema rename, not a data migration. No existing row needs updating.
ALTER TYPE "Role" RENAME VALUE 'EDITOR' TO 'EMPLOYEE';
