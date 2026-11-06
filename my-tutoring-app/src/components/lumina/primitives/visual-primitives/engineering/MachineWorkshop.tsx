'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardDescription, LuminaCardContent,
  LuminaBadge, LuminaButton, LuminaActionButton, LuminaChallengeCounter, LuminaFeedbackCard, LuminaPanel,
  LuminaPrompt, LuminaTable,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { MachineWorkshopMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import MachineBench, { PartIcon } from './MachineBench';
import {
  EMPTY_BUILD, KIND_NAMES, MOTION, PART_GUIDE, RUN_SECONDS, describeMachine, endWord, isConverter, isDriver, loadStage,
  machineFeedback, machineMatches, machineMiss,
  outcomeWords, runBuild, trayName, type Build, type MachineChallenge, type MachineRun, type MachineRunRow, type MachineTask,
  type Outcome,
} from './machineModel';
import { machineScene } from './machineWorkspace';
import { machineWorkshopBoss } from './machineWorkshop.boss';

export type { MachineChallenge } from './machineModel';

// ============================================================================
// Data contract
// ============================================================================

export interface MachineWorkshopData {
  title: string;
  description: string;
  /** 3-6 items. REQUIRED. The machines come from the author agent (checked against the atlas); every number from code. */
  challenges: MachineChallenge[];
  challengeType: MachineTask;
  gradeBand: 'K-2' | '3-5' | '6-8';
  /** Where the item structure starts (`config.difficulty`). */
  supportTier?: 'easy' | 'medium' | 'hard';
  /** How the machines were authored (for QA; never shown): agent calls, each machine's source, what was rejected. */
  authoring?: {
    calls: number; sources: string[]; failure?: string;
    rejected: Array<{ machine: string; errors: string[] }>; repaired?: Array<{ machine: string; errors: string[] }>;
  };

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<MachineWorkshopMetrics>) => void;
}

interface MachineWorkshopProps {
  data: MachineWorkshopData;
  className?: string;
  runtimeEvalMode?: string;
  runtimePlanItemId?: string;
}

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  spin_to_push: { label: 'Spin to push', icon: '⚙️', accentColor: 'orange' },
};

/** On rails: step 1 fits the wheel part, step 2 joins it to the working end, and joining runs the machine. */
const prompt = (step: 'build' | 'half' | 'run' | 'running' | 'decide' | 'solved', end: string) => ({
  build: 'Step 1: pick a part to put on the spinning wheel.',
  half: `Step 2: pick a part to join the wheel to the ${end}. The machine runs as soon as it is joined.`,
  run: 'Press Run again to watch your machine.',
  running: 'Watch the machine…',
  decide: 'Swap a part to try another idea, or press I\'m done! when it works.',
  solved: 'It works!',
})[step];

const playMs = (r: MachineRun) => Math.round((r.frames.length / 60) * 1000) + 300;

/** The teaching workspace is this primitive's only controller: the runtime owns progression. */
const useMachineProgress = useWorkspaceProgressFor('machine-workshop');

