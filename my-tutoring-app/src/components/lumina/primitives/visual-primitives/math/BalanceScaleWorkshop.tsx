'use client';

import React, { useMemo, useRef, useState } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardContent, LuminaBadge, LuminaButton,
  LuminaChallengeCounter, LuminaPanel } from '../../../ui';
import DiActionPanel from '../../../components/DiActionPanel';
import { usePrimitiveEvaluation } from '../../../evaluation';
import type { BalanceScaleMetrics } from '../../../evaluation/types';
import { useJudgedScriptRunner, type JudgedRunSummary } from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import { SoundManager } from '../../../utils/SoundManager';
import type { BalanceScaleData } from './BalanceScale';
import { enterWorkshopStage, groupCounts, initialWorkshopBoard, isHands, moveWorkshopUnit,
  placeWorkshopWeight, removeWorkshopWeight, scene, separated, shared, stageSolved, STAGES, TITLES, TRAY,
  workshopBalance, workshopExpected, workshopFeedback, workshopProblem, type WorkshopBoard, type WorkshopWeight } from './balanceWorkshopModel';
import { workshopItems, workshopItemCue, workshopMoveCue, workshopCompleteCue, workshopHearCue, workshopChangeCue,
  workshopCheckCue, workshopAsk, type WorkshopItem } from './balanceWorkshopScript';

