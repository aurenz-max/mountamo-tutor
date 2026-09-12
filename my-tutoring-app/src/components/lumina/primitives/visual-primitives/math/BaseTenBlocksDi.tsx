'use client';

/**
 * BaseTenBlocksDi — the judged-loop stage for base-ten-blocks' `read_blocks`
 * and `regroup` modes. Forked beside `BaseTenBlocks` rather than folded into
 * it: the click-era component still serves `build_number` and the operate
 * modes, and an in-place edit would have to keep two transports alive inside
 * one 950-line render.
 *
 * WHAT IS DELIBERATELY ABSENT: the keypad, "Check My Blocks", "Check My Trade",
 * "Next Challenge", the per-column digit readouts and the Blocks Total panel.
 * The readouts are not merely scaffolding here — on `read_blocks` the column
 * count IS the answer the child is about to say, so rendering it is the leak
 * that a string-scanning gate cannot see (add-di-loop Step 3, "hunt the leak in
 * PIXELS"). Nothing on this stage prints a count or a total at any tier.
 *
 * THE TRADE IS A REAL GESTURE, NOT A CHECK BUTTON THAT PRESSES ITSELF. Every
 * block above the ones column is tappable, so tapping the wrong SIZE is an
 * honest wrong answer that the tutor gets to correct. If only the asked-for
 * block responded, the hands turn could never be wrong and the tutor would
 * never teach.
 */
import React, { useMemo, useRef, useState } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import {
  LuminaBadge,
  LuminaButton,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChallengeCounter,
} from '../../../ui';
import DiActionPanel from '../../../components/DiActionPanel';
import { usePrimitiveEvaluation } from '../../../evaluation';
import type { BaseTenBlocksMetrics } from '../../../evaluation/types';
import { useJudgedScriptRunner, type JudgedRunSummary } from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import { SoundManager } from '../../../utils/SoundManager';
import type { BaseTenBlocksData } from './BaseTenBlocks';
import { placeWord } from './spokenNumberWords';
import {
  blockNoun,
  blockNounPlural,
  occupiedPlaces,
  tradeDown,
  tradeSolved,
  type BtColumns,
  type BtMode,
} from './baseTenModel';
import {
  baseTenChangeCue,
  baseTenCheckCue,
  baseTenCompleteCue,
  baseTenHearCue,
  baseTenItemCue,
  baseTenMoveOnCue,
  contextForItem,
  itemsFromChallenges,
  problemsFromChallenges,
  stepsOfProblem,
  type BaseTenItem,
} from './baseTenScript';

/** Mat colours by place — size carries the value, colour only aids scanning. */
const PLACE_STYLE: readonly { fill: string; edge: string; w: number; h: number }[] = [
  { fill: 'bg-emerald-400/80', edge: 'border-emerald-200/70', w: 14, h: 14 },
  { fill: 'bg-purple-400/80', edge: 'border-purple-200/70', w: 14, h: 64 },
  { fill: 'bg-sky-400/80', edge: 'border-sky-200/70', w: 64, h: 64 },
  { fill: 'bg-amber-400/80', edge: 'border-amber-200/70', w: 64, h: 92 },
];

