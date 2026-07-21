/*
 * Global Reconciliation sprint — regression coverage for the approved v3
 * design: each workspace module's `hasEffectivePendingWork()` contract
 * (lib/admin/talent-workspace-modules/*), and the shared
 * `reconcileTalentEditMode` flow (lib/admin/talent-workspace-reconciliation.js)
 * that consumes them.
 *
 * Per this codebase's established convention (see directPublish.test.js's
 * header comment), these tests exercise the real, unmodified
 * talentVersionPendingWork/galleryPendingWork/socialsPendingWork/
 * reconcileTalentEditMode/proposalService/versionService against
 * fakeTalentAdapter, not a live database. `pendingVersion`/`globalEditing`
 * themselves are not re-tested here — they are unchanged by this sprint;
 * versionService.getCurrentDraftOrProposed already has its own coverage
 * elsewhere.
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

vi.mock('../../repository/auditLogRepository', () => ({
  auditLogRepository: {
    async record() {
      return {};
    },
  },
}));

import { proposalService } from '../proposalService';
import { approvalService } from '../approvalService';
import { versionService } from '../versionService';
import { ROLE, VERSION_STATUS } from '../../constants/enums';
import { createFakeTalentAdapter } from './fakes/fakeTalentAdapter';
import { extractTalentVersionFields } from '../../talent-workspace';
import { talentVersionPendingWork } from '../../talent-workspace-modules/talentVersionPendingWork';
import { galleryPendingWork } from '../../talent-workspace-modules/galleryPendingWork';
import { socialsPendingWork } from '../../talent-workspace-modules/socialsPendingWork';
import { reconcileTalentEditMode } from '../../talent-workspace-reconciliation';

beforeEach(() => {
  hoisted.events.length = 0;
});

/** fakeTalentAdapter's getVersion/listVersionsForParent already return flat rows. */
function toFlatVersion(version) {
  if (!version) return version;
  const { fields, ...rest } = version;
  return fields ? { ...fields, ...rest } : { ...rest };
}

async function seedPublishedTalent(adapter, fields = { name: 'Dana Cohen' }) {
  const parent = adapter._seedParent();
  const { version: draft } = await proposalService.create(adapter, { parentId: parent.id, fields, actorId: 'owner-1' });
  await proposalService.submit(adapter, { parentId: parent.id, versionId: draft.id, actorId: 'owner-1' });
  const { version: published } = await approvalService.approve(adapter, {
    parentId: parent.id, versionId: draft.id, actorId: 'owner-1', actorRole: ROLE.OWNER, basedOnRevisionNumber: 0,
  });
  return { parent, published };
}

async function startEditing(adapter, { parentId, publishedVersion, actorId = 'owner-1' }) {
  const { version } = await proposalService.create(adapter, {
    parentId,
    fields: extractTalentVersionFields(toFlatVersion(publishedVersion)),
    actorId,
    basedOnVersionId: publishedVersion.id,
  });
  return version;
}

describe('talentVersionPendingWork.hasEffectivePendingWork', () => {
  it('is false when there is no pending version at all', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent } = await seedPublishedTalent(adapter);
    expect(await talentVersionPendingWork.hasEffectivePendingWork(adapter, parent.id)).toBe(false);
  });

  it('is true for a PROPOSED version, even if its fields are unchanged from baseline', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent, published } = await seedPublishedTalent(adapter);
    const draft = await startEditing(adapter, { parentId: parent.id, publishedVersion: published });
    await proposalService.submit(adapter, { parentId: parent.id, versionId: draft.id, actorId: 'owner-1' });
    expect(await talentVersionPendingWork.hasEffectivePendingWork(adapter, parent.id)).toBe(true);
  });

  it('is true for a DRAFT with real unpublished changes', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent, published } = await seedPublishedTalent(adapter);
    const draft = await startEditing(adapter, { parentId: parent.id, publishedVersion: published });
    await adapter.updateProposedVersion(draft.id, { bioHe: 'עדיין בעבודה' });
    expect(await talentVersionPendingWork.hasEffectivePendingWork(adapter, parent.id)).toBe(true);
  });

  it('is true for a DRAFT with no recorded baseline (unknown must never mean safe)', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();
    await proposalService.create(adapter, { parentId: parent.id, fields: { name: 'Brand New Talent' }, actorId: 'owner-1' });
    expect(await talentVersionPendingWork.hasEffectivePendingWork(adapter, parent.id)).toBe(true);
  });

  it('is false for a DRAFT that is a verbatim, untouched clone of its own baseline', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent, published } = await seedPublishedTalent(adapter);
    await startEditing(adapter, { parentId: parent.id, publishedVersion: published });
    expect(await talentVersionPendingWork.hasEffectivePendingWork(adapter, parent.id)).toBe(false);
  });
});

