'use client';

import { motion } from 'framer-motion';

export default function ScrollReveal({
  children,
  className,
  delay = 0,
  distance = 20,
  duration = 0.65,
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
