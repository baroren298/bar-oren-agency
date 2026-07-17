/*
 * One Edit Activation sprint — rendering-level coverage for the final
 * product decision: there is exactly ONE edit activation for the talent
 * workspace, the page-level header "התחל עריכה" button. Gallery, Socials,
 * and SEO never render their own local "התחל עריכה" CTA anymore — their
 * effective edit mode is derived only from `globalEditing` OR an existing
 * module-specific draft (Gallery/Socials only; SEO has no draft entity of
 * its own).
 *
 * Uses react-dom/server's renderToString: the initial server render is
 * exactly what decides whether a tab shows its read-only view or its
 * editable surface + action bar, so asserting on that HTML covers the
 * sprint's behaviors without needing a DOM/browser test dependency this
 * repo doesn't have. useEffect never runs during renderToString, and a
 * fetch spy asserts render performs zero network calls — opening a tab is
 * pure UI state, it never writes anything.
 *
 * next/navigation's useRouter is mocked (it requires Next's app-router
 * context, irrelevant here: it's only used by Submit/Publish/Resume
 * handlers these tests never invoke — those flows are exactly the ones
 * this sprint must not touch).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { he } from '@/lib/admin/i18n/he';
import { ROLE, VERSION_STATUS } from '@/lib/admin/constants/enums';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import MediaGalleryEditor from '@/components/admin/MediaGalleryEditor';
import SocialLinksEditor from '@/components/admin/SocialLinksEditor';
import SeoEditor from '@/components/admin/SeoEditor';

const START_EDITING = he.editor.actions.startEditing; // "התחל בעריכה"
const SAVE_DRAFT = he.editor.actions.saveDraft;
const SUBMIT = he.editor.actions.submit;
const PUBLISH_NOW = he.editor.actions.publishNow;
const CANCEL = he.editor.actions.cancel;

const publishedImage = {
  id: 'img-1',
  src: 'https://example.test/img-1.jpg',
  alt: 'תמונה',
  altHe: 'תמונה',
  altEn: 'Image',
  position: '50% 50%',
  scale: 1,
  mobileOrder: 0,
  order: 0,
  versionStatus: VERSION_STATUS.PUBLISHED,
};

const draftImage = { ...publishedImage, id: 'img-draft-1', versionStatus: VERSION_STATUS.DRAFT };

const publishedSocial = {
  id: 'soc-1',
  platform: 'INSTAGRAM',
  label: 'MAIN',
  customLabel: null,
  handle: 'bar',
  url: 'https://instagram.com/bar',
  sortOrder: 0,
};

const draftSocial = { ...publishedSocial, id: 'soc-draft-1', versionStatus: VERSION_STATUS.DRAFT };

let fetchSpy;

beforeEach(() => {
  fetchSpy = vi.fn(() => {
    throw new Error('render must never call fetch');
  });
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Gallery — one edit activation', () => {
  it('no global draft + no gallery draft → read-only, no local CTA anywhere', () => {
    // publishedImages deliberately empty: PublishedMediaGrid renders
    // next/image for non-empty lists, which needs the Next runtime this
    // plain renderToString harness doesn't provide. The empty read-only
    // view exercises exactly the same mode decision.
    const html = renderToString(
      h(MediaGalleryEditor, { talentId: 't-1', publishedImages: [], role: ROLE.EMPLOYEE })
    );
    expect(html).not.toContain(START_EDITING);
    expect(html).toContain(he.gallery.publishedEyebrowTitle);
    expect(html).not.toContain(SAVE_DRAFT);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('global editing active → editable immediately, no local CTA, action bar unchanged', () => {
    const html = renderToString(
      h(MediaGalleryEditor, {
        talentId: 't-1',
        publishedImages: [publishedImage],
        role: ROLE.EMPLOYEE,
        globalEditing: true,
      })
    );
    expect(html).not.toContain(START_EDITING);
    expect(html).toContain(he.gallery.proposedEyebrowTitle);
    expect(html).toContain(SAVE_DRAFT);
    expect(html).toContain(SUBMIT);
    expect(html).toContain(CANCEL);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('page editing, OWNER → Publish Now still rendered exactly as before, no local CTA', () => {
    const html = renderToString(
      h(MediaGalleryEditor, {
        talentId: 't-1',
        publishedImages: [publishedImage],
        role: ROLE.OWNER,
        globalEditing: true,
      })
    );
    expect(html).toContain(PUBLISH_NOW);
    expect(html).not.toContain(SUBMIT); // Owner sees Publish, not Submit — unchanged
    expect(html).not.toContain(START_EDITING);
  });

  it('existing gallery draft without global draft → editable, no local CTA, draft stays accessible', () => {
    const html = renderToString(
      h(MediaGalleryEditor, {
        talentId: 't-1',
        publishedImages: [publishedImage],
        draftImages: [draftImage],
        role: ROLE.EMPLOYEE,
        globalEditing: false,
      })
    );
    // Module draft alone still opens the editable surface — the draft is
    // neither hidden nor discarded — but no local activation button ever
    // renders, matching or without one.
    expect(html).not.toContain(START_EDITING);
    expect(html).toContain(he.gallery.proposedEyebrowTitle);
    expect(html).toContain(draftImage.src);
    expect(html).toContain(SAVE_DRAFT);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('Socials — one edit activation', () => {
  it('no global draft + no socials draft → read-only, no local CTA anywhere', () => {
    const html = renderToString(
      h(SocialLinksEditor, { talentId: 't-1', publishedSocials: [publishedSocial], role: ROLE.EMPLOYEE })
    );
    expect(html).not.toContain(START_EDITING);
    expect(html).not.toContain(SAVE_DRAFT);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('global editing active → editable immediately, no local CTA, action bar unchanged', () => {
    const html = renderToString(
      h(SocialLinksEditor, {
        talentId: 't-1',
        publishedSocials: [publishedSocial],
        role: ROLE.EMPLOYEE,
        globalEditing: true,
      })
    );
    expect(html).not.toContain(START_EDITING);
    expect(html).toContain(he.editor.sectionEditingLabel);
    expect(html).toContain(SAVE_DRAFT);
    expect(html).toContain(SUBMIT);
    expect(html).toContain(CANCEL);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('existing socials draft without global draft → editable, no local CTA, draft stays accessible', () => {
    const html = renderToString(
      h(SocialLinksEditor, {
        talentId: 't-1',
        publishedSocials: [publishedSocial],
        draftSocials: [draftSocial],
        role: ROLE.EMPLOYEE,
        globalEditing: false,
      })
    );
    expect(html).not.toContain(START_EDITING);
    expect(html).toContain(he.editor.sectionEditingLabel);
    expect(html).toContain(SAVE_DRAFT);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('SEO — one edit activation', () => {
  it('no global draft → read-only/preview-only, no local CTA', () => {
    const html = renderToString(h(SeoEditor, { publishedSeo: {} }));
    expect(html).not.toContain(START_EDITING);
    expect(html).toContain(he.seo.publishedEyebrowTitle);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('global editing active → preview-only editing surface opens immediately, no local CTA', () => {
    const html = renderToString(h(SeoEditor, { publishedSeo: {}, globalEditing: true }));
    expect(html).not.toContain(START_EDITING);
    expect(html).toContain(he.seo.proposedEyebrowTitle);
    // SEO stays preview-only: no Save Draft / Submit / Publish appear.
    expect(html).not.toContain(SAVE_DRAFT);
    expect(html).not.toContain(SUBMIT);
    expect(html).not.toContain(PUBLISH_NOW);
    expect(html).toContain(CANCEL);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
