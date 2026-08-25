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
 * next/navigation's useRouter is mocked (TalentDetailsEditor calls it, but
 * only its Save/Submit handlers use it — never invoked here).
 *
 * Talent Details Lifecycle Unification sprint — extended with:
 *   (a) a Gap 1 regression guard: a Draft-only Talent's own profile image
 *       must actually reach the rendered Details tab (this is the exact
 *       bug talentRepository.listTalentVersionsForTalent's new
 *       `profileImageAsset` include, covered separately in
 *       talentRepository.listTalentVersionsForTalent.test.js, fixes);
 *   (b) a Gap 2 regression guard: the Details tab now renders exactly one
 *       Save Draft/Cancel action bar (Profile Image no longer owns its
 *       own separate <ProfileImagePanel> lifecycle).
 * These are still initial-render/string-containment assertions only, same
 * technique and same DOM-free limits as the rest of this file — they prove
 * shape and content, not click-driven interactions (upload, drag-to-
 * reposition, Save Draft's network call). Those remain manual QA, exactly
 * like this file's existing precedent in podcastImageUpload.test.jsx
 * ("click→upload→PATCH flow itself can't be simulated without a DOM
 * harness").
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

function renderDetails(publishedVer, pendingVer, role = 'OWNER') {
  return renderToString(
    h(DetailsSectionContent, {
      talentId: 't-1',
      publishedVersion: publishedVer,
      pendingVersion: pendingVer,
      displayName: 'מיוצג לבדיקה',
      role,
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

/*
 * Talent Details Lifecycle Unification sprint — Profile Image is now the
 * "profileImage" group/field buildDetailsGroups returns (see page.jsx),
 * consumed by ComparisonView's new "image" field type instead of a
 * sibling <ProfileImagePanel>.
 */
describe('buildDetailsGroups — profileImage field', () => {
  it('builds a null-safe published value and an undefined draftValue when there is no pending version', () => {
    const groups = buildDetailsGroups(publishedVersion, null);
    const imageGroup = groups.find((g) => g.key === 'profileImage');
    const imageField = imageGroup.fields.find((f) => f.key === 'profileImage');

    expect(imageField.type).toBe('image');
    expect(imageField.value).toEqual({
      assetUrl: publishedVersion.profileImageAsset.blobUrl,
      position: publishedVersion.profileImagePosition,
      scale: publishedVersion.profileImageScale,
    });
    expect(imageField.draftValue).toBeUndefined();
  });

  it('builds a draftValue from the pending version profile image when one exists — the Gap 1 fix, at the field-builder level', () => {
    const groups = buildDetailsGroups(null, draftVersion);
    const imageGroup = groups.find((g) => g.key === 'profileImage');
    const imageField = imageGroup.fields.find((f) => f.key === 'profileImage');

    expect(imageField.value).toEqual({ assetUrl: null, position: null, scale: null });
    expect(imageField.draftValue).toEqual({
      assetUrl: draftVersion.profileImageAsset.blobUrl,
      position: draftVersion.profileImagePosition,
      scale: draftVersion.profileImageScale,
    });
  });

  it('forwards uploadsEnabled/displayName into the image field render metadata, defaulting safely when omitted', () => {
    const withOptions = buildDetailsGroups(publishedVersion, null, {
      uploadsEnabled: false,
      displayName: 'מיוצג לבדיקה',
    });
    const fieldWithOptions = withOptions.find((g) => g.key === 'profileImage').fields[0];
    expect(fieldWithOptions.image.uploadDisabled).toBe(true);
    expect(fieldWithOptions.image.alt).toContain('מיוצג לבדיקה');

    const withoutOptions = buildDetailsGroups(publishedVersion, null);
    const fieldWithoutOptions = withoutOptions.find((g) => g.key === 'profileImage').fields[0];
    expect(fieldWithoutOptions.image.uploadDisabled).toBe(false);
  });
});

/*
 * Talent Details Lifecycle Unification sprint — Gap 1 regression guard
 * (the pending image now actually renders) + Gap 2 regression guard (one
 * lifecycle, not two). `he.editor.actions.cancel` ("בטל עריכה") is used as
 * the action-bar-instance counter: every <EditorActionBar> unconditionally
 * renders exactly one Cancel button (see that component's own props —
 * `onCancel` has no `show*` flag), so its occurrence count in the rendered
 * HTML is exactly the number of action bars on the page. Before this
 * sprint that count was 2 (ProfileImagePanel's own bar + ComparisonView's);
 * this suite locks it at 1.
 */
describe('DetailsSectionContent — unified Profile Image lifecycle (Gap 1 + Gap 2 regression)', () => {
  const CANCEL_LABEL = he.editor.actions.cancel;
  const SAVE_DRAFT_LABEL = he.editor.actions.saveDraft;
  const SUBMIT_LABEL = he.editor.actions.submit;
  const PUBLISH_LABEL = he.editor.actions.publishNow;

  function countOccurrences(haystack, needle) {
    return haystack.split(needle).length - 1;
  }

  it('renders the read-only Profile Image view with the Published image when there is no editable pending version', () => {
    const html = renderDetails(publishedVersion, null);
    expect(html).toContain(publishedVersion.profileImageAsset.blobUrl);
    expect(html).not.toContain(draftVersion.profileImageAsset.blobUrl);
    expect(html).toContain(he.media.viewEyebrowTitle);
  });

  it('renders the Profile Image editing surface seeded from the Draft image for a Draft-only Talent (Gap 1, end to end)', () => {
    const html = renderDetails(null, draftVersion);
    expect(html).toContain(draftVersion.profileImageAsset.blobUrl);
    expect(html).toContain(he.media.editingEyebrowTitle);
  });

  it('renders exactly one Save Draft/Cancel action bar for an editable Details tab (Gap 2)', () => {
    const html = renderDetails(publishedVersion, draftVersion);
    expect(countOccurrences(html, CANCEL_LABEL)).toBe(1);
    expect(countOccurrences(html, SAVE_DRAFT_LABEL)).toBe(1);
  });

  it('renders at most one forward action (Submit or Publish combined) for an Owner — Publish, not Submit', () => {
    const ownerHtml = renderDetails(publishedVersion, draftVersion, 'OWNER');
    expect(countOccurrences(ownerHtml, SUBMIT_LABEL) + countOccurrences(ownerHtml, PUBLISH_LABEL)).toBe(1);
    expect(countOccurrences(ownerHtml, PUBLISH_LABEL)).toBe(1);
    expect(countOccurrences(ownerHtml, SUBMIT_LABEL)).toBe(0);
  });

  it('renders at most one forward action (Submit or Publish combined) for an Employee — Submit, not Publish', () => {
    const employeeHtml = renderDetails(publishedVersion, draftVersion, 'EMPLOYEE');
    expect(countOccurrences(employeeHtml, SUBMIT_LABEL) + countOccurrences(employeeHtml, PUBLISH_LABEL)).toBe(1);
    expect(countOccurrences(employeeHtml, SUBMIT_LABEL)).toBe(1);
    expect(countOccurrences(employeeHtml, PUBLISH_LABEL)).toBe(0);
  });

  it('renders exactly one (disabled) action bar when there is no editable pending version — ComparisonView always renders its own bar; the fix is that ProfileImagePanel no longer also renders one', () => {
    const html = renderDetails(publishedVersion, null);
    expect(countOccurrences(html, CANCEL_LABEL)).toBe(1);
  });
});

/*
 * Production regression fix — RSC (React Server Components) serializability
 * of buildDetailsGroups' return value.
 *
 * page.jsx (buildDetailsGroups' home) is a Server Component; the `groups`
 * it returns is passed as a prop into <TalentDetailsEditor>, which is
 * "use client" — a Server -> Client boundary. React/Next's RSC Flight
 * serializer can only carry plain, JSON-shaped data across that boundary:
 * a function value anywhere in `groups` throws at request time (this is
 * exactly what broke production after 91e93aa — the "profileImage" field's
 * server-built `copy` object included `he.media.errors`, which contains
 * `tooLarge: (maxMb) => ...`).
 *
 * No existing test caught this because every test in this file renders the
 * component tree with plain react-dom/server `renderToString` — ordinary
 * in-memory React SSR, not Next's actual RSC Flight pipeline — so a
 * function sitting in props never gets serialized and never throws there.
 * This test instead inspects the *data* buildDetailsGroups returns,
 * directly, with no rendering at all: it recursively walks every group's
 * every field (including nested metadata objects like `image`) and fails
 * the moment it finds a function anywhere — a mechanical, render-free proxy
 * for "this is legal to pass across an RSC Server -> Client boundary."
 * It fails against the pre-fix implementation (the "profileImage" field's
 * `image.copy.errors.tooLarge` function) and passes once that copy is
 * assembled client-side instead (see ComparisonView.jsx's IMAGE_FIELD_COPY).
 */
describe('buildDetailsGroups — RSC Server→Client serializability', () => {
  function findFunctionPaths(value, path = 'groups') {
    if (typeof value === 'function') {
      return [path];
    }
    if (Array.isArray(value)) {
      return value.flatMap((item, index) => findFunctionPaths(item, `${path}[${index}]`));
    }
    if (value && typeof value === 'object') {
      return Object.entries(value).flatMap(([key, nested]) => findFunctionPaths(nested, `${path}.${key}`));
    }
    return [];
  }

  it('contains no function values anywhere — Draft-only fixture (no Published version)', () => {
    const groups = buildDetailsGroups(null, draftVersion, {
      uploadsEnabled: true,
      displayName: 'מיוצג לבדיקה',
    });

    expect(findFunctionPaths(groups)).toEqual([]);
  });

  it('contains no function values anywhere — Published + Draft fixture', () => {
    const groups = buildDetailsGroups(publishedVersion, draftVersion, {
      uploadsEnabled: true,
      displayName: 'מיוצג לבדיקה',
    });

    expect(findFunctionPaths(groups)).toEqual([]);
  });

  it('contains no function values anywhere — Published-only fixture, options omitted (defaults exercised)', () => {
    const groups = buildDetailsGroups(publishedVersion, null);

    expect(findFunctionPaths(groups)).toEqual([]);
  });
});
