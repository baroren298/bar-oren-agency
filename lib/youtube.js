/*
 * lib/youtube.js
 *
 * Pure, dependency-free helpers for working with YouTube URLs. No I/O, no
 * throwing — malformed or non-YouTube input simply yields null.
 *
 * Sprint 1: Fix broken YouTube button in the Podcast admin tab.
 *
 * Background: podcastVideoEmbedUrl is stored canonically as a YouTube
 * *embed* URL (https://www.youtube.com/embed/<id>), because that's what the
 * public site's <iframe> needs and nothing about that storage format is
 * changing. The admin "צפייה ביוטיוב" button, however, opened that same
 * embed URL as a top-level navigation — YouTube's embed player refuses to
 * load outside an <iframe> for many videos (Error 153). This module lets
 * the admin button derive a normal /watch?v=<id> URL on the fly from the
 * stored embed URL, without touching the stored value or the public iframe
 * flow at all.
 */

// Hosts we treat as YouTube. Exact matches only — this deliberately does
// NOT do suffix matching (e.g. "endswith youtube.com"), so lookalike hosts
// like "youtube.com.evil.example" or "notyoutube.com" are rejected.
const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

// Real YouTube video ids are 11 chars from this charset, but we accept a
// slightly wider range so we don't reject valid-but-unusual ids.
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

function safeParseUrl(input) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed === "") return null;
  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

function isValidId(id) {
  return typeof id === "string" && VIDEO_ID_RE.test(id);
}

/**
 * Extract a YouTube video id from any supported URL shape. Returns null for
 * malformed input, unsupported hosts, or hosts that merely look similar to
 * YouTube. Never throws.
 *
 * Supported shapes:
 *   https://www.youtube.com/watch?v=<id>   (+ extra query params)
 *   https://youtu.be/<id>                  (+ extra query params)
 *   https://www.youtube.com/embed/<id>
 *   https://www.youtube.com/shorts/<id>
 *   https://www.youtube-nocookie.com/embed/<id>
 *   optional www./m. subdomains where applicable
 */
export function extractYouTubeVideoId(url) {
  const parsed = safeParseUrl(url);
  if (!parsed) return null;
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return null;

  const segments = parsed.pathname.split("/").filter(Boolean);

  if (host === "youtu.be" || host === "www.youtu.be") {
    return isValidId(segments[0]) ? segments[0] : null;
  }

  if (segments[0] === "watch") {
    const id = parsed.searchParams.get("v");
    return isValidId(id) ? id : null;
  }

  if (segments[0] === "embed" || segments[0] === "shorts") {
    return isValidId(segments[1]) ? segments[1] : null;
  }

  return null;
}

/** Resolve either a bare video id or any supported URL to a video id. */
function resolveVideoId(urlOrId) {
  if (typeof urlOrId !== "string") return null;
  const trimmed = urlOrId.trim();
  if (trimmed === "") return null;
  if (isValidId(trimmed)) return trimmed;
  return extractYouTubeVideoId(trimmed);
}

/**
 * Build a normal, top-level-navigable YouTube watch URL from a video id or
 * any supported YouTube URL. Returns null if no valid id can be resolved.
 */
export function toYouTubeWatchUrl(urlOrId) {
  const id = resolveVideoId(urlOrId);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

/**
 * Build a canonical embed URL from a video id or any supported YouTube URL.
 * Returns null if no valid id can be resolved.
 */
export function toYouTubeEmbedUrl(urlOrId) {
  const id = resolveVideoId(urlOrId);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}
