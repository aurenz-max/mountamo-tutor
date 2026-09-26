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

import React, { useMemo } from 'react';
import type { DiSpokenPracticeMetrics, PrimitiveEvaluationResult } from '../../../evaluation/types';
import DiTeachingStage, { diStageMetrics } from './DiTeachingStage';
import type { SpokenPracticeItem, SpokenPracticeMode } from './diSpokenPracticeScript';
import { spokenPracticeAssignment, spokenPracticeScene } from './diSpokenPracticeWorkspace';

export type { SpokenPracticeItem, SpokenPracticeMode } from './diSpokenPracticeScript';

export interface DiSpokenPracticeData {
  title: string;
  description: string;
  /** 3-6 items, fully scripted by the generator. May be EMPTY: the generator refuses to invent
   *  unscoped content, and an honest empty state beats off-topic practice. */
  items: SpokenPracticeItem[];
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
function stimulus(item: SpokenPracticeItem, marks: readonly string[]) {
  const marked = marks.includes('stimulus');
  const body = (() => {
    switch (item.stimulusKind) {
      case 'text':
        return <p className="text-center text-4xl font-semibold tracking-wide text-slate-100">{item.stimulusText}</p>;
      case 'emoji':
        return picture(item.stimulusEmoji, 'picture clue');
      case 'pair':
        return <div className="flex items-center justify-center gap-6">
          {picture(item.stimulusEmoji, item.stimulusText)}
          <span className="text-2xl text-slate-500">·</span>
          {picture(item.stimulusEmoji2 ?? '', item.stimulusText2 ?? '')}
        </div>;
      case 'objects':
        return <div className="flex flex-wrap items-center justify-center gap-3" role="img" aria-label="a group of pictures">
          {Array.from({ length: item.stimulusCount }, (_, i) => <span key={i} className="text-4xl leading-none">{item.stimulusEmoji}</span>)}
        </div>;
      case 'none':
      default:
        return <p className="text-center text-sm uppercase tracking-[0.3em] text-slate-500">listen</p>;
    }
  })();
  return <div data-spoken-object="stimulus" data-assignment-target="true" data-tutor-demonstration={marked}
    className={`rounded-xl border border-white/10 bg-white/5 px-4 py-8 ${marked ? 'outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : ''}`}>
    {body}
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
  const evalMode = runtimeEvalMode || data.challengeType || 'say_answer';
  return <DiTeachingStage<SpokenPracticeItem, DiSpokenPracticeMetrics> primitiveId="di-spoken-practice" data={data}
    items={items} evalMode={evalMode} className={className} runtimePlanItemId={runtimePlanItemId}
    assignment={spokenPracticeAssignment} scene={spokenPracticeScene} copy={COPY} stimulus={stimulus}
    trail={creditedAnswers} recapLabel={recapLabel}
    metrics={result => ({ type: 'di-spoken-practice', ...diStageMetrics(result, items, data.challengeType) })} />;
};

export default DiSpokenPractice;
