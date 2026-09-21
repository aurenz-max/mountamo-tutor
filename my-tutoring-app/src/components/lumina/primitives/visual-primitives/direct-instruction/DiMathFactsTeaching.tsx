'use client';

/**
 * DiMathFactsTeaching — the math-facts stage as a tutor/JEV teaching workspace
 * (sixth adopter, after Counting Board, Shape Sorter, the number train,
 * di-letter-sounds and di-word-reading; the third DI pack to migrate).
 *
 * The stage defines the assignment and the legal scene actions; the tutor chooses
 * how to teach; JEV observes its completed feedback; the runtime commits scoped
 * outcomes. Nothing here composes a model line, scans for "Yes" or "My turn",
 * counts corrections or advances at a miss cap.
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
 * That beat depends on a `phase === 'affirmed'` window, and this path has none:
 * the observer commits success and `apply_tutor_verdict` submits and advances
 * inside one `flushSync`, so a reward keyed on the current item's phase would
 * render on the held-success path and never on the advance path.
 *
 * So the completed fact is keyed on the COMMITTED attempt instead, as
 * di-word-reading's read-words trail is, and it is rendered small and secondary
 * beneath the stage rather than at stimulus size. That keeps one large fact on
 * the stage — the overload finding's actual subject — while every affirmed fact
 * still gets its visible receipt. A trail only ever contains facts already
 * answered, so it cannot pre-cue the fact in flight or any fact still to come.
 */

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LuminaBadge, LuminaCard, LuminaCardContent, LuminaCardDescription, LuminaCardHeader,
  LuminaCardTitle, LuminaChallengeCounter, LuminaReadAloudGlyph } from '../../../ui';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { useTeachingWorkspace, type TeachingItem, type TeachingWorkspace }
  from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { useTeachingEvaluation } from '../../../components/live-activity/runtime/useTeachingEvaluation';
import type { DiMathFactsMetrics } from '../../../evaluation/types';
import { buildMathFactItems, type MathFactItem } from './diMathFactsDomain';
import type { DiMathFactsData } from './DiMathFacts';

