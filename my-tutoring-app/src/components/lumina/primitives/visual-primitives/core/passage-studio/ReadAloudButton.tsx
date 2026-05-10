'use client';

import React from 'react';
import { Volume2 } from 'lucide-react';
import type { PassageStimulus } from './types';

interface ReadAloudButtonProps {
  onClick: () => void;
  stimulusKind: PassageStimulus['kind'];
}

const KIND_LABEL: Record<PassageStimulus['kind'], string> = {
  prose: 'Read passage aloud',
  poem: 'Read poem aloud',
  dialogue: 'Read dialogue aloud',
  'sentence-set': 'Read sentences aloud',
};

const ReadAloudButton: React.FC<ReadAloudButtonProps> = ({ onClick, stimulusKind }) => (
  <button
    type="button"
    onClick={onClick}
    title={KIND_LABEL[stimulusKind]}
    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-white/5 border border-white/15 text-slate-300 hover:bg-white/10 hover:text-white hover:border-white/30 transition-colors"
  >
    <Volume2 className="w-3.5 h-3.5" />
    <span>Listen</span>
  </button>
);

export default ReadAloudButton;
