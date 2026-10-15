'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import {
  LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardDescription, LuminaCardContent,
  LuminaBadge, LuminaButton, LuminaActionButton, LuminaChallengeCounter, LuminaFeedbackCard, LuminaPrompt,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { ConstructionSiteDioramaMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import ConstructionScene from './ConstructionScene';
import type { SiteAction, SiteTarget } from './construction3d';
import {
  BED_SLOTS, sendFeedback,
  type ConstructionBand, type ConstructionChallenge, type ConstructionTask,
} from './constructionModel';
import { constructionAssignment, constructionScene, describeLoad, loadMatches, loadMiss } from './constructionWorkspace';

export type { ConstructionChallenge } from './constructionModel';

// ============================================================================
// Data contract
// ============================================================================

export interface ConstructionSiteDioramaData {
  title: string;
  description: string;
  /** 4-6 loads. REQUIRED. Numbers and asks written by code; Gemini supplies the destinations. */
  challenges: ConstructionChallenge[];
  challengeType: ConstructionTask;
  gradeBand: ConstructionBand;
  /** A made-up company, painted on the truck doors and the site sign. */
  companyName: string;
  /** Where the levers start (`config.difficulty`); unused until /add-support-tiers. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ConstructionSiteDioramaMetrics>) => void;
}

interface ConstructionSiteDioramaProps {
  data: ConstructionSiteDioramaData;
  className?: string;
  runtimeEvalMode?: string;
  runtimePlanItemId?: string;
}

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  load_truck: { label: 'Load the truck', icon: '🚚', accentColor: 'amber' },
};

/** The teaching workspace is this primitive's only controller: the runtime owns progression. */
const useConstructionProgress = useWorkspaceProgressFor('construction-site-diorama');

const ConstructionSiteDioramaSurface: React.FC<ConstructionSiteDioramaProps> = ({ data, className, runtimePlanItemId }) => {
  const { title, description, challenges = [], challengeType, gradeBand, companyName, instanceId, skillId, subskillId,
    objectiveId, exhibitId, onEvaluationSubmit } = data;
  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceId = useRef(instanceId || `construction-site-diorama-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  const [loaded, setLoaded] = useState(0);
  const [spilled, setSpilled] = useState(0);
  const [holding, setHolding] = useState(false);
  const [action, setAction] = useState<(SiteAction & { id: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [sends, setSends] = useState(0);
  const [lastSent, setLastSent] = useState<number | null>(null);
  const [departing, setDeparting] = useState(false);
  const [squash, setSquash] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; status: 'correct' | 'incorrect' | 'insight' } | null>(null);
  const [truckKey, setTruckKey] = useState('truck-0');
  const [viewKey, setViewKey] = useState('start');
  const actionRef = useRef<(SiteAction & { id: string }) | null>(null);

  const progress = useConstructionProgress<ConstructionChallenge>({
    challenges, getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: constructionAssignment,
    // A fresh load brings an empty truck. Try again keeps the load in the bed, so the learner fixes it.
    onItemOpened: (index, retry) => {
      setSquash(false); setDeparting(false);
      if (retry) return;
      setLoaded(0); setSpilled(0); setHolding(false); setSends(0); setLastSent(null); setFeedback(null);
      setTruckKey(`truck-${index}-${Date.now()}`);
    },
  });
  const { currentIndex, results: challengeResults, isComplete } = progress;
  const allChallengesComplete = isComplete || !!progress.practiceSummary;
  const blocked = progress.canAttempt === false || departing;
  const current = challenges[currentIndex] ?? null;

  const phaseResults = usePhaseResults({
    challenges, results: challengeResults, isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type, phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) => Math.round(rs.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0)
      / Math.max(rs.length, 1)),
  });

  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<ConstructionSiteDioramaMetrics>({
    primitiveType: 'construction-site-diorama', instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Working the excavator: tap the pile or the truck ──────────────────────
  const onTap = useCallback((target: SiteTarget) => {
    if (!current || blocked || busy || allChallengesComplete) return;
    if (!holding && target === 'truck' && loaded === 0) {
      setFeedback({ text: `The truck is empty. Tap the pile to dig some ${current.material}.`, status: 'insight' });
      return;
    }
    const next = { id: `act-${Date.now()}`, kind: holding ? 'dump' as const : 'dig' as const, at: target };
    actionRef.current = next;
    setFeedback(null); setSquash(false);
    setBusy(true); setAction(next);
  }, [current, blocked, busy, allChallengesComplete, holding, loaded]);

  // The scoop changes hands: the bucket curls full, or the dumped scoop lands.
  const onMoment = useCallback((id: string) => {
    const a = actionRef.current;
    if (!a || a.id !== id) return;
    if (a.kind === 'dig') {
      setHolding(true);
      if (a.at === 'truck') setLoaded(n => Math.max(0, n - 1));
    } else {
      setHolding(false);
      if (a.at === 'truck') {
        if (loaded >= BED_SLOTS) setSpilled(n => n + 1); else setLoaded(n => n + 1);
      }
    }
  }, [loaded]);
  const onIdle = useCallback((id: string) => { if (actionRef.current?.id === id) setBusy(false); }, []);

  // ── Sending the truck is the check ────────────────────────────────────────
  const onSend = useCallback(() => {
    if (!current || blocked || busy || allChallengesComplete) return;
    const correct = loadMatches(current, loaded);
    setSends(n => n + 1); setLastSent(loaded);
    setFeedback({ text: sendFeedback(current, loaded), status: correct ? 'correct' : 'incorrect' });
    if (correct) { SoundManager.playCorrect(); setDeparting(true); } else {
      SoundManager.playIncorrect();
      if (current.units === 'tons' && loaded > current.target) setSquash(true);
    }
    progress.commitCheck(describeLoad(loaded), correct, loadMiss(current, loaded));
    if (correct) {
      const attempts = progress.currentAttempts + 1;
      progress.mergeResult({ challengeId: current.id, correct: true, attempts, score: Math.max(20, 100 - 25 * (attempts - 1)) });
    }
  }, [current, blocked, busy, allChallengesComplete, loaded, progress]);

  // ── Evaluation: submit once, only under an evaluation provider ────────────
  useEffect(() => {
    if (!allChallengesComplete || hasSubmitted || challenges.length === 0 || !progress.recordsEvaluation) return;
    const total = challenges.length;
    const correctCount = challengeResults.filter(r => r.correct).length;
    const attemptsCount = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const firstTryCount = challengeResults.filter(r => r.correct && r.attempts === 1).length;
    const accuracy = Math.round(challengeResults.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0)
      / Math.max(total, 1));
    const metrics: ConstructionSiteDioramaMetrics = {
      type: 'construction-site-diorama', challengeType, totalChallenges: total, correctCount, attemptsCount, firstTryCount,
      hintsViewed: 0, overallAccuracy: accuracy, averageAttemptsPerChallenge: Math.round((attemptsCount / total) * 10) / 10,
    };
    submitResult(correctCount === total, accuracy, metrics, { challengeResults });
  }, [allChallengesComplete, hasSubmitted, challenges, challengeType, challengeResults, submitResult, progress.recordsEvaluation]);

  // ── Pip: the work site as a whole; never the bed (the count is the task) ──
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: allChallengesComplete || hasSubmitted || !current ? null : current.id,
    label: 'The work site',
    solved: departing,
    tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId),
  });

  // What the tutor and the observer see, republished every render.
  useLayoutEffect(() => {
    if (!current) return;
    workspace.current = { ...constructionScene(current, { loaded, holding, spilled, sends, lastSent }) };
  });

  const localScore = useMemo(() => phaseResults.length
    ? Math.round(phaseResults.reduce((s, p) => s + p.score, 0) / phaseResults.length) : 0, [phaseResults]);

  if (!challenges.length) {
    return <LuminaCard className={className}><LuminaCardContent className="p-6 text-slate-400">No loads to haul.</LuminaCardContent></LuminaCard>;
  }

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
            durationMs={elapsedMs} heading="Job done!" celebrationMessage="Every truck went out with the right load." className="mb-2" />
        )}

        {!allChallengesComplete && current && (
          <LuminaPrompt accent="amber">
            <div className="text-base">{current.instruction}</div>
          </LuminaPrompt>
        )}

        {pip.store && <div {...pip.dock} />}
        <div {...pip.workspace} className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border border-white/10">
            <ConstructionScene className="h-[min(62vh,520px)] min-h-[320px] w-full"
              company={companyName} material={current?.material ?? 'dirt'}
              loaded={loaded} spilled={spilled} holding={holding}
              capacityTons={current?.units === 'tons' ? current.capacityTons ?? null : null}
              departing={departing} squash={squash} finale={allChallengesComplete}
              truckKey={truckKey} action={action} onMoment={onMoment} onIdle={onIdle}
              viewKey={viewKey} disabled={blocked || busy || allChallengesComplete} onTap={onTap} />
            <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-slate-900/70 px-3 py-1 text-xs text-slate-200">
              Tap the pile to dig · tap the truck to dump · drag to turn
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!allChallengesComplete && (
              <LuminaActionButton action="check" onClick={onSend} disabled={blocked || busy}>
                Send the truck
              </LuminaActionButton>
            )}
            <LuminaButton tone="ghost" onClick={() => setViewKey(`reset-${Date.now()}`)}>Turn back to the start</LuminaButton>
          </div>

          {!allChallengesComplete && feedback && (
            <LuminaFeedbackCard status={feedback.status}>
              <p>{feedback.text}</p>
            </LuminaFeedbackCard>
          )}
        </div>
      </LuminaCardContent>
    </LuminaCard>
  );
};

const ConstructionSiteDiorama = withWorkspaceOnly<ConstructionSiteDioramaProps>('construction-site-diorama',
  ConstructionSiteDioramaSurface, props => props.data.title);

/**
 * The work site runs only on the teaching workspace: the tutor is present, sending the truck is the check, and
 * the runtime moves to the next load. Outside a bound session the "needs the tutor" card shows.
 */
export default ConstructionSiteDiorama;
