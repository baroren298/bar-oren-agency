/*
 * New-Talent Draft Details fix — rendering-level coverage for
 * DetailsSectionContent/buildDetailsGroups (app/admin/talent/[id]/page.jsx).
 *
 * A brand-new Talent has no published version yet, only an editable DRAFT
 * TalentVersion. Before this fix, DetailsSectionContent returned the
 * "no published version" EmptyState purely on `!publishedVersion`, even
 * though an editable pending version existed and buildDetailsGroups/
 * ProfileImagePanel already had (or, for ProfileImagePanel, now have) safe
 * fallbacks for a null published side. This suite renders the exported
 * DetailsSectionContent directly (both functions are exported from page.jsx
 * for exactly this purpose — no behavior change) with react-dom/server's
 * renderToString, the same jsdom-free technique
 * components/admin/__tests__/globalEditMode.test.jsx already uses: the
 * initial render is exactly what decides EmptyState vs. the editing
 * surface, and asserting on that HTML needs no DOM/browser test dependency
 * this repo doesn't have.
 *
 * next/navigation's useRouter is mocked (ProfileImagePanel/TalentDetailsEditor
 * call it, but only their Save/Submit handlers use it — never invoked here).
 */

import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { he } from '@/lib/admin/i18n/he';
import { VERSION_STATUS } from '@/lib/admin/constants/enums';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { DetailsSectionContent, buildDetailsGroups } from '../page';

const NO_PUBLISHED_TITLE = he.talent.detail.noPublishedVersionTitle; // "אין עדיין גרסה מפורסמת"
const BASIC_GROUP_LABEL = he.talent.detailGroups.basic; // "מידע בסיסי"

const draftVersion = {
  id: 'v-draft-1',
  status: VERSION_STATUS.DRAFT,
  name: 'שם בטיוטה',
  nameEn: 'Draft Name',
  bioHe: 'ביו טיוטה',
  profileImageAsset: { blobUrl: 'https://example.test/draft.jpg' },
  profileImagePosition: '50% 50%',
  profileImageScale: 1,
};

const proposedVersion = { ...draftVersion, id: 'v-proposed-1', status: VERSION_STATUS.PROPOSED };
const rejectedVersion = { ...draftVersion, id: 'v-rejected-1', status: VERSION_STATUS.REJECTED };

const publishedVersion = {
  id: 'v-published-1',
  status: VERSION_STATUS.PUBLISHED,
  name: 'שם מפורסם',
  nameEn: 'Published Name',
  bioHe: 'ביו מפורסם',
  profileImageAsset: { blobUrl: 'https://example.test/published.jpg' },
  profileImagePosition: '50% 50%',
  profileImageScale: 1,
};

function renderDetails(publishedVer, pendingVer) {
  return renderToString(
    h(DetailsSectionContent, {
      talentId: 't-1',
      publishedVersion: publishedVer,
      pendingVersion: pendingVer,
      displayName: 'מיוצג לבדיקה',
      role: 'OWNER',
      uploadsEnabled: true,
    })
  );
}

describe('DetailsSectionContent — no published version', () => {
  it('renders the editing surface (not the EmptyState) when only an editable DRAFT exists', () => {
    const html = renderDetails(null, draftVersion);
    expect(html).not.toContain(NO_PUBLISHED_TITLE);
    expect(html).toContain(BASIC_GROUP_LABEL);
    expect(html).toContain(draftVersion.name);
  });

  it('renders the editing surface (not the EmptyState) when only an editable PROPOSED exists', () => {
    const html = renderDetails(null, proposedVersion);
    expect(html).not.toContain(NO_PUBLISHED_TITLE);
    expect(html).toContain(BASIC_GROUP_LABEL);
    expect(html).toContain(proposedVersion.name);
  });

  it('still renders the EmptyState when there is no published version and no editable pending version', () => {
    const html = renderDetails(null, null);
    expect(html).toContain(NO_PUBLISHED_TITLE);
  });

  it('still renders the EmptyState when the only pending version is REJECTED (not editable)', () => {
    const html = renderDetails(null, rejectedVersion);
    expect(html).toContain(NO_PUBLISHED_TITLE);
  });
});

describe('DetailsSectionContent — existing Published + Pending behavior', () => {
  it('renders the editing surface with a Published version and no pending version, as before', () => {
    const html = renderDetails(publishedVersion, null);
    expect(html).not.toContain(NO_PUBLISHED_TITLE);
    expect(html).toContain(publishedVersion.name);
  });

  it('renders the editing surface (proposed side, seeded from the Draft) with both a Published version and an editable pending version', () => {
    // ComparisonView renders a single section per DetailsSectionContent
    // render: the editable proposed view when there is an editable
    // pending version (as here), the read-only published view otherwise.
    // So the proposed Draft's name is what appears, not the published
    // name — this only proves the pre-existing Published+Pending path
    // still renders (no EmptyState, no crash), matching required check #4.
    const html = renderDetails(publishedVersion, draftVersion);
    expect(html).not.toContain(NO_PUBLISHED_TITLE);
    expect(html).toContain(draftVersion.name);
  });
});

describe('buildDetailsGroups — null-safe published side', () => {
  it('does not throw and returns "—"-style empty values when publishedVersion is null', () => {
    expect(() => buildDetailsGroups(null, draftVersion)).not.toThrow();
    const groups = buildDetailsGroups(null, draftVersion);
    const basicGroup = groups.find((g) => g.label === BASIC_GROUP_LABEL);
    const nameField = basicGroup.fields.find((f) => f.key === 'name');
    expect(nameField.value).toBeUndefined();
    expect(nameField.draftValue).toBe(draftVersion.name);
  });
});