const MachineWorkshopSurface: React.FC<MachineWorkshopProps> = ({ data, className, runtimePlanItemId }) => {
  const { title, description, challenges = [], challengeType, gradeBand, instanceId, skillId, subskillId, objectiveId,
    exhibitId, onEvaluationSubmit } = data;
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceId = useRef(instanceId || `machine-workshop-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  const [build, setBuild] = useState<Build>(EMPTY_BUILD);
  const [runs, setRuns] = useState<MachineRunRow[]>([]);
  const [playing, setPlaying] = useState<{ run: MachineRun; key: string; build: Build } | null>(null);
  const [running, setRunning] = useState(false);
  const runTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (runTimer.current) clearTimeout(runTimer.current); }, []);
  const [verdict, setVerdict] = useState<'correct' | 'incorrect' | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; status: 'correct' | 'incorrect' } | null>(null);
  const [partsKey, setPartsKey] = useState('parts-0');
  const [runsTotal, setRunsTotal] = useState(0);

  const openItem = useCallback((key: string) => {
    if (runTimer.current) clearTimeout(runTimer.current);
    setBuild(EMPTY_BUILD); setRuns([]); setPlaying(null); setRunning(false);
    setPartsKey(`parts-${key}-${Date.now()}`);
  }, []);

  const progress = useMachineProgress<MachineChallenge>({
    challenges, getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: machineWorkshopBoss.assignment!,
    // A fresh item opens an empty slot. Try again keeps the build and the notebook.
    onItemOpened: (index, retry) => {
      setVerdict(null); setFeedback(null);
      if (retry) return;
      openItem(String(index));
    },
  });
  const { currentIndex, results: challengeResults, isComplete } = progress;
  const allChallengesComplete = isComplete || !!progress.practiceSummary;
  const current = challenges[currentIndex] ?? null;
  const solved = verdict === 'correct';
  const locked = !current || progress.canAttempt === false || allChallengesComplete || verdict !== null;

  const phaseResults = usePhaseResults({
    challenges, results: challengeResults, isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type, phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) => Math.round(rs.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0)
      / Math.max(rs.length, 1)),
  });

  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<MachineWorkshopMetrics>({
    primitiveType: 'machine-workshop', instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const stopRun = () => { if (runTimer.current) clearTimeout(runTimer.current); setRunning(false); };

  /**
   * Run a build. The notebook row is recorded at the start (the table hides it until the run has played), so a swap or
   * I'm done! mid-run never loses a run.
   */
  const play = (b: Build, record: boolean) => {
    if (!current || !b.driver || !b.link) return;
    const run = runBuild(current, b);
    if (runTimer.current) clearTimeout(runTimer.current);
    setPlaying({ run, key: `${b.driver}-${b.link}-${Date.now()}`, build: b });
    setRunning(true);
    SoundManager.select();
    if (record) {
      setRuns(rs => [...rs, { driver: b.driver!, link: b.link!, outcome: run.outcome }]);
      setRunsTotal(n => n + 1);
    }
    runTimer.current = setTimeout(() => setRunning(false), playMs(run));
  };

  /**
   * Fit a tray part in its place, replacing what was there. The joining part waits for a wheel part (step 1 before
   * step 2), and once both are fitted every pick runs the machine, so each idea is one tap.
   */
  const pick = (id: string) => {
    if (locked || !current) return;
    const part = current.tray.find(p => p.id === id);
    if (!part) return;
    const slot: keyof Build = isDriver(part.part) ? 'driver' : 'link';
    if (slot === 'link' && !build.driver) return;
    if (build[slot] === id) return;
    const next = { ...build, [slot]: id };
    setBuild(next); setFeedback(null);
    SoundManager.tap();
    if (next.driver && next.link) play(next, true);
    else { stopRun(); setPlaying(null); }
  };
  /** A tap on a fitted part takes it off; taking off the wheel part takes the joining part with it. */
  const unfit = (slot: keyof Build) => {
    if (locked) return;
    stopRun(); setPlaying(null); setFeedback(null);
    setBuild(b => (slot === 'driver' ? EMPTY_BUILD : { ...b, link: null }));
    SoundManager.tap();
  };
  const runIt = () => { if (!locked && build.driver && build.link) play(build, true); };

  const check = () => {
    if (!current || locked || !build.driver || !build.link) return;
    stopRun();
    const answer = { build, runs };
    const correct = machineMatches(current, answer);
    setVerdict(correct ? 'correct' : 'incorrect');
    setFeedback({ text: machineFeedback(current, answer), status: correct ? 'correct' : 'incorrect' });
    progress.commitCheck(describeMachine(current, answer), correct, machineMiss(current, answer));
    if (correct) {
      SoundManager.playCorrect();
      play(build, false);
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
    const metrics: MachineWorkshopMetrics = {
      type: 'machine-workshop', challengeType, totalChallenges: total, correctCount, attemptsCount, firstTryCount,
      hintsViewed: 0, overallAccuracy: accuracy, averageAttemptsPerChallenge: Math.round((attemptsCount / total) * 10) / 10,
      runsCount: runsTotal,
    };
    submitResult(correctCount === total, accuracy, metrics, { challengeResults });
  }, [allChallengesComplete, hasSubmitted, challenges, challengeType, challengeResults, submitResult, progress.recordsEvaluation, runsTotal]);

  // What the tutor and the observer see, republished every render.
  useLayoutEffect(() => {
    if (!current || allChallengesComplete) return;
    workspace.current = { ...machineScene(current, { build, runs, running, solved }) };
  });

  const localScore = useMemo(() => phaseResults.length
    ? Math.round(phaseResults.reduce((s, p) => s + p.score, 0) / phaseResults.length) : 0, [phaseResults]);

  if (!challenges.length) {
    return <LuminaCard className={className}><LuminaCardContent className="p-6 text-slate-400">Nothing on the bench yet.</LuminaCardContent></LuminaCard>;
  }

  const built = !!(build.driver && build.link);
  const ranThis = playing && playing.build.driver === build.driver && playing.build.link === build.link;
  const step = solved ? 'solved' : running ? 'running' : !build.driver && !build.link ? 'build' : !built ? 'half' : ranThis ? 'decide' : 'run';
  const lastOutcome: Outcome | null = playing && !running ? playing.run.outcome : null;
  const nameOf = (id: string) => { const p = current?.tray.find(x => x.id === id); return p ? trayName(p) : '—'; };
  const end = current ? endWord(loadStage(current).kind) : '';
  // After a run that did not work, the reason in what was seen (never which part to use).
  const why = lastOutcome && lastOutcome !== 'works' && !feedback && current
    ? machineFeedback(current, { build: playing!.build, runs }) : null;
  const guideKinds = current ? Array.from(new Set(current.tray.map(p => p.part))) : [];
  const drivers = current ? current.tray.filter(p => isDriver(p.part)) : [];
  const links = current ? current.tray.filter(p => !isDriver(p.part)) : [];
  // The row for the run playing now appears when it has played, so the notebook never gives away the ending.
  const shownRuns = running ? runs.slice(0, -1) : runs;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LuminaCardTitle>{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="orange">{gradeBand}</LuminaBadge>
            <LuminaChallengeCounter current={Math.min(currentIndex + 1, challenges.length)} total={challenges.length} />
          </div>
        </div>
        <LuminaCardDescription>{description}</LuminaCardDescription>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localScore)}
            durationMs={elapsedMs} heading="Machines built!" celebrationMessage="You turned spinning into up-and-down like an engineer." className="mb-2" />
        )}

        {!allChallengesComplete && current && (
          <LuminaPrompt accent="orange">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-200/80">{current.name} · {current.where}</div>
            <div className="text-sm text-slate-200/90">{current.intro}</div>
            <div className="mt-1 text-base">{current.instruction}</div>
            <div className="mt-1 text-sm font-semibold text-amber-100" data-machine-step={step}>{prompt(step, end)}</div>
          </LuminaPrompt>
        )}

        <PipDock />
        <PipWorkspace className="space-y-3">
          {/* The bench stays after the last machine works, so its run and the principle can be seen. */}
          {current && (
            <div className="relative overflow-hidden rounded-xl border border-white/10" key={partsKey}>
              <MachineBench className="w-full" item={current} build={build}
                run={playing ? { frames: playing.run.frames, key: playing.key } : null} solved={solved}
                onTapPlaced={unfit} disabled={locked} />
              {lastOutcome && (
                <div className="pointer-events-none absolute right-3 top-3 max-w-[60%] rounded-full bg-slate-900/75 px-3 py-1 text-xs text-amber-100" data-machine-outcome={lastOutcome}>
                  {lastOutcome === 'works' ? `It works! It ${current.doesWord}.` : `Hmm: ${outcomeWords(current, lastOutcome)}.`}
                </div>
              )}
            </div>
          )}

          {!allChallengesComplete && current && (
            <LuminaPanel className="space-y-3 p-3" data-machine-panel="">
              <div className="flex flex-wrap items-center gap-1 text-xs text-slate-400" data-machine-stages="">
                {current.stages.map((s, i) => (
                  <span key={i} className="rounded-full bg-slate-800/70 px-2 py-0.5" title={isConverter(s.kind) && !solved ? undefined : s.job}>
                    {i > 0 && <span className="mr-1 text-slate-500">→</span>}
                    {isConverter(s.kind) ? (solved ? KIND_NAMES[s.kind] : '? missing part') : KIND_NAMES[s.kind]}
                    {!isConverter(s.kind) && <span className="ml-1 text-slate-500">{MOTION[s.kind].out === 'spin' || (MOTION[s.kind].in === 'spin' && !MOTION[s.kind].out) ? '⟳' : '↕'}</span>}
                  </span>
                ))}
              </div>
              {([['Step 1 · On the spinning wheel', drivers, 'driver', 'Shaft part'], [`Step 2 · Joins the wheel to the ${end}`, links, 'link', 'Slider part']] as const).map(([label, parts, slot, aria]) => {
                // The row the learner is on is lit; step 2 waits for a wheel part.
                const waiting = slot === 'link' && !build.driver;
                const active = !solved && (slot === 'driver' ? !build.driver : !!build.driver && !build.link);
                return (
                <div key={slot} className={`space-y-1 rounded-xl p-2 transition-colors ${active ? 'bg-amber-500/10 ring-1 ring-amber-400/60' : ''} ${waiting ? 'opacity-50' : ''}`}
                  data-machine-row={slot}>
                  <div className={`text-xs ${active ? 'font-semibold text-amber-200' : 'text-slate-400'}`}>
                    {label}{waiting ? ' (pick a wheel part first)' : ''}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {parts.map(p => {
                      const on = build[slot] === p.id;
                      return (
                        <button key={p.id} type="button" aria-label={`${aria}: ${trayName(p)}`} aria-pressed={on}
                          title={PART_GUIDE[p.part]} onClick={() => pick(p.id)} disabled={locked || waiting}
                          className={`flex w-24 flex-col items-center rounded-xl border px-1 py-1.5 text-[11px] leading-tight transition-colors disabled:opacity-50 ${on
                            ? 'border-amber-400/80 bg-amber-500/15 text-amber-100' : 'border-white/10 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60'}`}>
                          <PartIcon part={p} />
                          <span className="mt-0.5 text-center">{trayName(p)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                );
              })}
              <details className="rounded-lg bg-slate-800/50 px-3 py-2 text-xs text-slate-300" open={currentIndex === 0} data-machine-guide="">
                <summary className="cursor-pointer text-slate-400">What the parts look like</summary>
                <ul className="mt-1 space-y-0.5">
                  {guideKinds.map(k => <li key={k}><span className="font-semibold text-slate-200">{trayName({ id: k, part: k, size: 'one', value: 0 })}</span>: {PART_GUIDE[k]}</li>)}
                </ul>
              </details>
              <div className="flex flex-wrap items-center gap-2">
                <LuminaButton tone="subtle" onClick={runIt} disabled={locked || running || !built}>Run again</LuminaButton>
                <span className="text-xs text-slate-400">The machine runs for {RUN_SECONDS} seconds.</span>
              </div>
            </LuminaPanel>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!allChallengesComplete && current && (
              <LuminaActionButton action="check" onClick={check} disabled={locked || !built}>I&apos;m done!</LuminaActionButton>
            )}
          </div>

          {why && (
            <LuminaFeedbackCard status="insight" data-machine-why=""><p>{why}</p></LuminaFeedbackCard>
          )}
          {feedback && (
            <LuminaFeedbackCard status={feedback.status}><p>{feedback.text}</p></LuminaFeedbackCard>
          )}
          {!allChallengesComplete && current && shownRuns.length > 0 && (
            <LuminaTable caption="Lab notebook" accent="orange" columns={['Run', 'On the shaft', 'To the slider', 'What happened']}
              rows={shownRuns.map((r, i) => [String(i + 1), nameOf(r.driver), nameOf(r.link), outcomeWords(current, r.outcome)])} />
          )}
        </PipWorkspace>
      </LuminaCardContent>
    </LuminaCard>
  );
};

const MachineWorkshop = withWorkspaceOnly<MachineWorkshopProps>('machine-workshop', MachineWorkshopSurface, props => props.data.title);

/**
 * Machine Workshop runs only on the teaching workspace: the tutor is present, I'm done! commits, and the runtime moves
 * to the next machine. Outside a bound session the "needs the tutor" card shows.
 */
export default MachineWorkshop;
