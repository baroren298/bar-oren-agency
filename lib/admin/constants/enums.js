/*
 * Shared enum/status constants — Admin Panel Architecture v1.2, Sections
 * 3 (versioning), 4 (approval), 4.1 (audit), 5 (lifecycle/soft delete),
 * and 6 (optimistic locking).
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

/** Admin user role. Owner-only at launch; EDITOR is schema-ready (Section 11). */
export const ROLE = Object.freeze({
  OWNER: 'OWNER',
  EDITOR: 'EDITOR',
});

/**
 * Approval lifecycle for a single version/snapshot row (TalentVersion,
 * EntityVersion, SiteContent, Seo, LegalPage, TalentGalleryImage.versionStatus).
 */
export const VERSION_STATUS = Object.freeze({
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

/** Audit log action types (Section 4.1). */
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
