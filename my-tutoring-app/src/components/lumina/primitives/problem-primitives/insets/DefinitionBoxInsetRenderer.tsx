'use client';

import React from 'react';
import type { DefinitionBoxInset } from '../../../types';

interface DefinitionBoxInsetRendererProps {
  data: DefinitionBoxInset;
}

export const DefinitionBoxInsetRenderer: React.FC<DefinitionBoxInsetRendererProps> = ({ data }) => {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-lg font-bold text-slate-100">{data.term}</span>
        {data.partOfSpeech && (
          <span className="text-xs italic text-slate-500">{data.partOfSpeech}</span>
        )}
      </div>
      <p className="text-slate-300 text-sm leading-relaxed mb-2">
        {data.definition}
      </p>
      {data.exampleSentence && (
        <p className="text-xs text-slate-400 italic border-l-2 border-white/10 pl-3">
          &ldquo;{data.exampleSentence}&rdquo;
        </p>
      )}
    </div>
  );
};
