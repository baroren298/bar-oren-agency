'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { siteConfig } from '@/data/site';
import styles from './HeroSection.module.css';

export default function HeroSection({ backgroundImage = null }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const scrollDown = () => {
    const next = document.getElementById('agency-voice');
    if (next) next.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className={styles.hero} aria-label="כותרת ראשית">
      {/* Background */}
      <div className={styles.bg}>
        {backgroundImage && (
          <Image
            src={backgroundImage}
            alt=""
            fill
            priority
            sizes="100vw"
            className={styles.bgImage}
          />
        )}
        <div className={styles.overlay} aria-hidden="true" />
      </div>

      {/* Content */}
      <div className={styles.inner}>
        <motion.div
          className={styles.content}
          initial={{ opacity: 0, y: 28 }}
          animate={mounted ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.15 }}
        >
          <p className={styles.agencyLabel}>{siteConfig.tagline}</p>
          <h1 className={styles.name}>{siteConfig.name}</h1>
          <p className={styles.descriptor}>{siteConfig.descriptor}</p>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.button
        className={styles.scrollBtn}
        onClick={scrollDown}
        aria-label="גלול לתוכן"
        initial={{ opacity: 0 }}
        animate={mounted ? { opacity: 1 } : {}}
        transition={{ duration: 0.6, delay: 1.2 }}
      >
        <span className={styles.scrollLine} aria-hidden="true" />
      </motion.button>
    </section>
  );
}
