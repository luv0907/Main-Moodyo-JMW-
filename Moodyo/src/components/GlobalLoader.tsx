'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import Loader from './Loader';

export function GlobalLoader() {
  const { globalLoading } = useAppContext();

  return (
    <AnimatePresence>
      {globalLoading && (
        <motion.div
          className="loader-fullscreen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Loader />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
