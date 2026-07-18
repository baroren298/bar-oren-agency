/*
 * Social Remove sprint — socialsService.saveDraft() removal coverage.
 *
 * Sibling to galleryImageRemoval.test.js — same fake-adapter approach, same
 * lifecycle claims, just for TalentSocial instead of TalentGalleryImage.
 * Confirms the lifecycle this sprint wires up (see socialsService.js's and
 * talentRepository.js's updated header comments):
 *   - Removing an account with a live Published counterpart (the row
 *     itself is PUBLISHED) clones it into a new DRAFT row, lifecycleStatus
 *     HIDDEN, basedOnVersionId pointing at the still-live row — which is
 *     left completely untouched by saveDraft.
 *   - Removing/withdrawing a row that has no live Published counterpart
 *     (basedOnVersionId null, whether the row is currently DRAFT or
 *     PROPOSED) marks THAT SAME row lifecycleStatus HIDDEN in place — no
 *     clone, no versionStatus change.
 *   - A normal (non-removal) field edit never implicitly touches
 *     lifecycleStatus.
 *   - A removal payload must carry the account's full existing business
 *     fields (platform/label/handle-or-url) — validateSocialAccount blocks
 *     a minimal `{ id, lifecycleStatus }` payload exactly like it would
 *     block any other incomplete account, which is *why*
 *     SocialLinksEditor.toComparablePayload always forwards the full row.
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

import { socialsService, SocialValidationError } from '../socialsService';
import { ENTITY_TYPE, VERSION_STATUS, LIFECYCLE_STATUS, ROLE } from '../../constants/enums';

beforeEach(() => {
  hoisted.events.length = 0;
});

/**
 * Minimal fake, scoped to only what socialsService.saveDraft calls.
 * lifecycleStatus is threaded through both insertDraftSocial (defaulting to
 * ACTIVE, mirroring talentRepository's real default) and updateSocialFields
 * (plain merge — Object.assign only overwrites keys actually present in
 * `fields`, and the real service always passes `lifecycleStatus` explicitly
 * when a removal is intended, since socialsService forwards the whole
 * account object as-is).
 */
function createFakeSocialsAdapter() {
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
      platform = 'INSTAGRAM',
      label = 'MAIN',
      handle = 'original-handle',
      url = null,
      sortOrder = 0,
    } = {}) {
      const id = `social-${nextId++}`;
      const row = {
        id,
        talentId,
        versionStatus,
        lifecycleStatus,
        createdById,
        basedOnVersionId,
        platform,
        label,
        customLabel: null,
        handle,
        url,
        sortOrder,
      };
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
        lifecycleStatus: fields.lifecycleStatus ?? LIFECYCLE_STATUS.ACTIVE,
        basedOnVersionId,
        createdById,
        platform: fields.platform,
        label: fields.label,
        customLabel: fields.customLabel ?? null,
        handle: fields.handle ?? null,
        url: fields.url ?? null,
        sortOrder: fields.sortOrder ?? null,
      };
      rows.set(id, row);
      return row;
    },
    async updateSocialFields(id, fields) {
      const row = rows.get(id);
      // Mirrors real Prisma update() semantics: an explicit `undefined` in
      // `fields` must not clobber the existing value.
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) row[key] = value;
      }
      return row;
    },
  };
}

describe('socialsService.saveDraft() — removing a PUBLISHED account (has a live counterpart)', () => {
  it('clones the published row into a new HIDDEN draft, based on it, leaving the live row untouched', async () => {
    const adapter = createFakeSocialsAdapter();
    const talentId = 'talent-1';
    const published = adapter._seedRow({
      talentId,
      versionStatus: VERSION_STATUS.PUBLISHED,
      lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
      platform: 'INSTAGRAM',
      label: 'MAIN',
      handle: 'almavay',
      url: 'https://instagram.com/almavay',
    });

    const { accounts } = await socialsService.saveDraft(adapter, {
      parentId: talentId,
      accounts: [
        {
          id: published.id,
          platform: published.platform,
          label: published.label,
          customLabel: published.customLabel,
          handle: published.handle,
          url: published.url,
          sortOrder: published.sortOrder,
          lifecycleStatus: 'HIDDEN',
        },
      ],
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
    });

    expect(accounts).toHaveLength(1);
    const clone = accounts[0];
    expect(clone.id).not.toBe(published.id);
    expect(clone.versionStatus).toBe(VERSION_STATUS.DRAFT);
    expect(clone.basedOnVersionId).toBe(published.id);
    expect(clone.lifecycleStatus).toBe('HIDDEN');
    expect(clone.handle).toBe(published.handle);

    const stillLive = await adapter.getSocialById(published.id);
    expect(stillLive.versionStatus).toBe(VERSION_STATUS.PUBLISHED);
    expect(stillLive.lifecycleStatus).toBe(LIFECYCLE_STATUS.ACTIVE);
  });
});

