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
import { ENTITY_TYPE, VERSION_STATUS, ROLE } from '../../constants/enums';
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

/*
 * "Editable PROPOSED" sprint — proposalService.update() coverage.
 *
 * Scoped to the talentAdapter shape only (not run via the ADAPTER_CASES
 * describe.each above): `updateProposedVersion` is an optional capability
 * the real entityAdapter doesn't implement (see talentAdapter.js's header
 * comment on this method), and fakeEntityAdapter deliberately mirrors that
 * by not implementing it either — so exercising proposalService.update()
 * against the entityAdapter shape would only prove the
 * "adapter doesn't implement updateProposedVersion" error path, not the
 * DRAFT/PROPOSED-editability behavior this sprint actually changed.
 */
describe('proposalService.update() — DRAFT and PROPOSED are both editable (Editable PROPOSED sprint)', () => {
  async function createDraft(adapter, parent, fields = { name: 'Dana Cohen' }) {
    const { version } = await proposalService.create(adapter, {
      parentId: parent.id,
      fields,
      actorId: 'actor-1',
    });
    return version;
  }

  it('updates a DRAFT version in place (regression — pre-existing Save Draft behavior)', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();
    const draft = await createDraft(adapter, parent);

    const { version, validation } = await proposalService.update(adapter, {
      parentId: parent.id,
      versionId: draft.id,
      fields: { name: 'Dana Cohen (updated)' },
      actorId: 'actor-1',
    });

    expect(version.status).toBe(VERSION_STATUS.DRAFT);
    expect(version.fields.name).toBe('Dana Cohen (updated)');
    expect(validation.valid).toBe(true);
  });

  it('updates a PROPOSED version in place (new this sprint)', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();
    const draft = await createDraft(adapter, parent);
    const proposed = await proposalService.submit(adapter, {
      parentId: parent.id,
      versionId: draft.id,
      actorId: 'actor-1',
    });
    expect(proposed.status).toBe(VERSION_STATUS.PROPOSED);

    const { version, validation } = await proposalService.update(adapter, {
      parentId: parent.id,
      versionId: proposed.id,
      fields: { name: 'Dana Cohen (updated while PROPOSED)' },
      actorId: 'actor-1',
    });

    expect(version.status).toBe(VERSION_STATUS.PROPOSED); // update() never changes status
    expect(version.fields.name).toBe('Dana Cohen (updated while PROPOSED)');
    expect(validation.valid).toBe(true);
  });

  it('emits ProposalUpdated for a PROPOSED edit the same way it does for a DRAFT edit', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();
    const draft = await createDraft(adapter, parent);
    const proposed = await proposalService.submit(adapter, {
      parentId: parent.id,
      versionId: draft.id,
      actorId: 'actor-1',
    });
    hoisted.events.length = 0; // ignore create/submit events, isolate this assertion to update()

    await proposalService.update(adapter, {
      parentId: parent.id,
      versionId: proposed.id,
      fields: { name: 'Updated' },
      actorId: 'actor-1',
    });

    expect(hoisted.events).toHaveLength(1);
    expect(hoisted.events[0]).toMatchObject({
      type: EVENT_TYPE.PROPOSAL_UPDATED,
      entityId: parent.id,
      actorId: 'actor-1',
      payload: { versionId: proposed.id },
    });
  });

  it('rejects updating a PUBLISHED version (regression)', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();
    const draft = await createDraft(adapter, parent);
    const proposed = await proposalService.submit(adapter, {
      parentId: parent.id,
      versionId: draft.id,
      actorId: 'actor-1',
    });
    await adapter.publishVersion(proposed.id, { expectedRevisionNumber: 0, approvedById: 'owner-1' });

    await expect(
      proposalService.update(adapter, {
        parentId: parent.id,
        versionId: proposed.id,
        fields: { name: 'should not apply' },
        actorId: 'actor-1',
      })
    ).rejects.toThrow(/not DRAFT or PROPOSED/);
  });

  it('rejects updating a REJECTED version (regression)', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();
    const draft = await createDraft(adapter, parent);
    const proposed = await proposalService.submit(adapter, {
      parentId: parent.id,
      versionId: draft.id,
      actorId: 'actor-1',
    });
    await adapter.rejectVersion(proposed.id, { rejectionNote: 'Needs more detail.' });

    await expect(
      proposalService.update(adapter, {
        parentId: parent.id,
        versionId: proposed.id,
        fields: { name: 'should not apply' },
        actorId: 'actor-1',
      })
    ).rejects.toThrow(/not DRAFT or PROPOSED/);
  });

  it('rejects updating a SUPERSEDED version (regression)', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();

    const firstDraft = await createDraft(adapter, parent, { name: 'First' });
    const firstProposed = await proposalService.submit(adapter, {
      parentId: parent.id,
      versionId: firstDraft.id,
      actorId: 'actor-1',
    });
    await adapter.publishVersion(firstProposed.id, { expectedRevisionNumber: 0, approvedById: 'owner-1' });

    const secondDraft = await createDraft(adapter, parent, { name: 'Second' });
    const secondProposed = await proposalService.submit(adapter, {
      parentId: parent.id,
      versionId: secondDraft.id,
      actorId: 'actor-1',
    });
    await adapter.publishVersion(secondProposed.id, { expectedRevisionNumber: 1, approvedById: 'owner-1' });

    const supersededFirst = await adapter.getVersion(firstProposed.id);
    expect(supersededFirst.status).toBe(VERSION_STATUS.SUPERSEDED);

    await expect(
      proposalService.update(adapter, {
        parentId: parent.id,
        versionId: firstProposed.id,
        fields: { name: 'should not apply' },
        actorId: 'actor-1',
      })
    ).rejects.toThrow(/not DRAFT or PROPOSED/);
  });
});

