'use client';

import React from 'react';
import BlockShell from './BlockShell';
import type { VocabCardBlockData } from '../types';

interface VocabCardBlockProps {
  data: VocabCardBlockData;
  innerRef?: React.Ref<HTMLDivElement>;
}

/**
 * Display block for vocabulary the student should know before encountering it
 * in the passage. Distinct from `vocab-in-context` (which is evaluable).
 */
const VocabCardBlock: React.FC<VocabCardBlockProps> = ({ data, innerRef }) => {
  return (
    <BlockShell innerRef={innerRef} blockId={data.id} label={data.label} accent="cyan">
      <div className="space-y-2">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-2xl font-serif font-semibold text-cyan-100">{data.word}</span>
          {data.partOfSpeech && (
            <span className="text-xs italic text-slate-500">{data.partOfSpeech}</span>
          )}
        </div>
        <p className="text-sm text-slate-200 leading-relaxed">{data.definition}</p>
        {data.exampleSentence && (
          <div className="rounded-lg bg-slate-950/40 border border-white/5 px-3 py-2 mt-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5">
              In the passage
            </p>
            <p className="text-sm text-slate-300 italic leading-relaxed">&ldquo;{data.exampleSentence}&rdquo;</p>
          </div>
        )}
        {data.etymology && (
          <p className="text-xs text-slate-500 leading-relaxed mt-1">
            <span className="text-slate-400 font-medium">Origin:</span> {data.etymology}
          </p>
        )}
      </div>
    </BlockShell>
  );
};

export default VocabCardBlock;
