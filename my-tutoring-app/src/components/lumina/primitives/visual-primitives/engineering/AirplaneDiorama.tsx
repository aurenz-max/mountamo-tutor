'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardDescription, LuminaCardContent,
  LuminaBadge, LuminaButton, LuminaChallengeCounter, LuminaFeedbackCard, LuminaPrompt,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { AirplaneDioramaMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import AirplaneScene from './AirplaneScene';
import FlightPlanPanel from './FlightPlanPanel';
import {
  MAX_TANKS, PART_INFO, airplaneMiss, describeFuel, describeTap, flightFeedback, flightMiss, flyTrip, partMatches, tapFeedback,
  type AirplaneBand, type AirplaneChallenge, type AirplanePart, type AirplaneTask, type FlightPlanChallenge, type FlightRun,
} from './airplaneModel';
import { airplaneScene } from './airplaneWorkspace';
import { airplaneDioramaBoss } from './airplaneDiorama.boss';

export type { AirplaneChallenge } from './airplaneModel';

// ============================================================================
// Data contract
// ============================================================================

export interface AirplaneDioramaData {
  title: string;
  description: string;
  /** 4-6 items. REQUIRED. Every ask, trip and number is written by code; Gemini writes only framing and trip names. */
  challenges: AirplaneChallenge[];
  /** One task: that task. Mixed: the hardest task in the session (each item carries its own). */
  challengeType: AirplaneTask;
  gradeBand: AirplaneBand;
  /** A made-up airline, painted on the jet. */
  airlineName: string;
  /** Where the levers start (`config.difficulty`); unused until /add-support-tiers. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<AirplaneDioramaMetrics>) => void;
}

interface AirplaneDioramaProps {
  data: AirplaneDioramaData;
  className?: string;
  runtimeEvalMode?: string;
  runtimePlanItemId?: string;
}

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  find_part: { label: 'Find the part', icon: '✈️', accentColor: 'cyan' },
  flight_plan: { label: 'Plan the flight', icon: '⛽', accentColor: 'amber' },
};

/** Stand code painted on the tarmac: the airline's first letters. */
const standCode = (airline: string) => (airline.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'JET') + ' 1';

/** Seconds a flight takes on screen: about half a second per tank burned, 1.2-4 s. */
const flightSeconds = (c: FlightPlanChallenge, run: FlightRun, reduce: boolean) =>
  reduce ? 0.3 : Math.min(4, Math.max(1.2, 0.5 * (run.flown / c.perTank)));

/** The teaching workspace is this primitive's only controller: the runtime owns progression. */
const useAirplaneProgress = useWorkspaceProgressFor('airplane-diorama');

const AirplaneDioramaSurface: React.FC<AirplaneDioramaProps> = ({ data, className, runtimePlanItemId }) => {
  const { title, description, challenges = [], challengeType, gradeBand, airlineName, instanceId, skillId, subskillId,
    objectiveId, exhibitId, onEvaluationSubmit } = data;
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceId = useRef(instanceId || `airplane-diorama-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // Both tasks: the item is solved (the part found, or the flight landed just right).
  const [solved, setSolved] = useState(false);
  const [feedback, setFeedback] = useState('');
  // find_part
  const [tapped, setTapped] = useState<AirplanePart | null>(null);
  const [taps, setTaps] = useState(0);
  const [focus, setFocus] = useState<{ part: AirplanePart | 'overview'; key: string }>({ part: 'overview', key: 'start' });
  // flight_plan
  const [loaded, setLoaded] = useState(0);
  const [flownNow, setFlownNow] = useState(0);
  const [flying, setFlying] = useState(false);
  const [lastFlight, setLastFlight] = useState<FlightRun | null>(null);
  const [flights, setFlights] = useState(0);
  const animRef = useRef<number | null>(null);

  const progress = useAirplaneProgress<AirplaneChallenge>({
    challenges, getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: airplaneDioramaBoss.assignment!,
    // A fresh item turns the jet back to the start view. Try again keeps the view and the last result's words;
    // the loader empties and the plane goes back to the start airport, so the tanks are worked out again, not nudged.
    onItemOpened: (_index, retry) => {
      setSolved(false);
      setFlownNow(0); setFlying(false); setLastFlight(null); setLoaded(0);
      if (retry) return;
      setTapped(null); setTaps(0); setFeedback('');
      setFlights(0);
      setFocus({ part: 'overview', key: `open-${Date.now()}` });
    },
  });
  const { currentIndex, results: challengeResults, isComplete } = progress;
  const allChallengesComplete = isComplete || !!progress.practiceSummary;
  const blocked = progress.canAttempt === false || solved || flying;
  const current = challenges[currentIndex] ?? null;
  const findOnly = challenges.every(c => c.type === 'find_part');

  const phaseResults = usePhaseResults({
    challenges, results: challengeResults, isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type, phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) => Math.round(rs.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0)
      / Math.max(rs.length, 1)),
  });

  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<AirplaneDioramaMetrics>({
    primitiveType: 'airplane-diorama', instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const credit = useCallback((id: string) => {
    const attempts = progress.currentAttempts + 1;
    progress.mergeResult({ challengeId: id, correct: true, attempts, score: Math.max(20, 100 - 25 * (attempts - 1)) });
  }, [progress]);

  // ── find_part: a tap on the jet is the check ──────────────────────────────
  const onTapPart = useCallback((part: AirplanePart) => {
    if (!current || current.type !== 'find_part' || blocked || allChallengesComplete) return;
    const correct = partMatches(current, part);
    setTapped(part); setTaps(n => n + 1); setFeedback(tapFeedback(current, part));
    if (correct) {
      SoundManager.playCorrect();
      setSolved(true);
      setFocus({ part, key: `found-${current.id}` });
    } else SoundManager.playIncorrect();
    progress.commitCheck(describeTap(part), correct, airplaneMiss(current, part));
    if (correct) credit(current.id);
  }, [current, blocked, allChallengesComplete, progress, credit]);

  // ── flight_plan: the flight is the check ──────────────────────────────────
  useEffect(() => () => { if (animRef.current !== null) cancelAnimationFrame(animRef.current); }, []);

  const land = useCallback((c: FlightPlanChallenge, run: FlightRun) => {
    animRef.current = null;
    const miss = flightMiss(c, run.loaded);
    const correct = miss === undefined;
    setFlying(false); setFlownNow(run.flown); setLastFlight(run); setFlights(n => n + 1);
    setFeedback(flightFeedback(c, run));
    if (correct) { SoundManager.playCorrect(); setSolved(true); } else SoundManager.playIncorrect();
    progress.commitCheck(describeFuel(run.loaded), correct, miss);
    if (correct) credit(c.id);
  }, [progress, credit]);

  const fly = useCallback(() => {
    if (!current || current.type !== 'flight_plan' || blocked || allChallengesComplete || loaded === 0) return;
    const c = current, run = flyTrip(c, loaded);
    SoundManager.select();
    setFeedback(''); setLastFlight(null);
    // No animation frames (a headless host): the flight's outcome is the same, so check it at once.
    if (typeof requestAnimationFrame !== 'function') { land(c, run); return; }
    const reduce = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const total = flightSeconds(c, run, reduce);
    setFlying(true); setFlownNow(0);
    const t0 = performance.now();
    const frame = (now: number) => {
      const k = Math.min(1, (now - t0) / 1000 / total);
      setFlownNow(run.flown * k);
      if (k >= 1) { land(c, run); return; }
      animRef.current = requestAnimationFrame(frame);
    };
    animRef.current = requestAnimationFrame(frame);
  }, [current, blocked, allChallengesComplete, loaded, land]);

  const changeTanks = useCallback((delta: number) => {
    if (blocked) return;
    SoundManager.select();
    setLoaded(n => Math.max(0, Math.min(MAX_TANKS, n + delta)));
    // A changed load puts the plane back at the start airport.
    setFlownNow(0);
  }, [blocked]);

  // ── Evaluation: submit once, only under an evaluation provider ────────────
  useEffect(() => {
    if (!allChallengesComplete || hasSubmitted || challenges.length === 0 || !progress.recordsEvaluation) return;
    const total = challenges.length;
    const correctCount = challengeResults.filter(r => r.correct).length;
    const attemptsCount = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const firstTryCount = challengeResults.filter(r => r.correct && r.attempts === 1).length;
    const accuracy = Math.round(challengeResults.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0)
      / Math.max(total, 1));
    const metrics: AirplaneDioramaMetrics = {
      type: 'airplane-diorama', challengeType, totalChallenges: total, correctCount, attemptsCount, firstTryCount,
      hintsViewed: 0, overallAccuracy: accuracy, averageAttemptsPerChallenge: Math.round((attemptsCount / total) * 10) / 10,
    };
    submitResult(correctCount === total, accuracy, metrics, { challengeResults });
  }, [allChallengesComplete, hasSubmitted, challenges, challengeType, challengeResults, submitResult, progress.recordsEvaluation]);

  // The finale: every item done, the jet takes off.
  useEffect(() => { if (allChallengesComplete) setFocus({ part: 'overview', key: 'finale' }); }, [allChallengesComplete]);

  // What the tutor and the observer see, republished every render.
  useLayoutEffect(() => {
    if (!current) return;
    workspace.current = airplaneScene(current, { tapped, taps, showing: solved, loaded, flights, lastFlight });
  });

  const localScore = useMemo(() => phaseResults.length
    ? Math.round(phaseResults.reduce((s, p) => s + p.score, 0) / phaseResults.length) : 0, [phaseResults]);

  if (!challenges.length) {
    return <LuminaCard className={className}><LuminaCardContent className="p-6 text-slate-400">Nothing to do on this jet.</LuminaCardContent></LuminaCard>;
  }

  const onFlight = !allChallengesComplete && current?.type === 'flight_plan';
  const shown = solved && current?.type === 'find_part' ? PART_INFO[current.part] : null;
  // The engines spin up for a flight that landed just right; a found part shows itself.
  const showing: AirplanePart | null = !solved || !current ? null : current.type === 'find_part' ? current.part : 'engines';

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LuminaCardTitle>{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="cyan">{gradeBand}</LuminaBadge>
            <LuminaChallengeCounter current={Math.min(currentIndex + 1, challenges.length)} total={challenges.length} />
          </div>
        </div>
        <LuminaCardDescription>{description}</LuminaCardDescription>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localScore)}
            durationMs={elapsedMs} heading="Ready for takeoff!"
            celebrationMessage={findOnly ? 'You found every part. Watch the jet fly!' : 'You did it! Watch the jet fly!'} className="mb-2" />
        )}

        {!allChallengesComplete && current && (
          <LuminaPrompt accent="cyan">
            <div className="text-base">{current.instruction}</div>
          </LuminaPrompt>
        )}

        <PipDock />
        <PipWorkspace className="space-y-3">
          {onFlight && current?.type === 'flight_plan' && (
            <FlightPlanPanel challenge={current} loaded={loaded} flownNow={flownNow}
              landed={flying ? null : lastFlight} flying={flying} disabled={blocked}
              onAdd={() => changeTanks(1)} onRemove={() => changeTanks(-1)} onFly={fly} />
          )}

          <div className="relative overflow-hidden rounded-xl border border-white/10">
            <AirplaneScene className={onFlight ? 'h-[min(34vh,280px)] min-h-[200px] w-full' : 'h-[min(62vh,520px)] min-h-[320px] w-full'}
              airline={airlineName} code={standCode(airlineName)}
              showing={showing} flying={allChallengesComplete}
              focus={focus.part} focusKey={focus.key}
              disabled={blocked || allChallengesComplete || current?.type !== 'find_part'}
              onTapPart={onTapPart} />
            {!onFlight && (
              <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-slate-900/70 px-3 py-1 text-xs text-slate-200">
                Drag to turn · pinch or scroll to zoom · tap a part
              </div>
            )}
          </div>

          {!onFlight && (
            <div className="flex flex-wrap items-center gap-2">
              <LuminaButton tone="ghost" onClick={() => setFocus({ part: 'overview', key: `reset-${Date.now()}` })}>
                Turn back to the start
              </LuminaButton>
              {!allChallengesComplete && taps > 0 && !solved && <span className="text-xs text-slate-400">Taps on this one: {taps}</span>}
            </div>
          )}

          {!allChallengesComplete && feedback && (
            <LuminaFeedbackCard status={solved ? 'correct' : 'incorrect'}
              teachingNote={shown ? <div className="space-y-1 text-sm text-slate-200">
                <div className="font-semibold">{shown.title}</div>
                <p>{shown.fact}</p>
                <p className="text-xs text-slate-400">Watch: {shown.shows}.</p>
              </div> : undefined}>
              <p>{feedback}</p>
            </LuminaFeedbackCard>
          )}
        </PipWorkspace>
      </LuminaCardContent>
    </LuminaCard>
  );
};

const AirplaneDiorama = withWorkspaceOnly<AirplaneDioramaProps>('airplane-diorama', AirplaneDioramaSurface, props => props.data.title);

/**
 * The jet runs only on the teaching workspace: the tutor is present, the jet or the flight is the check,
 * and the runtime moves to the next item. Outside a bound session the "needs the tutor" card shows.
 */
export default AirplaneDiorama;
