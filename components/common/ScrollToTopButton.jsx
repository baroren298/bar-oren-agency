'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import styles from './ScrollToTopButton.module.css';

/* Fallback when no hero section can be measured (shouldn't normally happen,
   since every page renders a hero/page-header as the first child of
   #main-content) — keep this in the 350–450px range the design calls for. */
const FALLBACK_THRESHOLD_PX = 400;

/* Small grace past the hero's edge so the button appears just *after* the
   user clears it, not the instant its bottom touches the viewport top. */
const REVEAL_BUFFER_PX = 80;

/* Minimal arrow-up mark, stroke=currentColor — matches the WhatsApp icon's
   restrained, single-color line style. */
function ArrowUpIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  const thresholdRef = useRef(FALLBACK_THRESHOLD_PX);

  useEffect(() => {
    /* Every page on the site renders its hero / page-header as the first
       child of #main-content (HeroSection, AboutHero, ProfileHero, ...).
       Measuring its absolute bottom offset lets the button appear right
       after the hero — and adapt automatically per page and viewport —
       instead of relying on one fixed pixel value. */
    const computeThreshold = () => {
      const hero = document.getElementById('main-content')?.firstElementChild;

      if (hero) {
        const rect = hero.getBoundingClientRect();
        const heroBottomAbsolute = window.scrollY + rect.bottom;
        if (heroBottomAbsolute > 0) {
          thresholdRef.current = heroBottomAbsolute + REVEAL_BUFFER_PX;
          return;
        }
      }

      thresholdRef.current = FALLBACK_THRESHOLD_PX;
    };

    const onScroll = () => {
      setVisible(window.scrollY > thresholdRef.current);
    };

    computeThreshold();
    onScroll();

    let resizeTimer;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        computeThreshold();
        onScroll();
      }, 150);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const handleClick = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${styles.btn} ${visible ? styles.visible : ''}`}
      aria-label="חזרה לראש העמוד"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
    >
      <ArrowUpIcon />
    </button>
  );
}
