"use client";

/*
 * TalentDetailsEditor — Save Draft sprint.
 *
 * Thin client wrapper that owns the one piece of Talent-specific behavior
 * ComparisonView is explicitly not allowed to contain (required safeguard
 * #2): the actual PATCH fetch call against
 * app/api/admin/talent/[id]/proposals/[versionId]/route.js, plus the
 * talentId/versionId/URL knowledge that call needs. ComparisonView itself
 * stays exactly as generic/entity-agnostic as it already was — it only
 * ever receives a plain `onSaveDraft(values)` callback prop.
 *
 * `versionId` is `null` whenever there is no editable DRAFT for this talent
 * right now (no pending version at all, or the pending version is already
 * PROPOSED and therefore not editable — see proposalService.update()'s
 * server-side DRAFT-only guard, which is the actual authority here; this is
 * just the UI reflecting that same state without a network round trip).
 * When `versionId` is null, no `onSaveDraft` is passed down at all, so
 * ComparisonView's Save Draft button stays disabled exactly like the
 * pre-existing "always disabled" behavior — no new way to call the API
 * with nothing to save against.
 *
 * Per the locked "prefer local state over router.refresh()" decision: this
 * component does not call `router.refresh()` on save. The saved fields
 * already live in ComparisonView's own local state (the proposed values
 * the employee can keep editing); refetching the whole Server Component
 * tree on every save would be unnecessary churn for a manual-save, no-redirect
 * flow.
 *
 * Props:
 *   - talentId (string, required)
 *   - versionId (string|null) — the editable DRAFT's id, or null if none
 *   - groups (ComparisonView's `groups` prop, passed straight through)
 */

import ComparisonView from "./ComparisonView";

export default function TalentDetailsEditor({ talentId, versionId, groups }) {
  async function handleSaveDraft(values) {
    const response = await fetch(`/api/admin/talent/${talentId}/proposals/${versionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: values }),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body.error || `Save failed (${response.status}).`);
    }

    return body; // { version, conflict, validation }
  }

  return <ComparisonView groups={groups} onSaveDraft={versionId ? handleSaveDraft : undefined} />;
}
