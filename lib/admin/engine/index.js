/*
 * Core Content Engine barrel export. Sprint 3.2 added the Event Service
 * foundation; Sprint 3.3 added conflictService, proposalService, and the
 * adapters/talentAdapter contract+implementation; Sprint 3.4 added
 * publishService and approvalService, wired so approve() calls publish()
 * in the same v1 composition (ADMIN_PANEL_PLAN.md Section 13.5). Sprint 3.5
 * adds versionService — the read-side service (Section 13.14 sub-phase 5)
 * that 3.3/3.4 skipped over, closing Phase 3 success criterion #4
 * (Section 13.17).
 * auditService / further adapters / getVersionForPreview are later
 * sprints — see Section 13.14 for the full sub-phase sequence.
 */

export { eventService } from './eventService';
export { EVENT_TYPE, isValidEventType } from './eventTypes';
export { getListeners, registerListener } from './listeners';
export { conflictService } from './conflictService';
export { proposalService } from './proposalService';
export { versionService } from './versionService';
export { publishService } from './publishService';
export { approvalService } from './approvalService';
export {
  assertImplementsAdapterContract,
  REQUIRED_ADAPTER_METHODS,
  REQUIRED_CAPABILITY_KEYS,
} from './adapters/adapterContract';
export { talentAdapter } from './adapters/talentAdapter';
