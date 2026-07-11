"use client";

/*
 * SeoEditor — SEO Editor Foundation sprint, completed by the Talent SEO +
 * Slug Management sprint: the SEO tab is no longer preview-only. It is now
 * a full editing surface for the versioned slug + SEO fields that live on
 * TalentVersion (slug, seoTitle, seoDescription, seoCanonicalUrl,
 * seoOgTitle, seoOgDescription, seoOgImageUrl, seoNoindex), wired to the
 * exact same Draft → Submit → Approve → Publish machinery every other
 * Talent field already uses:
 *
 *   - Save Draft / "עדכן הצעה" → PATCH /api/admin/talent/[id]/proposals/
 *     [versionId] (the existing route; the repository's WRITABLE_COLUMNS
 *     allowlist is what actually admits the new columns).
 *   - Submit → POST .../submit (DRAFT-only, same as TalentDetailsEditor).
 *   - Publish Now (OWNER only) → POST .../publish.
 *
 * No new save mechanism, no SEO-specific API route, no parallel version
 * store — one pending TalentVersion per talent carries Details, Podcast,
 * visibility, AND slug/SEO together, so a single Publish flips everything
 * at once. Public behavior can only change at that Publish moment:
 * Talent.slug is rewritten (after the duplicate-slug gate) inside
 * talentRepository.publishTalentVersion's transaction, and the public
 * page's generateMetadata reads only the currentPublishedVersion.
 *
 * Slug editor (sprint Part 1):
 *   - Only the slug segment is editable; the full public URL
 *     (https://baroren.co.il/talent/<slug>) is previewed live around it.
 *   - Live validation via lib/admin/slug.js (a-z / 0-9 / single hyphens
 *     only) with per-problem Hebrew messages; input is auto-normalized as
 *     the user types (lowercase, spaces/underscores → hyphen, disallowed
 *     characters — including Hebrew — dropped, double hyphens collapsed)
 *     and fully normalized on blur (edge hyphens trimmed).
 *   - Debounced duplicate detection against /api/admin/talent/[id]/
 *     slug-availability (advisory; the publish transaction is the
 *     authoritative gate).
 *   - "Generate From Name" (prefers the English name — Hebrew is never
 *     transliterated) and "Reset To Published".
 *
 * Live previews (sprint Part 2): a Google search result preview
 * (SearchResultPreview) and an Open Graph share card (OpenGraphPreview),
 * both re-rendered on every keystroke from the proposed values with the
 * sprint's smart defaults applied — empty SEO title falls back to the
 * talent name, empty description to the bio, empty OG image to the profile
 * image, empty canonical to the current public URL.
 *
 * Editing behavior: follows Global Edit Mode exactly — the editable
 * surface opens iff `globalEditing` (no local "Start Editing" activation),
 * and the action buttons exist only when the page resolved an editable
 * pending version (`versionId`), mirroring TalentDetailsEditor's
 * "absent prop, not a disabled one" convention.
 *
 * Props:
 *   - talentId (string|null) — required for any persistence
 *   - versionId (string|null) — the editable DRAFT/PROPOSED version's id
 *   - versionStatus ("DRAFT"|"PROPOSED"|null)
 *   - role (ROLE string|null) — OWNER gets Publish Now
 *   - publishedSlug (string) — Talent.slug, the live public slug
 *   - publishedSeo ({ [seoFieldKey]: value }) — currentPublishedVersion's
 *     SEO values
 *   - draftSeo ({ [seoFieldKey]: value }|null) — pending version's values
 *   - draftSlug (string|null) — pending version's proposed slug
 *   - defaults ({ name, nameEn, bio, profileImage }) — smart-default
 *     sources, from the published version
 *   - groups — field registry override (defaults to SEO_FIELD_GROUPS)
 *   - globalEditing (boolean)
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./SeoEditor.module.css";
import SeoFieldRow from "./SeoFieldRow";
import SearchResultPreview from "./SearchResultPreview";
import OpenGraphPreview from "./OpenGraphPreview";
import EditorActionBar from "./EditorActionBar";
import SecondaryButton from "./SecondaryButton";
import { he } from "@/lib/admin/i18n/he";
import { SEO_FIELD_GROUPS } from "@/lib/admin/seo-fields";
import { validateSlug, normalizeSlug, generateSlugFromName } from "@/lib/admin/slug";
import { deriveEffectiveEditing } from "@/lib/admin/edit-mode";
import { VERSION_STATUS, ROLE } from "@/lib/admin/constants/enums";
import { siteConfig } from "@/data/site";

const PUBLIC_BASE_URL = siteConfig?.meta?.url || "https://baroren.co.il";

function publicUrlFor(slug) {
  return `${PUBLIC_BASE_URL}/talent/${slug || ""}`;
}

/*
 * Light, typing-friendly normalization applied on every keystroke: fixes
 * everything fixable without fighting the caret (lowercase, whitespace/
 * underscore → hyphen, disallowed characters dropped, double hyphens
 * collapsed) but deliberately KEEPS a leading/trailing hyphen so "noa-"
 * can be typed on the way to "noa-kirel". The full normalizeSlug (which
 * trims edge hyphens) runs on blur; validateSlug flags whatever remains.
 */
