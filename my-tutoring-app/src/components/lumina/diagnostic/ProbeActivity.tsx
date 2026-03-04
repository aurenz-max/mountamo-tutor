'use client';

import React from 'react';
import { PracticeManifestRenderer } from '../components/PracticeManifestRenderer';
import { Button } from '@/components/ui/button';
import type { HydratedPracticeItem, PracticeItemResult } from '../types';
import type { ProbeRequest } from './types';

// Subject display names (friendly, no test framing)
const SUBJECT_LABELS: Record<string, string> = {
  mathematics: 'Math Activities',
  math: 'Math Activities',
  science: 'Science Activities',
  'language-arts': 'Language Arts Activities',
  'language arts': 'Language Arts Activities',
  reading: 'Reading Activities',
  writing: 'Writing Activities',
  'social-studies': 'Social Studies Activities',
  'social studies': 'Social Studies Activities',
};

const SUBJECT_COLORS: Record<string, string> = {
  mathematics: 'from-cyan-500/20 to-blue-500/20',
  math: 'from-cyan-500/20 to-blue-500/20',
  science: 'from-green-500/20 to-emerald-500/20',
  'language-arts': 'from-purple-500/20 to-violet-500/20',
  'language arts': 'from-purple-500/20 to-violet-500/20',
  reading: 'from-rose-500/20 to-pink-500/20',
  writing: 'from-violet-500/20 to-indigo-500/20',
  'social-studies': 'from-amber-500/20 to-yellow-500/20',
  'social studies': 'from-amber-500/20 to-yellow-500/20',
};

interface ProbeActivityProps {
  probe: ProbeRequest;
  hydratedItems: HydratedPracticeItem[];
  currentItemIndex: number;
  onItemComplete: (result: PracticeItemResult) => void;
  onNext: () => void;
  totalActivitiesDone: number;
}

export const ProbeActivity: React.FC<ProbeActivityProps> = ({
  probe,
  hydratedItems,
  currentItemIndex,
  onItemComplete,
  onNext,
  totalActivitiesDone,
}) => {
  const currentItem = hydratedItems[currentItemIndex];
  const isLastItem = currentItemIndex >= hydratedItems.length - 1;
  const subjectLabel =
    SUBJECT_LABELS[probe.subject.toLowerCase()] || 'Activities';
  const gradientClass =
    SUBJECT_COLORS[probe.subject.toLowerCase()] ||
    'from-slate-500/20 to-slate-600/20';

  if (!currentItem) return null;

  return (
    <div className="max-w-5xl mx-auto w-full">
      {/* Soft subject header */}
      <div
        className={`mb-6 rounded-xl bg-gradient-to-r ${gradientClass} border border-white/10 px-5 py-3 flex items-center justify-between`}
      >
        <span className="text-sm font-medium text-slate-300">
          {subjectLabel}
        </span>
        <span className="text-xs text-slate-500">
          Activity {totalActivitiesDone + currentItemIndex + 1}
        </span>
      </div>

      {/* Problem renderer — uses normal per-item feedback */}
      <PracticeManifestRenderer
        item={currentItem}
        itemIndex={currentItemIndex}
        onItemComplete={onItemComplete}
      />

      {/* Next / Done button */}
      <div className="mt-6 flex justify-center">
        <Button
          onClick={onNext}
          variant="ghost"
          className="bg-white/5 border border-white/20 hover:bg-white/10 px-8 py-3 text-white"
        >
          {isLastItem ? 'Done!' : 'Next'}
        </Button>
      </div>
    </div>
  );
};
