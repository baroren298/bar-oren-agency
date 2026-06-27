"use client";

/*
 * TalentDetailsEditor — Save Draft sprint, extended by the Submit for
 * Approval sprint (Sprint 1).
 *
 * Thin client wrapper that owns the Talent-specific behavior ComparisonView
 * is explicitly not allowed to contain (required safeguard #2): the actual
 * PATCH/POST fetch calls against
 * app/api/admin/talent/[id]/proposals/[versionId]/route.js and its sibling
 * .../submit/route.js, plus the talentId/versionId/URL knowledge those
 * calls need. ComparisonView itself stays exactly as generic/entity-agnostic
 * as it already was — it only ever receives plain `onSaveDraft(values)` /
 * `onSubmit()` callback props.
 *
 * `versionId` is `null` whenever there is no editable DRAFT for this talent
 * right now (no pending version at all, or the pending version is already
 * PROPOSED and therefore not editable — see proposalService.update()'s
 * server-side DRAFT-only guard, which is the actual authority here; this is
 * just the UI reflecting that same state without a network round trip).
 * When `versionId` is null, neither `onSaveDraft` nor `onSubmit` is passed
 * down, so ComparisonView's Save Draft and Submit buttons both stay
 * disabled exactly like the pre-existing "always disabled" behavior — no
 * new way to call either API with nothing to act on.
 *
 * Save Draft sprint's locked "prefer local state over router.refresh()"
 * decision still applies to `handleSaveDraft` below: it does not refresh the
 * page, since the saved fields already live in ComparisonView's own local
 * state and the employee may keep editing.
 *
 * Submit is different on purpose: a successful submit changes the version's
 * *status* (DRAFT -> PROPOSED), which several things on the parent Server
 * Component page depend on (the StatusBadge, and — per this sprint's
 * required safeguard #8 — `versionId` itself, since the page only ever
 * passes down the id of a version that is still DRAFT). `handleSubmit`
 * therefore does call `router.refresh()` after a successful submit, the
 * same pattern StartEditingButton.jsx already uses for its own
 * state-changing action. That refresh re-derives `versionId` as `null` on
 * the next render, which is what actually makes Save Draft (and Submit
 * itself) unavailable afterward — no separate "locked" flag needed here.
 *
 * Props:
 *   - talentId (string, required)
 *   - versionId (string|null) — the editable DRAFT's id, or null if none
 *   - groups (ComparisonView's `groups` prop, passed straight through)
 */

import { useRouter } from "next/navigation";
import ComparisonView from "./ComparisonView";

export default function TalentDetailsEditor({ talentId, versionId, groups }) {
  const router = useRouter();

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

  async function handleSubmit() {
    const response = await fetch(`/api/admin/talent/${talentId}/proposals/${versionId}/submit`, {
      method: "POST",
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body.error || `Submit failed (${response.status}).`);
    }

    // Re-fetch the Server Component tree so the page's own pendingVersion
    // read (versionService.getCurrentDraftOrProposed, in
    // app/admin/talent/[id]/page.jsx) picks up the new PROPOSED status —
    // this is what flips `versionId` passed into this component back to
    // `null`, disabling Save Draft/Submit (required safeguard #8).
    router.refresh();

    return body; // { version }
  }

  return (
    <ComparisonView
      groups={groups}
      onSaveDraft={versionId ? handleSaveDraft : undefined}
      onSubmit={versionId ? handleSubmit : undefined}
    />
  );
}