function liveNormalizeSlug(input) {
  return (input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-");
}

function resolveDefaultHint(defaultKey, defaults, currentSlug) {
  switch (defaultKey) {
    case "name":
      // Show the actual talent name when known — concrete beats abstract.
      return defaults.name || he.seo.defaults.name;
    case "bio":
      // The bio itself is too long for a hint; name the source instead.
      return he.seo.defaults.bio;
    case "profileImage":
      return he.seo.defaults.profileImage;
    case "publicUrl":
      return publicUrlFor(currentSlug);
    default:
      return undefined;
  }
}

function buildInitialValues({ groups, publishedSeo, draftSeo, publishedSlug, draftSlug }) {
  const source = draftSeo || publishedSeo || {};
  const values = groups.reduce((acc, group) => {
    group.fields.forEach((field) => {
      if (field.type === "boolean") {
        acc[field.key] = Boolean(source[field.key]);
      } else {
        acc[field.key] = source[field.key] ?? null;
      }
    });
    return acc;
  }, {});
  values.slug = draftSlug ?? publishedSlug ?? "";
  return values;
}

export default function SeoEditor({
  talentId = null,
  versionId = null,
  versionStatus = null,
  role = null,
  publishedSlug = "",
  publishedSeo = {},
  draftSeo = null,
  draftSlug = null,
  defaults = {},
  groups = SEO_FIELD_GROUPS,
  globalEditing = false,
}) {
  const router = useRouter();

  // One Edit Activation — effective mode is derived purely from the
  // page-level global editing session; SEO has no local activation.
  const isEditing = deriveEffectiveEditing({ globalEditing });
  const canPersist = Boolean(talentId && versionId);
  const isDraft = versionStatus === VERSION_STATUS.DRAFT;
  const isProposed = versionStatus === VERSION_STATUS.PROPOSED;
  const isOwner = role === ROLE.OWNER;

  const seed = () => buildInitialValues({ groups, publishedSeo, draftSeo, publishedSlug, draftSlug });
  const [proposedValues, setProposedValues] = useState(seed);
  const [savedValues, setSavedValues] = useState(seed);

  const [saveStatus, setSaveStatus] = useState("idle");
  const [saveError, setSaveError] = useState(null);
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitError, setSubmitError] = useState(null);
  const [publishStatus, setPublishStatus] = useState("idle");
  const [publishError, setPublishError] = useState(null);

  // Debounced duplicate-slug detection. `state` is idle | checking |
  // available | taken | error; advisory only — the publish transaction's
  // in-transaction check is the authoritative gate.
  const [slugCheck, setSlugCheck] = useState({ state: "idle", slug: null });
  const slugCheckRequestRef = useRef(0);

  const slugValidation = validateSlug(proposedValues.slug);
  const isDirty = JSON.stringify(proposedValues) !== JSON.stringify(savedValues);
  const saving = saveStatus === "saving";
  const submitting = submitStatus === "submitting";
  const publishing = publishStatus === "publishing";
  const busy = saving || submitting || publishing;

  useEffect(() => {
    if (!isEditing || !canPersist) return undefined;
    const slug = proposedValues.slug;

    if (!slug || !slugValidation.valid || slug === publishedSlug) {
      setSlugCheck({ state: "idle", slug });
      return undefined;
    }

    const requestId = ++slugCheckRequestRef.current;
    setSlugCheck({ state: "checking", slug });
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/admin/talent/${talentId}/slug-availability?slug=${encodeURIComponent(slug)}`
        );
        const body = await response.json().catch(() => ({}));
        if (slugCheckRequestRef.current !== requestId) return; // stale
        if (!response.ok) {
          setSlugCheck({ state: "error", slug });
          return;
        }
        setSlugCheck({ state: body.available ? "available" : "taken", slug });
      } catch {
        if (slugCheckRequestRef.current === requestId) {
          setSlugCheck({ state: "error", slug });
        }
      }
    }, 400);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposedValues.slug, isEditing, canPersist, talentId, publishedSlug]);

  // Post-refresh resync (same pattern as ComparisonView): after a
  // successful Submit/Publish the parent Server Component re-renders this
  // same instance with fresh props; re-seed local state when clean.
  const initialValuesKey = JSON.stringify(seed());
  useEffect(() => {
    if (!isDirty) {
      const refreshed = JSON.parse(initialValuesKey);
      setProposedValues(refreshed);
      setSavedValues(refreshed);
      setSaveStatus("idle");
      setSaveError(null);
      setSubmitStatus("idle");
      setSubmitError(null);
      setPublishStatus("idle");
      setPublishError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValuesKey]);

  function clearStaleStatuses() {
    if (saveStatus !== "idle" && saveStatus !== "saving") {
      setSaveStatus("idle");
      setSaveError(null);
    }
    if (submitStatus !== "idle" && submitStatus !== "submitting") {
      setSubmitStatus("idle");
      setSubmitError(null);
    }
    if (publishStatus !== "idle" && publishStatus !== "publishing") {
      setPublishStatus("idle");
      setPublishError(null);
    }
  }

  function handleFieldChange(key, value) {
    setProposedValues((previous) => ({ ...previous, [key]: value }));
    clearStaleStatuses();
  }

  function handleSlugChange(raw) {
    handleFieldChange("slug", liveNormalizeSlug(raw));
  }

  function handleSlugBlur() {
    setProposedValues((previous) => ({ ...previous, slug: normalizeSlug(previous.slug) }));
  }

  function handleGenerateFromName() {
    const generated = generateSlugFromName({ name: defaults.name, nameEn: defaults.nameEn });
    if (generated) {
      handleFieldChange("slug", generated);
    }
  }

  function handleResetToPublished() {
    handleFieldChange("slug", publishedSlug ?? "");
  }

  function handleCancel() {
    setProposedValues(savedValues);
    setSaveStatus("idle");
    setSaveError(null);
  }

  async function handleSaveDraft() {
    if (!canPersist || saving || !slugValidation.valid) return;

    setSaveStatus("saving");
    setSaveError(null);
    try {
      const response = await fetch(`/api/admin/talent/${talentId}/proposals/${versionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: proposedValues }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || `Save failed (${response.status}).`);
      }
      setSavedValues(proposedValues);
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("error");
      setSaveError(error?.message || he.editor.saveDraft.error);
    }
  }

  async function handleSubmit() {
    if (!canPersist || busy) return;

    setSubmitStatus("submitting");
    setSubmitError(null);
    try {
      const response = await fetch(`/api/admin/talent/${talentId}/proposals/${versionId}/submit`, {
        method: "POST",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || `Submit failed (${response.status}).`);
      }
      setSubmitStatus("submitted");
      router.refresh();
    } catch (error) {
      setSubmitStatus("error");
      setSubmitError(error?.message || he.editor.submit.error);
    }
  }

  async function handlePublishNow() {
    if (!canPersist || busy) return;

    setPublishStatus("publishing");
    setPublishError(null);
    try {
      const response = await fetch(`/api/admin/talent/${talentId}/proposals/${versionId}/publish`, {
        method: "POST",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        // The publish transaction's slug gates surface here (409 +
        // SLUG_CONFLICT/SLUG_INVALID) with a human-readable message.
        throw new Error(body.error || `Publish failed (${response.status}).`);
      }
      setPublishStatus("published");
      router.refresh();
    } catch (error) {
      setPublishStatus("error");
      setPublishError(error?.message || he.editor.publish.error);
    }
  }

  // ---------- derived display values ----------

  const displayValues = isEditing
    ? proposedValues
    : buildInitialValues({ groups, publishedSeo, draftSeo: null, publishedSlug, draftSlug: null });

  // Smart defaults (sprint requirement) — the exact same fallback chain
  // lib/public/seo.js applies on the live page, so the previews are honest.
  const effectiveTitle = displayValues.seoTitle?.trim() || defaults.name || null;
  const effectiveDescription = displayValues.seoDescription?.trim() || defaults.bio || null;
  const effectiveOgTitle =
    displayValues.seoOgTitle?.trim() || (defaults.name ? `${defaults.name} | Bar Oren` : effectiveTitle);
  const effectiveOgDescription = displayValues.seoOgDescription?.trim() || effectiveDescription;
  const effectiveOgImage = displayValues.seoOgImageUrl?.trim() || defaults.profileImage || null;
  const previewUrl = publicUrlFor(displayValues.slug || publishedSlug);

  const slugChanged = isEditing && proposedValues.slug !== (publishedSlug ?? "");

  const saveDraftDisabled = !canPersist || !isDirty || busy || !slugValidation.valid;
  const submitDisabled = !canPersist || !isDraft || isDirty || busy || !slugValidation.valid;
  const publishDisabled =
    !canPersist || isDirty || busy || !slugValidation.valid || slugCheck.state === "taken";

  const saveDraftDisabledReason = !canPersist
    ? he.editor.saveDraft.disabledNoVersion
    : !slugValidation.valid
      ? he.seo.slug.errors[slugValidation.errors[0]]
      : !isDirty
        ? he.editor.saveDraft.disabledNoChanges
        : undefined;
  const submitDisabledReason = isProposed
    ? he.editor.submit.disabledProposedLocked
    : !canPersist
      ? he.editor.submit.disabledNoVersion
      : isDirty
        ? he.editor.submit.unsavedHint
        : undefined;
  const publishDisabledReason = !canPersist
    ? he.editor.publish.disabledNoVersion
    : slugCheck.state === "taken"
      ? he.seo.slug.taken
      : isDirty
        ? he.editor.publish.unsavedHint
        : undefined;

  return (
    <div className={styles.tokens}>
      <p className={styles.intro}>{he.seo.intro}</p>

      <section
        className={isEditing ? styles.proposedSection : styles.publishedSection}
        aria-label={isEditing ? he.seo.proposedEyebrowTitle : he.seo.publishedEyebrowTitle}
      >
        <header className={styles.eyebrow}>
          <span className={styles.eyebrowIcon} aria-hidden="true">
            {isEditing ? he.seo.proposedEyebrowIcon : he.seo.publishedEyebrowIcon}
          </span>
          <span className={isEditing ? styles.eyebrowTitleProposed : styles.eyebrowTitle}>
            {isEditing ? he.seo.proposedEyebrowTitle : he.seo.publishedEyebrowTitle}
          </span>
        </header>
        <p className={isEditing ? styles.proposedSubtitle : styles.publishedSubtitle}>
          {isEditing ? he.seo.proposedSubtitle : he.seo.publishedSubtitle}
        </p>

        {/* ---------- Slug management (sprint Part 1) ---------- */}
        <div className={styles.slugSection}>
          <h3 className={isEditing ? styles.groupLabelProposed : styles.groupLabel}>
            {he.seo.slug.sectionTitle}
          </h3>
          <p className={styles.slugHelper}>{he.seo.slug.helper}</p>

          {isEditing ? (
            <>
              {/* Only the slug segment is editable; the rest of the URL is a
                  fixed, read-only prefix. dir=ltr keeps URL order sane in
                  the RTL admin. */}
              <div className={styles.slugInputRow} dir="ltr">
                <span className={styles.slugPrefix}>{`${PUBLIC_BASE_URL}/talent/`}</span>
                <input
                  type="text"
                  className={styles.slugInput}
                  value={proposedValues.slug ?? ""}
                  onChange={(event) => handleSlugChange(event.target.value)}
                  onBlur={handleSlugBlur}
                  aria-label={he.seo.slug.inputLabel}
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>

              <div className={styles.slugActions}>
                <SecondaryButton onClick={handleGenerateFromName}>
                  {he.seo.slug.generateFromName}
                </SecondaryButton>
                <SecondaryButton onClick={handleResetToPublished}>
                  {he.seo.slug.resetToPublished}
                </SecondaryButton>
              </div>

              {!slugValidation.valid ? (
                <ul className={styles.slugErrors} role="alert">
                  {slugValidation.errors.map((code) => (
                    <li key={code}>{he.seo.slug.errors[code] || code}</li>
                  ))}
                </ul>
              ) : null}

              {slugValidation.valid && slugCheck.state === "checking" ? (
                <p className={styles.slugStatus} role="status">
                  {he.seo.slug.checking}
                </p>
              ) : null}
              {slugValidation.valid && slugCheck.state === "available" ? (
                <p className={styles.slugStatusOk} role="status">
                  {he.seo.slug.available}
                </p>
              ) : null}
              {slugValidation.valid && slugCheck.state === "taken" ? (
                <p className={styles.slugStatusError} role="alert">
                  {he.seo.slug.taken}
                </p>
              ) : null}
              {slugValidation.valid && slugCheck.state === "error" ? (
                <p className={styles.slugStatus} role="status">
                  {he.seo.slug.checkFailed}
                </p>
              ) : null}

              <p className={styles.slugUrlPreview}>
                <span className={styles.slugUrlLabel}>{he.seo.slug.urlPreviewLabel}:</span>{" "}
                <span dir="ltr" className={styles.slugUrlValue}>
                  {publicUrlFor(proposedValues.slug)}
                </span>
              </p>
              {slugChanged ? <p className={styles.slugNotice}>{he.seo.slug.urlChangeNotice}</p> : null}
            </>
          ) : (
            <p className={styles.slugUrlPreview}>
              <span className={styles.slugUrlLabel}>{he.seo.slug.publishedLabel}:</span>{" "}
              <span dir="ltr" className={styles.slugUrlValue}>
                {publicUrlFor(publishedSlug)}
              </span>
            </p>
          )}
        </div>

        {/* ---------- SEO fields (sprint Part 2) ---------- */}
        <div className={styles.groupedFieldList}>
          {groups.map((group) => (
            <div key={group.key} className={styles.fieldGroup}>
              {group.label ? (
                <h3 className={isEditing ? styles.groupLabelProposed : styles.groupLabel}>{group.label}</h3>
              ) : null}
              <div className={styles.fieldList}>
                {group.fields.map((field) => (
                  <SeoFieldRow
                    key={field.key}
                    field={field}
                    value={displayValues[field.key]}
                    readOnly={!isEditing}
                    onChange={(value) => handleFieldChange(field.key, value)}
                    defaultHint={resolveDefaultHint(field.defaultKey, defaults, displayValues.slug || publishedSlug)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ---------- Live previews — update on every keystroke ---------- */}
        <div className={styles.previewWrapper}>
          <SearchResultPreview title={effectiveTitle} description={effectiveDescription} url={previewUrl} />
        </div>
        <div className={styles.previewWrapper}>
          <OpenGraphPreview
            imageUrl={effectiveOgImage}
            title={effectiveOgTitle}
            description={effectiveOgDescription}
            url={previewUrl}
          />
        </div>
      </section>

      {isEditing ? (
        <EditorActionBar
          onCancel={handleCancel}
          onSaveDraft={handleSaveDraft}
          showSaveDraft={canPersist}
          saveDraftDisabled={saveDraftDisabled}
          saveDraftDisabledReason={saveDraftDisabledReason}
          saveDraftLabel={isProposed ? he.editor.actions.updateProposal : he.editor.actions.saveDraft}
          saveDraftStatus={saveStatus}
          saveDraftStatusMessage={
            saveStatus === "error" ? saveError : saveStatus === "saved" && isProposed ? he.editor.saveDraft.savedProposal : undefined
          }
          onSubmit={handleSubmit}
          showSubmit={canPersist && !isOwner}
          submitDisabled={submitDisabled}
          submitDisabledReason={submitDisabledReason}
          submitStatus={submitStatus}
          submitStatusMessage={
            submitStatus === "error"
              ? submitError
              : canPersist && isDirty && submitStatus === "idle"
                ? he.editor.submit.unsavedHint
                : undefined
          }
          onPublish={handlePublishNow}
          showPublish={canPersist && isOwner}
          publishDisabled={publishDisabled}
          publishDisabledReason={publishDisabledReason}
          publishStatus={publishStatus}
          publishStatusMessage={
            publishStatus === "error"
              ? publishError
              : canPersist && isDirty && publishStatus === "idle"
                ? he.editor.publish.unsavedHint
                : undefined
          }
        />
      ) : null}
    </div>
  );
}
