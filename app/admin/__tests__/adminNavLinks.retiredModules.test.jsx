/*
 * Website CMS Focus Cleanup — admin navigation no longer surfaces the
 * retired business modules. Clients and Campaigns links must be gone;
 * the Website CMS items (and the Owner-only Administration items) must
 * remain. Rendered to static markup; usePathname is mocked.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
}));

import AdminNavLinks from '../AdminNavLinks';
import { ROLE } from '@/lib/admin/constants/enums';

function markup(role) {
  return renderToStaticMarkup(<AdminNavLinks role={role} />);
}

describe('AdminNavLinks after retiring Clients & Campaigns', () => {
  it('does not render a Clients nav link', () => {
    expect(markup(ROLE.OWNER)).not.toContain('href="/admin/clients"');
  });

  it('does not render a Campaigns nav link', () => {
    expect(markup(ROLE.OWNER)).not.toContain('href="/admin/campaigns"');
  });

  it('still renders the Website CMS items (Talent, My Work, Dashboard)', () => {
    const html = markup(ROLE.EMPLOYEE);
    expect(html).toContain('href="/admin/talent"');
    expect(html).toContain('href="/admin/my-work"');
    expect(html).toContain('href="/admin"');
  });

  it('still renders the Owner-only Administration items (Users, Audit Log)', () => {
    const html = markup(ROLE.OWNER);
    expect(html).toContain('href="/admin/users"');
    expect(html).toContain('href="/admin/audit-log"');
  });
});
