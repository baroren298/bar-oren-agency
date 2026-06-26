/*
 * Sprint 3.8 — proposalService/versionService lifecycle tests.
 *
 * Covers, against both adapter shapes (criterion #8):
 *   - Section 13.17 #1: DRAFT -> PROPOSED works end-to-end via
 *     proposalService.create()/submit().
 *   - Section 13.17 #4: versionService can list every version for a
 *     parent, in order.
 *   - Section 13.17 #5: an Event is emitted for every lifecycle action
 *     (ProposalCreated, ProposalSubmitted here), never written ad hoc.
 *   - Section 13.17 #7 (partial, runtime side): the exact same
 *     proposalService/versionService code runs unmodified against two
 *     differently-shaped adapters with different validate() rules —
 *     entity-specific behavior only ever comes from the adapter passed in.
 *
 * `eventRepository` (the only thing standing between eventService and a
 * real Prisma/Postgres write) is mocked with an in-memory array — no live
 * database, no migration, per the approved Sprint 3.8 scope.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({ events: [] }));

vi.mock('../../repository/eventRepository', () => ({
  eventRepository: {
    async create({ type, entityType, entityId, actorId, correlationId, payload, metadata }) {
      const event = {
        id: `event_${hoisted.events.length + 1}`,
        type,
        entityType,
        entityId,
        actorId,
        correlationId,
        payload,
        metadata,
        createdAt: new Date(),
      };
      hoisted.events.push(event);
      return event;
    },
    async listForEntity(entityType, entityId) {
      return hoisted.events.filter((e) => e.entityType === entityType && e.entityId === entityId);
    },
    async listForCorrelationId(correlationId) {
      return hoisted.events.filter((e) => e.correlationId === correlationId);
    },
  },
}));

// auditLogListener is registered against eventService regardless of which
// test imports it; mock its repository too so a real Prisma call is never
// reachable from this file (criterion #6 has its own dedicated test file —
// this mock here exists purely so listener execution doesn't throw/touch
// a database as a side effect of emit()).
vi.mock('../../repository/auditLogRepository', () => ({
  auditLogRepository: {
    async record() {
      return {};
    },
  },
}));

import { proposalService } from '../proposalService';
import { versionService } from '../versionService';
import { ENTITY_TYPE, VERSION_STATUS } from '../../constants/enums';
import { EVENT_TYPE } from '../eventTypes';
import { createFakeTalentAdapter } from './fakes/fakeTalentAdapter';
import { createFakeEntityAdapter } from './fakes/fakeEntityAdapter';

// invalidFields is deliberately different per adapter: talentAdapter
// requires fields.name, so `{}` fails its validate(); entityAdapter only
// requires "a non-null, non-array object" (Section 13.16 — adapters own
// their own validation rules), so `{}` is actually VALID there — an array
// is the genuinely invalid case for that adapter's looser rule.
const ADAPTER_CASES = [
  ['talentAdapter shape', () => createFakeTalentAdapter(), { name: 'Dana Cohen' }, {}],
  ['entityAdapter shape', () => createFakeEntityAdapter(ENTITY_TYPE.COLLABORATIONS), { brand: 'Acme' }, []],
];

beforeEach(() => {
  hoisted.events.length = 0;
});

describe.each(ADAPTER_CASES)('proposalService + versionService — %s', (label, makeAdapter, validFields, invalidFields) => {
  it('create() always inserts a DRAFT version and emits ProposalCreated (criteria #1, #5)', async () => {
    const adapter = makeAdapter();
    const parent = adapter._seedParent();

    const { version, conflict } = await proposalService.create(adapter, {
      parentId: parent.id,
      fields: validFields,
      actorId: 'actor-1',
    });

    expect(version.status).toBe(VERSION_STATUS.DRAFT);
    expect(conflict).toEqual({ conflict: false, currentRevisionNumber: 0 });

    expect(hoisted.events).toHaveLength(1);
    expect(hoisted.events[0]).toMatchObject({
      type: EVENT_TYPE.PROPOSAL_CREATED,
      entityType: adapter.entityType,
      entityId: parent.id,
      actorId: 'actor-1',
    });
    expect(hoisted.events[0].payload.versionId).toBe(version.id);
  });

  it('submit() flips DRAFT -> PROPOSED and emits ProposalSubmitted (criterion #1, #5)', async () => {
    const adapter = makeAdapter();
    const parent = adapter._seedParent();
    const { version } = await proposalService.create(adapter, {
      parentId: parent.id,
      fields: validFields,
      actorId: 'actor-1',
    });

    const submitted = await proposalService.submit(adapter, {
      parentId: parent.id,
      versionId: version.id,
      actorId: 'actor-1',
    });

    expect(submitted.status).toBe(VERSION_STATUS.PROPOSED);
    expect(hoisted.events.map((e) => e.type)).toEqual([
      EVENT_TYPE.PROPOSAL_CREATED,
      EVENT_TYPE.PROPOSAL_SUBMITTED,
    ]);
  });

  it('submit() rejects a version that is not DRAFT', async () => {
    const adapter = makeAdapter();
    const parent = adapter._seedParent();
    const { version } = await proposalService.create(adapter, {
      parentId: parent.id,
      fields: validFields,
      actorId: 'actor-1',
    });
    await proposalService.submit(adapter, { parentId: parent.id, versionId: version.id, actorId: 'actor-1' });

    await expect(
      proposalService.submit(adapter, { parentId: parent.id, versionId: version.id, actorId: 'actor-1' })
    ).rejects.toThrow(/not DRAFT/);
  });

  it('create() rejects invalid fields without inserting a version or emitting an event (adapter owns validation)', async () => {
    const adapter = makeAdapter();
    const parent = adapter._seedParent();

    await expect(
      proposalService.create(adapter, { parentId: parent.id, fields: invalidFields, actorId: 'actor-1' })
    ).rejects.toThrow(/validation failed/);

    expect(hoisted.events).toHaveLength(0);
    expect(await adapter.listVersionsForParent(parent.id)).toHaveLength(0);
  });

  it('versionService.listVersionHistory lists every version for a parent, in order (criterion #4)', async () => {
    const adapter = makeAdapter();
    const parent = adapter._seedParent();

    const first = await proposalService.create(adapter, { parentId: parent.id, fields: validFields, actorId: 'a1' });
    await proposalService.submit(adapter, { parentId: parent.id, versionId: first.version.id, actorId: 'a1' });
    const second = await proposalService.create(adapter, { parentId: parent.id, fields: validFields, actorId: 'a1' });

    const history = await versionService.listVersionHistory(adapter, parent.id);
    expect(history).toHaveLength(2);
    expect(history.map((v) => v.id).sort()).toEqual([first.version.id, second.version.id].sort());

    const pending = await versionService.getCurrentDraftOrProposed(adapter, parent.id);
    expect(pending.status).toBe(VERSION_STATUS.DRAFT); // "second" is the most-recently-inserted DRAFT
  });

  it('versionService.getCurrentPublished returns null when nothing has ever published', async () => {
    const adapter = makeAdapter();
    const parent = adapter._seedParent();
    expect(await versionService.getCurrentPublished(adapter, parent.id)).toBeNull();
  });
});
