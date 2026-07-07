/*
 * dashboardService.getMyWork — unit tests (My Work — real data sprint).
 *
 * Same setup as dashboardService.test.js: dashboardRepository is mocked;
 * this file verifies the service's own decisions — actor filtering ("mine"
 * means createdBy.id === actorId), per-(talent, work type, status)
 * grouping, latest-touch timestamps, rejection-note pass-through, hrefs,
 * and that both admin roles are allowed — not the repository's Prisma
 * calls. userRepository is mocked too (module import side effect), though
 * getMyWork never uses it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  listTalentVersionsByStatus: vi.fn(),
  listTalentSocialsByVersionStatus: vi.fn(),
  listTalentGalleryImagesByVersionStatus: vi.fn(),
  listRejectionAuditsForVersionIds: vi.fn(),
  getSafeById: vi.fn(),
}));

vi.mock('../repository/dashboardRepository', () => ({
  dashboardRepository: {
    listTalentVersionsByStatus: hoisted.listTalentVersionsByStatus,
    listTalentSocialsByVersionStatus: hoisted.listTalentSocialsByVersionStatus,
    listTalentGalleryImagesByVersionStatus: hoisted.listTalentGalleryImagesByVersionStatus,
    listRejectionAuditsForVersionIds: hoisted.listRejectionAuditsForVersionIds,
  },
}));

vi.mock('../repository/userRepository', () => ({
  userRepository: {
    getSafeById: hoisted.getSafeById,
  },
}));

import { dashboardService } from './dashboardService';
import { DASHBOARD_WORK_TYPE } from './dashboardDto';
import { ROLE, VERSION_STATUS } from '../constants/enums';

const OWNER = { id: 'owner-1', displayName: 'בר', email: 'bar@example.com', role: ROLE.OWNER };
const NOA = { id: 'emp-1', displayName: 'נועה', email: 'noa@example.com', role: ROLE.EMPLOYEE };
const DANA = { id: 'emp-2', displayName: null, email: 'dana@example.com', role: ROLE.EMPLOYEE };

function talentRef(name) {
  return { slug: `${name}-slug`, currentPublishedVersion: { name } };
}

/** Default: every queue empty; individual tests override per status. */
beforeEach(() => {
  vi.clearAllMocks();
  hoisted.listTalentVersionsByStatus.mockResolvedValue([]);
  hoisted.listTalentSocialsByVersionStatus.mockResolvedValue([]);
  hoisted.listTalentGalleryImagesByVersionStatus.mockResolvedValue([]);
});

function callMyWork(actor = NOA) {
  return dashboardService.getMyWork({ actorId: actor.id, actorRole: actor.role });
}

/** Route one mock fn by its status argument. */
function byStatus(fn, mapping) {
  fn.mockImplementation(async (status) => mapping[status] ?? []);
}

