/*
 * Adapter contract — ADMIN_PANEL_PLAN.md Section 13.10 (the shape every
 * adapter must implement) + Section 13.4 (the capabilities object shape).
 *
 * This is documentation plus a runtime assertion helper, not a base class —
 * per Section 13.9 ("Generic before specific"), engine services depend on
 * a duck-typed shape, not an inheritance hierarchy, so a new content type
 * never needs to import engine internals to write an adapter; it only has
 * to match this shape (Section 13.12: "one adapter file ... and nothing
 * else").
 *
 * REQUIRED_ADAPTER_METHODS mirrors Section 13.10's list (getParent,
 * getVersion, listVersionsForParent, insertProposedVersion, validate,
 * mapToPublicShape), plus one addition flagged below.
 *
 * Two additions beyond the literal 13.10 list, both required to implement
 * behavior Section 13.3 explicitly describes, and called out here rather
 * than asserted silently, since the architecture is locked and any gap-fill
 * should be visible for review:
 *
 *   - `entityType` (static string, one of the `EntityType` enum values):
 *     every `Event` row (Section 13.3.1) and every conflict check needs an
 *     entityType to tag the action with. Section 13.10's prose doesn't
 *     enumerate it, but every adapter necessarily has exactly one, so it's
 *     required here rather than re-derived ad hoc by each engine service.
 *   - `submitVersion(versionId)`: Section 13.3 introduces the DRAFT status
 *     and describes `proposalService.submit(proposalId)` as the operation
 *     that "flips DRAFT -> PROPOSED." The 13.10 contract list predates that
 *     paragraph and doesn't name the method that performs the flip, so
 *     this fills that literal gap — it does not change what `validate`,
 *     `insertProposedVersion`, etc. already do.
 */

export const REQUIRED_ADAPTER_METHODS = Object.freeze([
  'getParent',
  'getVersion',
  'listVersionsForParent',
  'insertProposedVersion',
  'submitVersion',
  'validate',
  'mapToPublicShape',
]);

/** Mirrors Section 13.4's capabilities object exactly. */
export const REQUIRED_CAPABILITY_KEYS = Object.freeze([
  'supportsPreview',
  'supportsScheduling',
  'supportsSEO',
  'supportsGallery',
  'supportsSoftDelete',
  'supportsPublishing',
  'supportsArchive',
]);

/**
 * Throws a descriptive error if `adapter` does not satisfy the contract
 * above. Generic and entity-agnostic — this function never inspects what
 * kind of adapter it was given, only the shape (Section 13.9).
 *
 * @param {object} adapter
 * @returns {true}
 */
export function assertImplementsAdapterContract(adapter) {
  if (!adapter || typeof adapter !== 'object') {
    throw new Error('[adapterContract] adapter must be an object.');
  }

  if (!adapter.entityType) {
    throw new Error('[adapterContract] adapter is missing a static "entityType".');
  }

  const missingMethods = REQUIRED_ADAPTER_METHODS.filter(
    (methodName) => typeof adapter[methodName] !== 'function'
  );
  if (missingMethods.length > 0) {
    throw new Error(
      `[adapterContract] adapter "${adapter.entityType}" is missing required ` +
        `method(s): ${missingMethods.join(', ')}.`
    );
  }

  if (!adapter.capabilities || typeof adapter.capabilities !== 'object') {
    throw new Error(
      `[adapterContract] adapter "${adapter.entityType}" is missing a capabilities object.`
    );
  }
  const missingCapabilityKeys = REQUIRED_CAPABILITY_KEYS.filter(
    (key) => typeof adapter.capabilities[key] !== 'boolean'
  );
  if (missingCapabilityKeys.length > 0) {
    throw new Error(
      `[adapterContract] adapter "${adapter.entityType}" capabilities is missing ` +
        `boolean key(s): ${missingCapabilityKeys.join(', ')}.`
    );
  }

  return true;
}
