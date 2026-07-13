'use client';

import React, { useCallback, useRef, useState } from 'react';
import { SoundManager } from '../../../../../utils/SoundManager';

/**
 * Shared tap-to-explore bridge for DeepDive DISPLAY blocks.
 *
 * Graded blocks already talk to the live tutor through BlockTutorHelp; display
 * blocks (key-facts, compare-contrast, timeline, …) were inert. This hook makes
 * their content elements tappable: a tap forwards a contextual [.._EXPLORE]
 * request to the tutor, which responds in voice. Centralized here so every
 * block gets the same behavior — enabled check, tap sound, rapid-tap debounce
 * (each send triggers a spoken tutor turn; a double-tap would talk over
 * itself), and an "active" key so blocks can highlight what the tutor is
 * currently talking about.
 */
export function useTapTutor(onAskTutor?: (message: string) => void) {
  const lastSentAtRef = useRef(0);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const ask = useCallback(
    (key: string, message: string) => {
      if (!onAskTutor) return;
      const now = Date.now();
      if (now - lastSentAtRef.current < 1200) return;
      lastSentAtRef.current = now;
      SoundManager.tap();
      setActiveKey(key);
      onAskTutor(message);
    },
    [onAskTutor],
  );

  return { enabled: !!onAskTutor, activeKey, ask };
}

/** Muted one-line footer telling the student the block is tappable. */
export const TapHint: React.FC<{ text?: string; className?: string }> = ({
  text = 'Tap anything above to hear more from your tutor',
  className,
}) => (
  <p
    className={`text-xs text-slate-500 italic flex items-center gap-1.5 ${className || 'mt-3'}`}
  >
    <span aria-hidden>💬</span>
    {text}
  </p>
);
