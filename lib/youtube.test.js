/*
 * lib/youtube.js tests — Sprint 1: Fix broken YouTube button in the
 * Podcast admin tab.
 *
 * Pure functions, no I/O — no mocks needed, same style as
 * lib/admin/gallery-images.test.js.
 */

import { describe, it, expect } from 'vitest';
import {
  extractYouTubeVideoId,
  toYouTubeWatchUrl,
  toYouTubeEmbedUrl,
} from './youtube';

const ID = 'dQw4w9WgXcQ';

describe('extractYouTubeVideoId', () => {
  it('extracts the id from a watch URL', () => {
    expect(extractYouTubeVideoId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it('extracts the id from a youtu.be short URL', () => {
    expect(extractYouTubeVideoId(`https://youtu.be/${ID}`)).toBe(ID);
  });

  it('extracts the id from an embed URL', () => {
    expect(extractYouTubeVideoId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
  });

  it('extracts the id from a shorts URL', () => {
    expect(extractYouTubeVideoId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
  });

  it('extracts the id from a youtube-nocookie embed URL', () => {
    expect(extractYouTubeVideoId(`https://www.youtube-nocookie.com/embed/${ID}`)).toBe(ID);
  });

  it('ignores extra query parameters (t, si, list)', () => {
    expect(
      extractYouTubeVideoId(`https://www.youtube.com/watch?v=${ID}&t=42s&si=abc123&list=PL123`)
    ).toBe(ID);
    expect(extractYouTubeVideoId(`https://youtu.be/${ID}?t=10&si=xyz`)).toBe(ID);
  });

  it('supports optional www subdomain', () => {
    expect(extractYouTubeVideoId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it('supports the m. mobile subdomain', () => {
    expect(extractYouTubeVideoId(`https://m.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it('supports bare youtube.com without a subdomain', () => {
    expect(extractYouTubeVideoId(`https://youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it('returns null for non-YouTube hosts', () => {
    expect(extractYouTubeVideoId('https://vimeo.com/12345')).toBeNull();
  });

  it('returns null for lookalike hosts', () => {
    expect(extractYouTubeVideoId(`https://youtube.com.evil.example/watch?v=${ID}`)).toBeNull();
    expect(extractYouTubeVideoId(`https://notyoutube.com/watch?v=${ID}`)).toBeNull();
    expect(extractYouTubeVideoId(`https://fakeyoutu.be/${ID}`)).toBeNull();
  });

  it('returns null for malformed input without throwing', () => {
    expect(() => extractYouTubeVideoId('not a url')).not.toThrow();
    expect(extractYouTubeVideoId('not a url')).toBeNull();
    expect(extractYouTubeVideoId('')).toBeNull();
    expect(extractYouTubeVideoId(null)).toBeNull();
    expect(extractYouTubeVideoId(undefined)).toBeNull();
    expect(extractYouTubeVideoId(123)).toBeNull();
    expect(extractYouTubeVideoId({})).toBeNull();
  });

  it('returns null for a YouTube host with no recognizable video id', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/')).toBeNull();
    expect(extractYouTubeVideoId('https://www.youtube.com/channel/UC123')).toBeNull();
  });

  it('rejects non-http(s) protocols', () => {
    expect(extractYouTubeVideoId(`javascript:alert(1)`)).toBeNull();
    expect(extractYouTubeVideoId(`ftp://www.youtube.com/watch?v=${ID}`)).toBeNull();
  });
});

describe('toYouTubeWatchUrl', () => {
  it('converts an embed URL to a watch URL', () => {
    expect(toYouTubeWatchUrl(`https://www.youtube.com/embed/${ID}`)).toBe(
      `https://www.youtube.com/watch?v=${ID}`
    );
  });

  it('converts a youtube-nocookie embed URL to a watch URL', () => {
    expect(toYouTubeWatchUrl(`https://www.youtube-nocookie.com/embed/${ID}`)).toBe(
      `https://www.youtube.com/watch?v=${ID}`
    );
  });

  it('accepts a bare video id', () => {
    expect(toYouTubeWatchUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`);
  });

  it('returns null for invalid/non-YouTube input', () => {
    expect(toYouTubeWatchUrl('https://vimeo.com/12345')).toBeNull();
    expect(toYouTubeWatchUrl(null)).toBeNull();
    expect(toYouTubeWatchUrl('')).toBeNull();
  });
});

describe('toYouTubeEmbedUrl', () => {
  it('converts a watch URL to an embed URL', () => {
    expect(toYouTubeEmbedUrl(`https://www.youtube.com/watch?v=${ID}`)).toBe(
      `https://www.youtube.com/embed/${ID}`
    );
  });

  it('converts a youtu.be URL to an embed URL', () => {
    expect(toYouTubeEmbedUrl(`https://youtu.be/${ID}`)).toBe(
      `https://www.youtube.com/embed/${ID}`
    );
  });

  it('returns null for invalid/non-YouTube input', () => {
    expect(toYouTubeEmbedUrl('https://notyoutube.com/watch?v=' + ID)).toBeNull();
  });
});