describe('socialsService.saveDraft() — removing a never-published account (no live counterpart)', () => {
  it('marks a never-submitted DRAFT row (basedOnVersionId null) HIDDEN in place, no clone created', async () => {
    const adapter = createFakeSocialsAdapter();
    const talentId = 'talent-1';
    const draft = adapter._seedRow({
      talentId,
      versionStatus: VERSION_STATUS.DRAFT,
      basedOnVersionId: null,
      createdById: 'owner-1',
      platform: 'TIKTOK',
      handle: 'new-account',
    });

    const { accounts } = await socialsService.saveDraft(adapter, {
      parentId: talentId,
      accounts: [
        {
          id: draft.id,
          platform: draft.platform,
          label: draft.label,
          handle: draft.handle,
          url: draft.url,
          lifecycleStatus: 'HIDDEN',
        },
      ],
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
    });

    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe(draft.id); // same row, updated in place — no clone
    expect(accounts[0].versionStatus).toBe(VERSION_STATUS.DRAFT);
    expect(accounts[0].lifecycleStatus).toBe('HIDDEN');
    expect(accounts[0].basedOnVersionId).toBeNull();
  });

  it('withdrawing a submitted PROPOSED row (basedOnVersionId null) marks it HIDDEN in place, still PROPOSED', async () => {
    const adapter = createFakeSocialsAdapter();
    const talentId = 'talent-1';
    const proposed = adapter._seedRow({
      talentId,
      versionStatus: VERSION_STATUS.PROPOSED,
      basedOnVersionId: null,
      createdById: 'owner-1',
      platform: 'FACEBOOK',
      handle: 'brand-new',
    });

    const { accounts } = await socialsService.saveDraft(adapter, {
      parentId: talentId,
      accounts: [
        {
          id: proposed.id,
          platform: proposed.platform,
          label: proposed.label,
          handle: proposed.handle,
          url: proposed.url,
          lifecycleStatus: 'HIDDEN',
        },
      ],
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
    });

    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe(proposed.id); // same row, updated in place — no clone
    // saveDraft's update-in-place branch never changes versionStatus —
    // withdrawal doesn't need Submit/Approve to take effect, so the row is
    // left exactly where it was; it simply stops being ACTIVE.
    expect(accounts[0].versionStatus).toBe(VERSION_STATUS.PROPOSED);
    expect(accounts[0].lifecycleStatus).toBe('HIDDEN');
  });
});

describe('socialsService.saveDraft() — a normal (non-removal) edit leaves lifecycleStatus untouched', () => {
  it('editing the handle on an ACTIVE draft row does not implicitly flip lifecycleStatus', async () => {
    const adapter = createFakeSocialsAdapter();
    const talentId = 'talent-1';
    const draft = adapter._seedRow({
      talentId,
      versionStatus: VERSION_STATUS.DRAFT,
      lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
      createdById: 'owner-1',
      handle: 'old-handle',
    });

    const { accounts } = await socialsService.saveDraft(adapter, {
      parentId: talentId,
      accounts: [
        {
          id: draft.id,
          platform: draft.platform,
          label: draft.label,
          handle: 'new-handle',
          url: draft.url,
        },
      ],
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
    });

    expect(accounts[0].handle).toBe('new-handle');
    expect(accounts[0].lifecycleStatus).toBe(LIFECYCLE_STATUS.ACTIVE);
  });
});

describe('socialsService.saveDraft() — removal payload validation (why the full account must be preserved)', () => {
  it('a removal payload carrying the full existing account fields passes validation', async () => {
    const adapter = createFakeSocialsAdapter();
    const talentId = 'talent-1';
    const published = adapter._seedRow({
      talentId,
      versionStatus: VERSION_STATUS.PUBLISHED,
      platform: 'YOUTUBE',
      label: 'MAIN',
      handle: 'channel',
      url: null,
    });

    await expect(
      socialsService.saveDraft(adapter, {
        parentId: talentId,
        accounts: [
          {
            id: published.id,
            platform: published.platform,
            label: published.label,
            customLabel: published.customLabel,
            handle: published.handle,
            url: published.url,
            sortOrder: published.sortOrder,
            lifecycleStatus: 'HIDDEN',
          },
        ],
        actorId: 'owner-1',
        actorRole: ROLE.OWNER,
      })
    ).resolves.toBeDefined();
  });

  it('a trimmed-down removal payload missing platform/label/handle-or-url fails validation — this is why toComparablePayload must never send just { id, lifecycleStatus }', async () => {
    const adapter = createFakeSocialsAdapter();
    const talentId = 'talent-1';
    const published = adapter._seedRow({
      talentId,
      versionStatus: VERSION_STATUS.PUBLISHED,
      platform: 'YOUTUBE',
      label: 'MAIN',
      handle: 'channel',
    });

    await expect(
      socialsService.saveDraft(adapter, {
        parentId: talentId,
        accounts: [{ id: published.id, lifecycleStatus: 'HIDDEN' }],
        actorId: 'owner-1',
        actorRole: ROLE.OWNER,
      })
    ).rejects.toBeInstanceOf(SocialValidationError);
  });
});
