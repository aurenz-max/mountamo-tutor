'use client';

/**
 * PlaceValueChart — LIVE-JUDGED DI surface (eighth math port; qa/di/BACKLOG.md
 * item 18). The tutor asks with scripted lines, the child answers OUT LOUD
 * (place names, value words) or WITH THEIR HANDS (writing a dictated number
 * into the chart), the tutor judges in-band, and its own affirmation advances
 * the lesson. The screen only follows.
 *
 * What the click era had and this file no longer does: two multiple-choice
 * rows with Check buttons (the place menu and the word-form menu), a printed
 * build target ("Now build 247") that made phase 3 a copy task, a Next Number
 * control, a hint ladder, two 1200ms phase-advance timers, and an improvised
 * tutor-commentary channel of nine pushed turns. The cues carry the entire
 * spoken surface now; progression has exactly one cause, a tutor verdict.
 *
 * ⭐ THE CHART IS AN ANSWER KEY IN PIXELS FOR find_place — the FOURTH port in
 * a row with this defect class (ten-frame's running counter, compare-objects'
 * numbered unit boxes, ordinal-line's ordinal labels, now the column headers).
 * While the ask is "which place is the four in?", labeled columns above the
 * glowing digit ARE the answer, so analyze items render the NUMERAL ONLY — no
 * chart, no headers. The labeled chart appears exactly where it is the page
 * and not the key: on build items, where the answer is WHICH DIGIT goes in
 * each labeled column (the ten-frame R6 boundary — the action was the costume,
 * never the paper), and in the find_place REVEAL, where the column name is
 * earned. The same rule deletes the "Target: 247" print and the green
 * match-coloring on the live readout (a Check button that presses itself
 * visually); the readout survives as the child's own trace, neutral at every
 * tier.
 *
 * HOW A HANDS TURN CLOSES: stillness (`runner.armStillness`), shortened once
 * every column is filled — never correctness-gated (a wrong number commits
 * exactly as readily as the right one; that is what gives the tutor something
 * to teach). The two windows are compare-objects' calibration pair, hand-tuned
 * by ear there too.
 *
 * NO TIMED STIMULUS: the numeral (analyze) and the empty chart (build) are on
 * screen for the whole item, so there is no `onPresentStimulus` and no clock
 * to get wrong.
 *
 * DOCTRINE HELD: open mic, never push-to-talk; the mic is never gated on
 * tutor-busy; the tutor speaks only scripted lines; no visible timers;
 * tap-to-hear re-speaks the QUESTION (on a build item that re-dictates the
 * number — which is what replaces the printed target); interaction is gated on
 * `runner.canAttempt`, never on `runner.stage`; the reveal renders on
 * `runner.revealHeld` and is never cleared in `onItemOpened` (18b).
 *
 * Inside a live runtime with a resolved pin, the shared teaching workspace
 * replaces the scripted runner (W1, `placeValueWorkspace.ts`): the tutor
 * teaches in its own words, the observer commits outcomes, and the chart still
 * checks a written number itself. Everything above describes the page both share.
 */

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { placeValueVoiceObservation } from './placeValueEvidence';
import { placeValueContentIdentity } from '../../../service/math/placeValueOpportunityContract';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaPanel,
  LuminaChallengeCounter,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { PlaceValueChartMetrics } from '../../../evaluation/types';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
  type JudgedScriptRunnerOptions,
} from '../../../hooks/useJudgedScriptRunner';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { placeValueChartPipPose } from '../../../pip/placeValueChartPipPose';
import { PIP_DOCK_CLASS } from '../../../pip/useWorkspacePipSurface';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import {
  buildVerdictCue,
  itemsFromChallenges,
  placeValuePackBase,
  type PlaceValueItem,
  type PlaceValueMode,
  type PlaceValueTier,
} from './placeValueScript';
import { placeLabel } from './spokenNumberWords';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type PlaceValueChartChallengeType =
  | 'identify'
  | 'build'
  | 'compare'
  | 'expanded_form';

