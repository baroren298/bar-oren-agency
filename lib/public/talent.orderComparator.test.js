/*
 * Talent Published Sort Order sprint — the public-read ordering comparator.
 *
 * Pure function, no DB, no mocks: `comparePublicTalentOrder` is exported
 * from lib/public/talent.js specifically so this can be tested directly
 * with Array.prototype.sort, the same way it's actually used in
 * getPublicTalentList. The regression this guards: fetchPublishedTalents
 * issues its query with no `orderBy`, so before this comparator existed a
 * tie (including the Lihi/Shilav sortOrder=7 duplicate) was broken by
 * whatever order Postgres happened to return rows in — non-deterministic
 * across requests and ISR revalidations.
 */
import { describe, it, expect } from 'vitest';
import { comparePublicTalentOrder } from './talent';

function talent(slug, sortOrder) {
  return { slug, sortOrder };
}

describe('comparePublicTalentOrder', () => {
  it('sorts sortOrder 1 before sortOrder 2', () => {
    const sorted = [talent('b', 2), talent('a', 1)].sort(comparePublicTalentOrder);
    expect(sorted.map((t) => t.slug)).toEqual(['a', 'b']);
  });

  it('sorts a null sortOrder last, after every numeric value', () => {
    const sorted = [talent('unset', null), talent('third', 3), talent('first', 1)].sort(
      comparePublicTalentOrder
    );
    expect(sorted.map((t) => t.slug)).toEqual(['first', 'third', 'unset']);
  });

  it('breaks a duplicate sortOrder deterministically by slug ascending', () => {
    // The exact shape of the Lihi/Shilav collision this sprint fixed.
    const sorted = [talent('shilav-jurin', 7), talent('lihi-levi', 7)].sort(comparePublicTalentOrder);
    expect(sorted.map((t) => t.slug)).toEqual(['lihi-levi', 'shilav-jurin']);
  });

  it('breaks a tie among multiple null sortOrders by slug ascending too', () => {
    const sorted = [talent('zeta', null), talent('alpha', null)].sort(comparePublicTalentOrder);
    expect(sorted.map((t) => t.slug)).toEqual(['alpha', 'zeta']);
  });

  it('produces the same output regardless of input row order', () => {
    const input = [
      talent('shilav-jurin', 7),
      talent('gal-arad', 9),
      talent('lihi-levi', 7),
      talent('unset', null),
      talent('gal-azar', 1),
    ];
    const forward = [...input].sort(comparePublicTalentOrder).map((t) => t.slug);
    const reversed = [...input].reverse().sort(comparePublicTalentOrder).map((t) => t.slug);

    expect(reversed).toEqual(forward);
    expect(forward).toEqual(['gal-azar', 'lihi-levi', 'shilav-jurin', 'gal-arad', 'unset']);
  });
});
