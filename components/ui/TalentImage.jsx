import Image from 'next/image';
import styles from './TalentImage.module.css';

/*
 * Warm studio gradients — cycle by talent sortOrder when no photo is provided.
 * Exported so callers can reference the same palette if needed.
 */
export const TALENT_GRADIENTS = [
  'linear-gradient(168deg, #c8b498 0%, #8a6848 38%, #2c1608 100%)',
  'linear-gradient(155deg, #b8a890 0%, #785848 38%, #221008 100%)',
  'linear-gradient(162deg, #d0b898 0%, #9a7058 34%, #321808 100%)',
  'linear-gradient(150deg, #b0a088 0%, #785848 34%, #280e04 100%)',
  'linear-gradient(170deg, #c0a880 0%, #806040 36%, #2c1208 100%)',
  'linear-gradient(158deg, #d8c4a4 0%, #a08060 32%, #3a1c0a 100%)',
];

/*
 * TalentImage
 *
 * Renders an optimised Next.js Image when `src` is provided,
 * or a warm gradient placeholder when `src` is null/undefined.
 *
 * The parent element MUST have:
 *   position: relative;
 *   width + height  OR  aspect-ratio
 *
 * Props:
 *   src            — image path (string | null)
 *   alt            — alt text; defaults to empty (decorative) when null
 *   fallbackIndex  — which gradient to use; pass talent.sortOrder
 *   priority       — true for above-the-fold images (hero, first card)
 *   sizes          — next/image sizes hint
 *   objectPosition — CSS object-position (default 'center top')
 *   className      — extra class applied to the img or gradient element;
 *                    allows callers to attach hover transitions via their
 *                    own CSS module
 */
export default function TalentImage({
  src,
  alt = '',
  fallbackIndex = 0,
  priority = false,
  sizes = '(max-width: 479px) 100vw, (max-width: 1023px) 50vw, 33vw',
  objectPosition = 'center top',
  className = '',
}) {
  const gradient = TALENT_GRADIENTS[Math.abs(fallbackIndex) % TALENT_GRADIENTS.length];

  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className={`${styles.image} ${className}`}
        style={{ objectPosition }}
      />
    );
  }

  return (
    <div
      className={`${styles.gradient} ${className}`}
      style={{ background: gradient }}
      aria-hidden="true"
    />
  );
}
