'use client';

/**
 * DiWordProblemSetup — the "name the problem, build the family" pack (design brief 2026-09-07 "DI for Older
 * Learners", concept 4), and the family's first math pack to MIX hands and voice inside one problem.
 *
 * WHAT THE CHILD DOES. Sees the story printed. The entry mode asks for one big-amount placement; family modes
 * ask the child to build small + small = big by dragging all three story parts WITH THEIR HANDS. The setup
 * commits on stillness. Then, where the mode calls for it, the child reads the family aloud, chooses an
 * operation, and solves.
 *
 * The Live tutor teaches it on the shared tutor/JEV workspace (workspace rollout C6; the judged runner is
 * gone, one-path ruling 09-23): the placement is checked by the activity (`commitGesture`), the spoken steps
 * are judged by the observer, and the runtime owns progression. An unbound mount shows the shared "needs the
 * tutor" card.
 *
 * THE SCREEN ONLY FOLLOWS — AND HERE IT SCRIBES. Every credited step draws itself: the three story parts lock
 * into the family, the sign appears, the answer fills the box, and the bar model grows underneath. Nothing the
 * child must say or place is drawn before they do it, which is why every mark is keyed to credited item ids. A
 * wrong answer no longer closes a step, so there is no tutor-carried mark to draw.
 */

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaChallengeCounter,
  LuminaChip,
  LuminaDropZone,
  LuminaPrompt,
  type DropZoneState,
} from '../../../ui';
import { usePrimitiveEvaluation } from '../../../evaluation';
import type { DiWordProblemSetupMetrics, PrimitiveEvaluationResult } from '../../../evaluation/types';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { commitGesture, useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { useStimulusPipSurface } from '../../../pip/useStimulusPipSurface';
import { SoundManager } from '../../../utils/SoundManager';
import { SHAPE_WORD, type Quantity } from './diWordProblemPlan';
import type { DiWordProblemSetupData, WordProblemItem, WordProblemStepKind } from './diWordProblemScript';
import { boardComplete, bigSlotMatches, describePlacement, wordProblemAssignment, wordProblemItems, wordProblemScene,
  type FamilyPlacements } from './diWordProblemWorkspace';

export type {
  DiWordProblemSetupData,
  WordProblemChallengeType,
  WordProblemItem,
  WordProblemProblemSpec,
  WordProblemSupportTier,
} from './diWordProblemScript';

/** Stillness that commits a completed hands action. The window is short enough to revise a placement and
 *  never acts like a Check button in costume. */
const BIG_SETTLE_MS = 1800;

type FamilySlot = keyof FamilyPlacements;
const emptyBoard = (): FamilyPlacements => ({ small1: null, small2: null, big: null });

export interface DiWordProblemSetupProps {
  data: DiWordProblemSetupData & { onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DiWordProblemSetupMetrics>) => void };
  index?: number;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED eval mode from the live mount; never rebuilt from a label. */
  runtimeEvalMode?: string;
}