/** One place-value challenge: one number. The judged loop assigns each
 *  challenge ONE role (analyze — the number prints and its glowing digit gets
 *  two spoken asks; or dictate — the number never prints and the tutor says it
 *  for the child to write). The click era's MC rows are declared because the
 *  generator still emits them, and READ BY NOTHING: no judged item carries
 *  them, so a cached challenge cannot put the buttons back. */
export interface PlaceValueChartChallenge {
  id: string;
  targetNumber: number;
  highlightedDigitPlace: number;
  minPlace: number;
  maxPlace: number;
  placeNameChoices: string[];
  digitValueChoices: { value: number; wordForm: string }[];
}

import type { LearningAdaptation } from '../../../service/generation/learningAdaptation';
import { useLiveRuntime } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { useLiveAutoStart } from '../../../components/live-activity/runtime/useLiveAutoStart';
import { usePlaceValueRuntime } from './usePlaceValueRuntime';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { commitGesture, useWorkspaceRunner, type LiveRun, type WorkspaceRunOptions }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { chartComplete, chartMatches, describeChart, workspaceAssignment, workspaceScene } from './placeValueWorkspace';
export interface PlaceValueChartData {
  title: string;
  description: string;
  challenges: PlaceValueChartChallenge[];
  /** Eval mode pinned for this session (all challenges share one mode). */
  challengeType: PlaceValueChartChallengeType;

  // Session-level render levers (resolved by the generator's support tier).
  showExpandedForm?: boolean;
  showMultipliers?: boolean;
  supportTier?: 'easy' | 'medium' | 'hard';
  gradeLevel?: string;
  misconceptionOpportunity?: { id: string; lessonId: string; grade: string; curriculumVersion: string };
  learningAdaptation?: LearningAdaptation<'contrast_digit_worth' | 'contrast_place_name_and_value'>;

  // Evaluation integration (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PlaceValueChartMetrics>) => void;
}

interface PlaceValueChartProps {
  data: PlaceValueChartData;
  className?: string;
  /** The live host opts in only after its correlated mount handoff. */
  autoStart?: boolean;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  find_place:   { label: 'Find the Place', icon: '📍' },
  say_value:    { label: 'Say the Value',  icon: '💰' },
  build_number: { label: 'Write It',       icon: '🏗️' },
};

/**
 * HOW LONG THE CHART MAY STAY STILL BEFORE IT COMMITS. The window is the
 * runner's (`armStillness`, 19c); these are the per-shape numbers, carried
 * from compare-objects where they were tuned by ear. Both are STRUCTURAL,
 * never correctness-gated — a wrong number commits through the same window as
 * the right one.
 */
/** Mid-write: a child pauses to think between digits. */
const WRITE_SETTLE_MS = 4000;
/** Every column filled — a terminal shape, but a mis-type is normal, so it
 *  still waits a beat rather than committing on the keystroke. */
const WRITE_COMPLETE_SETTLE_MS = 1500;

const multiplierLabel = (place: number): string => `×${Math.pow(10, place).toLocaleString()}`;

// ============================================================================
// Component
// ============================================================================

/**
 * The scripted runner's options beside the workspace controller's (compare-objects' shape).
 * `digitsByPlace` feeds the runner-era runtime registration only.
 */
type PlaceValueControllerOptions = Omit<WorkspaceRunOptions<PlaceValueItem>, 'primitiveId' | 'assignment' | 'onFinished'>
  & Omit<JudgedScriptRunnerOptions<PlaceValueItem>, 'pack' | 'instanceId' | 'onItemOpened' | 'onFinished'>
  & { pack?: JudgedScriptPack<PlaceValueItem>; digitsByPlace: Record<number, string>;
    onFinished: (summary: PlaceValueFinish) => void };

/** What the metrics read, from either controller's finished record. */
type PlaceValueFinish = Pick<JudgedRunSummary, 'outcomes' | 'accuracy' | 'attemptsCount' | 'firstTryCount' | 'diagnosisEvidence'
  | 'solvedCount' | 'learningResponses'> & Partial<Pick<JudgedRunSummary, 'hearTaps' | 'opportunityEvents'>>
  & { teachingAttempts?: unknown; assistanceProvenance?: string };