/*
 * Slug backfill false-positive fix — regression coverage for the exact bug
 * proven by the instrumented QA trace: "Start Editing" backfills a new
 * Draft's slug from the parent Talent's live slug whenever the baseline
 * Published version predates the slug column (baseline.slug === null) —
 * see app/api/admin/talent/[id]/proposals/route.js's own comment on that
 * fallback. That backfill is seeding behavior, not a user edit, but a plain
 * field-by-field comparison saw it as a real difference and misclassified
 * an otherwise completely untouched anchor Draft as effective pending work.
 *
 * `startEditingWithSlugBackfill` replicates that route's exact fallback
 * (`if (fields.slug == null) fields.slug = talent.slug`) — the plain
 * `startEditing()` helper above deliberately does not, so the other
 * describe blocks in this file keep testing the plain "verbatim clone"
 * case unaffected by this fix.
 */
async function startEditingWithSlugBackfill(adapter, { parent, publishedVersion, actorId = 'owner-1' }) {
  const fields = extractTalentVersionFields(toFlatVersion(publishedVersion));
  if (fields.slug == null) {
    fields.slug = parent.slug;
  }
  const { version } = await proposalService.create(adapter, {
    parentId: parent.id,
    fields,
    actorId,
    basedOnVersionId: publishedVersion.id,
  });
  return version;
}

describe('talentVersionPendingWork — slug backfill false-positive fix', () => {
  it('baseline slug null + Draft slug equals current Talent.slug -> unchanged', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent, published } = await seedPublishedTalent(adapter, { name: 'Dana Cohen', slug: null });
    parent.slug = 'dana-cohen';

    await startEditingWithSlugBackfill(adapter, { parent, publishedVersion: published });

    expect(await talentVersionPendingWork.hasEffectivePendingWork(adapter, parent.id)).toBe(false);
  });

  it('baseline slug null + Draft slug differs from current Talent.slug -> changed', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent, published } = await seedPublishedTalent(adapter, { name: 'Dana Cohen', slug: null });
    parent.slug = 'dana-cohen';

    const draft = await startEditingWithSlugBackfill(adapter, { parent, publishedVersion: published });
    // A genuine user edit to the slug field after Start Editing.
    await adapter.updateProposedVersion(draft.id, { slug: 'dana-cohen-updated' });

    expect(await talentVersionPendingWork.hasEffectivePendingWork(adapter, parent.id)).toBe(true);
  });

  it('baseline slug non-null + Draft slug differs -> changed', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent, published } = await seedPublishedTalent(adapter, { name: 'Dana Cohen', slug: 'dana-cohen' });
    parent.slug = 'dana-cohen';

    const draft = await startEditing(adapter, { parentId: parent.id, publishedVersion: published });
    await adapter.updateProposedVersion(draft.id, { slug: 'dana-cohen-new' });

    expect(await talentVersionPendingWork.hasEffectivePendingWork(adapter, parent.id)).toBe(true);
  });

  it('baseline slug non-null + same Draft slug -> unchanged', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent, published } = await seedPublishedTalent(adapter, { name: 'Dana Cohen', slug: 'dana-cohen' });
    parent.slug = 'dana-cohen';

    await startEditing(adapter, { parentId: parent.id, publishedVersion: published });

    expect(await talentVersionPendingWork.hasEffectivePendingWork(adapter, parent.id)).toBe(false);
  });

});

