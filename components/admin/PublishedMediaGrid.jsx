/*
 * PublishedMediaGrid — Gallery Editor Foundation sprint.
 *
 * The read-only "this is what is currently live on the website" half of
 * any image-gallery editor. Deliberately the simplest possible piece:
 * a responsive grid of images, no actions, no edit affordances at all —
 * it must never be mistaken for something editable, same philosophy as
 * ComparisonView's published column (components/admin/ComparisonView.jsx).
 *
 * Entity-agnostic on purpose: it knows nothing about "talent" or
 * "gallery" specifically, only a flat list of images, so it can be reused
 * unchanged for any other published media collection later (homepage
 * media, About images, etc.) — MediaGalleryEditor.jsx is the first and
 * only caller this sprint.
 *
 * Props:
 *   - images ({ src, alt }[]) — already-normalized image objects
 *   - emptyTitle / emptyDescription (string, optional) — passed straight
 *     to <EmptyState> when `images` is empty
 */

import Image from "next/image";
import styles from "./PublishedMediaGrid.module.css";
import EmptyState from "./EmptyState";

export default function PublishedMediaGrid({ images = [], emptyTitle, emptyDescription }) {
  if (!images.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className={`${styles.tokens} ${styles.grid}`}>
      {images.map((image, index) => (
        <div key={image.src || index} className={styles.item}>
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={styles.image}
          />
        </div>
      ))}
    </div>
  );
}