function useScriptedController(options: PlaceValueControllerOptions): LiveRun<PlaceValueItem> {
  const runner = useJudgedScriptRunner<PlaceValueItem>({ ...options, pack: options.pack! });
  // The SESSION's mode, never `runner.currentItem`: a mount's identity must not change while the runner owns it.
  usePlaceValueRuntime({ runner, instanceId: options.instanceId, objectiveId: options.objectiveId,
    planItemId: options.planItemId, evalMode: options.evalMode, digitsByPlace: options.digitsByPlace });
  return runner;
}

const useWorkspaceController = (options: PlaceValueControllerOptions): LiveRun<PlaceValueItem> =>
  useWorkspaceRunner<PlaceValueItem>({ ...options, primitiveId: 'place-value-chart', assignment: workspaceAssignment });

/** The chart as written, one entry per column HIGH -> LOW. */
const writtenOf = (item: PlaceValueItem, digits: Record<number, string>) =>
  item.chartPlaces.map((p) => { const d = digits[p]; return d === undefined || d === '' ? null : Number(d); });

const PlaceValueChartSurface = ({ data, className, autoStart = false, runtimePlanItemId, runtimeEvalMode, tutorOwned, useController }:
  PlaceValueChartProps & { tutorOwned: boolean; useController: (options: PlaceValueControllerOptions) => LiveRun<PlaceValueItem> }) => {
  const liveRuntime = useLiveRuntime();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    challenges = [],
    challengeType,
    showExpandedForm = true,
    showMultipliers = true,
    supportTier,
    gradeLevel,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `place-value-chart-${Math.round(performance.now())}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Items: the session's judged asks, gates applied (KEEP-OR-DROP) ────────
  const items = useMemo(() => {
    const mode = (['identify', 'build', 'compare', 'expanded_form'] as const).includes(
      challengeType,
    )
      ? (challengeType as PlaceValueMode)
      : 'compare';
    const tier: PlaceValueTier = supportTier ?? 'medium';
    return itemsFromChallenges(challenges, { mode, tier }).items;
  }, [challenges, challengeType, supportTier]);

  // ── Per-item stage state ──────────────────────────────────────────────────
  /** The child's written digits, keyed by PLACE. Their trace, not the key. */
  const [digitsByPlace, setDigitsByPlace] = useState<Record<number, string>>({});
  /** Post-answer only (answer-leak rule). NOT cleared when the next item opens:
   *  that clear and the `onAffirmed` that set it land in one React batch, so
   *  the reveal would paint on the last item and nowhere else (18b).
   *  `runner.revealHeld` is the gate. */
  const [reward, setReward] = useState<string | null>(null);
  /** What the chart held when it last stopped changing. */
  const writtenRef = useRef<Record<number, string>>({});

  const evaluation = usePrimitiveEvaluation<PlaceValueChartMetrics>({
    primitiveType: 'place-value-chart',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── The pack: the exported cue surface + what only a mounted component owns ─
  const pack = useMemo<JudgedScriptPack<PlaceValueItem> | undefined>(() => tutorOwned ? undefined : ({
    ...placeValuePackBase(items),
    statusLines: {
      ready: (item) =>
        item.answerKind === 'gesture'
          ? 'Listen to the number, then write it.'
          : 'Listen, then answer out loud.',
    },
    // One record per attempt. The voice helper annotates an apparent contradiction on the assumption of a
    // correction, so an affirmed attempt keeps the actual transcript instead.
    observation: (item, { heard, verdict }) => {
      if (item.answerKind === 'gesture') return {
        challenge: `write ${item.targetNumber} from dictation`,
        expected: String(item.targetNumber),
        observed: item.chartPlaces.map(p => writtenRef.current[p] ?? '·').join(''),
      };
      const task = placeValueVoiceObservation(item, heard);
      return verdict === 'corrected' ? task : heard ? { ...task, observed: heard } : null;
    },
  }), [items, tutorOwned]);

  // ── Per-item reset — every item owns its starting state ───────────────────
  const resetStageFor = useCallback(() => {
    setDigitsByPlace({});
    writtenRef.current = {};
  }, []);

  // ── Metrics ───────────────────────────────────────────────────────────────
  const handleFinished = useCallback(async (summary: PlaceValueFinish) => {
    const metrics: PlaceValueChartMetrics = {
      type: 'place-value-chart',
      challengeType,
      totalChallenges: items.length,
      correctCount: summary.solvedCount,
      attemptsCount: summary.attemptsCount,
      firstTryCount: summary.firstTryCount,
      hintsViewed: summary.hearTaps ?? 0,
      overallAccuracy: summary.accuracy,
      averageAttemptsPerChallenge:
        Math.round((summary.attemptsCount / Math.max(1, items.length)) * 10) / 10,
    };
    let opportunityEvidence;
    if (data.misconceptionOpportunity && summary.opportunityEvents) {
      try {
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(placeValueContentIdentity(data)));
        opportunityEvidence = {
          opportunity_set_id: data.misconceptionOpportunity.id,
          lesson_id: data.misconceptionOpportunity.lessonId,
          grade: data.misconceptionOpportunity.grade,
          curriculum_version: data.misconceptionOpportunity.curriculumVersion,
          content_hash: Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join(''),
          completed: summary.outcomes.length === items.length,
          events: summary.opportunityEvents,
        };
      } catch { /* normal evaluation still submits without remediation credit */ }
    }
    evaluation.submitResult(
      summary.solvedCount === items.length,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes,
        problem: { challengeType, supportTier: data.supportTier, challenges: data.challenges },
        diagnosisEvidence: summary.diagnosisEvidence,
        learningResponses: summary.learningResponses,
        ...(summary.teachingAttempts ? { teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance } : {}),
        ...(opportunityEvidence ? { misconception_opportunity: opportunityEvidence } : {}) },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items, challengeType, evaluation, data]);

  const runner = useController({
    items, workspace, objectiveId, planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount, never `runner.currentItem`: a mount's
    // identity must not change while the runner owns it.
    evalMode: runtimeEvalMode || items[0]?.kind || 'default',
    digitsByPlace,
    // Load-bearing for the live host: without it the runner's `resume()` early-returns,
    // its speech holds never settle, and the completion handoff has nothing to read.
    runtime: liveRuntime,
    ...(!tutorOwned && runtimePlanItemId ? { completionCue: '[PV_COMPLETE] Say exactly: "You finished this activity. Nice work!" Then wait silently for the lesson host.' } : {}),
    recordOpportunityEvents: !!data.misconceptionOpportunity,
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel: gradeLevel || 'Grade 3',
    exhibitId,
    onFinished: handleFinished,
    onItemOpened: resetStageFor,
    onAffirmed: (item) => {
      // The first moment an answer may appear on screen. The reveal is the
      // PAIRING (digit, place, worth) — the thing the click era printed as a
      // permanent scaffold, now earned.
      switch (item.kind) {
        case 'find_place':
          setReward(`${item.digit} — ${placeLabel(item.place)}`);
          break;
        case 'say_value':
          setReward(
            `${item.answerText} (${(item.digit * Math.pow(10, item.place)).toLocaleString()})`,
          );
          break;
        default: {
          const parts = item.chartPlaces
            .map((p, i) => item.expectedDigits[i] * Math.pow(10, p))
            .filter((v) => v > 0)
            .map((v) => v.toLocaleString());
          setReward(`${item.targetNumber.toLocaleString()} = ${parts.join(' + ')}`);
        }
      }
    },
    onCorrectionRetry: (item) => {
      // The tutor re-modeled in-band; clear the chart for another go. The
      // stillness window is cancelled by the runner on this path.
      if (item.kind === 'build_number') {
        setDigitsByPlace({});
        writtenRef.current = {};
      }
    },
  });

  const currentItem = runner.currentItem;
  // The workspace path shows its summary without an evaluation provider (the live host has none).
  const showSummary = !!runner.practiceSummary || evaluation.hasSubmitted;

  // ── Pip shared surface ────────────────────────────────────────────────────
  // A projection of the runner's phase onto the stage and the column the child
  // is writing in; Pip never writes a digit, judges, or advances.
  const pip = usePipTargets(currentItem?.id ?? null, runner.canAttempt);
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !currentItem || showSummary) return null;
    const targets = pip.targets();
    const pose = placeValueChartPipPose({
      gesture: currentItem.answerKind === 'gesture',
      running: runner.running, preparing: runner.preparing,
      currentSolved: runner.currentSolved, revealHeld: runner.revealHeld,
      judging: runner.stage === 'judging', tutorSpeaking: runner.tutorSpeaking,
      cueMatchesItem: runner.cuedItemId === currentItem.id,
      visibleIds: targets.map((target) => target.id), lastTouchedId: pip.lastTouchedId,
    });
    return { instanceId: resolvedInstanceId, scopeId: currentItem.id, label: 'Place value', dock: pip.dock.current, targets, pose };
  });

  // ── The gesture commit ────────────────────────────────────────────────────
  // No Submit control: nothing on screen may carry the child forward. The
  // close describes the written number; THE MATCH IS COMPUTED IN CODE.
  const commitChart = useCallback(() => {
    const item = runner.currentItem;
    if (!item || item.kind !== 'build_number') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    const written = writtenOf(item, writtenRef.current);
    // The chart checks its own number, with the same code match the cue reports.
    commitGesture(runner, { response: describeChart(item, written), correct: chartMatches(item, written),
      cue: () => buildVerdictCue(item, written) });
  }, [runner]);

  /** A hands turn closes on stillness; a full chart shortens the window but
   *  never commits on the keystroke (a mis-type is normal). Further typing
   *  re-arms it, and the runner cancels it at item open, at a correction and
   *  at the commit. */
  const armWriteSettle = useCallback((next: Record<number, string>) => {
    const item = runner.currentItem;
    writtenRef.current = next;
    if (!item || item.kind !== 'build_number') return;
    const complete = chartComplete(item, writtenOf(item, next));
    runner.armStillness(commitChart, complete ? WRITE_COMPLETE_SETTLE_MS : WRITE_SETTLE_MS);
  }, [runner, commitChart]);

  const handleDigitChange = useCallback((place: number, value: string) => {
    const item = runner.currentItem;
    if (!item || item.kind !== 'build_number') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    const sanitized = value.replace(/[^0-9]/g, '').slice(-1);
    if (sanitized !== '') SoundManager.tick();
    setDigitsByPlace((prev) => {
      const next = { ...prev };
      if (sanitized === '') delete next[place];
      else next[place] = sanitized;
      return next;
    });
    // Computed OUTSIDE the state updater on purpose: `armWriteSettle` arms a
    // real timer, and a side effect inside an updater runs twice under
    // StrictMode's double-invoke — two live stillness windows racing to commit
    // the same chart.
    const next = { ...digitsByPlace };
    if (sanitized === '') delete next[place];
    else next[place] = sanitized;
    armWriteSettle(next);
  }, [runner, digitsByPlace, armWriteSettle]);

  // ── The drawings ──────────────────────────────────────────────────────────

  /** The numeral, comma-grouped, one digit glowing. Analyze items only — the
   *  labeled chart would be the find_place answer in pixels. */
  const renderNumeral = (item: PlaceValueItem) => {
    const str = String(item.targetNumber);
    const cells: React.ReactNode[] = [];
    for (let i = 0; i < str.length; i++) {
      const place = str.length - 1 - i;
      if (i > 0 && (str.length - i) % 3 === 0) {
        cells.push(<span key={`c${i}`} className="text-slate-500">,</span>);
      }
      const glowing = place === item.place;
      cells.push(
        <span
          key={`d${i}`}
          className={glowing
            ? 'text-indigo-200 bg-indigo-500/20 px-1.5 py-0.5 rounded-lg border border-indigo-400/50 mx-0.5 shadow-lg shadow-indigo-500/20'
            : 'text-white'}
        >
          {str[i]}
        </span>,
      );
    }
    return (
      <div className="flex flex-col items-center py-6 gap-2">
        <div className="text-5xl font-bold font-mono flex items-end justify-center gap-0.5">
          {cells}
        </div>
        {/* The column name is the find_place ANSWER — reveal only, never a
            scaffold, whatever the click era's headers did. */}
        <div className="h-5 text-sm font-semibold tracking-wide text-emerald-300">
          {runner.revealHeld && item.kind === 'find_place' ? placeLabel(item.place) : ''}
        </div>
      </div>
    );
  };

  /** The chart — build items only, where the labeled columns are the PAGE (the
   *  answer is which digit goes in each), never the key. No printed target, no
   *  match-coloring: the tutor's dictation is the stimulus and her verdict is
   *  the only grader. */
  const renderChart = (item: PlaceValueItem) => {
    const written = item.chartPlaces.map((p) => digitsByPlace[p] ?? '');
    const child = written.every((d) => d === '')
      ? null
      : Number(item.chartPlaces.map((p) => digitsByPlace[p] || '0').join(''));
    const expandedParts = item.chartPlaces
      .map((p) => Number(digitsByPlace[p] || '0') * Math.pow(10, p))
      .filter((v) => v > 0)
      .map((v) => v.toLocaleString());

    return (
      <div className="py-4 px-2">
        <div className="overflow-x-auto">
          <div className="inline-flex flex-col min-w-full items-center">
            {showMultipliers && (
              <div className="flex gap-2 mb-1">
                {item.chartPlaces.map((p) => (
                  <div key={`m${p}`} className="w-16 text-center text-[10px] font-mono text-indigo-300/70">
                    {multiplierLabel(p)}
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 mb-2">
              {item.chartPlaces.map((p) => (
                <div key={`h${p}`} className="w-16 text-center text-[10px] font-semibold uppercase tracking-wide text-blue-300">
                  {placeLabel(p)}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              {item.chartPlaces.map((p) => (
                <input
                  key={`i${p}`}
                  ref={pip.ref(`digit-${p}`)}
                  data-pip-object={`digit-${p}`}
                  onFocus={() => pip.look(`digit-${p}`)}
                  type="text"
                  inputMode="numeric"
                  value={digitsByPlace[p] || ''}
                  onChange={(e) => handleDigitChange(p, e.target.value)}
                  disabled={!runner.canAttempt || runner.isAwaitingGesture()}
                  className="w-16 bg-slate-800/50 border border-white/10 rounded-lg px-2 py-4 text-center text-3xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-600 disabled:opacity-60"
                  maxLength={1}
                  placeholder="·"
                  aria-label={placeLabel(p)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* The child's own trace — their digits read back as a number. Neutral
            at every tier: a green-on-match readout is a Check button that
            presses itself. */}
        {child !== null && (
          <div className="mt-4 text-center text-lg font-mono text-indigo-300">
            {child.toLocaleString()}
          </div>
        )}
        {showExpandedForm && expandedParts.length > 0 && (
          <div className="mt-2 text-center text-sm font-mono text-slate-400">
            {expandedParts.join(' + ')}
          </div>
        )}
      </div>
    );
  };

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!showSummary) return [];
    const practice = runner.practiceSummary;
    return phaseResultsFromSummary(items, practice ?? runner.summary, (item) => {
      const config = PHASE_TYPE_CONFIG[item.kind] ?? { label: item.kind, icon: '🔢' };
      return practice?.outcomes.find(o => o.id === item.id)?.assisted ? { ...config, label: `${config.label} (with help)` } : config;
    }).map((phase, index) => {
      const outcome = practice?.outcomes.find(o => o.id === items[index].id);
      return outcome ? { ...phase, attempts: outcome.attempts, firstTry: outcome.solved && outcome.attempts === 1 } : phase;
    });
  }, [showSummary, runner.summary, runner.practiceSummary, items]);

  const celebrationMessage = useMemo(() => {
    const spoken = items.some((i) => i.answerKind === 'voice');
    const hands = items.some((i) => i.answerKind === 'gesture');
    if (spoken && hands) return 'You said places and values out loud, and wrote numbers you heard!';
    if (spoken) return 'You said every answer out loud!';
    return 'You wrote every number you heard!';
  }, [items]);

  // ============================================================================
  // Render
  // ============================================================================

  // Workspace path: what the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!tutorOwned || !currentItem) return;
    workspace.current = { ...workspaceScene(currentItem, { written: writtenOf(currentItem, digitsByPlace) }),
      demonstration: [], canDemonstrate: false, canPresent: false, readyForResponse: true,
      mark: () => {}, clearPresentation: () => {} };
    runner.publishWorkspace?.();
  });
  // AFTER the runtime mount is registered, never before: `start()` waits for
  // `grantOwnership('runner')`, which cannot be granted until this primitive's
  // mount exists. Declared earlier, its effect runs first and the runner spins.
  useLiveAutoStart(autoStart, resolvedInstanceId, runner.start);

  if (items.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No place value challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const isGestureItem = currentItem?.answerKind === 'gesture';

  const stageWord = runner.stage === 'judging'
    ? 'let’s see…'
    : runner.currentSolved
      ? 'yes!'
      : runner.running
        ? (isGestureItem ? 'write it' : 'say it out loud')
        : 'get ready';

  return (
    <LuminaCard className={`shadow-2xl ${className || ''}`}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            {currentItem && (
              <div className="flex items-center gap-2">
                <LuminaBadge accent="purple" className="text-xs">
                  🔢 {challengeType}
                </LuminaBadge>
                <LuminaBadge accent="emerald" className="text-xs">
                  {PHASE_TYPE_CONFIG[currentItem.kind]?.icon} {PHASE_TYPE_CONFIG[currentItem.kind]?.label}
                </LuminaBadge>
              </div>
            )}
          </div>
          <LuminaBadge accent="cyan" className="text-xs">
            {isGestureItem ? 'Write it' : 'Say it out loud'}
          </LuminaBadge>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!showSummary && currentItem && (
          <>
            <div className="flex items-center justify-center gap-4">
              <LuminaChallengeCounter
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
              {/* Tap-to-hear — the QUESTION again, never a hint ladder. On a
                  build item this re-dictates the number, which is what
                  replaces the printed target the click era showed. With the
                  tutor (no `hearStimulus`), the learner asks the tutor instead. */}
              {runner.hearStimulus && <button
                type="button"
                onClick={runner.hearStimulus}
                className={`flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/15 border-2 border-amber-500/30 hover:bg-amber-500/25 hover:scale-105 active:scale-95 transition-all ${
                  (runner as { stimulusTapped?: boolean }).stimulusTapped ? 'ring-2 ring-cyan-300/60' : ''
                }`}
                aria-label="Hear the question again"
              >
                <span className="text-xl">🔁</span>
              </button>}
            </div>

            {pipStore && <div ref={pip.dock} data-pip-dock={resolvedInstanceId} className={PIP_DOCK_CLASS} />}

            {/* The stage. The tutor speaks the ask — no printed instruction. */}
            <div ref={pip.ref('stage')} data-pip-object="stage" className="bg-white/[0.02] rounded-xl border border-white/5 overflow-x-auto">
              {isGestureItem ? renderChart(currentItem) : renderNumeral(currentItem)}
            </div>

            {/* The reward — the first moment an answer may appear. Gated on
                `revealHeld`, never on `currentSolved` (18b). */}
            {reward && runner.revealHeld && (
              <LuminaPanel className="p-3 text-center">
                <span className="text-emerald-300 text-lg font-black animate-bounce inline-block">
                  {reward}
                </span>
              </LuminaPanel>
            )}

            <div className="text-center text-xs uppercase tracking-[0.25em] text-cyan-300">{stageWord}</div>

            <p className="text-center text-xs text-slate-500">
              {isGestureItem
                ? 'Type one digit in each column — the tutor checks when you stop.'
                : 'Listen to the question, then say your answer out loud.'}
            </p>

            {/* The orb tells the truth about the turn: a hands item is not
                "I'm listening". */}
            <JudgedMicPanel run={runner} gestureLabel="Write the number" />
          </>
        )}

        {showSummary && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Place Value Complete!"
            celebrationMessage={celebrationMessage}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the runner, whose context push and cue loop would run beside the tutor.
const PlaceValueChart = withWorkspaceController<PlaceValueChartProps, PlaceValueControllerOptions, LiveRun<PlaceValueItem>>(
  'place-value-chart', PlaceValueChartSurface, useScriptedController, useWorkspaceController);

export default PlaceValueChart;