describe('talentVersionPendingWork.discardIfSafeAnchor', () => {
  it('discards an untouched anchor Draft', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent, published } = await seedPublishedTalent(adapter);
    const draft = await startEditing(adapter, { parentId: parent.id, publishedVersion: published });

    const result = await talentVersionPendingWork.discardIfSafeAnchor(adapter, {
      parentId: parent.id, actorId: 'owner-1', actorRole: ROLE.OWNER,
    });

    expect(result).toEqual({ discarded: true, versionId: draft.id });
    expect(await versionService.getCurrentDraftOrProposed(adapter, parent.id)).toBeNull();
  });

  it('never discards a PROPOSED version', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent, published } = await seedPublishedTalent(adapter);
    const draft = await startEditing(adapter, { parentId: parent.id, publishedVersion: published });
    await proposalService.submit(adapter, { parentId: parent.id, versionId: draft.id, actorId: 'owner-1' });

    const result = await talentVersionPendingWork.discardIfSafeAnchor(adapter, {
      parentId: parent.id, actorId: 'owner-1', actorRole: ROLE.OWNER,
    });

    expect(result).toEqual({ discarded: false, versionId: null });
    const after = await versionService.getCurrentDraftOrProposed(adapter, parent.id);
    expect(after.status).toBe(VERSION_STATUS.PROPOSED);
  });

  it('never discards a DRAFT with real unpublished changes', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent, published } = await seedPublishedTalent(adapter);
    const draft = await startEditing(adapter, { parentId: parent.id, publishedVersion: published });
    await adapter.updateProposedVersion(draft.id, { bioHe: 'עדיין בעבודה' });

    const result = await talentVersionPendingWork.discardIfSafeAnchor(adapter, {
      parentId: parent.id, actorId: 'owner-1', actorRole: ROLE.OWNER,
    });

    expect(result).toEqual({ discarded: false, versionId: null });
    const after = await versionService.getCurrentDraftOrProposed(adapter, parent.id);
    expect(after.id).toBe(draft.id);
  });

  it('is a safe no-op when there is no anchor at all', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent } = await seedPublishedTalent(adapter);
    const result = await talentVersionPendingWork.discardIfSafeAnchor(adapter, {
      parentId: parent.id, actorId: 'owner-1', actorRole: ROLE.OWNER,
    });
    expect(result).toEqual({ discarded: false, versionId: null });
  });
});

describe('galleryPendingWork / socialsPendingWork.hasEffectivePendingWork', () => {
  it('gallery is false with nothing pending, true once a DRAFT row exists', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();
    expect(await galleryPendingWork.hasEffectivePendingWork(adapter, parent.id)).toBe(false);
    adapter._seedGalleryImage({ talentId: parent.id, status: VERSION_STATUS.DRAFT });
    expect(await galleryPendingWork.hasEffectivePendingWork(adapter, parent.id)).toBe(true);
  });

  it('gallery is true for a PROPOSED row too', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();
    adapter._seedGalleryImage({ talentId: parent.id, status: VERSION_STATUS.PROPOSED });
    expect(await galleryPendingWork.hasEffectivePendingWork(adapter, parent.id)).toBe(true);
  });

  it('socials is false with nothing pending, true once a DRAFT row exists', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();
    expect(await socialsPendingWork.hasEffectivePendingWork(adapter, parent.id)).toBe(false);
    adapter._seedSocial({ talentId: parent.id, status: VERSION_STATUS.DRAFT });
    expect(await socialsPendingWork.hasEffectivePendingWork(adapter, parent.id)).toBe(true);
  });

  it('a pending row on a different talent does not count', async () => {
    const adapter = createFakeTalentAdapter();
    const parentA = adapter._seedParent();
    const parentB = adapter._seedParent();
    adapter._seedGalleryImage({ talentId: parentB.id, status: VERSION_STATUS.DRAFT });
    expect(await galleryPendingWork.hasEffectivePendingWork(adapter, parentA.id)).toBe(false);
  });
});

