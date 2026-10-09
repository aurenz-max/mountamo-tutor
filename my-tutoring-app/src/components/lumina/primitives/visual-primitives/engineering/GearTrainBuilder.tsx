'use client';

/**
 * Gear Train Builder - build a gear train that makes the last gear turn the way, and at the speed, the job asks
 * (K-5 engineering: meshed gears reverse, small gears driven by big ones turn faster, idlers change only the way).
 *
 * Three open builds (/add-eval-modes references/build-mode.md), each on an EMPTY track:
 * - `build_direction`: the last gear turns the same way as (or opposite to) the first, with at least N gears.
 * - `build_speed`: the last gear turns faster (or slower) than the first, sometimes also a way.
 * - `build_ratio`: the last gear turns exactly 3 times per turn of the first (or once per 2...), sometimes also a way.
 * The learner taps a gear size to add it to the end of the train, where it meshes with the gear before; tapping a
 * gear takes it out. "I'm done!" turns the crank and checks the last gear with code (`gearMiss`). Many trains pass.
 * Code owns every target (`gearChallenges`); the model writes only the title.
 *
 * On the shared teaching workspace (W1) every check commits through `progress.commitCheck` with the train in words and
 * a named miss; the runtime owns progression, so the scripted Next is hidden there and the scored session is
 * submitted from `onFinished`.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaActionButton, LuminaButton, LuminaCallout, LuminaCard, LuminaCardContent, LuminaCardDescription, LuminaCardHeader,
  LuminaCardTitle, LuminaFeedbackCard,
} from '../../../ui';
import { usePrimitiveEvaluation, type GearTrainMetrics, type PrimitiveEvaluationResult } from '../../../evaluation';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { useBuildWatcher } from '../../build-layer/buildLayer';
import {
  MAX_GEARS, TEETH, WATCH_NEVER_SAY, describeTrain, gearMiss, workspaceAssignment, workspaceScene,
  type GearChallenge, type GearMiss, type GearMode, type TrainGear,
} from './gearWorkspace';
import { ARROWS_LEVER, SPIN_LEVER, gearLevers, leverFacts, simplerTrain } from './gearLevers';
import { GearScene } from './GearScene';

export type { GearChallenge, GearMode, TrainGear } from './gearWorkspace';

export interface GearTrainBuilderData {
  title: string;
  /** The eval mode pinned for this session; 'mixed' when the session holds every tier the band builds. */
  challengeType?: GearMode | 'mixed';
  /** The trains to build, written by code (`gearChallenges`). */
  challenges: GearChallenge[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<GearTrainMetrics>) => void;
}

