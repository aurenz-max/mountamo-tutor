'use client';

import React from 'react';
import { LuminaButton } from '../../../../../ui';
import { SoundManager } from '../../../../../utils/SoundManager';

interface BlockTutorHelpProps {
  /**
   * Bridge to the DeepDive live tutor (Gemini Live). Provided by DeepDive; when
   * absent (standalone/preview contexts with no tutor) the affordance is hidden.
   */
  onAskTutor?: (message: string) => void;
  /**
   * Pre-built, answer-free help request. Blocks pass the question/target plus an
   * explicit "guide, do not reveal" instruction so the tutor gives a targeted
   * hint without handing over the answer.
   */
  message: string;
  /** Button copy. Defaults to a neutral ask. */
  label?: string;
  className?: string;
}

/**
 * Shared "Ask the tutor" affordance for interactive DeepDive blocks.
 *
 * Every graded block can forward a contextual help request to the live tutor the
 * DeepDive container already runs — no per-block tutor plumbing, no answer-leak
 * risk (the tutor is instructed to guide, not reveal). Renders nothing when no
 * tutor bridge is wired.
 */
const BlockTutorHelp: React.FC<BlockTutorHelpProps> = ({
  onAskTutor,
  message,
  label = 'Ask the tutor',
  className,
}) => {
  if (!onAskTutor) return null;
  return (
    <LuminaButton
      tone="subtle"
      size="sm"
      className={className}
      onClick={() => {
        SoundManager.tap();
        onAskTutor(message);
      }}
    >
      {label}
    </LuminaButton>
  );
};

export default BlockTutorHelp;
