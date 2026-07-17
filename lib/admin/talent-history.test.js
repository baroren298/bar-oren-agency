/*
 * Sprint 2: Real Event-Based History Timeline — unit tests for the pure
 * event → timeline projection in lib/admin/talent-history.js. No Prisma,
 * no I/O: every input is a plain object shaped like the rows
 * eventRepository.listForEntity / userRepository.getSafeByIds return.
 */

import { describe, it, expect } from 'vitest';
import {
  buildEventTimelineItems,
  buildTalentHistoryTimelineItems,
  collectEventActorIds,
  buildActorDisplayMap,
  resolveEventDomain,
} from './talent-history';
import { he } from './i18n/he';
import { VERSION_STATUS } from './constants/enums';

let eventCounter = 0;
function makeEvent(type, overrides = {}) {
  eventCounter += 1;
  return {
    id: `evt-${eventCounter}`,
    type,
    entityType: 'TALENT',
    entityId: 'talent-1',
    actorId: 'user-1',
    correlationId: `corr-${eventCounter}`,
    payload: { versionId: 'ver-1' },
    metadata: {},
    createdAt: new Date('2026-07-01T10:00:00Z'),
    ...overrides,
  };
}

const ACTORS = buildActorDisplayMap([
  { id: 'user-1', displayName: 'נועה לוי', email: 'noa@example.com' },
  { id: 'user-2', displayName: null, email: 'owner@example.com' },
]);

describe('buildEventTimelineItems — supported event types → label/tone', () => {
  const cases = [
    ['ProposalCreated', he.history.eventLabel.proposal_created, 'neutral'],
    ['ProposalSubmitted', he.history.eventLabel.submitted, 'warning'],
    ['ProposalApproved', he.history.eventLabel.approved, 'info'],
    ['ProposalRejected', he.history.eventLabel.rejected, 'danger'],
    ['ProposalDiscarded', he.history.eventLabel.discarded, 'neutral'],
    ['VersionPublished', he.history.eventLabel.published, 'success'],
  ];

  it.each(cases)('%s → "%s" / tone "%s"', (type, label, tone) => {
    const items = buildEventTimelineItems([makeEvent(type)], ACTORS);
    expect(items).toHaveLength(1);
    expect(items[0].action).toBe(label);
    expect(items[0].tone).toBe(tone);
    expect(items[0].date).toBeInstanceOf(Date);
  });
});

describe('actor resolution', () => {
  it('shows displayName when the actor resolves', () => {
    const items = buildEventTimelineItems([makeEvent('ProposalSubmitted', { actorId: 'user-1' })], ACTORS);
    expect(items[0].user).toBe('נועה לוי');
  });

  it('falls back to email when displayName is missing', () => {
    const items = buildEventTimelineItems([makeEvent('ProposalSubmitted', { actorId: 'user-2' })], ACTORS);
    expect(items[0].user).toBe('owner@example.com');
  });

  it('shows "—" for a null actorId', () => {
    const items = buildEventTimelineItems([makeEvent('VersionPublished', { actorId: null })], ACTORS);
    expect(items[0].user).toBe('—');
  });

  it('shows "—" for an actorId whose user no longer exists', () => {
    const items = buildEventTimelineItems([makeEvent('VersionPublished', { actorId: 'deleted-user' })], ACTORS);
    expect(items[0].user).toBe('—');
  });

  it('collectEventActorIds returns distinct non-null ids only', () => {
    const events = [
      makeEvent('ProposalCreated', { actorId: 'user-1' }),
      makeEvent('ProposalSubmitted', { actorId: 'user-1' }),
      makeEvent('ProposalApproved', { actorId: 'user-2' }),
      makeEvent('VersionPublished', { actorId: null }),
    ];
    expect(collectEventActorIds(events).sort()).toEqual(['user-1', 'user-2']);
  });
});

describe('timeline noise policy — hidden-by-default event types', () => {
  it('hides ProposalUpdated (Save Draft) from the default timeline', () => {
    const items = buildEventTimelineItems(
      [makeEvent('ProposalUpdated'), makeEvent('ProposalSubmitted')],
      ACTORS
    );
    expect(items).toHaveLength(1);
    expect(items[0].action).toBe(he.history.eventLabel.submitted);
  });

  it('hides AssetUploaded from the default timeline', () => {
    const items = buildEventTimelineItems(
      [makeEvent('AssetUploaded', { payload: { assetId: 'a-1' } }), makeEvent('VersionPublished')],
      ACTORS
    );
    expect(items).toHaveLength(1);
    expect(items[0].action).toBe(he.history.eventLabel.published);
  });
});

describe('unknown event types', () => {
  it('skips an uncatalogued event type safely', () => {
    const items = buildEventTimelineItems(
      [makeEvent('SomeFutureEventType'), makeEvent('ProposalApproved')],
      ACTORS
    );
    expect(items).toHaveLength(1);
    expect(items[0].action).toBe(he.history.eventLabel.approved);
  });

  it('skips malformed rows (no type / null event) without throwing', () => {
    const items = buildEventTimelineItems(
      [null, {}, { id: 'x', type: 42 }, makeEvent('ProposalCreated')],
      ACTORS
    );
    expect(items).toHaveLength(1);
  });
});