const DiWordProblemSetupSurface: React.FC<DiWordProblemSetupProps> = ({ data, className, runtimePlanItemId, runtimeEvalMode }) => {
  const items = useMemo(() => wordProblemItems(data), [data]);
  const stableInstanceId = useRef(data.instanceId || `di-word-problem-setup-${Math.round(performance.now())}`);
  const resolvedInstanceId = data.instanceId || stableInstanceId.current;
  const workspace = useRef<TeachingWorkspace | null>(null);

  const evaluation = usePrimitiveEvaluation<DiWordProblemSetupMetrics>({
    primitiveType: 'di-word-problem-setup', instanceId: resolvedInstanceId, skillId: data.skillId, subskillId: data.subskillId,
    objectiveId: data.objectiveId, exhibitId: data.exhibitId, componentIntent: data.componentIntent,
    objectiveText: data.objectiveText, onSubmit: data.onEvaluationSubmit,
  });

  /** Credited step ids: the page draws only what the child earned. */
  const [committed, setCommitted] = useState<Set<string>>(() => new Set());
  const boardRef = useRef<FamilyPlacements>(emptyBoard());
  const [board, setBoard] = useState<FamilyPlacements>(emptyBoard);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<FamilySlot | null>(null);
  const resetBoard = () => {
    boardRef.current = emptyBoard(); setBoard(emptyBoard()); setSelectedId(null); setDragOver(null);
  };

  const finish = (result: TeachingEvaluationResult) => {
    const solved = new Set(result.outcomes.filter(outcome => outcome.solved).map(outcome => outcome.id));
    const ofKind = (kind: WordProblemStepKind) => items.filter(item => item.kind === kind);
    const big = ofKind('big_number'), family = ofKind('family');
    const metrics: DiWordProblemSetupMetrics = {
      type: 'di-word-problem-setup', challengeType: data.challengeType, evalMode: data.challengeType,
      totalChallenges: items.length, problemCount: new Set(items.map(item => item.problemId)).size,
      correctCount: result.solvedCount, attemptsCount: result.attemptsCount, firstTryCount: result.firstTryCount,
      hintsViewed: 0, overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: result.attemptsCount / Math.max(items.length, 1),
      bigNumberStepsTotal: big.length, bigNumberStepsCorrect: big.filter(item => solved.has(item.id)).length,
      familyStepsTotal: family.length, familyStepsCorrect: family.filter(item => solved.has(item.id)).length,
      meanResponseMs: null,
    };
    evaluation.submitResult(result.passed, result.accuracy, metrics,
      { outcomes: result.outcomes, learningResponses: result.learningResponses, teachingAttempts: result.teachingAttempts,
        assistanceProvenance: result.assistanceProvenance }, undefined, result.diagnosisEvidence);
  };

  const runner = useWorkspaceRunner<WordProblemItem>({
    primitiveId: 'di-word-problem-setup', assignment: wordProblemAssignment, items, workspace,
    objectiveId: data.objectiveId, planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    evalMode: runtimeEvalMode || data.challengeType || 'find_big_number',
    instanceId: resolvedInstanceId, onFinished: finish,
    onItemOpened: () => resetBoard(), onCorrectionRetry: () => resetBoard(),
    onAffirmed: item => setCommitted(previous => new Set(previous).add(item.id)),
  });
  const current = runner.currentItem;
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;
  const steps = useMemo(() => items.filter(item => item.problemId === current?.problemId), [items, current?.problemId]);
  const bigStep = steps.find(item => item.kind === 'big_number');
  const familyShown = !!bigStep && committed.has(bigStep.id);

  // What the tutor and the observer are shown, republished every render. W1 offers no demonstration targets and
  // no presentation; every step is answerable once it opens.
  useLayoutEffect(() => {
    if (!current) return;
    workspace.current = { ...wordProblemScene(current, { familyShown }), demonstration: [], canDemonstrate: false,
      canPresent: false, readyForResponse: true, mark: () => {}, clearPresentation: () => {} };
    runner.publishWorkspace();
  });

  const pip = useStimulusPipSurface({
    run: runner, instanceId: resolvedInstanceId, label: 'The story', finished: showSummary,
    gesture: current?.kind === 'big_number', handover: current?.kind === 'big_number',
  });

  const live = current?.kind === 'big_number' && runner.canAttempt && !runner.isAwaitingGesture();
  /** Commit the finished board once it has sat still; a change in the window restarts it. */
  const commitBoard = () => {
    const item = runner.currentItem;
    if (item?.kind !== 'big_number' || !runner.canAttempt || runner.isAwaitingGesture()) return;
    const placed = boardRef.current;
    if (!boardComplete(item, placed)) return;
    commitGesture(runner, { response: describePlacement(item, placed), correct: bigSlotMatches(item, placed), cue: () => '' });
  };
  const place = (id: string, slot: FamilySlot) => {
    const item = runner.currentItem;
    if (!live || item?.kind !== 'big_number' || !item.plan.quantities.some(q => q.id === id)) return;
    const next = { ...boardRef.current };
    (Object.keys(next) as FamilySlot[]).forEach(key => { if (next[key] === id) next[key] = null; });
    next[slot] = id;
    pip.look('builder');
    boardRef.current = next; setBoard(next); setSelectedId(null); setDragOver(null);
    SoundManager.select();
    runner.clearStillness();
    if (boardComplete(item, next)) runner.armStillness(commitBoard, BIG_SETTLE_MS);
  };
  /** Tap the placed chip → it returns to the bank. Starting over is thinking, not an attempt. */
  const remove = (slot: FamilySlot) => {
    if (!live || !boardRef.current[slot]) return;
    const next = { ...boardRef.current, [slot]: null };
    boardRef.current = next; setBoard(next); setSelectedId(null);
    SoundManager.tap();
    runner.clearStillness();
  };

  if (!items.length) {
    return <LuminaCard className={className}><LuminaCardContent className="py-10 text-center">
      <p className="text-sm text-slate-300">No word problems were built for this objective.</p>
    </LuminaCardContent></LuminaCard>;
  }

  if (showSummary) {
    const outcomes = runner.practiceSummary?.outcomes ?? [];
    return <LuminaCard className={className}><LuminaCardContent className="space-y-4">
      <PhaseSummaryPanel heading="Word Problems Set Up!" celebrationMessage="You found the big number and said the family yourself."
        overallScore={evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy} durationMs={evaluation.elapsedMs}
        phases={outcomes.map((outcome, position) => ({
          label: items[position] ? `Story ${items[position].problemIndex + 1} · ${items[position].actionContract.label}` : '',
          score: outcome.score, attempts: outcome.attempts, firstTry: outcome.corrections === 0, accentColor: 'cyan' as const }))} />
    </LuminaCardContent></LuminaCard>;
  }

  const plan = steps[0].plan;
  const mark = (kind: WordProblemStepKind) => { const step = steps.find(item => item.kind === kind); return !!step && committed.has(step.id); };
  const classified = mark('classify'), placedBig = mark('big_number'), familyRead = mark('family');
  const operationChosen = mark('operation'), solved = mark('solve');
  const focusedBigMode = plan && steps[0].challengeType === 'find_big_number';
  const quantityFor = (id: string | null): Quantity | null => (id ? plan.quantities.find(q => q.id === id) ?? null : null);
  const atSlot = (slot: FamilySlot): Quantity | null => placedBig
    ? (slot === 'small1' ? plan.small1 : slot === 'small2' ? plan.small2 : plan.big)
    : quantityFor(board[slot]);
  const placedIds = new Set(Object.values(board).filter(Boolean));
  const bank = plan.quantities.filter(q => !placedIds.has(q.id));
  const valueOf = (q: Quantity) => (q.known ? String(q.value) : solved ? String(plan.answer) : '?');
  const zoneState = (slot: FamilySlot): DropZoneState => placedBig ? 'correct'
    : dragOver === slot ? 'dragOver' : atSlot(slot) ? 'filled' : 'idle';

  const chip = (q: Quantity, placedSlot?: FamilySlot) => (
    <LuminaChip key={q.id} state={placedSlot ? (placedBig ? 'correct' : 'selected') : selectedId === q.id ? 'selected' : live ? 'idle' : 'dimmed'}
      draggable={live && !placedSlot}
      onDragStart={event => { event.dataTransfer.setData('text/plain', q.id); event.dataTransfer.effectAllowed = 'move'; }}
      onClick={() => (placedSlot ? remove(placedSlot) : setSelectedId(selectedId === q.id ? null : q.id))}
      disabled={!live} className="min-w-[7rem] flex-col gap-0.5 px-3 py-2"
      aria-label={placedSlot ? `${q.label}, in the ${placedSlot} slot` : `Select ${q.label}`}>
      <span className="text-[11px] font-normal leading-tight text-slate-300">{q.label}</span>
      <span className="text-lg font-semibold leading-tight">{valueOf(q)}</span>
    </LuminaChip>
  );
  const familySlot = (slot: FamilySlot, label: string) => {
    const quantity = atSlot(slot);
    return <div className="flex min-w-[8rem] flex-1 basis-32 flex-col items-center gap-2">
      <span className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${slot === 'big' ? 'text-cyan-300' : 'text-slate-400'}`}>{label}</span>
      <LuminaDropZone state={zoneState(slot)} className="min-h-[92px] w-full px-2 py-2" data-pip-object={`slot-${slot}`}
        onClick={() => { if (selectedId) place(selectedId, slot); }}
        onDragOver={event => { if (live) { event.preventDefault(); setDragOver(slot); } }}
        onDragLeave={() => setDragOver(null)}
        onDrop={event => { event.preventDefault(); place(event.dataTransfer.getData('text/plain'), slot); }}
        emptyPrompt={<span className="text-center text-xs font-normal text-slate-500">Drop a story part here</span>}
        aria-label={`${label} drop zone`}>
        {quantity && chip(quantity, slot)}
      </LuminaDropZone>
    </div>;
  };
  const storyPartBank = !placedBig && current?.kind === 'big_number' && (
    <div className="mt-5 rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-3 py-3" aria-label="Story parts">
      <div className="mb-2 text-center text-xs font-medium text-cyan-200">
        {selectedId ? `Now tap the ${focusedBigMode ? 'big amount box' : 'matching space'} above`
          : `Drag a card, or tap a card then tap the ${focusedBigMode ? 'box' : 'matching space'}`}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">{bank.map(q => chip(q))}</div>
    </div>
  );
  const knownSmall = plan.small1.known ? plan.small1 : plan.small2;
  const equationLine = plan.operation === 'add'
    ? `${plan.small1.value} + ${plan.small2.value} = ${solved ? plan.answer : '▢'}`
    : `${plan.big.value} − ${knownSmall.value} = ${solved ? plan.answer : '▢'}`;
  const problemCount = new Set(items.map(item => item.problemId)).size;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{data.title}</LuminaCardTitle>
            <p className="text-sm text-slate-400">{data.description}</p>
          </div>
          <LuminaBadge accent="cyan" className="text-xs">Set it up</LuminaBadge>
        </div>
      </LuminaCardHeader>
      <LuminaCardContent className="space-y-4">
        <div className="mb-2 flex justify-center">
          <LuminaChallengeCounter current={Math.min(current.problemIndex + 1, problemCount)} total={problemCount} variant="dots" />
        </div>
        {pip.store && <div {...pip.dock} />}
        <div className="space-y-5">
          <div {...pip.target('stimulus')} data-word-problem-object="story" className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
            {classified && <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-emerald-300">{SHAPE_WORD[plan.shape]} problem</div>}
            <p className="text-lg leading-relaxed text-slate-100" aria-label="The story">{plan.story}</p>
          </div>
          <LuminaPrompt>{current.actionContract.instruction}</LuminaPrompt>
          {focusedBigMode ? (
            <div {...pip.target('builder')} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-5" aria-label="Big amount builder">
              <div className="mb-1 text-center text-sm font-semibold text-slate-200">{placedBig ? 'The big amount' : 'Find the big amount'}</div>
              <p className="mb-5 text-center text-xs text-slate-400">The big amount is the whole amount — the one that has it all.</p>
              <div className="mx-auto max-w-[13rem]">{familySlot('big', 'big amount')}</div>
              {storyPartBank}
            </div>
          ) : (
            <div {...pip.target('builder')} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-5">
              <div className="mb-1 text-center text-sm font-semibold text-slate-200">
                {current.kind === 'big_number' ? 'Build the number family' : 'Your number family'}
              </div>
              <p className="mb-5 text-center text-xs text-slate-400">
                {current.kind === 'big_number' ? 'Put every story part in its role. The two small amounts make the big amount.'
                  : familyRead ? 'You read the setup. Now use it to finish the problem.' : 'Read this setup out loud: small plus small equals big.'}
              </p>
              <div className="flex flex-wrap items-end justify-center gap-2" aria-label="Number family equation">
                {familySlot('small1', 'small amount')}
                <span className="pb-8 font-mono text-3xl text-cyan-200" aria-hidden="true">+</span>
                {familySlot('small2', 'small amount')}
                <span className="pb-8 font-mono text-3xl text-cyan-200" aria-hidden="true">=</span>
                {familySlot('big', 'big amount')}
              </div>
              {storyPartBank}
              {operationChosen && <div className="mt-4 text-center font-mono text-xl text-emerald-300" aria-label="The working" data-word-problem-credited="operation">
                <span className="mr-3 rounded-md border border-white/15 px-2 py-0.5 text-base">{plan.operation === 'add' ? '+' : '−'}</span>
                {equationLine}
              </div>}
            </div>
          )}
          {placedBig && <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4" aria-label="Bar model" data-word-problem-credited="big">
            <div className="mx-auto max-w-md space-y-2">
              <div className="flex h-10 items-center justify-between rounded-md border border-white/20 bg-white/10 px-3 text-sm">
                <span className="text-slate-300">{plan.big.label}</span>
                <span className={`font-mono text-lg ${plan.big.known ? 'text-slate-100' : solved ? 'text-emerald-300' : 'text-slate-500'}`}>{valueOf(plan.big)}</span>
              </div>
              <div className="flex h-10 gap-1">
                {[plan.small1, plan.small2].map(q => {
                  const known = plan.quantities.filter(other => other.known && other.slot !== 'big');
                  const width = q.known ? q.value : Math.max(1, plan.big.value - known.reduce((sum, other) => sum + other.value, 0));
                  return <div key={q.id} style={{ flexGrow: width, flexBasis: 0 }}
                    className={`flex items-center justify-between overflow-hidden rounded-md border px-2 text-xs ${q.known ? 'border-white/15 bg-white/5' : 'border-dashed border-white/20'}`}>
                    <span className="truncate text-slate-400">{q.label}</span>
                    <span className={`ml-1 font-mono text-base ${q.known ? 'text-slate-200' : solved ? 'text-emerald-300' : 'text-slate-500'}`}>
                      {familyRead || q.known ? valueOf(q) : ''}
                    </span>
                  </div>;
                })}
              </div>
            </div>
          </div>}
        </div>
      </LuminaCardContent>
    </LuminaCard>
  );
};

/** Workspace only: a bound mount renders the surface, anything else the shared "needs the tutor" card. */
export const DiWordProblemSetup = withWorkspaceOnly<DiWordProblemSetupProps>('di-word-problem-setup', DiWordProblemSetupSurface,
  props => props.data.title);

export default DiWordProblemSetup;
