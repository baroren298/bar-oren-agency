/*
 * Talent SEO + Slug Management sprint — rendering-level coverage for the
 * rebuilt SEO tab (components/admin/SeoEditor.jsx): slug/URL preview,
 * Google search preview, Open Graph preview, smart-default fallbacks,
 * draft-value seeding, and the action-bar wiring rules.
 *
 * Same technique as globalEditMode.test.jsx: react-dom/server's
 * renderToString — the initial server render decides everything asserted
 * here, useEffect never runs (so the debounced slug-availability check
 * never fires), and a fetch spy proves rendering performs zero network
 * calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { he } from '@/lib/admin/i18n/he';
import { ROLE, VERSION_STATUS } from '@/lib/admin/constants/enums';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import SeoEditor from '@/components/admin/SeoEditor';
import SearchResultPreview from '@/components/admin/SearchResultPreview';
import OpenGraphPreview from '@/components/admin/OpenGraphPreview';

const SAVE_DRAFT = he.editor.actions.saveDraft;
const SUBMIT = he.editor.actions.submit;
const PUBLISH_NOW = he.editor.actions.publishNow;

const DEFAULTS = {
  name: 'נועה קירל',
  nameEn: 'Noa Kirel',
  bio: 'ביוגרפיה לדוגמה',
  profileImage: 'https://blob.test/profile.jpg',
};

let fetchSpy;
beforeEach(() => {
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Slug preview', () => {
  it('read-only mode shows the full public URL built from the PUBLISHED slug', () => {
    const html = renderToString(
      h(SeoEditor, { talentId: 't-1', publishedSlug: 'noa-kirel', publishedSeo: {}, defaults: DEFAULTS })
    );
    expect(html).toContain('https://baroren.co.il/talent/noa-kirel');
    expect(html).toContain(he.seo.slug.publishedLabel);
    // no editable slug input in read-only mode
    expect(html).not.toContain(he.seo.slug.generateFromName);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('editing mode shows the draft slug in the input, the live URL preview, and both slug actions', () => {
    const html = renderToString(
      h(SeoEditor, {
        talentId: 't-1',
        versionId: 'v-1',
        versionStatus: VERSION_STATUS.DRAFT,
        role: ROLE.EMPLOYEE,
        globalEditing: true,
        publishedSlug: 'noa-kirel',
        draftSlug: 'noa-kirel-official',
        publishedSeo: {},
        draftSeo: {},
        defaults: DEFAULTS,
      })
    );
    // only the slug segment is editable; the prefix renders as fixed text
    expect(html).toContain('https://baroren.co.il/talent/');
    expect(html).toContain('value="noa-kirel-official"');
    // live URL preview reflects the DRAFT slug
    expect(html).toContain('https://baroren.co.il/talent/noa-kirel-official');
    expect(html).toContain(he.seo.slug.generateFromName);
    expect(html).toContain(he.seo.slug.resetToPublished);
    // the public URL only changes after Publish — the notice says so
    expect(html).toContain(he.seo.slug.urlChangeNotice);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('SEO draft persistence — seeding', () => {
  it('editing mode seeds field values from the saved DRAFT, not from published', () => {
    const html = renderToString(
      h(SeoEditor, {
        talentId: 't-1',
        versionId: 'v-1',
        versionStatus: VERSION_STATUS.DRAFT,
        role: ROLE.EMPLOYEE,
        globalEditing: true,
        publishedSlug: 'noa-kirel',
        publishedSeo: { seoTitle: 'כותרת מפורסמת' },
        draftSeo: { seoTitle: 'כותרת טיוטה' },
        draftSlug: 'noa-kirel',
        defaults: DEFAULTS,
      })
    );
    expect(html).toContain('כותרת טיוטה');
    // the Google preview also reflects the draft value live
    expect(html).not.toContain('value="כותרת מפורסמת"');
  });
});

describe('Google preview rendering', () => {
  it('renders the proposed SEO title + description and the public URL', () => {
    const html = renderToString(
      h(SearchResultPreview, {
        title: 'Custom Title',
        description: 'Custom description',
        url: 'https://baroren.co.il/talent/noa-kirel',
      })
    );
    expect(html).toContain(he.seo.preview.title);
    expect(html).toContain('Custom Title');
    expect(html).toContain('Custom description');
    expect(html).toContain('https://baroren.co.il/talent/noa-kirel');
  });

  it('inside SeoEditor, empty SEO fields fall back to the smart defaults (name + bio)', () => {
    const html = renderToString(
      h(SeoEditor, {
        talentId: 't-1',
        publishedSlug: 'noa-kirel',
        publishedSeo: {},
        defaults: DEFAULTS,
      })
    );
    // Google preview shows name/bio, never the "(no title yet)" placeholders
    expect(html).toContain(DEFAULTS.name);
    expect(html).toContain(DEFAULTS.bio);
    expect(html).not.toContain(he.seo.preview.untitled);
    expect(html).not.toContain(he.seo.preview.noDescription);
  });
});

describe('Open Graph preview rendering', () => {
  it('renders image, title, and description when values exist', () => {
    const html = renderToString(
      h(OpenGraphPreview, {
        imageUrl: 'https://cdn.test/og.jpg',
        title: 'OG Title',
        description: 'OG description',
        url: 'https://baroren.co.il/talent/noa-kirel',
      })
    );
    expect(html).toContain(he.seo.ogPreview.title);
    expect(html).toContain('https://cdn.test/og.jpg');
    expect(html).toContain('OG Title');
    expect(html).toContain('OG description');
  });

  it('gracefully falls back when everything is empty', () => {
    const html = renderToString(h(OpenGraphPreview, { imageUrl: null, title: null, description: null }));
    expect(html).toContain(he.seo.ogPreview.noImage);
    expect(html).toContain(he.seo.preview.untitled);
    expect(html).toContain(he.seo.preview.noDescription);
  });

  it('inside SeoEditor, the OG image falls back to the profile image (smart default)', () => {
    const html = renderToString(
      h(SeoEditor, {
        talentId: 't-1',
        publishedSlug: 'noa-kirel',
        publishedSeo: {},
        defaults: DEFAULTS,
      })
    );
    expect(html).toContain(DEFAULTS.profileImage);
    // OG title smart default: "<name> | Bar Oren"
    expect(html).toContain(`${DEFAULTS.name} | Bar Oren`);
  });

  it('published OG values win over the smart defaults', () => {
    const html = renderToString(
      h(SeoEditor, {
        talentId: 't-1',
        publishedSlug: 'noa-kirel',
        publishedSeo: {
          seoOgTitle: 'כותרת OG מותאמת',
          seoOgImageUrl: 'https://cdn.test/custom-og.jpg',
        },
        defaults: DEFAULTS,
      })
    );
    expect(html).toContain('כותרת OG מותאמת');
    expect(html).toContain('https://cdn.test/custom-og.jpg');
    expect(html).not.toContain(`${DEFAULTS.name} | Bar Oren`);
  });
});

describe('Action bar wiring — same workflow as every other Talent field', () => {
  it('EMPLOYEE editing a DRAFT: Save Draft + Submit, never Publish Now', () => {
    const html = renderToString(
      h(SeoEditor, {
        talentId: 't-1',
        versionId: 'v-1',
        versionStatus: VERSION_STATUS.DRAFT,
        role: ROLE.EMPLOYEE,
        globalEditing: true,
        publishedSlug: 'noa-kirel',
        draftSlug: 'noa-kirel',
        publishedSeo: {},
        draftSeo: {},
        defaults: DEFAULTS,
      })
    );
    expect(html).toContain(SAVE_DRAFT);
    expect(html).toContain(SUBMIT);
    expect(html).not.toContain(PUBLISH_NOW);
  });

  it('OWNER editing a DRAFT: Save Draft + Publish Now, no Submit button', () => {
    const html = renderToString(
      h(SeoEditor, {
        talentId: 't-1',
        versionId: 'v-1',
        versionStatus: VERSION_STATUS.DRAFT,
        role: ROLE.OWNER,
        globalEditing: true,
        publishedSlug: 'noa-kirel',
        draftSlug: 'noa-kirel',
        publishedSeo: {},
        draftSeo: {},
        defaults: DEFAULTS,
      })
    );
    expect(html).toContain(SAVE_DRAFT);
    expect(html).toContain(PUBLISH_NOW);
    expect(html).not.toContain(SUBMIT);
  });

  it('global editing without an editable version (no versionId): editable surface, no persistence buttons', () => {
    const html = renderToString(
      h(SeoEditor, { publishedSeo: {}, globalEditing: true, defaults: DEFAULTS })
    );
    expect(html).toContain(he.seo.proposedEyebrowTitle);
    expect(html).not.toContain(SAVE_DRAFT);
    expect(html).not.toContain(SUBMIT);
    expect(html).not.toContain(PUBLISH_NOW);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
