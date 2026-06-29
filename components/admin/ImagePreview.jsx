"use client";

/*
 * ImagePreview — Profile Image Management sprint, given real drag-to-
 * reposition by the Single-Section Editing UX sprint.
 *
 * Reuse boundary note (architecture self-review follow-up): this is a
 * reusable *atom* — it renders one image and knows nothing about a grid,
 * a list, or any composite layout. A future Gallery Upload rebuild should
 * render one ImagePreview per grid cell directly, not go through the
 * single-image ImageEditorCard/ImageAssetEditor composites.
 *
 * Pure, entity-agnostic display of a single image inside a fixed-aspect
 * frame, honoring the same two scalar fields every image-bearing module in
 * this admin already stores (`position` — a CSS object-position string,
 * `scale` — a transform: scale() factor). Knows nothing about talent,
 * gallery, drafts, uploads, or which entity owns the image — it just
 * renders whatever it's given. Reused by ImageAssetEditor for both the
 * read-only "Current Published" frame and the editable "Proposed" frame,
 * and meant to be reused again by any future image-based module (gallery
 * replace, cover image, hero image, ...).
 *
 * Single-Section Editing UX sprint — Profile Image positioning rework:
 * the old 3×3 keyword-grid in ImagePositionControls ("this is NOT a
 * gallery, this is ONE profile image" per the brief) is gone. In its place,
 * this same frame becomes directly draggable whenever a caller passes
 * `editable` + `onPositionChange`: pointer-drag pans the image inside the
 * fixed frame and reports a continuous percentage `object-position` string
 * ("37.2% 61.8%") through the existing `position` column — no schema
 * change, since that column was always a free-form CSS object-position
 * string, never restricted to the 9 keyword pairs the old grid offered.
 * The zoom slider (ImagePositionControls) is unchanged and still the only
 * control for `scale`.
 *
 * Props:
 *   - src (string|null) — image URL, or null to show the placeholder
 *   - alt (string, optional)
 *   - position (string|null, optional) — CSS object-position, e.g.
 *     "center top" or "37.2% 61.8%"; falls back to "center" when omitted
 *   - scale (number|null, optional) — multiplied into transform: scale()
 *   - aspectRatio (string, optional, default "3 / 4")
 *   - placeholderText (string, optional) — shown instead of an <img> when
 *     `src` is null
 *   - className (string, optional) — appended to the frame's own class, so
 *     a caller can adjust size/margin without forking this component
 *   - children (node, optional) — rendered as an absolutely-positioned
 *     overlay on top of the frame (e.g. a drag-over hint or a status badge)
 *   - editable (boolean, optional, default false) — when true (and `src`
 *     and `onPositionChange` are both present), the frame becomes
 *     pointer-draggable.
 *   - onPositionChange (function(string): void, optional) — called with a
 *     new "<x>% <y>%" object-position string on every drag move. Omit to
 *     keep this a pure read-only display, same as before this sprint.
 *   - dragHint (string, optional) — short instructional text shown inside
 *     the frame while draggable (e.g. "גרור להזזת התמונה"); omitted
 *     entirely when not supplied.
 */

import { useRef, useState } from "react";
import styles from "./ImagePreview.module.css";

const KEYWORD_X = { left: 0, center: 50, right: 100 };
const KEYWORD_Y = { top: 0, center: 50, bottom: 100 };

function toPercent(token, keywordMap) {
  if (token == null) return 50;
  if (token.endsWith("%")) {
    const value = parseFloat(token);
    return Number.isFinite(value) ? value : 50;
  }
  return keywordMap[token] ?? 50;
}

// Accepts either a legacy keyword pair ("center top") or an already-
// percentage-based string ("37.2% 61.8%") and normalizes both to a
// { x, y } percent pair, so dragging always starts from the image's actual
// current framing instead of snapping back to center.
function parsePosition(position) {
  if (!position) return { x: 50, y: 50 };
  const [rawX, rawY] = position.trim().split(/\s+/);
  return {
    x: toPercent(rawX, KEYWORD_X),
    y: toPercent(rawY ?? "center", KEYWORD_Y),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function ImagePreview({
  src = null,
  alt = "",
  position = null,
  scale = null,
  aspectRatio = "3 / 4",
  placeholderText = "",
  className = "",
  children = null,
  editable = false,
  onPositionChange,
  dragHint = "",
}) {
  const frameRef = useRef(null);
  const dragStateRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const imageStyle = {
    objectPosition: position || "center",
    transform: scale ? `scale(${scale})` : undefined,
  };

  const canDrag = editable && Boolean(src) && typeof onPositionChange === "function";

  function handlePointerDown(event) {
    if (!canDrag) return;
    const frame = frameRef.current;
    if (!frame) return;

    const { x, y } = parsePosition(position);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPositionX: x,
      startPositionY: y,
      frameWidth: frame.clientWidth || 1,
      frameHeight: frame.clientHeight || 1,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setIsDragging(true);
  }

  function handlePointerMove(event) {
    const dragState = dragStateRef.current;
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    const dx = event.clientX - dragState.startClientX;
    const dy = event.clientY - dragState.startClientY;

    // The photo itself is what's being dragged (not a viewport scrolling
    // over it), so the object-position percentage moves opposite the
    // pointer: dragging right reveals more of the image's left edge, which
    // is what makes the photo feel "stuck to the cursor."
    const nextX = clamp(dragState.startPositionX - (dx / dragState.frameWidth) * 100, 0, 100);
    const nextY = clamp(dragState.startPositionY - (dy / dragState.frameHeight) * 100, 0, 100);

    onPositionChange(`${nextX.toFixed(1)}% ${nextY.toFixed(1)}%`);
  }

  function handlePointerUp(event) {
    const dragState = dragStateRef.current;
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    dragStateRef.current = null;
    setIsDragging(false);
  }

  return (
    <div
      ref={frameRef}
      className={[styles.frame, className, canDrag ? styles.frameEditable : "", isDragging ? styles.frameDragging : ""]
        .filter(Boolean)
        .join(" ")}
      style={{ aspectRatio }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {src ? (
        <img src={src} alt={alt} className={styles.image} style={imageStyle} draggable={false} />
      ) : (
        <div className={styles.placeholder} aria-hidden="true">
          {placeholderText}
        </div>
      )}
      {canDrag && dragHint ? (
        <p className={styles.dragHint} aria-hidden="true">
          {dragHint}
        </p>
      ) : null}
      {children}
    </div>
  );
}
