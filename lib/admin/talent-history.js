/*
 * Sprint 2: Real Event-Based History Timeline — pure projection helpers
 * that turn stored Event rows (lib/admin/repository/eventRepository.js,
 * via eventRepository.listForEntity(ENTITY_TYPE.TALENT, id)) into the
 * `{ id, action, date, user, summary, tone }` items <Timeline>
 * (components/admin/Timeline.jsx) already renders.
 *
 * Why a separate module from lib/admin/talent-workspace.js: that file's
 * buildVersionHistoryTimelineItems projects *TalentVersion rows* (one item
 * per version, showing only each row's current status — which is exactly
 * the "DRAFT → PROPOSED → PUBLISHED collapses into one Published item"
 * problem this sprint fixes). This module projects the append-only Event
 * log instead, so every lifecycle step that was actually persisted gets
 * its own timeline item. The version-row projection is kept, unchanged, as
 * the fallback for older/imported talents that predate event emission —
 * see buildTalentHistoryTimelineItems below.
 *
 * Everything here is pure (no I/O, no Prisma): the page does the reads
 * (events + batched user lookup) and hands plain data in, same
 * "presentation helpers only derive display values" guardrail
 * talent-workspace.js documents in its own header.
 *
 * HARD RULES (sprint brief):
 *   - Never synthesize or infer an event that was not stored.
 *   - Unknown event types are skipped safely (rendered as nothing), never
 *     guessed at.
 *   - ProposalUpdated (Save Draft) and AssetUploaded stay persisted and
 *     keep being emitted — they are only *hidden from this default
 *     timeline* as noise policy. No data is deleted or suppressed at the
 *     write path.
 *   - Actor attribution comes only from the stored actorId; a null
 *     actorId, or an actorId whose User row no longer resolves, displays
 *     as "—" — never a guessed name.
 */

import { EVENT_TYPE } from './engine/eventTypes';
import { WORKFLOW_STATUS, STATUS_TONE } from './mock-workflow';
import { he } from './i18n/he';
import { buildVersionHistoryTimelineItems } from './talent-workspace';

/*
 * Timeline noise policy (sprint requirement #4): these event types remain
 * persisted and emitted exactly as before, but are hidden from the default
 * timeline. ProposalUpdated fires on every Save Draft — showing each one
 * would bury the lifecycle steps that matter. AssetUploaded is a
 * storage-level fact (and is in practice emitted with
 * entityType=IMAGE_ASSET, so it wouldn't appear in a TALENT-scoped read
 * anyway — listed here so the policy is explicit and future-proof).
 * There is deliberately no "show detailed activity" toggle this sprint.
 */
const HIDDEN_EVENT_TYPES = new Set([
  EVENT_TYPE.PROPOSAL_UPDATED,
  EVENT_TYPE.ASSET_UPLOADED,
]);

/*
 * Stored event type → { label, tone }. Labels live in he.history.eventLabel;
 * tones reuse the exact STATUS_TONE vocabulary every StatusBadge on the
 * talent pages already uses (draft=neutral, waiting=warning,
 * changes_requested=danger, approved=info, published=success) — no new tone
 * is invented. An event type with no entry here (unknown/future) yields no
 * timeline item at all.
 */
const EVENT_PRESENTATION = Object.freeze({
  [EVENT_TYPE.PROPOSAL_CREATED]: {
    label: he.history.eventLabel.proposal_created,
    tone: STATUS_TONE[WORKFLOW_STATUS.DRAFT],
  },
  [EVENT_TYPE.PROPOSAL_SUBMITTED]: {
    label: he.history.eventLabel.submitted,
    tone: STATUS_TONE[WORKFLOW_STATUS.WAITING_FOR_APPROVAL],
  },
  [EVENT_TYPE.PROPOSAL_APPROVED]: {
    label: he.history.eventLabel.approved,
    tone: STATUS_TONE[WORKFLOW_STATUS.APPROVED],
  },
  [EVENT_TYPE.PROPOSAL_REJECTED]: {
    label: he.history.eventLabel.rejected,
    tone: STATUS_TONE[WORKFLOW_STATUS.CHANGES_REQUESTED],
  },
  [EVENT_TYPE.PROPOSAL_DISCARDED]: {
    label: he.history.eventLabel.discarded,
    tone: STATUS_TONE[WORKFLOW_STATUS.DRAFT],
  },
  [EVENT_TYPE.VERSION_PUBLISHED]: {
    label: he.history.eventLabel.published,
    tone: STATUS_TONE[WORKFLOW_STATUS.PUBLISHED],
  },
});

const KNOWN_DOMAINS = new Set(['details', 'gallery', 'socials', 'podcast']);

/**
 * Which workspace domain an event touched, derived ONLY from keys the
 * emitting service already stored on the payload — never inferred from
 * field contents:
 *
 *   - `payload.domain` (if some emitter ever stamps one explicitly and it
 *     is a known value — including 'podcast', which has no dedicated
 *     payload key of its own today)
 *   - galleryImageId / galleryImageIds  → gallery   (galleryService)
 *   - socialId / socialIds              → socials   (socialsService)
 *   - versionId                         → details   (proposalService /
 *     approvalService / publishService — a TalentVersion lifecycle event)
 *
 * Podcast edits ride on the same TalentVersion as the Details tab, so a
 * versionId payload cannot honestly be split into details-vs-podcast from
 * stored data — per the sprint's "never infer" rule they render as
 * 'details' unless a stored `payload.domain` says otherwise.
 *
 * @param {object|null|undefined} payload
 * @returns {'details'|'gallery'|'socials'|'podcast'|null}
 */