export default function BaseTenBlocksDi({ data, className }: { data: BaseTenBlocksData; className?: string }) {
  const mode = (data.challenges?.[0]?.type ?? 'read_blocks') as BtMode;
  const problems = useMemo(
    () => problemsFromChallenges(data.challenges ?? [], mode),
    [data.challenges, mode],
  );
  const items = useMemo(() => itemsFromChallenges(data.challenges ?? [], mode), [data.challenges, mode]);

  const instance = useRef(data.instanceId ?? `base-ten-di-${Date.now()}`);
  const mats = useRef<Record<string, number[]>>({});
  const moves = useRef<Record<string, string[]>>({});
  const [mat, setMat] = useState<number[]>(problems[0] ? [...problems[0].start] : []);
  const [feedback, setFeedback] = useState('');
  const reduceMotion = useReducedMotion();

  const matFor = (item: BaseTenItem): BtColumns => mats.current[item.problem.id] ?? item.problem.start;

  const evaluation = usePrimitiveEvaluation<BaseTenBlocksMetrics>({
    primitiveType: 'base-ten-blocks',
    instanceId: instance.current,
    skillId: data.skillId,
    subskillId: data.subskillId,
    objectiveId: data.objectiveId,
    exhibitId: data.exhibitId,
    onSubmit: data.onEvaluationSubmit,
  });

  const pack = useMemo<JudgedScriptPack<BaseTenItem>>(() => ({
    primitiveType: 'base-ten-blocks',
    activityLine: 'read a block mat aloud and trade blocks between places',
    items,
    itemCue: (item, opts) => baseTenItemCue(item, opts, matFor(item)),
    pronounceCue: (item) => baseTenHearCue(item, matFor(item)),
    moveOnCue: (item, next, opts) => baseTenMoveOnCue(item, next, opts, next ? matFor(next) : undefined),
    completeCue: () => baseTenCompleteCue(mode),
    contextFor: (item) => contextForItem(item, moves.current[item.problem.id]?.length ?? 0),
    statusLines: {
      idle: 'Start the tutor to work with the blocks.',
      ready: (item) => item.actionContract.instruction,
      retry: (item) => (item.answerKind === 'gesture'
        ? 'Put the blocks back and try the trade again.'
        : 'Have another go out loud.'),
      noVerdict: () => 'Take your time, then say your answer.',
      affirmedNext: 'Ready for the next step.',
      affirmedLast: 'You finished the block mat.',
      done: 'Nice work with the blocks!',
    },
    diagnosisObservation: (item, { lastHeard }) => (item.answerKind === 'gesture' ? null : {
      challenge: item.actionContract.instruction,
      expected: item.step === 'worth' ? 'the place value of those blocks' : 'a number',
      observed: lastHeard ?? 'No intelligible answer.',
    }),
  }), [items]);

  const finish = (summary: JudgedRunSummary) => {
    const results = problems.map((problem) => {
      const own = summary.outcomes.filter((outcome) => outcome.id.startsWith(`${problem.id}-`));
      const score = own.length ? Math.min(...own.map((outcome) => outcome.score)) : 0;
      return {
        id: problem.id,
        mode: problem.mode,
        place: placeWord(problem.place),
        solved: own.length > 0 && own.every((outcome) => outcome.solved),
        score,
        attempts: own.reduce((sum, outcome) => sum + 1 + outcome.corrections, 0),
        moves: moves.current[problem.id] ?? [],
      };
    });
    const accuracy = results.length
      ? Math.round(results.reduce((sum, result) => sum + result.score, 0) / results.length)
      : 0;
    const attempts = results.reduce((sum, result) => sum + result.attempts, 0);
    const metrics: BaseTenBlocksMetrics = {
      type: 'base-ten-blocks',
      evalMode: mode,
      representationAccuracy: accuracy,
      regroupingCorrect: mode === 'regroup' && results.every((result) => result.solved),
      regroupCount: mode === 'regroup' ? results.filter((result) => result.solved).length : 0,
      placeValuesUsed: Array.from(new Set(results.map((result) => result.place))),
      decimalModeUsed: false,
      challengesCompleted: results.filter((result) => result.solved).length,
      totalChallenges: results.length,
      attemptsCount: attempts,
    };
    const source = [...summary.observations].reverse().find((observation) => observation.judgeFeedback)
      ?? summary.observations[summary.observations.length - 1];
    evaluation.submitResult(
      accuracy >= 60,
      accuracy,
      metrics,
      { interactionVersion: 'base-ten-di-v1', scoringBasis: 'spoken-place-value-and-traded-mat', results },
      undefined,
      accuracy < 60 && source
        ? {
          challengeSummary: source.challenge,
          expected: source.expected,
          observed: source.observed,
          judgeFeedback: source.judgeFeedback,
        }
        : undefined,
    );
  };

  const runner = useJudgedScriptRunner({
    pack,
    instanceId: instance.current,
    gradeLevel: data.gradeBand === 'K-1' ? 'kindergarten' : 'elementary',
    exhibitId: data.exhibitId,
    silenceCloseMs: 900,
    onFinished: finish,
    onItemOpened: (item, index) => {
      if (index === 0) { mats.current = {}; moves.current = {}; }
      // The mat resets at the START of a problem only: the trade the child made
      // has to still be on screen while the tutor delivers its verdict.
      if (item.step === 'count' || item.step === 'predict') {
        mats.current[item.problem.id] = [...item.problem.start];
        moves.current[item.problem.id] = [];
      }
      setMat([...matFor(item)]);
      setFeedback('');
    },
  });

  const item = runner.currentItem;
  const canTrade = !!item
    && item.step === 'trade'
    && runner.canAttempt
    && runner.cuedItemId === item.id
    && !runner.isAwaitingGesture();

  const tapBlock = (place: number) => {
    if (!item || !canTrade) return;
    const current = matFor(item);
    const next = tradeDown(current, place);
    if (!next) return;
    mats.current[item.problem.id] = next;
    (moves.current[item.problem.id] ??= []).push(`traded one ${blockNoun(place, 1)}`);
    setMat(next);
    SoundManager.tap();
    runner.loop.clearQueuedCue();
    const solved = tradeSolved(item.problem, next);
    setFeedback(solved ? '' : 'That is a different block from the one we are trading.');
    // Not correctness-gated: a wrong trade commits exactly as readily as the
    // right one, or the close is a Check button wearing a costume.
    runner.armStillness(() => {
      if (runner.isAwaitingGesture()) return;
      runner.submitGestureAttempt(baseTenCheckCue(item, next));
    }, solved ? 900 : 1500);
  };

  const undoTrade = () => {
    if (!item || !canTrade) return;
    const reset = [...item.problem.start];
    mats.current[item.problem.id] = reset;
    (moves.current[item.problem.id] ??= []).push('put the blocks back');
    setMat(reset);
    setFeedback('');
    runner.clearStillness();
    runner.loop.clearQueuedCue();
    runner.loop.queueCue(baseTenChangeCue(item, reset));
  };

  if (!item) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent>
          <p className="text-slate-300">
            No block-mat challenges are available. This activity needs numbers of at least two digits.
          </p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const problemIndex = problems.findIndex((problem) => problem.id === item.problem.id);
  const subject = item.problem.place;
  const highlightPlace = item.problem.mode === 'read_blocks' ? subject : -1;

  const column = (place: number) => {
    const count = mat[place] ?? 0;
    const style = PLACE_STYLE[place] ?? PLACE_STYLE[0];
    const tradeable = canTrade && place >= 1 && count >= 1;
    return (
      <section
        key={place}
        aria-label={`${placeWord(place)} column`}
        data-highlighted={place === highlightPlace ? 'true' : undefined}
        className={`flex min-h-44 flex-1 flex-col items-center justify-end gap-2 rounded-2xl border-2 p-2 ${
          place === highlightPlace ? 'border-amber-300 bg-amber-400/10' : 'border-white/10 bg-white/[0.03]'
        }`}
      >
        <div className="flex flex-wrap items-end justify-center gap-1">
          {Array.from({ length: count }, (_, index) => (
            <motion.button
              key={`${place}-${index}`}
              type="button"
              layout
              layoutId={`${instance.current}-${place}-${index}`}
              transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 200, damping: 26 }}
              disabled={!tradeable}
              onClick={() => tapBlock(place)}
              aria-label={tradeable
                ? `Trade one ${blockNoun(place, 1)} for ten ${blockNounPlural(place - 1)}`
                : `${blockNoun(place, 1)}`}
              className={`rounded-sm border ${style.edge} ${style.fill} disabled:cursor-default ${
                tradeable ? 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200 hover:brightness-125' : ''
              }`}
              style={{ width: style.w, height: style.h }}
            />
          ))}
        </div>
        {/* The block NAME, never the count and never the value. */}
        <span className="text-xs uppercase tracking-wide text-slate-400">{blockNounPlural(place)}</span>
      </section>
    );
  };

  const places = Array.from(
    new Set([...occupiedPlaces(mat), ...occupiedPlaces(item.problem.start)]),
  ).sort((a, b) => b - a);

  return (
    <LuminaCard className={className} surface="elevated">
      <LuminaCardHeader>
        <div className="flex items-center justify-between gap-3">
          <LuminaCardTitle>{item.problem.mode === 'regroup' ? 'Trade Ten' : 'Read the Blocks'}</LuminaCardTitle>
          <LuminaBadge accent="purple">Say it out loud</LuminaBadge>
        </div>
      </LuminaCardHeader>
      <LuminaCardContent className="space-y-5">
        {evaluation.hasSubmitted ? (
          <div className="space-y-3 text-center">
            <p className="text-xl font-semibold text-emerald-200">Nice work with the blocks!</p>
            <p className="text-slate-300">
              {item.problem.mode === 'regroup'
                ? 'You predicted each trade and then made it with your hands.'
                : 'You read each size of block and said what it was worth.'}
            </p>
          </div>
        ) : (
          <>
            <LuminaChallengeCounter current={problemIndex + 1} total={problems.length} variant="dots" />
            <LayoutGroup id={instance.current}>
              <div className="flex items-end justify-center gap-3" aria-label="Block mat">
                {places.map(column)}
              </div>
            </LayoutGroup>
            {item.step === 'trade' && (
              <div className="space-y-2">
                <div className="flex justify-center">
                  <LuminaButton size="sm" disabled={!canTrade} onClick={undoTrade}>
                    Put the blocks back
                  </LuminaButton>
                </div>
                {feedback && (
                  <p className="text-center text-sm text-amber-200" aria-live="polite">{feedback}</p>
                )}
              </div>
            )}
            <DiActionPanel
              run={runner}
              running={runner.running}
              stage={runner.stage}
              currentItem={item}
              steps={stepsOfProblem(items, item)}
              completedIds={runner.solvedIds}
              carriedIds={new Set(
                items
                  .filter((step, index) => index < runner.currentIndex && !runner.solvedIds.has(step.id))
                  .map((step) => step.id),
              )}
              startInstruction={item.problem.mode === 'regroup'
                ? 'Start the tutor, then listen for the trade you are going to make.'
                : 'Start the tutor, then listen for which blocks to read.'}
            />
            <button
              type="button"
              disabled={!runner.running}
              onClick={runner.hearStimulus}
              className="mx-auto block text-sm text-cyan-300 underline disabled:opacity-40"
            >
              Say that again
            </button>
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}
