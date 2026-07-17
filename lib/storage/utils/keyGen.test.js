/*
 * keyGen — Production Upload Enablement sprint. Locks the two properties
 * everything downstream (path safety in localProvider, uniqueness promises
 * made to vercelBlobProvider's addRandomSuffix: false) depends on: keys are
 * random UUIDs under a validated purpose prefix, never filename-derived.
 */
import { describe, it, expect } from 'vitest';
import { generateStorageKey } from './keyGen';

describe('generateStorageKey', () => {
  it('produces "<purpose>/<uuid>.<ext>" with the extension mapped from the mime type', () => {
    const key = generateStorageKey({ purpose: 'gallery', mimeType: 'image/jpeg' });
    expect(key).toMatch(/^gallery\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/);
  });

  it('maps each known mime type to its extension', () => {
    expect(generateStorageKey({ purpose: 'p', mimeType: 'image/png' })).toMatch(/\.png$/);
    expect(generateStorageKey({ purpose: 'p', mimeType: 'image/webp' })).toMatch(/\.webp$/);
    expect(generateStorageKey({ purpose: 'p', mimeType: 'image/gif' })).toMatch(/\.gif$/);
  });

  it('falls back to .bin for an unknown or missing mime type', () => {
    expect(generateStorageKey({ purpose: 'p', mimeType: 'application/x-thing' })).toMatch(/\.bin$/);
    expect(generateStorageKey({ purpose: 'p' })).toMatch(/\.bin$/);
  });

  it('never produces the same key twice', () => {
    const keys = new Set(
      Array.from({ length: 50 }, () => generateStorageKey({ purpose: 'gallery', mimeType: 'image/png' }))
    );
    expect(keys.size).toBe(50);
  });

  it('requires a purpose', () => {
    expect(() => generateStorageKey({})).toThrow(/purpose is required/);
    expect(() => generateStorageKey({ purpose: 42 })).toThrow(/purpose is required/);
  });

  it('rejects a purpose containing path separators or ".."', () => {
    expect(() => generateStorageKey({ purpose: '../etc' })).toThrow(/invalid purpose/);
    expect(() => generateStorageKey({ purpose: 'a/b' })).toThrow(/invalid purpose/);
    expect(() => generateStorageKey({ purpose: 'a\\b' })).toThrow(/invalid purpose/);
  });
});