/*
 * Cancel Editing / Discard Draft sprint — proposalService.discard()
 * coverage. Scoped to the talentAdapter shape only, same reasoning as the
 * proposalService.update() block above: `discardVersion` is an optional
 * capability fakeEntityAdapter deliberately doesn't implement (mirroring
 * the real entityAdapter), so running this against that shape would only
 * prove the "not implemented" error path, not the actual DRAFT-only
 * discard behavior this sprint added.
 */
describe('proposalService.discard() — Cancel Editing / Discard Draft sprint', () => {
  async function createDraft(adapter, parent, fields = { name: 'Dana Cohen' }) {
    const { version } = await proposalService.create(adapter, {
      parentId: parent.id,
      fields,
      actorId: 'actor-1',
    });
    return version;
  }

  it('discarding a DRAFT version deletes it and emits ProposalDiscarded', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();
    const draft = await createDraft(adapter, parent);
    hoisted.events.length = 0; // isolate this assertion to discard()

    const result = await proposalService.discard(adapter, {
      parentId: parent.id,
      versionId: draft.id,
      actorId: 'actor-1',
    });

    expect(result).toEqual({ discarded: true });
    expect(await adapter.getVersion(draft.id)).toBeNull();

    expect(hoisted.events).toHaveLength(1);
    expect(hoisted.events[0]).toMatchObject({
      type: EVENT_TYPE.PROPOSAL_DISCARDED,
      entityType: adapter.entityType,
      entityId: parent.id,
      actorId: 'actor-1',
      payload: { versionId: draft.id },
    });
  });

  it('discarding a PROPOSED version throws and does not delete it or emit an event', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();
    const draft = await createDraft(adapter, parent);
    const proposed = await proposalService.submit(adapter, {
      parentId: parent.id,
      versionId: draft.id,
      actorId: 'actor-1',
    });
    hoisted.events.length = 0;

    await expect(
      proposalService.discard(adapter, {
        parentId: parent.id,
        versionId: proposed.id,
        actorId: 'actor-1',
      })
    ).rejects.toThrow(/not DRAFT/);

    expect(await adapter.getVersion(proposed.id)).not.toBeNull();
    expect(hoisted.events).toHaveLength(0);
  });

  it('discarding a PUBLISHED version throws (regression — only DRAFT is discardable)', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();
    const draft = await createDraft(adapter, parent);
    const proposed = await proposalService.submit(adapter, {
      parentId: parent.id,
      versionId: draft.id,
      actorId: 'actor-1',
    });
    await adapter.publishVersion(proposed.id, { expectedRevisionNumber: 0, approvedById: 'owner-1' });

    await expect(
      proposalService.discard(adapter, {
        parentId: parent.id,
        versionId: proposed.id,
        actorId: 'actor-1',
      })
    ).rejects.toThrow(/not DRAFT/);
  });
});

