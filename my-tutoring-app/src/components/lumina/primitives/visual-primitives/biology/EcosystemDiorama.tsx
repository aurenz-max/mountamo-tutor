'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import {
  LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardDescription, LuminaCardContent,
  LuminaBadge, LuminaButton, LuminaActionButton, LuminaChallengeCounter, LuminaFeedbackCard, LuminaPrompt,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { EcosystemDioramaMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import EcosystemScene, { type LifeState } from './EcosystemScene';
import type { EcoTarget, TankFocus } from './ecosystem3d';
import {
  DAY_DONE, LOG_DAYS, compareAskText, compareFeedback, compareMatches, compareMiss, coolFeedback, coolFill, coolMatches, coolMiss,
  describeCompare, describeCool, describePlant, describeSeasonLog, describeWinter, guessFeedback, plantFeedback, plantGrows,
  plantMatches, plantMiss, readFeedback, seasonLogFeedback, seasonLogMiss, thingOn, winterFeedback, winterMatches, winterMiss,
  type Cover, type EcosystemBand, type EcosystemChallenge, type EcosystemTask, type PlantSetup, type Season, type Side,
  type Weather, type WinterMoves,
} from './ecosystemModel';
import type { Animal, WinterPlace } from './ecosystemLife';
import {
  describeRead, ecosystemAssignment, ecosystemScene, readMatches, readMiss, sunTestFills,
} from './ecosystemWorkspace';
import { CoverTray, DayBadge, PlantTray, SeasonCards, WeatherLog, WinterTray } from './EcosystemPanels';

export type { EcosystemChallenge } from './ecosystemModel';

// ============================================================================
// Data contract
// ============================================================================

export interface EcosystemDioramaData {
  title: string;
  description: string;
  /** 4-6 items. REQUIRED. Every thing, record, plant, animal and result is chosen by code; Gemini supplies the words. */
  challenges: EcosystemChallenge[];
  /** The session's task (one mode), or the last task of a mixed session; each item carries its own `type`. */
  challengeType: EcosystemTask;
  gradeBand: EcosystemBand;
  /** A made-up island name, painted on the sign on the island. */
  islandName: string;
  /** Where the levers start (`config.difficulty`); unused until /add-support-tiers. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<EcosystemDioramaMetrics>) => void;
}

interface EcosystemDioramaProps {
  data: EcosystemDioramaData;
  className?: string;
  runtimeEvalMode?: string;
  runtimePlanItemId?: string;
}

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  plant_needs: { label: 'Plant needs', icon: '🌱', accentColor: 'emerald' },
  sun_test: { label: 'Sun test', icon: '☀️', accentColor: 'amber' },
  season_behavior: { label: 'Winter animals', icon: '🐻', accentColor: 'blue' },
  season_from_log: { label: 'Weather log', icon: '🗓️', accentColor: 'cyan' },
  compare_logs: { label: 'Compare logs', icon: '📊', accentColor: 'purple' },
  keep_it_cool: { label: 'Keep it cool', icon: '⛱️', accentColor: 'orange' },
};

const firstStep = (c: EcosystemChallenge | null): string => {
  switch (c?.type) {
    case 'sun_test': return 'guess';
    case 'keep_it_cool': return 'build';
    case 'season_from_log': case 'compare_logs': return 'play';
    case 'plant_needs': return 'set';
    case 'season_behavior': return 'summer';
    default: return 'guess';
  }
};

const STEP_PROMPT: Record<string, string> = {
  'sun_test:guess': 'Make a guess: tap the one you think will get warmer.',
  'sun_test:run': 'Now move the sun across the sky. Drag the sun along its path, or press Let the day go by.',
  'sun_test:read': 'The day is over. Look at the two thermometers. Tap the one that got warmer.',
  'keep_it_cool:build': 'Pick something to build. Then drag the sun across the sky, or press Let the day go by.',
  'keep_it_cool:run': 'Watch the red line. Does it stay below the blue cool line?',
  'season_from_log:play': 'Press Play the month, or Next day, and watch the weather log fill.',
  'season_from_log:answer': 'Which season was it? Tap a season. Then tap the row of weather in the log that tells you.',
  'compare_logs:play': 'Press Play the months, or Next day, and watch both weather logs fill.',
  'compare_logs:answer': 'Look at both logs. Tap Pick under the one that answers the question.',
  'plant_needs:set': 'Choose where the pot stands, what goes in it, and whether to water it. Then press Watch it grow.',
  'season_behavior:summer': 'Press Bring winter and watch the island change.',
  'season_behavior:move': 'Tap an animal, then tap where it goes for the winter. Press Done when every animal is ready.',
};

const DAY_MS = 420;

/** The teaching workspace is this primitive's only controller: the runtime owns progression. */
const useEcosystemProgress = useWorkspaceProgressFor('ecosystem-diorama');

const EcosystemDioramaSurface: React.FC<EcosystemDioramaProps> = ({ data, className, runtimePlanItemId }) => {
  const { title, description, challenges = [], challengeType, gradeBand, islandName, instanceId, skillId, subskillId,
    objectiveId, exhibitId, onEvaluationSubmit } = data;
  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceId = useRef(instanceId || `ecosystem-diorama-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  const [step, setStep] = useState<string>(() => firstStep(challenges[0] ?? null));
  // sun_test + keep_it_cool
  const [guess, setGuess] = useState<Side | null>(null);
  const [sunP, setSunP] = useState(0);
  const [picked, setPicked] = useState<Side | null>(null);
  const [cover, setCover] = useState<Cover | null>(null);
  // logs
  const [daysShown, setDaysShown] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [season, setSeason] = useState<Season | null>(null);
  const [evidence, setEvidence] = useState<Weather | null>(null);
  const [logPick, setLogPick] = useState<'a' | 'b' | null>(null);
  // plant_needs
  const [setup, setSetup] = useState<PlantSetup>(() => {
    const c = challenges[0];
    return c?.type === 'plant_needs' ? { ...c.start, extras: [...c.start.extras] } : { spot: 'sun', fill: 'empty', watered: false, extras: [] };
  });
  const [grown, setGrown] = useState<'grew' | 'drooped' | null>(null);
  // season_behavior
  const [winter, setWinter] = useState(false);
  const [moves, setMoves] = useState<WinterMoves>({});
  const [holding, setHolding] = useState<Animal | null>(null);

  const [verdict, setVerdict] = useState<'correct' | 'incorrect' | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; status: 'correct' | 'incorrect' | 'insight' } | null>(null);
  const [testKey, setTestKey] = useState('test-0');
  const [autoRunKey, setAutoRunKey] = useState<string | null>(null);
  const [viewKey, setViewKey] = useState('start');
  const [guessesMatched, setGuessesMatched] = useState(0);
  const guessScored = useRef<Set<string>>(new Set());

  const progress = useEcosystemProgress<EcosystemChallenge>({
    challenges, getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: ecosystemAssignment,
    // A fresh item resets the world for its task. Try again keeps what the learner set up and what the world showed
    // (the finished day, the filled logs, the pot, the animals' places) and clears only the answer.
    onItemOpened: (index, retry) => {
      const c = challenges[index] ?? null;
      setVerdict(null); setPicked(null); setFeedback(null); setAutoRunKey(null); setHolding(null);
      if (retry) {
        if (c?.type === 'keep_it_cool') { setSunP(0); setStep('build'); }
        if (c?.type === 'season_from_log' || c?.type === 'compare_logs') { setSeason(null); setEvidence(null); setLogPick(null); }
        if (c?.type === 'plant_needs') setGrown(null);
        return;
      }
      setStep(firstStep(c)); setGuess(null); setSunP(0); setCover(null);
      setDaysShown(0); setPlaying(false); setSeason(null); setEvidence(null); setLogPick(null);
      setSetup(c?.type === 'plant_needs' ? { ...c.start, extras: [...c.start.extras] } : { spot: 'sun', fill: 'empty', watered: false, extras: [] });
      setGrown(null); setWinter(false); setMoves({});
      setTestKey(`test-${index}-${Date.now()}`);
    },
  });
  const { currentIndex, results: challengeResults, isComplete } = progress;
  const allChallengesComplete = isComplete || !!progress.practiceSummary;
  const blocked = progress.canAttempt === false || verdict === 'correct';
  const current = challenges[currentIndex] ?? null;
  const logTotal = current?.type === 'compare_logs' ? LOG_DAYS * 2 : LOG_DAYS;

  const phaseResults = usePhaseResults({
    challenges, results: challengeResults, isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type, phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) => Math.round(rs.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0)
      / Math.max(rs.length, 1)),
  });

  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<EcosystemDioramaMetrics>({
    primitiveType: 'ecosystem-diorama', instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  /** Commit the item's check through the runtime; a correct one also records its score. */
  const commit = useCallback((work: string, correct: boolean, miss: string | undefined, text: string) => {
    if (!current) return;
    setVerdict(correct ? 'correct' : 'incorrect');
    setFeedback({ text, status: correct ? 'correct' : 'incorrect' });
    if (correct) SoundManager.playCorrect(); else SoundManager.playIncorrect();
    progress.commitCheck(work, correct, miss);
    if (correct) {
      const attempts = progress.currentAttempts + 1;
      progress.mergeResult({ challengeId: current.id, correct: true, attempts, score: Math.max(20, 100 - 30 * (attempts - 1)) });
    }
  }, [current, progress]);

  // ── Taps in the tank (and their button twins) ─────────────────────────────
  const onTap = useCallback((target: Exclude<EcoTarget, 'sun'>) => {
    if (!current || blocked || allChallengesComplete) return;
    if (current.type === 'sun_test' && (target === 'left' || target === 'right')) {
      const side = target;
      if (step === 'guess' || (step === 'run' && sunP <= 0.02)) {
        setGuess(side); setStep('run'); setFeedback(null); SoundManager.select();
        return;
      }
      if (step === 'run') {
        setFeedback({ text: 'Keep the sun moving until the day is over, then read the thermometers.', status: 'insight' });
        return;
      }
      const correct = readMatches(current, side);
      setPicked(side);
      const g = correct ? guessFeedback(current, guess) : null;
      commit(describeRead(current, guess, side), correct, readMiss(current, side), [readFeedback(current, side), g].filter(Boolean).join(' '));
      if (correct && guess && !guessScored.current.has(current.id)) {
        guessScored.current.add(current.id);
        if (guess === current.warmer) setGuessesMatched(n => n + 1);
      }
      return;
    }
    if (current.type === 'season_behavior' && step === 'move') {
      if (target.startsWith('animal:')) {
        const a = target.slice(7) as Animal;
        if (current.animals.includes(a)) { setHolding(h => (h === a ? null : a)); SoundManager.select(); }
      } else if (target.startsWith('place:') && holding) {
        const place = target.slice(6) as WinterPlace;
        setMoves(m => ({ ...m, [holding]: place })); setHolding(null); setFeedback(null); SoundManager.tap();
      }
    }
  }, [current, blocked, allChallengesComplete, step, sunP, guess, holding, commit]);

  // ── Moving the sun (sun_test and keep_it_cool) ────────────────────────────
  const onSun = useCallback((p: number) => {
    if (!current || blocked) return;
    if (current.type === 'keep_it_cool') {
      if (step === 'build') setStep('run');
      else if (step !== 'run') return;
      if (p >= DAY_DONE) {
        setSunP(1); setStep('done'); setAutoRunKey(null);
        commit(describeCool(cover), coolMatches(cover), coolMiss(cover), coolFeedback(current, cover));
        return;
      }
      setSunP(p);
      return;
    }
    if (current.type !== 'sun_test' || step !== 'run') return;
    if (p >= DAY_DONE) { setSunP(1); setStep('read'); setAutoRunKey(null); setFeedback(null); return; }
    setSunP(p);
  }, [current, blocked, step, cover, commit]);

  // ── Playing the weather month(s) ──────────────────────────────────────────
  const nextDay = useCallback(() => {
    setDaysShown(d => Math.min(d + 1, logTotal));
  }, [logTotal]);
  useEffect(() => {
    if (!playing) return;
    if (daysShown >= logTotal) { setPlaying(false); return; }
    const t = setTimeout(nextDay, DAY_MS);
    return () => clearTimeout(t);
  }, [playing, daysShown, logTotal, nextDay]);
  useEffect(() => {
    if ((current?.type === 'season_from_log' || current?.type === 'compare_logs') && step === 'play' && daysShown >= logTotal) {
      setStep('answer'); setPlaying(false);
    }
  }, [current, step, daysShown, logTotal]);

  const pickEvidence = (w: Weather) => {
    if (!current || current.type !== 'season_from_log' || blocked || step !== 'answer') return;
    if (!season) { setFeedback({ text: 'First tap a season card. Then tap the weather that tells you.', status: 'insight' }); return; }
    setEvidence(w);
    const miss = seasonLogMiss(current, season, w);
    commit(describeSeasonLog(season, w), !miss, miss, seasonLogFeedback(current, season, w));
  };
  const pickLog = (pick: 'a' | 'b') => {
    if (!current || current.type !== 'compare_logs' || blocked || step !== 'answer') return;
    setLogPick(pick);
    commit(describeCompare(current, pick), compareMatches(current, pick), compareMiss(current, pick), compareFeedback(current, pick));
  };

  // ── The plant ─────────────────────────────────────────────────────────────
  const watchItGrow = () => {
    if (!current || current.type !== 'plant_needs' || blocked) return;
    setGrown(plantGrows(setup) ? 'grew' : 'drooped');
    commit(describePlant(setup), plantMatches(setup), plantMiss(setup), plantFeedback(current, setup));
  };

  // ── Winter ────────────────────────────────────────────────────────────────
  const winterDone = () => {
    if (!current || current.type !== 'season_behavior' || blocked || step !== 'move') return;
    if (current.animals.some(a => !moves[a])) {
      setFeedback({ text: 'Some animals have not moved yet. Help every animal get ready for winter.', status: 'insight' });
      return;
    }
    commit(describeWinter(current, moves), winterMatches(current, moves), winterMiss(current, moves), winterFeedback(current, moves));
  };

  // ── Evaluation: submit once, only under an evaluation provider ────────────
  useEffect(() => {
    if (!allChallengesComplete || hasSubmitted || challenges.length === 0 || !progress.recordsEvaluation) return;
    const total = challenges.length;
    const correctCount = challengeResults.filter(r => r.correct).length;
    const attemptsCount = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const firstTryCount = challengeResults.filter(r => r.correct && r.attempts === 1).length;
    const accuracy = Math.round(challengeResults.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0)
      / Math.max(total, 1));
    const metrics: EcosystemDioramaMetrics = {
      type: 'ecosystem-diorama', challengeType, totalChallenges: total, correctCount, attemptsCount, firstTryCount,
      hintsViewed: 0, overallAccuracy: accuracy, averageAttemptsPerChallenge: Math.round((attemptsCount / total) * 10) / 10,
      guessesMatched,
    };
    submitResult(correctCount === total, accuracy, metrics, { challengeResults });
  }, [allChallengesComplete, hasSubmitted, challenges, challengeType, challengeResults, submitResult, progress.recordsEvaluation, guessesMatched]);

  // ── Pip: the tank as a whole; never one answer ────────────────────────────
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: allChallengesComplete || hasSubmitted || !current ? null : current.id,
    label: 'The island tank',
    solved: verdict === 'correct',
    tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId),
  });

  // What the tutor and the observer see, republished every render.
  useLayoutEffect(() => {
    if (!current) return;
    workspace.current = { ...ecosystemScene(current, {
      step, guess, sunP, lastPick: picked, daysShown, season, evidence, logPick, plant: setup, grown, moves, holding, cover,
    }) };
  });

  const localScore = useMemo(() => phaseResults.length
    ? Math.round(phaseResults.reduce((s, p) => s + p.score, 0) / phaseResults.length) : 0, [phaseResults]);

  // ── What the tank shows ───────────────────────────────────────────────────
  const todayWeather: Weather | null = useMemo(() => {
    if (!current || daysShown <= 0) return null;
    if (current.type === 'season_from_log') return current.days[Math.min(daysShown, LOG_DAYS) - 1];
    if (current.type === 'compare_logs') {
      return daysShown <= LOG_DAYS ? current.a.days[daysShown - 1] : current.b.days[Math.min(daysShown - LOG_DAYS, LOG_DAYS) - 1];
    }
    return null;
  }, [current, daysShown]);

  const life: LifeState = useMemo(() => ({
    weather: todayWeather,
    winter: current?.type === 'season_behavior' && winter ? 1 : 0,
    animals: current?.type === 'season_behavior'
      ? current.animals.map(kind => ({ kind, place: moves[kind] ?? ('summer' as const) })) : null,
    placesActive: current?.type === 'season_behavior' && step === 'move' && !!holding,
    holding,
    plant: current?.type === 'plant_needs' ? {
      kind: current.plant, setup,
      growth: grown === 'grew' ? 1 : grown === 'drooped' ? (current.variant === 'fix' ? 0.6 : 0.25) : current.variant === 'fix' ? 0.6 : 0.05,
      droop: grown === 'grew' ? 0 : grown === 'drooped' ? 1 : current.variant === 'fix' ? 0.8 : 0,
    } : null,
    cool: current?.type === 'keep_it_cool' ? { thing: current.thing, cover, fill: coolFill(cover, sunP) } : null,
  }), [current, todayWeather, winter, moves, step, holding, setup, grown, cover, sunP]);

  const fills = useMemo(() => (current?.type === 'sun_test' ? sunTestFills(current, sunP) : { left: 0.1, right: 0.1 }), [current, sunP]);
  const sunDraggable = !blocked && !allChallengesComplete
    && ((current?.type === 'sun_test' && step === 'run') || (current?.type === 'keep_it_cool' && (step === 'build' || step === 'run')));
  const focus: TankFocus = !current || allChallengesComplete ? 'test'
    : current.type === 'season_behavior' ? 'island'
      : current.type === 'season_from_log' || current.type === 'compare_logs' ? 'sky'
        : step === 'run' ? 'sky' : 'test';
  const shownSun = current?.type === 'sun_test' || current?.type === 'keep_it_cool' ? sunP : 0.5;

  if (!challenges.length) {
    return <LuminaCard className={className}><LuminaCardContent className="p-6 text-slate-400">Nothing to do in the tank yet.</LuminaCardContent></LuminaCard>;
  }

  const hint = !current ? '' : current.type === 'sun_test' || current.type === 'keep_it_cool'
    ? (sunDraggable ? 'Drag the sun across the sky · drag the tank to turn it' : 'Tap a thing on the sand · drag to turn the tank')
    : current.type === 'season_behavior' ? 'Tap an animal, then a winter place · drag to turn the tank' : 'Drag to turn the tank';

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
            durationMs={elapsedMs} heading="Island work done!" celebrationMessage="You watched, tested and figured it out like a scientist." className="mb-2" />
        )}

        {!allChallengesComplete && current && (
          <LuminaPrompt accent="amber">
            <div className="text-base">{current.instruction}</div>
            <div className="mt-1 text-sm text-amber-100/80" data-ecosystem-step={step}>{STEP_PROMPT[`${current.type}:${step}`] ?? ''}</div>
          </LuminaPrompt>
        )}

        {pip.store && <div {...pip.dock} />}
        <div {...pip.workspace} className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border border-white/10">
            <EcosystemScene className="h-[min(64vh,560px)] min-h-[340px] w-full"
              islandName={islandName}
              test={current?.type === 'sun_test' ? { left: current.left, right: current.right } : null} testKey={testKey}
              fills={fills} sunP={shownSun} guess={guess} picked={picked} verdict={verdict}
              sunActive={sunDraggable} finale={allChallengesComplete}
              autoRunKey={autoRunKey} onSun={onSun} onTap={onTap} life={life}
              focus={focus} viewKey={viewKey} disabled={blocked || allChallengesComplete} />
            <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-slate-900/70 px-3 py-1 text-xs text-slate-200">{hint}</div>
            {todayWeather && <div className="pointer-events-none absolute right-3 top-3"><DayBadge weather={todayWeather} /></div>}
          </div>

          {!allChallengesComplete && current && (
            <>
              {current.type === 'keep_it_cool' && (
                <CoverTray covers={current.covers} picked={cover} onPick={c => { setCover(c); setFeedback(null); SoundManager.select(); }}
                  disabled={blocked || step !== 'build'} />
              )}
              {current.type === 'plant_needs' && (
                <PlantTray setup={setup} onChange={s => { setSetup(s); setGrown(null); setFeedback(null); SoundManager.select(); }}
                  disabled={blocked || verdict === 'incorrect'} />
              )}
              {current.type === 'season_behavior' && step === 'move' && (
                <WinterTray animals={current.animals} moves={moves} holding={holding}
                  onHold={a => onTap(`animal:${a}`)} onPlace={p => onTap(`place:${p}`)} disabled={blocked} />
              )}
              {current.type === 'season_from_log' && (
                <div className="space-y-3">
                  {step === 'answer' && (
                    <SeasonCards picked={season} onPick={s => { setSeason(s); setEvidence(null); setFeedback(null); SoundManager.select(); }} disabled={blocked} />
                  )}
                  <WeatherLog label="This month" days={current.days} shown={daysShown}
                    pickRow={step === 'answer' ? pickEvidence : undefined} pickedRow={evidence} disabled={blocked} />
                </div>
              )}
              {current.type === 'compare_logs' && (
                <div className="space-y-2">
                  {step === 'answer' && <LuminaBadge accent="purple">{compareAskText(current.ask)}</LuminaBadge>}
                  <div className="grid gap-3 md:grid-cols-2">
                    <WeatherLog label={current.a.label} days={current.a.days} shown={Math.min(daysShown, LOG_DAYS)}
                      onPick={step === 'answer' ? () => pickLog('a') : undefined} picked={logPick === 'a'} disabled={blocked} />
                    <WeatherLog label={current.b.label} days={current.b.days} shown={Math.max(0, daysShown - LOG_DAYS)}
                      onPick={step === 'answer' ? () => pickLog('b') : undefined} picked={logPick === 'b'} disabled={blocked} />
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!allChallengesComplete && current && ((current.type === 'sun_test' && step === 'run') || (current.type === 'keep_it_cool' && step !== 'done')) && (
              <LuminaButton tone="primary" onClick={() => { if (current.type === 'keep_it_cool' && step === 'build') setStep('run'); setAutoRunKey(`run-${Date.now()}`); }}
                disabled={!sunDraggable || !!autoRunKey}>
                Let the day go by
              </LuminaButton>
            )}
            {!allChallengesComplete && current && (current.type === 'season_from_log' || current.type === 'compare_logs') && step === 'play' && (
              <>
                <LuminaButton tone="primary" onClick={() => setPlaying(true)} disabled={playing || blocked}>
                  {current.type === 'compare_logs' ? 'Play the months' : 'Play the month'}
                </LuminaButton>
                <LuminaButton tone="ghost" onClick={nextDay} disabled={playing || blocked}>Next day</LuminaButton>
              </>
            )}
            {!allChallengesComplete && current?.type === 'plant_needs' && (
              <LuminaActionButton action="check" onClick={watchItGrow} disabled={blocked || verdict === 'incorrect'}>Watch it grow</LuminaActionButton>
            )}
            {!allChallengesComplete && current?.type === 'season_behavior' && step === 'summer' && (
              <LuminaButton tone="primary" onClick={() => { setWinter(true); setStep('move'); SoundManager.select(); }} disabled={blocked}>
                Bring winter ❄️
              </LuminaButton>
            )}
            {!allChallengesComplete && current?.type === 'season_behavior' && step === 'move' && (
              <LuminaActionButton action="check" onClick={winterDone} disabled={blocked}>Done</LuminaActionButton>
            )}
            {!allChallengesComplete && current?.type === 'sun_test' && guess && (
              <LuminaBadge accent="amber">Your guess: {thingOn(current, guess).name}</LuminaBadge>
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

const EcosystemDiorama = withWorkspaceOnly<EcosystemDioramaProps>('ecosystem-diorama',
  EcosystemDioramaSurface, props => props.data.title);

/**
 * The island tank runs only on the teaching workspace: the tutor is present, each task's own check commits, and the
 * runtime moves to the next item. Outside a bound session the "needs the tutor" card shows.
 */
export default EcosystemDiorama;
