'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardDescription, LuminaCardContent,
  LuminaBadge, LuminaButton, LuminaActionButton, LuminaChallengeCounter, LuminaChoiceChip, LuminaFeedbackCard, LuminaPanel,
  LuminaPrompt, LuminaTable,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { MarbleRunParkMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import MarbleScene from './MarbleScene';
import type { MarbleTarget } from './marble3d';
import {
  OUTCOME_WORDS, buildTrack, describeLoop, loopFeedback, loopMatches, loopMiss, pegName, runFrom,
  type LoopRun, type Motion, type MarbleChallenge, type MarbleTask, type Run,
} from './marbleModel';
import { loopScene } from './marbleWorkspace';
import { marbleRunParkBoss } from './marbleRunPark.boss';
import {
  LOOP_TOP_LEVER, MARBLE_LEVERS, PEG_RESULTS_LEVER, PRACTICE_NOTE, XRAY_LEVER, energyAt, type MarbleLeverCtx,
} from './marbleLevers';
import { leverScene } from '../../../components/live-activity/bossLevers';

export type { MarbleChallenge } from './marbleModel';

// ============================================================================
// Data contract
// ============================================================================

export interface MarbleRunParkData {
  title: string;
  description: string;
  /** 3-6 items. REQUIRED. Every loop, peg and run is chosen by code from the marble model. */
  challenges: MarbleChallenge[];
  /** The session's task; each item carries its own `type`. */
  challengeType: MarbleTask;
  gradeBand: 'K-2' | '3-5';
  /** Where the item structure starts (`config.difficulty`). */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<MarbleRunParkMetrics>) => void;
}

interface MarbleRunParkProps {
  data: MarbleRunParkData;
  className?: string;
  runtimeEvalMode?: string;
  runtimePlanItemId?: string;
}

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  make_the_loop: { label: 'Make the loop', icon: '🎢', accentColor: 'blue' },
};

const PROMPT = {
  pick: 'Tap a peg on the ramp to put the marble there.',
  go: 'Will it make the loop? Say your guess, then tap the marble to let it go.',
  rolling: 'Watch the marble…',
  decide: 'Try another peg, or press I\'m done! with the marble on the peg you choose.',
};

/** How long a run plays, in ms (the scene plays 60 frames a second), plus a beat to see where it ended. */
const playMs = (r: Run) => Math.round((r.frames.length / 60) * 1000) + 500;

/**
 * The `xray` lever: an energy bar beside the run, no numbers. Blue is height, orange is speed, grey is what rubbing took
 * away. It follows the run's frames on the scene's clock (60 a second); on a peg with no run it is all blue.
 */
const EnergyBar: React.FC<{ motion: readonly Motion[] | null; runKey: string | null; restHeight: number; topPeg: number }> = ({ motion: frames, runKey, restHeight, topPeg }) => {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    setFrame(0);
    if (!frames) return;
    const start = performance.now();
    let raf = 0;
    const step = () => {
      const i = Math.min(frames.length - 1, Math.floor(((performance.now() - start) / 1000) * 60));
      setFrame(i);
      if (i < frames.length - 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [frames, runKey]);
  const parts = frames ? energyAt(frames, frame, topPeg) : { height: restHeight / (topPeg || 1), speed: 0, lost: 0 };
  const pct = (v: number) => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex items-end gap-2 rounded-xl bg-slate-900/75 p-2 text-[10px] text-slate-200" data-marble-energy="">
      <div className="flex h-32 w-6 flex-col-reverse overflow-hidden rounded bg-slate-700/60">
        <div className="bg-sky-400" style={{ height: pct(parts.height) }} />
        <div className="bg-orange-400" style={{ height: pct(parts.speed) }} />
        <div className="bg-slate-400/70" style={{ height: pct(parts.lost) }} />
      </div>
      <div className="space-y-1 pb-1">
        <div><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-sky-400" />height</div>
        <div><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-orange-400" />speed</div>
        <div><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-slate-400/70" />rubbed away</div>
      </div>
    </div>
  );
};

/** The teaching workspace is this primitive's only controller: the runtime owns progression. */
const useMarbleProgress = useWorkspaceProgressFor('marble-run-park');

