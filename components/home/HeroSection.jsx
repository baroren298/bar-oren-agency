'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { siteConfig } from '@/data/site';
import styles from './HeroSection.module.css';

export default function HeroSection({ locale = 'he' }) {
  const [mounted, setMounted] = useState(false);
  const isEnglish = locale === 'en';

  useEffect(() => {
    setMounted(true);
  }, []);

  const scrollDown = () => {
    const next = document.getElementById('agency-voice');
    if (next) next.scrollIntoView({ behavior: 'smooth' });
  };

  const descriptor = isEnglish ? siteConfig.descriptorEn : siteConfig.descriptor;

  return (
    <section className={styles.hero} aria-label={isEnglish ? 'Main heading' : 'כותרת ראשית'}>
      {/* Content */}
      <motion.div
        className={styles.inner}
        initial={{ opacity: 0, y: 20 }}
        animate={mounted ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.15 }}
      >
        <Image
          src="/images/brand/logo.png"
          alt="Bar Oren Talent Agency"
          width={500}
          height={500}
          priority
          className={styles.logo}
        />

        <p className={styles.descriptor}>{descriptor}</p>
      </motion.div>

      {/* Scroll indicator */}
      <motion.button
        className={styles.scrollBtn}
        onClick={scrollDown}
        aria-label={isEnglish ? 'Scroll to content' : 'גלול לתוכן'}
        initial={{ opacity: 0 }}
        animate={mounted ? { opacity: 1 } : {}}
        transition={{ duration: 0.6, delay: 1.2 }}
      >
        <span className={styles.scrollLine} aria-hidden="true" />
      </motion.button>
    </section>
  );
}