export default function BalanceScaleWorkshop({ data, className }: { data: BalanceScaleData; className?: string }) {
  const built = useMemo(() => {
    try { return { problems: (data.challenges ?? []).map(workshopProblem), error: '' }; }
    catch (error) { return { problems: [], error: error instanceof Error ? error.message : 'Invalid weight activity.' }; }
  }, [data.challenges]);
  const items = useMemo(() => workshopItems(built.problems), [built.problems]);
  const instance = useRef(data.instanceId ?? `balance-workshop-${Date.now()}`);
  const boards = useRef<Record<string, WorkshopBoard>>({});
  const moves = useRef<Record<string, { before: WorkshopBoard; after: WorkshopBoard; description: string }[]>>({});
  const undo = useRef<WorkshopBoard[]>([]);
  const modeled = useRef(new Set<string>());
  const nextId = useRef(0);
  const [board, setBoard] = useState<WorkshopBoard>(() => built.problems[0] ? initialWorkshopBoard(built.problems[0])
    : { weights: [], first: [], leftAside: false, units: [] });
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('Move the weights and watch what changes.');
  const reduced = useReducedMotion();
  const boardFor = (item: WorkshopItem) => boards.current[item.problem.id] ?? initialWorkshopBoard(item.problem);
  const evaluation = usePrimitiveEvaluation<BalanceScaleMetrics>({ primitiveType: 'balance-scale', instanceId: instance.current,
    skillId: data.skillId, subskillId: data.subskillId, objectiveId: data.objectiveId, exhibitId: data.exhibitId, onSubmit: data.onEvaluationSubmit });
  const pack = useMemo<JudgedScriptPack<WorkshopItem>>(() => ({
    primitiveType: 'balance-scale', activityLine: 'build, separate and share real weights; then explain their quantities', items,
    itemCue: (item, opts) => workshopItemCue(item, opts, boardFor(item)),
    pronounceCue: (item) => workshopHearCue(item, boardFor(item)),
    moveOnCue: (item, next) => workshopMoveCue(item, next, next ? boardFor(next) : boardFor(item)),
    completeCue: workshopCompleteCue,
    contextFor: (item) => ({ title: TITLES[item.problem.mode], challengeType: item.problem.mode, phase: item.step,
      currentChallengeIndex: String(built.problems.indexOf(item.problem) + 1), totalChallenges: String(built.problems.length),
      targetEquation: 'Use the current scripted weight task.', currentEquation: scene(item.problem, boardFor(item)),
      variableValue: 'withheld; use the current private judging cue only', gradeBand: data.gradeBand ?? '3-4',
      stepCount: String(moves.current[item.problem.id]?.length ?? 0), isBalanced: String(workshopBalance(item.problem, boardFor(item)) === 'balanced'),
      isSolved: 'Use the current code-computed check cue', attemptNumber: '0' }),
    statusLines: { idle: 'Start the tutor to work with the weights.', ready: (item) => workshopAsk(item.problem, item.step),
      retry: (item) => isHands(item.step) ? 'Try another move with the weights.' : 'Have another go aloud.',
      noVerdict: () => 'Take your time.', affirmedNext: 'Ready for the next part.', affirmedLast: 'You finished the weight activity.', done: 'Nice work!' },
    diagnosisObservation: (item, { lastHeard }) => isHands(item.step) || item.step === 'explain' ? null : ({
      challenge: workshopAsk(item.problem, item.step), expected: String(workshopExpected(item.problem, item.step)),
      observed: lastHeard ?? 'No intelligible response.' }),
  }), [items, built.problems, data.gradeBand]);
  const finish = (summary: JudgedRunSummary) => {
    const results = built.problems.map((problem) => {
      const outcomes = items.filter((item) => item.problem.id === problem.id).map((item) => ({ step: item.step,
        ...summary.outcomes.find((outcome) => outcome.id === item.id) }));
      const numeric = outcomes.filter((outcome) => !isHands(outcome.step) && outcome.step !== 'explain');
      return { id: problem.id, mode: problem.mode, score: Math.min(...numeric.map((outcome) => outcome.score ?? 0)),
        solved: numeric.length > 0 && numeric.every((outcome) => outcome.solved),
        attempts: numeric.reduce((sum, outcome) => sum + (outcome.id ? 1 + (outcome.corrections ?? 0) : 0), 0),
        outcomes, moves: moves.current[problem.id] ?? [], finalBoard: boards.current[problem.id],
        modeledSteps: items.filter((item) => item.problem.id === problem.id && modeled.current.has(item.id)).map((item) => item.step) };
    });
    const score = Math.round(results.reduce((sum, result) => sum + result.score, 0) / Math.max(1, results.length));
    const attempts = results.reduce((sum, result) => sum + result.attempts, 0);
    const mode = built.problems[0]?.mode ?? 'one_step';
    const metrics: BalanceScaleMetrics = { type: 'balance-scale', evalMode: mode, challengeType: mode,
      totalChallenges: results.length, correctCount: results.filter((result) => result.solved).length, overallAccuracy: score,
      attemptsCount: attempts, firstTryCount: results.filter((result) => result.score === 100).length,
      hintsViewed: modeled.current.size, averageAttemptsPerChallenge: attempts / Math.max(1, results.length) };
    const observation = [...summary.observations].reverse().find((entry) => entry.judgeFeedback);
    evaluation.submitResult(score >= 60, score, metrics, { interactionVersion: 'weight-workshop-di-v1', explorationIsUngraded: true,
      explanationIsCoaching: true, scoringBasis: 'minimum-of-distinct-spoken-quantities', results }, undefined,
    score < 60 && observation ? { challengeSummary: observation.challenge, expected: observation.expected,
      observed: observation.observed, judgeFeedback: observation.judgeFeedback } : undefined);
  };
  const runner = useJudgedScriptRunner({ pack, instanceId: instance.current, gradeLevel: data.gradeLevel ?? 'elementary',
    exhibitId: data.exhibitId, silenceCloseMs: 1100, onFinished: finish,
    onItemOpened: (item, index) => {
      if (index === 0) { boards.current = {}; moves.current = {}; modeled.current.clear(); }
      if (item.step === STAGES[item.problem.mode][0]) {
        boards.current[item.problem.id] = initialWorkshopBoard(item.problem); moves.current[item.problem.id] = []; nextId.current = 0;
      }
      const prepared = enterWorkshopStage(item.problem, item.step, boardFor(item));
      boards.current[item.problem.id] = prepared.board;
      if (prepared.modeled) modeled.current.add(item.id);
      undo.current = []; setSelected(null); setBoard(prepared.board);
      setFeedback(isHands(item.step) ? workshopFeedback(item.problem, item.step, prepared.board) : '');
    },
  });
  const item = runner.currentItem;
  const canMove = !!item && isHands(item.step) && runner.canAttempt && runner.cuedItemId === item.id && !runner.isAwaitingGesture();
  const publish = (next: WorkshopBoard | null, description: string, saveUndo = true) => {
    if (!next || !item || !canMove || runner.isAwaitingGesture()) return;
    const previous = boardFor(item);
    if (JSON.stringify(previous) === JSON.stringify(next)) return;
    if (saveUndo) undo.current.push(previous);
    (moves.current[item.problem.id] ??= []).push({ before: previous, after: next, description });
    boards.current[item.problem.id] = next; setBoard(next); setSelected(null);
    setFeedback(workshopFeedback(item.problem, item.step, next));
    runner.loop.clearQueuedCue();
    runner.armStillness(() => {
      if (runner.isAwaitingGesture()) return;
      if (stageSolved(item.problem, item.step, next)) runner.submitGestureAttempt(workshopCheckCue(item, next));
      else runner.loop.queueCue(workshopChangeCue(item, next));
    }, stageSolved(item.problem, item.step, next) ? 900 : 1800);
    SoundManager.tap();
  };
  const moveUnit = (index: number, destination: number) => {
    if (!item || !canMove) return;
    publish(moveWorkshopUnit(item.problem, boardFor(item), index, destination, item.step), `Moved unit ${index + 1} to ${destination === -2 ? 'set aside' : destination === -1 ? 'pool' : `group ${destination + 1}`}`);
  };
  if (!item || built.error) return <LuminaCard className={className}><LuminaCardContent>{built.error || 'No weight challenges are available.'}</LuminaCardContent></LuminaCard>;
  const p = item.problem;
  const state = workshopBalance(p, board);
  const grouping = p.parcels > 1 && ['share', 'each', 'infer', 'explain'].includes(item.step);
  const gathering = p.parcels === 1 && !isHands(item.step);
  const animation = reduced ? { duration: 0 } : { type: 'spring' as const, stiffness: 190, damping: 25 };
  const weightVisual = (value: number, purple = false) => <span aria-hidden="true"
    className={`block w-9 rounded-sm border ${purple ? 'border-purple-200 bg-purple-400/70' : 'border-cyan-200 bg-cyan-400/70'}`}
    style={{ height: value * 4 }} />;
  const weight = (block: WorkshopWeight) => <motion.button key={block.id} type="button" layout layoutId={`${p.id}-weight-${block.id}`}
    transition={animation} disabled={!canMove} onClick={() => publish(removeWorkshopWeight(boardFor(item), block.id), `Removed weight ${block.value}`)}
    aria-label={`Remove ${block.value} weight, block ${block.id}`} className="flex min-h-11 min-w-11 flex-col items-center justify-end gap-1 rounded-lg p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">
    {weightVisual(block.value)}<span className="font-semibold text-cyan-100">{block.value}</span>
  </motion.button>;
  const unit = (index: number) => <motion.button key={index} layout layoutId={`${p.id}-unit-${index}`} transition={animation}
    type="button" draggable={canMove && item.step === 'share' && board.units[index] !== -2}
    onDragStartCapture={(event) => { if (!canMove) return; event.dataTransfer.setData('text/plain', String(index)); setSelected(index); }}
    disabled={!canMove || (item.step === 'share' && board.units[index] === -2)} aria-label={`Unit ${index + 1}${board.units[index] === -2 ? ', set aside' : ''}`}
    aria-pressed={selected === index} onClick={() => {
      if (!canMove) return;
      if (item.step === 'separate') moveUnit(index, board.units[index] === -2 ? -1 : -2);
      else if (board.units[index] >= 0) moveUnit(index, -1);
      else setSelected(selected === index ? null : index);
    }} className={`flex h-11 w-11 items-center justify-center rounded-lg border text-sm ${selected === index
      ? 'border-amber-200 bg-amber-400/30 text-white' : 'border-cyan-200/40 bg-cyan-400/15 text-cyan-100'}`}>1</motion.button>;
  const parcel = (index: number) => <div key={index} aria-label={`Sealed parcel ${index + 1}`} className="flex h-14 w-12 shrink-0 items-center justify-center rounded-lg border border-purple-200/60 bg-purple-500/30">
    <span aria-hidden="true" className="h-full w-2 bg-purple-200/30" />
  </div>;
  const dropUnit = (event: React.DragEvent, destination: number) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData('text/plain');
    if (!/^\d+$/.test(raw)) return;
    moveUnit(Number(raw), destination);
  };
  return <LuminaCard className={className} surface="elevated">
    <LuminaCardHeader><div className="flex items-center justify-between gap-3"><LuminaCardTitle>{TITLES[p.mode]}</LuminaCardTitle>
      <LuminaBadge accent="purple">Hands + voice</LuminaBadge></div></LuminaCardHeader>
    <LuminaCardContent className="space-y-5">
      {evaluation.hasSubmitted ? <p className="text-center text-xl text-emerald-200">You built the math with weights. Nice work!</p> : <>
        <LuminaChallengeCounter current={built.problems.indexOf(p) + 1} total={built.problems.length} variant="dots" />
        {items.some((entry) => entry.problem.id === p.id && modeled.current.has(entry.id)) && <p className="text-center text-amber-200">Tutor's example includes a demonstrated step.</p>}
        <LayoutGroup id={instance.current}>
          <div aria-label="Balance scale workspace" className="px-2 pb-4">
            <div className="grid grid-cols-2 items-end gap-5">
              <section aria-label="left pan" className="flex min-h-48 flex-col items-center justify-end gap-3 pb-3 transition-transform motion-reduce:transition-none"
                style={{ transform: `translateY(${state === 'left-heavy' ? 10 : state === 'right-heavy' ? -10 : 0}px)` }}>
                {p.mode === 'equality_hard' ? <div aria-label="Unnumbered left weight">{weightVisual(p.target, true)}</div>
                  : p.mode === 'one_step' ? <>
                    <div aria-label={`Known left weight ${p.known}`} className="flex flex-col items-center gap-1">{weightVisual(p.known, true)}<span>{p.known}</span></div>
                    {!gathering ? <div className="flex flex-wrap items-end justify-center gap-1">{board.weights.map(weight)}</div>
                      : <p className="text-center text-xs text-cyan-200">Added weights shown below</p>}
                  </> : <>
                    <div className="flex flex-wrap justify-center gap-2">{Array.from({ length: p.parcels }, (_, index) => parcel(index))}</div>
                    <p className="text-center text-xs text-purple-200">{p.parcels} identical parcels</p>
                    {p.known > 0 && !board.leftAside && <button type="button" aria-label={`Set aside known ${p.known} weight`} disabled={!canMove || item.step !== 'separate'}
                      onClick={() => publish({ ...boardFor(item), leftAside: true }, `Set aside the known ${p.known} weight`)} className="flex min-h-11 min-w-11 flex-col items-center gap-1 rounded-lg border border-purple-200/40 p-2">
                      {weightVisual(p.known, true)}<span>{p.known}</span></button>}
                  </>}
                <div className="h-2 w-full rounded-b-xl bg-purple-300/70" />
              </section>
              <section aria-label="right pan" className="flex min-h-48 flex-col items-center justify-end gap-3 pb-3 transition-transform motion-reduce:transition-none"
                style={{ transform: `translateY(${state === 'right-heavy' ? 10 : state === 'left-heavy' ? -10 : 0}px)` }}>
                {p.mode === 'one_step' ? <div aria-label={`Known right weight ${p.total}`} className="flex flex-col items-center gap-1">{weightVisual(p.total)}<span>{p.total}</span></div>
                  : p.mode === 'equality_hard' ? <div className="flex min-h-20 flex-wrap items-end justify-center gap-1">{gathering
                    ? <p className="text-center text-xs text-cyan-200">Matched weights shown below</p> : board.weights.map(weight)}</div>
                  : <>{!grouping && <div aria-label="Right weight units" className="flex flex-wrap justify-center gap-1">{board.units.map((place, index) => place === -1 ? unit(index) : null)}</div>}
                    <p className="text-center text-xs text-cyan-200">{grouping ? 'Matching units are in the groups below' : `Original weight: ${p.total}`}</p></>}
                <div className="h-2 w-full rounded-b-xl bg-cyan-300/70" />
              </section>
            </div>
            <div aria-label="Balance beam" className="h-2 w-full rounded-full bg-slate-300 transition-transform motion-reduce:transition-none"
              style={{ transform: `rotate(${state === 'left-heavy' ? -6 : state === 'right-heavy' ? 6 : 0}deg)` }} />
            <div className="mx-auto h-6 w-3 bg-slate-500" /><div className="mx-auto h-2 w-24 rounded-full bg-slate-500" />
          </div>
          <p className="text-center text-cyan-200" aria-live="polite">{state === 'balanced' ? 'Balanced - equal weight' : state === 'left-heavy' ? 'Left side is heavier' : 'Right side is heavier'}</p>
          {p.known > 0 && p.parcels > 1 && <div className="grid grid-cols-2 gap-3" aria-label="Known weights set aside">
            <LuminaPanel><p className="mb-2 text-sm text-purple-200">Set aside from left</p>{board.leftAside && <LuminaButton size="sm" disabled={!canMove || item.step !== 'separate'}
              onClick={() => publish({ ...boardFor(item), leftAside: false }, 'Returned the known weight to the left')}>Return {p.known} weight</LuminaButton>}</LuminaPanel>
            <LuminaPanel><p className="mb-2 text-sm text-cyan-200">Set aside from right</p><div className="flex flex-wrap gap-1">{board.units.map((place, index) => place === -2 ? unit(index) : null)}</div></LuminaPanel>
          </div>}
          {grouping && <div className="space-y-3">
            <section aria-label="Unshared weight units" onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropUnit(event, -1)} className="rounded-xl border border-cyan-300/30 p-3">
              <p className="mb-2 text-sm text-cyan-200">Weight to share</p><div className="flex flex-wrap gap-1">{board.units.map((place, index) => place === -1 ? unit(index) : null)}</div>
              {!board.units.includes(-1) && <p className="text-sm text-slate-400">All units are in groups.</p>}
            </section>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {groupCounts(p, board).map((count, group) => <section key={group} aria-label={`Parcel group ${group + 1}`} onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => dropUnit(event, group)} className="space-y-2 rounded-xl border border-purple-300/30 p-3">
                <button type="button" aria-label={`Place unit in group ${group + 1}`} disabled={!canMove || item.step !== 'share' || !board.units.includes(-1)}
                  onClick={() => { const index = selected !== null && board.units[selected] === -1 ? selected : board.units.indexOf(-1); if (index >= 0) moveUnit(index, group); }}
                  className="flex w-full flex-col items-center gap-2 rounded-lg p-2 focus-visible:outline focus-visible:outline-purple-200">
                  {parcel(group)}<span className="text-sm text-purple-200">Group {group + 1}</span>
                </button>
                <div className="flex flex-wrap gap-1">{board.units.map((place, index) => place === group ? unit(index) : null)}</div>
                {data.supportTier === 'easy' && <p className="text-sm text-cyan-200">{count} units</p>}
              </section>)}
            </div>
          </div>}
          {p.mode === 'equality_hard' && board.first.length > 0 && <LuminaPanel><p className="text-sm text-purple-200">Your first combination</p>
            <p className="mt-1 text-center">{board.first.map((block) => block.value).join(' + ')}</p></LuminaPanel>}
          {gathering && <section aria-label="Chosen weights addition" className="rounded-xl border border-cyan-300/30 p-4">
            <p className="mb-3 text-center text-sm text-cyan-200">{p.mode === 'one_step' ? 'Just the weights you added' : 'Your chosen weights'}</p>
            <div className="flex flex-wrap items-end justify-center gap-1">{board.weights.map((block, index) => <React.Fragment key={block.id}>
              {index > 0 && <span className="pb-3">+</span>}{weight(block)}</React.Fragment>)}<span className="pb-3">=</span>
              <span className="pb-3 text-cyan-200">{['relate', 'infer'].includes(item.step) ? p.target : 'Say the total'}</span></div>
          </section>}
        </LayoutGroup>
        {p.mode === 'two_step' && <LuminaPanel><p className="text-sm text-purple-200">Your moves as an equation - x means one parcel</p>
          <div aria-label="Equation notebook" className="mt-2 space-y-2 text-center font-mono text-lg">
            <p>{p.parcels}x + {p.known} = {p.total}</p>
            {separated(p, board) && <><p className="text-sm text-slate-400">Subtract {p.known} from both sides</p><p>{p.parcels}x = {p.total - p.known}</p></>}
            {shared(p, board) && <><p className="text-sm text-slate-400">Divide both sides into {p.parcels} equal groups</p>
              <p>x = {['infer', 'explain'].includes(item.step) ? p.target : 'one group'}</p></>}
          </div></LuminaPanel>}
        {canMove && p.parcels === 1 && <div aria-label="Weight tray" className="flex flex-wrap items-end justify-center gap-2">
          {TRAY.map((value) => <button key={value} type="button" aria-label={`Add ${value} weight`} disabled={!placeWorkshopWeight(board, value, nextId.current)}
            onClick={() => publish(placeWorkshopWeight(boardFor(item), value, nextId.current++), `Added ${value} weight`)} className="flex min-h-16 min-w-14 flex-col items-center justify-end gap-1 rounded-xl border border-cyan-300/40 p-2 disabled:opacity-40">
            {weightVisual(value)}<span>{value}</span></button>)}
        </div>}
        {isHands(item.step) && <div className="space-y-3"><div className="flex justify-center gap-2">
          <LuminaButton size="sm" disabled={!canMove || !undo.current.length} onClick={() => { if (!canMove || runner.isAwaitingGesture()) return; publish(undo.current.pop() ?? null, 'Undid the last move', false); }}>Undo</LuminaButton>
          <LuminaButton size="sm" disabled={!canMove} onClick={() => {
            const current = boardFor(item);
            publish(item.step === 'share' ? { ...current, units: current.units.map((place) => place === -2 ? -2 : -1) }
              : item.step === 'separate' ? { ...current, leftAside: false, units: current.units.map(() => -1) }
                : { ...current, weights: [] }, 'Reset this step');
          }}>Reset this step</LuminaButton>
        </div><p className="text-center text-sm text-slate-300" aria-live="polite">{feedback}</p></div>}
        <DiActionPanel run={runner} running={runner.running} stage={runner.stage} currentItem={item}
          steps={items.filter((step) => step.problem.id === p.id)} completedIds={runner.solvedIds}
          carriedIds={new Set(items.filter((step, index) => index < runner.currentIndex && !runner.solvedIds.has(step.id)).map((step) => step.id))}
          startInstruction="Start the tutor, then work with the weights." />
        <button type="button" disabled={!runner.running} onClick={runner.hearStimulus} className="mx-auto block text-sm text-cyan-300 underline disabled:opacity-40">Say that again</button>
      </>}
    </LuminaCardContent>
  </LuminaCard>;
}
