'use client';

/**
 * DiLetterSoundsTeaching — the letter-sounds stage as a tutor/JEV teaching
 * workspace (fourth adopter, after Counting Board, Shape Sorter and the number
 * train; first adopter outside math, and the first DI pack to migrate).
 *
 * What the DI pedagogy KEEPS, because it is task structure rather than control
 * protocol: the child answers out loud in every mode; the printed stimulus stays
 * on screen at every tier; a short vowel is still elicited through its keyword;
 * a stop is still judged as a clipped release; the letter's NAME is still not
 * the answer. What it loses is the requirement that the tutor say one exact
 * sentence and that the application read progression out of those words.
 *
 * Two objects are drawn, and both are real: the stimulus card (the printed
 * grapheme, or the keyword in print for onset isolation) and the keyword
 * picture. The tutor can mark either one to point at it while teaching —
 * "this picture is a moon, and moon starts with mmm" is the keyword route, and
 * it is a genuine teaching move rather than an answer. A mark is never a
 * learner attempt, and it never moves the gold ring off the stimulus.
 *
 * The workspace binding, evaluation and recap are `DiTeachingStage`.
 */

import React, { useMemo } from 'react';
import type { DiLetterSoundsMetrics } from '../../../evaluation/types';
import DiTeachingStage, { diStageMetrics } from './DiTeachingStage';
import { buildLetterSoundItems, workspaceAssignment, workspaceScene, type LetterSoundItem } from './diLetterSoundsDomain';
import type { DiLetterSoundsData } from './DiLetterSounds';

export interface DiLetterSoundsTeachingProps {
  data: DiLetterSoundsData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

const COPY = {
  empty: 'These sounds are still being prepared. Try generating this practice again.',
  title: 'Letter Sounds', badge: 'Say it out loud', prompt: 'Say the sound out loud, or ask for help.',
  heading: 'Great work today!', celebration: 'You said every sound!',
};

function stimulus(item: LetterSoundItem, marks: readonly string[]) {
  const printed = item.stimulus === 'word' ? item.keyword : item.letter;
  return <div className="flex flex-col items-center gap-4">
    <div data-sound-object="picture" data-pip-object="stage"
      data-tutor-demonstration={marks.includes('picture')}
      aria-label={`Picture of a ${item.keyword}`}
      className={`rounded-2xl border px-6 py-3 text-7xl leading-none ${marks.includes('picture')
        ? 'border-purple-300 outline outline-2 outline-dashed outline-offset-4 outline-purple-400'
        : 'border-transparent'}`}>
      <span aria-hidden="true">{item.emoji}</span>
    </div>
    <div data-sound-object="stimulus" data-assignment-target="true"
      data-tutor-demonstration={marks.includes('stimulus')}
      aria-label={item.stimulus === 'word' ? `The word ${item.keyword}` : `The letter ${item.letter}`}
      className={`rounded-2xl border-2 border-amber-300 bg-amber-400/10 px-10 py-4 font-bold tracking-wide text-white ${
        item.stimulus === 'word' ? 'text-5xl lowercase' : 'text-7xl'} ${marks.includes('stimulus')
          ? 'outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : ''}`}>
      {printed}
    </div>
  </div>;
}

export default function DiLetterSoundsTeaching({ data, className, runtimePlanItemId, runtimeEvalMode }: DiLetterSoundsTeachingProps) {
  const items = useMemo(() => buildLetterSoundItems(data.challenges), [data.challenges]);
  const evalMode = runtimeEvalMode || data.challengeType || 'letter_sound';
  return <DiTeachingStage<LetterSoundItem, DiLetterSoundsMetrics> primitiveId="di-letter-sounds" data={data}
    items={items} evalMode={evalMode} className={className} runtimePlanItemId={runtimePlanItemId}
    assignment={workspaceAssignment} scene={workspaceScene} copy={COPY} stimulus={stimulus}
    recapLabel={item => item.stimulus === 'word' ? item.keyword : item.letter}
    metrics={result => ({ type: 'di-letter-sounds', ...diStageMetrics(result, items, evalMode) })} />;
}