describe('dashboardService.getMyWork — access control', () => {
  it('throws a 403-shaped error for an unknown role and never queries', async () => {
    await expect(
      dashboardService.getMyWork({ actorId: 'x', actorRole: 'INTRUDER' })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN_ROLE' });
    expect(hoisted.listTalentVersionsByStatus).not.toHaveBeenCalled();
  });

  it('requires actorId', async () => {
    await expect(dashboardService.getMyWork({ actorRole: ROLE.EMPLOYEE })).rejects.toThrow(
      /actorId is required/
    );
  });

  it('allows both OWNER and EMPLOYEE', async () => {
    await expect(callMyWork(NOA)).resolves.toEqual([]);
    await expect(callMyWork(OWNER)).resolves.toEqual([]);
  });
});

describe('dashboardService.getMyWork — actor filtering', () => {
  it('returns only rows created by the actor and never leaks other users’ items', async () => {
    byStatus(hoisted.listTalentVersionsByStatus, {
      [VERSION_STATUS.DRAFT]: [
        {
          id: 'v-mine',
          talentId: 'talent-a',
          name: 'קים',
          createdAt: new Date('2026-07-03T10:00:00Z'),
          rejectionNote: null,
          createdBy: NOA,
        },
        {
          id: 'v-theirs',
          talentId: 'talent-b',
          name: 'דנה',
          createdAt: new Date('2026-07-04T10:00:00Z'),
          rejectionNote: null,
          createdBy: DANA,
        },
      ],
    });
    byStatus(hoisted.listTalentGalleryImagesByVersionStatus, {
      [VERSION_STATUS.DRAFT]: [
        // Someone else's row on the SAME talent I'm working on — must not
        // inflate my group, appear in my counts, or crash on legacy rows.
        {
          id: 'g-theirs',
          talentId: 'talent-a',
          createdAt: new Date('2026-07-05T10:00:00Z'),
          updatedAt: new Date('2026-07-05T10:00:00Z'),
          rejectionNote: null,
          createdBy: DANA,
          talent: talentRef('קים'),
        },
        // Historical row with no creator (pre-createdById backfill) —
        // filtered out, not a crash.
        {
          id: 'g-legacy',
          talentId: 'talent-c',
          createdAt: new Date('2026-07-01T10:00:00Z'),
          updatedAt: new Date('2026-07-01T10:00:00Z'),
          rejectionNote: null,
          createdBy: null,
          talent: talentRef('לגסי'),
        },
      ],
    });

    const items = await callMyWork(NOA);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      key: 'DETAILS:v-mine',
      workType: DASHBOARD_WORK_TYPE.DETAILS,
      talentId: 'talent-a',
      talentName: 'קים',
    });
    // Explicit non-leak assertions.
    expect(items.some((i) => i.key.includes('v-theirs'))).toBe(false);
    expect(items.some((i) => i.talentId === 'talent-b')).toBe(false);
    expect(items.some((i) => i.talentId === 'talent-c')).toBe(false);
  });
});

describe('dashboardService.getMyWork — status grouping', () => {
  it('maps DRAFT / PROPOSED / REJECTED rows to items tagged with their versionStatus', async () => {
    const version = (id, createdAt, extra = {}) => ({
      id,
      talentId: `talent-${id}`,
      name: `טאלנט ${id}`,
      createdAt: new Date(createdAt),
      rejectionNote: null,
      createdBy: NOA,
      ...extra,
    });
    byStatus(hoisted.listTalentVersionsByStatus, {
      [VERSION_STATUS.DRAFT]: [version('d1', '2026-07-01T10:00:00Z')],
      [VERSION_STATUS.PROPOSED]: [version('p1', '2026-07-02T10:00:00Z')],
      [VERSION_STATUS.REJECTED]: [
        version('r1', '2026-07-03T10:00:00Z', { rejectionNote: 'צריך תמונה אחרת' }),
      ],
    });

    const items = await callMyWork(NOA);

    expect(items).toHaveLength(3);
    // Most recently touched first.
    expect(items.map((i) => i.versionStatus)).toEqual([
      VERSION_STATUS.REJECTED,
      VERSION_STATUS.PROPOSED,
      VERSION_STATUS.DRAFT,
    ]);
    const rejected = items.find((i) => i.versionStatus === VERSION_STATUS.REJECTED);
    expect(rejected.rejectionNote).toBe('צריך תמונה אחרת');
    // The queries fanned out over exactly the three open statuses.
    for (const fn of [
      hoisted.listTalentVersionsByStatus,
      hoisted.listTalentSocialsByVersionStatus,
      hoisted.listTalentGalleryImagesByVersionStatus,
    ]) {
      expect(fn.mock.calls.map(([s]) => s).sort()).toEqual(
        [VERSION_STATUS.DRAFT, VERSION_STATUS.PROPOSED, VERSION_STATUS.REJECTED].sort()
      );
    }
  });

  it('groups my socials/gallery rows per (talent, work type, status) with latest-touch timestamp and note', async () => {
    byStatus(hoisted.listTalentGalleryImagesByVersionStatus, {
      [VERSION_STATUS.REJECTED]: [
        {
          id: 'g1',
          talentId: 'talent-b',
          createdAt: new Date('2026-07-01T08:00:00Z'),
          updatedAt: new Date('2026-07-01T08:00:00Z'),
          rejectionNote: 'ישנה',
          createdBy: NOA,
          talent: talentRef('דנה'),
        },
        {
          id: 'g2',
          talentId: 'talent-b',
          createdAt: new Date('2026-07-02T08:00:00Z'),
          updatedAt: new Date('2026-07-04T08:00:00Z'),
          rejectionNote: 'חדשה יותר',
          createdBy: NOA,
          talent: talentRef('דנה'),
        },
      ],
      // The SAME talent also has my DRAFT gallery rows — a separate item,
      // not merged with the rejected group.
      [VERSION_STATUS.DRAFT]: [
        {
          id: 'g3',
          talentId: 'talent-b',
          createdAt: new Date('2026-07-05T08:00:00Z'),
          updatedAt: new Date('2026-07-05T08:00:00Z'),
          rejectionNote: null,
          createdBy: NOA,
          talent: talentRef('דנה'),
        },
      ],
    });
    byStatus(hoisted.listTalentSocialsByVersionStatus, {
      [VERSION_STATUS.PROPOSED]: [
        {
          id: 's1',
          talentId: 'talent-b',
          createdAt: new Date('2026-07-03T08:00:00Z'),
          updatedAt: new Date('2026-07-03T08:00:00Z'),
          rejectionNote: null,
          createdBy: NOA,
          talent: talentRef('דנה'),
        },
      ],
    });

    const items = await callMyWork(NOA);

    expect(items).toHaveLength(3);

    const rejectedGallery = items.find(
      (i) => i.workType === DASHBOARD_WORK_TYPE.GALLERY && i.versionStatus === VERSION_STATUS.REJECTED
    );
    expect(rejectedGallery).toMatchObject({
      key: `GALLERY:talent-b:${VERSION_STATUS.REJECTED}`,
      itemCount: 2,
      talentName: 'דנה',
      lastUpdatedAt: '2026-07-04T08:00:00.000Z', // latest touch, not earliest
      rejectionNote: 'חדשה יותר', // latest non-null note
    });

    const draftGallery = items.find(
      (i) => i.workType === DASHBOARD_WORK_TYPE.GALLERY && i.versionStatus === VERSION_STATUS.DRAFT
    );
    expect(draftGallery).toMatchObject({ itemCount: 1, rejectionNote: null });

    const proposedSocials = items.find((i) => i.workType === DASHBOARD_WORK_TYPE.SOCIALS);
    expect(proposedSocials).toMatchObject({
      key: `SOCIALS:talent-b:${VERSION_STATUS.PROPOSED}`,
      versionStatus: VERSION_STATUS.PROPOSED,
      itemCount: 1,
    });
  });
});

