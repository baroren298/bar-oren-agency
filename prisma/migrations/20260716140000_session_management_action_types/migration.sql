-- Sprint 3b (Session Management API) — additive enum values only (Option B,
-- approved). Adds the two ActionType values that let Owner-initiated session
-- revocations project into the Audit Log with an honest narrative instead of
-- being flattened into UPDATED — same precedent as Sprint 2a's
-- ACTIVATED/DEACTIVATED/PASSWORD_RESET additions.
--
-- Strictly additive: no tables, columns, indexes, constraints, or existing
-- rows/values are touched. Must be applied before deploying the code that
-- emits UserSessionRevoked/UserSessionsRevoked (standard additive-migration
-- ordering, same as Sprint 2a).
--
-- Note: `ALTER TYPE ... ADD VALUE` is safe inside a transaction on
-- Postgres 12+ as long as the new value is not used in the same
-- transaction — true here, since this migration only adds values.

-- AlterEnum
ALTER TYPE "ActionType" ADD VALUE 'SESSION_REVOKED';
ALTER TYPE "ActionType" ADD VALUE 'SESSIONS_REVOKED';
