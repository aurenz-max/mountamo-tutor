'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardDescription, LuminaCardContent,
  LuminaBadge, LuminaButton, LuminaActionButton, LuminaChallengeCounter, LuminaChoiceChip, LuminaFeedbackCard, LuminaPanel,
  LuminaPrompt, LuminaTable,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { WaveTankMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import WaveScene from './WaveScene';
import type { WaveTarget } from './wave3d';
import {
  LEVELS, changed, describeKnock, knockFeedback, knockMatches, knockMiss, knocksDown, runOutcome, runTiming, waveWords,
  wobble, type WaveChallenge, type WaveRun, type WaveTask,
} from './waveModel';
import { knockScene } from './waveWorkspace';
import { waveTankBoss } from './waveTank.boss';
import { CHANGES_LEVER, CREST_LEVER, PRACTICE_NOTE, WAVE_LEVERS, XRAY_LEVER, type WaveLeverCtx } from './waveLevers';
import { leverScene } from '../../../components/live-activity/bossLevers';

export type { WaveChallenge } from './waveModel';

// ============================================================================
// Data contract
// ============================================================================

export interface WaveTankData {
  title: string;
  description: string;
  /** 3-6 items. REQUIRED. Every first wave and tower is chosen by code from the wave model. */
  challenges: WaveChallenge[];
  /** The session's task; each item carries its own `type`. */
  challengeType: WaveTask;
  gradeBand: 'K-2' | '3-5';
  /** Where the item structure starts (`config.difficulty`). */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<WaveTankMetrics>) => void;
}

interface WaveTankProps {
  data: WaveTankData;
  className?: string;
  runtimeEvalMode?: string;
  runtimePlanItemId?: string;
}

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  knock_it_down: { label: 'Knock it down', icon: '🌊', accentColor: 'blue' },
};

const PROMPT = {
  set: 'Tap a knob on the paddle box to change the push size or the push speed.',
  go: 'Will this wave knock the tower down? Say your guess, then tap the paddle.',
  moving: 'Watch the wave…',
  decide: 'Try other settings, or press I\'m done! with the paddle set the way you choose.',
};

/** A wave is "moving" until its first crest has hit the tower and the blocks have settled. */
const movingMs = (speed: number) => Math.round((runTiming(speed).arriveS + 1.6) * 1000);

interface Playing { size: number; speed: number; fell: boolean; wobble: number; key: string; recorded: boolean }

/**
 * The `xray` lever: an energy bar at the beach, no numbers, that fills when the wave arrives. The notch marks where the
 * tower falls; the fill is the wave's energy as a part of that ((size × speed / need)², drawn at the notch's height).
 */
const EnergyBar: React.FC<{ playing: Playing | null; need: number }> = ({ playing, need }) => {
  const [fill, setFill] = useState(0);
  useEffect(() => {
    setFill(0);
    if (!playing) return;
    const id = setTimeout(() => setFill(Math.min(1, NOTCH * ((playing.size * playing.speed) / need) ** 2)), runTiming(playing.speed).arriveS * 1000);
    return () => clearTimeout(id);
  }, [playing, need]);
  return (
    <div className="pointer-events-none absolute bottom-3 right-3 flex items-end gap-2 rounded-xl bg-slate-900/75 p-2 text-[10px] text-slate-200" data-wave-energy="">
      <div className="relative h-32 w-6 overflow-hidden rounded bg-slate-700/60">
        <div className="absolute bottom-0 w-full bg-orange-400 transition-[height] duration-700" style={{ height: `${Math.round(fill * 100)}%` }} />
        <div className="absolute w-full border-t-2 border-dashed border-white" style={{ bottom: `${NOTCH * 100}%` }} />
      </div>
      <div className="space-y-1 pb-1">
        <div>energy</div>
        <div className="text-slate-400">line: tower falls</div>
      </div>
    </div>
  );
};
const NOTCH = 0.7;

/** The teaching workspace is this primitive's only controller: the runtime owns progression. */
const useWaveProgress = useWorkspaceProgressFor('wave-tank');

