/*
 * /admin/talent/[id] — Sprint 4.2 (ADMIN_PANEL_PLAN.md Section 2's talent
 * editor route, scoped down to the read-only slice approved for this
 * sprint).
 *
 * Server Component, calling straight into the Core Content Engine
 * (versionService.getCurrentPublished / getCurrentDraftOrProposed +
 * talentAdapter) — same pattern as /admin/talent (Sprint 4.1): no API
 * route needed, since nothing here is a client-driven mutation (Section
 * 13.15: Presentation may call the engine directly for a decision-free
 * read).
 *
 * Strictly read-only per this sprint's approved scope:
 *   - no edit form, no propose/approve/reject/hide/archive actions,
 *   - no gallery/image rendering, no socials,
 *   - no diff view, no Live Preview,
 *   - no new engine/repository/Prisma code — every call below already
 *     existed before this sprint (versionService.getCurrentPublished,
 *     versionService.getCurrentDraftOrProposed, talentAdapter.getParent),
 *   - already gated by middleware.js's existing /admin/* session check
 *     (path-prefix match, so the dynamic [id] segment needed no changes),
 *   - no API route added.
 *
 * Fields shown, exactly as approved: from the Current Published
 * TalentVersion only — name (he/en), category, tags, location (he/en),
 * bio (he/en), featured flag — plus the talent's slug/lifecycle status
 * (from the parent Talent row) and a pending-changes indicator (whether a
 * DRAFT or PROPOSED version exists). If there is no published version yet,
 * that is stated plainly instead of rendering empty fields.
 *
 * Database-deferred bridge: see the matching comment in
 * /admin/talent/page.jsx — same reasoning applies here (force-dynamic +
 * isDatabaseConfigured guard so this page never runs its Prisma-backed
 * engine call during a build with no DATABASE_URL set).
 */

import { notFound } from 'next/navigation';
import { versionService } from '@/lib/admin/engine/versionService';
import { talentAdapter } from '@/lib/admin/engine/adapters/talentAdapter';
import { isDatabaseConfigured } from '@/lib/admin/db';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Talent detail — Admin',
};

const fieldRowStyle = { padding: '0.5rem 0', borderBottom: '1px solid #eee' };
const labelStyle = { fontWeight: 600, paddingRight: '1rem', width: '160px', verticalAlign: 'top' };

function FieldRow({ label, value }) {
  return (
    <tr style={fieldRowStyle}>
      <td style={labelStyle}>{label}</td>
      <td>{value === null || value === undefined || value === '' ? '—' : String(value)}</td>
    </tr>
  );
}

export default async function AdminTalentDetailPage({ params }) {
  if (!isDatabaseConfigured) {
    return (
      <main style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
        <p style={{ marginBottom: '0.5rem' }}>
          <a href="/admin/talent">&larr; Back to Talent</a>
        </p>
        <p>Database not configured yet.</p>
      </main>
    );
  }

  const { id } = await params;

  const talent = await talentAdapter.getParent(id);
  if (!talent) {
    notFound();
  }

  const [publishedVersion, pendingVersion] = await Promise.all([
    versionService.getCurrentPublished(talentAdapter, id),
    versionService.getCurrentDraftOrProposed(talentAdapter, id),
  ]);

  return (
    <main style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
      <p style={{ marginBottom: '0.5rem' }}>
        <a href="/admin/talent">&larr; Back to Talent</a>
      </p>

      <h1 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>
        {publishedVersion?.name || talent.slug} (read-only)
      </h1>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        <tbody>
          <FieldRow label="Slug" value={talent.slug} />
          <FieldRow label="Lifecycle status" value={talent.status} />
          <FieldRow label="Pending changes" value={pendingVersion ? 'Yes' : 'No'} />
        </tbody>
      </table>

      <h2 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>Current Published</h2>

      {!publishedVersion ? (
        <p>No published version yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <tbody>
            <FieldRow label="Name" value={publishedVersion.name} />
            <FieldRow label="Name (EN)" value={publishedVersion.nameEn} />
            <FieldRow
              label="Category"
              value={Array.isArray(publishedVersion.category) ? publishedVersion.category.join(', ') : null}
            />
            <FieldRow label="Tags" value={Array.isArray(publishedVersion.tags) ? publishedVersion.tags.join(', ') : null} />
            <FieldRow label="Location" value={publishedVersion.location} />
            <FieldRow label="Location (EN)" value={publishedVersion.locationEn} />
            <FieldRow label="Featured" value={publishedVersion.featured ? 'Yes' : 'No'} />
            <FieldRow label="Bio" value={publishedVersion.bioHe} />
            <FieldRow label="Bio (EN)" value={publishedVersion.bioEn} />
          </tbody>
        </table>
      )}
    </main>
  );
}
