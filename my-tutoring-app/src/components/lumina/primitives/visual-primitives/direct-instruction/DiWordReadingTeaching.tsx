'use client';

/**
 * DiWordReadingTeaching — the word-reading stage as a tutor/JEV teaching
 * workspace (fifth adopter, after Counting Board, Shape Sorter, the number train
 * and di-letter-sounds; the second DI pack to migrate).
 *
 * What the DI pedagogy KEEPS, because it is task structure rather than control
 * protocol: the child reads the printed word OUT LOUD; the word is the only thing
 * on the card before the read; a decodable word is blended from its printed
 * letters and an irregular sight word is recalled whole; a different word is
 * wrong however close it sounds. What it loses is the requirement that the tutor
 * say one exact sentence and that the application read progression out of those
 * words.
 *
 * WHAT IS DRAWN, AND WHY IT IS DRAWN THAT WAY
 *
 * The answer IS the stimulus, so there is no answer side to withhold from the
 * tutor — it must have the word to judge the read at all. The leak this primitive
 * has to block is the tutor SAYING the word before the child reads it, which is
 * why `askFor` never contains the word and why the guidance is explicit about it.
 *
 * On a decodable item the printed letters are separate workspace objects, so
 * marking one is the real DISTAR sound-out gesture — point at "s", say sss, then
 * sweep the whole word. On a sight word those objects do not exist, so a tutor
 * that tries to sound out an irregular word is refused by the scene rather than
 * by a sentence of guidance. That is the "two word types, one act" constraint
 * made structural.
 *
 * THE REWARD-REVEAL DECISION (handoff 09, §"What is genuinely new", item 1)
 *
 * The reward picture is NOT a workspace object and never sits beside an unread
 * word. It is revealed in a read-words trail under the stage, one entry per
 * COMMITTED correct attempt. As a workspace object the tutor could see it and name
 * it before the read — the same answer leak the ANSWER-LEAK RULE blocks on screen,
 * only worse, because it arrives spoken. A trail only ever contains words already
 * read, so it cannot pre-cue the word in flight or any word still to come.
 *
 * The workspace binding, evaluation and recap are `DiTeachingStage`.
 */

import React, { useMemo } from 'react';
import type { DiWordReadingMetrics } from '../../../evaluation/types';
import DiTeachingStage, { diStageMetrics } from './DiTeachingStage';
import { buildWordReadingItems, workspaceAssignment, workspaceScene, type WordReadingItem } from './diWordReadingDomain';
import type { DiWordReadingData } from './DiWordReading';

export interface DiWordReadingTeachingProps {
  data: DiWordReadingData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

const COPY = {
  empty: 'These words are still being prepared. Try generating this practice again.',
  title: 'Word Reading', badge: 'Read it out loud', prompt: 'Read the word out loud, or ask for help.',
  heading: 'Great reading today!', celebration: 'You read every word!',
};

/** The printed word alone. No picture, emoji or hint joins it before the read —
 *  decoding print IS the skill. */
function stimulus(item: WordReadingItem, marks: readonly string[]) {
  return <div className="flex justify-center">
    <div data-word-object="printed" data-assignment-target="true"
      data-tutor-demonstration={marks.includes('word')}
      aria-label={`The word ${item.word}`}
      className={`flex items-baseline rounded-2xl border-2 border-amber-300 bg-amber-400/10 px-10 py-4 text-7xl font-bold lowercase tracking-wide text-white ${
        marks.includes('word') ? 'outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : ''}`}>
      {item.letters.length
        ? item.letters.map((letter, position) => (
          <span key={position} data-word-letter={position}
            data-tutor-demonstration={marks.includes(`letter-${position}`)}
            className={`rounded-lg ${marks.includes(`letter-${position}`)
              ? 'outline outline-2 outline-dashed outline-offset-2 outline-purple-400' : ''}`}>
            {letter}
          </span>))
        : <span>{item.word}</span>}
    </div>
  </div>;
}

/** The reward reveal: only words the observer has already committed. */
function readWords(read: WordReadingItem[]) {
  return read.length > 0 && <div className="flex flex-wrap justify-center gap-2" aria-label="Words you have read">
    {read.map(done => <div key={done.id} data-word-read={done.word}
      className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-1">
      <span className="text-lg font-semibold lowercase text-white">{done.word}</span>
      <span className="text-xl leading-none" aria-hidden="true">{done.emoji || '✅'}</span>
    </div>)}
  </div>;
}

export default function DiWordReadingTeaching({ data, className, runtimePlanItemId, runtimeEvalMode }: DiWordReadingTeachingProps) {
  const items = useMemo(() => buildWordReadingItems(data.challenges), [data.challenges]);
  const evalMode = runtimeEvalMode || data.challengeType || 'read_word';
  return <DiTeachingStage<WordReadingItem, DiWordReadingMetrics> primitiveId="di-word-reading" data={data}
    items={items} evalMode={evalMode} className={className} runtimePlanItemId={runtimePlanItemId}
    assignment={workspaceAssignment} scene={workspaceScene} copy={COPY} stimulus={stimulus} trail={readWords}
    recapLabel={item => item.word}
    metrics={result => ({ type: 'di-word-reading', ...diStageMetrics(result, items, data.challengeType) })} />;
}
