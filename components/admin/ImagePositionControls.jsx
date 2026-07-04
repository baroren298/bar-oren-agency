"use client";

/*
 * ImagePositionControls — Profile Image Management sprint, simplified by
 * the Single-Section Editing UX sprint.
 *
 * Reuse boundary note (architecture self-review follow-up): this is a
 * reusable *atom* — it edits the zoom of one image and has no notion of a
 * grid or multiple images. A future Gallery Upload rebuild should attach
 * one ImagePositionControls per image directly, not assume the
 * single-image ImageEditorCard/ImageAssetEditor composites apply.
 *
 * Was: zoom slider + a 3×3 keyword-position grid (9 fixed "<x> <y>"
 * CSS object-position pairs), the grid doubling as a crude "crop"
 * affordance.
 *
 * Is: zoom slider only. Per the brief — "this is NOT a gallery, this is
 * ONE profile image; replace the grid with real image positioning" — the
 * 3×3 grid is gone. Positioning is now continuous drag directly on the live
 * preview (see ImagePreview's `editable`/`onPositionChange` props), which
 * writes the exact same `position` column this component used to write via
 * its 9 preset buttons, just with arbitrary percentages instead of 9 fixed
 * keyword pairs. This component's only remaining job is the one thing
 * dragging the image can't do: zoom.
 *
 * Entity-agnostic: takes a plain `scale` value and a change callback,
 * nothing about talent/gallery/cover/hero. Reusable by any future image
 * module through ImageEditorCard.
 *
 * Props:
 *   - scale (number|null)
 *   - onScaleChange (function(number): void)
 *   - disabled (boolean, optional)
 *   - labels ({ zoomLabel })
 */

import styles from "./ImagePositionControls.module.css";

const MIN_SCALE = 1;
const MAX_SCALE = 2;
const SCALE_STEP = 0.05;

export default function ImagePositionControls({ scale = null, onScaleChange, disabled = false, labels = {} }) {
  const currentScale = scale ?? MIN_SCALE;

  return (
    <div className={styles.controls}>
      <div className={styles.controlGroup}>
        <span className={styles.controlLabel}>{labels.zoomLabel}</span>
        <input
          type="range"
          className={styles.slider}
          min={MIN_SCALE}
          max={MAX_SCALE}
          step={SCALE_STEP}
          value={currentScale}
          disabled={disabled}
          onChange={(event) => onScaleChange(Number(event.target.value))}
          aria-label={labels.zoomLabel}
        />
        <span className={styles.sliderValue}>{Math.round(currentScale * 100)}%</span>
      </div>
    </div>
  );
}