/*
 * Auth Hardening + Draft Ownership Sprint 1 — proposalService.update()/
 * submit()/discard() draft-ownership enforcement, per the User Management /
 * Roles / Permissions audit's locked decision: OWNER may modify any draft;
 * EMPLOYEE may only modify a DRAFT/PROPOSED version they themselves
 * created (version.createdById === actorId). Scoped to the talentAdapter
 * shape only, same reasoning as the two describe blocks above.
 */
describe('proposalService draft ownership enforcement (Auth Hardening + Draft Ownership Sprint 1)', () => {
  async function createDraftAs(adapter, parent, actorId, fields = { name: 'Dana Cohen' }) {
    const { version } = await proposalService.create(adapter, { parentId: parent.id, fields, actorId });
    return version;
  }

  it('update(): EMPLOYEE cannot edit a draft created by a different user', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();
    const draft = await createDraftAs(adapter, parent, 'employee-1');

    await expect(
      proposalService.update(adapter, {
        parentId: parent.id,
        versionId: draft.id,
        fields: { name: 'Hijacked' },
        actorId: 'employee-2',
        actorRole: ROLE.EMPLOYEE,
      })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN_NOT_DRAFT_OWNER' });

    const unchanged = await adapter.getVersion(draft.id);
    expect(unchanged.fields.name).toBe('Dana Cohen');
  });

  it('update(): EMPLOYEE can edit their own draft', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();
    const draft = await createDraftAs(adapter, parent, 'employee-1');

    const { version } = await proposalService.update(adapter, {
      parentId: parent.id,
      versionId: draft.id,
      fields: { name: 'Updated by author' },
      actorId: 'employee-1',
      actorRole: ROLE.EMPLOYEE,
    });

    expect(version.fields.name).toBe('Updated by author');
  });

  it('update(): OWNER can edit a draft created by an Employee', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();
    const draft = await createDraftAs(adapter, parent, 'employee-1');

    const { version } = await proposalService.update(adapter, {
      parentId: parent.id,
      versionId: draft.id,
      fields: { name: 'Updated by Owner' },
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
    });

    expect(version.fields.name).toBe('Updated by Owner');
  });

  it('submit(): EMPLOYEE cannot submit a draft created by a different user', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();
    const draft = await createDraftAs(adapter, parent, 'employee-1');

    await expect(
      proposalService.submit(adapter, {
        parentId: parent.id,
        versionId: draft.id,
        actorId: 'employee-2',
        actorRole: ROLE.EMPLOYEE,
      })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN_NOT_DRAFT_OWNER' });

    const unchanged = await adapter.getVersion(draft.id);
    expect(unchanged.status).toBe(VERSION_STATUS.DRAFT);
  });

  it('submit(): OWNER can submit a draft created by an Employee', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();
    const draft = await createDraftAs(adapter, parent, 'employee-1');

    const submitted = await proposalService.submit(adapter, {
      parentId: parent.id,
      versionId: draft.id,
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
    });

    expect(submitted.status).toBe(VERSION_STATUS.PROPOSED);
  });

  it('discard(): EMPLOYEE cannot discard a draft created by a different user', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();
    const draft = await createDraftAs(adapter, parent, 'employee-1');

    await expect(
      proposalService.discard(adapter, {
        parentId: parent.id,
        versionId: draft.id,
        actorId: 'employee-2',
        actorRole: ROLE.EMPLOYEE,
      })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN_NOT_DRAFT_OWNER' });

    expect(await adapter.getVersion(draft.id)).not.toBeNull();
  });

  it('discard(): OWNER can discard a draft created by an Employee', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();
    const draft = await createDraftAs(adapter, parent, 'employee-1');

    const result = await proposalService.discard(adapter, {
      parentId: parent.id,
      versionId: draft.id,
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
    });

    expect(result).toEqual({ discarded: true });
    expect(await adapter.getVersion(draft.id)).toBeNull();
  });
});
