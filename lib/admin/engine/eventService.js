/*
 * EventService — Sprint 3.2 (ADMIN_PANEL_PLAN.md Section 13.2, 13.6,
 * 13.18). `emit()` is the ONLY way an Event row is ever created (Section
 * 13.18: "No Event writes outside eventService") — it is the sole caller
 * of `eventRepository.create()`. No other service, adapter, or route may
 * import eventRepository to write an Event; this is the seam.
 *
 * Generic and entity-agnostic per Section 13.9/13.16: this file contains
 * no entity-specific branching of any kind. Anything entity-specific
 * belongs in an adapter (lib/admin/engine/adapters/*, not built yet),
 * never here.
 */

import { eventRepository } from '../repository/eventRepository';
import { isValidEventType } from './eventTypes';
import { getListeners } from './listeners';

/** Collision-resistant id used when a caller doesn't supply a correlationId. */
function generateCorrelationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `corr_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Run every registered listener against the just-written event. A
 * listener that throws (or rejects) is caught and logged here (Section
 * 13.13) — it never propagates back to the caller of `emit()`, so a
 * broken listener can never fail the action that triggered the event
 * (e.g. a publish should not roll back because an audit listener threw).
 */
async function runListeners(event) {
  for (const listener of getListeners()) {
    try {
      await listener(event);
    } catch (err) {
      console.error(
        `[eventService] listener failed for event ${event.id} (type=${event.type}):`,
        err
      );
    }
  }
}

export const eventService = {
  /**
   * Emit one Event. Per Section 13.6:
   *  - `correlationId` is generated if omitted, so even an isolated call
   *    (a unit test, a one-off script) produces a valid, queryable id.
   *  - `payload` is business data only; `metadata` is technical/request
   *    context only (IP, user agent, request id, duration). This service
   *    does not inspect or reshape either — keeping them separate is the
   *    caller's responsibility, enforced by convention, not validation.
   *
   * After the Event row is written, every registered listener (see
   * ./listeners) runs against it, synchronously and in registration order.
   *
   * @param {string} type - must be a catalogued EVENT_TYPE (./eventTypes.js)
   * @param {object} params
   * @param {string} params.entityType
   * @param {string} params.entityId
   * @param {string|null} [params.actorId] - null for system-generated events
   * @param {string} [params.correlationId]
   * @param {object} [params.payload] - business data only
   * @param {object} [params.metadata] - technical/request context only
   * @returns {Promise<object>} the created Event row
   */
  async emit(
    type,
    { entityType, entityId, actorId = null, correlationId, payload = {}, metadata = {} } = {}
  ) {
    if (!type || !isValidEventType(type)) {
      throw new Error(
        `[eventService.emit] "${type}" is not a catalogued event type. ` +
          'Add it to lib/admin/engine/eventTypes.js first (Section 13.13: ' +
          'the naming convention must be fixed before ad hoc names are added).'
      );
    }
    if (!entityType || !entityId) {
      throw new Error('[eventService.emit] entityType and entityId are both required.');
    }

    const event = await eventRepository.create({
      type,
      entityType,
      entityId,
      actorId,
      correlationId: correlationId || generateCorrelationId(),
      payload,
      metadata,
    });

    await runListeners(event);

    return event;
  },
};

export default eventService;