export function resolveEventDomain(payload) {
  if (!payload || typeof payload !== 'object') return null;

  if (typeof payload.domain === 'string' && KNOWN_DOMAINS.has(payload.domain)) {
    return payload.domain;
  }
  if (payload.galleryImageId || (Array.isArray(payload.galleryImageIds) && payload.galleryImageIds.length > 0)) {
    return 'gallery';
  }
  if (payload.socialId || (Array.isArray(payload.socialIds) && payload.socialIds.length > 0)) {
    return 'socials';
  }
  if (payload.versionId) return 'details';
  return null;
}

/**
 * Distinct non-null actorId values across a list of Event rows — the input
 * for one batched userRepository.getSafeByIds() call (no N+1).
 *
 * @param {object[]} events
 * @returns {string[]}
 */
export function collectEventActorIds(events) {
  if (!Array.isArray(events)) return [];
  return [...new Set(events.map((event) => event?.actorId).filter(Boolean))];
}

/**
 * Turn the rows getSafeByIds() returns into a Map of
 * actorId → display string (displayName, falling back to email). A user
 * missing from this map — deleted, deactivated-and-purged, or a null
 * actorId in the first place — renders as "—" downstream.
 *
 * @param {Array<{ id: string, displayName?: string|null, email?: string|null }>} users
 * @returns {Map<string, string>}
 */
export function buildActorDisplayMap(users) {
  const map = new Map();
  if (!Array.isArray(users)) return map;
  for (const user of users) {
    if (!user?.id) continue;
    const display = user.displayName || user.email;
    if (display) map.set(user.id, display);
  }
  return map;
}

function resolveActorDisplay(actorId, actorsById) {
  if (!actorId) return he.history.unknownActor;
  const display = actorsById instanceof Map ? actorsById.get(actorId) : actorsById?.[actorId];
  return display || he.history.unknownActor;
}

/**
 * Project stored Event rows into <Timeline> items, newest first.
 *
 * Per-event mapping:
 *   - action/tone: EVENT_PRESENTATION above (skipped when the type is
 *     unknown or in HIDDEN_EVENT_TYPES).
 *   - date: the row's own createdAt.
 *   - user: resolved actor display, "—" when unresolvable.
 *   - summary: a stored rejectionNote when the payload carries one
 *     (ProposalRejected), otherwise the domain label the payload already
 *     identifies (details/gallery/socials/podcast), otherwise "—".
 *
 * Ordering is explicit: sorted newest-first by createdAt here (matching
 * both eventRepository.listForEntity's own `createdAt desc` and the
 * he.history.intro copy "מהחדשה לישנה"), so the timeline stays correct even
 * if a caller ever passes rows from a differently-ordered source.
 *
 * @param {object[]} events - Event rows
 * @param {Map<string,string>|object} [actorsById] - from buildActorDisplayMap
 * @returns {{ id: string, action: string, date: *, user: string, summary: string, tone: string }[]}
 */
export function buildEventTimelineItems(events, actorsById = new Map()) {
  if (!Array.isArray(events)) return [];

  const items = [];
  for (const event of events) {
    if (!event || typeof event.type !== 'string') continue;
    if (HIDDEN_EVENT_TYPES.has(event.type)) continue;

    const presentation = EVENT_PRESENTATION[event.type];
    if (!presentation) continue; // unknown/future event type — skip safely

    const payload = event.payload && typeof event.payload === 'object' ? event.payload : null;
    const domain = resolveEventDomain(payload);
    const rejectionNote =
      typeof payload?.rejectionNote === 'string' && payload.rejectionNote.trim()
        ? payload.rejectionNote
        : null;

    const summary =
      rejectionNote || (domain ? he.history.domainLabel[domain] : null) || he.history.unknownActor;

    items.push({
      id: event.id,
      action: presentation.label,
      date: event.createdAt,
      user: resolveActorDisplay(event.actorId, actorsById),
      summary,
      tone: presentation.tone,
    });
  }

  return items.sort((a, b) => {
    const timeA = a.date ? new Date(a.date).getTime() : 0;
    const timeB = b.date ? new Date(b.date).getTime() : 0;
    return timeB - timeA;
  });
}

/**
 * The History tab's one entry point (sprint requirement #5 — fallback
 * behavior): project real Event rows when any exist and any of them are
 * timeline-visible; otherwise fall back to the previous version-row
 * projection (buildVersionHistoryTimelineItems, unchanged in
 * talent-workspace.js), so an older/imported talent whose lifecycle
 * predates event emission still shows its version history instead of an
 * empty tab.
 *
 * The fallback triggers on "no visible event items" rather than strictly
 * "no Event rows": a talent whose only stored events are hidden-by-policy
 * ProposalUpdated rows has real version history worth showing, and the
 * brief's own rule is "do not show an empty tab when historical version
 * data exists." When events exist, the two projections are never mixed —
 * the timeline is either purely event-based or purely the legacy
 * version-row view.
 *
 * @param {object[]} events - Event rows (may be empty)
 * @param {Map<string,string>|object} actorsById
 * @param {object[]} versions - newest-first TalentVersion rows (fallback)
 * @returns {{ id: string, action: string, date: *, user: string, summary: string, tone: string }[]}
 */
export function buildTalentHistoryTimelineItems(events, actorsById, versions) {
  const eventItems = buildEventTimelineItems(events, actorsById);
  if (eventItems.length > 0) return eventItems;
  return buildVersionHistoryTimelineItems(versions);
}
