/*
 * Website CMS Focus Cleanup — talent workspace no longer offers a Campaigns
 * tab (My Agency business module, not Website CMS content). The remaining
 * website-content sections must be untouched.
 */

import { describe, it, expect } from 'vitest';
import { TALENT_WORKSPACE_SECTIONS } from './talent-workspace';

describe('TALENT_WORKSPACE_SECTIONS after Campaigns removal', () => {
  const keys = TALENT_WORKSPACE_SECTIONS.map((s) => s.key);

  it('no longer includes the campaigns tab', () => {
    expect(keys).not.toContain('campaigns');
  });

  it('keeps every website-content section intact and in order', () => {
    expect(keys).toEqual(['details', 'gallery', 'socials', 'seo', 'podcast', 'history']);
  });
});
