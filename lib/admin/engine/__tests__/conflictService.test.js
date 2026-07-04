/*
 * Sprint 3.8 — conflictService unit tests (ADMIN_PANEL_PLAN.md Section
 * 13.14 sub-phase 3: "Build conflictService.js as a pure function,
 * unit-testable without a database transaction"). No mocking needed —
 * `checkRevision` only calls `adapter.getParent()`, so the two in-memory
 * fake adapters (fakeTalentAdapter, fakeEntityAdapter) are enough on their
 * own; no eventService/repository involvement at all.
 *
 * Run against both adapter shapes (describe.each) — a small, early piece of
 * evidence toward Phase 3 success criterion #8 (Section 13.17): the same
 * pure function behaves identically regardless of which adapter shape
 * backs `getParent`.
 */
import { describe, it, expect } from 'vitest';
import { conflictService } from '../conflictService';
import { ENTITY_TYPE } from '../../constants/enums';
import { createFakeTalentAdapter } from './fakes/fakeTalentAdapter';
import { createFakeEntityAdapter } from './fakes/fakeEntityAdapter';

const ADAPTER_CASES = [
  ['talentAdapter shape', () => createFakeTalentAdapter()],
  ['entityAdapter shape', () => createFakeEntityAdapter(ENTITY_TYPE.COLLABORATIONS)],
];

describe.each(ADAPTER_CASES)('conflictService.checkRevision — %s', (label, makeAdapter) => {
  it('returns no conflict and a null currentRevisionNumber when the parent does not exist yet', async () => {
    const adapter = makeAdapter();
    const result = await conflictService.checkRevision(adapter, {
      parentId: 'missing-parent',
      basedOnRevisionNumber: 0,
    });
    expect(result).toEqual({ conflict: false, currentRevisionNumber: null });
  });

  it('returns no conflict when the caller supplies no basedOnRevisionNumber', async () => {
    const adapter = makeAdapter();
    const parent = adapter._seedParent({ revisionNumber: 3 });
    const result = await conflictService.checkRevision(adapter, { parentId: parent.id });
    expect(result.conflict).toBe(false);
    expect(result.currentRevisionNumber).toBe(3);
  });

  it('returns no conflict when basedOnRevisionNumber matches the parent\'s live revisionNumber', async () => {
    const adapter = makeAdapter();
    const parent = adapter._seedParent({ revisionNumber: 2 });
    const result = await conflictService.checkRevision(adapter, {
      parentId: parent.id,
      basedOnRevisionNumber: 2,
    });
    expect(result).toEqual({ conflict: false, currentRevisionNumber: 2, basedOnRevisionNumber: 2 });
  });

  it('flags a conflict when basedOnRevisionNumber is stale', async () => {
    const adapter = makeAdapter();
    const parent = adapter._seedParent({ revisionNumber: 5 });
    const result = await conflictService.checkRevision(adapter, {
      parentId: parent.id,
      basedOnRevisionNumber: 4,
    });
    expect(result).toEqual({ conflict: true, currentRevisionNumber: 5, basedOnRevisionNumber: 4 });
  });

  it('never mutates the parent it reads (pure function)', async () => {
    const adapter = makeAdapter();
    const parent = adapter._seedParent({ revisionNumber: 7 });
    await conflictService.checkRevision(adapter, { parentId: parent.id, basedOnRevisionNumber: 1 });
    const after = await adapter.getParent(parent.id);
    expect(after.revisionNumber).toBe(7);
  });
});
