/*
 * Repository layer barrel export — Phase 1 skeleton. See
 * ADMIN_PANEL_PLAN.md Section 1 ("Introduce a thin data-access layer...
 * so the admin's server code never talks to the database directly from
 * route handlers"). Most exports here are still stubs (Phase 1) — see
 * each file's header comment for which implementation phase fills it in.
 * `eventRepository` (Sprint 3.2) is a real implementation, used only by
 * lib/admin/engine/eventService.js.
 */

export { talentRepository } from './talentRepository';
export { assetRepository } from './assetRepository';
export { siteContentRepository } from './siteContentRepository';
export { seoRepository } from './seoRepository';
export { legalPageRepository } from './legalPageRepository';
export { entityRepository } from './entityRepository';
export { auditLogRepository } from './auditLogRepository';
export { userRepository } from './userRepository';
export { eventRepository } from './eventRepository';
export { dashboardRepository } from './dashboardRepository';
export { clientRepository } from './clientRepository';
export { brandRepository } from './brandRepository';
