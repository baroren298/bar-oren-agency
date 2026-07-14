/*
 * Shared enum/status constants — Admin Panel Architecture v1.2, Sections
 * 3 (versioning), 4 (approval), 4.1 (audit), 5 (lifecycle/soft delete),
 * and 6 (optimistic locking). VERSION_STATUS.DRAFT added in Phase 3B.1
 * per v1.4 Section 13.3 (Core Content Engine).
 *
 * These mirror prisma/schema.prisma's enums string-for-string. They exist
 * as plain JS objects (not re-exports of the generated Prisma client) so
 * application code — including code that might run in contexts without
 * the Prisma client available, such as client components, validation
 * schemas, or tests — can reference the same status vocabulary without
 * importing @prisma/client.
 *
 * IMPORTANT: if an enum changes in prisma/schema.prisma, update the
 * matching object here in the same change. There is currently no
 * automated check enforcing the two stay in sync (acceptable for Phase 1;
 * worth revisiting once the schema is less likely to change shape).
 *
 * PHASE 1 NOTE: nothing in the public site imports from this module.
 */

/**
 * Admin user role — OWNER/EMPLOYEE Permission Model Sprint (Section 11).
 * OWNER (Bar Oren) can edit, draft, submit, approve, reject, and publish,
 * and can access every admin feature. EMPLOYEE can edit, draft, and submit
 * only — EMPLOYEE can never approve, reject, publish, or bypass the
 * approval flow. Renamed from the former placeholder value EDITOR.
 */
export const ROLE = Object.freeze({
  OWNER: 'OWNER',
  EMPLOYEE: 'EMPLOYEE',
});

/**
 * Approval lifecycle for a single version/snapshot row (TalentVersion,
 * EntityVersion, SiteContent, Seo, LegalPage, TalentGalleryImage.versionStatus).
 *
 * DRAFT added in Phase 3B.1 (ADMIN_PANEL_PLAN.md Section 13.3): a proposal
 * the author is still working on and hasn't submitted for review yet —
 * not visible in the approval queue until flipped to PROPOSED.
 */
export const VERSION_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  PROPOSED: 'PROPOSED',
  REJECTED: 'REJECTED',
  SUPERSEDED: 'SUPERSEDED',
});

/**
 * Visibility/lifecycle of an entity itself — independent axis from
 * VERSION_STATUS (Section 5). A Talent can be ACTIVE with a PROPOSED
 * pending edit, or HIDDEN with no pending edits at all.
 */
export const LIFECYCLE_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  HIDDEN: 'HIDDEN',
  ARCHIVED: 'ARCHIVED',
  DELETED: 'DELETED',
});

/**
 * Talent Publishing Status sprint (Phase 1) — public-website visibility of
 * a talent's PUBLISHED content. Versioned per TalentVersion (a normal
 * field, not a separate engine), default VISIBLE. Deliberately distinct
 * from LIFECYCLE_STATUS.HIDDEN above, which is an unrelated entity-level
 * soft-delete/lifecycle concept — see prisma/schema.prisma's
 * TalentVisibility/LifecycleStatus header comments for the full rationale.
 */
export const TALENT_VISIBILITY = Object.freeze({
  VISIBLE: 'VISIBLE',
  HIDDEN: 'HIDDEN',
});

/**
 * Audit log action types (Section 4.1).
 *
 * ACTIVATED / DEACTIVATED / PASSWORD_RESET — Administration Sprint 2a
 * (Audit Log): user-management action semantics. RESTORED/ARCHIVED are
 * entity-lifecycle concepts and deliberately NOT reused for account
 * enable/disable, so the audit narrative stays honest. Added to the
 * Postgres ActionType enum in the same sprint's additive migration
 * (prisma/migrations/20260714120000_audit_user_entity_and_action_types).
 */
