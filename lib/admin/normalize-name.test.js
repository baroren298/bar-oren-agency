/*
 * normalizeName — unit tests (Sprint 7B: Clients & Brands Foundation).
 *
 * The duplicate-prevention contract lives or dies on this function, so its
 * edge cases are proven directly: Hebrew names must survive intact (the
 * exact failure normalizeSlug would have — see normalize-name.js's
 * header), Latin case and whitespace differences must collapse, and
 * meaningful punctuation must NOT be stripped. All fixtures are synthetic
 * Demo data per the sprint's development-data policy.
 */
import { describe, it, expect } from 'vitest';
import { normalizeName } from './normalize-name';

describe('normalizeName', () => {
  it('returns "" for non-string and empty input', () => {
    expect(normalizeName(undefined)).toBe('');
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(42)).toBe('');
    expect(normalizeName('')).toBe('');
    expect(normalizeName('   ')).toBe('');
  });

  it('keeps Hebrew names intact (never strips Hebrew letters)', () => {
    expect(normalizeName('לקוח דמו א׳')).toBe('לקוח דמו א׳');
    expect(normalizeName('מותג דמו קיץ')).toBe('מותג דמו קיץ');
  });

  it('trims and collapses internal whitespace runs', () => {
    expect(normalizeName('  לקוח דמו א׳ ')).toBe('לקוח דמו א׳');
    expect(normalizeName('לקוח   דמו\tא׳')).toBe('לקוח דמו א׳');
  });

  it('lowercases Latin names so case variants collide', () => {
    expect(normalizeName('Demo Brand')).toBe('demo brand');
    expect(normalizeName('DEMO BRAND')).toBe('demo brand');
  });

  it('treats retyped variants of the same name as equal', () => {
    expect(normalizeName('לקוח דמו א׳ ')).toBe(normalizeName('לקוח  דמו א׳'));
    expect(normalizeName('Demo Client')).toBe(normalizeName('  demo   CLIENT '));
  });

  it('does NOT strip meaningful punctuation — differently punctuated names stay distinct', () => {
    expect(normalizeName('מותג דמו בית')).not.toBe(normalizeName('מותג דמו-בית'));
    expect(normalizeName('דמו & שות׳')).toBe('דמו & שות׳');
  });
});
