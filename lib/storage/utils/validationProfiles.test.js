/*
 * validationProfiles — Production Upload Enablement sprint. Locks the
 * per-purpose upload rules (mime allowlist + size cap) and the
 * unknown-purpose failure mode the upload route maps to a 400.
 */
import { describe, it, expect } from 'vitest';
import { VALIDATION_PROFILES, getValidationProfile } from './validationProfiles';

describe('getValidationProfile', () => {
  it('returns the gallery profile: jpeg/png/webp, 8MB cap', () => {
    const profile = getValidationProfile('gallery');
    expect(profile.allowedMimeTypes).toEqual(['image/jpeg', 'image/png', 'image/webp']);
    expect(profile.maxBytes).toBe(8 * 1024 * 1024);
  });

  it('returns the profile-photo profile with the same allowlist and cap', () => {
    const profile = getValidationProfile('profile');
    expect(profile.allowedMimeTypes).toEqual(['image/jpeg', 'image/png', 'image/webp']);
    expect(profile.maxBytes).toBe(8 * 1024 * 1024);
  });

  // Podcast Image Upload sprint — "podcast" is a known purpose now, so the
  // unknown-purpose case uses a purpose nothing defines yet.
  it('returns the podcast profile with the same allowlist and cap as profile/gallery', () => {
    const profile = getValidationProfile('podcast');
    expect(profile.allowedMimeTypes).toEqual(['image/jpeg', 'image/png', 'image/webp']);
    expect(profile.maxBytes).toBe(8 * 1024 * 1024);
  });

  it('podcast profile rejects unsupported mime types (no svg, no gif, no pdf)', () => {
    const profile = getValidationProfile('podcast');
    for (const mime of ['image/svg+xml', 'image/gif', 'application/pdf', 'video/mp4']) {
      expect(profile.allowedMimeTypes).not.toContain(mime);
    }
  });

  it('throws with code UNKNOWN_PURPOSE for an unknown purpose, naming the known ones', () => {
    let thrown;
    try {
      getValidationProfile('logo');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.code).toBe('UNKNOWN_PURPOSE');
    expect(thrown.message).toContain('gallery');
  });

  it('never allowlists a mime type the sniffer cannot verify (no svg, no gif in profiles)', () => {
    for (const profile of Object.values(VALIDATION_PROFILES)) {
      expect(profile.allowedMimeTypes).not.toContain('image/svg+xml');
      expect(profile.allowedMimeTypes).not.toContain('image/gif');
    }
  });
});
