/*
 * Sprint 3.8 — AuditLog-as-Event-projection tests (ADMIN_PANEL_PLAN.md
 * Section 13.7/13.17 #6: "AuditLog rows are generated from the Event
 * stream by auditLogListener, never written directly by any other code
 * path").
 *
 * Unlike the other Sprint 3.8 test files, this one does NOT mock
 * auditLogListener itself — it is the real, unmodified
 * lib/admin/engine/listeners/auditLogListener.js, registered exactly as it
 * is in production (lib/admin/engine/listeners/index.js). Only the two
 * Prisma-backed repositories underneath it (eventRepository,
 * auditLogRepository) are replaced with in-memory fakes, so the *real*
 * eventService -> listener -> auditLogRepository.record() call chain runs
 * end to end without a live database.
 *
 * Two things are verified:
 *   1. (Runtime) For a full create -> submit -> approve(+publish) cycle and
 *      a create -> submit -> reject cycle, the AuditLog rows that get
 *      written are exactly the ones auditLogListener's documented mapping
 *      predicts — including the deliberate, documented VERSION_PUBLISHED
 *      gap producing no row (a recognized no-op, not a bug — see that
 *      file's header).
 *   2. (Static) No engine service file other than auditLogListener.js
 *      imports auditLogRepository at all — i.e. there is no *other* code
 *      path in the engine that could write an AuditLog row even by
 *      accident.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const hoisted = vi.hoisted(() => ({ events: [], auditLogRows: [] }));

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
    async record(entry) {
      const row = { id: `audit_${hoisted.auditLogRows.length + 1}`, ...entry };
      hoisted.auditLogRows.push(row);
      return row;
    },
  },
}));

// publishService calls this after VERSION_PUBLISHED to invalidate the
// public talent ISR pages (see lib/admin/cache/revalidatePublicTalentPages.js).
// It imports next/cache's revalidatePath, which requires a live Next.js
// request/static-generation context that Vitest doesn't provide — mocked
// here as a no-op so publish() (triggered transitively via
// approvalService.approve()) can run outside that runtime.
vi.mock('../../cache/revalidatePublicTalentPages', () => ({
  revalidatePublicTalentPages: vi.fn(),
}));

import { proposalService } from '../proposalService';
import { approvalService } from '../approvalService';
import { eventService } from '../eventService';
import { ENTITY_TYPE, ACTION_TYPE, ROLE } from '../../constants/enums';
import { EVENT_TYPE } from '../eventTypes';
import { createFakeTalentAdapter } from './fakes/fakeTalentAdapter';

beforeEach(() => {
  hoisted.events.length = 0;
  hoisted.auditLogRows.length = 0;
});

async function createAndSubmit(adapter, parent, fields, actorId = 'actor-1') {
  const { version } = await proposalService.create(adapter, { parentId: parent.id, fields, actorId });
  return proposalService.submit(adapter, { parentId: parent.id, versionId: version.id, actorId });
}

describe('AuditLog as a projection of the Event stream (real auditLogListener, fake repositories)', () => {
  it('an approve (+publish) cycle produces CREATED, PROPOSED, APPROVED rows — and nothing for the publish step (documented gap)', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();

    const proposed = await createAndSubmit(adapter, parent, { name: 'Dana Cohen' });
    await approvalService.approve(adapter, {
      parentId: parent.id,
      versionId: proposed.id,
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
      basedOnRevisionNumber: 0,
    });

    // Event stream has all four lifecycle events...
    expect(hoisted.events.map((e) => e.type)).toEqual([
      EVENT_TYPE.PROPOSAL_CREATED,
      EVENT_TYPE.PROPOSAL_SUBMITTED,
      EVENT_TYPE.VERSION_PUBLISHED,
      EVENT_TYPE.PROPOSAL_APPROVED,
    ]);

    // ...but AuditLog only got three rows: VERSION_PUBLISHED has no mapping
    // yet (ActionType.PUBLISHED doesn't exist without a migration — out of
    // Sprint 3.8's scope, same as Sprint 3.7's documented gap) and the
    // listener treats that as an intentional no-op, not an error.
    expect(hoisted.auditLogRows.map((r) => r.actionType)).toEqual([
      ACTION_TYPE.CREATED,
      ACTION_TYPE.PROPOSED,
      ACTION_TYPE.APPROVED,
    ]);
    for (const row of hoisted.auditLogRows) {
      expect(row.entityType).toBe(ENTITY_TYPE.TALENT);
      expect(row.entityId).toBe(parent.id);
      expect(row.targetVersionId).toBe(proposed.id);
    }
  });

  it('a reject cycle produces CREATED, PROPOSED, REJECTED rows', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();

    const proposed = await createAndSubmit(adapter, parent, { name: 'Dana Cohen' });
    await approvalService.reject(adapter, {
      parentId: parent.id,
      versionId: proposed.id,
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
      rejectionNote: 'Not ready.',
    });

    expect(hoisted.auditLogRows.map((r) => r.actionType)).toEqual([
      ACTION_TYPE.CREATED,
      ACTION_TYPE.PROPOSED,
      ACTION_TYPE.REJECTED,
    ]);
  });

  it('every AuditLog row traces back to a real Event row one-to-one (no row appears that wasn\'t projected from an event)', async () => {
    const adapter = createFakeTalentAdapter();
    const parent = adapter._seedParent();
    const proposed = await createAndSubmit(adapter, parent, { name: 'Dana Cohen' });
    await approvalService.approve(adapter, {
      parentId: parent.id,
      versionId: proposed.id,
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
      basedOnRevisionNumber: 0,
    });

    // Every emitted event with a mapping produced exactly one row, in the
    // same order; events with no mapping (VERSION_PUBLISHED) produced none.
    const mappedEventCount = hoisted.events.filter((e) =>
      [EVENT_TYPE.PROPOSAL_CREATED, EVENT_TYPE.PROPOSAL_SUBMITTED, EVENT_TYPE.PROPOSAL_APPROVED].includes(e.type)
    ).length;
    expect(hoisted.auditLogRows).toHaveLength(mappedEventCount);
  });

  // ── Administration Sprint 2a (Audit Log) — user-management projections. ──
  // Nothing in the app emits these yet (emission is Sprint 2b); these tests
  // drive the real eventService -> real auditLogListener chain directly to
  // verify the mapping wired this sprint.
  describe('user-management event projections (Sprint 2a — mapping only, no emitters yet)', () => {
    const TARGET_USER_ID = 'user-target-1';
    const ACTING_OWNER_ID = 'owner-1';

    async function emitUserEvent(type, { payload = {}, metadata = {} } = {}) {
      return eventService.emit(type, {
        entityType: ENTITY_TYPE.USER,
        entityId: TARGET_USER_ID,
        actorId: ACTING_OWNER_ID,
        payload,
        metadata,
      });
    }

    it.each([
      [EVENT_TYPE.USER_CREATED, ACTION_TYPE.CREATED, 'createdById'],
      [EVENT_TYPE.USER_DETAILS_UPDATED, ACTION_TYPE.UPDATED, 'updatedById'],
      [EVENT_TYPE.USER_ACTIVATED, ACTION_TYPE.ACTIVATED, 'updatedById'],
      [EVENT_TYPE.USER_DEACTIVATED, ACTION_TYPE.DEACTIVATED, 'updatedById'],
      [EVENT_TYPE.USER_PASSWORD_RESET, ACTION_TYPE.PASSWORD_RESET, 'updatedById'],
    ])(
      '%s projects exactly one %s row with the target user as entityId and the actor under %s',
      async (eventType, expectedActionType, expectedActorField) => {
        await emitUserEvent(eventType);

        expect(hoisted.auditLogRows).toHaveLength(1);
        const row = hoisted.auditLogRows[0];
        expect(row.actionType).toBe(expectedActionType);
        expect(row.entityType).toBe(ENTITY_TYPE.USER);
        expect(row.entityId).toBe(TARGET_USER_ID);
        expect(row[expectedActorField]).toBe(ACTING_OWNER_ID);
        // User events have no version concept — never a targetVersionId.
        expect(row.targetVersionId).toBeNull();
      }
    );

    it('passes ipAddress/userAgent from event metadata through to the AuditLog columns', async () => {
      await emitUserEvent(EVENT_TYPE.USER_DEACTIVATED, {
        metadata: { ipAddress: '203.0.113.7', userAgent: 'TestBrowser/1.0' },
      });

      expect(hoisted.auditLogRows).toHaveLength(1);
      expect(hoisted.auditLogRows[0].ipAddress).toBe('203.0.113.7');
      expect(hoisted.auditLogRows[0].userAgent).toBe('TestBrowser/1.0');
    });

    it('leaves ipAddress/userAgent null when metadata does not carry them (all current emitters)', async () => {
      await emitUserEvent(EVENT_TYPE.USER_CREATED, {
        metadata: { requestId: 'req-1' },
      });

      expect(hoisted.auditLogRows).toHaveLength(1);
      expect(hoisted.auditLogRows[0].ipAddress).toBeNull();
      expect(hoisted.auditLogRows[0].userAgent).toBeNull();
    });

    it('stores the event payload as metadataAfter (allowlisted by the emitter — Sprint 2b contract)', async () => {
      const payload = { displayName: { before: 'Old', after: 'New' } };
      await emitUserEvent(EVENT_TYPE.USER_DETAILS_UPDATED, { payload });

      expect(hoisted.auditLogRows).toHaveLength(1);
      expect(hoisted.auditLogRows[0].metadataAfter).toEqual(payload);
    });
  });

  it('STATIC: no engine service file other than auditLogListener.js imports auditLogRepository', () => {
    const engineDir = path.resolve(__dirname, '..');
    const serviceFiles = fs
      .readdirSync(engineDir)
      .filter((f) => f.endsWith('.js') && fs.statSync(path.join(engineDir, f)).isFile());

    const offenders = [];
    for (const file of serviceFiles) {
      const contents = fs.readFileSync(path.join(engineDir, file), 'utf8');
      if (/repository\/auditLogRepository/.test(contents)) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });
});
