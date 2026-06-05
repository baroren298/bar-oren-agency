'use client';

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TalentImage from '@/components/ui/TalentImage';
import { siteConfig } from '@/data/site';
import styles from './TalentModal.module.css';

const SOCIAL_CHANNELS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok',    label: 'TikTok'    },
  { key: 'youtube',   label: 'YouTube'   },
];

function getCategoryLabels(categories) {
  return siteConfig.categories
    .filter((c) => categories.includes(c.key) && c.key !== 'all')
    .map((c) => c.label);
}

export default function TalentModal({ talent, onClose }) {
  /* ESC key */
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  /* Body scroll lock */
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  /* Close on backdrop click only */
  const handleBackdropClick = useCallback(
    (e) => { if (e.target === e.currentTarget) onClose(); },
    [onClose]
  );

  const socials        = SOCIAL_CHANNELS.filter((ch) => Boolean(talent[ch.key]));
  const categoryLabels = getCategoryLabels(talent.category);

  return (
    <motion.div
      className={styles.backdrop}
      onClick={handleBackdropClick}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      role="dialog"
      aria-modal="true"
      aria-label={`${talent.name} — פרופיל כישרון`}
    >
      <motion.div
        className={styles.panel}
        initial={{ opacity: 0, y: 36 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {/* ── Close button ───────────────────────────────────────────────── */}
        <button
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="סגור"
          type="button"
        >
          ✕
        </button>

        {/* ── Image column ───────────────────────────────────────────────── */}
        <div className={styles.imageCol}>
          <div className={styles.imageWrapper}>
            <TalentImage
              src={talent.profileImage || null}
              alt={talent.name}
              fallbackIndex={talent.sortOrder}
              priority
              sizes="(max-width: 768px) 100vw, 360px"
              objectPosition="center top"
            />
          </div>
        </div>

        {/* ── Content column ─────────────────────────────────────────────── */}
        <div className={styles.contentCol}>

          {/* Category */}
          {categoryLabels.length > 0 && (
            <p className={styles.categoryLabel} aria-label="קטגוריה">
              {categoryLabels.join(' · ')}
            </p>
          )}

          {/* Name */}
          <h2 className={styles.name}>{talent.name}</h2>

          {/* Bio */}
          {talent.bioHe && (
            <p className={styles.bio}>{talent.bioHe}</p>
          )}

          {/* Tags */}
          {talent.tags?.length > 0 && (
            <div className={styles.tags} aria-label="תחומי פעילות">
              {talent.tags.map((tag) => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </div>
          )}

          {/* Social links */}
          {socials.length > 0 && (
            <div className={styles.socials} aria-label="רשתות חברתיות">
              {socials.map((ch) => (
                <a
                  key={ch.key}
                  href={talent[ch.key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  aria-label={`${ch.label} של ${talent.name}`}
                >
                  {ch.label}
                  <span className={styles.socialArrow} aria-hidden="true">←</span>
                </a>
              ))}
            </div>
          )}

          {/* WhatsApp CTA */}
          <a
            href={siteConfig.contact.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.ctaBtn}
            aria-label={`צרו קשר עם בר אורן לגבי ${talent.name}`}
          >
            צרו קשר עם בר אורן
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
}
