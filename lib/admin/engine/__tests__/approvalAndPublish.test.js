/*
 * Sprint 3.8 — approvalService/publishService lifecycle and conflict tests.
 *
 * Covers, against both adapter shapes (criterion #8):
 *   - Full lifecycle DRAFT -> PROPOSED -> APPROVED -> PUBLISHED, end to end.
 *   - Section 13.17 #2: approve() records a decision and is independently
 *     testable from publish — proven here by exercising reject() in a
 *     scenario that never calls publish at all.
 *   - Section 13.17 #3: publish() is the only path that sets PUBLISHED,
 *     supersedes the prior version, and repoints the parent.
 *   - Section 13.17 #5: VersionPublished/ProposalApproved/ProposalRejected
 *     are all emitted via eventService.emit(), never written ad hoc.
 *   - Section 13.8: the authoritative, in-transaction conflict check
 *     blocks a stale-revision publish (no partial mutation on conflict).
 *
 * eventRepository/auditLogRepository are mocked in-memory — no live
 * database, no migration.
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
    async listForEntity() {
      return hoisted.events;
    },
    async listForCorrelationId() {
      return hoisted.events;
    },
  },
}));

vi.mock('../../repository/auditLogRepository', () => ({
  auditLogRepository: {
    async record() {
      return {};
    },
  },
}));

import { proposalService } from '../proposalService';
import { approvalService } from '../approvalService';
import { publishService } from '../publishService';
import { ENTITY_TYPE, VERSION_STATUS, REVISION_CONFLICT_ERROR_CODE, ROLE } from '../../constants/enums';
import { EVENT_TYPE } from '../eventTypes';
import { createFakeTalentAdapter } from './fakes/fakeTalentAdapter';
import { createFakeEntityAdapter } from './fakes/fakeEntityAdapter';

const ADAPTER_CASES = [
  ['talentAdapter shape', () => createFakeTalentAdapter(), { name: 'Dana Cohen' }],
  ['entityAdapter shape', () => createFakeEntityAdapter(ENTITY_TYPE.COLLABORATIONS), { brand: 'Acme' }],
];

beforeEach(() => {
  hoisted.events.length = 0;
});

/** Drives a parent from no version at all to one PROPOSED version, ready to approve/reject/publish. */
async function createAndSubmit(adapter, parent, fields, actorId = 'actor-1') {
  const { version } = await proposalService.create(adapter, { parentId: parent.id, fields, actorId });
  return proposalService.submit(adapter, { parentId: parent.id, versionId: version.id, actorId });
}

