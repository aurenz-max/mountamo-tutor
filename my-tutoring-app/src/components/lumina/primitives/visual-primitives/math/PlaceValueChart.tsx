'use client';

/**
 * PlaceValueChart — taught on the shared tutor/JEV workspace (`placeValueChart.boss.ts`); a mount with no tutor shows
 * the shared "needs the tutor" card (`withWorkspaceOnly`). The tutor asks, the child answers OUT LOUD (place names,
 * value words) or WITH THEIR HANDS (writing a dictated number into the chart); the tutor judges the spoken answers
 * against the key, the chart checks a written number itself, and the workspace advances.
 *
 * ⭐ THE CHART IS AN ANSWER KEY IN PIXELS FOR find_place. While the ask is "which place is the four in?", labeled
 * columns above the glowing digit ARE the answer, so analyze items render the NUMERAL ONLY — no chart, no headers.
 * The labeled chart appears exactly where it is the page and not the key: on build items, where the answer is WHICH
 * DIGIT goes in each labeled column, and in the find_place REVEAL, where the column name is earned. The same rule
 * deletes a printed build target and any green match-colouring on the readout; the readout survives as the child's own
 * trace, neutral at every tier.
 *
 * HOW A HANDS TURN CLOSES: stillness (`runner.armStillness`), shortened once every column is filled — never
 * correctness-gated (a wrong number commits exactly as readily as the right one).
 */

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import type { LearningAdaptation } from '../../../service/generation/learningAdaptation';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { useWorkspaceRunner, type TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { PlaceValueItem } from './placeValueDomain';
import {
  BLOCKS_LEVER, MODEL_LEVER, PLACE_VALUE_LEVERS, READBACK_LEVER, TEEN_LEVER, VALUE_MODEL_LEVER, WORTH_LEVER,
  placeValueLeverContext, startLevers, teenDigit, valueModel,
} from './placeValueLevers';
import { chartComplete, chartMatches, describeChart, placeValueMiss, workspaceScene } from './placeValueWorkspace';
import { placeValueChartBoss, placeValueItems } from './placeValueChart.boss';
import { placeLabel } from './spokenNumberWords';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { phaseResultsFromSummary, practiceScore } from '../../../hooks/usePhaseResults';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type PlaceValueChartChallengeType =
  | 'identify'
  | 'build'
  | 'compare'
  | 'expanded_form';

/** One place-value challenge: one number. Each challenge takes ONE role (analyze — the number prints and its glowing
 *  digit gets two spoken asks; or dictate — the number never prints and the ask says it for the child to write). The
 *  click era's MC rows are declared because the generator still emits them, and READ BY NOTHING. */
export interface PlaceValueChartChallenge {
  id: string;
  targetNumber: number;
  highlightedDigitPlace: number;
  minPlace: number;
  maxPlace: number;
  placeNameChoices: string[];
  digitValueChoices: { value: number; wordForm: string }[];
}

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
  /** Kept for hosts that still pass it; the workspace starts with the lesson. */
  autoStart?: boolean;
  runtimePlanItemId?: string;
  /** The RESOLVED eval mode from the mount; selects the teaching workspace inside a live runtime. */
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

const PRACTICE_NOTE = 'An easier number to write is on screen in place of the item. It is not graded; the full item comes back after it.';

/** Mid-write: a child pauses to think between digits. Structural, never correctness-gated. */
const WRITE_SETTLE_MS = 4000;
/** Every column filled — a terminal shape, but a mis-type is normal, so it still waits a beat. */
const WRITE_COMPLETE_SETTLE_MS = 1500;

const multiplierLabel = (place: number): string => `×${Math.pow(10, place).toLocaleString()}`;

/** The chart as written, one entry per column HIGH -> LOW. */
const writtenOf = (item: PlaceValueItem, digits: Record<number, string>) =>
  item.chartPlaces.map((p) => { const d = digits[p]; return d === undefined || d === '' ? null : Number(d); });

// ============================================================================
// Component
// ============================================================================

const PlaceValueChartSurface = ({ data, className, runtimePlanItemId }: PlaceValueChartProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    challengeType,
    showExpandedForm = true,
    showMultipliers = true,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `place-value-chart-${Math.round(performance.now())}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // The boss's items: the family's build gate drops an unaskable challenge.
  const items = useMemo(() => placeValueItems(data), [data]);
  const leverCtx = useMemo(() => placeValueLeverContext(items), [items]);

  /** The child's written digits, keyed by PLACE. Their trace, not the key. */
  const [digitsByPlace, setDigitsByPlace] = useState<Record<number, string>>({});
  // In-item levers, keyed by the session item they were pulled on, and the plainer dictation a simplify lever put on
  // screen in its place. The refs are what event handlers read.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<PlaceValueItem | null>(null);
  const practiceRef = useRef<PlaceValueItem | null>(null);
  const displayItemRef = useRef<PlaceValueItem | null>(null);
  /** Post-answer only (answer-leak rule); `runner.revealHeld` is the gate. */
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

  const resetStage = useCallback(() => {
    setDigitsByPlace({});
    writtenRef.current = {};
  }, []);

  // ── Metrics: once, from the scored session, under an evaluation provider ──
  const handleFinished = useCallback((summary: TeachingEvaluationResult) => {
    const metrics: PlaceValueChartMetrics = {
      type: 'place-value-chart',
      challengeType,
      totalChallenges: items.length,
      correctCount: summary.solvedCount,
      attemptsCount: summary.attemptsCount,
      firstTryCount: summary.firstTryCount,
      hintsViewed: 0,
      overallAccuracy: summary.accuracy,
      averageAttemptsPerChallenge:
        Math.round((summary.attemptsCount / Math.max(1, items.length)) * 10) / 10,
    };
    evaluation.submitResult(
      summary.solvedCount === items.length,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes,
        problem: { challengeType, supportTier: data.supportTier, challenges: data.challenges },
        diagnosisEvidence: summary.diagnosisEvidence,
        learningResponses: summary.learningResponses,
        teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items, challengeType, evaluation, data]);

  const runner = useWorkspaceRunner<PlaceValueItem>({
    primitiveId: 'place-value-chart',
    assignment: placeValueChartBoss.assignment,
    items,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    instanceId: resolvedInstanceId,
    onFinished: handleFinished,
    // A fresh item never carries a plainer dictation over from the last one.
    onItemOpened: () => { practiceRef.current = null; setPractice(null); resetStage(); },
    onAffirmed: (item) => {
      // The first moment an answer may appear on screen: the PAIRING (digit, place, worth), earned.
      switch (item.kind) {
        case 'find_place':
          setReward(`${item.digit} — ${placeLabel(item.place)}`);
          break;
        case 'say_value':
          setReward(`${item.answerText} (${(item.digit * Math.pow(10, item.place)).toLocaleString()})`);
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
    // A checked miss clears the chart for another go (the practice chart too); a spoken retry has nothing to clear.
    onCorrectionRetry: (sessionItem) => {
      if ((practiceRef.current ?? sessionItem).kind === 'build_number') resetStage();
    },
  });

  const sessionItem = runner.currentItem;
  /** What is on screen: the plainer dictation while a simplify lever holds it, else the session item. */
  const currentItem = practice ?? sessionItem;
  displayItemRef.current = currentItem;
  const startPulled = startLevers(sessionItem, { showMultipliers, showExpandedForm });
  const pulledLevers = leverState.item === sessionItem?.id ? leverState.pulled : startPulled;
  /** A lever pulled on the session item, or set by the tier from the start. */
  const leverOn = (id: string) => pulledLevers.includes(id);
  const showSummary = !!runner.practiceSummary || evaluation.hasSubmitted;

  // ── The gesture commit: the chart checks its own number ───────────────────
  const commitChart = useCallback(() => {
    const item = displayItemRef.current;
    if (!item || item.kind !== 'build_number') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    const written = writtenOf(item, writtenRef.current);
    runner.commitGesture({ response: describeChart(item, written), correct: chartMatches(item, written),
      miss: placeValueMiss(item, written), cue: () => '' });
  }, [runner]);

  /** A hands turn closes on stillness; a full chart shortens the window but never commits on the keystroke. */
  const armWriteSettle = useCallback((next: Record<number, string>) => {
    const item = displayItemRef.current;
    writtenRef.current = next;
    if (!item || item.kind !== 'build_number') return;
    const complete = chartComplete(item, writtenOf(item, next));
    runner.armStillness(commitChart, complete ? WRITE_COMPLETE_SETTLE_MS : WRITE_SETTLE_MS);
  }, [runner, commitChart]);

  const handleDigitChange = useCallback((place: number, value: string) => {
    const item = displayItemRef.current;
    if (!item || item.kind !== 'build_number') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    const sanitized = value.replace(/[^0-9]/g, '').slice(-1);
    if (sanitized !== '') SoundManager.tick();
    const next = { ...digitsByPlace };
    if (sanitized === '') delete next[place];
    else next[place] = sanitized;
    setDigitsByPlace(next);
    // Outside a state updater on purpose: `armWriteSettle` arms a real timer, and StrictMode double-invokes updaters.
    armWriteSettle(next);
  }, [runner, digitsByPlace, armWriteSettle]);

  // ── The scene and the levers, republished after every render ──────────────
  useLayoutEffect(() => {
    if (!currentItem) return;
    const scene = workspaceScene(currentItem, { written: writtenOf(currentItem, digitsByPlace) });
    const levers = practice ? [] : PLACE_VALUE_LEVERS.declare(sessionItem, leverCtx, pulledLevers);
    // A tier's starting position is on screen from the start; the fact names only what a pull added.
    const pulledLive = pulledLevers.filter(id => !startPulled.includes(id));
    const published = leverScene(scene, {
      support: practice ? '' : PLACE_VALUE_LEVERS.support(sessionItem, leverCtx),
      onScreen: practice ? '' : PLACE_VALUE_LEVERS.onScreen(sessionItem, leverCtx, pulledLive),
    });
    workspace.current = {
      ...published,
      facts: { ...published.facts, ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the chart changes before this returns.
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !sessionItem || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        const pulled = { item: sessionItem.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = PLACE_VALUE_LEVERS.simpler(sessionItem, leverCtx, id);
          if (!easier) return 'There is no plainer number for this item.';
          setLeverState(pulled);
          practiceRef.current = easier; setPractice(easier); resetStage(); runner.clearStillness();
          return { practice: placeValueChartBoss.assignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { practiceRef.current = null; setPractice(null); resetStage(); },
    };
  });

  // ── The drawings ──────────────────────────────────────────────────────────

  /** The numeral, comma-grouped, one digit glowing. Analyze items only — the labeled chart would be the find_place
   *  answer in pixels. */
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
        {/* The column name is the find_place ANSWER — reveal only, never a scaffold. */}
        <div className="h-5 text-sm font-semibold tracking-wide text-emerald-300">
          {runner.revealHeld && item.kind === 'find_place' ? placeLabel(item.place) : ''}
        </div>
      </div>
    );
  };

  /** The chart — build items only, where the labeled columns are the PAGE (the answer is which digit goes in each),
   *  never the key. No printed target, no match-colouring: the chart's own check is the only grader. */
  const renderChart = (item: PlaceValueItem) => {
    const written = item.chartPlaces.map((p) => digitsByPlace[p] ?? '');
    // A column left empty is a gap, never a zero (contract R8): "5_1" is not 501, and the check says so.
    const complete = written.every((d) => d !== '');
    const child: string | null = written.every((d) => d === '') ? null
      : complete ? Number(written.join('')).toLocaleString() : written.map((d) => d || '_').join(' ');
    const expandedParts = !complete ? [] : item.chartPlaces
      .map((p) => Number(digitsByPlace[p]) * Math.pow(10, p))
      .filter((v) => v > 0)
      .map((v) => v.toLocaleString());

    return (
      <div className="py-4 px-2">
        <div className="overflow-x-auto">
          <div className="inline-flex flex-col min-w-full items-center">
            {leverOn(WORTH_LEVER) && (
              <div className="flex gap-2 mb-1" data-lever="column-worth">
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
                  data-pip-object={`digit-${p}`}
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

        {/* The child's own trace — their digits read back as a number. Neutral at every tier. */}
        {child !== null && (
          <div className="mt-4 text-center text-lg font-mono text-indigo-300">
            {child}
          </div>
        )}
        {leverOn(READBACK_LEVER) && expandedParts.length > 0 && (
          <div className="mt-2 text-center text-sm font-mono text-slate-400" data-lever="expanded-readback">
            {expandedParts.join(' + ')}
          </div>
        )}
      </div>
    );
  };

  /** say_value's model: another number, a digit glowing in the item's place and its worth under it. No place name. */
  const renderValueModel = (item: PlaceValueItem) => {
    const model = valueModel(item, leverCtx.asked);
    if (!model) return null;
    const str = String(model.number);
    return (
      <div data-lever="model-value" className="flex flex-col items-center gap-1 rounded-lg border border-amber-300/40 bg-amber-400/5 px-3 py-2">
        <div className="text-2xl font-mono font-bold">
          {str.split('').map((ch, i) => (
            <span key={i} className={str.length - 1 - i === model.place ? 'text-amber-100 bg-amber-500/20 rounded px-1' : 'text-slate-300'}>{ch}</span>
          ))}
        </div>
        <div className="text-sm text-amber-200">= {model.worth}</div>
      </div>
    );
  };

  /** say_value's block picture: the glowing digit as that many blocks of its place, no numeral or word. */
  const renderBlockPicture = (item: PlaceValueItem) => {
    const size = [[6, 6], [6, 28], [28, 28], [28, 40]][item.place] ?? [28, 40];
    return (
      <div data-lever="block-picture" aria-label="Blocks for the glowing digit" className="flex flex-wrap items-end justify-center gap-1 max-w-64">
        {Array.from({ length: item.digit }, (_, i) => (
          <span key={i} className="rounded-sm border border-indigo-200/60 bg-indigo-400/70" style={{ width: size[0], height: size[1] }} />
        ))}
      </div>
    );
  };

  /** A small model chart: the number's digits in labelled boxes, beside the learner's chart, never in it. */
  const renderModel = (n: number, places: number, lever: string) => (
    <div data-lever={lever} className="flex gap-1">
      {Array.from({ length: places }, (_, i) => places - 1 - i).map((p) => (
        <div key={p} className="w-10 rounded-md border border-amber-300/40 bg-amber-400/5 text-center">
          <div className="text-[9px] uppercase text-amber-200/70">{placeLabel(p)}</div>
          <div className="text-lg font-mono text-amber-100">{Math.floor(n / 10 ** p) % 10}</div>
        </div>
      ))}
    </div>
  );

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!showSummary) return [];
    const summary = runner.practiceSummary;
    return phaseResultsFromSummary(items, summary ?? runner.summary, (item) => {
      const config = PHASE_TYPE_CONFIG[item.kind] ?? { label: item.kind, icon: '🔢' };
      return summary?.outcomes.find(o => o.id === item.id)?.assisted ? { ...config, label: `${config.label} (with help)` } : config;
    }).map((phase, index) => {
      const outcome = summary?.outcomes.find(o => o.id === items[index].id);
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

  const stageWord = runner.currentSolved
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
                {practice && <LuminaBadge accent="amber" className="text-[10px] uppercase tracking-wider">Practice</LuminaBadge>}
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
            </div>

            {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the stage below. */}
            <PipDock />
            <PipWorkspace className="space-y-4">
              {/* The stage. The tutor speaks the ask — no printed instruction. */}
              <div data-pip-object="stage" className="bg-white/[0.02] rounded-xl border border-white/5 overflow-x-auto">
                {isGestureItem ? renderChart(currentItem) : renderNumeral(currentItem)}
                {isGestureItem && sessionItem && !practice && (leverOn(MODEL_LEVER) || leverOn(TEEN_LEVER)) && (
                  <div className="mt-3 flex flex-wrap items-start justify-center gap-4">
                    {leverOn(MODEL_LEVER) && renderModel(sessionItem.modelNumber, sessionItem.chartPlaces.length, 'model-chart')}
                    {leverOn(TEEN_LEVER) && <div className="flex gap-3">
                      {renderModel(10 + teenDigit(sessionItem.targetNumber), 2, 'model-teen')}
                      {renderModel(teenDigit(sessionItem.targetNumber) * 10, 2, 'model-teen')}
                    </div>}
                  </div>
                )}
                {!isGestureItem && sessionItem?.kind === 'say_value' && !practice
                  && (leverOn(VALUE_MODEL_LEVER) || leverOn(BLOCKS_LEVER)) && (
                  <div className="mb-4 flex flex-wrap items-end justify-center gap-6">
                    {leverOn(BLOCKS_LEVER) && renderBlockPicture(sessionItem)}
                    {leverOn(VALUE_MODEL_LEVER) && renderValueModel(sessionItem)}
                  </div>
                )}
              </div>
            </PipWorkspace>

            {/* The reward — the first moment an answer may appear. Gated on `revealHeld`, never on `currentSolved`. */}
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
                ? 'Type one digit in each column — the chart checks when you stop.'
                : 'Listen to the question, then say your answer out loud.'}
            </p>

            {/* The orb tells the truth about the turn: a hands item is not "I'm listening". */}
            <JudgedMicPanel run={runner} gestureLabel="Write the number" />
          </>
        )}

        {showSummary && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(runner.practiceSummary) ?? evaluation.submittedResult?.score}
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

const PlaceValueChart = withWorkspaceOnly<PlaceValueChartProps>('place-value-chart', PlaceValueChartSurface, props => props.data.title);

export default PlaceValueChart;