describe('reconcileTalentEditMode', () => {
  it('discards the anchor when nothing effective remains anywhere in the workspace', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent, published } = await seedPublishedTalent(adapter);
    const draft = await startEditing(adapter, { parentId: parent.id, publishedVersion: published });

    const result = await reconcileTalentEditMode(adapter, {
      parentId: parent.id, actorId: 'owner-1', actorRole: ROLE.OWNER,
    });

    expect(result).toEqual({ discardedVersionId: draft.id, hasUnpublishedWork: false });
    expect(await versionService.getCurrentDraftOrProposed(adapter, parent.id)).toBeNull();
  });

  it('preserves the anchor when Gallery still has real pending work', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent, published } = await seedPublishedTalent(adapter);
    const draft = await startEditing(adapter, { parentId: parent.id, publishedVersion: published });
    adapter._seedGalleryImage({ talentId: parent.id, status: VERSION_STATUS.DRAFT });

    const result = await reconcileTalentEditMode(adapter, {
      parentId: parent.id, actorId: 'owner-1', actorRole: ROLE.OWNER,
    });

    expect(result).toEqual({ discardedVersionId: null, hasUnpublishedWork: true });
    const after = await versionService.getCurrentDraftOrProposed(adapter, parent.id);
    expect(after.id).toBe(draft.id);
  });

  it('preserves the anchor when Socials still has real pending work', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent, published } = await seedPublishedTalent(adapter);
    const draft = await startEditing(adapter, { parentId: parent.id, publishedVersion: published });
    adapter._seedSocial({ talentId: parent.id, status: VERSION_STATUS.PROPOSED });

    const result = await reconcileTalentEditMode(adapter, {
      parentId: parent.id, actorId: 'owner-1', actorRole: ROLE.OWNER,
    });

    expect(result).toEqual({ discardedVersionId: null, hasUnpublishedWork: true });
    const after = await versionService.getCurrentDraftOrProposed(adapter, parent.id);
    expect(after.id).toBe(draft.id);
  });

  it('preserves the anchor when it is a DRAFT with real unpublished changes, regardless of other sections', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent, published } = await seedPublishedTalent(adapter);
    const draft = await startEditing(adapter, { parentId: parent.id, publishedVersion: published });
    await adapter.updateProposedVersion(draft.id, { bioHe: 'עדיין בעבודה' });

    const result = await reconcileTalentEditMode(adapter, {
      parentId: parent.id, actorId: 'owner-1', actorRole: ROLE.OWNER,
    });

    expect(result).toEqual({ discardedVersionId: null, hasUnpublishedWork: true });
    const after = await versionService.getCurrentDraftOrProposed(adapter, parent.id);
    expect(after.id).toBe(draft.id);
    expect(after.status).toBe(VERSION_STATUS.DRAFT);
  });

  it('never discards a PROPOSED anchor, even when nothing else is pending', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent, published } = await seedPublishedTalent(adapter);
    const draft = await startEditing(adapter, { parentId: parent.id, publishedVersion: published });
    const proposed = await proposalService.submit(adapter, { parentId: parent.id, versionId: draft.id, actorId: 'owner-1' });

    const result = await reconcileTalentEditMode(adapter, {
      parentId: parent.id, actorId: 'owner-1', actorRole: ROLE.OWNER,
    });

    expect(result).toEqual({ discardedVersionId: null, hasUnpublishedWork: true });
    const after = await versionService.getCurrentDraftOrProposed(adapter, parent.id);
    expect(after.id).toBe(proposed.id);
    expect(after.status).toBe(VERSION_STATUS.PROPOSED);
  });

  it('is a safe no-op when there is no anchor and nothing pending anywhere', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent } = await seedPublishedTalent(adapter);

    const result = await reconcileTalentEditMode(adapter, {
      parentId: parent.id, actorId: 'owner-1', actorRole: ROLE.OWNER,
    });

    expect(result).toEqual({ discardedVersionId: null, hasUnpublishedWork: false });
  });

  it('missing parentId is a no-op — nothing thrown', async () => {
    const adapter = createFakeTalentAdapter();
    const result = await reconcileTalentEditMode(adapter, { actorId: 'owner-1', actorRole: ROLE.OWNER });
    expect(result).toEqual({ discardedVersionId: null, hasUnpublishedWork: false });
  });

  it('fail-safe: a module whose check throws is treated as still-pending, and the anchor is preserved', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent, published } = await seedPublishedTalent(adapter);
    const draft = await startEditing(adapter, { parentId: parent.id, publishedVersion: published });

    // Gallery's own read throws (e.g. a transient DB error) — reconciliation
    // must never read that as "Gallery has nothing pending."
    const brokenAdapter = {
      ...adapter,
      async getDraftOrProposedGalleryImages() {
        throw new Error('simulated failure');
      },
    };

    const result = await reconcileTalentEditMode(brokenAdapter, {
      parentId: parent.id, actorId: 'owner-1', actorRole: ROLE.OWNER,
    });

    expect(result).toEqual({ discardedVersionId: null, hasUnpublishedWork: true });
    const after = await versionService.getCurrentDraftOrProposed(adapter, parent.id);
    expect(after.id).toBe(draft.id);
  });

  it('the Owner Direct Publish route sequence (submit -> approve -> reconcile) discards a leftover untouched anchor', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent, published } = await seedPublishedTalent(adapter);

    const olderDraft = await startEditing(adapter, { parentId: parent.id, publishedVersion: published });
    const targetDraft = await startEditing(adapter, { parentId: parent.id, publishedVersion: published });

    await proposalService.submit(adapter, { parentId: parent.id, versionId: targetDraft.id, actorId: 'owner-1' });
    await approvalService.approve(adapter, {
      parentId: parent.id, versionId: targetDraft.id, actorId: 'owner-1', actorRole: ROLE.OWNER,
      basedOnRevisionNumber: parent.revisionNumber,
    });

    const result = await reconcileTalentEditMode(adapter, {
      parentId: parent.id, actorId: 'owner-1', actorRole: ROLE.OWNER,
    });

    expect(result).toEqual({ discardedVersionId: olderDraft.id, hasUnpublishedWork: false });
    expect(await versionService.getCurrentDraftOrProposed(adapter, parent.id)).toBeNull();
  });
});
