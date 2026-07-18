/*
 * Social Remove sprint — SocialLinksEditor.removeAccountFromProposed()
 * coverage.
 *
 * This repo's component tests are render-only (react-dom/server's
 * renderToString — see globalEditMode.test.jsx's header comment; there is
 * no jsdom/@testing-library dependency, so click/interaction simulation
 * isn't available). The Remove button's actual state transition is
 * therefore extracted as a small, named, exported pure function
 * (SocialLinksEditor.jsx's removeAccountFromProposed) so it can be tested
 * directly without rendering or simulating a click — the same reasoning
 * social-review.js's diff/filter helpers are already pure and exported.
 * handleRemove itself is a one-line wrapper around this function
 * (setProposedAccounts + clearStatuses); this test covers the actual
 * decision logic, which is the part that matters.
 */
import { describe, it, expect } from 'vitest';
import { removeAccountFromProposed } from '@/components/admin/SocialLinksEditor';

describe('removeAccountFromProposed — unsaved account (no id yet)', () => {
  it('splices the row out of local state entirely — no lifecycleStatus marking, nothing left to send to the server', () => {
    const accounts = [
      { _key: 'soc-1', id: 'social-1', platform: 'INSTAGRAM', handle: 'a' },
      { _key: 'local-1', id: null, platform: 'TIKTOK', handle: 'brand-new' },
    ];

    const next = removeAccountFromProposed(accounts, 'local-1');

    expect(next).toHaveLength(1);
    expect(next.map((a) => a._key)).toEqual(['soc-1']);
    // The removed entry is gone outright, not marked HIDDEN — there was
    // never a database row for it to mark.
    expect(next.find((a) => a._key === 'local-1')).toBeUndefined();
  });

  it('is a no-op when the key does not match any account', () => {
    const accounts = [{ _key: 'soc-1', id: 'social-1', platform: 'INSTAGRAM', handle: 'a' }];
    const next = removeAccountFromProposed(accounts, 'does-not-exist');
    expect(next).toBe(accounts);
  });
});

describe('removeAccountFromProposed — saved account (has a real id)', () => {
  it('marks the row lifecycleStatus HIDDEN in place, keeping it in the array (still sent on Save Draft)', () => {
    const accounts = [
      { _key: 'soc-1', id: 'social-1', platform: 'INSTAGRAM', handle: 'a', lifecycleStatus: 'ACTIVE' },
      { _key: 'soc-2', id: 'social-2', platform: 'TIKTOK', handle: 'b', lifecycleStatus: 'ACTIVE' },
    ];

    const next = removeAccountFromProposed(accounts, 'soc-1');

    expect(next).toHaveLength(2);
    const removed = next.find((a) => a._key === 'soc-1');
    expect(removed.lifecycleStatus).toBe('HIDDEN');
    // Every other field is untouched.
    expect(removed.platform).toBe('INSTAGRAM');
    expect(removed.handle).toBe('a');
    // The unrelated row is completely unaffected.
    expect(next.find((a) => a._key === 'soc-2').lifecycleStatus).toBe('ACTIVE');
  });
});
