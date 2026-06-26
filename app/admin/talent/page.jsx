/*
 * /admin/talent — Sprint 4.1 (ADMIN_PANEL_PLAN.md Section 2's roster list,
 * scoped down to the read-only slice approved for this sprint).
 *
 * Server Component, calling straight into the Core Content Engine
 * (versionService.listParents + talentAdapter) — no API route needed yet,
 * since nothing here is a client-driven mutation (Section 13.15: the
 * Presentation layer may call the engine directly; an API route only
 * becomes necessary once a browser-side write needs to reach it).
 *
 * Strictly read-only per this sprint's approved scope:
 *   - no links to a talent editor (none exists yet — Section 9 Phase 4's
 *     /admin/talent/[id] is a later sprint),
 *   - no action buttons (approve/reject/propose/hide/archive — all later
 *     sprints),
 *   - no version content resolved or rendered (no bio/images/socials —
 *     versionService.listParents() deliberately never returns that; see
 *     its own header comment),
 *   - already gated by middleware.js's existing /admin session check, so
 *     no auth changes were needed for this route.
 *
 * Fields shown, exactly as proposed and approved before implementation:
 * name (from the current published TalentVersion, if any), slug, lifecycle
 * status, a "pending changes" flag, and a "published" flag.
 */

import { versionService } from '@/lib/admin/engine/versionService';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';

export const metadata = {
  title: 'Talent — Admin',
};

export default async function AdminTalentListPage() {
  const talents = await versionService.listParents(talentAdapter, {});

  return (
    <main style={{ padding: '2rem', maxWidth: 960, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Talent (read-only)</h1>

      {talents.length === 0 ? (
        <p>No talent records yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
              <th style={{ padding: '0.5rem' }}>Name</th>
              <th style={{ padding: '0.5rem' }}>Slug</th>
              <th style={{ padding: '0.5rem' }}>Status</th>
              <th style={{ padding: '0.5rem' }}>Published</th>
              <th style={{ padding: '0.5rem' }}>Pending changes</th>
            </tr>
          </thead>
          <tbody>
            {talents.map((talent) => (
              <tr key={talent.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}>{talent.name || '—'}</td>
                <td style={{ padding: '0.5rem' }}>{talent.slug}</td>
                <td style={{ padding: '0.5rem' }}>{talent.status}</td>
                <td style={{ padding: '0.5rem' }}>{talent.hasPublishedVersion ? 'Yes' : 'No'}</td>
                <td style={{ padding: '0.5rem' }}>{talent.hasPendingChanges ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