export interface DiMathFactsTeachingProps {
  data: DiMathFactsData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

/** Is this printed token a number the tutor can point at, or the operator
 *  between them? Both are markable; only the label differs. */
const isNumeral = (term: string) => /^[0-9]+$/.test(term);

export default function DiMathFactsTeaching({ data, className, runtimePlanItemId, runtimeEvalMode }: DiMathFactsTeachingProps) {
  const items = useMemo(() => buildMathFactItems(data.challenges), [data.challenges]);
  if (!items.length) {
    return <LuminaCard className={className}><LuminaCardContent>
      <p>These facts are still being prepared. Try generating this practice again.</p>
    </LuminaCardContent></LuminaCard>;
  }
  return <FactWorkspace key={data.instanceId} data={data} items={items} className={className}
    runtimePlanItemId={runtimePlanItemId} runtimeEvalMode={runtimeEvalMode} />;
}

function FactWorkspace({ data, items, className, runtimePlanItemId, runtimeEvalMode }:
  DiMathFactsTeachingProps & { items: MathFactItem[] }) {
  const instance = useRef(data.instanceId || `di-math-facts-${Date.now()}`);
  const workspace = useRef<TeachingWorkspace | null>(null);
  const [marks, mark] = useState<string[]>([]);
  const evalMode = runtimeEvalMode || data.challengeType || 'answer_fact';

  const assignments = useMemo<TeachingItem[]>(() => items.map(item => ({
    id: item.id,
    task: item.ask,
    expectedAnswer: item.answerWord,
    // Every mode is spoken: the child says a number word, the tutor hears the
    // audio and JEV reads its completed feedback. There is no gesture channel to
    // check, and no transcript parser in front of the answer.
    response: 'speech' as const,
    checkResponse: () => null,
  })), [items]);

  const lesson = useTeachingWorkspace({ instanceId: instance.current, primitiveId: 'di-math-facts',
    objectiveId: data.objectiveId, planItemId: runtimePlanItemId, evalMode, items: assignments, workspace });

  const evaluation = useTeachingEvaluation<DiMathFactsMetrics>({ primitiveType: 'di-math-facts',
    instanceId: instance.current, data, assignments, lesson, evalMode,
    metrics: result => ({ type: 'di-math-facts', evalMode, challengeType: items[0].challengeType,
      totalChallenges: items.length, correctCount: result.solvedCount, attemptsCount: result.attemptsCount,
      firstTryCount: result.firstTryCount, hintsViewed: 0, overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: Math.round(result.attemptsCount / items.length * 10) / 10,
      // The fluency signal is the standalone drill's tutor-audio-fall timing.
      // The workspace does not measure it, and reporting a number this path
      // never took would make a silent signal quietly wrong.
      meanResponseMs: null }) });

  const item = items[lesson.state.index];
  /** Facts the observer has already credited. The completed-equation reveal and
   *  the completion recap both read from here, never from a local phase. */
  const solved = items.filter(candidate =>
    lesson.state.attempts.some(attempt => attempt.itemId === candidate.id && attempt.correct));

  useLayoutEffect(() => {
    workspace.current = {
      objects: [
        { id: 'problem', selected: false, group: 'assignment target (the printed problem)',
          label: `the printed problem "${item.display}", which the learner must answer out loud` },
        // Present only where the stimulus really has parts. A bare numeral is one
        // object, so there is no term inside it to point at separately.
        ...item.terms.map((term, position) => ({ id: `term-${position}`, selected: false,
          group: 'part of the printed problem',
          label: isNumeral(term)
            ? `the printed number "${term}", part ${position + 1} of the problem`
            : `the "${term}" sign in the problem` })),
      ],
      demonstration: marks,
      facts: { kind: item.challengeType, assignment: item.assignment, printedProblem: item.display,
        spokenProblem: item.problem,
        // The tier the child is meant to meet this fact at. It is a fact rather
        // than a composed lead-in: the tutor decides how much to model, and at
        // `hard` the point of the item is that nothing models it first.
        support: item.supportTier === 'hard'
          ? 'answer it cold — do not say this fact or its answer before the learner answers'
          : item.supportTier === 'medium' ? 'the fact may be modelled once before the learner answers'
            : 'the fact may be modelled and said together before the learner answers',
        countingRoute: item.countingRoute === null
          ? 'none — counting the sequence is not a route to this answer'
          : `counting ${item.countingRoute} to the answer is a legitimate route`,
        markMeaning: 'Purple dashed marks are yours. They point at the whole problem or at one of its '
          + 'printed parts while you teach; they are not the learner answering, and they never write an '
          + 'answer on the stage.' },
      readyForResponse: true, canDemonstrate: true, canPresent: false,
      mark, clearPresentation: () => mark([]),
    };
    lesson.publishWorkspace();
  });

  const summary = lesson.summary;
  if (summary) return <LuminaCard className={className} surface="elevated">
    <LuminaCardContent className="space-y-6">
      <PhaseSummaryPanel heading="Great work today!" celebrationMessage="You answered every fact!"
        overallScore={evaluation.submittedResult?.score} durationMs={evaluation.elapsedMs}
        phases={summary.outcomes.map((outcome, position) => ({
          // A missed fact recaps by its PROBLEM, never its solved form: the recap
          // must not print an answer the child never produced.
          label: (outcome.score > 0 ? items[position]?.solvedDisplay : items[position]?.display) ?? '',
          score: outcome.score, attempts: outcome.attempts, firstTry: outcome.corrections === 0,
          accentColor: 'cyan' as const }))} />
    </LuminaCardContent>
  </LuminaCard>;

  return <LuminaCard className={className} surface="elevated">
    <LuminaCardHeader>
      <div className="flex items-center justify-between gap-3">
        <div>
          <LuminaCardTitle>{data.title || 'Math Facts'}</LuminaCardTitle>
          <LuminaCardDescription>{data.description}</LuminaCardDescription>
        </div>
        <LuminaBadge accent="cyan">Say it out loud</LuminaBadge>
      </div>
    </LuminaCardHeader>
    <LuminaCardContent className="space-y-6">
      <LuminaChallengeCounter current={lesson.state.index + 1} total={items.length} variant="dots" />
      {/* The printed problem alone. No answer, no equals sign, no worked form
          joins it before the child speaks — computing it IS the skill. */}
      <div className="flex justify-center">
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
      </div>
      {/* The reward reveal: only facts the observer has already credited. */}
      {solved.length > 0 && <div className="flex flex-wrap justify-center gap-2" aria-label="Facts you have answered">
        {solved.map(done => <div key={done.id} data-fact-solved={done.answerNumeral}
          className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-1">
          <span className="text-lg font-semibold text-white">{done.solvedDisplay}</span>
          <span className="text-xl leading-none" aria-hidden="true">✅</span>
        </div>)}
      </div>}
      <div className="flex justify-center"><LuminaReadAloudGlyph size={22} speaking={lesson.tutorSpeaking} /></div>
      <p className="text-center text-sm text-slate-400">Say the answer out loud, or ask for help.</p>
    </LuminaCardContent>
  </LuminaCard>;
}
