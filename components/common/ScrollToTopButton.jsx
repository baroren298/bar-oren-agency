'use client';

import { useEffect, useState, useCallback } from 'react';
import styles from './ScrollToTopButton.module.css';

const SHOW_AFTER_PX = 800;

/* Minimal arrow-up mark, stroke=currentColor — matches the WhatsApp icon's
   restrained, single-color line style. */
function ArrowUpIcon() {
  return (
    <svg
      width="18"
      height="18"
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

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > SHOW_AFTER_PX);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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
