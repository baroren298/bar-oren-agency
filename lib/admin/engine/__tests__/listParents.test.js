/*
 * Sprint 4.1 — versionService.listParents() tests (ADMIN_PANEL_PLAN.md
 * Section 2's read-only `/admin/talent` roster list).
 *
 * Mirrors conflictService.test.js's pattern exactly: no mocking needed,
 * since listParents() only calls adapter.listParents() (which itself only
 * reads in-memory parent/version maps in the fakes, and a decision-free
 * Prisma query in the real repositories) — no eventService/repository
 * involvement at all.
 *
 * Run against both adapter shapes (describe.each), proving the one new
 * contract method (adapterContract.js's REQUIRED_ADAPTER_METHODS addition)
 * behaves identically through the same, unmodified versionService
 * regardless of which adapter backs it — the same genericity evidence
 * Phase 3's success criterion #8 (Section 13.17) established for the rest
 * of the engine.
 */
import { describe, it, expect } from 'vitest';
import { versionService } from '../versionService';
import { ENTITY_TYPE, VERSION_STATUS } from '../../constants/enums';
import { createFakeTalentAdapter } from './fakes/fakeTalentAdapter';
import { createFakeEntityAdapter } from './fakes/fakeEntityAdapter';

const ADAPTER_CASES = [
  ['talentAdapter shape', () => createFakeTalentAdapter()],
  ['entityAdapter shape', () => createFakeEntityAdapter(ENTITY_TYPE.COLLABORATIONS)],
];

describe.each(ADAPTER_CASES)('versionService.listParents — %s', (label, makeAdapter) => {
  it('returns an empty array when no parents have been created yet', async () => {
    const adapter = makeAdapter();
    const result = await versionService.listParents(adapter, {});
    expect(result).toEqual([]);
  });

  it('lists every parent with hasPublishedVersion/hasPendingChanges flags, no version content resolved', async () => {
    const adapter = makeAdapter();
    const published = adapter._seedParent({ status: 'ACTIVE' });
    const pending = adapter._seedParent({ status: 'ACTIVE' });
    const untouched = adapter._seedParent({ status: 'ACTIVE' });

    // published has a real published version
    const publishedVersion = await adapter.insertProposedVersion(
      { name: 'whatever this adapter shape requires' },
      { parentId: published.id, status: VERSION_STATUS.PROPOSED }
    );
    await adapter.publishVersion(publishedVersion.id, { approvedById: 'owner_1' });

    // pending has only a not-yet-decided version, nothing published
    await adapter.insertProposedVersion(
      { name: 'whatever this adapter shape requires' },
      { parentId: pending.id, status: VERSION_STATUS.PROPOSED }
    );

    const result = await versionService.listParents(adapter, {});
    const byId = Object.fromEntries(result.map((p) => [p.id, p]));

    expect(byId[published.id]).toMatchObject({ hasPublishedVersion: true, hasPendingChanges: false });
    expect(byId[pending.id]).toMatchObject({ hasPublishedVersion: false, hasPendingChanges: true });
    expect(byId[untouched.id]).toMatchObject({ hasPublishedVersion: false, hasPendingChanges: false });

    // Read-only contract: no row carries resolved version content/fields —
    // this method lists parents, it never shapes or exposes a version's
    // business data (that stays getVersion()/listVersionsForParent()'s job).
    for (const row of result) {
      expect(row).not.toHaveProperty('fields');
      expect(row).not.toHaveProperty('content');
    }
  });

  it('filters by status when one is supplied', async () => {
    const adapter = makeAdapter();
    adapter._seedParent({ status: 'ACTIVE' });
    const hidden = adapter._seedParent({ status: 'HIDDEN' });

    const result = await versionService.listParents(adapter, { status: 'HIDDEN' });
    expect(result.map((p) => p.id)).toEqual([hidden.id]);
  });
});
