'use client';

/**
 * DiSpokenPractice — the DI family's content-generic pack. One component, N skills: the stimulus is
 * data and the ask is data. The child meets a stimulus (printed text, a picture, a group of pictures,
 * two pictures side by side, or nothing at all — the tutor says it) and SAYS the answer.
 *
 * The Live tutor teaches it on the shared tutor/JEV workspace through `DiTeachingStage` (workspace
 * rollout C6; the scripted runner path is gone, one-path ruling 09-23). An unbound mount renders the
 * stage's visible "needs the tutor" card.
 *
 * ANSWER-LEAK RULE, STRUCTURALLY. Nothing on screen names the answer before the observer credits it:
 * `count_and_say` draws N pictures and never a numeral, a picture to name has no label, a `pair` prints
 * neither label (the tutor names both), and `none` prints nothing. The tap-to-hear button is gone: with
 * the tutor present, the learner asks the tutor to say it again.
 */

import React, { useMemo, useState } from 'react';
import type { DiSpokenPracticeMetrics, PrimitiveEvaluationResult } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import DiTeachingStage, { diStageMetrics, type DiStageLevers, type DiStageView } from './DiTeachingStage';
import { FIVE_ROWS, MODEL_ANSWER, MODEL_COUNT, MODEL_EXPLAIN, MODEL_READ, SOUND_DOTS, TOUCH_MARKS, WORD_MODEL, WORD_UNDERLINE,
  answerModelFor, countModelFor, easierItemFor, farPairFor, readModelFor, shortWordFor, smallerGroupFor, spokenLeverFacts, spokenLevers,
  startingLevers, wordModelFor } from './diSpokenPracticeLevers';
import type { SpokenPracticeItem, SpokenPracticeMode } from './diSpokenPracticeScript';
import { spokenPracticeAssignment, spokenPracticeScene } from './diSpokenPracticeWorkspace';

export type { SpokenPracticeItem, SpokenPracticeMode } from './diSpokenPracticeScript';

export interface DiSpokenPracticeData {
  title: string;
  description: string;
  /** 3-6 items, fully scripted by the generator. May be EMPTY: the generator refuses to invent
   *  unscoped content, and an honest empty state beats off-topic practice. */
  items: SpokenPracticeItem[];
  /** Generated spare items of the same skill for the levers (ruling R3), one marked `easier`. Never asked as items. */
  spares?: SpokenPracticeItem[];
  /** Session task identity (the resolved eval mode). */
  challengeType: SpokenPracticeMode;
  gradeLevel?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  componentIntent?: string;
  objectiveText?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DiSpokenPracticeMetrics>) => void;
}

export interface DiSpokenPracticeProps {
  data: DiSpokenPracticeData;
  index?: number;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED eval mode from the live mount; never rebuilt from a label. */
  runtimeEvalMode?: string;
}

const COPY = {
  empty: 'No spoken practice was built for this objective.',
  title: 'Say It Out Loud', badge: 'Say it out loud', prompt: 'Say the answer out loud, or ask for help.',
  heading: 'Practice Complete!', celebration: 'You answered out loud the whole way through!',
};

const picture = (emoji: string, label: string) =>
  <div className="text-center text-7xl leading-none" role="img" aria-label={label}>{emoji}</div>;

/** The stimulus alone (a pair's pictures carry their names for a screen reader: the tutor says them
 *  anyway, and the answer is the comparison word). A tutor mark outlines the whole panel, never one picture of a pair or a count. */
