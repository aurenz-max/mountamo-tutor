'use client';

import React from 'react';
import BlockShell from './BlockShell';
import type { PullQuoteBlockData } from '../types';

interface PullQuoteBlockProps {
  data: PullQuoteBlockData;
  innerRef?: React.Ref<HTMLDivElement>;
}

const PullQuoteBlock: React.FC<PullQuoteBlockProps> = ({ data, innerRef }) => {
  return (
    <BlockShell innerRef={innerRef} blockId={data.id} label={data.label} accent="indigo">
      <blockquote className="relative pl-6">
        <span className="absolute left-0 top-0 text-4xl text-indigo-400/40 font-serif leading-none">&ldquo;</span>
        <p className="text-lg font-serif italic text-slate-100 leading-relaxed">{data.text}</p>
        {data.attribution && (
          <footer className="mt-3 text-xs text-slate-500 uppercase tracking-wider">
            — {data.attribution}
          </footer>
        )}
      </blockquote>
    </BlockShell>
  );
};

export default PullQuoteBlock;
