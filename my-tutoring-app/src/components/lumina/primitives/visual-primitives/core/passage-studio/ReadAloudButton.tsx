'use client';

import React from 'react';
import { LuminaReadAloud } from '../../../../ui';
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

// Thin wrapper over the kit's read-aloud surface: keeps this primitive's
// per-stimulus-kind labeling while the look stays kit-owned.
const ReadAloudButton: React.FC<ReadAloudButtonProps> = ({ onClick, stimulusKind }) => (
  <LuminaReadAloud
    size="sm"
    label="Listen"
    title={KIND_LABEL[stimulusKind]}
    aria-label={KIND_LABEL[stimulusKind]}
    onClick={onClick}
  />
);

export default ReadAloudButton;