describe.each(ADAPTER_CASES)('approvalService + publishService — %s', (label, makeAdapter, fields) => {
  it('full lifecycle DRAFT -> PROPOSED -> APPROVED -> PUBLISHED works end to end', async () => {
    const adapter = makeAdapter();
    const parent = adapter._seedParent();

    const proposed = await createAndSubmit(adapter, parent, fields);
    expect(proposed.status).toBe(VERSION_STATUS.PROPOSED);

    const { version: published, parent: updatedParent } = await approvalService.approve(adapter, {
      parentId: parent.id,
      versionId: proposed.id,
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
      basedOnRevisionNumber: 0,
    });

    expect(published.status).toBe(VERSION_STATUS.PUBLISHED);
    expect(updatedParent.currentPublishedVersionId).toBe(proposed.id);
    expect(updatedParent.revisionNumber).toBe(1);

    expect(hoisted.events.map((e) => e.type)).toEqual([
      EVENT_TYPE.PROPOSAL_CREATED,
      EVENT_TYPE.PROPOSAL_SUBMITTED,
      EVENT_TYPE.VERSION_PUBLISHED,
      EVENT_TYPE.PROPOSAL_APPROVED,
    ]);
  });

  it('publish() supersedes the prior published version and repoints the parent atomically (criterion #3)', async () => {
    const adapter = makeAdapter();
    const parent = adapter._seedParent();

    const firstProposed = await createAndSubmit(adapter, parent, fields);
    const { version: firstPublished } = await approvalService.approve(adapter, {
      parentId: parent.id,
      versionId: firstProposed.id,
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
      basedOnRevisionNumber: 0,
    });
    expect(firstPublished.status).toBe(VERSION_STATUS.PUBLISHED);

    const secondProposed = await createAndSubmit(adapter, parent, fields);
    const { version: secondPublished, parent: parentAfterSecond } = await approvalService.approve(adapter, {
      parentId: parent.id,
      versionId: secondProposed.id,
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
      basedOnRevisionNumber: 1,
    });

    expect(secondPublished.status).toBe(VERSION_STATUS.PUBLISHED);
    expect(parentAfterSecond.currentPublishedVersionId).toBe(secondProposed.id);
    expect(parentAfterSecond.revisionNumber).toBe(2);

    const firstAfter = await adapter.getVersion(firstProposed.id);
    expect(firstAfter.status).toBe(VERSION_STATUS.SUPERSEDED);
  });

  it('reject() is independent of publish: a rejected proposal never publishes (criterion #2)', async () => {
    const adapter = makeAdapter();
    const parent = adapter._seedParent();
    const proposed = await createAndSubmit(adapter, parent, fields);

    const rejected = await approvalService.reject(adapter, {
      parentId: parent.id,
      versionId: proposed.id,
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
      rejectionNote: 'Needs more detail.',
    });

    expect(rejected.status).toBe(VERSION_STATUS.REJECTED);
    expect(rejected.rejectionNote).toBe('Needs more detail.');

    // No VersionPublished or ProposalApproved event exists anywhere in the stream.
    const types = hoisted.events.map((e) => e.type);
    expect(types).not.toContain(EVENT_TYPE.VERSION_PUBLISHED);
    expect(types).not.toContain(EVENT_TYPE.PROPOSAL_APPROVED);
    expect(types).toContain(EVENT_TYPE.PROPOSAL_REJECTED);

    // The parent was never touched.
    const parentAfter = await adapter.getParent(parent.id);
    expect(parentAfter.currentPublishedVersionId).toBeNull();
    expect(parentAfter.revisionNumber).toBe(0);
  });

  it('reject() requires a rejectionNote', async () => {
    const adapter = makeAdapter();
    const parent = adapter._seedParent();
    const proposed = await createAndSubmit(adapter, parent, fields);

    await expect(
      approvalService.reject(adapter, {
        parentId: parent.id,
        versionId: proposed.id,
        actorId: 'owner-1',
        actorRole: ROLE.OWNER,
      })
    ).rejects.toThrow(/rejectionNote is required/);
  });

  it('publish() only accepts a PROPOSED version — a DRAFT cannot be published directly', async () => {
    const adapter = makeAdapter();
    const parent = adapter._seedParent();
    const { version: draft } = await proposalService.create(adapter, { parentId: parent.id, fields, actorId: 'a1' });

    await expect(
      publishService.publish(adapter, {
        parentId: parent.id,
        versionId: draft.id,
        actorId: 'owner-1',
        actorRole: ROLE.OWNER,
      })
    ).rejects.toThrow(/not PROPOSED/);
  });

  it('approve() rejects an EMPLOYEE actor with a 403-shaped error (defense in depth, Section 11)', async () => {
    const adapter = makeAdapter();
    const parent = adapter._seedParent();
    const proposed = await createAndSubmit(adapter, parent, fields);

    await expect(
      approvalService.approve(adapter, {
        parentId: parent.id,
        versionId: proposed.id,
        actorId: 'employee-1',
        actorRole: ROLE.EMPLOYEE,
        basedOnRevisionNumber: 0,
      })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN_ROLE' });

    // No partial mutation: still PROPOSED, no VersionPublished/ProposalApproved emitted.
    const after = await adapter.getVersion(proposed.id);
    expect(after.status).toBe(VERSION_STATUS.PROPOSED);
    const types = hoisted.events.map((e) => e.type);
    expect(types).not.toContain(EVENT_TYPE.VERSION_PUBLISHED);
    expect(types).not.toContain(EVENT_TYPE.PROPOSAL_APPROVED);
  });

  it('reject() rejects an EMPLOYEE actor with a 403-shaped error (defense in depth, Section 11)', async () => {
    const adapter = makeAdapter();
    const parent = adapter._seedParent();
    const proposed = await createAndSubmit(adapter, parent, fields);

    await expect(
      approvalService.reject(adapter, {
        parentId: parent.id,
        versionId: proposed.id,
        actorId: 'employee-1',
        actorRole: ROLE.EMPLOYEE,
        rejectionNote: 'Needs more detail.',
      })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN_ROLE' });

    const after = await adapter.getVersion(proposed.id);
    expect(after.status).toBe(VERSION_STATUS.PROPOSED);
  });

  it('publish() rejects an EMPLOYEE actor with a 403-shaped error (defense in depth, Section 11)', async () => {
    const adapter = makeAdapter();
    const parent = adapter._seedParent();
    const proposed = await createAndSubmit(adapter, parent, fields);

    await expect(
      publishService.publish(adapter, {
        parentId: parent.id,
        versionId: proposed.id,
        actorId: 'employee-1',
        actorRole: ROLE.EMPLOYEE,
        basedOnRevisionNumber: 0,
      })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN_ROLE' });

    const after = await adapter.getVersion(proposed.id);
    expect(after.status).toBe(VERSION_STATUS.PROPOSED);
  });

  it('the authoritative, in-transaction conflict check blocks a stale-revision publish (Section 13.8)', async () => {
    const adapter = makeAdapter();
    const parent = adapter._seedParent();

    // Publish once for real, bumping the parent to revisionNumber 1.
    const firstProposed = await createAndSubmit(adapter, parent, fields);
    await approvalService.approve(adapter, {
      parentId: parent.id,
      versionId: firstProposed.id,
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
      basedOnRevisionNumber: 0,
    });

    // A second proposal that still thinks the parent is at revisionNumber 0
    // (e.g. an editor who started before the first publish landed).
    const staleProposed = await createAndSubmit(adapter, parent, fields);

    let caught;
    try {
      await publishService.publish(adapter, {
        parentId: parent.id,
        versionId: staleProposed.id,
        actorId: 'owner-2',
        actorRole: ROLE.OWNER,
        basedOnRevisionNumber: 0, // stale — parent is actually at 1
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeDefined();
    expect(caught.code).toBe(REVISION_CONFLICT_ERROR_CODE);
    expect(caught.conflict).toEqual({
      conflict: true,
      currentRevisionNumber: 1,
      basedOnRevisionNumber: 0,
    });

    // No partial mutation: the stale version is still PROPOSED, the parent
    // still points at the first publish, and no VersionPublished event for
    // the blocked attempt was ever emitted.
    const staleAfter = await adapter.getVersion(staleProposed.id);
    expect(staleAfter.status).toBe(VERSION_STATUS.PROPOSED);
    const parentAfter = await adapter.getParent(parent.id);
    expect(parentAfter.currentPublishedVersionId).toBe(firstProposed.id);
    expect(parentAfter.revisionNumber).toBe(1);

    const publishedEvents = hoisted.events.filter((e) => e.type === EVENT_TYPE.VERSION_PUBLISHED);
    expect(publishedEvents).toHaveLength(1); // only the first, successful publish
  });

  it('approve() never emits ProposalApproved if the underlying publish fails (no orphaned approval event)', async () => {
    const adapter = makeAdapter();
    const parent = adapter._seedParent();
    const firstProposed = await createAndSubmit(adapter, parent, fields);
    await approvalService.approve(adapter, {
      parentId: parent.id,
      versionId: firstProposed.id,
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
      basedOnRevisionNumber: 0,
    });

    const staleProposed = await createAndSubmit(adapter, parent, fields);
    await expect(
      approvalService.approve(adapter, {
        parentId: parent.id,
        versionId: staleProposed.id,
        actorId: 'owner-2',
        actorRole: ROLE.OWNER,
        basedOnRevisionNumber: 0, // stale
      })
    ).rejects.toMatchObject({ code: REVISION_CONFLICT_ERROR_CODE });

    const approvedEvents = hoisted.events.filter((e) => e.type === EVENT_TYPE.PROPOSAL_APPROVED);
    expect(approvedEvents).toHaveLength(1); // only the first, successful approve+publish
  });
});