export const ACTION_TYPE = Object.freeze({
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  PROPOSED: 'PROPOSED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  DELETED: 'DELETED',
  RESTORED: 'RESTORED',
  ARCHIVED: 'ARCHIVED',
  LOGIN: 'LOGIN',
  LOGIN_FAILED: 'LOGIN_FAILED',
  ACTIVATED: 'ACTIVATED',
  DEACTIVATED: 'DEACTIVATED',
  PASSWORD_RESET: 'PASSWORD_RESET',
});

/**
 * Polymorphic discriminator used by AuditLog, Seo, and the generic
 * Entity/EntityVersion pair.
 */
export const ENTITY_TYPE = Object.freeze({
  TALENT: 'TALENT',
  SITE_CONTENT: 'SITE_CONTENT',
  SEO: 'SEO',
  LEGAL_PAGE: 'LEGAL_PAGE',
  COLLABORATIONS: 'COLLABORATIONS',
  AGENCY_SOCIAL: 'AGENCY_SOCIAL',
  IMAGE_ASSET: 'IMAGE_ASSET',
  // Administration Sprint 2a (Audit Log) — target discriminator for
  // user-management events/audit rows. Same additive migration as the
  // ACTION_TYPE additions above.
  USER: 'USER',
});

/** Talent social platforms — matches data/talent/index.js's fixed set. */
export const SOCIAL_PLATFORM = Object.freeze({
  INSTAGRAM: 'INSTAGRAM',
  TIKTOK: 'TIKTOK',
  YOUTUBE: 'YOUTUBE',
});

/**
 * Statuses that should be excluded from default admin list views
 * (Section 5) — i.e. everything except ACTIVE/HIDDEN. Exposed as a helper
 * since "what counts as visible-by-default" is a decision worth making
 * once, here, rather than re-deriving it in every repository/UI filter.
 */
export const DEFAULT_HIDDEN_LIFECYCLE_STATUSES = Object.freeze([
  LIFECYCLE_STATUS.ARCHIVED,
  LIFECYCLE_STATUS.DELETED,
]);

/**
 * Error code stamped onto the error a repository's publish transaction
 * throws when it detects a stale revisionNumber (Section 13.8: the
 * authoritative conflict check happens inside publishService.publish()'s
 * own transaction, not a separate read-then-write). Sprint 3.4.
 *
 * Lives here, not in lib/admin/engine/, because a repository (e.g.
 * talentRepository.publishTalentVersion) must be able to throw it without
 * importing from the engine layer (Section 13.15: dependencies point
 * downward only — repositories never import lib/admin/engine/). Engine
 * code (publishService) checks `err.code === REVISION_CONFLICT_ERROR_CODE`
 * to recognize this specific, expected condition versus an unrelated
 * failure, then translates it into the same `{ conflict, currentRevisionNumber,
 * basedOnRevisionNumber }` shape conflictService's early check already
 * returns, so callers see one consistent conflict shape regardless of which
 * check caught it.
 */
export const REVISION_CONFLICT_ERROR_CODE = 'REVISION_CONFLICT';

/**
 * Talent SEO + Slug Management sprint — error codes stamped onto the error
 * talentRepository.publishTalentVersion's transaction throws when the
 * version being published proposes a slug that (a) another Talent already
 * owns (SLUG_CONFLICT — publishing must never silently steal or collide
 * with an existing public URL), or (b) fails the slug format contract
 * (SLUG_INVALID — the UI normalizes/validates as-you-type, but the publish
 * transaction is the authoritative server-side gate).
 *
 * Live here (not in lib/admin/engine/ or lib/admin/slug.js) for the same
 * layering reason as REVISION_CONFLICT_ERROR_CODE above: the repository
 * throws them, engine/API layers recognize them, and neither side should
 * import the other for a constant.
 */
export const SLUG_CONFLICT_ERROR_CODE = 'SLUG_CONFLICT';
export const SLUG_INVALID_ERROR_CODE = 'SLUG_INVALID';
