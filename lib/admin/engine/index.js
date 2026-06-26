/*
 * Core Content Engine barrel export — Sprint 3.2 seeds this with the
 * Event Service foundation only (ADMIN_PANEL_PLAN.md Section 13.2).
 * proposalService / approvalService / publishService / conflictService /
 * auditService / adapters are later sprints — see Section 13.14 for the
 * full sub-phase sequence.
 */

export { eventService } from './eventService';
export { EVENT_TYPE, isValidEventType } from './eventTypes';
export { getListeners, registerListener } from './listeners';