/** The model card: a DIFFERENT item, solved (count, a pair per menu word, a word, or a spare question). */
function ModelCard({ item, items, spares, pulled }: { item: SpokenPracticeItem; items: readonly SpokenPracticeItem[];
  spares: readonly SpokenPracticeItem[]; pulled: readonly string[] }) {
  const frame = (lever: string, body: React.ReactNode) => <div data-lever={lever} aria-label="My turn: a different one"
    className="flex flex-wrap items-center justify-center gap-3 rounded-xl border-2 border-dashed border-purple-400/70 bg-purple-500/10 px-4 py-2 text-purple-100">
    <span aria-hidden="true" className="text-xl leading-none">🗣️</span>{body}</div>;
  if (pulled.includes(MODEL_COUNT)) {
    const m = countModelFor(item, items);
    return m && frame(MODEL_COUNT, <span data-model-count={m.count} className="flex flex-wrap gap-1 text-2xl">
      {Array.from({ length: m.count }, (_, i) => <span key={i}>{m.emoji}</span>)}</span>);
  }
  if (pulled.includes(WORD_MODEL)) {
    const pairs = wordModelFor(item, items);
    return pairs && frame(WORD_MODEL, pairs.map(p => <span key={p.word} data-model-pair={p.word} className="flex items-center gap-1 text-3xl">
      <span>{p.a[1]}</span><span className="text-sm text-purple-200">·</span><span>{p.b[1]}</span></span>));
  }
  if (pulled.includes(MODEL_READ)) {
    const w = readModelFor(item, items);
    return w && frame(MODEL_READ, <span data-model-read={w} className="text-3xl font-semibold">{w}</span>);
  }
  if (pulled.includes(MODEL_ANSWER) || pulled.includes(MODEL_EXPLAIN)) {
    const spare = answerModelFor(item, items, spares);
    return spare && frame(item.mode === 'explain_concept' ? MODEL_EXPLAIN : MODEL_ANSWER, <span className="text-lg">
      {spare.stimulusEmoji ? <span aria-hidden="true" className="mr-2 text-3xl">{spare.stimulusEmoji}</span> : null}
      <span className="font-semibold">{spare.stimulusKind === 'none' ? spare.ask : spare.stimulusText}</span>
      <span className="ml-2 text-purple-200">→ {spare.mode === 'explain_concept' ? spare.conceptStatement : spare.expectedAnswer}</span></span>);
  }
  return null;
}

/** The stimulus and any lever on it. Keyed by item, so rings reset on a new item. */
function Stimulus({ item, marks, view, items, spares }: { item: SpokenPracticeItem; marks: readonly string[]; view: DiStageView;
  items: readonly SpokenPracticeItem[]; spares: readonly SpokenPracticeItem[] }) {
  const [ringed, setRinged] = useState<ReadonlySet<number>>(new Set());
  const marked = marks.includes('stimulus');
  const touch = view.pulled.includes(TOUCH_MARKS), rows = view.pulled.includes(FIVE_ROWS);
  const tap = (i: number) => { SoundManager.tap(); setRinged(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; }); };
  const printed = (text: string) => {
    const dots = view.pulled.includes(SOUND_DOTS), lines = view.pulled.includes(WORD_UNDERLINE);
    return <p className="flex flex-wrap justify-center gap-x-4 text-center text-4xl font-semibold tracking-wide text-slate-100">
      {text.split(/\s+/).map((word, w) => <span key={w} className="inline-flex flex-col items-center">
        <span className="inline-flex">{word.split('').map((ch, c) => <span key={c} className="inline-flex flex-col items-center">{ch}
          {dots && /[a-z0-9]/i.test(ch) && <span data-sound-dot aria-hidden="true" className="mt-1 h-2 w-2 rounded-full bg-cyan-300" />}</span>)}</span>
        {lines && <span data-word-line aria-hidden="true" className="mt-1 h-1 w-full rounded-full bg-cyan-300/70" />}
      </span>)}
    </p>;
  };
  const body = (() => {
    switch (item.stimulusKind) {
      case 'text':
        return printed(item.stimulusText);
      case 'emoji':
        return picture(item.stimulusEmoji, 'picture clue');
      case 'pair':
        return <div className="flex items-center justify-center gap-6">
          {picture(item.stimulusEmoji, item.stimulusText)}
          <span className="text-2xl text-slate-500">·</span>
          {picture(item.stimulusEmoji2 ?? '', item.stimulusText2 ?? '')}
        </div>;
      case 'objects':
        return <div className={rows ? 'grid grid-cols-5 justify-items-center gap-3' : 'flex flex-wrap items-center justify-center gap-3'}
          data-five-rows={rows || undefined} role="img" aria-label="a group of pictures">
          {Array.from({ length: item.stimulusCount }, (_, i) => touch
            ? <button key={i} type="button" data-pip-tap={i} data-ringed={ringed.has(i)} aria-label="A picture" onClick={() => tap(i)}
              className={`rounded-full text-4xl leading-none ${ringed.has(i) ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-900' : ''}`}>{item.stimulusEmoji}</button>
            : <span key={i} className="text-4xl leading-none">{item.stimulusEmoji}</span>)}
        </div>;
      case 'none':
      default:
        return <p className="text-center text-sm uppercase tracking-[0.3em] text-slate-500">listen</p>;
    }
  })();
  return <div data-practice-item={view.practice || undefined} className="space-y-4">
    <div data-spoken-object="stimulus" data-assignment-target="true" data-tutor-demonstration={marked}
      className={`rounded-xl border border-white/10 bg-white/5 px-4 py-8 ${marked ? 'outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : ''}`}>
      {body}
    </div>
    {!view.practice && <ModelCard item={item} items={items} spares={spares} pulled={view.pulled} />}
  </div>;
}

