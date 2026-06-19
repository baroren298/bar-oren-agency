'use client';

import { useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TalentImage from '@/components/ui/TalentImage';
import { siteConfig } from '@/data/site';
import styles from './TalentModal.module.css';

const SOCIAL_CHANNELS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok',    label: 'TikTok'    },
  { key: 'youtube',   label: 'YouTube'   },
];

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getCategoryLabels(categories) {
  return siteConfig.categories
    .filter((c) => categories.includes(c.key) && c.key !== 'all')
    .map((c) => c.label);
}

export default function TalentModal({ talent, onClose }) {
  const panelRef      = useRef(null);
  const closeBtnRef   = useRef(null);
  const scrollBodyRef = useRef(null);
  const titleId       = `modal-title-${talent.id}`;

  /* ESC key */
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  /* Body scroll lock — robust iOS Safari fix.
   *
   * Three layers are required because iOS Safari is particularly stubborn:
   *
   * 1. position:fixed + negative top on <body>  — prevents the body from
   *    scrolling and keeps the page visually in place (no jump to top).
   *
   * 2. overflow:hidden on <html>  — iOS can independently scroll the root
   *    element; locking body alone is not enough on some iOS versions.
   *
   * 3. Non-passive touchmove block on document  — inertia scroll that began
   *    before the modal opened can still propagate even with position:fixed.
   *    We cancel it everywhere except inside our own scrollBody element.
   */
  useEffect(() => {
    const scrollY = window.scrollY;
    const html    = document.documentElement;
    const body    = document.body;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top      = `-${scrollY}px`;
    body.style.width    = '100%';

    const preventTouchMove = (e) => {
      // Allow scroll only inside the modal's own scrollable area
      if (scrollBodyRef.current?.contains(e.target)) return;
      if (e.cancelable) e.preventDefault();
    };
    document.addEventListener('touchmove', preventTouchMove, { passive: false });

    return () => {
      html.style.overflow = '';
      body.style.overflow = '';
      body.style.position = '';
      body.style.top      = '';
      body.style.width    = '';
      document.removeEventListener('touchmove', preventTouchMove);
      window.scrollTo(0, scrollY);
    };
  }, []);

  /* Auto-focus close button on mount; restore focus to trigger on unmount */
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeBtnRef.current?.focus();
    return () => { previouslyFocused?.focus(); };
  }, []);

  /* Focus trap — keep Tab/Shift+Tab inside the panel */
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const trap = (e) => {
      if (e.key !== 'Tab') return;
      const nodes = Array.from(panel.querySelectorAll(FOCUSABLE));
      if (!nodes.length) return;
      const first = nodes[0];
      const last  = nodes[nodes.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    };

    panel.addEventListener('keydown', trap);
    return () => panel.removeEventListener('keydown', trap);
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
      aria-labelledby={titleId}
    >
      <motion.div
        ref={panelRef}
        className={styles.panel}
        initial={{ opacity: 0, y: 36 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {/* ── Drag handle — visible on mobile only, provides bottom-sheet affordance ── */}
        <div className={styles.handle} aria-hidden="true" />

        {/* ── Close button ─────────────────────────────────────────────────────────── */}
        <button
          ref={closeBtnRef}
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="סגור"
          type="button"
        >
          ✕
        </button>

        {/* ── Image column ─────────────────────────────────────────────────────────── */}
        <div className={styles.imageCol}>
          <div className={styles.imageWrapper}>
            <TalentImage
              src={talent.profileImage || null}
              alt={talent.name}
              fallbackIndex={talent.sortOrder}
              priority
              sizes="(max-width: 768px) 100vw, 360px"
              objectPosition={talent.imagePosition || 'center top'}
            />
          </div>
        </div>

        {/* ── Content column ───────────────────────────────────────────────────────── */}
        <div className={styles.contentCol}>

          {/*
            scrollBody — on desktop this is display:contents (children become direct
            flex children of contentCol, zero layout change). On mobile it becomes the
            independent scrollable area so the CTA bar can stay pinned at the bottom.
          */}
          <div ref={scrollBodyRef} className={styles.scrollBody}>

            {/* Category */}
            {categoryLabels.length > 0 && (
              <p className={styles.categoryLabel} aria-label="קטגוריה">
                {categoryLabels.join(' · ')}
              </p>
            )}

            {/* Name — id referenced by aria-labelledby on the dialog */}
            <h2 id={titleId} className={styles.name}>{talent.name}</h2>

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
            {(socials.length > 0 || talent.extraSocials?.length > 0) && (
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
                {talent.extraSocials?.map((s, i) => (
                  <div key={`extra-${i}`} className={styles.socialLinkItem}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.socialLink}
                      aria-label={`${s.label} של ${talent.name}`}
                    >
                      {s.label}
                      <span className={styles.socialArrow} aria-hidden="true">←</span>
                    </a>
                    {s.displayLabel && (
                      <span className={styles.socialDisplayLabel}>{s.displayLabel}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

          </div>{/* /scrollBody */}

          {/*
            ctaBar — on desktop this is display:contents so the ctaBtn flows inside
            contentCol as before. On mobile it becomes the pinned footer bar.
          */}
          <div className={styles.ctaBar}>
            <a
              href={siteConfig.contact.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.ctaBtn}
              aria-label={`צרו קשר עם בר אורן לגבי ${talent.name}`}
            >
              לבירור פרטים נוספים
            </a>
          </div>

        </div>{/* /contentCol */}
      </motion.div>
    </motion.div>
  );
}