describe('dashboardService.getMyWork — UI contract', () => {
  it('carries the talent fields, hrefs, and serializability the page needs', async () => {
    byStatus(hoisted.listTalentVersionsByStatus, {
      [VERSION_STATUS.PROPOSED]: [
        {
          id: 'v1',
          talentId: 'talent-a',
          name: 'קים',
          createdAt: new Date('2026-07-02T10:00:00Z'),
          rejectionNote: null,
          createdBy: NOA,
        },
      ],
    });
    byStatus(hoisted.listTalentSocialsByVersionStatus, {
      [VERSION_STATUS.DRAFT]: [
        // No published version yet → slug fallback for the display name.
        {
          id: 's1',
          talentId: 'talent-new',
          createdAt: new Date('2026-07-01T10:00:00Z'),
          updatedAt: new Date('2026-07-01T10:00:00Z'),
          rejectionNote: null,
          createdBy: NOA,
          talent: { slug: 'new-slug', currentPublishedVersion: null },
        },
      ],
    });

    const items = await callMyWork(NOA);

    const details = items.find((i) => i.workType === DASHBOARD_WORK_TYPE.DETAILS);
    expect(details).toMatchObject({
      talentId: 'talent-a',
      talentName: 'קים', // TalentVersion carries its own name
      href: '/admin/talent/talent-a',
      lastUpdatedAt: '2026-07-02T10:00:00.000Z',
    });

    const socials = items.find((i) => i.workType === DASHBOARD_WORK_TYPE.SOCIALS);
    expect(socials).toMatchObject({
      talentName: 'new-slug', // slug fallback when nothing is published yet
      href: '/admin/talent/talent-new',
    });

    // Every item deep-links with the dashboard's pattern and survives the
    // server/client JSON boundary unchanged.
    for (const item of items) {
      expect(item.href).toBe(`/admin/talent/${item.talentId}`);
    }
    expect(JSON.parse(JSON.stringify(items))).toEqual(items);
  });
});
