/*
 * Auth Hardening + Draft Ownership Sprint 1 — socialsService/galleryService
 * draft-ownership coverage, per the User Management / Roles / Permissions
 * audit's locked decision: OWNER may modify any draft; EMPLOYEE may only
 * modify a DRAFT/PROPOSED row they themselves created
 * (`row.createdById === actorId`). No dedicated engine-level test file
 * existed for socialsService.saveDraft()/resumeRejected() or
 * galleryService.saveDraft()/resumeRejected() before this sprint — the
 * minimal fake adapters below are scoped to only the methods each service
 * actually calls, same approach directPublish.test.js already uses for its
 * own gallery/socials orchestration coverage.
 *
 * Also covers the submit()-scoping fix: since neither Social Links nor
 * Gallery "Submit" targets a single row by id, "EMPLOYEE may only submit
 * drafts they created" is enforced by forcing the createdById scope
 * (not by throwing) whenever actorRole isn't OWNER — see
 * socialsService.submit()/galleryService.submit()'s own header comments.
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

import { socialsService } from '../socialsService';
import { galleryService } from '../galleryService';
import { ENTITY_TYPE, VERSION_STATUS, ROLE } from '../../constants/enums';

beforeEach(() => {
  hoisted.events.length = 0;
});

/** Minimal fake, scoped to only what socialsService actually calls. */
function createFakeSocialsAdapter() {
  let nextId = 1;
  const rows = new Map();

  return {
    entityType: ENTITY_TYPE.TALENT,
    _seedRow({
      talentId,
      versionStatus = VERSION_STATUS.DRAFT,
      createdById = null,
      basedOnVersionId = null,
      platform = 'INSTAGRAM',
      label = 'MAIN',
      handle = 'original-handle',
    } = {}) {
      const id = `social-${nextId++}`;
      const row = { id, talentId, versionStatus, createdById, basedOnVersionId, platform, label, handle, url: null, sortOrder: 0 };
      rows.set(id, row);
      return row;
    },
    async getSocialById(id) {
      return rows.get(id) || null;
    },
    async insertDraftSocial(fields, { parentId, basedOnVersionId, createdById } = {}) {
      const id = `social-${nextId++}`;
      const row = {
        id,
        talentId: parentId,
        versionStatus: VERSION_STATUS.DRAFT,
        basedOnVersionId,
        createdById,
        platform: fields.platform,
        label: fields.label,
        customLabel: fields.customLabel,
        handle: fields.handle,
        url: fields.url,
        sortOrder: fields.sortOrder,
      };
      rows.set(id, row);
      return row;
    },
    async updateSocialFields(id, fields) {
      const row = rows.get(id);
      Object.assign(row, fields);
      return row;
    },
    /** Respects the createdById scope, unlike directPublish.test.js's fake — needed to prove the submit() scoping fix. */
    async submitDraftSocials(parentId, { createdById } = {}) {
      const submitted = [];
      for (const row of rows.values()) {
        if (row.talentId !== parentId || row.versionStatus !== VERSION_STATUS.DRAFT) continue;
        if (createdById && row.createdById !== createdById) continue;
        row.versionStatus = VERSION_STATUS.PROPOSED;
        submitted.push(row);
      }
      return submitted;
    },
  };
}

