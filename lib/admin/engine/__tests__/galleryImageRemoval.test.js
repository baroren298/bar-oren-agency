/*
 * Gallery Image Removal sprint — galleryService.saveDraft() removal
 * coverage.
 *
 * Confirms the lifecycle approved for this sprint (see
 * galleryService.js's and talentRepository.js's updated header comments):
 *   - Removing a row with a live Published counterpart (the row itself is
 *     PUBLISHED) clones it into a new DRAFT row, lifecycleStatus HIDDEN,
 *     basedOnVersionId pointing at the still-live row — which is left
 *     completely untouched by saveDraft (approve/publish, unchanged, is
 *     what will eventually supersede it).
 *   - Removing/withdrawing a row that has no live Published counterpart
 *     (basedOnVersionId null, whether the row is currently DRAFT or
 *     PROPOSED) marks THAT SAME row lifecycleStatus HIDDEN in place — no
 *     clone, no versionStatus change. Nothing is public under that
 *     identity, so there is nothing to gate.
 *
 * Same minimal-fake-adapter approach as draftOwnership.test.js (no
 * dedicated galleryService test file existed before that sprint either) —
 * scoped to only the methods galleryService.saveDraft actually calls, with
 * lifecycleStatus added since that's exactly the field this sprint wires
 * through.
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

import { galleryService } from '../galleryService';
import { ENTITY_TYPE, VERSION_STATUS, LIFECYCLE_STATUS, ROLE } from '../../constants/enums';

beforeEach(() => {
  hoisted.events.length = 0;
});

/**
 * Minimal fake, scoped to only what galleryService.saveDraft calls.
 * lifecycleStatus is threaded through both insertDraftGalleryImage
 * (defaulting to ACTIVE, mirroring talentRepository's real default) and
 * updateGalleryImageFields (plain merge — Object.assign only overwrites
 * keys actually present in `fields`, and the real service always passes
 * `lifecycleStatus` explicitly when a removal is intended).
 */
function createFakeGalleryAdapter() {
  let nextId = 1;
  const rows = new Map();

  return {
    entityType: ENTITY_TYPE.TALENT,
    _seedRow({
      talentId,
      versionStatus = VERSION_STATUS.DRAFT,
      lifecycleStatus = LIFECYCLE_STATUS.ACTIVE,
      createdById = null,
      basedOnVersionId = null,
      imageAssetId = 'asset-1',
      order = 0,
    } = {}) {
      const id = `image-${nextId++}`;
      const row = {
        id,
        talentId,
        versionStatus,
        lifecycleStatus,
        createdById,
        basedOnVersionId,
        imageAssetId,
        order,
        altHe: null,
        altEn: null,
        position: null,
        scale: null,
        mobileOrder: null,
      };
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
        lifecycleStatus: fields.lifecycleStatus ?? LIFECYCLE_STATUS.ACTIVE,
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
      // Mirrors real Prisma update() semantics closely enough for this
      // suite: an explicit `undefined` in `fields` must not clobber the
      // existing value (Prisma omits undefined keys from the query
      // entirely). Object.assign does NOT have that behavior on its own,
      // so it's emulated here.
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) row[key] = value;
      }
      return row;
    },
  };
}

