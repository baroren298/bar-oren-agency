'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import TalentCard from '@/components/home/TalentCard';
import TalentModal from './TalentModal';
import CategoryFilter from './CategoryFilter';
import styles from './TalentRoster.module.css';

export default function TalentRoster({ talent = [], mode = 'page' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPage = mode === 'page';

  const [selected,   setSelected]   = useState(isPage ? (searchParams.get('category') || 'all') : 'all');
  const [openTalent, setOpenTalent] = useState(null);

  /* Sync with URL on back/forward navigation — page mode only */
  useEffect(() => {
    if (!isPage) return;
    const cat = searchParams.get('category') || 'all';
    setSelected(cat);
  }, [searchParams, isPage]);

  const handleFilterChange = useCallback(
    (category) => {
      setSelected(category);
      if (!isPage) return;
      const params = new URLSearchParams(searchParams.toString());
      if (category === 'all') {
        params.delete('category');
      } else {
        params.set('category', category);
      }
      const query = params.toString();
      router.replace(`/talent${query ? `?${query}` : ''}`, { scroll: false });
    },
    [router, searchParams, isPage]
  );

  const handleOpen  = useCallback((t) => setOpenTalent(t), []);
  const handleClose = useCallback(() => setOpenTalent(null), []);

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
                <TalentCard talent={t} aspectRatio="3/4" onOpen={handleOpen} />
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {filtered.length === 0 && (
          <p className={styles.empty}>אין כישרונות בקטגוריה זו כרגע.</p>
        )}
      </div>

      {/* Talent modal — rendered outside the grid so it sits above everything */}
      <AnimatePresence>
        {openTalent && (
          <TalentModal talent={openTalent} onClose={handleClose} />
        )}
      </AnimatePresence>
    </div>
  );
}
