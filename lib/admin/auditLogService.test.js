/*
 * auditLogService — unit tests (Administration Sprint 2c: Audit Log).
 *
 * auditLogRepository is mocked — this file verifies the service's own
 * rules: OWNER-only enforcement, the safe-DTO projection (metadata
 * allowlist, no raw row leakage, no sensitive fields), actor/target
 * resolution, unknown-enum tolerance, and cursor pagination via the N+1
 * fetch. The repository's Prisma queries are not re-proven here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  listRecent: vi.fn(),
  findUserLabels: vi.fn(),
  findTalentLabels: vi.fn(),
}));

vi.mock('./repository/auditLogRepository', () => ({
  auditLogRepository: {
    listRecent: hoisted.listRecent,
    findUserLabels: hoisted.findUserLabels,
    findTalentLabels: hoisted.findTalentLabels,
  },
}));

import { auditLogService, AUDIT_LOG_PAGE_SIZE } from './auditLogService';

const OWNER = { displayName: 'בר', email: 'bar@example.com' };

function row(overrides = {}) {
  return {
    id: 'log1',
    actionType: 'CREATED',
    entityType: 'USER',
    entityId: 'user-target-1',
    createdAt: new Date('2026-07-15T10:00:00.000Z'),
    metadataAfter: null,
    createdBy: null,
    updatedBy: null,
    approvedBy: null,
    rejectedBy: null,
    deletedBy: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  hoisted.listRecent.mockResolvedValue([]);
  hoisted.findUserLabels.mockResolvedValue(new Map());
  hoisted.findTalentLabels.mockResolvedValue(new Map());
});

describe('authorization', () => {
  it.each(['EMPLOYEE', null, undefined, 'owner'])(
    'rejects actorRole %s with a 403 before any repository read',
    async (actorRole) => {
      await expect(auditLogService.listEntries({ actorRole })).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN_ROLE',
      });
      expect(hoisted.listRecent).not.toHaveBeenCalled();
    }
  );

  it('allows OWNER', async () => {
    const result = await auditLogService.listEntries({ actorRole: 'OWNER' });
    expect(result).toEqual({ entries: [], nextCursor: null });
  });
});

describe('safe projection', () => {
  it('exposes only the DTO fields — never raw metadata or actor FKs', async () => {
    hoisted.listRecent.mockResolvedValue([
      row({
        updatedBy: OWNER,
        actionType: 'PASSWORD_RESET',
        metadataAfter: { anything: 'x', token: 'secret-token' },
      }),
    ]);
    hoisted.findUserLabels.mockResolvedValue(
      new Map([['user-target-1', { displayName: 'נועה כהן', email: 'noa@example.com' }]])
    );

    const { entries } = await auditLogService.listEntries({ actorRole: 'OWNER' });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      id: 'log1',
      actionType: 'PASSWORD_RESET',
      entityType: 'USER',
      createdAt: '2026-07-15T10:00:00.000Z',
      actor: { displayName: 'בר', email: 'bar@example.com' },
      targetLabel: 'נועה כהן',
      changedField: null,
      details: null, // nothing allowlisted in that metadata → no details at all
    });
    expect(JSON.stringify(entries)).not.toContain('secret-token');
    expect(entries[0]).not.toHaveProperty('entityId');
    expect(entries[0]).not.toHaveProperty('metadataAfter');
  });

  it('allowlists USER_CREATED payload fields and drops everything else', async () => {
    hoisted.listRecent.mockResolvedValue([
      row({
        createdBy: OWNER,
        metadataAfter: {
          email: 'noa@example.com',
          displayName: 'נועה כהן',
          role: 'EMPLOYEE',
          passwordHash: '$2b$10$never',
          ipAddress: '1.2.3.4',
        },
      }),
    ]);

    const { entries } = await auditLogService.listEntries({ actorRole: 'OWNER' });
    expect(entries[0].details).toEqual({
      email: 'noa@example.com',
      displayName: 'נועה כהן',
      role: 'EMPLOYEE',
    });
    const rendered = JSON.stringify(entries);
    expect(rendered).not.toContain('never');
    expect(rendered).not.toContain('1.2.3.4');
  });

  it('projects before/after through the email/displayName allowlist and derives changedField', async () => {
    hoisted.listRecent.mockResolvedValue([
      row({
        actionType: 'UPDATED',
        updatedBy: OWNER,
        metadataAfter: {
          changedFields: ['email'],
          before: { email: 'old@example.com', passwordHash: 'x' },
          after: { email: 'new@example.com' },
        },
      }),
    ]);

    const { entries } = await auditLogService.listEntries({ actorRole: 'OWNER' });
    expect(entries[0].changedField).toBe('email');
    expect(entries[0].details).toEqual({
      changedFields: ['email'],
      before: { email: 'old@example.com' },
      after: { email: 'new@example.com' },
    });
  });
});

describe('actor and target resolution', () => {
  it('handles a null/system actor (all five actor relations empty)', async () => {
    hoisted.listRecent.mockResolvedValue([row()]);
    const { entries } = await auditLogService.listEntries({ actorRole: 'OWNER' });
    expect(entries[0].actor).toBeNull();
  });

  it('resolves the actor from whichever relation is populated', async () => {
    hoisted.listRecent.mockResolvedValue([
      row({ actionType: 'APPROVED', entityType: 'TALENT', approvedBy: OWNER }),
    ]);
    const { entries } = await auditLogService.listEntries({ actorRole: 'OWNER' });
    expect(entries[0].actor).toEqual(OWNER);
  });

  it('labels TALENT targets via the talent label lookup', async () => {
    hoisted.listRecent.mockResolvedValue([
      row({ entityType: 'TALENT', entityId: 'talent1', actionType: 'PROPOSED', createdBy: OWNER }),
    ]);
    hoisted.findTalentLabels.mockResolvedValue(new Map([['talent1', { label: 'דנה לוי' }]]));

    const { entries } = await auditLogService.listEntries({ actorRole: 'OWNER' });
    expect(entries[0].targetLabel).toBe('דנה לוי');
    expect(hoisted.findTalentLabels).toHaveBeenCalledWith(['talent1']);
  });

  it('leaves targetLabel null for deleted targets and unknown entity types', async () => {
    hoisted.listRecent.mockResolvedValue([
      row(), // USER target that no longer resolves
      row({ id: 'log2', entityType: 'FUTURE_ENTITY', actionType: 'FUTURE_ACTION' }),
    ]);

    const { entries } = await auditLogService.listEntries({ actorRole: 'OWNER' });
    expect(entries[0].targetLabel).toBeNull();
    expect(entries[1].targetLabel).toBeNull();
    // Unknown enums pass through untouched — no throw, no translation here.
    expect(entries[1].actionType).toBe('FUTURE_ACTION');
    expect(entries[1].entityType).toBe('FUTURE_ENTITY');
  });
});

describe('pagination', () => {
  it('fetches PAGE_SIZE+1, returns PAGE_SIZE, and sets nextCursor to the last returned id', async () => {
    const rows = Array.from({ length: AUDIT_LOG_PAGE_SIZE + 1 }, (_, i) =>
      row({ id: `log${i}` })
    );
    hoisted.listRecent.mockResolvedValue(rows);

    const { entries, nextCursor } = await auditLogService.listEntries({ actorRole: 'OWNER' });
    expect(hoisted.listRecent).toHaveBeenCalledWith({
      limit: AUDIT_LOG_PAGE_SIZE + 1,
      cursor: null,
    });
    expect(entries).toHaveLength(AUDIT_LOG_PAGE_SIZE);
    expect(nextCursor).toBe(`log${AUDIT_LOG_PAGE_SIZE - 1}`);
  });

  it('returns nextCursor null on the last page and passes the cursor through', async () => {
    hoisted.listRecent.mockResolvedValue([row()]);
    const { nextCursor } = await auditLogService.listEntries({
      actorRole: 'OWNER',
      cursor: 'log50',
    });
    expect(hoisted.listRecent).toHaveBeenCalledWith({
      limit: AUDIT_LOG_PAGE_SIZE + 1,
      cursor: 'log50',
    });
    expect(nextCursor).toBeNull();
  });

  it('handles the empty audit log', async () => {
    const result = await auditLogService.listEntries({ actorRole: 'OWNER' });
    expect(result).toEqual({ entries: [], nextCursor: null });
  });
});
