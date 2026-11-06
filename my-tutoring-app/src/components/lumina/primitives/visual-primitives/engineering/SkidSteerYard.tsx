'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardDescription, LuminaCardContent,
  LuminaBadge, LuminaButton, LuminaActionButton, LuminaChallengeCounter, LuminaFeedbackCard, LuminaPrompt,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { SkidSteerYardMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import SkidSteerScene, { type SkidSteerSceneProps } from './SkidSteerScene';
import type { YardItem } from './skidSteer3d';
import {
  ATTACHMENT_NAME, attachmentMatches, attachmentMiss, describeAttachment, describeLevers, goFeedback, jobFeedback,
  leverMiss, leversMatch, LEVERS, runMove,
  type Attachment, type Lever, type Levers, type SkidSteerBand, type SkidSteerChallenge, type SkidSteerTask,
} from './skidSteerModel';
import { skidSteerScene } from './skidSteerWorkspace';
import { skidSteerYardBoss } from './skidSteerYard.boss';

export type { SkidSteerChallenge } from './skidSteerModel';

// ============================================================================
// Data contract
// ============================================================================

export interface SkidSteerYardData {
  title: string;
  description: string;
  /** 5 items (jobs and/or turns). REQUIRED. Built by code: every job, tool list, thing, side, barrier and ask. */
  challenges: SkidSteerChallenge[];
  /** The session's task, or the first one on a mixed session; each item renders from its own `type`. */
  challengeType: SkidSteerTask;
  gradeBand: SkidSteerBand;
  /** Where the items started (`config.difficulty`): how many tools and how tight the yard is. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SkidSteerYardMetrics>) => void;
}

interface SkidSteerYardProps {
  data: SkidSteerYardData;
  className?: string;
  runtimeEvalMode?: string;
  runtimePlanItemId?: string;
}

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  match_attachment: { label: 'Pick the attachment', icon: '🧰', accentColor: 'orange' },
  set_levers: { label: 'Set the levers', icon: '🚜', accentColor: 'amber' },
};

const STOPPED: Levers = { left: 'stop', right: 'stop' };
const ARROW: Record<Lever, string> = { fwd: '▲', stop: '●', back: '▼' };
const LEVER_LABEL: Record<Lever, string> = { fwd: 'forward', stop: 'stop', back: 'back' };

/** The drive panel's top view: the machine with each side's wheels showing its lever (an input, never a path). */
const SideView: React.FC<{ levers: Levers }> = ({ levers }) => {
  const color = (l: Lever) => (l === 'fwd' ? '#34d399' : l === 'back' ? '#f87171' : '#64748b');
  const arrow = (x: number, l: Lever) => l === 'stop'
    ? <circle cx={x} cy={60} r={6} fill={color(l)} />
    : <path d={l === 'fwd' ? `M${x - 8} 66 L${x} 50 L${x + 8} 66 Z` : `M${x - 8} 54 L${x} 70 L${x + 8} 54 Z`} fill={color(l)} />;
  return (
    <svg viewBox="0 0 120 120" className="h-28 w-28" aria-hidden>
      <rect x={36} y={22} width={48} height={76} rx={8} fill="#f2b21b" />
      <rect x={44} y={14} width={32} height={10} rx={2} fill="#2b2e33" />
      <rect x={46} y={40} width={28} height={30} rx={4} fill="#16283a" opacity={0.8} />
      {[30, 90].map(x => [34, 86].map(y => <rect key={`${x}-${y}`} x={x - 7} y={y - 12} width={14} height={24} rx={4} fill="#1b1c1e" />))}
      {arrow(14, levers.left)}
      {arrow(106, levers.right)}
    </svg>
  );
};

const LeverControl: React.FC<{ side: 'left' | 'right'; value: Lever; disabled: boolean; onSet: (l: Lever) => void }> = ({ side, value, disabled, onSet }) => (
  <div className="flex flex-col items-center gap-1.5" role="group" aria-label={`${side === 'left' ? 'Left' : 'Right'} wheels lever`}>
    <span className="text-xs font-medium uppercase tracking-wide text-slate-300">{side === 'left' ? 'Left wheels' : 'Right wheels'}</span>
    {LEVERS.map(l => (
      <button key={l} type="button" data-pip-object={`lever-${side}-${l}`} disabled={disabled}
        aria-label={`${side} wheels ${LEVER_LABEL[l]}`} aria-pressed={value === l}
        onClick={() => onSet(l)}
        className={`flex h-11 w-14 items-center justify-center rounded-lg border text-lg transition-colors disabled:opacity-50 ${
          value === l ? 'border-amber-300/70 bg-amber-400/25 text-amber-100' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}>
        {ARROW[l]}
      </button>
    ))}
  </div>
);

/** A picture of each attachment, so a pre-reader picks by its shape; the name sits under it. */
const ToolPicture: React.FC<{ tool: Attachment }> = ({ tool }) => {
  const steel = '#9aa0a6', yellow = '#d29512', dark = '#2b2e33', orange = '#e8661c';
  return (
    <svg viewBox="0 0 64 48" className="h-12 w-16" aria-hidden>
      <rect x={4} y={8} width={6} height={32} rx={1} fill={dark} />
      {tool === 'bucket' && <path d="M10 10 L50 14 L58 40 L10 40 Z" fill={yellow} stroke={steel} strokeWidth={2} />}
      {tool === 'forks' && <>
        <rect x={10} y={10} width={5} height={30} fill={dark} />
        <rect x={10} y={34} width={48} height={4} fill={steel} />
        <rect x={10} y={24} width={40} height={3} fill={steel} opacity={0.6} />
      </>}
      {tool === 'auger' && <>
        <rect x={10} y={10} width={22} height={6} fill={dark} />
        <rect x={28} y={10} width={12} height={10} fill={orange} />
        <path d="M34 20 L28 24 L40 28 L28 32 L40 36 L34 44" fill="none" stroke={steel} strokeWidth={3} />
      </>}
      {tool === 'broom' && <>
        <path d="M10 12 Q36 2 58 18 L58 22 L10 22 Z" fill={yellow} />
        <circle cx={34} cy={32} r={11} fill="#3b3226" />
        {[0, 1, 2, 3, 4, 5].map(i => <line key={i} x1={34} y1={32} x2={34 + 12 * Math.cos(i)} y2={32 + 12 * Math.sin(i)} stroke="#6b5a40" strokeWidth={1.5} />)}
      </>}
      {tool === 'snow_blade' && <path d="M12 8 Q34 18 30 42 L60 42 Q48 22 60 8 Z" fill={orange} stroke={steel} strokeWidth={2} />}
      {tool === 'grapple' && <>
        {[0, 1, 2].map(i => <rect key={i} x={10} y={30 + i * 0} width={46} height={4} fill={dark} transform={`translate(0 ${i * 4})`} />)}
        <path d="M10 10 L46 10 L54 24" fill="none" stroke={yellow} strokeWidth={5} />
        <path d="M10 16 L40 16 L48 28" fill="none" stroke={yellow} strokeWidth={4} />
      </>}
    </svg>
  );
};

/** The teaching workspace is this primitive's only controller: the runtime owns progression. */
const useSkidSteerProgress = useWorkspaceProgressFor('skid-steer-yard');

const toolForTurns: Attachment = 'bucket';

const SkidSteerYardSurface: React.FC<SkidSteerYardProps> = ({ data, className, runtimePlanItemId }) => {
  const { title, description, challenges = [], challengeType, gradeBand, instanceId, skillId, subskillId,
    objectiveId, exhibitId, onEvaluationSubmit } = data;
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceId = useRef(instanceId || `skid-steer-yard-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  const [levers, setLevers] = useState<Levers>(STOPPED);
  const [tool, setTool] = useState<Attachment | null>(challenges[0]?.type === 'match_attachment' ? null : toolForTurns);
  const [move, setMove] = useState<SkidSteerSceneProps['move']>(null);
  const [moving, setMoving] = useState(false);
  const [goes, setGoes] = useState(0);
  const [lastGo, setLastGo] = useState<Levers | null>(null);
  const [lastTool, setLastTool] = useState<Attachment | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; status: 'correct' | 'incorrect' | 'insight' } | null>(null);
  const [itemKey, setItemKey] = useState('item-0');
  const [viewKey, setViewKey] = useState('start');

  const progress = useSkidSteerProgress<SkidSteerChallenge>({
    challenges, getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: skidSteerYardBoss.assignment!,
    // Each opening puts the machine back at its start spot with the job (or the yard) as it was. Try again keeps the
    // tool or the levers as set, so the learner changes what they chose; a new item starts fresh: a bare plate for a
    // job, both levers stopped and the bucket on for a turn.
    onItemOpened: (index, retry) => {
      setMove(null); setMoving(false);
      setItemKey(`item-${index}-${Date.now()}`);
      if (retry) return;
      setLevers(STOPPED); setGoes(0); setLastGo(null); setLastTool(null); setFeedback(null);
      setTool(challenges[index]?.type === 'match_attachment' ? null : toolForTurns);
    },
  });
  const { currentIndex, results: challengeResults, isComplete } = progress;
  const allChallengesComplete = isComplete || !!progress.practiceSummary;
  const blocked = progress.canAttempt === false || moving;
  const current = challenges[currentIndex] ?? null;

  const phaseResults = usePhaseResults({
    challenges, results: challengeResults, isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type, phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) => Math.round(rs.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0)
      / Math.max(rs.length, 1)),
  });

  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<SkidSteerYardMetrics>({
    primitiveType: 'skid-steer-yard', instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const inputClosed = blocked || allChallengesComplete;

  const setLever = useCallback((side: 'left' | 'right', l: Lever) => {
    if (inputClosed) return;
    setLevers(prev => ({ ...prev, [side]: l }));
    setFeedback(null);
  }, [inputClosed]);

  const pickTool = useCallback((a: Attachment) => {
    if (inputClosed) return;
    setTool(a);
    setFeedback(null);
  }, [inputClosed]);

  const credit = useCallback((id: string) => {
    const attempts = progress.currentAttempts + 1;
    progress.mergeResult({ challengeId: id, correct: true, attempts, score: Math.max(20, 100 - 25 * (attempts - 1)) });
  }, [progress]);

  // ── Go is the check on a turn ───────────────────────────────────────────────
  const onGo = useCallback(() => {
    if (!current || current.type !== 'set_levers' || inputClosed) return;
    if (levers.left === 'stop' && levers.right === 'stop') {
      setFeedback({ text: 'Both levers are on stop, so neither side of wheels will turn. Move a lever, then press Go.', status: 'insight' });
      return;
    }
    const result = runMove(current.barriers, levers);
    const correct = leversMatch(current, levers);
    setGoes(n => n + 1); setLastGo(levers);
    setFeedback({ text: goFeedback(current, levers), status: correct ? 'correct' : 'incorrect' });
    setMoving(true);
    setMove({ id: `go-${Date.now()}`, kind: 'turn', levers, result, correct });
    if (correct) SoundManager.playCorrect(); else SoundManager.playIncorrect();
    progress.commitCheck(describeLevers(levers), correct, leverMiss(current, levers));
    if (correct) credit(current.id);
  }, [current, inputClosed, levers, progress, credit]);

  // ── Do the job is the check on a job ────────────────────────────────────────
  const onDoJob = useCallback(() => {
    if (!current || current.type !== 'match_attachment' || inputClosed) return;
    if (!tool) {
      setFeedback({ text: 'The plate is empty. Tap an attachment to click it on, then press Do the job.', status: 'insight' });
      return;
    }
    const correct = attachmentMatches(current, tool);
    setGoes(n => n + 1); setLastTool(tool);
    setFeedback({ text: jobFeedback(current, tool), status: correct ? 'correct' : 'incorrect' });
    setMoving(true);
    setMove({ id: `job-${Date.now()}`, kind: 'job', job: current.job, tool, correct });
    if (correct) SoundManager.playCorrect(); else SoundManager.playIncorrect();
    progress.commitCheck(describeAttachment(tool), correct, attachmentMiss(current, tool));
    if (correct) credit(current.id);
  }, [current, inputClosed, tool, progress, credit]);

  const onDone = useCallback(() => setMoving(false), []);

  // ── Evaluation: submit once, only under an evaluation provider ────────────
  useEffect(() => {
    if (!allChallengesComplete || hasSubmitted || challenges.length === 0 || !progress.recordsEvaluation) return;
    const total = challenges.length;
    const correctCount = challengeResults.filter(r => r.correct).length;
    const attemptsCount = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const firstTryCount = challengeResults.filter(r => r.correct && r.attempts === 1).length;
    const accuracy = Math.round(challengeResults.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0)
      / Math.max(total, 1));
    const metrics: SkidSteerYardMetrics = {
      type: 'skid-steer-yard', challengeType, totalChallenges: total, correctCount, attemptsCount, firstTryCount,
      hintsViewed: 0, overallAccuracy: accuracy, averageAttemptsPerChallenge: Math.round((attemptsCount / total) * 10) / 10,
    };
    submitResult(correctCount === total, accuracy, metrics, { challengeResults });
  }, [allChallengesComplete, hasSubmitted, challenges, challengeType, challengeResults, submitResult, progress.recordsEvaluation]);

  // What the tutor and the observer see, republished every render.
  useLayoutEffect(() => {
    if (!current) return;
    workspace.current = skidSteerScene(current, { levers, attached: tool, goes, lastGo, lastTool });
  });

  const localScore = useMemo(() => phaseResults.length
    ? Math.round(phaseResults.reduce((s, p) => s + p.score, 0) / phaseResults.length) : 0, [phaseResults]);

  const sceneItem = useMemo<YardItem>(() => (current?.type === 'match_attachment'
    ? { kind: 'job', job: current.job }
    : { kind: 'turn', goal: current?.goal ?? 'dirt pile', side: current?.side ?? 'left', barriers: current?.barriers ?? [] }), [current]);

  if (!challenges.length) {
    return <LuminaCard className={className}><LuminaCardContent className="p-6 text-slate-400">No jobs in the yard.</LuminaCardContent></LuminaCard>;
  }

  const isJob = current?.type === 'match_attachment';
  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LuminaCardTitle>{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="amber">{gradeBand}</LuminaBadge>
            <LuminaChallengeCounter current={Math.min(currentIndex + 1, challenges.length)} total={challenges.length} />
          </div>
        </div>
        <LuminaCardDescription>{description}</LuminaCardDescription>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localScore)}
            durationMs={elapsedMs} heading="Yard work done!" celebrationMessage="You ran the skid steer like a real operator."
            className="mb-2" />
        )}

        {!allChallengesComplete && current && (
          <LuminaPrompt accent="amber">
            <div className="text-base">{current.instruction}</div>
          </LuminaPrompt>
        )}

        <PipDock />
        <PipWorkspace className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border border-white/10">
            <SkidSteerScene className="h-[min(56vh,480px)] min-h-[300px] w-full"
              item={sceneItem} itemKey={itemKey} levers={levers} tool={tool} move={move} onDone={onDone} viewKey={viewKey} />
            <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-slate-900/70 px-3 py-1 text-xs text-slate-200">
              {isJob ? 'Tap an attachment, then press Do the job' : 'Set the levers, then press Go'} · drag to look around
            </div>
          </div>

          {!allChallengesComplete && current?.type === 'match_attachment' && (
            <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl border border-white/10 bg-slate-900/40 p-3">
              {current.options.map(a => (
                <button key={a} type="button" data-pip-object={`tool-${a}`} disabled={inputClosed}
                  aria-label={ATTACHMENT_NAME[a]} aria-pressed={tool === a} onClick={() => pickTool(a)}
                  className={`flex w-24 flex-col items-center gap-1 rounded-xl border p-2 text-xs transition-colors disabled:opacity-50 ${
                    tool === a ? 'border-amber-300/70 bg-amber-400/20 text-amber-100' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}>
                  <ToolPicture tool={a} />
                  <span className="capitalize">{ATTACHMENT_NAME[a]}</span>
                </button>
              ))}
              <div className="flex flex-col gap-2">
                <LuminaActionButton action="check" onClick={onDoJob} disabled={inputClosed}>Do the job</LuminaActionButton>
                <LuminaButton tone="ghost" onClick={() => setViewKey(`reset-${Date.now()}`)}>Turn back to the start</LuminaButton>
              </div>
            </div>
          )}

          {!allChallengesComplete && current?.type === 'set_levers' && (
            <div className="flex flex-wrap items-center justify-center gap-4 rounded-xl border border-white/10 bg-slate-900/40 p-3">
              <LeverControl side="left" value={levers.left} disabled={inputClosed} onSet={l => setLever('left', l)} />
              <SideView levers={levers} />
              <LeverControl side="right" value={levers.right} disabled={inputClosed} onSet={l => setLever('right', l)} />
              <div className="flex flex-col gap-2">
                <LuminaActionButton action="check" onClick={onGo} disabled={inputClosed}>Go</LuminaActionButton>
                <LuminaButton tone="ghost" onClick={() => setViewKey(`reset-${Date.now()}`)}>Turn back to the start</LuminaButton>
              </div>
            </div>
          )}

          {!allChallengesComplete && feedback && (
            <LuminaFeedbackCard status={feedback.status}>
              <p>{feedback.text}</p>
            </LuminaFeedbackCard>
          )}
        </PipWorkspace>
      </LuminaCardContent>
    </LuminaCard>
  );
};

const SkidSteerYard = withWorkspaceOnly<SkidSteerYardProps>('skid-steer-yard', SkidSteerYardSurface, props => props.data.title);

/**
 * The skid steer yard runs only on the teaching workspace: the tutor is present, Do the job or Go is the check, and
 * the runtime moves to the next item. Outside a bound session the "needs the tutor" card shows.
 */
export default SkidSteerYard;