const MarbleRunParkSurface: React.FC<MarbleRunParkProps> = ({ data, className, runtimePlanItemId }) => {
  const { title, description, challenges = [], challengeType, gradeBand, instanceId, skillId, subskillId, objectiveId,
    exhibitId, onEvaluationSubmit } = data;
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceId = useRef(instanceId || `marble-run-park-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  const [peg, setPeg] = useState<number | null>(null);
  const [runs, setRuns] = useState<LoopRun[]>([]);
  const [playing, setPlaying] = useState<{ peg: number; run: Run; key: string } | null>(null);
  const [running, setRunning] = useState(false);
  const runTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (runTimer.current) clearTimeout(runTimer.current); }, []);
  const [verdict, setVerdict] = useState<'correct' | 'incorrect' | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; status: 'correct' | 'incorrect' } | null>(null);
  const [partsKey, setPartsKey] = useState('parts-0');
  const [runsTotal, setRunsTotal] = useState(0);
  // In-item levers (`marbleLevers.ts`), keyed by the session item they were pulled on, and the easier item a simplify
  // lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<MarbleChallenge | null>(null);

  const openItem = useCallback((key: string) => {
    if (runTimer.current) clearTimeout(runTimer.current);
    setPeg(null); setRuns([]); setPlaying(null); setRunning(false);
    setPartsKey(`parts-${key}-${Date.now()}`);
  }, []);

  const progress = useMarbleProgress<MarbleChallenge>({
    challenges, getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: marbleRunParkBoss.assignment!,
    // A fresh item opens a fresh run. Try again keeps the runs and the notebook.
    onItemOpened: (index, retry) => {
      setVerdict(null); setFeedback(null);
      if (retry) return;
      setPractice(null);
      openItem(String(index));
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
  const track = useMemo(() => (current ? buildTrack(current) : null), [current]);
  const locked = !current || progress.canAttempt === false || allChallengesComplete || verdict !== null;

  const phaseResults = usePhaseResults({
    challenges, results: challengeResults, isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type, phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) => Math.round(rs.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0)
      / Math.max(rs.length, 1)),
  });

  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<MarbleRunParkMetrics>({
    primitiveType: 'marble-run-park', instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  /** Play a run from a peg; the notebook gets its row when the marble has finished. */
  const play = (from: number, record: boolean) => {
    if (!current || !track) return;
    const run = runFrom(track, current.pegs[from]);
    if (runTimer.current) clearTimeout(runTimer.current);
    setPlaying({ peg: from, run, key: `${from}-${Date.now()}` });
    setRunning(true);
    runTimer.current = setTimeout(() => {
      setRunning(false);
      if (record) { setRuns(rs => [...rs, { peg: from, outcome: run.outcome }]); setRunsTotal(n => n + 1); }
    }, playMs(run));
    SoundManager.select();
  };

  const choosePeg = (i: number) => {
    if (locked || running) return;
    setPeg(i); setPlaying(null); setFeedback(null);
    SoundManager.tap();
  };
  const letGo = () => {
    if (locked || running || peg == null) return;
    play(peg, true);
  };
  const onTap = (t: MarbleTarget) => {
    if (t === 'marble') letGo();
    else choosePeg(Number(t.split(':')[1]));
  };

  const check = () => {
    if (!current || locked || running || peg == null) return;
    const answer = { peg, runs };
    const correct = loopMatches(current, answer);
    setVerdict(correct ? 'correct' : 'incorrect');
    setFeedback({ text: loopFeedback(current, answer), status: correct ? 'correct' : 'incorrect' });
    progress.commitCheck(describeLoop(current, answer), correct, loopMiss(current, answer));
    if (correct) {
      SoundManager.playCorrect();
      play(peg, false);
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
    const metrics: MarbleRunParkMetrics = {
      type: 'marble-run-park', challengeType, totalChallenges: total, correctCount, attemptsCount, firstTryCount,
      hintsViewed: 0, overallAccuracy: accuracy, averageAttemptsPerChallenge: Math.round((attemptsCount / total) * 10) / 10,
      runsCount: runsTotal,
    };
    submitResult(correctCount === total, accuracy, metrics, { challengeResults });
  }, [allChallengesComplete, hasSubmitted, challenges, challengeType, challengeResults, submitResult, progress.recordsEvaluation, runsTotal]);

  // What the tutor and the observer see, republished every render.
  useLayoutEffect(() => {
    if (!current || !sessionItem || allChallengesComplete) return;
    const scene = { ...loopScene(current, { peg, runs, running }) };
    // The lever set declares the levers and writes the onScreen facts (`leverScene`).
    const ctx: MarbleLeverCtx = { onPeg: peg != null, runs };
    const leverItem: MarbleChallenge = { ...sessionItem, supportTier: sessionItem.supportTier ?? data.supportTier };
    const shown = practice ? [] : [...pulledLevers, ...(sessionItem.startLevers ?? [])];
    const levers = practice ? [] : MARBLE_LEVERS.declare(leverItem, ctx, shown);
    const published = leverScene(scene, {
      support: practice ? '' : MARBLE_LEVERS.support(leverItem, ctx),
      onScreen: practice ? '' : MARBLE_LEVERS.onScreen(leverItem, ctx, shown),
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
          const easier = MARBLE_LEVERS.simpler(sessionItem, ctx, id);
          if (!easier) return 'This item has no easier version; try a help lever.';
          // The practice loop and the full item share no runs: both start fresh.
          setLeverState(pulled); openItem(easier.id); setVerdict(null); setFeedback(null); setPractice(easier);
          return { practice: marbleRunParkBoss.assignment!(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); openItem(sessionItem.id); setVerdict(null); setFeedback(null); },
    };
  });

  const localScore = useMemo(() => phaseResults.length
    ? Math.round(phaseResults.reduce((s, p) => s + p.score, 0) / phaseResults.length) : 0, [phaseResults]);

  if (!challenges.length) {
    return <LuminaCard className={className}><LuminaCardContent className="p-6 text-slate-400">Nothing on the table yet.</LuminaCardContent></LuminaCard>;
  }

  const pegMarks = current && leverOn(PEG_RESULTS_LEVER)
    ? current.pegs.map((_, i) => { const r = runs.filter(x => x.peg === i).pop(); return r ? r.outcome === 'made_it' : null; })
    : null;
  const notebook = runs.map((r, i) => ({ r, i }));
  if (leverOn(PEG_RESULTS_LEVER)) notebook.sort((a, b) => a.r.peg - b.r.peg || a.i - b.i);
  const step = running ? 'rolling' : peg == null ? 'pick' : playing?.peg === peg ? 'decide' : 'go';

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
            durationMs={elapsedMs} heading="Runs done!" celebrationMessage="You tested the loop like a scientist." className="mb-2" />
        )}

        {!allChallengesComplete && current && (
          <LuminaPrompt accent="blue">
            {practice && <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-300" data-practice>Practice</div>}
            <div className="text-base">{current.instruction}</div>
            <div className="mt-1 text-sm text-sky-100/80" data-marble-step={step}>{PROMPT[step]}</div>
          </LuminaPrompt>
        )}

        <PipDock />
        <PipWorkspace className="space-y-3">
          {current && (
            <div className="relative overflow-hidden rounded-xl border border-white/10">
              <MarbleScene className="h-[min(52vh,440px)] min-h-[280px] w-full" partsKey={partsKey} item={current}
                peg={peg} run={playing ? { frames: playing.run.frames, outcome: playing.run.outcome, key: playing.key } : null}
                onTap={onTap} disabled={locked || running} topLine={leverOn(LOOP_TOP_LEVER)} pegMarks={pegMarks} />
              {leverOn(XRAY_LEVER) && peg != null && (
                <EnergyBar motion={playing?.peg === peg ? playing.run.motion : null} runKey={playing?.key ?? null}
                  restHeight={current.pegs[peg]} topPeg={current.pegs[current.pegs.length - 1]} />
              )}
              <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-slate-900/70 px-3 py-1 text-xs text-slate-200">Drag to turn · pinch to zoom</div>
              {playing && !running && (
                <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-slate-900/70 px-3 py-1 text-xs text-sky-100" data-marble-outcome={playing.run.outcome}>
                  {playing.run.outcome === 'made_it' ? 'Round the loop! Ding!' : `It ${OUTCOME_WORDS[playing.run.outcome]}.`}
                </div>
              )}
            </div>
          )}

          {!allChallengesComplete && current && (
            <LuminaPanel className="space-y-3 p-3" data-marble-panel="">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400">Start peg:</span>
                {current.pegs.map((_, i) => (
                  <LuminaChoiceChip key={i} label={String(i + 1)} aria-label={`Peg ${i + 1}`} selected={peg === i}
                    onClick={() => choosePeg(i)} disabled={locked || running} />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <LuminaButton tone="primary" onClick={letGo} disabled={locked || running || peg == null}>Let it go</LuminaButton>
                <span className="text-xs text-slate-400">or tap the marble</span>
              </div>
            </LuminaPanel>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!allChallengesComplete && current && (
              <LuminaActionButton action="check" onClick={check} disabled={locked || running || peg == null}>I&apos;m done!</LuminaActionButton>
            )}
          </div>

          {!allChallengesComplete && feedback && (
            <LuminaFeedbackCard status={feedback.status}><p>{feedback.text}</p></LuminaFeedbackCard>
          )}
          {!allChallengesComplete && runs.length > 0 && (
            <LuminaTable caption="Lab notebook" accent="blue" columns={['Run', 'Start', 'What happened']}
              rows={notebook.map(({ r, i }) => [String(i + 1), pegName(r.peg).replace(/^p/, 'P'), OUTCOME_WORDS[r.outcome]])} />
          )}
        </PipWorkspace>
      </LuminaCardContent>
    </LuminaCard>
  );
};

const MarbleRunPark = withWorkspaceOnly<MarbleRunParkProps>('marble-run-park', MarbleRunParkSurface, props => props.data.title);

/**
 * Marble Run Park runs only on the teaching workspace: the tutor is present, I'm done! commits, and the runtime moves
 * to the next item. Outside a bound session the "needs the tutor" card shows.
 */
export default MarbleRunPark;