/** Credited answers, each with the answer the learner gave its credit for. */
function creditedAnswers(done: SpokenPracticeItem[]) {
  return done.length > 0 && <div className="flex flex-wrap justify-center gap-2" aria-label="Answers you have given">
    {done.map(item => <span key={item.id} data-spoken-credited={item.id}
      className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-200">
      {item.mode === 'explain_concept' ? item.conceptStatement : item.expectedAnswer}
    </span>)}
  </div>;
}

/** A missed item recaps without its answer. */
const recapLabel = (item: SpokenPracticeItem, solved: boolean) =>
  solved ? item.expectedAnswer : 'a question';

/** PLATFORM PROP CONTRACT: registry primitives mount as `<Component data={…} index={…} />`. */
export const DiSpokenPractice: React.FC<DiSpokenPracticeProps> = ({ data, className, runtimePlanItemId, runtimeEvalMode }) => {
  const items = useMemo(() => data.items ?? [], [data.items]);
  const spares = useMemo(() => data.spares ?? [], [data.spares]);
  const levers = useMemo<DiStageLevers<SpokenPracticeItem>>(() => ({
    declare: (item, pulled) => spokenLevers(item, pulled, items, spares),
    onScreen: (item, pulled) => spokenLeverFacts(item, pulled, items, spares),
    starting: item => startingLevers(item, items, spares),
    simpler: (item, lever) => lever === 'smaller_group' ? smallerGroupFor(item, items) : lever === 'far_pair' ? farPairFor(item, items)
      : lever === 'short_word' ? shortWordFor(item, items) : lever === 'easier_item' ? easierItemFor(item, items, spares) : null,
  }), [items, spares]);
  return <DiTeachingStage<SpokenPracticeItem, DiSpokenPracticeMetrics> primitiveId="di-spoken-practice" data={data}
    items={items} runtimeEvalMode={runtimeEvalMode} className={className} runtimePlanItemId={runtimePlanItemId}
    assignment={spokenPracticeAssignment} scene={spokenPracticeScene} copy={COPY} levers={levers}
    stimulus={(item, marks, view) => <Stimulus key={item.id} item={item} marks={marks} view={view} items={items} spares={spares} />}
    trail={creditedAnswers} recapLabel={recapLabel}
    metrics={result => ({ type: 'di-spoken-practice', ...diStageMetrics(result, items, data.challengeType) })} />;
};

export default DiSpokenPractice;
