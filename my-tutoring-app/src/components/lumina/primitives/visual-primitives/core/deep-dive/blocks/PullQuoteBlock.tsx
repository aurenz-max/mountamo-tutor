'use client';

import React from 'react';
import type { PullQuoteBlockData } from '../types';
import { useTapTutor } from './TapTutor';

interface PullQuoteBlockProps {
  data: PullQuoteBlockData;
  index?: number;
  /** Bridge to the DeepDive live tutor; tapping the quote asks it to unpack the idea. */
  onAskTutor?: (message: string) => void;
}

/**
 * Editorial pull quote — minimal chrome, no card wrapper.
 * Breaks visual monotony and highlights a key insight between content blocks.
 * When a tutor bridge is wired, tapping the quote asks the tutor to unpack it.
 */
const PullQuoteBlock: React.FC<PullQuoteBlockProps> = ({ data, index, onAskTutor }) => {
  const { enabled, activeKey, ask } = useTapTutor(onAskTutor);

  const quote = (
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
  );

  return (
    <div data-block-index={index} className="py-4 px-2">
      {enabled ? (
        <button
          type="button"
          onClick={() =>
            ask(
              'quote',
              `[QUOTE_EXPLORE] The student tapped this pull quote: "${data.text}"${
                data.attribution ? ` (— ${data.attribution})` : ''
              }. Unpack what it means in simple, grade-appropriate terms — one sentence for the big idea, one for why it matters in this topic — then ask what the student thinks about it. Do not mention that they tapped.`,
            )
          }
          className={`block w-full text-left cursor-pointer rounded-lg p-2 -m-2 transition-colors hover:bg-white/5 ${
            activeKey === 'quote' ? 'bg-white/5 ring-1 ring-indigo-400/40' : ''
          }`}
        >
          {quote}
          <p className="mt-3 pl-6 text-xs text-slate-500 italic flex items-center gap-1.5">
            <span aria-hidden>💬</span>
            Tap to hear what this means
          </p>
        </button>
      ) : (
        quote
      )}
    </div>
  );
};

export default PullQuoteBlock;
