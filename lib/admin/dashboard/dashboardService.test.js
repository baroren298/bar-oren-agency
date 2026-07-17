/*
 * dashboardService — unit tests (Owner Dashboard Sprint 1).
 *
 * dashboardRepository and userRepository are mocked (same pattern as
 * lib/admin/userService.test.js): this file verifies the service's own
 * decisions — Owner-only enforcement, grouping socials/gallery per talent,
 * queue ordering, the ≤5 cap, greeting count = pending approvals only,
 * employee-only draft grouping, rejection attribution from the audit log —
 * not the repository's Prisma calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  listTalentVersionsByStatus: vi.fn(),
  listTalentSocialsByVersionStatus: vi.fn(),
  listTalentGalleryImagesByVersionStatus: vi.fn(),
  listRejectionAuditsForVersionIds: vi.fn(),
  listRecentPublishedTalentVersions: vi.fn(),
  listRecentPublishedTalentSocials: vi.fn(),
  listRecentPublishedTalentGalleryImages: vi.fn(),
  getSafeById: vi.fn(),
}));

vi.mock('../repository/dashboardRepository', () => ({
  dashboardRepository: {
    listTalentVersionsByStatus: hoisted.listTalentVersionsByStatus,
    listTalentSocialsByVersionStatus: hoisted.listTalentSocialsByVersionStatus,
    listTalentGalleryImagesByVersionStatus: hoisted.listTalentGalleryImagesByVersionStatus,
    listRejectionAuditsForVersionIds: hoisted.listRejectionAuditsForVersionIds,
    listRecentPublishedTalentVersions: hoisted.listRecentPublishedTalentVersions,
    listRecentPublishedTalentSocials: hoisted.listRecentPublishedTalentSocials,
    listRecentPublishedTalentGalleryImages: hoisted.listRecentPublishedTalentGalleryImages,
  },
}));

vi.mock('../repository/userRepository', () => ({
  userRepository: {
    getSafeById: hoisted.getSafeById,
  },
}));

import { dashboardService } from './dashboardService';
import { buildOwnerDashboardDto, DASHBOARD_WORK_TYPE } from './dashboardDto';
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
  hoisted.getSafeById.mockResolvedValue(OWNER);
  hoisted.listTalentVersionsByStatus.mockResolvedValue([]);
  hoisted.listTalentSocialsByVersionStatus.mockResolvedValue([]);
  hoisted.listTalentGalleryImagesByVersionStatus.mockResolvedValue([]);
  hoisted.listRejectionAuditsForVersionIds.mockResolvedValue([]);
  hoisted.listRecentPublishedTalentVersions.mockResolvedValue([]);
  hoisted.listRecentPublishedTalentSocials.mockResolvedValue([]);
  hoisted.listRecentPublishedTalentGalleryImages.mockResolvedValue([]);
});

function callDashboard() {
  return dashboardService.getOwnerDashboard({ actorId: OWNER.id, actorRole: ROLE.OWNER });
}

/** Route one mock fn by its status argument. */
function byStatus(fn, mapping) {
  fn.mockImplementation(async (status) => mapping[status] ?? []);
}

