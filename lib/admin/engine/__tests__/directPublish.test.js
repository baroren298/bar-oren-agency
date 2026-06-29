/*
 * Owner Direct Publish UX sprint — orchestration tests.
 *
 * These tests don't hit the new app/api/admin/talent/[id]/.../publish
 * route.js files directly (Next.js route handlers need a live request/
 * params object that's awkward to construct in this sandbox without a real
 * Next.js test harness — same constraint Sprint A's route tests worked
 * around). Instead, each test exercises the exact same sequence of engine
 * calls each new route performs, in the same order, against the same
 * services those routes import — proving the *orchestration* is correct and
 * that no new business logic was introduced (the explicit design goal of
 * this sprint: "do not weaken the approval model").
 *
 * Three things every test in this file is checking:
 *   1. An OWNER actor can go from DRAFT (or PROPOSED) straight to PUBLISHED
 *      in one composed call, using only proposalService.submit() +
 *      approvalService.approve() / galleryService.submit()+approve() /
 *      socialsService.submit()+approve() — the exact same engine methods
 *      the pre-existing Submit/Approve UI already uses.
 *   2. An EMPLOYEE actor is still rejected with a 403-shaped error at the
 *      approve step, even though submit (which EMPLOYEE may legitimately
 *      call) succeeds — proving direct publish does not create a new,
 *      weaker path to PUBLISHED for a non-Owner.
 *   3. "Nothing to submit" (every pending row already PROPOSED) is
 *      tolerated rather than treated as a hard failure, matching each
 *      route's own try/catch around the submit step.
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
import { galleryService } from '../galleryService';
import { socialsService } from '../socialsService';
import { ENTITY_TYPE, VERSION_STATUS, ROLE } from '../../constants/enums';
import { createFakeTalentAdapter } from './fakes/fakeTalentAdapter';

beforeEach(() => {
  hoisted.events.length = 0;
});

describe('Owner Direct Publish UX — TalentVersion orchestration', () => {
  it('OWNER: a DRAFT version reaches PUBLISHED via submit() + approve(), composed exactly like the new publish route', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();

    const { version: draft } = await proposalService.create(adapter, {
      parentId: parent.id,
      fields: { name: 'Dana Cohen' },
      actorId: 'owner-1',
    });
    expect(draft.status).toBe(VERSION_STATUS.DRAFT);

    // Step 1, only because it's DRAFT — mirrors the route's own guard.
    await proposalService.submit(adapter, { parentId: parent.id, versionId: draft.id, actorId: 'owner-1' });

    // Step 2 — same approvalService.approve() the existing Approve route uses.
    const { version: published, parent: updatedParent } = await approvalService.approve(adapter, {
      parentId: parent.id,
      versionId: draft.id,
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
      basedOnRevisionNumber: 0,
    });

    expect(published.status).toBe(VERSION_STATUS.PUBLISHED);
    expect(updatedParent.currentPublishedVersionId).toBe(draft.id);
  });

  it('OWNER: an already-PROPOSED version (e.g. submitted by an Employee) can be published directly, skipping the submit step', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();

    const { version: draft } = await proposalService.create(adapter, {
      parentId: parent.id,
      fields: { name: 'Dana Cohen' },
      actorId: 'employee-1',
    });
    const proposed = await proposalService.submit(adapter, {
      parentId: parent.id,
      versionId: draft.id,
      actorId: 'employee-1',
    });
    expect(proposed.status).toBe(VERSION_STATUS.PROPOSED);

    // Route's guard: status is already PROPOSED, so submit() is skipped
    // entirely — only approve() is called, exactly matching the route's
    // `if (existingVersion.status === VERSION_STATUS.DRAFT)` branch.
    const { version: published } = await approvalService.approve(adapter, {
      parentId: parent.id,
      versionId: proposed.id,
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
      basedOnRevisionNumber: 0,
    });

    expect(published.status).toBe(VERSION_STATUS.PUBLISHED);
  });

  it('EMPLOYEE: submit() succeeds (Employee may submit) but approve() still rejects with a 403-shaped error — direct publish does not weaken the approval model', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();

    const { version: draft } = await proposalService.create(adapter, {
      parentId: parent.id,
      fields: { name: 'Dana Cohen' },
      actorId: 'employee-1',
    });

    const proposed = await proposalService.submit(adapter, {
      parentId: parent.id,
      versionId: draft.id,
      actorId: 'employee-1',
    });
    expect(proposed.status).toBe(VERSION_STATUS.PROPOSED);

    await expect(
      approvalService.approve(adapter, {
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
});

/*
 * Minimal in-memory fake adapters for galleryService/socialsService — there
 * is no pre-existing fake for either (no test file existed for these two
 * services before this sprint). Scoped to only the methods each service
 * actually calls (see each service file's own header comments for the exact
 * list), enough to exercise the new publish routes' submit-then-approve-loop
 * orchestration without a live database.
 */
function createFakeGalleryAdapter() {
  let nextId = 1;
  const rows = new Map();

  return {
    entityType: ENTITY_TYPE.TALENT,
    _seedRow({ talentId, versionStatus = VERSION_STATUS.DRAFT, imageAssetId = 'asset-1' } = {}) {
      const id = `image-${nextId++}`;
      const row = { id, talentId, versionStatus, imageAssetId, order: 0 };
      rows.set(id, row);
      return row;
    },
    async getGalleryImageById(id) {
      return rows.get(id) || null;
    },
    async submitDraftGalleryImages(parentId) {
      const submitted = [];
      for (const row of rows.values()) {
        if (row.talentId === parentId && row.versionStatus === VERSION_STATUS.DRAFT) {
          row.versionStatus = VERSION_STATUS.PROPOSED;
          submitted.push(row);
        }
      }
      return submitted;
    },
    async approveGalleryImage(id, { approvedById } = {}) {
      const row = rows.get(id);
      row.versionStatus = VERSION_STATUS.PUBLISHED;
      row.approvedById = approvedById;
      return row;
    },
    async rejectGalleryImage(id, { rejectionNote } = {}) {
      const row = rows.get(id);
      row.versionStatus = VERSION_STATUS.REJECTED;
      row.rejectionNote = rejectionNote;
      return row;
    },
    _getRowsForParent(parentId) {
      return [...rows.values()].filter((r) => r.talentId === parentId);
    },
  };
}

