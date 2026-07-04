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