describe('dashboardService.getOwnerDashboard — access control', () => {
  it('throws a 403-shaped error for a non-OWNER actor and never queries', async () => {
    await expect(
      dashboardService.getOwnerDashboard({ actorId: NOA.id, actorRole: ROLE.EMPLOYEE })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN_ROLE' });
    expect(hoisted.listTalentVersionsByStatus).not.toHaveBeenCalled();
    // Sprint 5a — the new Recent Publishes queries must never fire either.
    expect(hoisted.listRecentPublishedTalentVersions).not.toHaveBeenCalled();
    expect(hoisted.listRecentPublishedTalentSocials).not.toHaveBeenCalled();
    expect(hoisted.listRecentPublishedTalentGalleryImages).not.toHaveBeenCalled();
  });

  it('requires actorId', async () => {
    await expect(
      dashboardService.getOwnerDashboard({ actorRole: ROLE.OWNER })
    ).rejects.toThrow(/actorId is required/);
  });
});

describe('dashboardService.getOwnerDashboard — empty state', () => {
  it('returns a zeroed DTO with the viewer displayName when nothing is queued', async () => {
    const dto = await callDashboard();
    expect(dto.greeting).toEqual({ displayName: 'בר', pendingApprovalsCount: 0 });
    expect(dto.pendingApprovals).toEqual({ totalCount: 0, items: [] });
    expect(dto.rejectedItems).toEqual({ totalCount: 0, items: [] });
    expect(dto.employeeDrafts).toEqual({ totalCount: 0, groups: [] });
    expect(dto.recentPublishes).toEqual({ totalCount: 0, items: [] });
  });
});

describe('dashboardService.getOwnerDashboard — pending approvals', () => {
  it('groups socials/gallery per talent, keeps details per version, sorts oldest first', async () => {
    byStatus(hoisted.listTalentVersionsByStatus, {
      [VERSION_STATUS.PROPOSED]: [
        {
          id: 'v1',
          talentId: 'talent-a',
          name: 'קים',
          createdAt: new Date('2026-07-03T10:00:00Z'),
          createdBy: NOA,
          talent: { slug: 'kim-slug' },
        },
      ],
    });
    byStatus(hoisted.listTalentGalleryImagesByVersionStatus, {
      [VERSION_STATUS.PROPOSED]: [
        {
          id: 'g1',
          talentId: 'talent-b',
          createdAt: new Date('2026-07-01T08:00:00Z'),
          updatedAt: new Date('2026-07-01T08:00:00Z'),
          createdBy: NOA,
          talent: talentRef('דנה'),
        },
        {
          id: 'g2',
          talentId: 'talent-b',
          createdAt: new Date('2026-07-02T08:00:00Z'),
          updatedAt: new Date('2026-07-02T08:00:00Z'),
          createdBy: DANA,
          talent: talentRef('דנה'),
        },
      ],
    });

    const dto = await callDashboard();

    // Two queue items: one grouped gallery item + one details item.
    expect(dto.pendingApprovals.totalCount).toBe(2);
    expect(dto.greeting.pendingApprovalsCount).toBe(2);

    const [first, second] = dto.pendingApprovals.items;
    // Gallery group waited since July 1 → oldest → first.
    expect(first).toMatchObject({
      workType: DASHBOARD_WORK_TYPE.GALLERY,
      talentId: 'talent-b',
      talentName: 'דנה',
      itemCount: 2,
      submittedAt: '2026-07-01T08:00:00.000Z', // earliest row = waiting since
      // Clean Admin Talent URL sprint — deep links use the parent talent's
      // current published slug, not the internal id.
      href: '/admin/talent/דנה-slug',
    });
    // submittedBy = most recent row's creator.
    expect(first.submittedBy).toMatchObject({ id: DANA.id, email: DANA.email });
    expect(second).toMatchObject({
      workType: DASHBOARD_WORK_TYPE.DETAILS,
      talentName: 'קים',
      itemCount: 1,
      href: '/admin/talent/kim-slug',
    });
    expect(second.submittedBy).toMatchObject({ id: NOA.id, displayName: 'נועה' });
  });

  it('caps items at five but reports the full total (and the full greeting count)', async () => {
    byStatus(hoisted.listTalentVersionsByStatus, {
      [VERSION_STATUS.PROPOSED]: Array.from({ length: 7 }, (_, i) => ({
        id: `v${i}`,
        talentId: `talent-${i}`,
        name: `טאלנט ${i}`,
        createdAt: new Date(Date.UTC(2026, 6, 1 + i)),
        createdBy: NOA,
      })),
    });

    const dto = await callDashboard();
    expect(dto.pendingApprovals.totalCount).toBe(7);
    expect(dto.pendingApprovals.items).toHaveLength(5);
    expect(dto.greeting.pendingApprovalsCount).toBe(7);
    // Oldest-first: the two newest fell off the visible list, not the oldest.
    expect(dto.pendingApprovals.items[0].key).toBe('DETAILS:v0');
    expect(dto.pendingApprovals.items[4].key).toBe('DETAILS:v4');
    // Rows above carry no talent slug — the href falls back to the internal
    // id, which the workspace page still accepts (and redirects).
    expect(dto.pendingApprovals.items[0].href).toBe('/admin/talent/talent-0');
  });
});

describe('dashboardService.getOwnerDashboard — rejected items', () => {
  it('attributes details rejections from the audit log and leaves gallery attribution null', async () => {
    byStatus(hoisted.listTalentVersionsByStatus, {
      [VERSION_STATUS.REJECTED]: [
        {
          id: 'v9',
          talentId: 'talent-a',
          name: 'קים',
          createdAt: new Date('2026-07-01T09:00:00Z'),
          createdBy: NOA,
          rejectionNote: 'צריך תמונה אחרת',
        },
      ],
    });
    byStatus(hoisted.listTalentGalleryImagesByVersionStatus, {
      [VERSION_STATUS.REJECTED]: [
        {
          id: 'g9',
          talentId: 'talent-b',
          createdAt: new Date('2026-07-02T09:00:00Z'),
          updatedAt: new Date('2026-07-04T09:00:00Z'),
          createdBy: NOA,
          talent: talentRef('דנה'),
        },
      ],
    });
    hoisted.listRejectionAuditsForVersionIds.mockResolvedValue([
      {
        targetVersionId: 'v9',
        createdAt: new Date('2026-07-05T12:00:00Z'),
        rejectedBy: { id: OWNER.id, displayName: 'בר', email: OWNER.email },
      },
    ]);

    const dto = await callDashboard();

    expect(hoisted.listRejectionAuditsForVersionIds).toHaveBeenCalledWith(['v9']);
    expect(dto.rejectedItems.totalCount).toBe(2);

    const details = dto.rejectedItems.items.find((i) => i.workType === 'DETAILS');
    expect(details.rejectedBy).toMatchObject({ displayName: 'בר' });
    expect(details.rejectedAt).toBe('2026-07-05T12:00:00.000Z'); // audit time, not createdAt

    const gallery = dto.rejectedItems.items.find((i) => i.workType === 'GALLERY');
    expect(gallery.rejectedBy).toBeNull(); // documented audit coverage gap
    // updatedAt, not createdAt — the rejection itself bumped the row.
    expect(gallery.rejectedAt).toBe('2026-07-04T09:00:00.000Z');
  });
});

describe('dashboardService.getOwnerDashboard — employee drafts', () => {
  it('groups by employee across kinds, excludes the Owner, sorts by last update desc', async () => {
    byStatus(hoisted.listTalentVersionsByStatus, {
      [VERSION_STATUS.DRAFT]: [
        // Owner's own draft — must NOT appear (supervision only).
        {
          id: 'v-owner',
          talentId: 'talent-x',
          name: 'איקס',
          createdAt: new Date('2026-07-06T09:00:00Z'),
          createdBy: OWNER,
        },
        {
          id: 'v-noa',
          talentId: 'talent-a',
          name: 'קים',
          createdAt: new Date('2026-07-03T09:00:00Z'),
          createdBy: NOA,
        },
      ],
    });
    byStatus(hoisted.listTalentSocialsByVersionStatus, {
      [VERSION_STATUS.DRAFT]: [
        {
          id: 's-noa',
          talentId: 'talent-b',
          createdAt: new Date('2026-07-04T09:00:00Z'),
          updatedAt: new Date('2026-07-05T09:00:00Z'),
          createdBy: NOA,
          talent: talentRef('דנה'),
        },
        {
          id: 's-dana',
          talentId: 'talent-b',
          createdAt: new Date('2026-07-01T09:00:00Z'),
          updatedAt: new Date('2026-07-01T09:00:00Z'),
          createdBy: DANA,
          talent: talentRef('דנה'),
        },
      ],
    });
    byStatus(hoisted.listTalentGalleryImagesByVersionStatus, {
      [VERSION_STATUS.DRAFT]: [
        // Historical row with no creator — must be skipped, not crash.
        {
          id: 'g-legacy',
          talentId: 'talent-c',
          createdAt: new Date('2026-07-02T09:00:00Z'),
          updatedAt: new Date('2026-07-02T09:00:00Z'),
          createdBy: null,
          talent: talentRef('לגסי'),
        },
      ],
    });

    const dto = await callDashboard();

    expect(dto.employeeDrafts.totalCount).toBe(2);
    const [first, second] = dto.employeeDrafts.groups;
    // Noa updated most recently (July 5) → first.
    expect(first.employee).toMatchObject({ id: NOA.id, displayName: 'נועה' });
    expect(first.draftCount).toBe(2);
    expect(first.lastUpdatedAt).toBe('2026-07-05T09:00:00.000Z');
    expect(second.employee).toMatchObject({ id: DANA.id, displayName: null });
    expect(second.draftCount).toBe(1);
    // The Owner never appears as an "employee".
    expect(dto.employeeDrafts.groups.some((g) => g.employee.id === OWNER.id)).toBe(false);
  });
});

describe('dashboardService.getOwnerDashboard — recent publishes (Sprint 5a)', () => {
  it('groups socials/gallery per talent, keeps details per talent, sorts newest first, caps at five', async () => {
    hoisted.listRecentPublishedTalentVersions.mockResolvedValue([
      {
        id: 'v1',
        talentId: 'talent-a',
        name: 'קים',
        createdAt: new Date('2026-07-01T10:00:00Z'),
        approvedAt: new Date('2026-07-10T10:00:00Z'),
        approvedBy: OWNER,
        talent: { slug: 'kim-slug' },
      },
    ]);
    hoisted.listRecentPublishedTalentGalleryImages.mockResolvedValue([
      {
        id: 'g1',
        talentId: 'talent-b',
        createdAt: new Date('2026-07-01T08:00:00Z'),
        updatedAt: new Date('2026-07-01T08:00:00Z'),
        approvedAt: new Date('2026-07-12T08:00:00Z'),
        approvedBy: OWNER,
        talent: talentRef('דנה'),
      },
      {
        id: 'g2',
        talentId: 'talent-b',
        createdAt: new Date('2026-07-02T08:00:00Z'),
        updatedAt: new Date('2026-07-02T08:00:00Z'),
        approvedAt: new Date('2026-07-13T08:00:00Z'),
        approvedBy: OWNER,
        talent: talentRef('דנה'),
      },
    ]);

    const dto = await callDashboard();

    expect(dto.recentPublishes.totalCount).toBe(2);
    const [first, second] = dto.recentPublishes.items;
    // Gallery group's latest approvedAt (July 13) is newer than the details
    // item (July 10) → gallery first.
    expect(first).toMatchObject({
      workType: DASHBOARD_WORK_TYPE.GALLERY,
      talentId: 'talent-b',
      talentName: 'דנה',
      itemCount: 2,
      publishedAt: '2026-07-13T08:00:00.000Z', // latest row = most recently published
      href: '/admin/talent/דנה-slug',
    });
    expect(second).toMatchObject({
      workType: DASHBOARD_WORK_TYPE.DETAILS,
      talentId: 'talent-a',
      talentName: 'קים',
      itemCount: 1,
      publishedAt: '2026-07-10T10:00:00.000Z',
      href: '/admin/talent/kim-slug',
    });
    expect(first.publishedBy).toMatchObject({ id: OWNER.id, displayName: 'בר' });
  });

  it('falls back to updatedAt/createdAt when approvedAt is null, and handles a null approvedBy safely', async () => {
    hoisted.listRecentPublishedTalentGalleryImages.mockResolvedValue([
      {
        // Historical row predating approvedAt/approvedBy bookkeeping.
        id: 'g-legacy',
        talentId: 'talent-c',
        createdAt: new Date('2026-07-01T08:00:00Z'),
        updatedAt: new Date('2026-07-02T08:00:00Z'),
        approvedAt: null,
        approvedBy: null,
        talent: talentRef('לגסי'),
      },
    ]);

    const dto = await callDashboard();

    expect(dto.recentPublishes.totalCount).toBe(1);
    const [item] = dto.recentPublishes.items;
    expect(item.publishedAt).toBe('2026-07-02T08:00:00.000Z'); // updatedAt fallback
    expect(item.publishedBy).toBeNull(); // must not throw, must render as "no actor"
  });

  it('caps items at five but reports the full total', async () => {
    hoisted.listRecentPublishedTalentVersions.mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => ({
        id: `v${i}`,
        talentId: `talent-${i}`,
        name: `טאלנט ${i}`,
        createdAt: new Date(Date.UTC(2026, 6, 1 + i)),
        approvedAt: new Date(Date.UTC(2026, 6, 1 + i)),
        approvedBy: OWNER,
      }))
    );

    const dto = await callDashboard();
    expect(dto.recentPublishes.totalCount).toBe(7);
    expect(dto.recentPublishes.items).toHaveLength(5);
    // Newest-first: talent-6 (July 7) leads, not talent-0.
    expect(dto.recentPublishes.items[0].key).toBe('DETAILS:talent-6');
  });

  it('does not disturb the existing three sections', async () => {
    byStatus(hoisted.listTalentVersionsByStatus, {
      [VERSION_STATUS.PROPOSED]: [
        {
          id: 'v9',
          talentId: 'talent-p',
          name: 'ממתין',
          createdAt: new Date('2026-07-01T00:00:00Z'),
          createdBy: NOA,
        },
      ],
    });
    hoisted.listRecentPublishedTalentGalleryImages.mockResolvedValue([
      {
        id: 'g9',
        talentId: 'talent-q',
        createdAt: new Date('2026-07-05T00:00:00Z'),
        updatedAt: new Date('2026-07-05T00:00:00Z'),
        approvedAt: new Date('2026-07-05T00:00:00Z'),
        approvedBy: OWNER,
        talent: talentRef('שקט'),
      },
    ]);

    const dto = await callDashboard();
    expect(dto.pendingApprovals.totalCount).toBe(1);
    expect(dto.rejectedItems).toEqual({ totalCount: 0, items: [] });
    expect(dto.employeeDrafts).toEqual({ totalCount: 0, groups: [] });
    expect(dto.recentPublishes.totalCount).toBe(1);
  });
});

