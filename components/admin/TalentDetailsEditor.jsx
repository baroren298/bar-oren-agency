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
 * "Editable PROPOSED" sprint: `versionId` may now point at either a DRAFT
 * or a PROPOSED version (the page's own DRAFT-or-PROPOSED gate decides
 * that, this component just acts on whichever id it's given). The new
 * `versionStatus` prop is what lets this component (a) tell ComparisonView
 * to show "עדכן הצעה" instead of "שמור כטיוטה" when editing an already-
 * PROPOSED version, and (b) only ever wire up `onSubmit` when the version
 * is still DRAFT — Submit stays DRAFT-only this sprint (no resubmitting an
 * already-PROPOSED version, no IN_REVIEW, no Owner locking yet).
 *
 * Props:
 *   - talentId (string, required)
 *   - versionId (string|null) — the editable DRAFT/PROPOSED version's id,
 *     or null if none
 *   - versionStatus (string|null, optional) — "DRAFT", "PROPOSED", or null;
 *     mirrors `versionId`'s presence/absence
 *   - groups (ComparisonView's `groups` prop, passed straight through)
 *   - role (string|null, optional) — Owner Direct Publish UX sprint. The
 *     current actor's role (lib/admin/constants/enums ROLE), threaded down
 *     from app/admin/talent/[id]/page.jsx (the one place per request that
 *     reads the session). `onPublish` is only ever wired up when
 *     `role === ROLE.OWNER` *and* an editable version exists — an EMPLOYEE
 *     session never receives the handler at all (no client-side flag to
 *     bypass, the same "absent prop, not a disabled one" pattern
 *     EditorActionBar's `showPublish` already documents). The actual
 *     enforcement remains server-side (requireOwner + the engine's
 *     assertActorIsOwner) — this is just the UI reflecting that without an
 *     extra round trip, same convention `versionId`/`isDraft` already use.
 */

import { useRouter } from "next/navigation";
import ComparisonView from "./ComparisonView";
import { VERSION_STATUS, ROLE } from "@/lib/admin/constants/enums";

/*
 * Talent Details Lifecycle Unification sprint — ComparisonView's
 * `values.profileImage` is the Profile Image field's live proposed value,
 * in the exact { assetUrl, assetId?, position, scale } shape
 * ImageEditorCard's onChange already produces (see ComparisonView's new
 * "image" field type) — not a real TalentVersion column itself. This
 * flattens it into the three real columns the API/repository expect,
 * exactly mirroring what the old, now-removed <ProfileImagePanel> PATCHed
 * on its own:
 *
 *   - `assetUrl` is a client-side display concern only — never sent.
 *   - `profileImagePosition`/`profileImageScale` are ALWAYS included, even
 *     when `null` — talentRepository.updateTalentVersionFields is a
 *     sparse, allowlisted update where an ABSENT key leaves the existing
 *     DB value untouched but a key present with `null` is a deliberate
 *     write, and clearing either back to its default is exactly that: a
 *     deliberate write, not an omission.
 *   - `profileImageAssetId` is included only when `assetId` is present on
 *     the value, i.e. a new upload actually completed during this editing
 *     session (see ImageEditorCard's onChange contract) — omitted
 *     otherwise, which leaves whatever asset id is already on the version
 *     untouched, the same "no need to know the published asset id
 *     client-side" property <ProfileImagePanel> relied on.
 *
 * Module-scope (not a closure inside the component) and exported: it is a
 * pure function of `values` — no talentId/versionId/router — and exporting
 * it lets this mapping be unit-tested directly, the same "export the pure
 * piece for testing" pattern page.jsx already uses for buildDetailsGroups.
 */
export function buildSaveFields(values) {
  const { profileImage, ...fields } = values;
  if (profileImage) {
    fields.profileImagePosition = profileImage.position ?? null;
    fields.profileImageScale = profileImage.scale ?? null;
    if (profileImage.assetId) {
      fields.profileImageAssetId = profileImage.assetId;
    }
  }
  return fields;
}

export default function TalentDetailsEditor({ talentId, versionId, versionStatus = null, groups, role = null }) {
  const isProposed = versionStatus === VERSION_STATUS.PROPOSED;
  const isDraft = versionStatus === VERSION_STATUS.DRAFT;
  const isOwner = role === ROLE.OWNER;
  const router = useRouter();

  async function handleSaveDraft(values) {
    const response = await fetch(`/api/admin/talent/${talentId}/proposals/${versionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: buildSaveFields(values) }),
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

  // Owner Direct Publish UX sprint — the Owner-only shortcut: POSTs to the
  // new app/api/admin/talent/[id]/proposals/[versionId]/publish/route.js,
  // which composes the *existing* proposalService.submit() (only if the
  // version is still DRAFT) and approvalService.approve() (which itself
  // already composes publishService.publish()) — no new business logic, an
  // OWNER-only route doing exactly what an OWNER clicking Submit-then-
  // Approve would already do today, in one request. Works for either a
  // DRAFT or an already-PROPOSED version (unlike handleSubmit above, which
  // is DRAFT-only) — see that route's header comment.
  async function handlePublishNow() {
    const response = await fetch(`/api/admin/talent/${talentId}/proposals/${versionId}/publish`, {
      method: "POST",
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body.error || `Publish failed (${response.status}).`);
    }

    // Same reasoning as handleSubmit's router.refresh() above: a successful
    // publish changes the version's status to PUBLISHED, which the page's
    // own pendingVersion read needs to re-derive (versionId flips back to
    // null afterward, disabling every action — there is nothing left to
    // edit until a new Draft is started).
    router.refresh();

    return body; // { version, parent }
  }

  return (
    <ComparisonView
      groups={groups}
      onSaveDraft={versionId ? handleSaveDraft : undefined}
      onSubmit={versionId && isDraft ? handleSubmit : undefined}
      showSubmit={!isOwner}
      onPublish={versionId && isOwner ? handlePublishNow : undefined}
      isProposed={isProposed}
    />
  );
}
