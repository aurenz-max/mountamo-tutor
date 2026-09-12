'use client';

import React, { useMemo, useRef, useState } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardContent, LuminaBadge,
  LuminaButton, LuminaChallengeCounter } from '../../../ui';
import DiActionPanel from '../../../components/DiActionPanel';
import { usePrimitiveEvaluation } from '../../../evaluation';
import type { BalanceScaleMetrics } from '../../../evaluation/types';
import { useJudgedScriptRunner, type JudgedRunSummary } from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import { SoundManager } from '../../../utils/SoundManager';
import type { BalanceScaleData } from './BalanceScale';
import { addWeight, removeWeight, balanceState, describeBoard, equalityFeedback, equalityProblem, initialBoard,
  demonstratedBoard, isMatched, WEIGHTS, type WeightBlock, type EqualityBoard, type EqualityChange } from './balanceEqualityModel';
import { equalityItems, equalityItemCue, equalityChangeCue, equalityCheckCue, equalityCompleteCue,
  equalityHearCue, equalityMoveCue, type EqualityItem } from './balanceEqualityScript';

export default function BalanceScaleEquality({ data, className }: { data: BalanceScaleData; className?: string }) {
  const built = useMemo(() => {
    try { return { problems: (data.challenges ?? []).map(equalityProblem), error: '' }; }
    catch (error) { return { problems: [], error: error instanceof Error ? error.message : 'Invalid balance problem.' }; }
  }, [data.challenges]);
  const items = useMemo(() => equalityItems(built.problems), [built.problems]);
  const instance = useRef(data.instanceId ?? `balance-equality-${Date.now()}`);
  const boards = useRef<Record<string, EqualityBoard>>({});
  const histories = useRef<Record<string, EqualityChange[]>>({});
  const undoStacks = useRef<Record<string, EqualityBoard[]>>({});
  const helped = useRef(new Set<string>());
  const [board, setBoard] = useState<EqualityBoard>(built.problems[0] ? initialBoard(built.problems[0]) : initialBoard());
  const nextBlockId = useRef(0);
  const reduceMotion = useReducedMotion();
  const [feedback, setFeedback] = useState('Add weights on the right and watch the scale.');
  const boardFor = (item: EqualityItem) => boards.current[item.problem.id] ?? initialBoard(item.problem);
  const evaluation = usePrimitiveEvaluation<BalanceScaleMetrics>({ primitiveType: 'balance-scale',
    instanceId: instance.current, skillId: data.skillId, subskillId: data.subskillId,
    objectiveId: data.objectiveId, exhibitId: data.exhibitId, onSubmit: data.onEvaluationSubmit });

  const pack = useMemo<JudgedScriptPack<EqualityItem>>(() => ({
    primitiveType: 'balance-scale', activityLine: 'match a weight, compose the chosen weights, and infer equal weight', items,
    itemCue: (item, opts) => equalityItemCue(item, opts, boardFor(item)),
    pronounceCue: (item) => equalityHearCue(item, boardFor(item)),
    moveOnCue: (item, next) => equalityMoveCue(item, next, next ? boardFor(next) : undefined),
    completeCue: equalityCompleteCue,
    contextFor: (item) => ({
      title: data.title, challengeType: item.problem.mode, phase: item.step,
      currentChallengeIndex: String(built.problems.findIndex((problem) => problem.id === item.problem.id) + 1),
      totalChallenges: String(built.problems.length),
      currentEquation: describeBoard(item.problem, boardFor(item)),
      targetEquation: 'Match the left block, add the right weights, then infer the left weight.',
      variableValue: 'withheld; use only the current scripted judging cue', gradeBand: data.gradeBand ?? 'K-2',
      stepCount: String(histories.current[item.problem.id]?.length ?? 0),
      isSolved: String(isMatched(item.problem, boardFor(item))),
      isBalanced: String(balanceState(item.problem, boardFor(item)) === 'balanced'), attemptNumber: '0',
    }),
    statusLines: {
      idle: 'Start the tutor to explore the scale.', ready: (item) => item.actionContract.instruction,
      retry: (item) => item.step === 'build' ? 'Try changing the weights on the right.' : 'Have another go aloud.',
      noVerdict: () => 'Take your time. Tell me when you are ready.',
      affirmedNext: 'Ready for the next step.', affirmedLast: 'You finished the balance practice.',
      done: 'Nice work with the scale!',
    },
    diagnosisObservation: (item, { lastHeard }) => item.step === 'build' ? null : ({
      challenge: item.step === 'total' ? 'Add the chosen right-side weights.' : 'Infer the left weight from equal balance.',
      expected: String(item.problem.target), observed: lastHeard ?? 'No intelligible number.',
    }),
  }), [items, built.problems, data.title, data.gradeBand]);

  const finish = (summary: JudgedRunSummary) => {
    const results = built.problems.map((problem) => {
      const build = summary.outcomes.find((outcome) => outcome.id === `${problem.id}-build`);
      const total = summary.outcomes.find((outcome) => outcome.id === `${problem.id}-total`);
      const inference = summary.outcomes.find((outcome) => outcome.id === `${problem.id}-infer`);
      return { id: problem.id, mode: problem.mode, solved: !!total?.solved && !!inference?.solved,
        score: Math.min(total?.score ?? 0, inference?.score ?? 0),
        attempts: (total ? 1 + total.corrections : 0) + (inference ? 1 + inference.corrections : 0),
        build, total, inference, demonstrationUsed: helped.current.has(problem.id),
        moves: histories.current[problem.id] ?? [], finalBoard: boards.current[problem.id] };
    });
    const accuracy = results.length ? Math.round(results.reduce((sum, result) => sum + result.score, 0) / results.length) : 0;
    const attempts = results.reduce((sum, result) => sum + result.attempts, 0);
    const mode = built.problems[0]?.mode ?? 'equality';
    const metrics: BalanceScaleMetrics = { type: 'balance-scale', evalMode: mode, challengeType: mode,
      totalChallenges: results.length, correctCount: results.filter((result) => result.solved).length,
      attemptsCount: attempts, firstTryCount: results.filter((result) => result.score === 100).length,
      hintsViewed: helped.current.size, overallAccuracy: accuracy,
      averageAttemptsPerChallenge: attempts / Math.max(1, results.length) };
    const source = [...summary.observations].reverse().find((observation) => observation.judgeFeedback)
      ?? summary.observations[summary.observations.length - 1];
    evaluation.submitResult(accuracy >= 60, accuracy, metrics,
      { interactionVersion: 'match-compose-infer-di-v2', scoringBasis: 'spoken-sum-and-weight-inference',
        explorationIsUngraded: true, results }, undefined,
      accuracy < 60 && source ? { challengeSummary: source.challenge, expected: source.expected,
        observed: source.observed, judgeFeedback: source.judgeFeedback } : undefined);
  };

  const runner = useJudgedScriptRunner({ pack, instanceId: instance.current,
    gradeLevel: data.gradeLevel ?? 'elementary', exhibitId: data.exhibitId, silenceCloseMs: 1100, onFinished: finish,
    onItemOpened: (item, index) => {
      if (index === 0) { boards.current = {}; histories.current = {}; undoStacks.current = {}; helped.current.clear(); }
      if (item.step === 'build') {
        boards.current[item.problem.id] = initialBoard(item.problem);
        histories.current[item.problem.id] = [];
        undoStacks.current[item.problem.id] = [];
        nextBlockId.current = 0;
        setFeedback('Add weights on the right and watch the scale.');
      } else if (item.step === 'total' && !isMatched(item.problem, boardFor(item))) {
        boards.current[item.problem.id] = demonstratedBoard(item.problem);
        helped.current.add(item.problem.id);
        setFeedback('The tutor placed a matching set of weights.');
      }
      setBoard(boardFor(item));
    },
  });
  const item = runner.currentItem;
  const canChange = !!item && item.step === 'build' && runner.canAttempt
    && runner.cuedItemId === item.id && !runner.isAwaitingGesture();

  const publishBoard = (next: EqualityBoard, description: string, pushUndo = true) => {
    if (!item || !canChange || runner.isAwaitingGesture()) return;
    const previous = boardFor(item);
    if (previous.blocks.length === next.blocks.length && previous.blocks.every((block, index) => block.id === next.blocks[index].id)) return;
    if (pushUndo) (undoStacks.current[item.problem.id] ??= []).push({ ...previous });
    const change = { before: previous, after: next, description };
    (histories.current[item.problem.id] ??= []).push(change);
    boards.current[item.problem.id] = next;
    setBoard(next);
    setFeedback(equalityFeedback(item.problem, next));
    runner.loop.clearQueuedCue();
    // Wait for settled hands; only an exact match commits. Other moves are coaching.
    runner.armStillness(() => {
      if (runner.isAwaitingGesture()) return;
      if (isMatched(item.problem, next)) runner.submitGestureAttempt(equalityCheckCue(item, next));
      else runner.loop.queueCue(equalityChangeCue(item, next));
    }, isMatched(item.problem, next) ? 900 : 1800);
    SoundManager.tap();
  };
  const place = (value: number) => {
    if (!item || !canChange) return;
    const next = addWeight(boardFor(item), value, nextBlockId.current++);
    if (next) publishBoard(next, `Added a ${value} weight to the right`);
  };
  const remove = (id: number) => {
    if (!item || !canChange) return;
    const current = boardFor(item);
    const block = current.blocks.find((entry) => entry.id === id);
    if (block) publishBoard(removeWeight(current, id), `Removed a ${block.value} weight from the right`);
  };

  if (!item || built.error) return <LuminaCard className={className}><LuminaCardContent>
    <p>{built.error || 'No equality challenges are available.'}</p>
  </LuminaCardContent></LuminaCard>;
  const state = balanceState(item.problem, board);
  const tilt = state === 'left-heavy' ? -7 : state === 'right-heavy' ? 7 : 0;
  const equationIndex = built.problems.findIndex((problem) => problem.id === item.problem.id);

  const gathered = item.step !== 'build';
  const drawBlock = (block: WeightBlock) => <motion.button key={block.id} type="button"
    layoutId={`${item.problem.id}-weight-${block.id}`} layout
    transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 180, damping: 24 }}
    disabled={!canChange} onClick={() => remove(block.id)}
    aria-label={`Remove ${block.value} weight, block ${block.id}`}
    className="flex min-h-11 min-w-11 flex-col items-center justify-end gap-1 rounded-md p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200 disabled:cursor-default">
    <span aria-hidden="true" className="block w-9 rounded-sm border border-cyan-200/60 bg-cyan-400/70"
      style={{ height: block.value * 8 }} />
    <span className="font-semibold text-cyan-100">{block.value}</span>
  </motion.button>;

  return <LuminaCard className={className} surface="elevated">
    <LuminaCardHeader><div className="flex items-center justify-between gap-3">
      <LuminaCardTitle>Weigh It Together</LuminaCardTitle>
      <LuminaBadge accent="purple">Balance &amp; add</LuminaBadge>
    </div></LuminaCardHeader>
    <LuminaCardContent className="space-y-5">
      {evaluation.hasSubmitted ? <div className="space-y-3 text-center">
        <p className="text-xl font-semibold text-emerald-200">Nice work with the scale!</p>
        <p className="text-slate-300">You matched weights and used equal balance to find the other weight.</p>
      </div> : <>
        <LuminaChallengeCounter current={equationIndex + 1} total={built.problems.length} variant="dots" />
        {helped.current.has(item.problem.id) && <p className="text-center text-amber-200">Tutor's example: a matching set of weights.</p>}
        <LayoutGroup id={instance.current}>
          <div className="relative px-2 pb-6" aria-label="Balance scale workspace">
            <div className="grid grid-cols-2 items-end gap-5">
              <section aria-label="left pan" className="flex min-h-56 flex-col items-center justify-end gap-3 pb-3 transition-transform duration-500 motion-reduce:transition-none"
                style={{ transform: `translateY(${state === 'left-heavy' ? 12 : state === 'right-heavy' ? -12 : 0}px)` }}>
                <div aria-label="Left weight; number hidden" className="w-9 rounded-sm border border-purple-200/70 bg-purple-400/70"
                  style={{ height: item.problem.target * 8 }} />
                <span className="text-sm text-purple-200">Left weight</span>
                <div className="h-2 w-full rounded-b-xl bg-purple-300/70" />
              </section>
              <section aria-label="right pan" className="flex min-h-56 flex-col items-center justify-end gap-3 pb-3 transition-transform duration-500 motion-reduce:transition-none"
                style={{ transform: `translateY(${state === 'right-heavy' ? 12 : state === 'left-heavy' ? -12 : 0}px)` }}>
                <div className="flex min-h-20 flex-wrap items-end justify-center gap-2">
                  {!gathered ? board.blocks.map(drawBlock) : <span className="text-sm text-cyan-200">Matched with the blocks below</span>}
                </div>
                {!board.blocks.length && <span className="text-sm text-slate-400">Place weights here</span>}
                <span className="text-sm text-cyan-200">Right weights</span>
                <div className="h-2 w-full rounded-b-xl bg-cyan-300/70" />
              </section>
            </div>
            <div aria-label="Balance beam" className="mx-auto h-2 w-full rounded-full bg-slate-300 transition-transform duration-500 motion-reduce:transition-none"
              style={{ transform: `rotate(${tilt}deg)` }} />
            <div className="mx-auto h-7 w-3 bg-slate-500" />
            <div className="mx-auto h-2 w-24 rounded-full bg-slate-500" />
          </div>
          <p className="text-center font-medium text-cyan-200" aria-live="polite">
            {state === 'balanced' ? 'Balanced - equal weight' : state === 'left-heavy' ? 'Left side is heavier' : 'Right side is heavier'}
          </p>
          {gathered && <section aria-label="Add your right-side weights" className="space-y-3 rounded-2xl border border-cyan-300/30 p-4">
            <p className="text-center text-sm text-cyan-200">Your right-side weights, together</p>
            <div className="flex flex-wrap items-end justify-center gap-1">
              {board.blocks.map((block, index) => <React.Fragment key={block.id}>
                {index > 0 && <span aria-hidden="true" className="pb-3 text-xl text-slate-300">+</span>}
                {drawBlock(block)}
              </React.Fragment>)}
              <span aria-hidden="true" className="pb-3 text-xl text-slate-300">=</span>
              <span className="pb-3 text-sm text-cyan-200">{item.step === 'total' ? 'Say the total' : item.problem.target}</span>
            </div>
            {item.step === 'infer' && <p className="text-center text-purple-200">Balanced sides have equal weight.</p>}
          </section>}
        </LayoutGroup>
        {item.step === 'build' && <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-center gap-3" aria-label="Weight tray">
            {WEIGHTS.map((value) => <button key={value} type="button" disabled={!canChange || !addWeight(board, value, nextBlockId.current)}
              onClick={() => place(value)} aria-label={`Add ${value} weight`}
              className="flex min-h-20 min-w-14 flex-col items-center justify-end gap-2 rounded-xl border border-cyan-300/30 p-2 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">
              <span aria-hidden="true" className="w-9 rounded-sm border border-cyan-200/60 bg-cyan-400/70" style={{ height: value * 8 }} />
              <span className="font-semibold text-cyan-100">{value}</span>
            </button>)}
          </div>
          <div className="flex justify-center gap-2">
            <LuminaButton size="sm" disabled={!canChange || !undoStacks.current[item.problem.id]?.length} onClick={() => {
              if (!canChange || runner.isAwaitingGesture()) return;
              const previous = undoStacks.current[item.problem.id]?.pop();
              if (previous) publishBoard(previous, 'Undid the last change', false);
            }}>Undo</LuminaButton>
            <LuminaButton size="sm" disabled={!canChange || !board.blocks.length}
              onClick={() => publishBoard(initialBoard(), 'Cleared the right pan')}>Clear weights</LuminaButton>
          </div>
          <p className="text-center text-sm text-slate-300" aria-live="polite">{feedback}</p>
        </div>}
        <DiActionPanel run={runner} running={runner.running} stage={runner.stage} currentItem={item}
          steps={items.filter((step) => step.problem.id === item.problem.id)} completedIds={runner.solvedIds}
          carriedIds={new Set(items.filter((step, index) => index < runner.currentIndex && !runner.solvedIds.has(step.id)).map((step) => step.id))}
          startInstruction="Start the tutor, then put weights on the right to balance the scale." />
        <button type="button" disabled={!runner.running} onClick={runner.hearStimulus}
          className="block mx-auto text-sm text-cyan-300 underline disabled:opacity-40">Say that again</button>
      </>}
    </LuminaCardContent>
  </LuminaCard>;
}
