'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import TalentCard from '@/components/home/TalentCard';
import CategoryFilter from './CategoryFilter';
import styles from './TalentRoster.module.css';

export default function TalentRoster({ talent = [] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState(searchParams.get('category') || 'all');

  /* Sync with URL on back/forward navigation */
  useEffect(() => {
    const cat = searchParams.get('category') || 'all';
    setSelected(cat);
  }, [searchParams]);

  const handleFilterChange = useCallback(
    (category) => {
      setSelected(category);
      const params = new URLSearchParams(searchParams.toString());
      if (category === 'all') {
        params.delete('category');
      } else {
        params.set('category', category);
      }
      const query = params.toString();
      router.replace(`/talent${query ? `?${query}` : ''}`, { scroll: false });
    },
    [router, searchParams]
  );

  const filtered =
    selected === 'all'
      ? talent
      : talent.filter((t) => t.category.includes(selected));

  return (
    <div className={styles.wrapper}>
      <CategoryFilter selected={selected} onChange={handleFilterChange} />

      <div className={`${styles.gridContainer} container`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={selected}
            className={styles.grid}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {filtered.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.45,
                  delay: i * 0.055,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
              >
                <TalentCard talent={t} aspectRatio="3/4" />
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {filtered.length === 0 && (
          <p className={styles.empty}>אין כישרונות בקטגוריה זו כרגע.</p>
        )}
      </div>
    </div>
  );
}
