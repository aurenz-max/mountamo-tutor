'use client';

/**
 * DiMathFactsTeaching — the math-facts stage as a tutor/JEV teaching workspace
 * (sixth adopter, after Counting Board, Shape Sorter, the number train,
 * di-letter-sounds and di-word-reading; the third DI pack to migrate).
 *
 * What the DI pedagogy KEEPS, because it is task structure rather than control
 * protocol: the child SAYS the answer out loud; the printed problem is the only
 * thing on the stage before the answer; counting to the answer is a legitimate
 * route whose direction depends on the skill; a different quantity is wrong
 * however close. What it loses is the requirement that the tutor say one exact
 * sentence and that the application read progression out of those words.
 *
 * WHAT IS DRAWN, AND WHY IT IS DRAWN THAT WAY
 *
 * THE ANSWER IS NOT THE STIMULUS — the inverse of di-word-reading, and the
 * reason this adopter is not a copy of it. There the tutor could be handed the
 * word freely, because it was already printed in front of the child. Here the
 * answer exists nowhere on screen, so handing it to the tutor (which the
 * assignment fact must do, or it cannot judge) creates a channel the screen
 * does not have: the tutor can SAY the answer before the child does. The screen
 * cannot block that, so the guidance does, and `askFor` never contains it.
 *
 * `name_numeral` inverts within the pack: the printed numeral IS the answer, so
 * its domain gate is inverted too and there is nothing to withhold.
 *
 * The printed terms are separate workspace objects on a computed fact, so
 * marking one is the real counting-on gesture — point at the 2, then count on
 * one more. A bare numeral has a single token, so it publishes no term targets
 * and the whole stimulus is the only thing to point at.
 *
 * THE REWARD-REVEAL DECISION, and where it departs from the standalone stage
 *
 * The standalone drill completes the fact IN PLACE ("2 + 1" becomes "2 + 1 = 3",
 * emerald, for a held beat) and shows nothing else, because a user browser check
 * (2026-07-25) found two facts on screen at once to be overload at this age.
 * That beat depends on a `phase === 'affirmed'` window, and this path has none.
 * So the completed fact is keyed on the COMMITTED attempt instead, as
 * di-word-reading's read-words trail is, and it is rendered small and secondary
 * beneath the stage rather than at stimulus size. That keeps one large fact on
 * the stage — the overload finding's actual subject — while every affirmed fact
 * still gets its visible receipt.
 *
 * The workspace binding, evaluation and recap are `DiTeachingStage`.
 */

import React, { useMemo } from 'react';
import type { DiMathFactsMetrics } from '../../../evaluation/types';
import DiTeachingStage, { diStageMetrics } from './DiTeachingStage';
import { buildMathFactItems, workspaceAssignment, workspaceScene, type MathFactItem } from './diMathFactsDomain';
import type { DiMathFactsData } from './DiMathFacts';

export interface DiMathFactsTeachingProps {
  data: DiMathFactsData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

const COPY = {
  empty: 'These facts are still being prepared. Try generating this practice again.',
  title: 'Math Facts', badge: 'Say it out loud', prompt: 'Say the answer out loud, or ask for help.',
  heading: 'Great work today!', celebration: 'You answered every fact!',
};

/** The printed problem alone. No answer, no equals sign, no worked form joins it
 *  before the child speaks — computing it IS the skill. */
function stimulus(item: MathFactItem, marks: readonly string[]) {
  return <div className="flex justify-center">
    <div data-fact-object="problem" data-assignment-target="true"
      data-tutor-demonstration={marks.includes('problem')}
      aria-label={`The problem ${item.display}`}
      className={`flex items-baseline gap-3 rounded-2xl border-2 border-amber-300 bg-amber-400/10 px-10 py-4 text-7xl font-bold tracking-wide text-white ${
        marks.includes('problem') ? 'outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : ''}`}>
      {item.terms.length
        ? item.terms.map((term, position) => (
          <span key={position} data-fact-term={position}
            data-tutor-demonstration={marks.includes(`term-${position}`)}
            className={`rounded-lg px-1 ${marks.includes(`term-${position}`)
              ? 'outline outline-2 outline-dashed outline-offset-2 outline-purple-400' : ''}`}>
            {term}
          </span>))
        : <span>{item.display}</span>}
    </div>
  </div>;
}

/** The reward reveal: only facts the observer has already credited. */
function solvedFacts(solved: MathFactItem[]) {
  return solved.length > 0 && <div className="flex flex-wrap justify-center gap-2" aria-label="Facts you have answered">
    {solved.map(done => <div key={done.id} data-fact-solved={done.answerNumeral}
      className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-1">
      <span className="text-lg font-semibold text-white">{done.solvedDisplay}</span>
      <span className="text-xl leading-none" aria-hidden="true">✅</span>
    </div>)}
  </div>;
}

/** A missed fact recaps by its PROBLEM, never its solved form: the recap must not
 *  print an answer the child never produced. */
const recapLabel = (item: MathFactItem, solved: boolean) => solved ? item.solvedDisplay : item.display;

export default function DiMathFactsTeaching({ data, className, runtimePlanItemId, runtimeEvalMode }: DiMathFactsTeachingProps) {
  const items = useMemo(() => buildMathFactItems(data.challenges), [data.challenges]);
  const evalMode = runtimeEvalMode || data.challengeType || 'answer_fact';
  // `meanResponseMs` is the standalone drill's tutor-audio-fall timing. The workspace
  // does not measure it, and reporting a number this path never took would make a
  // silent signal quietly wrong.
  return <DiTeachingStage<MathFactItem, DiMathFactsMetrics> primitiveId="di-math-facts" data={data}
    items={items} evalMode={evalMode} className={className} runtimePlanItemId={runtimePlanItemId}
    assignment={workspaceAssignment} scene={workspaceScene} copy={COPY} stimulus={stimulus} trail={solvedFacts}
    recapLabel={recapLabel}
    metrics={result => ({ type: 'di-math-facts', ...diStageMetrics(result, items, evalMode), meanResponseMs: null })} />;
}
