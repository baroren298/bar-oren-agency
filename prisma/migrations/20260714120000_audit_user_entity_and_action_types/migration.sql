-- Administration Sprint 2a (Audit Log) — additive enum values only.
--
-- Adds the vocabulary needed so user-management actions can be represented
-- in the existing event/audit pipeline (Event.entityType, AuditLog.entityType,
-- AuditLog.actionType). Strictly additive: no tables, columns, indexes,
-- constraints, or existing rows/values are touched, and nothing writes these
-- values yet (user-mutation event emission is Sprint 2b).
--
-- Note: `ALTER TYPE ... ADD VALUE` is safe inside a transaction on
-- Postgres 12+ as long as the new value is not used in the same
-- transaction — true here, since this migration only adds values.

-- AlterEnum
ALTER TYPE "ActionType" ADD VALUE 'ACTIVATED';
ALTER TYPE "ActionType" ADD VALUE 'DEACTIVATED';
ALTER TYPE "ActionType" ADD VALUE 'PASSWORD_RESET';

-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE 'USER';