/** Minimal fake, scoped to only what galleryService actually calls. */
function createFakeGalleryAdapter() {
  let nextId = 1;
  const rows = new Map();

  return {
    entityType: ENTITY_TYPE.TALENT,
    _seedRow({
      talentId,
      versionStatus = VERSION_STATUS.DRAFT,
      createdById = null,
      basedOnVersionId = null,
      imageAssetId = 'asset-1',
    } = {}) {
      const id = `image-${nextId++}`;
      const row = { id, talentId, versionStatus, createdById, basedOnVersionId, imageAssetId, order: 0, altHe: null, altEn: null };
      rows.set(id, row);
      return row;
    },
    async getGalleryImageById(id) {
      return rows.get(id) || null;
    },
    async insertDraftGalleryImage(fields, { parentId, basedOnVersionId, createdById } = {}) {
      const id = `image-${nextId++}`;
      const row = {
        id,
        talentId: parentId,
        versionStatus: VERSION_STATUS.DRAFT,
        basedOnVersionId,
        createdById,
        imageAssetId: fields.imageAssetId,
        order: fields.order,
        altHe: fields.altHe,
        altEn: fields.altEn,
        position: fields.position,
        scale: fields.scale,
        mobileOrder: fields.mobileOrder,
      };
      rows.set(id, row);
      return row;
    },
    async updateGalleryImageFields(id, fields) {
      const row = rows.get(id);
      Object.assign(row, fields);
      return row;
    },
    /** Respects the createdById scope, unlike directPublish.test.js's fake — needed to prove the submit() scoping fix. */
    async submitDraftGalleryImages(parentId, { createdById } = {}) {
      const submitted = [];
      for (const row of rows.values()) {
        if (row.talentId !== parentId || row.versionStatus !== VERSION_STATUS.DRAFT) continue;
        if (createdById && row.createdById !== createdById) continue;
        row.versionStatus = VERSION_STATUS.PROPOSED;
        submitted.push(row);
      }
      return submitted;
    },
  };
}

