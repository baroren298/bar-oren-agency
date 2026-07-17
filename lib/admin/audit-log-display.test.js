/*
 * audit-log-display — unit tests (Administration Sprint 2c: Audit Log).
 *
 * Pure module, no mocks needed. Verifies the sprint's display rules:
 * narrative-first presentation, actor/target fallbacks, unknown
 * ActionType/EntityType graceful degradation, and — critically — that the
 * detail-row builder only ever renders the allowlisted fields the service
 * exposed and never invents or forwards anything else.
 */
import { describe, it, expect } from 'vitest';
import {
  buildNarrative,
  buildActionBadge,
  buildActionBadgeVariant,
  buildIconKey,
  buildDetailRows,
  buildAuditLogDisplayItems,
  formatRelativeTime,
  resolveActorName,
  resolveTargetText,
} from './audit-log-display';
import { he } from './i18n/he';

const OWNER_ACTOR = { displayName: 'בר', email: 'bar@example.com' };

function userEntry(overrides = {}) {
  return {
    id: 'log1',
    actionType: 'CREATED',
    entityType: 'USER',
    createdAt: '2026-07-15T10:00:00.000Z',
    actor: OWNER_ACTOR,
    targetLabel: 'נועה כהן',
    changedField: null,
    details: null,
    ...overrides,
  };
}

describe('resolveActorName', () => {
  it('prefers displayName, then email, then the system fallback', () => {
    expect(resolveActorName(OWNER_ACTOR)).toBe('בר');
    expect(resolveActorName({ displayName: null, email: 'a@b.co' })).toBe('a@b.co');
    expect(resolveActorName(null)).toBe(he.auditLog.systemActor);
  });
});

describe('resolveTargetText', () => {
  it('uses the resolved label when present', () => {
    expect(resolveTargetText(userEntry())).toBe('נועה כהן');
  });

  it('falls back to the entity-type noun, then the unknown noun', () => {
    expect(resolveTargetText(userEntry({ targetLabel: null }))).toBe(he.auditLog.targetNoun.USER);
    expect(resolveTargetText({ entityType: 'FUTURE_THING', targetLabel: null })).toBe(
      he.auditLog.targetNoun.unknown
    );
  });
});

describe('buildNarrative — USER rows', () => {
  it('renders the create-employee narrative with the target name', () => {
    expect(buildNarrative(userEntry())).toBe('בר יצר עובד חדש: נועה כהן');
  });

  it('renders the no-target create variant when no label resolved', () => {
    expect(buildNarrative(userEntry({ targetLabel: null }))).toBe('בר יצר עובד חדש');
  });

  it('distinguishes email vs displayName updates via changedField', () => {
    expect(buildNarrative(userEntry({ actionType: 'UPDATED', changedField: 'email' }))).toBe(
      'בר עדכן את כתובת האימייל של נועה כהן'
    );
    expect(buildNarrative(userEntry({ actionType: 'UPDATED', changedField: 'displayName' }))).toBe(
      'בר עדכן את שם התצוגה של נועה כהן'
    );
    expect(buildNarrative(userEntry({ actionType: 'UPDATED', changedField: null }))).toBe(
      'בר עדכן את הפרטים של נועה כהן'
    );
  });

  it('renders activation / deactivation / password reset narratives', () => {
    expect(buildNarrative(userEntry({ actionType: 'DEACTIVATED' }))).toBe('בר השבית את נועה כהן');
    expect(buildNarrative(userEntry({ actionType: 'ACTIVATED' }))).toBe('בר הפעיל את נועה כהן');
    expect(buildNarrative(userEntry({ actionType: 'PASSWORD_RESET' }))).toBe(
      'בר איפס סיסמה עבור נועה כהן'
    );
  });

  it('never hard-codes an owner name — the actual actor record is used', () => {
    const other = userEntry({ actor: { displayName: 'דנה', email: 'dana@example.com' } });
    expect(buildNarrative(other)).toBe('דנה יצר עובד חדש: נועה כהן');
  });

  it('Sprint 3b — renders single and all-sessions revocation narratives', () => {
    expect(buildNarrative(userEntry({ actionType: 'SESSION_REVOKED' }))).toBe(
      'בר ביטל התחברות פעילה של נועה כהן'
    );
    expect(buildNarrative(userEntry({ actionType: 'SESSIONS_REVOKED' }))).toBe(
      'בר ניתק את כל ההתחברויות הפעילות של נועה כהן'
    );
  });
});

