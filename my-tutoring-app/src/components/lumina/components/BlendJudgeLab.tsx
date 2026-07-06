'use client';

/**
 * BlendJudgeLab — route-stable alias for the Voice Studio.
 *
 * The original blend-judge dev spike grew into the plug-and-play spoken-
 * interaction design bench at ./voice-studio (engine: hooks/useVoiceCapture;
 * scenarios: voice-studio/scenarios). This file only keeps the existing
 * DevPanelRouter key ('blend-judge-lab') working.
 */

import React from 'react';
import VoiceStudio from './voice-studio/VoiceStudio';

interface BlendJudgeLabProps {
  onBack: () => void;
}

const BlendJudgeLab: React.FC<BlendJudgeLabProps> = ({ onBack }) => <VoiceStudio onBack={onBack} />;

export default BlendJudgeLab;