describe('ordering', () => {
  it('sorts newest-first by createdAt regardless of input order', () => {
    const older = makeEvent('ProposalCreated', { createdAt: new Date('2026-07-01T08:00:00Z') });
    const newer = makeEvent('VersionPublished', { createdAt: new Date('2026-07-02T08:00:00Z') });
    const middle = makeEvent('ProposalSubmitted', { createdAt: new Date('2026-07-01T12:00:00Z') });

    const items = buildEventTimelineItems([older, newer, middle], ACTORS);
    expect(items.map((i) => i.action)).toEqual([
      he.history.eventLabel.published,
      he.history.eventLabel.submitted,
      he.history.eventLabel.proposal_created,
    ]);
  });
});

describe('domain labeling from stored payload data', () => {
  it('labels gallery lifecycle events via galleryImageId', () => {
    expect(resolveEventDomain({ galleryImageId: 'g-1' })).toBe('gallery');
    const items = buildEventTimelineItems(
      [makeEvent('ProposalApproved', { payload: { galleryImageId: 'g-1' } })],
      ACTORS
    );
    expect(items[0].summary).toBe(he.history.domainLabel.gallery);
  });

  it('labels gallery submit events via galleryImageIds array', () => {
    expect(resolveEventDomain({ galleryImageIds: ['g-1', 'g-2'] })).toBe('gallery');
  });

  it('labels socials lifecycle events via socialId / socialIds', () => {
    expect(resolveEventDomain({ socialId: 's-1' })).toBe('socials');
    expect(resolveEventDomain({ socialIds: ['s-1'] })).toBe('socials');
    const items = buildEventTimelineItems(
      [makeEvent('ProposalRejected', { payload: { socialId: 's-1' } })],
      ACTORS
    );
    expect(items[0].summary).toBe(he.history.domainLabel.socials);
  });

  it('labels TalentVersion lifecycle events (versionId) as details', () => {
    expect(resolveEventDomain({ versionId: 'v-1' })).toBe('details');
    const items = buildEventTimelineItems([makeEvent('ProposalCreated')], ACTORS);
    expect(items[0].summary).toBe(he.history.domainLabel.details);
  });

  it('honors an explicitly stored payload.domain, including podcast', () => {
    expect(resolveEventDomain({ domain: 'podcast' })).toBe('podcast');
    expect(resolveEventDomain({ domain: 'not-a-real-domain' })).toBe(null);
  });

  it('never invents a domain when the payload has no marker', () => {
    expect(resolveEventDomain({})).toBe(null);
    expect(resolveEventDomain(null)).toBe(null);
    const items = buildEventTimelineItems(
      [makeEvent('VersionPublished', { payload: {} })],
      ACTORS
    );
    expect(items[0].summary).toBe('—');
  });

  it('prefers a stored rejectionNote as the summary', () => {
    const items = buildEventTimelineItems(
      [makeEvent('ProposalRejected', { payload: { versionId: 'v-1', rejectionNote: 'צריך ביו ארוכה יותר' } })],
      ACTORS
    );
    expect(items[0].summary).toBe('צריך ביו ארוכה יותר');
  });
});

describe('fallback to version-row history', () => {
  const versions = [
    {
      id: 'ver-2',
      status: VERSION_STATUS.PUBLISHED,
      name: 'מאיה כהן',
      createdAt: new Date('2026-06-02T10:00:00Z'),
      approvedAt: new Date('2026-06-03T10:00:00Z'),
      createdBy: { email: 'noa@example.com' },
      approvedBy: { email: 'owner@example.com' },
    },
  ];

  it('falls back to version rows when the event list is empty', () => {
    const items = buildTalentHistoryTimelineItems([], new Map(), versions);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('ver-2');
    expect(items[0].user).toBe('owner@example.com');
  });

  it('falls back when every stored event is hidden by the noise policy', () => {
    const onlyHidden = [makeEvent('ProposalUpdated'), makeEvent('AssetUploaded')];
    const items = buildTalentHistoryTimelineItems(onlyHidden, new Map(), versions);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('ver-2');
  });

  it('uses event items (never mixed with version rows) when visible events exist', () => {
    const events = [makeEvent('VersionPublished')];
    const items = buildTalentHistoryTimelineItems(events, ACTORS, versions);
    expect(items).toHaveLength(1);
    expect(items[0].action).toBe(he.history.eventLabel.published);
    expect(items[0].id).not.toBe('ver-2');
  });

  it('returns [] when there are neither events nor versions (Timeline shows EmptyState)', () => {
    expect(buildTalentHistoryTimelineItems([], new Map(), [])).toEqual([]);
  });
});