describe('socialsService.saveDraft() draft ownership', () => {
  it('EMPLOYEE cannot edit a DRAFT row created by a different user', async () => {
    const adapter = createFakeSocialsAdapter();
    const talentId = 'talent-1';
    const row = adapter._seedRow({ talentId, createdById: 'employee-1' });

    await expect(
      socialsService.saveDraft(adapter, {
        parentId: talentId,
        accounts: [{ id: row.id, platform: 'INSTAGRAM', label: 'MAIN', handle: 'hijacked' }],
        actorId: 'employee-2',
        actorRole: ROLE.EMPLOYEE,
      })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN_NOT_DRAFT_OWNER' });

    expect((await adapter.getSocialById(row.id)).handle).toBe('original-handle');
  });

  it('EMPLOYEE can edit their own DRAFT row', async () => {
    const adapter = createFakeSocialsAdapter();
    const talentId = 'talent-1';
    const row = adapter._seedRow({ talentId, createdById: 'employee-1' });

    const { accounts } = await socialsService.saveDraft(adapter, {
      parentId: talentId,
      accounts: [{ id: row.id, platform: 'INSTAGRAM', label: 'MAIN', handle: 'updated-by-author' }],
      actorId: 'employee-1',
      actorRole: ROLE.EMPLOYEE,
    });

    expect(accounts[0].handle).toBe('updated-by-author');
  });

  it('OWNER can edit a DRAFT row created by an Employee', async () => {
    const adapter = createFakeSocialsAdapter();
    const talentId = 'talent-1';
    const row = adapter._seedRow({ talentId, createdById: 'employee-1' });

    const { accounts } = await socialsService.saveDraft(adapter, {
      parentId: talentId,
      accounts: [{ id: row.id, platform: 'INSTAGRAM', label: 'MAIN', handle: 'updated-by-owner' }],
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
    });

    expect(accounts[0].handle).toBe('updated-by-owner');
  });

  it('a brand-new account (no id) never triggers the ownership check — the actor always owns their own new draft', async () => {
    const adapter = createFakeSocialsAdapter();
    const talentId = 'talent-1';

    const { accounts } = await socialsService.saveDraft(adapter, {
      parentId: talentId,
      accounts: [{ platform: 'TIKTOK', label: 'MAIN', handle: 'new-account' }],
      actorId: 'employee-1',
      actorRole: ROLE.EMPLOYEE,
    });

    expect(accounts[0].createdById).toBe('employee-1');
  });
});

describe('socialsService.submit() scoping (Draft Ownership Sprint 1)', () => {
  it('EMPLOYEE submit only flips their own DRAFT rows, leaving another author\'s DRAFT rows untouched', async () => {
    const adapter = createFakeSocialsAdapter();
    const talentId = 'talent-1';
    const own = adapter._seedRow({ talentId, createdById: 'employee-1' });
    const others = adapter._seedRow({ talentId, createdById: 'owner-1' });

    const { accounts } = await socialsService.submit(adapter, {
      parentId: talentId,
      actorId: 'employee-1',
      actorRole: ROLE.EMPLOYEE,
    });

    expect(accounts.map((r) => r.id)).toEqual([own.id]);
    expect((await adapter.getSocialById(others.id)).versionStatus).toBe(VERSION_STATUS.DRAFT);
  });

  it('OWNER submit (plain route, no createdById override) still flips every DRAFT row regardless of author', async () => {
    const adapter = createFakeSocialsAdapter();
    const talentId = 'talent-1';
    const ownersRow = adapter._seedRow({ talentId, createdById: 'owner-1' });
    const employeesRow = adapter._seedRow({ talentId, createdById: 'employee-1' });

    const { accounts } = await socialsService.submit(adapter, {
      parentId: talentId,
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
    });

    expect(accounts.map((r) => r.id).sort()).toEqual([employeesRow.id, ownersRow.id].sort());
  });
});

describe('socialsService.resumeRejected() draft ownership', () => {
  it('EMPLOYEE cannot resume a REJECTED row created by a different user', async () => {
    const adapter = createFakeSocialsAdapter();
    const talentId = 'talent-1';
    const row = adapter._seedRow({ talentId, versionStatus: VERSION_STATUS.REJECTED, createdById: 'employee-1' });

    await expect(
      socialsService.resumeRejected(adapter, {
        parentId: talentId,
        socialId: row.id,
        actorId: 'employee-2',
        actorRole: ROLE.EMPLOYEE,
      })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN_NOT_DRAFT_OWNER' });
  });

  it('EMPLOYEE can resume their own REJECTED row', async () => {
    const adapter = createFakeSocialsAdapter();
    const talentId = 'talent-1';
    const row = adapter._seedRow({ talentId, versionStatus: VERSION_STATUS.REJECTED, createdById: 'employee-1' });

    const { account } = await socialsService.resumeRejected(adapter, {
      parentId: talentId,
      socialId: row.id,
      actorId: 'employee-1',
      actorRole: ROLE.EMPLOYEE,
    });

    expect(account.versionStatus).toBe(VERSION_STATUS.DRAFT);
  });

  it('OWNER can resume a REJECTED row created by an Employee', async () => {
    const adapter = createFakeSocialsAdapter();
    const talentId = 'talent-1';
    const row = adapter._seedRow({ talentId, versionStatus: VERSION_STATUS.REJECTED, createdById: 'employee-1' });

    const { account } = await socialsService.resumeRejected(adapter, {
      parentId: talentId,
      socialId: row.id,
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
    });

    expect(account.versionStatus).toBe(VERSION_STATUS.DRAFT);
  });
});

describe('galleryService.saveDraft() draft ownership', () => {
  it('EMPLOYEE cannot edit a DRAFT row created by a different user', async () => {
    const adapter = createFakeGalleryAdapter();
    const talentId = 'talent-1';
    const row = adapter._seedRow({ talentId, createdById: 'employee-1' });

    await expect(
      galleryService.saveDraft(adapter, {
        parentId: talentId,
        images: [{ id: row.id, order: 1, altHe: 'hijacked' }],
        actorId: 'employee-2',
        actorRole: ROLE.EMPLOYEE,
      })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN_NOT_DRAFT_OWNER' });

    expect((await adapter.getGalleryImageById(row.id)).altHe).toBeNull();
  });

  it('EMPLOYEE can edit their own DRAFT row', async () => {
    const adapter = createFakeGalleryAdapter();
    const talentId = 'talent-1';
    const row = adapter._seedRow({ talentId, createdById: 'employee-1' });

    const { images } = await galleryService.saveDraft(adapter, {
      parentId: talentId,
      images: [{ id: row.id, order: 1, altHe: 'updated-by-author' }],
      actorId: 'employee-1',
      actorRole: ROLE.EMPLOYEE,
    });

    expect(images[0].altHe).toBe('updated-by-author');
  });

  it('OWNER can edit a DRAFT row created by an Employee', async () => {
    const adapter = createFakeGalleryAdapter();
    const talentId = 'talent-1';
    const row = adapter._seedRow({ talentId, createdById: 'employee-1' });

    const { images } = await galleryService.saveDraft(adapter, {
      parentId: talentId,
      images: [{ id: row.id, order: 1, altHe: 'updated-by-owner' }],
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
    });

    expect(images[0].altHe).toBe('updated-by-owner');
  });

  it('EMPLOYEE cannot edit a legacy row with no known author (null createdById) — fails closed, not open', async () => {
    const adapter = createFakeGalleryAdapter();
    const talentId = 'talent-1';
    // versionStatus PUBLISHED with createdById: null is the real, documented
    // legacy shape (prisma/schema.prisma) — but the PUBLISHED branch always
    // clones into a brand-new draft the actor owns, so to exercise the
    // ownership guard itself this row is seeded already DRAFT/null-authored,
    // simulating a hypothetical edge case defensively.
    const row = adapter._seedRow({ talentId, versionStatus: VERSION_STATUS.DRAFT, createdById: null });

    await expect(
      galleryService.saveDraft(adapter, {
        parentId: talentId,
        images: [{ id: row.id, order: 1, altHe: 'attempted-edit' }],
        actorId: 'employee-1',
        actorRole: ROLE.EMPLOYEE,
      })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN_NOT_DRAFT_OWNER' });
  });
});

describe('galleryService.submit() scoping (Draft Ownership Sprint 1)', () => {
  it('EMPLOYEE submit only flips their own DRAFT rows, leaving another author\'s DRAFT rows untouched', async () => {
    const adapter = createFakeGalleryAdapter();
    const talentId = 'talent-1';
    const own = adapter._seedRow({ talentId, createdById: 'employee-1' });
    const others = adapter._seedRow({ talentId, createdById: 'owner-1' });

    const { images } = await galleryService.submit(adapter, {
      parentId: talentId,
      actorId: 'employee-1',
      actorRole: ROLE.EMPLOYEE,
    });

    expect(images.map((r) => r.id)).toEqual([own.id]);
    expect((await adapter.getGalleryImageById(others.id)).versionStatus).toBe(VERSION_STATUS.DRAFT);
  });

  it('OWNER submit (plain route, no createdById override) still flips every DRAFT row regardless of author', async () => {
    const adapter = createFakeGalleryAdapter();
    const talentId = 'talent-1';
    const ownersRow = adapter._seedRow({ talentId, createdById: 'owner-1' });
    const employeesRow = adapter._seedRow({ talentId, createdById: 'employee-1' });

    const { images } = await galleryService.submit(adapter, {
      parentId: talentId,
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
    });

    expect(images.map((r) => r.id).sort()).toEqual([employeesRow.id, ownersRow.id].sort());
  });
});

describe('galleryService.resumeRejected() draft ownership', () => {
  it('EMPLOYEE cannot resume a REJECTED row created by a different user', async () => {
    const adapter = createFakeGalleryAdapter();
    const talentId = 'talent-1';
    const row = adapter._seedRow({ talentId, versionStatus: VERSION_STATUS.REJECTED, createdById: 'employee-1' });

    await expect(
      galleryService.resumeRejected(adapter, {
        parentId: talentId,
        imageId: row.id,
        actorId: 'employee-2',
        actorRole: ROLE.EMPLOYEE,
      })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN_NOT_DRAFT_OWNER' });
  });

  it('EMPLOYEE can resume their own REJECTED row', async () => {
    const adapter = createFakeGalleryAdapter();
    const talentId = 'talent-1';
    const row = adapter._seedRow({ talentId, versionStatus: VERSION_STATUS.REJECTED, createdById: 'employee-1' });

    const { image } = await galleryService.resumeRejected(adapter, {
      parentId: talentId,
      imageId: row.id,
      actorId: 'employee-1',
      actorRole: ROLE.EMPLOYEE,
    });

    expect(image.versionStatus).toBe(VERSION_STATUS.DRAFT);
  });

  it('OWNER can resume a REJECTED row created by an Employee', async () => {
    const adapter = createFakeGalleryAdapter();
    const talentId = 'talent-1';
    const row = adapter._seedRow({ talentId, versionStatus: VERSION_STATUS.REJECTED, createdById: 'employee-1' });

    const { image } = await galleryService.resumeRejected(adapter, {
      parentId: talentId,
      imageId: row.id,
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
    });

    expect(image.versionStatus).toBe(VERSION_STATUS.DRAFT);
  });
});
