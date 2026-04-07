'use client';

import React from 'react';
import type { PullQuoteBlockData } from '../types';

interface PullQuoteBlockProps {
  data: PullQuoteBlockData;
  index?: number;
}

/**
 * Editorial pull quote — minimal chrome, no card wrapper.
 * Breaks visual monotony and highlights a key insight between content blocks.
 */
const PullQuoteBlock: React.FC<PullQuoteBlockProps> = ({ data, index }) => {
  return (
    <div data-block-index={index} className="py-4 px-2">
      <blockquote className="border-l-2 border-indigo-400/40 pl-6">
        <p className="text-xl font-serif italic text-slate-300 leading-relaxed">
          &ldquo;{data.text}&rdquo;
        </p>
        {data.attribution && (
          <footer className="mt-3 text-sm text-slate-500 font-light">
            &mdash; {data.attribution}
          </footer>
        )}
      </blockquote>
    </div>
  );
};

export default PullQuoteBlock;