describe('buildOwnerDashboardDto', () => {
  it('produces a serializable DTO with defaults and the ≤5 cap', () => {
    const now = new Date('2026-07-07T00:00:00Z');
    const items = Array.from({ length: 6 }, (_, i) => ({ key: `k${i}` }));
    const dto = buildOwnerDashboardDto({ pendingApprovals: items, now });

    expect(dto.generatedAt).toBe('2026-07-07T00:00:00.000Z');
    expect(dto.greeting).toEqual({ displayName: null, pendingApprovalsCount: 6 });
    expect(dto.pendingApprovals.items).toHaveLength(5);
    expect(dto.rejectedItems).toEqual({ totalCount: 0, items: [] });
    expect(dto.employeeDrafts).toEqual({ totalCount: 0, groups: [] });
    expect(dto.recentPublishes).toEqual({ totalCount: 0, items: [] });
    // JSON round trip loses nothing — the page/route boundary contract.
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
  });

  it('caps recentPublishes at five too (Sprint 5a), independent of the other sections', () => {
    const recentPublishes = Array.from({ length: 6 }, (_, i) => ({
      key: `p${i}`,
      publishedAt: `2026-07-0${(i % 9) + 1}T00:00:00.000Z`,
      publishedBy: null,
    }));
    const dto = buildOwnerDashboardDto({ recentPublishes });

    expect(dto.recentPublishes.totalCount).toBe(6);
    expect(dto.recentPublishes.items).toHaveLength(5);
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
  });
});