export interface GearTrainBuilderProps {
  data: GearTrainBuilderData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

const PHASE_CONFIG: Record<string, PhaseConfig> = {
  build_direction: { label: 'Which way', icon: '🔄', accentColor: 'purple' },
  build_speed: { label: 'Faster or slower', icon: '⚙️', accentColor: 'blue' },
  build_ratio: { label: 'Exact turns', icon: '🔢', accentColor: 'amber' },
};

const phaseScore = (attempts: number) => (attempts <= 0 ? 0 : Math.max(20, 100 - (attempts - 1) * 20));

/** The check's words: what the last gear did wrong, never which gear to add or change. */
const GEAR_FEEDBACK: Record<GearMiss, string> = {
  too_few_gears: 'Not yet. Your train needs more gears for this job.',
  not_faster: 'Not yet. Your last gear does not turn faster than the first gear.',
  not_slower: 'Not yet. Your last gear does not turn slower than the first gear.',
  too_fast: 'Not yet. Your last gear turns too many times for each turn of the first gear.',
  too_slow: 'Not yet. Your last gear turns too few times for each turn of the first gear.',
  wrong_direction: 'Not yet. Your last gear turns the wrong way.',
};
const PASS_FEEDBACK = 'Yes! Your last gear does just what the job asks.';

/** A check spins the crank twice; the lever's trial spin six times (whole turns for every ratio asked). */
const CHECK_TURNS = 2, TRY_TURNS = 6, SPIN_MS_PER_TURN = 600;

const GearTrainBuilderSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  GearTrainBuilderProps & { tutorOwned: boolean; useController: (options: ProgressOptions<GearChallenge>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;
  const challenges = useMemo(() => (data.challenges ?? []).filter(c => PHASE_CONFIG[c.type]), [data.challenges]);

  const stableInstanceId = useRef(instanceId || `gear-train-builder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges,
    getChallengeId: c => c.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, results, isComplete, mergeResult, advance } = progress;
  const learnerBlocked = () => tutorOwned && progress.canAttempt === false;

  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<GearChallenge | null>(null);
  const sessionChallenge = challenges[currentIndex] ?? null;
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);

  // ── Per-item state ────────────────────────────────────────────
  const [train, setTrain] = useState<TrainGear[]>([]);
  const [crank, setCrank] = useState(0);
  const [counts, setCounts] = useState<{ first: number; last: number } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; correct: boolean } | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [challengeDone, setChallengeDone] = useState(false);
  const recordedRef = useRef(false);
  const nextId = useRef(0);
  const spinFrame = useRef<number | null>(null);

  const stopSpin = () => { if (spinFrame.current !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(spinFrame.current); spinFrame.current = null; };
  useEffect(() => stopSpin, []);

  const resetFor = useRef<string | null>(null);
  const resetItem = (challenge: GearChallenge) => {
    resetFor.current = challenge.id;
    stopSpin();
    setTrain([]); setCrank(0); setCounts(null); setHint(null); setFeedback(null); setAttempts(0); setChallengeDone(false);
    recordedRef.current = false;
  };
  useEffect(() => {
    if (currentChallenge && resetFor.current !== currentChallenge.id) resetItem(currentChallenge);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge?.id]);

  // Try again KEEPS the train and the verdict's words, so the learner revises it.
  openItem.current = (index, retry) => {
    if (!retry) {
      setPractice(null);
      if (challenges[index]) resetItem(challenges[index]);
      return;
    }
    stopSpin(); setCounts(null);
  };

  // ── Evaluation ────────────────────────────────────────────────
  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<GearTrainMetrics>({
    primitiveType: 'gear-train-builder',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  const phaseResults = usePhaseResults({
    challenges, results, isComplete,
    getChallengeType: c => c.type,
    phaseConfig: PHASE_CONFIG,
    getScore: rs => (rs.length ? Math.round(rs.reduce((s, r) => s + Number(r.score ?? 0), 0) / rs.length) : 0),
  });

  const sessionMetrics = (built: number, accuracy: number, attemptsCount: number, firstTry: number): GearTrainMetrics => ({
    type: 'gear-train-builder', challengeType: data.challengeType ?? 'mixed', totalTrains: challenges.length, trainsBuilt: built,
    accuracy, attemptsCount, firstTryCount: firstTry,
  });

  const sessionSubmitted = useRef(false);
  useEffect(() => {
    if (!isComplete || sessionSubmitted.current || tutorOwned || hasSubmitted) return;
    sessionSubmitted.current = true;
    const built = results.filter(r => r.correct).length;
    const accuracy = Math.round(results.reduce((s, r) => s + Number(r.score ?? 0), 0) / Math.max(1, results.length));
    submitResult(built === challenges.length, accuracy, sessionMetrics(built, accuracy, results.reduce((s, r) => s + r.attempts, 0),
      results.filter(r => Number(r.score ?? 0) === 100).length), { studentWork: { targets: challenges } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, results, challenges, tutorOwned, hasSubmitted, submitResult]);

  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false) return;
    submitResult(result.passed, result.accuracy,
      sessionMetrics(result.solvedCount, result.accuracy, result.attemptsCount, result.firstTryCount),
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── Building ──────────────────────────────────────────────────
  const buildOpen = !challengeDone && !learnerBlocked();
  const changed = () => { stopSpin(); setCrank(0); setCounts(null); setHint(null); };

  const addGear = (teeth: number) => {
    if (!buildOpen) return;
    if (train.length >= MAX_GEARS) { SoundManager.invalid(); setHint(`The track holds ${MAX_GEARS} gears.`); return; }
    SoundManager.snap();
    changed();
    setTrain(prev => [...prev, { id: `g${++nextId.current}`, teeth }]);
  };
  const removeGear = (id: string) => {
    if (!buildOpen) return;
    SoundManager.tap();
    changed();
    setTrain(prev => prev.filter(g => g.id !== id));
  };
  const clearAll = () => { if (!buildOpen) return; changed(); setTrain([]); };

  /** Turn the crank `turns` times over time; with `count`, show the first and last gear's whole turns as they go. */
  const spin = (turns: number, count: boolean) => {
    stopSpin();
    const ratio = train.length > 1 ? train[0].teeth / train[train.length - 1].teeth : 1;
    const total = turns * SPIN_MS_PER_TURN;
    if (typeof requestAnimationFrame !== 'function') {
      setCrank(turns * 360);
      if (count) setCounts({ first: turns, last: Math.floor(turns * ratio + 1e-9) });
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const f = Math.min(1, (now - start) / total), deg = f * turns * 360;
      setCrank(deg);
      if (count) setCounts({ first: Math.floor(deg / 360 + 1e-9), last: Math.floor((deg * ratio) / 360 + 1e-9) });
      spinFrame.current = f < 1 ? requestAnimationFrame(step) : null;
    };
    spinFrame.current = requestAnimationFrame(step);
  };

  // ── Check ─────────────────────────────────────────────────────
  const completeCurrent = (attemptsCount: number) => {
    if (!currentChallenge || recordedRef.current) return;
    recordedRef.current = true;
    setChallengeDone(true);
    if (!practice) mergeResult({ challengeId: currentChallenge.id, correct: true, attempts: attemptsCount, score: phaseScore(attemptsCount) });
  };

  const checkTrain = () => {
    if (!currentChallenge || !buildOpen || !train.length) return;
    const miss = gearMiss(currentChallenge, train);
    const next = attempts + 1;
    setAttempts(next);
    setHint(null); setCounts(null);
    spin(CHECK_TURNS, false);
    progress.commitCheck(describeTrain(train), !miss, miss);
    if (!miss) {
      SoundManager.playCorrect();
      setFeedback({ text: PASS_FEEDBACK, correct: true });
      completeCurrent(next);
      return;
    }
    SoundManager.playIncorrect();
    setFeedback({ text: GEAR_FEEDBACK[miss], correct: false });
  };

  // ── Workspace path ────────────────────────────────────────────
  useLayoutEffect(() => {
    if (!tutorOwned || !currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, train);
    const onScreen = practice ? '' : leverFacts(sessionChallenge, pulledLevers);
    const levers = practice ? [] : gearLevers(sessionChallenge, pulledLevers);
    workspace.current = {
      ...scene,
      ...(onScreen ? { facts: { ...scene.facts, onScreen } } : {}),
      levers,
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = simplerTrain(sessionChallenge);
          if (!easier) return 'This item has no easier ask; try a help lever.';
          setLeverState(pulled); resetItem(easier); setPractice(easier);
          return { practice: workspaceAssignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { resetItem(sessionChallenge); setPractice(null); },
    };
  });

  // ── The live line: what the train looks like, never how the last gear turns ──
  const sceneRef = useRef<SVGSVGElement | null>(null);
  const buildSeeing = useBuildWatcher({
    buildKey: train.map(g => `${g.id}:${g.teeth}`).join('|'),
    enabled: buildOpen && train.length > 0,
    svg: sceneRef,
    request: {
      task: currentChallenge?.instruction ?? '',
      sceneNote: 'A dark track with a dashed line. The learner adds coloured gears in a row; the first gear has a white crank handle.',
      numbers: 'never',
      neverSay: WATCH_NEVER_SAY,
    },
  });

  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: isComplete ? null : currentChallenge?.id ?? null,
    label: 'The gear train and the gear tray',
    solved: challengeDone,
    tutorSpeaking: false,
  });

  // ── Render ─────────────────────────────────────────────────────
  if (!challenges.length) return <div className={`w-full p-8 text-center text-slate-400 ${className ?? ''}`}>No gear trains to build.</div>;
  if (isComplete) {
    return (
      <div className={`w-full max-w-5xl mx-auto my-8 ${className ?? ''}`}>
        <PhaseSummaryPanel phases={phaseResults} overallScore={submittedResult?.score} durationMs={elapsedMs}
          heading="Gear Trains Complete" celebrationMessage="You built every gear train!" />
      </div>
    );
  }

  const angles = train.map((g, i) => crank * (train[0].teeth / g.teeth) * (i % 2 === 0 ? 1 : -1));
  const arrows = leverOn(ARROWS_LEVER) ? train.map((_, i) => (i % 2 === 0 ? 1 : -1) as 1 | -1) : null;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader>
        <LuminaCardTitle>{title || 'Gear Train Builder'}</LuminaCardTitle>
        <LuminaCardDescription>Tap a gear to add it to the end of your train. Tap a gear in the train to take it out.</LuminaCardDescription>
      </LuminaCardHeader>
      <LuminaCardContent className="space-y-5">
        <div className="space-y-1 text-center">
          {challenges.length > 1 && (
            <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Train {currentIndex + 1} / {challenges.length}{practice ? ' · practice' : ''}
            </p>
          )}
          <h4 className="text-lg font-semibold text-violet-200">{currentChallenge?.instruction}</h4>
        </div>

        {pip.store && <div {...pip.dock} />}
        <div {...pip.workspace} className="space-y-4">
          <GearScene ref={sceneRef} train={train} angles={angles} arrows={arrows} counts={counts} disabled={!buildOpen} onTapGear={removeGear} />
          <div className="flex min-h-8 items-center justify-center" aria-live="polite" data-testid="build-watcher">
            {buildSeeing && <span className="rounded-full bg-white/10 px-4 py-1.5 text-base text-violet-100">👀 {buildSeeing}</span>}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Gear tray">
            {TEETH.map(t => (
              <LuminaButton key={t} tone="ghost" disabled={!buildOpen} aria-label={`Add a ${t}-tooth gear`} data-pip-object={`tray-${t}`}
                onClick={() => addGear(t)} className="min-h-11 !h-auto gap-2 px-3 py-2">
                <svg width={Math.round(t * 0.9) + 6} height={Math.round(t * 0.9) + 6} aria-hidden="true">
                  <circle cx={(t * 0.9 + 6) / 2} cy={(t * 0.9 + 6) / 2} r={t * 0.45} fill="#a78bfa" />
                </svg>
                <span>{t} teeth</span>
              </LuminaButton>
            ))}
          </div>
        </div>

        {hint && <LuminaCallout accent="amber" label="Hint" className="p-3">{hint}</LuminaCallout>}
        {feedback && (
          <LuminaFeedbackCard status={feedback.correct ? 'correct' : 'incorrect'} label={feedback.correct ? 'Yes' : 'Not yet'}>
            {feedback.text}
          </LuminaFeedbackCard>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {!challengeDone ? (
            <>
              <LuminaButton disabled={!buildOpen || !train.length} onClick={clearAll}>Clear</LuminaButton>
              {leverOn(SPIN_LEVER) && (
                <LuminaButton disabled={!buildOpen || train.length < 2} onClick={() => spin(TRY_TURNS, true)}>Turn the crank</LuminaButton>
              )}
              <LuminaButton tone="primary" disabled={!buildOpen || !train.length} onClick={checkTrain}>I&apos;m done!</LuminaButton>
            </>
          ) : !tutorOwned && currentIndex + 1 < challenges.length && !practice ? (
            <LuminaActionButton action="next" onClick={() => advance()}>Next train →</LuminaActionButton>
          ) : null}
        </div>
      </LuminaCardContent>
    </LuminaCard>
  );
};

const GearTrainBuilder = withWorkspaceController<GearTrainBuilderProps, ProgressOptions<GearChallenge>, Progress>(
  'gear-train-builder', GearTrainBuilderSurface, useScriptedProgress, useWorkspaceProgressFor('gear-train-builder'));

export default GearTrainBuilder;
