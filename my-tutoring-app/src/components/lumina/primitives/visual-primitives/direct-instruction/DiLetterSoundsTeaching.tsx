'use client';

/**
 * DiLetterSoundsTeaching — the letter-sounds stage as a tutor/JEV teaching
 * workspace (fourth adopter, after Counting Board, Shape Sorter and the number
 * train; first adopter outside math, and the first DI pack to migrate).
 *
 * What the DI pedagogy KEEPS, because it is task structure rather than control
 * protocol: the child answers out loud in every mode; the printed stimulus stays
 * on screen at every tier; a short vowel accepts its keyword (it distorts alone);
 * a stop is still judged as a clipped release; the letter's NAME is still not
 * the answer. What it loses is the requirement that the tutor say one exact
 * sentence and that the application read progression out of those words.
 *
 * Objects: the stimulus card (the printed grapheme, or the keyword in print for
 * onset isolation) and the keyword picture. On an onset item the picture is
 * always drawn (it carries the spoken word for a pre-reader); on a grapheme item
 * it is the `keyword_picture` lever (ruling R4), on screen at easy only, because
 * a child who hears first sounds can answer from it. The tutor can mark either
 * one. It never says the item's sound or its keyword route ("moon starts with
 * mmm") before the child tries (R2, 2026-10-03); a model is a DIFFERENT letter.
 *
 * LEVERS (`diLetterSoundsLevers.ts`, DI family 4): the model card, the keyword
 * picture, DISTAR's continuous-sound arrow under a held letter, and empty sound
 * boxes under an onset picture, the first lit.
 *
 * The workspace binding, evaluation and recap are `DiTeachingStage`.
 */

import React, { useMemo } from 'react';
import type { DiLetterSoundsMetrics } from '../../../evaluation/types';
import DiTeachingStage, { diStageMetrics, type DiStageLevers, type DiStageView } from './DiTeachingStage';
import { buildLetterSoundItems, workspaceAssignment, workspaceScene, type LetterSoundItem } from './diLetterSoundsDomain';
import { FIRST_BOX, KEYWORD_SOUNDS, MODEL_SOUND, SOUND_ARROW, letterLeverFacts, letterLevers, modelFor, pictureShown,
  startingLevers } from './diLetterSoundsLevers';
import type { LetterSoundMenuEntry } from './diLetterSoundsMenu';
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

/** The model card: a DIFFERENT letter with its picture (onset: a different picture with its word). */
function ModelCard({ model, onset }: { model: LetterSoundMenuEntry; onset: boolean }) {
  return <div data-lever={MODEL_SOUND} data-model-letter={model.letter} aria-label={`My turn: ${onset ? model.keyword : `the letter ${model.letter}`}`}
    className="flex items-center gap-3 rounded-xl border-2 border-dashed border-purple-400/70 bg-purple-500/10 px-4 py-2">
    <span aria-hidden="true" className="text-xl leading-none">🗣️</span>
    <span aria-hidden="true" className="text-4xl leading-none">{model.emoji}</span>
    <span className={`font-bold text-purple-100 ${onset ? 'text-2xl lowercase' : 'text-4xl'}`}>{onset ? model.keyword : model.letter}</span>
  </div>;
}

function stimulus(item: LetterSoundItem, marks: readonly string[], view: DiStageView, model: LetterSoundMenuEntry | null) {
  const printed = item.stimulus === 'word' ? item.keyword : item.letter;
  const onset = item.stimulus === 'word';
  const boxes = onset && view.pulled.includes(FIRST_BOX) ? KEYWORD_SOUNDS[item.keyword.toLowerCase()] ?? 0 : 0;
  return <div data-practice-item={view.practice || undefined} className="flex flex-wrap items-center justify-center gap-6">
    <div className="flex flex-col items-center gap-4">
      {pictureShown(item, view.pulled) && <div data-sound-object="picture" data-pip-object="stage" data-lever={onset ? undefined : 'keyword_picture'}
        data-tutor-demonstration={marks.includes('picture')}
        aria-label={`Picture of a ${item.keyword}`}
        className={`rounded-2xl border px-6 py-3 text-7xl leading-none ${marks.includes('picture')
          ? 'border-purple-300 outline outline-2 outline-dashed outline-offset-4 outline-purple-400'
          : 'border-transparent'}`}>
        <span aria-hidden="true">{item.emoji}</span>
      </div>}
      {boxes > 0 && <div data-lever={FIRST_BOX} aria-label="One box for each sound in the word; the first box is lit" className="flex gap-2">
        {Array.from({ length: boxes }, (_, i) => <span key={i} data-sound-box={i} data-lit={i === 0}
          className={`h-10 w-10 rounded-lg border-2 ${i === 0 ? 'border-amber-300 bg-amber-400/30' : 'border-slate-400/60 bg-slate-800/40'}`} />)}
      </div>}
      <div data-sound-object="stimulus" data-assignment-target="true"
        data-tutor-demonstration={marks.includes('stimulus')}
        aria-label={onset ? `The word ${item.keyword}` : `The letter ${item.letter}`}
        className={`rounded-2xl border-2 border-amber-300 bg-amber-400/10 px-10 py-4 font-bold tracking-wide text-white ${
          onset ? 'text-5xl lowercase' : 'text-7xl'} ${marks.includes('stimulus')
            ? 'outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : ''}`}>
        {printed}
      </div>
      {/* DISTAR's continuous-sound mark: a ball and a long arrow. It says "hold it", never which sound. */}
      {view.pulled.includes(SOUND_ARROW) && <div data-lever={SOUND_ARROW} aria-label="Hold the sound" className="flex w-40 items-center">
        <span className="h-4 w-4 rounded-full bg-amber-300" />
        <span className="h-1 flex-1 bg-amber-300" />
        <span className="h-0 w-0 border-y-[8px] border-l-[14px] border-y-transparent border-l-amber-300" />
      </div>}
    </div>
    {model && view.pulled.includes(MODEL_SOUND) && <ModelCard model={model} onset={onset} />}
  </div>;
}

export default function DiLetterSoundsTeaching({ data, className, runtimePlanItemId, runtimeEvalMode }: DiLetterSoundsTeachingProps) {
  const items = useMemo(() => buildLetterSoundItems(data.challenges), [data.challenges]);
  // The levers read the whole session: a model is never a letter or picture a later item asks.
  const levers = useMemo<DiStageLevers<LetterSoundItem>>(() => ({
    declare: (item, pulled) => letterLevers(item, pulled, items),
    onScreen: (item, pulled) => letterLeverFacts(item, pulled, items),
    starting: item => startingLevers(item, items),
  }), [items]);
  return <DiTeachingStage<LetterSoundItem, DiLetterSoundsMetrics> primitiveId="di-letter-sounds" data={data}
    items={items} runtimeEvalMode={runtimeEvalMode} className={className} runtimePlanItemId={runtimePlanItemId}
    assignment={workspaceAssignment} scene={(item, view) => workspaceScene(item, view)} copy={COPY} levers={levers}
    stimulus={(item, marks, view) => stimulus(item, marks, view, view.practice ? null : modelFor(item, items))}
    recapLabel={item => item.stimulus === 'word' ? item.keyword : item.letter}
    metrics={result => ({ type: 'di-letter-sounds', ...diStageMetrics(result, items, data.challengeType) })} />;
}