function createFakeSocialsAdapter() {
  let nextId = 1;
  const rows = new Map();

  return {
    entityType: ENTITY_TYPE.TALENT,
    _seedRow({ talentId, versionStatus = VERSION_STATUS.DRAFT, platform = 'INSTAGRAM' } = {}) {
      const id = `social-${nextId++}`;
      const row = { id, talentId, versionStatus, platform, label: 'MAIN' };
      rows.set(id, row);
      return row;
    },
    async getSocialById(id) {
      return rows.get(id) || null;
    },
    async submitDraftSocials(parentId) {
      const submitted = [];
      for (const row of rows.values()) {
        if (row.talentId === parentId && row.versionStatus === VERSION_STATUS.DRAFT) {
          row.versionStatus = VERSION_STATUS.PROPOSED;
          submitted.push(row);
        }
      }
      return submitted;
    },
    async approveSocial(id, { approvedById } = {}) {
      const row = rows.get(id);
      row.versionStatus = VERSION_STATUS.PUBLISHED;
      row.approvedById = approvedById;
      return row;
    },
    async rejectSocial(id, { rejectionNote } = {}) {
      const row = rows.get(id);
      row.versionStatus = VERSION_STATUS.REJECTED;
      row.rejectionNote = rejectionNote;
      return row;
    },
  };
}

describe('Owner Direct Publish UX — Gallery orchestration (submit + approve loop)', () => {
  it('OWNER: every DRAFT row is submitted then approved, ending PUBLISHED — mirrors the new gallery/publish route', async () => {
    const adapter = createFakeGalleryAdapter();
    const talentId = 'talent-1';
    const row = adapter._seedRow({ talentId });

    await galleryService.submit(adapter, { parentId: talentId, actorId: 'owner-1' });
    expect((await adapter.getGalleryImageById(row.id)).versionStatus).toBe(VERSION_STATUS.PROPOSED);

    const { image } = await galleryService.approve(adapter, {
      parentId: talentId,
      imageId: row.id,
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
    });

    expect(image.versionStatus).toBe(VERSION_STATUS.PUBLISHED);
  });

  it('submit() tolerates "nothing to submit" when every row is already PROPOSED, matching the route\'s own try/catch', async () => {
    const adapter = createFakeGalleryAdapter();
    const talentId = 'talent-1';
    adapter._seedRow({ talentId, versionStatus: VERSION_STATUS.PROPOSED });

    await expect(galleryService.submit(adapter, { parentId: talentId, actorId: 'owner-1' })).rejects.toMatchObject({
      code: 'NOTHING_TO_SUBMIT',
    });

    // The route swallows exactly this error code and proceeds to re-read
    // PROPOSED rows — proven here by showing the row is still approvable
    // afterward.
    const rows = adapter._getRowsForParent(talentId);
    const { image } = await galleryService.approve(adapter, {
      parentId: talentId,
      imageId: rows[0].id,
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
    });
    expect(image.versionStatus).toBe(VERSION_STATUS.PUBLISHED);
  });

  it('EMPLOYEE: approve() rejects with a 403-shaped error even on a freshly-submitted row', async () => {
    const adapter = createFakeGalleryAdapter();
    const talentId = 'talent-1';
    const row = adapter._seedRow({ talentId });

    await galleryService.submit(adapter, { parentId: talentId, actorId: 'employee-1' });

    await expect(
      galleryService.approve(adapter, {
        parentId: talentId,
        imageId: row.id,
        actorId: 'employee-1',
        actorRole: ROLE.EMPLOYEE,
      })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN_ROLE' });
  });
});

describe('Owner Direct Publish UX — Socials orchestration (submit + approve loop)', () => {
  it('OWNER: every DRAFT row is submitted then approved, ending PUBLISHED — mirrors the new socials/publish route', async () => {
    const adapter = createFakeSocialsAdapter();
    const talentId = 'talent-1';
    const row = adapter._seedRow({ talentId });

    await socialsService.submit(adapter, { parentId: talentId, actorId: 'owner-1' });
    expect((await adapter.getSocialById(row.id)).versionStatus).toBe(VERSION_STATUS.PROPOSED);

    const { account } = await socialsService.approve(adapter, {
      parentId: talentId,
      socialId: row.id,
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
    });

    expect(account.versionStatus).toBe(VERSION_STATUS.PUBLISHED);
  });

  it('EMPLOYEE: approve() rejects with a 403-shaped error even on a freshly-submitted row', async () => {
    const adapter = createFakeSocialsAdapter();
    const talentId = 'talent-1';
    const row = adapter._seedRow({ talentId });

    await socialsService.submit(adapter, { parentId: talentId, actorId: 'employee-1' });

    await expect(
      socialsService.approve(adapter, {
        parentId: talentId,
        socialId: row.id,
        actorId: 'employee-1',
        actorRole: ROLE.EMPLOYEE,
      })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN_ROLE' });
  });
});