describe('buildNarrative — content rows and fallbacks', () => {
  it('renders proposal narratives for TALENT rows', () => {
    const entry = userEntry({ entityType: 'TALENT', actionType: 'APPROVED', targetLabel: 'דנה לוי' });
    expect(buildNarrative(entry)).toBe('בר אישר הצעה עבור דנה לוי');
  });

  it('falls back gracefully for an unknown actionType', () => {
    const entry = userEntry({ actionType: 'SOME_FUTURE_ACTION' });
    expect(buildNarrative(entry)).toBe(
      he.auditLog.narrative.fallback.replace('{actor}', 'בר').replace('{target}', 'נועה כהן')
    );
  });

  it('falls back gracefully for an unknown entityType with a system actor', () => {
    const entry = userEntry({ entityType: 'FUTURE_ENTITY', actionType: 'LOGIN', actor: null, targetLabel: null });
    expect(buildNarrative(entry)).toBe(
      he.auditLog.narrative.fallback
        .replace('{actor}', he.auditLog.systemActor)
        .replace('{target}', he.auditLog.targetNoun.unknown)
    );
  });
});

describe('buildActionBadge / buildActionBadgeVariant', () => {
  it('translates known actions and passes unknown ones through raw', () => {
    expect(buildActionBadge('DEACTIVATED')).toBe(he.auditLog.badge.DEACTIVATED);
    expect(buildActionBadge('SOME_FUTURE_ACTION')).toBe('SOME_FUTURE_ACTION');
  });

  it('maps the approved semantic variants, neutral for unknown actions', () => {
    expect(buildActionBadgeVariant('CREATED')).toBe('created');
    expect(buildActionBadgeVariant('UPDATED')).toBe('updated');
    expect(buildActionBadgeVariant('APPROVED')).toBe('affirmed');
    expect(buildActionBadgeVariant('ACTIVATED')).toBe('affirmed');
    expect(buildActionBadgeVariant('DEACTIVATED')).toBe('negative');
    expect(buildActionBadgeVariant('REJECTED')).toBe('negative');
    expect(buildActionBadgeVariant('DELETED')).toBe('negative');
    expect(buildActionBadgeVariant('PASSWORD_RESET')).toBe('security');
    expect(buildActionBadgeVariant('PUBLISHED')).toBe('published');
    expect(buildActionBadgeVariant('SOME_FUTURE_ACTION')).toBe('neutral');
  });

  it('Sprint 3b — labels and badges session-revocation actions with the security tone', () => {
    expect(buildActionBadge('SESSION_REVOKED')).toBe(he.auditLog.badge.SESSION_REVOKED);
    expect(buildActionBadge('SESSIONS_REVOKED')).toBe(he.auditLog.badge.SESSIONS_REVOKED);
    expect(buildActionBadgeVariant('SESSION_REVOKED')).toBe('security');
    expect(buildActionBadgeVariant('SESSIONS_REVOKED')).toBe('security');
  });
});

describe('buildIconKey', () => {
  it('maps the approved conceptual icons, action semantics first', () => {
    expect(buildIconKey('CREATED', 'USER')).toBe('user');
    expect(buildIconKey('UPDATED', 'USER')).toBe('edit');
    expect(buildIconKey('PASSWORD_RESET', 'USER')).toBe('security');
    expect(buildIconKey('APPROVED', 'TALENT')).toBe('approve');
    expect(buildIconKey('ACTIVATED', 'USER')).toBe('approve');
    expect(buildIconKey('DEACTIVATED', 'USER')).toBe('reject');
    expect(buildIconKey('REJECTED', 'TALENT')).toBe('reject');
    expect(buildIconKey('PUBLISHED', 'TALENT')).toBe('publish');
  });

  it('gives unknown events a safe generic icon (user icon for USER rows)', () => {
    expect(buildIconKey('SOME_FUTURE_ACTION', 'FUTURE_ENTITY')).toBe('generic');
    expect(buildIconKey('SOME_FUTURE_ACTION', 'USER')).toBe('user');
  });

  it('Sprint 3b — session-revocation actions use the security icon', () => {
    expect(buildIconKey('SESSION_REVOKED', 'USER')).toBe('security');
    expect(buildIconKey('SESSIONS_REVOKED', 'USER')).toBe('security');
  });
});