describe('galleryService.saveDraft() — removing a PUBLISHED image (has a live counterpart)', () => {
  it('clones the published row into a new HIDDEN draft, based on it, leaving the live row untouched', async () => {
    const adapter = createFakeGalleryAdapter();
    const talentId = 'talent-1';
    const published = adapter._seedRow({
      talentId,
      versionStatus: VERSION_STATUS.PUBLISHED,
      lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
      order: 2,
      altHe: 'תמונת במה',
    });

    const { images } = await galleryService.saveDraft(adapter, {
      parentId: talentId,
      images: [
        {
          id: published.id,
          order: published.order,
          altHe: published.altHe,
          altEn: published.altEn,
          position: published.position,
          scale: published.scale,
          mobileOrder: published.mobileOrder,
          lifecycleStatus: 'HIDDEN',
        },
      ],
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
    });

    expect(images).toHaveLength(1);
    const clone = images[0];
    expect(clone.id).not.toBe(published.id);
    expect(clone.versionStatus).toBe(VERSION_STATUS.DRAFT);
    expect(clone.basedOnVersionId).toBe(published.id);
    expect(clone.lifecycleStatus).toBe('HIDDEN');
    expect(clone.imageAssetId).toBe(published.imageAssetId);

    const stillLive = await adapter.getGalleryImageById(published.id);
    expect(stillLive.versionStatus).toBe(VERSION_STATUS.PUBLISHED);
    expect(stillLive.lifecycleStatus).toBe(LIFECYCLE_STATUS.ACTIVE);
  });
});

describe('galleryService.saveDraft() — removing a never-published image (no live counterpart)', () => {
  it('marks a never-submitted DRAFT row (basedOnVersionId null) HIDDEN in place, no clone created', async () => {
    const adapter = createFakeGalleryAdapter();
    const talentId = 'talent-1';
    const draft = adapter._seedRow({
      talentId,
      versionStatus: VERSION_STATUS.DRAFT,
      basedOnVersionId: null,
      createdById: 'owner-1',
      order: 0,
    });

    const { images } = await galleryService.saveDraft(adapter, {
      parentId: talentId,
      images: [{ id: draft.id, order: draft.order, lifecycleStatus: 'HIDDEN' }],
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
    });

    expect(images).toHaveLength(1);
    expect(images[0].id).toBe(draft.id); // same row, updated in place — no clone
    expect(images[0].versionStatus).toBe(VERSION_STATUS.DRAFT);
    expect(images[0].lifecycleStatus).toBe('HIDDEN');
    expect(images[0].basedOnVersionId).toBeNull();
  });

  it('withdrawing a submitted PROPOSED row (basedOnVersionId null) marks it HIDDEN in place, still PROPOSED', async () => {
    const adapter = createFakeGalleryAdapter();
    const talentId = 'talent-1';
    const proposed = adapter._seedRow({
      talentId,
      versionStatus: VERSION_STATUS.PROPOSED,
      basedOnVersionId: null,
      createdById: 'owner-1',
      order: 0,
    });

    const { images } = await galleryService.saveDraft(adapter, {
      parentId: talentId,
      images: [{ id: proposed.id, order: proposed.order, lifecycleStatus: 'HIDDEN' }],
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
    });

    expect(images).toHaveLength(1);
    expect(images[0].id).toBe(proposed.id); // same row, updated in place — no clone
    // saveDraft's update-in-place branch never changes versionStatus —
    // withdrawal doesn't need Submit/Approve to take effect, so the row is
    // left exactly where it was; it simply stops being ACTIVE.
    expect(images[0].versionStatus).toBe(VERSION_STATUS.PROPOSED);
    expect(images[0].lifecycleStatus).toBe('HIDDEN');
  });
});

describe('galleryService.saveDraft() — a normal (non-removal) edit leaves lifecycleStatus untouched', () => {
  it('editing altHe on an ACTIVE draft row does not implicitly flip lifecycleStatus', async () => {
    const adapter = createFakeGalleryAdapter();
    const talentId = 'talent-1';
    const draft = adapter._seedRow({
      talentId,
      versionStatus: VERSION_STATUS.DRAFT,
      lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
      createdById: 'owner-1',
    });

    const { images } = await galleryService.saveDraft(adapter, {
      parentId: talentId,
      images: [{ id: draft.id, order: 0, altHe: 'כותרת חדשה' }],
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
    });

    expect(images[0].altHe).toBe('כותרת חדשה');
    expect(images[0].lifecycleStatus).toBe(LIFECYCLE_STATUS.ACTIVE);
  });
});