const WaveTankSurface: React.FC<WaveTankProps> = ({ data, className, runtimePlanItemId }) => {
  const { title, description, challenges = [], challengeType, gradeBand, instanceId, skillId, subskillId, objectiveId,
    exhibitId, onEvaluationSubmit } = data;
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceId = useRef(instanceId || `wave-tank-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  const [size, setSize] = useState(challenges[0]?.start.size ?? 1);
  const [speed, setSpeed] = useState(challenges[0]?.start.speed ?? 1);
  const [runs, setRuns] = useState<WaveRun[]>([]);
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [running, setRunning] = useState(false);
  const [verdict, setVerdict] = useState<'correct' | 'incorrect' | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; status: 'correct' | 'incorrect' } | null>(null);
  const [partsKey, setPartsKey] = useState('parts-0');
  const [wavesTotal, setWavesTotal] = useState(0);
  // In-item levers (`waveLevers.ts`), keyed by the session item they were pulled on, and the easier item a simplify
  // lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<WaveChallenge | null>(null);

  /** Send a wave. */
  const play = useCallback((c: WaveChallenge, s: number, p: number, record: boolean) => {
    const fell = knocksDown(c, s, p);
    setPlaying({ size: s, speed: p, fell, wobble: fell ? 1 : wobble(c, s, p), key: `${s}-${p}-${Date.now()}`, recorded: record });
    setRunning(true);
  }, []);
  // The wave stops "moving" once the tower has fallen or settled, and a sent wave gets its notebook row then. Keyed on
  // the wave, so a remount (strict mode) or a new wave reschedules it instead of leaving the tank moving forever.
  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => {
      setRunning(false);
      if (playing.recorded) {
        setRuns(rs => [...rs, { size: playing.size, speed: playing.speed, fell: playing.fell }]);
        setWavesTotal(n => n + 1);
      }
    }, movingMs(playing.speed));
    return () => clearTimeout(id);
  }, [playing]);

  /** A fresh item: the paddle back on the first wave's settings, and the first wave plays once (no notebook row). */
  const openItem = useCallback((c: WaveChallenge | undefined, key: string) => {
    setRuns([]); setPlaying(null); setRunning(false);
    setPartsKey(`parts-${key}-${Date.now()}`);
    if (!c) return;
    setSize(c.start.size); setSpeed(c.start.speed);
    play(c, c.start.size, c.start.speed, false);
  }, [play]);

  const progress = useWaveProgress<WaveChallenge>({
    challenges, getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: waveTankBoss.assignment!,
    // A fresh item opens a fresh tank. Try again keeps the settings, the waves and the notebook.
    onItemOpened: (index, retry) => {
      setVerdict(null); setFeedback(null);
      if (retry) return;
      setPractice(null);
      openItem(challenges[index], String(index));
    },
  });
  const { currentIndex, results: challengeResults, isComplete } = progress;
  const allChallengesComplete = isComplete || !!progress.practiceSummary;
  const sessionItem = challenges[currentIndex] ?? null;
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const current = practice ?? sessionItem;
  const pulledLevers = leverState.item === sessionItem?.id ? leverState.pulled : [];
  /** A runtime pull or the tier's starting position, on the session item only; never drawn on a practice item. */
  const leverOn = (id: string) => !practice && (pulledLevers.includes(id) || !!sessionItem?.startLevers?.includes(id));
  const locked = !current || progress.canAttempt === false || allChallengesComplete || verdict !== null;

  const phaseResults = usePhaseResults({
    challenges, results: challengeResults, isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type, phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) => Math.round(rs.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0)
      / Math.max(rs.length, 1)),
  });

  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<WaveTankMetrics>({
    primitiveType: 'wave-tank', instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const setKnob = (kind: 'size' | 'speed', n: number) => {
    if (locked || running || !current) return;
    if (kind === 'size' && n > current.sizeCap) return;
    if (kind === 'size') setSize(n); else setSpeed(n);
    setPlaying(null); setFeedback(null);
    SoundManager.tap();
  };
  const sendWave = () => {
    if (locked || running || !current) return;
    play(current, size, speed, true);
    SoundManager.select();
  };
  const onTap = (t: WaveTarget) => {
    if (t === 'paddle') sendWave();
    else { const [kind, n] = t.split(':'); setKnob(kind as 'size' | 'speed', Number(n)); }
  };

  const check = () => {
    if (!current || locked || running) return;
    const answer = { size, speed, runs };
    const correct = knockMatches(current, answer);
    setVerdict(correct ? 'correct' : 'incorrect');
    setFeedback({ text: knockFeedback(current, answer), status: correct ? 'correct' : 'incorrect' });
    progress.commitCheck(describeKnock(current, answer), correct, knockMiss(current, answer));
    if (correct) {
      SoundManager.playCorrect();
      play(current, size, speed, false);
      if (practice) return;
      const attempts = progress.currentAttempts + 1;
      progress.mergeResult({ challengeId: current.id, correct: true, attempts, score: Math.max(20, 100 - 30 * (attempts - 1)) });
    } else SoundManager.playIncorrect();
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
    const metrics: WaveTankMetrics = {
      type: 'wave-tank', challengeType, totalChallenges: total, correctCount, attemptsCount, firstTryCount,
      hintsViewed: 0, overallAccuracy: accuracy, averageAttemptsPerChallenge: Math.round((attemptsCount / total) * 10) / 10,
      wavesCount: wavesTotal,
    };
    submitResult(correctCount === total, accuracy, metrics, { challengeResults });
  }, [allChallengesComplete, hasSubmitted, challenges, challengeType, challengeResults, submitResult, progress.recordsEvaluation, wavesTotal]);

  // What the tutor and the observer see, republished every render.
  useLayoutEffect(() => {
    if (!current || !sessionItem || allChallengesComplete) return;
    const scene = { ...knockScene(current, { size, speed, runs, running }) };
    // The lever set declares the levers and writes the onScreen facts (`leverScene`).
    const ctx: WaveLeverCtx = { runs };
    const leverItem: WaveChallenge = { ...sessionItem, supportTier: sessionItem.supportTier ?? data.supportTier };
    const shown = practice ? [] : [...pulledLevers, ...(sessionItem.startLevers ?? [])];
    const levers = practice ? [] : WAVE_LEVERS.declare(leverItem, ctx, shown);
    const published = leverScene(scene, {
      support: practice ? '' : WAVE_LEVERS.support(leverItem, ctx),
      onScreen: practice ? '' : WAVE_LEVERS.onScreen(leverItem, ctx, shown),
    });
    workspace.current = {
      ...published,
      facts: { ...published.facts, ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item now.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const pulled = { item: sessionItem.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = WAVE_LEVERS.simpler(leverItem, ctx, id);
          if (!easier) return 'This item has no easier version; try a help lever.';
          // The practice item and the full item share no waves: both start fresh.
          setLeverState(pulled); openItem(easier, easier.id); setVerdict(null); setFeedback(null); setPractice(easier);
          return { practice: waveTankBoss.assignment!(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); openItem(sessionItem, sessionItem.id); setVerdict(null); setFeedback(null); },
    };
  });

  const localScore = useMemo(() => phaseResults.length
    ? Math.round(phaseResults.reduce((s, p) => s + p.score, 0) / phaseResults.length) : 0, [phaseResults]);

  if (!challenges.length) {
    return <LuminaCard className={className}><LuminaCardContent className="p-6 text-slate-400">Nothing in the tank yet.</LuminaCardContent></LuminaCard>;
  }

  const showChanges = leverOn(CHANGES_LEVER);
  const changeWords = { none: 'nothing', size: 'size', speed: 'speed', both: 'both' } as const;
  const notebookRows = current ? [
    ['1 (first)', String(current.start.size), String(current.start.speed), waveWords(current.start.size, current.start.speed),
      runOutcome({ fell: false }), ...(showChanges ? ['—'] : [])],
    ...runs.map((r, i) => [String(i + 2), String(r.size), String(r.speed), waveWords(r.size, r.speed), runOutcome(r),
      ...(showChanges ? [changeWords[changed(current, r)]] : [])]),
  ] : [];
  const firstWavePlaying = !!playing && !playing.recorded && runs.length === 0 && verdict === null;
  const step = running ? 'moving' : playing && playing.recorded && playing.size === size && playing.speed === speed ? 'decide'
    : current && size === current.start.size && speed === current.start.speed ? 'set' : 'go';

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LuminaCardTitle>{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="blue">{gradeBand}</LuminaBadge>
            <LuminaChallengeCounter current={Math.min(currentIndex + 1, challenges.length)} total={challenges.length} />
          </div>
        </div>
        <LuminaCardDescription>{description}</LuminaCardDescription>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localScore)}
            durationMs={elapsedMs} heading="Waves done!" celebrationMessage="You tested waves like a scientist." className="mb-2" />
        )}

        {!allChallengesComplete && current && (
          <LuminaPrompt accent="blue">
            {practice && <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-300" data-practice>Practice</div>}
            <div className="text-base">{current.instruction}</div>
            <div className="mt-1 text-sm text-sky-100/80" data-wave-step={firstWavePlaying ? 'first' : step}>
              {firstWavePlaying ? 'Watch the first wave…' : PROMPT[step]}
            </div>
          </LuminaPrompt>
        )}

        <PipDock />
        <PipWorkspace className="space-y-3">
          {current && (
            <div className="relative overflow-hidden rounded-xl border border-white/10">
              <WaveScene className="h-[min(52vh,440px)] min-h-[280px] w-full" partsKey={partsKey} item={current}
                size={size} speed={speed} run={playing} onTap={onTap} disabled={locked || running}
                crestMarks={leverOn(CREST_LEVER)} startRings={showChanges} />
              {leverOn(XRAY_LEVER) && <EnergyBar playing={playing} need={current.need} />}
              <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-slate-900/70 px-3 py-1 text-xs text-slate-200">Drag to turn · pinch to zoom</div>
              {playing && !running && (
                <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-slate-900/70 px-3 py-1 text-xs text-sky-100" data-wave-outcome={playing.fell ? 'fell' : 'stood'}>
                  {playing.fell ? 'Crash! The tower fell.' : 'The tower wobbled but stayed up.'}
                </div>
              )}
            </div>
          )}

          {!allChallengesComplete && current && (
            <LuminaPanel className="space-y-3 p-3" data-wave-panel="">
              {(['size', 'speed'] as const).map(kind => (
                <div key={kind} className="flex flex-wrap items-center gap-2">
                  <span className="w-24 text-xs text-slate-400">{kind === 'size' ? 'Push size:' : 'Push speed:'}</span>
                  {Array.from({ length: LEVELS }, (_, i) => i + 1).map(n => (
                    <LuminaChoiceChip key={n} label={String(n)} aria-label={`${kind === 'size' ? 'Size' : 'Speed'} ${n}`}
                      selected={(kind === 'size' ? size : speed) === n} onClick={() => setKnob(kind, n)}
                      disabled={locked || running || (kind === 'size' && n > current.sizeCap)} />
                  ))}
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <LuminaButton tone="primary" onClick={sendWave} disabled={locked || running}>Send a wave</LuminaButton>
                <span className="text-xs text-slate-400">or tap the paddle</span>
              </div>
            </LuminaPanel>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!allChallengesComplete && current && (
              <LuminaActionButton action="check" onClick={check} disabled={locked || running}>I&apos;m done!</LuminaActionButton>
            )}
          </div>

          {!allChallengesComplete && feedback && (
            <LuminaFeedbackCard status={feedback.status}><p>{feedback.text}</p></LuminaFeedbackCard>
          )}
          {!allChallengesComplete && current && (
            <LuminaTable caption="Lab notebook" accent="blue"
              columns={['Wave', 'Size', 'Speed', 'Crests', 'What happened', ...(showChanges ? ['Changed'] : [])]} rows={notebookRows} />
          )}
        </PipWorkspace>
      </LuminaCardContent>
    </LuminaCard>
  );
};

const WaveTank = withWorkspaceOnly<WaveTankProps>('wave-tank', WaveTankSurface, props => props.data.title);

/**
 * Wave Tank runs only on the teaching workspace: the tutor is present, I'm done! commits, and the runtime moves to the
 * next item. Outside a bound session the "needs the tutor" card shows.
 */
export default WaveTank;
