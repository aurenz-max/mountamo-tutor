'use client';

/**
 * DiSentenceReadingTeaching — the sentence-reading stage as a tutor/JEV
 * teaching workspace (eighth adopter, after Counting Board, Shape Sorter, the
 * number train, di-letter-sounds, di-word-reading, di-math-facts and
 * letter-sound-link; the fourth DI pack to migrate, and the family's first
 * CONNECTED TEXT pack on the workspace).
 *
 * What the DI pedagogy KEEPS, because it is task structure rather than control
 * protocol: the child reads the printed sentence OUT LOUD, every word in
 * order; a skipped, added, or swapped word is a miss however small; catching
 * and fixing a slip mid-read still counts as accurate; speed is never judged.
 * What it loses is the requirement that the tutor say one exact sentence and
 * that the application read progression out of those words.
 *
 * WHAT IS DRAWN, AND WHY IT IS DRAWN THAT WAY
 *
 * Unlike word reading, there is nothing to withhold from the tutor or the ask:
 * the printed sentence is the target, and it is already on the child's screen.
 * The tutor legitimately MODELS it aloud before the read at `easy`/`medium`
 * support — that is real DI instruction, not a leak. `askFor` still never
 * repeats the sentence text in the task string, matching the sibling packs'
 * shape even though the reason here is consistency rather than a real leak.
 *
 * Connected text has no discrete sound-out sub-units the way a single
 * decodable word does, so there is only ONE demonstrable object — the whole
 * printed sentence — unlike word reading's per-letter marks.
 *
 * THE REWARD-REVEAL DECISION (mirrors di-word-reading, handoff 09)
 *
 * The reward picture is NOT a workspace object and never sits beside an unread
 * sentence. It is revealed in a read-sentences trail under the stage, one
 * entry per COMMITTED correct attempt — the same answer-leak shape word
 * reading uses, so a trail only ever contains sentences already read.
 *
 * The workspace binding, evaluation and recap are `DiTeachingStage`.
 */

import React, { useMemo } from 'react';
import type { DiSentenceReadingMetrics } from '../../../evaluation/types';
import DiTeachingStage, { diStageMetrics } from './DiTeachingStage';
import { buildSentenceReadingItems, workspaceAssignment, workspaceScene, type SentenceReadingItem }
  from './diSentenceReadingDomain';
import type { DiSentenceReadingData } from './DiSentenceReading';

export interface DiSentenceReadingTeachingProps {
  data: DiSentenceReadingData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

const COPY = {
  empty: 'These sentences are still being prepared. Try generating this practice again.',
  title: 'Sentence Reading', badge: 'Read it out loud', prompt: 'Read the sentence out loud, or ask for help.',
  heading: 'Great reading today!', celebration: 'You read every sentence!',
};

/** The printed sentence alone. No picture, emoji or hint joins it before the
 *  read — decoding print IS the skill. */
function stimulus(item: SentenceReadingItem, marks: readonly string[]) {
  const sizeClass = item.wordCount <= 4 ? 'text-5xl' : item.wordCount <= 6 ? 'text-4xl' : 'text-3xl';
  return <div className="flex justify-center">
    <div data-sentence-object="printed" data-assignment-target="true"
      data-tutor-demonstration={marks.includes('sentence')}
      aria-label={`The sentence ${item.text}`}
      className={`max-w-xl rounded-2xl border-2 border-amber-300 bg-amber-400/10 px-8 py-5 text-center font-bold leading-snug tracking-wide text-white ${sizeClass} ${
        marks.includes('sentence') ? 'outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : ''}`}>
      {item.text}
    </div>
  </div>;
}

/** The reward reveal: only sentences the observer has already committed. */
function readSentences(read: SentenceReadingItem[]) {
  return read.length > 0 && <div className="flex flex-wrap justify-center gap-2" aria-label="Sentences you have read">
    {read.map(done => <div key={done.id} data-sentence-read={done.text}
      className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-1">
      <span className="text-sm font-semibold text-white">{done.text}</span>
      <span className="text-xl leading-none" aria-hidden="true">{done.emoji || '✅'}</span>
    </div>)}
  </div>;
}

export default function DiSentenceReadingTeaching({ data, className, runtimePlanItemId, runtimeEvalMode }:
    DiSentenceReadingTeachingProps) {
  const items = useMemo(() => buildSentenceReadingItems(data.challenges), [data.challenges]);
  const evalMode = runtimeEvalMode || data.challengeType || 'read_sentence';
  return <DiTeachingStage<SentenceReadingItem, DiSentenceReadingMetrics> primitiveId="di-sentence-reading" data={data}
    items={items} evalMode={evalMode} className={className} runtimePlanItemId={runtimePlanItemId}
    assignment={workspaceAssignment} scene={workspaceScene} copy={COPY} stimulus={stimulus} trail={readSentences}
    recapLabel={item => item.text}
    metrics={result => ({ type: 'di-sentence-reading', ...diStageMetrics(result, items, data.challengeType),
      // Not tracked on the workspace path (no-timer ruling: L0 never judges latency).
      meanResponseMs: null,
      meanSentenceWords: items.length
        ? Math.round((items.reduce((sum, item) => sum + item.wordCount, 0) / items.length) * 10) / 10
        : 0 })} />;
}
