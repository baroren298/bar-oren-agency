/*
 * auditLogListener — Sprint 7B additions (client/brand projections).
 *
 * Verifies the six new EVENT_TYPE mappings project to
 * CREATED/UPDATED/ARCHIVED rows with the right entityType and actor
 * column — in particular that ARCHIVED (first ActionType.ARCHIVED
 * producer in the codebase) lands the actor under `deletedById`,
 * mirroring the entity's own archive attribution stamp. The existing
 * engine projections keep their coverage in
 * lib/admin/engine/__tests__/auditLogProjection.test.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  record: vi.fn(),
}));

vi.mock('../../repository/auditLogRepository', () => ({
  auditLogRepository: { record: hoisted.record },
}));

import { auditLogListener } from './auditLogListener';
import { EVENT_TYPE } from '../eventTypes';
import { ACTION_TYPE, ENTITY_TYPE } from '../../constants/enums';

function makeEvent(type, overrides = {}) {
  return {
    id: 'event-1',
    type,
    entityType: ENTITY_TYPE.CLIENT,
    entityId: 'client-1',
    actorId: 'owner-1',
    correlationId: 'corr-1',
    payload: { name: 'לקוח דמו א׳' },
    metadata: {},
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.record.mockResolvedValue({ id: 'audit-1' });
});

describe('auditLogListener — client/brand projections (Sprint 7B)', () => {
  it('projects ClientCreated → CREATED with the actor under createdById', async () => {
    await auditLogListener(makeEvent(EVENT_TYPE.CLIENT_CREATED));

    const entry = hoisted.record.mock.calls[0][0];
    expect(entry.actionType).toBe(ACTION_TYPE.CREATED);
    expect(entry.entityType).toBe(ENTITY_TYPE.CLIENT);
    expect(entry.entityId).toBe('client-1');
    expect(entry.createdById).toBe('owner-1');
  });

  it('projects ClientUpdated → UPDATED with the actor under updatedById', async () => {
    await auditLogListener(makeEvent(EVENT_TYPE.CLIENT_UPDATED));

    const entry = hoisted.record.mock.calls[0][0];
    expect(entry.actionType).toBe(ACTION_TYPE.UPDATED);
    expect(entry.updatedById).toBe('owner-1');
  });

  it('projects ClientArchived → ARCHIVED with the actor under deletedById', async () => {
    await auditLogListener(makeEvent(EVENT_TYPE.CLIENT_ARCHIVED));

    const entry = hoisted.record.mock.calls[0][0];
    expect(entry.actionType).toBe(ACTION_TYPE.ARCHIVED);
    expect(entry.deletedById).toBe('owner-1');
    expect(entry.createdById).toBeUndefined();
    expect(entry.updatedById).toBeUndefined();
  });

  it('projects the three Brand events with entityType BRAND', async () => {
    for (const [type, actionType] of [
      [EVENT_TYPE.BRAND_CREATED, ACTION_TYPE.CREATED],
      [EVENT_TYPE.BRAND_UPDATED, ACTION_TYPE.UPDATED],
      [EVENT_TYPE.BRAND_ARCHIVED, ACTION_TYPE.ARCHIVED],
    ]) {
      hoisted.record.mockClear();
      await auditLogListener(
        makeEvent(type, { entityType: ENTITY_TYPE.BRAND, entityId: 'brand-1' })
      );
      const entry = hoisted.record.mock.calls[0][0];
      expect(entry.actionType).toBe(actionType);
      expect(entry.entityType).toBe(ENTITY_TYPE.BRAND);
      expect(entry.entityId).toBe('brand-1');
    }
  });

  it('projects the allowlisted payload into metadataAfter as-is', async () => {
    await auditLogListener(
      makeEvent(EVENT_TYPE.CLIENT_UPDATED, {
        payload: { name: 'לקוח דמו א׳', changedFields: ['contactEmail'] },
      })
    );
    const entry = hoisted.record.mock.calls[0][0];
    expect(entry.metadataAfter).toEqual({ name: 'לקוח דמו א׳', changedFields: ['contactEmail'] });
  });
});
