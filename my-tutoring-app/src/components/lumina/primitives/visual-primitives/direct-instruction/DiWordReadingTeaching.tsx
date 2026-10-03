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
 * marking one points at a letter. On a sight word those objects do not exist, so a
 * tutor that tries to sound out an irregular word is refused by the scene rather
 * than by a sentence of guidance.
 *
 * LEVERS (`diWordReadingLevers.ts`, DI family 5): a "my turn" card with a DIFFERENT
 * word (decodable: with its picture, which marks it as already read); on a decodable
 * word the letters slide together, a dot under each letter, or an arrow under the
 * word, all silent; a two-letter practice word. The model card is smaller than the
 * gold-ringed word, so a K reader does not take it for the item.
 *
 * THE REWARD-REVEAL DECISION (handoff 09, §"What is genuinely new", item 1)
 *
 * The reward picture is NOT a workspace object and never sits beside an unread
 * word. It is revealed in a read-words trail under the stage, one entry per
 * COMMITTED correct attempt. A trail only ever contains words already read, so it
 * cannot pre-cue the word in flight or any word still to come.
 *
 * The workspace binding, evaluation and recap are `DiTeachingStage`.
 */

import React, { useEffect, useMemo, useState } from 'react';
import type { DiWordReadingMetrics } from '../../../evaluation/types';
import DiTeachingStage, { diStageMetrics, type DiStageLevers, type DiStageView } from './DiTeachingStage';
import { buildWordReadingItems, workspaceAssignment, workspaceScene, type WordReadingItem } from './diWordReadingDomain';
import { BLEND_SLIDE, MODEL_WORD, SOUND_DOTS, TRACKING_ARROW, modelFor, shortWordFor, startingLevers, wordLeverFacts,
  wordLevers, type WordModel } from './diWordReadingLevers';
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

/** The model card: a different word, smaller than the child's, with its picture when it has one. */
function ModelCard({ model }: { model: WordModel }) {
  return <div data-lever={MODEL_WORD} data-model-word={model.word} aria-label="My turn: a different word"
    className="flex items-center gap-3 rounded-xl border-2 border-dashed border-purple-400/70 bg-purple-500/10 px-4 py-2">
    <span aria-hidden="true" className="text-xl leading-none">🗣️</span>
    {model.emoji && <span aria-hidden="true" className="text-3xl leading-none">{model.emoji}</span>}
    <span className="text-3xl font-bold lowercase text-purple-100">{model.word}</span>
  </div>;
}

/** The printed word, its marks and any silent lever on it. Keyed by item. */
function WordCard({ item, marks, view, model }: { item: WordReadingItem; marks: readonly string[]; view: DiStageView;
  model: WordModel | null }) {
  const slide = view.pulled.includes(BLEND_SLIDE);
  // `blend_slide`: the letters start apart and slide together once the lever is on screen.
  const [joined, setJoined] = useState(!slide);
  useEffect(() => {
    if (!slide) return;
    setJoined(false);
    const timer = window.setTimeout(() => setJoined(true), 400);
    return () => window.clearTimeout(timer);
  }, [slide]);
  const dots = view.pulled.includes(SOUND_DOTS), arrow = view.pulled.includes(TRACKING_ARROW) || slide;
  return <div data-practice-item={view.practice || undefined} className="flex flex-wrap items-center justify-center gap-6">
    <div className="flex flex-col items-center gap-2">
      <div data-word-object="printed" data-assignment-target="true"
        data-tutor-demonstration={marks.includes('word')}
        aria-label={`The word ${item.word}`}
        className={`flex items-baseline rounded-2xl border-2 border-amber-300 bg-amber-400/10 px-10 py-4 text-7xl font-bold lowercase tracking-wide text-white ${
          marks.includes('word') ? 'outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : ''}`}>
        {item.letters.length
          ? item.letters.map((letter, position) => (
            <span key={position} data-word-letter={position}
              data-tutor-demonstration={marks.includes(`letter-${position}`)}
              className={`flex flex-col items-center rounded-lg transition-[margin] duration-700 ${slide && !joined ? 'mx-5' : 'mx-0'} ${
                marks.includes(`letter-${position}`) ? 'outline outline-2 outline-dashed outline-offset-2 outline-purple-400' : ''}`}>
              {letter}
              {dots && <span data-lever={SOUND_DOTS} data-sound-dot={position} aria-hidden="true" className="mt-1 h-3 w-3 rounded-full bg-amber-300" />}
            </span>))
          : <span>{item.word}</span>}
      </div>
      {arrow && item.letters.length > 0 && <div data-lever={slide ? BLEND_SLIDE : TRACKING_ARROW} aria-label="Left to right" className="flex w-48 items-center">
        <span className="h-1 flex-1 bg-cyan-300/80" />
        <span className="h-0 w-0 border-y-[8px] border-l-[14px] border-y-transparent border-l-cyan-300/80" />
      </div>}
    </div>
    {model && view.pulled.includes(MODEL_WORD) && <ModelCard model={model} />}
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
  // The levers read the whole session: a model is never a word the session asks.
  const levers = useMemo<DiStageLevers<WordReadingItem>>(() => ({
    declare: (item, pulled) => wordLevers(item, pulled, items),
    onScreen: (item, pulled) => wordLeverFacts(item, pulled, items),
    starting: item => startingLevers(item, items),
    simpler: item => shortWordFor(item, items),
  }), [items]);
  return <DiTeachingStage<WordReadingItem, DiWordReadingMetrics> primitiveId="di-word-reading" data={data}
    items={items} runtimeEvalMode={runtimeEvalMode} className={className} runtimePlanItemId={runtimePlanItemId}
    assignment={workspaceAssignment} scene={workspaceScene} copy={COPY} trail={readWords} levers={levers}
    stimulus={(item, marks, view) => <WordCard key={item.id} item={item} marks={marks} view={view}
      model={view.practice ? null : modelFor(item, items)} />}
    recapLabel={item => item.word}
    metrics={result => ({ type: 'di-word-reading', ...diStageMetrics(result, items, data.challengeType) })} />;
}
