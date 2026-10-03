/**
 * LuminaPrintSupport — the shared print-support overlay for a cold read (handoff 22 L3).
 *
 * Draws a printed word or line with the marks a reader's lever has pulled: sound dots under each grapheme, a
 * tracking underline under each word with a left-to-right arrow, a chunk divider inside one word, and the changed
 * letter of a word chain. It is visual only: it plays nothing, and the printed letters stay exactly the print
 * (`printSupport.ts` holds the pure rules; each primitive's lever module holds its leak test).
 *
 *   <LuminaPrintSupport text="The cat sat." trackingUnderline />
 *   <LuminaPrintSupport text="jumping" chunkBreak={4} soundDots />
 *
 * Each mark carries a `data-lever` attribute (`sound-dots`, `tracking-underline`, `chunk-divider`, `changed-letter`)
 * so tests and review screenshots can find what is on screen.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { graphemes, isLetters, printedWords } from './printSupport';

export interface LuminaPrintSupportProps {
  /** The printed word or line, exactly as printed. */
  text: string;
  soundDots?: boolean;
  trackingUnderline?: boolean;
  /** Letter offset of the chunk divider inside a single word. */
  chunkBreak?: number | null;
  /** Letter offset of the changed letter inside a single word. */
  changedLetter?: number | null;
  className?: string;
  /** Per-word class (a phonics tint or a reveal colour); the marks sit under it. */
  wordClassName?: (word: string, index: number) => string | undefined;
  /** With `soundDots`: which words get dots (default every word). di-sentence-reading dots only its CVC words: a dot
   *  under an irregular word teaches sounding out a word that cannot be sounded out. */
  dotWord?: (word: string, index: number) => boolean;
}

function Word({ word, dots, chunkAt, changedAt, className }: {
  word: string; dots: boolean; chunkAt: number | null; changedAt: number | null; className?: string;
}) {
  const pieces = dots ? graphemes(word) : word.split('');
  let offset = 0;
  return (
    <span className={cn('inline-flex items-start', className)} data-print-word={word}>
      {pieces.map((piece, i) => {
        const start = offset;
        offset += piece.length;
        const changed = changedAt !== null && changedAt >= start && changedAt < start + piece.length;
        return (
          <React.Fragment key={i}>
            {chunkAt !== null && start === chunkAt && (
              <span data-lever="chunk-divider" aria-hidden="true" className="mx-1 self-stretch w-0.5 rounded-full bg-amber-300/80" />
            )}
            <span className="inline-flex flex-col items-center">
              <span data-lever={changed ? 'changed-letter' : undefined}
                className={changed ? 'rounded bg-amber-400/20 px-0.5 text-amber-200 ring-1 ring-amber-300/60' : undefined}>
                {piece}
              </span>
              {dots && isLetters(piece) && <span data-sound-dot className="mt-1 h-2 w-2 rounded-full bg-cyan-300" />}
            </span>
          </React.Fragment>
        );
      })}
    </span>
  );
}

export function LuminaPrintSupport({ text, soundDots = false, trackingUnderline = false, chunkBreak = null,
  changedLetter = null, className, wordClassName, dotWord }: LuminaPrintSupportProps) {
  const words = printedWords(text);
  const single = words.length === 1;
  return (
    <span className={cn('inline-flex flex-col items-center', className)} data-lever={soundDots ? 'sound-dots' : undefined}>
      <span className="inline-flex flex-wrap items-start justify-center gap-x-[0.35em] gap-y-2">
        {words.map((word, i) => (
          <span key={i} className="inline-flex flex-col items-center">
            <Word word={word} dots={soundDots && (dotWord?.(word, i) ?? true)} chunkAt={single ? chunkBreak : null} changedAt={single ? changedLetter : null}
              className={wordClassName?.(word, i)} />
            {trackingUnderline && <span data-track-segment className="mt-1 h-1 w-full rounded-full bg-cyan-300/70" />}
          </span>
        ))}
      </span>
      {(trackingUnderline || soundDots) && (
        <span aria-hidden="true" data-lever={trackingUnderline ? 'tracking-underline' : undefined}
          className="mt-1 text-base leading-none text-cyan-300/80">→</span>
      )}
    </span>
  );
}
