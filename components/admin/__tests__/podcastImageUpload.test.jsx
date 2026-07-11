/*
 * Podcast Image Upload sprint — rendering-level coverage for PodcastTab's
 * "החלף תמונה" control, same react-dom/server harness as
 * globalEditMode.test.jsx (the initial server render decides what the tab
 * offers; a fetch spy proves render performs zero network calls — opening
 * the tab never uploads, never PATCHes, never creates a draft).
 *
 * The click→upload→PATCH flow itself can't be simulated without a DOM
 * harness; it's covered in lib/admin/podcast-image.test.js against the
 * extracted flow module PodcastTab calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { he } from '@/lib/admin/i18n/he';
import { VERSION_STATUS } from '@/lib/admin/constants/enums';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import PodcastTab from '@/components/admin/PodcastTab';

const copy = he.talent.detail.podcastTab;
const PUBLISHED_URL = 'https://blob.test/published-cover.jpg';
const PENDING_URL = 'https://blob.test/pending-cover.jpg';

function renderTab(overrides = {}) {
  return renderToString(
    h(PodcastTab, {
      talentId: 't-1',
      versionId: 'v-1',
      versionStatus: VERSION_STATUS.DRAFT,
      groups: [],
      podcastImageUrl: PUBLISHED_URL,
      podcastVideoEmbedUrl: 'https://www.youtube.com/embed/abc123',
      hasPodcastData: true,
      displayName: 'נועה',
      uploadsEnabled: true,
      ...overrides,
    })
  );
}

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

describe('PodcastTab — replace image control', () => {
  it('editable draft + uploads enabled → enabled "החלף תמונה" with a file input, no network on render', () => {
    const html = renderTab();
    expect(html).toContain(copy.replaceImage);
    expect(html).toContain('type="file"');
    // No unavailability hints in the fully-available state.
    expect(html).not.toContain(copy.replaceImageNoVersionHint);
    expect(html).not.toContain(he.media.uploadsDisabledHint);
    // The old permanently-disabled placeholder copy is gone.
    expect(html).not.toContain('החלפת תמונת הפודקאסט עדיין לא זמינה כאן.');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('no editable versionId → control disabled with the start-a-draft hint', () => {
    const html = renderTab({ versionId: null, versionStatus: null });
    expect(html).toMatch(/<button[^>]*disabled[^>]*>החלף תמונה<\/button>/);
    expect(html).toContain(copy.replaceImageNoVersionHint);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('uploadsEnabled=false → control disabled with the environment hint, even with an editable draft', () => {
    const html = renderTab({ uploadsEnabled: false });
    expect(html).toMatch(/<button[^>]*disabled[^>]*>החלף תמונה<\/button>/);
    expect(html).toContain(he.media.uploadsDisabledHint);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('no pending image → the published image is the preview (the fallback before any replacement)', () => {
    const html = renderTab();
    expect(html).toContain(PUBLISHED_URL);
    expect(html).not.toContain(copy.pendingImageHint);
  });

  it('pending draft image (e.g. after refresh) → preview shows it instead of the published image, flagged as not yet published', () => {
    const html = renderTab({ pendingPodcastImageUrl: PENDING_URL });
    expect(html).toContain(PENDING_URL);
    expect(html).not.toContain(PUBLISHED_URL);
    expect(html).toContain(copy.pendingImageHint);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('previous sprint\'s "צפייה ביוטיוב" behavior is preserved (embed URL → /watch link)', () => {
    const html = renderTab();
    expect(html).toContain(copy.viewOnYoutube);
    expect(html).toContain('https://www.youtube.com/watch?v=abc123');
  });
});