describe('formatRelativeTime', () => {
  const NOW = Date.parse('2026-07-15T12:00:00.000Z');
  const at = (msAgo) => new Date(NOW - msAgo).toISOString();
  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;

  it('renders the approved Hebrew relative labels', () => {
    expect(formatRelativeTime(at(10 * 1000), NOW)).toBe(he.auditLog.time.justNow);
    expect(formatRelativeTime(at(90 * 1000), NOW)).toBe(he.auditLog.time.minuteAgo);
    expect(formatRelativeTime(at(12 * MIN), NOW)).toBe('לפני 12 דקות');
    expect(formatRelativeTime(at(1.5 * HOUR), NOW)).toBe(he.auditLog.time.hourAgo);
    expect(formatRelativeTime(at(2.5 * HOUR), NOW)).toBe(he.auditLog.time.twoHoursAgo);
    expect(formatRelativeTime(at(5 * HOUR), NOW)).toBe('לפני 5 שעות');
    expect(formatRelativeTime(at(30 * HOUR), NOW)).toBe(he.auditLog.time.yesterday);
  });

  it('returns null (exact date wins) for old, future, or invalid timestamps', () => {
    expect(formatRelativeTime(at(3 * 24 * HOUR), NOW)).toBeNull();
    expect(formatRelativeTime(at(-5 * MIN), NOW)).toBeNull(); // future/clock skew
    expect(formatRelativeTime('not-a-date', NOW)).toBeNull();
    expect(formatRelativeTime(at(MIN), undefined)).toBeNull();
  });
});

describe('buildDetailRows — allowlist enforcement', () => {
  it('returns [] when the service exposed no details', () => {
    expect(buildDetailRows(userEntry())).toEqual([]);
    expect(buildDetailRows({ details: undefined })).toEqual([]);
  });

  it('renders before → after rows for changed profile fields only', () => {
    const rows = buildDetailRows(
      userEntry({
        details: {
          changedFields: ['email', 'passwordHash'],
          before: { email: 'old@example.com' },
          after: { email: 'new@example.com' },
        },
      })
    );
    expect(rows).toEqual([
      { label: he.auditLog.details.email, value: 'old@example.com ← new@example.com' },
    ]);
  });

  it('renders creation snapshot rows for USER_CREATED details', () => {
    const rows = buildDetailRows(
      userEntry({
        details: { email: 'new@example.com', displayName: 'נועה כהן', role: 'EMPLOYEE' },
      })
    );
    expect(rows).toEqual([
      { label: he.auditLog.details.email, value: 'new@example.com' },
      { label: he.auditLog.details.displayName, value: 'נועה כהן' },
      { label: he.auditLog.details.role, value: he.roles.employee },
    ]);
  });

  it('never renders fields outside the allowlist, even if present', () => {
    const rows = buildDetailRows(
      userEntry({
        details: {
          email: 'a@b.co',
          passwordHash: '$2b$10$secret',
          token: 'abc',
          ipAddress: '1.2.3.4',
        },
      })
    );
    const rendered = JSON.stringify(rows);
    expect(rendered).not.toContain('secret');
    expect(rendered).not.toContain('abc');
    expect(rendered).not.toContain('1.2.3.4');
    expect(rows).toEqual([{ label: he.auditLog.details.email, value: 'a@b.co' }]);
  });

  it('Sprint 3b — renders a revokedCount row for a revoke-all, none for a single revoke', () => {
    const allRows = buildDetailRows(userEntry({ actionType: 'SESSIONS_REVOKED', details: { scope: 'all', revokedCount: 3 } }));
    expect(allRows).toEqual([{ label: he.auditLog.details.revokedCount, value: '3' }]);

    const singleRows = buildDetailRows(userEntry({ actionType: 'SESSION_REVOKED', details: { scope: 'single' } }));
    expect(singleRows).toEqual([]);
  });
});

describe('buildAuditLogDisplayItems', () => {
  it('is safe on empty/undefined input and projects the full item shape', () => {
    expect(buildAuditLogDisplayItems(undefined)).toEqual([]);
    const [item] = buildAuditLogDisplayItems([userEntry()]);
    expect(item).toEqual({
      id: 'log1',
      narrative: 'בר יצר עובד חדש: נועה כהן',
      badge: he.auditLog.badge.CREATED,
      badgeVariant: 'created',
      iconKey: 'user',
      createdAt: '2026-07-15T10:00:00.000Z',
      detailRows: [],
    });
  });
});
