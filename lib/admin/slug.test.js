/*
 * Slug utilities — Talent SEO + Slug Management sprint.
 * Locks the slug contract: a-z / 0-9 / single hyphens only, no Hebrew, no
 * spaces, no underscores, no double hyphens, no edge hyphens — plus the
 * "normalize automatically whenever possible" behavior and Generate From
 * Name's English-name preference.
 */
import { describe, it, expect } from 'vitest';
import {
  isValidSlug,
  validateSlug,
  normalizeSlug,
  generateSlugFromName,
  SLUG_ERROR,
} from '@/lib/admin/slug';

describe('validateSlug / isValidSlug', () => {
  it('accepts lowercase latin, digits, and single hyphens', () => {
    for (const slug of ['noa', 'noa-kirel', 'talent-42', 'a', '42', 'a-b-c-1']) {
      expect(isValidSlug(slug), slug).toBe(true);
      expect(validateSlug(slug)).toEqual({ valid: true, errors: [] });
    }
  });

  it('rejects empty / non-string input', () => {
    expect(validateSlug('')).toEqual({ valid: false, errors: [SLUG_ERROR.EMPTY] });
    expect(validateSlug(null).valid).toBe(false);
    expect(validateSlug(undefined).valid).toBe(false);
    expect(isValidSlug(null)).toBe(false);
  });

  it('rejects Hebrew characters', () => {
    const result = validateSlug('נועה-קירל');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(SLUG_ERROR.INVALID_CHARACTERS);
  });

  it('rejects spaces', () => {
    const result = validateSlug('noa kirel');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(SLUG_ERROR.WHITESPACE);
  });

  it('rejects underscores', () => {
    const result = validateSlug('noa_kirel');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(SLUG_ERROR.UNDERSCORE);
  });

  it('rejects uppercase', () => {
    const result = validateSlug('Noa-Kirel');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(SLUG_ERROR.UPPERCASE);
  });

  it('rejects special characters', () => {
    for (const slug of ['noa!', 'noa.kirel', 'noa/kirel', 'noa@kirel', 'noa#1']) {
      const result = validateSlug(slug);
      expect(result.valid, slug).toBe(false);
      expect(result.errors).toContain(SLUG_ERROR.INVALID_CHARACTERS);
    }
  });

  it('rejects double hyphens', () => {
    const result = validateSlug('noa--kirel');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(SLUG_ERROR.DOUBLE_HYPHEN);
  });

  it('rejects leading/trailing hyphens', () => {
    for (const slug of ['-noa', 'noa-', '-noa-']) {
      const result = validateSlug(slug);
      expect(result.valid, slug).toBe(false);
      expect(result.errors).toContain(SLUG_ERROR.EDGE_HYPHEN);
    }
  });

  it('reports every distinct problem at once', () => {
    const result = validateSlug('No a_b--c-');
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        SLUG_ERROR.UPPERCASE,
        SLUG_ERROR.WHITESPACE,
        SLUG_ERROR.UNDERSCORE,
        SLUG_ERROR.DOUBLE_HYPHEN,
        SLUG_ERROR.EDGE_HYPHEN,
      ])
    );
  });
});

describe('normalizeSlug', () => {
  it('lowercases', () => {
    expect(normalizeSlug('NoaKirel')).toBe('noakirel');
  });

  it('converts spaces and underscores to hyphens', () => {
    expect(normalizeSlug('noa kirel')).toBe('noa-kirel');
    expect(normalizeSlug('noa_kirel')).toBe('noa-kirel');
    expect(normalizeSlug('noa \t kirel')).toBe('noa-kirel');
  });

  it('collapses double hyphens and trims edge hyphens', () => {
    expect(normalizeSlug('--noa---kirel--')).toBe('noa-kirel');
  });

  it('strips latin diacritics', () => {
    expect(normalizeSlug('Beyoncé Café')).toBe('beyonce-cafe');
  });

  it('drops Hebrew and special characters instead of guessing', () => {
    expect(normalizeSlug('noa! קירל @2024')).toBe('noa-2024');
  });

  it('returns "" when nothing usable remains (purely Hebrew input)', () => {
    expect(normalizeSlug('נועה קירל')).toBe('');
  });

  it('is idempotent and its output always validates (or is empty)', () => {
    for (const input of ['  Héllo_World  --  שלום 42! ', 'ABC', 'a--b', '-x-', '!!!']) {
      const once = normalizeSlug(input);
      expect(normalizeSlug(once)).toBe(once);
      if (once !== '') {
        expect(isValidSlug(once), `${input} -> ${once}`).toBe(true);
      }
    }
  });

  it('tolerates non-string input', () => {
    expect(normalizeSlug(null)).toBe('');
    expect(normalizeSlug(undefined)).toBe('');
  });
});

describe('generateSlugFromName', () => {
  it('prefers the English name', () => {
    expect(generateSlugFromName({ name: 'נועה קירל', nameEn: 'Noa Kirel' })).toBe('noa-kirel');
  });

  it('falls back to the Hebrew-field name when it contains latin characters', () => {
    expect(generateSlugFromName({ name: 'DJ Cohen', nameEn: null })).toBe('dj-cohen');
  });

  it('returns "" for a purely Hebrew name with no English name', () => {
    expect(generateSlugFromName({ name: 'נועה קירל' })).toBe('');
    expect(generateSlugFromName({})).toBe('');
  });
});
