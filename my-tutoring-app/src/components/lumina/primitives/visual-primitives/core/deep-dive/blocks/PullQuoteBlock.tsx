'use client';

import React from 'react';
import type { PullQuoteBlockData } from '../types';
import { useTapTutor } from './TapTutor';
import { LuminaReadAloud } from '../../../../../ui';
import { SoundManager } from '../../../../../utils/SoundManager';

interface PullQuoteBlockProps {
  data: PullQuoteBlockData;
  index?: number;
  /** Bridge to the DeepDive live tutor; tapping the quote asks it to unpack the idea. */
  onAskTutor?: (message: string) => void;
  /**
   * Pre-reader (K) presentation — the quote is unreadable to the child, so the
   * tap-to-unpack affordance becomes a single "Read to me" button that voices the
   * saying word for word first ([BLOCK_READ_ALOUD]); the text tap-hint is dropped
   * (reader-fit rules 1, 7).
   */
  preReader?: boolean;
}

/**
 * Editorial pull quote — minimal chrome, no card wrapper.
 * Breaks visual monotony and highlights a key insight between content blocks.
 * When a tutor bridge is wired, tapping the quote asks the tutor to unpack it.
 */
const PullQuoteBlock: React.FC<PullQuoteBlockProps> = ({ data, index, onAskTutor, preReader = false }) => {
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

  // Pre-reader: a spoken read of the saying, word for word. No tap-to-unpack
  // (the hint text is invisible to a non-reader), just the "Read to me" button.
  if (preReader) {
    return (
      <div data-block-index={index} className="py-4 px-2">
        {quote}
        {onAskTutor && (
          <div className="mt-4 flex justify-center">
            <LuminaReadAloud
              size="lg"
              label="Read to me"
              onClick={() => {
                SoundManager.tap();
                onAskTutor(
                  `[BLOCK_READ_ALOUD] A pre-reader tapped the speaker on a special saying they cannot read. `
                  + `Read it aloud to them word for word, warmly and clearly: "${data.text}"${
                    data.attribution ? ` — ${data.attribution}` : ''
                  }. When you finish reading, stop — no commentary, no questions.`,
                );
              }}
            />
          </div>
        )}
      </div>
    );
  }

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
