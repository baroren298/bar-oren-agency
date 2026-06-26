/*
 * Core Content Engine barrel export. Sprint 3.2 added the Event Service
 * foundation; Sprint 3.3 adds conflictService, proposalService, and the
 * adapters/talentAdapter contract+implementation (ADMIN_PANEL_PLAN.md
 * Section 13.2). approvalService / publishService / auditService /
 * further adapters are later sprints — see Section 13.14 for the full
 * sub-phase sequence.
 */

export { eventService } from './eventService';
export { EVENT_TYPE, isValidEventType } from './eventTypes';
export { getListeners, registerListener } from './listeners';
export { conflictService } from './conflictService';
export { proposalService } from './proposalService';
export {
  assertImplementsAdapterContract,
  REQUIRED_ADAPTER_METHODS,
  REQUIRED_CAPABILITY_KEYS,
} from './adapters/adapterContract';
export { talentAdapter } from './adapters/talentAdapter';
