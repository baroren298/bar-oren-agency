/*
 * Event repository — Sprint 3.2 (Core Content Engine, ADMIN_PANEL_PLAN.md
 * Section 13.3.1 / 13.6). Thin data-access layer over the `Event` table —
 * per Section 13.15 (Repositories are "query construction and
 * shape-mapping only") and Section 13.18 ("No Event writes outside
 * eventService"), this file is the ONLY place permitted to run a Prisma
 * query against `Event`, and `eventService.emit()`
 * (lib/admin/engine/eventService.js) is the only caller permitted to
 * invoke `create()` below. No other repository, service, adapter, or
 * route may write an Event row directly.
 *
 * Append-only per Section 13.16 ("Events are append-only") — there is
 * deliberately no `update`/`delete` method here.
 */

import { prisma } from '../db';

export const eventRepository = {
  /**
   * Append one Event row. Expected shape (Section 13.3.1):
   * { type, entityType, entityId, actorId, correlationId, payload, metadata }
   */
  async create({
    type,
    entityType,
    entityId,
    actorId = null,
    correlationId,
    payload = {},
    metadata = {},
  }) {
    return prisma.event.create({
      data: {
        type,
        entityType,
        entityId,
        actorId,
        correlationId,
        payload,
        metadata,
      },
    });
  },

  /** List events for a given entity, newest first. */
  async listForEntity(entityType, entityId) {
    return prisma.event.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * List every event sharing one correlationId, in chronological order —
   * the read path Section 13.6 exists to support (grouping every event
   * produced by one user action/transaction).
   */
  async listForCorrelationId(correlationId) {
    return prisma.event.findMany({
      where: { correlationId },
      orderBy: { createdAt: 'asc' },
    });
  },
};

export default eventRepository;
