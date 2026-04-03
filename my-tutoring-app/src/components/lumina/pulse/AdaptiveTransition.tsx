'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ADAPTIVE } from './adaptiveEngine/constants';
import type { TransitionType } from './adaptiveEngine/types';

interface AdaptiveTransitionProps {
  type: TransitionType;
  onComplete: () => void;
}

const MESSAGES: Record<TransitionType, { title: string; subtitle: string }> = {
  switch: {
    title: "Let's try a different approach!",
    subtitle: 'Sometimes a new way of looking at it makes all the difference.',
  },
  example: {
    title: 'Let me show you how this works...',
    subtitle: 'Watch closely, then you can try it yourself.',
  },
  celebration: {
    title: 'You crushed it!',
    subtitle: '3 for 3 \u2014 session complete.',
  },
};

/**
 * Full-screen interstitial that plays during adaptive transitions.
 * Serves double duty: pedagogical reset + masks manifest hydration latency.
 */
export const AdaptiveTransition: React.FC<AdaptiveTransitionProps> = ({ type, onComplete }) => {
  const [progress, setProgress] = useState(0);
  const { title, subtitle } = MESSAGES[type];

  useEffect(() => {
    // Animate progress bar
    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 2, 100));
    }, ADAPTIVE.TRANSITION_DURATION_MS / 50);

    // Fire completion
    const timer = setTimeout(onComplete, ADAPTIVE.TRANSITION_DURATION_MS);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="text-center max-w-md px-6"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }}
        >
          {/* Icon */}
          <motion.div
            className="text-6xl mb-6"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            {type === 'celebration' && (
              <span className="inline-block animate-bounce">&#127881;</span>
            )}
            {type === 'switch' && (
              <motion.span
                className="inline-block"
                animate={{ rotateY: [0, 180, 360] }}
                transition={{ duration: 1, ease: 'easeInOut' }}
              >
                &#128260;
              </motion.span>
            )}
            {type === 'example' && (
              <motion.span
                className="inline-block"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                &#128161;
              </motion.span>
            )}
          </motion.div>

          {/* Title */}
          <motion.h2
            className="text-2xl font-bold text-slate-100 mb-3"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.3 }}
          >
            {title}
          </motion.h2>

          {/* Subtitle */}
          <motion.p
            className="text-slate-400 text-lg mb-8"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.3 }}
          >
            {subtitle}
          </motion.p>

          {/* Progress bar (non-celebration) */}
          {type !== 'celebration' && (
            <div className="w-48 mx-auto h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-cyan-400 to-violet-400 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Celebration confetti dots */}
          {type === 'celebration' && (
            <div className="relative h-8">
              {Array.from({ length: 12 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    left: `${20 + Math.random() * 60}%`,
                    backgroundColor: ['#38bdf8', '#a78bfa', '#f472b6', '#4ade80', '#facc15'][i % 5],
                  }}
                  initial={{ y: 0, opacity: 1, scale: 0 }}
                  animate={{
                    y: [0, -60 - Math.random() * 40, 20],
                    opacity: [0, 1, 0],
                    scale: [0, 1.5, 0],
                  }}
                  transition={{
                    duration: 1.5,
                    delay: 0.5 + i * 0.08,
                    ease: 'easeOut',
                  }}
                />
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AdaptiveTransition;
