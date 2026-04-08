'use client';

import React from 'react';
import type { CompareContrastBlockData } from '../types';
import BlockWrapper from './BlockWrapper';

interface CompareContrastBlockProps {
  data: CompareContrastBlockData;
  index: number;
}

const CompareContrastBlock: React.FC<CompareContrastBlockProps> = ({ data, index }) => {
  const { itemA, itemB, label } = data;

  return (
    <BlockWrapper label={label} index={index} accent="indigo" variant="default">
      <div className="relative">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Item A */}
          <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-5">
            <h4 className="text-sm font-semibold text-indigo-200 mb-3 uppercase tracking-wide">
              {itemA.title}
            </h4>
            <ul className="space-y-2">
              {itemA.points.map((point, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400/60 flex-shrink-0" />
                  <span className="text-sm text-slate-300 leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Item B */}
          <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-5">
            <h4 className="text-sm font-semibold text-purple-200 mb-3 uppercase tracking-wide">
              {itemB.title}
            </h4>
            <ul className="space-y-2">
              {itemB.points.map((point, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-400/60 flex-shrink-0" />
                  <span className="text-sm text-slate-300 leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* VS badge — centered on the gap between cards (desktop only) */}
        <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
          <div className="w-9 h-9 rounded-full bg-slate-900 border border-white/15 flex items-center justify-center shadow-lg">
            <span className="text-[10px] font-bold text-slate-400 tracking-wide">VS</span>
          </div>
        </div>
      </div>
    </BlockWrapper>
  );
};

export default CompareContrastBlock;
