'use client';

/**
 * CalendarExplorer — a monthly calendar (tap a date or an option, then Check) and a spoken
 * day/month successor chain. Both run only on the shared tutor/JEV teaching workspace (workspace
 * rollout C4; the scripted runner and the click-era Check/Next progression were retired, LA-14,
 * user ruling 09-23: one path). The grid's Check is the activity's own check of the learner's pick;
 * the chain's spoken answer is judged by the observer; the runtime owns progression on both. An
 * unbound mount shows the shared "needs the tutor" card.
 */

import React, { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePrimitiveEvaluation } from '../../../evaluation';
import type { CalendarExplorerMetrics, PrimitiveEvaluationResult } from '../../../evaluation/types';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { phaseResultsFromSummary, usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { useLiveRuntime } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { calendarGridPipPose, calendarSequencePipPose } from '../../../pip/calendarExplorerPipPose';
import { useSpeechScope } from '../../../pip/useSpeechScope';
import type { CalendarSequenceItem } from './calendarExplorerScript';
import {
  calendarGridAssignment,
  calendarGridScene,
  calendarSequenceAssignment,
  calendarSequenceScene,
  calendarSequenceItemsFromChallenges,
  calendarMiss,
  describeCalendarPick,
  hearSequenceRequest,
  isSpokenCalendarSession,
} from './calendarExplorerWorkspace';
import {
  ARROW_LEVER, HEADERS_LEVER, MODEL_PAIR_LEVER, PRACTICE_NOTE, RING_LEVER, ROWS_LEVER, STRIP_LEVER, TICKS_LEVER, TINT_LEVER,
  calendarGridLevers, calendarLeverFacts, calendarPracticeItem, calendarSequenceLevers, modelPair, modelPairFact, ringDates,
  rowRanges, tintWeekday, weekStrip,
} from './calendarExplorerLevers';

export { calendarSequenceItemsFromChallenges, daySequenceItemsFromChallenges, isSpokenCalendarSession }
  from './calendarExplorerWorkspace';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface CalendarExplorerChallenge {
  id: string;
  type:
    | 'identify'
    | 'count'
    | 'pattern'
    | 'day_sequence'
    | 'month_sequence'
    | 'day_offset'
    | 'mark_events'
    | 'interval_count';
  question: string;
  /** The month to display (1-12) */
  month: number;
  /** The year to display */
  year: number;
  /** The correct answer (a day number, count, or day-of-week string) */
  correctAnswer: string;
  /** Multiple-choice options (strings) */
  options: string[];
  /** Hint text for scaffolding */
  hint: string;
  /** AI narration text */
  narration: string;
  /** For identify: which date(s) to highlight after answering */
  highlightDates?: number[];
  /**
   * The day of `month` that counts as TODAY, marked with a star from the moment the
   * question appears (highlightDates only land after a correct answer, so they cannot
   * carry this). An objective like "identify today's day of the week" or "point to
   * yesterday and tomorrow" is unanswerable without it: the calendar had no notion of
   * today, so the generator could only ask about arbitrary dates. Absent ⇒ no marker,
   * which is every plain date-lookup challenge.
   */
  todayDate?: number;
  /** For count: which day of week to count (e.g., "Tuesday") */
  targetDayOfWeek?: string;
  /** Spoken day_sequence only: the day the tutor says. Never printed. */
  currentDay?: string;
  /** Spoken day_sequence only: the successor the live tutor judges. */
  expectedDay?: string;
  /** Spoken day_sequence only: 1-based position in the continuing chain. */
  chainPosition?: number;
  /** Spoken month_sequence only: the month the tutor says. Never printed. */
  currentMonth?: string;
  /** Spoken month_sequence only: the successor the live tutor judges. */
  expectedMonth?: string;
  /** day_offset only: weekday from which the student counts. */
  startDay?: string;
  /** day_offset only: number of days to count forward (1-7). */
  offsetDays?: number;
  /** mark_events only: name of the marker the student is placing. */
  eventLabel?: string;
  /** Dates visibly marked before the attempt (prior events or interval endpoints). */
  markedDates?: number[];
  /** interval_count only: first marked endpoint. */
  intervalStartDate?: number;
  /** interval_count only: second marked endpoint. */
  intervalEndDate?: number;
  /** interval_count only: whether endpoints are excluded or included. */
  countConvention?: 'between' | 'inclusive';

  // ── Within-mode support-tier scaffolds (stamped by the generator from
  //    ctx.supportTier, in code, post-parse). DISPLAY / INSTRUCTION ONLY — they
  //    never change the question, the month, or the answer. All optional: absent
  //    ⇒ legacy full-help render, which is why every read below uses `!== false`.
  //    The K band floor stamps them back to `true`; band supports always win. ──
  /** count only — pre-mark every target-day cell in purple. Default: shown. */
  showTargetDayColumn?: boolean;
  /** The Sun..Sat header row above the grid. Default: shown. */
  showDayHeaders?: boolean;
  /** The "March 2025" caption under the question. Default: shown. */
  showMonthLabel?: boolean;
}

export interface CalendarExplorerData {
  title: string;
  description?: string;
  challenges: CalendarExplorerChallenge[];
  gradeBand?: 'K' | '1' | '2' | '3' | '4-5';
  /** Within-mode support tier from the manifest. Threaded to the tutor reveal policy. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  componentIntent?: string;
  objectiveText?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<CalendarExplorerMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  identify: { label: 'Identify', icon: '📅', accentColor: 'blue' },
  count:    { label: 'Count',    icon: '🔢', accentColor: 'emerald' },
  pattern:  { label: 'Pattern',  icon: '🔍', accentColor: 'purple' },
  day_offset: { label: 'Days Forward', icon: '↪️', accentColor: 'cyan' },
  mark_events: { label: 'Mark Events', icon: '📌', accentColor: 'amber' },
  interval_count: { label: 'Days Between', icon: '↔️', accentColor: 'emerald' },
};

// ============================================================================
// Calendar Helpers
// ============================================================================

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(month: number, year: number): number {
  // 0=Sunday, 1=Monday, ...
  return new Date(year, month - 1, 1).getDay();
}

function getDayOfWeek(day: number, month: number, year: number): string {
  const dayIndex = new Date(year, month - 1, day).getDay();
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex];
}

/**
 * Is this challenge answered by clicking a date in the grid?
 *
 * Only identify challenges use the grid as the answer surface, and ONLY when the
 * expected answer is a date number — a grid click yields a numeric string, so an
 * identify challenge whose correctAnswer is a day NAME ("Saturday") could never be
 * matched from the grid. Those are answered from the generated option list instead
 * (the grid stays live for locating the date, it just isn't the answer channel).
 */
export function isGridAnswerChallenge(challenge: CalendarExplorerChallenge): boolean {
  return (challenge.type === 'identify' || challenge.type === 'mark_events')
    && /^\d+$/.test((challenge.correctAnswer ?? '').trim());
}

/**
 * Tutor reveal policy keyed to the within-mode support tier. The live tutor is a
 * SECOND scaffold channel, so its reveal latitude must match what the screen shows:
 *  - easy   → the header row, the month caption and the target-day marking are all
 *             on screen, so the tutor may name them and walk the strategy.
 *  - medium → the month caption is gone; nudge the method, don't pre-solve it.
 *  - hard   → headers, caption AND the target-day marking are all withdrawn, so the
 *             tutor must not recite the Sun..Sat order, name the column, or hand over
 *             the counting strategy — that would restore the exact scaffold the tier
 *             removed (the catalog's level-3 line spells the header order out).
 * At every tier the tutor never states the answer.
 */
export function tutorRevealPolicy(tier?: 'easy' | 'medium' | 'hard'): string {
  if (!tier) return '';
  if (tier === 'easy') {
    return '[SUPPORT_TIER easy] Full scaffolding: the day headers, the month caption and the '
      + 'highlighted target-day cells are all on screen. You may name the day-of-week order and '
      + 'point at the column to use. Never state the answer itself.';
  }
  if (tier === 'medium') {
    return '[SUPPORT_TIER medium] Light scaffolding: the month caption is off screen (the question '
      + 'names the month). Nudge the method, do not pre-solve it, and never state the answer.';
  }
  return '[SUPPORT_TIER hard] Minimal scaffolding: the day-name headers, the month caption and the '
    + 'target-day highlighting are ALL withdrawn on purpose. Do NOT recite the Sun, Mon, Tue... header '
    + 'order, do not say which column to look at, and do not hand over the counting strategy — that '
    + 'would put back the exact scaffold this tier removed. Ask what the student notices and guide by '
    + 'questioning. Never state the answer.';
}

// ============================================================================
// Component
// ============================================================================

/** PLATFORM PROP CONTRACT: registry primitives mount as
 *  `<Component data={…} index={…} />` — the generated data arrives as ONE `data`
 *  prop (evaluation props merged in), never spread across props. */
interface CalendarExplorerProps {
  data: CalendarExplorerData;
  index?: number;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

/** The teaching workspace is the grid's only controller: the runtime owns progression. */
const useCalendarProgress = useWorkspaceProgressFor('calendar-explorer');

const CalendarGridSurface = ({ data, runtimePlanItemId }: CalendarExplorerProps) => {
  const {
    title,
    description,
    challenges,
    gradeBand,
    supportTier,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    componentIntent,
    objectiveText,
    onEvaluationSubmit,
  } = data;

  // ── Evaluation ──────────────────────────────────────────────────
  const resolvedInstanceId = instanceId || 'standalone';
  const ctx = useLuminaAIContext();
  const liveRuntime = useLiveRuntime();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const componentMounted = useRef(true);
  useLayoutEffect(() => { componentMounted.current = true; return () => { componentMounted.current = false; }; }, []);
  /** A checked answer stays closed until Try again or Next challenge on the shell. */
  const workspaceClosed = useRef(false);
  const learnerBlocked = () => !componentMounted.current || workspaceClosed.current
    || !!liveRuntime && !['empty', 'active'].includes(liveRuntime.getSnapshot().status);

  const { submitResult } = usePrimitiveEvaluation<CalendarExplorerMetrics>({
    primitiveType: 'calendar-explorer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    componentIntent,
    objectiveText,
    onSubmit: onEvaluationSubmit,
  });

  // ── Challenge Progress ──────────────────────────────────────────
  const progress = useCalendarProgress<CalendarExplorerChallenge>({
    challenges, getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: calendarGridAssignment,
    // A fresh challenge and Try again both start from a clean calendar. The setters are declared
    // below; this runs only after render. Try again keeps a practice question (a simplify lever) and the
    // learner's ticks; a fresh item, or the full item back after practice, drops both.
    onItemOpened: (_index, retry) => {
      setSelectedAnswer(null); setFeedback(null); setHighlightedDates(new Set()); setClickedDate(null); setShowHint(false);
      if (!retry) { setPractice(null); setTicks({ item: '', dates: [] }); }
      challengeStartRef.current = Date.now();
    },
  });
  const {
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
  } = progress;
  workspaceClosed.current = progress.canAttempt === false;

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  const { isAudioPlaying, activePrimitiveId } = ctx;

  // ── Local State ─────────────────────────────────────────────────
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [highlightedDates, setHighlightedDates] = useState<Set<number>>(new Set());
  const [clickedDate, setClickedDate] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{ score: number } | null>(null);
  const startTimeRef = useRef(Date.now());
  const challengeStartRef = useRef(Date.now());
  // In-item levers (`calendarExplorerLevers.ts`), keyed by the session item they were pulled on; the easier practice
  // question a simplify lever puts in place of the session item until the observer returns to it; the learner's own
  // ticks (the `tick_taps` lever), keyed by the question they were made on.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<CalendarExplorerChallenge | null>(null);
  const [ticks, setTicks] = useState<{ item: string; dates: number[] }>({ item: '', dates: [] });

  const sessionChallenge = challenges[currentIndex];
  const currentChallenge = practice ?? sessionChallenge;
  const session = useMemo(() => ({ challenges, supportTier }), [challenges, supportTier]);

  // ── Support-tier scaffold reads ─────────────────────────────────
  // `!== false` ⇒ an untiered payload renders exactly as before. The K band floor
  // is re-asserted here as well: nothing a pre-reader needs is ever withdrawn.
  const preReaderBand = gradeBand === 'K';
  const baseHeaders = (c?: CalendarExplorerChallenge) => preReaderBand || c?.showDayHeaders !== false;
  const baseTint = (c?: CalendarExplorerChallenge) => preReaderBand || c?.showTargetDayColumn !== false;
  const pulledLevers = !practice && sessionChallenge && leverState.item === sessionChallenge.id ? leverState.pulled : [];
  const itemLevers = sessionChallenge ? calendarGridLevers(sessionChallenge, session,
    { headers: !baseHeaders(sessionChallenge), tint: sessionChallenge.type === 'count' && !baseTint(sessionChallenge) }, pulledLevers) : [];
  /** A help lever is drawn on the session item while pulled (or shown from the start on easy), never on practice. */
  const helpOn = (id: string) => !practice && itemLevers.some(l => l.id === id && l.kind === 'help' && l.pulled);
  const showDayHeaders = baseHeaders(currentChallenge) || helpOn(HEADERS_LEVER);
  const showMonthLabel = preReaderBand || currentChallenge?.showMonthLabel !== false;
  const showTargetDayColumn = baseTint(currentChallenge) || helpOn(TINT_LEVER);
  const ringed = new Set(helpOn(RING_LEVER) && sessionChallenge ? ringDates(sessionChallenge) ?? [] : []);
  /** The weekday whose cells are tinted: count's target (the tier's tint), or the asked weekday (the tint lever). */
  const tintDay = !currentChallenge ? null
    : currentChallenge.type === 'count' ? (showTargetDayColumn ? currentChallenge.targetDayOfWeek ?? null : null)
      : helpOn(TINT_LEVER) ? tintWeekday(currentChallenge) : null;
  const ticksOn = helpOn(TICKS_LEVER);
  const ticked = new Set(currentChallenge && ticks.item === currentChallenge.id ? ticks.dates : []);
  const rowsOn = helpOn(ROWS_LEVER);
  const ranges = rowsOn && currentChallenge ? rowRanges(currentChallenge) : [];
  const arrowOn = helpOn(ARROW_LEVER);
  const strip = helpOn(STRIP_LEVER) && currentChallenge ? weekStrip(currentChallenge) : null;

  // ── Answer surface ──────────────────────────────────────────────
  const answerFromGrid = currentChallenge ? isGridAnswerChallenge(currentChallenge) : false;
  const showOptionButtons = !answerFromGrid && (currentChallenge?.options?.length ?? 0) > 0;

  // ── Calendar Grid Data ──────────────────────────────────────────
  const calendarGrid = useMemo(() => {
    if (!currentChallenge) return [];
    const { month, year } = currentChallenge;
    const daysInMonth = getDaysInMonth(month, year);
    const firstDay = getFirstDayOfMonth(month, year);

    const grid: (number | null)[] = [];
    // Leading blanks
    for (let i = 0; i < firstDay; i++) grid.push(null);
    // Days
    for (let d = 1; d <= daysInMonth; d++) grid.push(d);
    // Trailing blanks to fill last row
    while (grid.length % 7 !== 0) grid.push(null);
    return grid;
  }, [currentChallenge]);

  // ── Handlers ────────────────────────────────────────────────────
  const handleDateClick = useCallback((day: number) => {
    if (allChallengesComplete || !currentChallenge || learnerBlocked()) return;
    SoundManager.tap();        // ← tactile date press
    setClickedDate(day);
    // The `tick_taps` lever: on a counting question each tap puts a tick on the date or takes it off.
    if (ticksOn && (currentChallenge.type === 'count' || currentChallenge.type === 'interval_count')) {
      const id = currentChallenge.id;
      setTicks(prev => {
        const dates = prev.item === id ? prev.dates : [];
        return { item: id, dates: dates.includes(day) ? dates.filter(d => d !== day) : [...dates, day] };
      });
    }
    // Only a DATE-answer identify challenge is answered by clicking the grid.
    if (isGridAnswerChallenge(currentChallenge)) {
      setSelectedAnswer(String(day));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allChallengesComplete, currentChallenge, ticksOn]);

  const handleOptionSelect = useCallback((option: string) => {
    if (allChallengesComplete || feedback || learnerBlocked()) return;
    SoundManager.select();     // ← confirms a choice
    setSelectedAnswer(option);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allChallengesComplete, feedback]);

  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge || selectedAnswer === null || learnerBlocked()) return;

    const isCorrect = selectedAnswer.toLowerCase().trim() === currentChallenge.correctAnswer.toLowerCase().trim();
    // An easier practice question is ungraded: it records nothing for the session.
    if (!practice) recordResult({
      challengeId: currentChallenge.id,
      correct: isCorrect,
      attempts: currentAttempts + 1,
      timeMs: Date.now() - challengeStartRef.current,
    });
    if (isCorrect) {
      SoundManager.playCorrect();
      setFeedback({ correct: true, message: 'Correct!' });
      if (currentChallenge.highlightDates) setHighlightedDates(new Set(currentChallenge.highlightDates));
    } else {
      SoundManager.playIncorrect();
      setFeedback({ correct: false, message: 'Not quite.' });
    }
    // The activity's own check: the workspace records it and the tutor hears what was picked, never the key.
    progress.commitCheck(describeCalendarPick(currentChallenge, selectedAnswer), isCorrect,
      isCorrect ? undefined : calendarMiss(currentChallenge, selectedAnswer));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge, selectedAnswer, currentAttempts, recordResult, practice]);

  // ── Session complete: submit once, and only under a lesson's evaluation provider ──
  const submittedOnce = useRef(false);
  useEffect(() => {
    if (!allChallengesComplete || submittedOnce.current || !progress.recordsEvaluation) return;
    submittedOnce.current = true;
    const correct = challengeResults.filter(r => r.correct).length;
    const total = challenges.length;
    const score = Math.round((correct / total) * 100);
    const metrics: CalendarExplorerMetrics = {
      type: 'calendar-explorer',
      questionsCorrect: correct,
      questionsTotal: total,
      accuracy: score,
      attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
    };
    submitResult(score >= 60, score, metrics);
    setSubmittedResult({ score });
  }, [allChallengesComplete, challengeResults, challenges.length, progress.recordsEvaluation, submitResult]);

  // ── Determine if we can proceed ─────────────────────────────────
  // A checked miss reopens on Try again, so only a correct result closes the question.
  const hasAnsweredCurrent = challengeResults.some(r => r.challengeId === currentChallenge?.id && r.correct);
  const canCheckAnswer = selectedAnswer !== null && !feedback && progress.canAttempt !== false;

  /** The learner's work back to empty: a practice question and the full item it stands in for share none. */
  const clearWork = () => {
    setSelectedAnswer(null); setFeedback(null); setHighlightedDates(new Set()); setClickedDate(null); setShowHint(false);
    setTicks({ item: '', dates: [] });
  };

  // What the tutor and the observer are shown, republished every render, with the session item's levers.
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!currentChallenge || !sessionChallenge) return;
    const scene = calendarGridScene(currentChallenge, { showDayHeaders, showMonthLabel, showTargetDayColumn,
      revealPolicy: tutorRevealPolicy(supportTier) });
    const levers = practice ? [] : itemLevers;
    const onScreen = practice ? undefined
      : calendarLeverFacts(sessionChallenge, levers.filter(l => l.kind === 'help' && l.pulled).map(l => l.id));
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}),
        // The tier withdrew the header row; the lever put it back, so pointing at it is allowed again.
        ...(helpOn(HEADERS_LEVER) ? { coaching: 'The header row is back on screen: you may point to it. Never name the answer column.' } : {}),
        ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this question.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const next = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = calendarPracticeItem(sessionChallenge, session);
          if (!easier) return 'This question is already the plainest of its kind.';
          setLeverState(next); setPractice(easier); clearWork();
          return { practice: calendarGridAssignment(easier) };
        }
        setLeverState(next);
        return true as const;
      },
      // Back to the full item, blank: the practice question is not the learner's work on it.
      endPractice: () => { setPractice(null); clearWork(); },
    };
  });

  // ── Pip shared surface ──────────────────────────────────────────
  // A projection of this question's check state, the tutor's speech on it, and
  // the child's last touch; Pip never picks a date or option, checks, or
  // advances. Tutor audio counts only while the tutor is on this block and
  // began on this question.
  const pip = usePipTargets(currentChallenge?.id ?? null, !hasAnsweredCurrent);
  const tutorSpeaking = isAudioPlaying && activePrimitiveId === resolvedInstanceId;
  const speechOnQuestion = useSpeechScope(currentChallenge?.id ?? null, tutorSpeaking);
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !currentChallenge || allChallengesComplete) return null;
    const targets = pip.targets();
    const pose = calendarGridPipPose({
      running: true, preparing: false, currentSolved: feedback?.correct === true, revealHeld: false,
      judging: false, tutorSpeaking, cueMatchesItem: !tutorSpeaking || speechOnQuestion,
      type: currentChallenge.type, answerFromGrid,
      visibleIds: targets.map((target) => target.id), lastTouchedId: pip.lastTouchedId,
    });
    return {
      instanceId: resolvedInstanceId, scopeId: currentChallenge.id, label: 'Calendar',
      dock: pip.dock.current, targets, pose,
    };
  });

  // ── Render ──────────────────────────────────────────────────────
  if (!challenges || challenges.length === 0) {
    return (
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="p-8 text-center text-slate-400">
          No challenges available.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-light text-slate-100">
              {title}
            </CardTitle>
            <Badge className="bg-white/5 border border-white/20 text-slate-300 text-xs">
              {currentIndex + 1} / {challenges.length}
            </Badge>
          </div>
          {description && (
            <p className="text-sm text-slate-400 mt-1">{description}</p>
          )}
        </CardHeader>
      </Card>

      {/* Summary panel when complete */}
      {allChallengesComplete && phaseResults.length > 0 && (
        <PhaseSummaryPanel
          phases={phaseResults}
          overallScore={submittedResult?.score ?? progress.teachingResult?.accuracy ?? 0}
          durationMs={Date.now() - startTimeRef.current}
          heading="Challenge Complete!"
          celebrationMessage="Great work exploring the calendar!"
          className="mb-6"
        />
      )}

      {/* Main calendar + question area */}
      {!allChallengesComplete && currentChallenge && (
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardContent className="p-6">
            {/* Question */}
            <div className="mb-6">
              {practice && (
                <p className="text-xs text-amber-300 mb-1" data-practice>Practice question</p>
              )}
              <p className="text-lg text-slate-100 font-medium mb-2">
                {currentChallenge.question}
              </p>
              {/* Month caption — an orientation scaffold; withdrawn at medium/hard,
                  where the question text already names the month. */}
              {showMonthLabel && currentChallenge.type !== 'day_offset' && (
                <p className="text-xs text-slate-500" data-testid="month-label">
                  {MONTH_NAMES[currentChallenge.month - 1]} {currentChallenge.year}
                </p>
              )}
            </div>

            {currentChallenge.type === 'day_offset' && (
              <div
                ref={pip.ref('offset')}
                data-pip-object="offset"
                data-testid="day-offset-surface"
                className="mb-6 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-6 text-center"
              >
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-300/70">Start day</p>
                <p className="mt-2 text-3xl font-light text-cyan-100">{currentChallenge.startDay}</p>
                <div className="my-5 flex items-center justify-center gap-2" aria-label={`${currentChallenge.offsetDays} steps forward`}>
                  {Array.from({ length: currentChallenge.offsetDays ?? 0 }, (_, index) => (
                    <span
                      key={index}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
                      aria-hidden="true"
                    >
                      →
                    </span>
                  ))}
                </div>
                <p className="text-sm text-slate-300">
                  Count forward {currentChallenge.offsetDays} {currentChallenge.offsetDays === 1 ? 'day' : 'days'}.
                </p>
                {/* The help lever `week_strip`: the week in order from the start day, only the start marked. */}
                {strip && (
                  <div data-lever="week-strip" aria-label="The week from the start day"
                    className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
                    {strip.map((day, i) => (
                      <span key={day} data-strip-start={i === 0 ? 'true' : undefined}
                        className={`rounded-lg border px-2 py-1 text-xs ${i === 0
                          ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-100' : 'border-white/15 bg-white/5 text-slate-300'}`}>
                        {day}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Calendar Grid */}
            {currentChallenge.type !== 'day_offset' && (
            <div className="mb-6" data-testid="calendar-grid">
              {/* The help lever `time_arrow`: which way the days go, drawn over the grid and on no date. */}
              {arrowOn && (
                <div data-lever="time-arrow" className="mx-auto mb-2 flex max-w-md items-center justify-center gap-2 text-sm text-cyan-200">
                  <span aria-hidden="true">→ → →</span>
                  <span>days go this way, then on to the next row</span>
                  <span aria-hidden="true">↵</span>
                </div>
              )}
              <div ref={pip.ref('grid')} data-pip-object="grid"
                className={`grid ${rowsOn ? 'grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]' : 'grid-cols-7'} gap-1 max-w-md mx-auto`}>
                {/* Day headers — orientation scaffold, withdrawn at hard */}
                {showDayHeaders && rowsOn && <div aria-hidden="true" />}
                {showDayHeaders && DAY_HEADERS.map((day) => (
                  <div
                    key={day}
                    data-testid="day-header"
                    className="text-center text-xs font-mono text-slate-500 py-1"
                  >
                    {day}
                  </div>
                ))}

                {/* Calendar cells; with the `row_ranges` lever each week row starts with its first and last date. */}
                {calendarGrid.map((day, idx) => {
                  const range = rowsOn && idx % 7 === 0 ? ranges.find(([first]) => {
                    const row = calendarGrid.slice(idx, idx + 7).filter((d): d is number => d !== null);
                    return row.includes(first);
                  }) : undefined;
                  const label = rowsOn && idx % 7 === 0 ? (
                    <div key={`row-${idx}`} data-lever={range ? 'row-range' : undefined}
                      className="flex h-10 items-center justify-end pr-1 text-[10px] font-mono text-cyan-300/80">
                      {range ? `${range[0]}–${range[1]}` : ''}
                    </div>
                  ) : null;
                  if (day === null) {
                    return <React.Fragment key={`blank-${idx}`}>{label}<div className="h-10" /></React.Fragment>;
                  }

                  const isHighlighted = highlightedDates.has(day);
                  const isClicked = clickedDate === day;
                  const isSelected = answerFromGrid && selectedAnswer === String(day);
                  const isMarked = currentChallenge.markedDates?.includes(day) ?? false;
                  const isRinged = ringed.has(day);
                  const isTicked = ticksOn && ticked.has(day);

                  // Day-of-week tinting: count's target day (the purple pre-marking does the
                  // finding for the student, so it is withdrawn at hard and put back by the
                  // `weekday_tint` lever), or the asked weekday on a date question (that lever).
                  const dayOfWeek = getDayOfWeek(day, currentChallenge.month, currentChallenge.year);
                  const isTargetDay = !!tintDay && dayOfWeek === tintDay;

                  const isWeekend = new Date(currentChallenge.year, currentChallenge.month - 1, day).getDay() % 6 === 0;

                  // The today marker is a STIMULUS, not feedback: it is on screen before
                  // the child answers, and it survives selection and highlighting, so it
                  // rides as an extra ring rather than a rung of the colour ladder.
                  const isToday = currentChallenge.todayDate === day;
                  const pipId = isToday ? 'today' : `date-${day}`;

                  return (
                    <React.Fragment key={day}>
                    {label}
                    <button
                      ref={pip.ref(pipId)}
                      data-pip-object={pipId}
                      onClick={() => { pip.look(pipId); handleDateClick(day); }}
                      data-testid={`date-${day}`}
                      data-target-day={isTargetDay ? 'true' : undefined}
                      data-today={isToday ? 'true' : undefined}
                      data-marked={isMarked ? 'true' : undefined}
                      data-lever={isRinged ? 'ring' : undefined}
                      className={`
                        relative h-10 rounded-lg text-sm font-mono transition-all duration-150
                        ${isToday ? 'ring-2 ring-amber-400/80 font-bold' : ''}
                        ${isRinged ? 'ring-2 ring-cyan-300/80' : ''}
                        ${isHighlighted
                          ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                          : isSelected
                            ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50 ring-2 ring-blue-400/30'
                            : isClicked
                              ? 'bg-white/15 text-white border border-white/30'
                              : isTargetDay
                                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20'
                                : isMarked
                                  ? 'bg-amber-500/20 text-amber-200 border border-amber-400/50 ring-1 ring-amber-400/30'
                                : isWeekend
                                  ? 'bg-white/3 text-slate-500 border border-white/5 hover:bg-white/10'
                                  : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white'
                        }
                      `}
                    >
                      {day}
                      {/* Wordless, so the marker reads for a pre-reader. */}
                      {isToday && (
                        <span
                          aria-label="today"
                          className="absolute -top-1 -right-1 text-[10px] leading-none"
                        >
                          ⭐
                        </span>
                      )}
                      {isMarked && !isToday && (
                        <span
                          aria-label="marked event"
                          className="absolute -top-1 -right-1 text-[10px] leading-none"
                        >
                          📌
                        </span>
                      )}
                      {currentChallenge.type === 'mark_events' && isSelected && (
                        <span
                          aria-label={`${currentChallenge.eventLabel ?? 'event'} marker placed`}
                          className="absolute -top-1 -right-1 text-[10px] leading-none"
                        >
                          📍
                        </span>
                      )}
                      {/* The `tick_taps` lever: the learner's own tick, never one placed by the activity. */}
                      {isTicked && (
                        <span data-lever="tick" aria-label="ticked"
                          className="absolute -bottom-1 -left-1 text-[10px] leading-none text-emerald-300">
                          ✓
                        </span>
                      )}
                    </button>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Legend — only when a day is marked. The star is the child's anchor for
                  today / yesterday / tomorrow, so it is named once, above the grid's
                  own answer surface, and never prints the date itself. */}
              {currentChallenge.todayDate !== undefined && (
                <p
                  data-testid="today-legend"
                  className="text-xs text-amber-300/80 text-center mt-2"
                >
                  ⭐ = today
                </p>
              )}
              {currentChallenge.type === 'interval_count' && (
                <p className="mt-2 text-center text-xs text-amber-300/80">
                  📌 = marked date
                </p>
              )}
            </div>
            )}

            {/* Answer Options — every challenge that is NOT answered by clicking a
                date in the grid (count, pattern, and day-name identify). */}
            {/* Pip's dock sits between the calendar (the cue) and the option
                buttons (the answers), so a pointer to the star never crosses one. */}
            {pipStore && <div ref={pip.dock} data-pip-dock={resolvedInstanceId}
              className="mx-auto mb-4 flex min-h-28 w-full max-w-xl items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />}

            {showOptionButtons && (
              <div className="mb-4">
                <p className="text-xs text-slate-500 mb-2">Choose your answer:</p>
                <div className="flex flex-wrap gap-2">
                  {currentChallenge.options.map((option, optionIndex) => (
                    <Button
                      key={option}
                      ref={pip.ref(`option-${optionIndex}`)}
                      data-pip-object={`option-${optionIndex}`}
                      variant="ghost"
                      data-testid={`option-${option}`}
                      onClick={() => { pip.look(`option-${optionIndex}`); handleOptionSelect(option); }}
                      className={`
                        border transition-all
                        ${selectedAnswer === option
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                          : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                        }
                      `}
                      disabled={!!feedback}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* For grid-answer modes — show the selected date / placed marker. */}
            {answerFromGrid && selectedAnswer && !feedback && (
              <div className="mb-4 text-sm text-slate-300">
                {currentChallenge.type === 'mark_events' ? 'Marker placed on: ' : 'Selected: '}
                <span className="text-blue-300 font-medium">{selectedAnswer}</span>
              </div>
            )}

            {/* Feedback */}
            {feedback && (
              <div className={`mb-4 p-3 rounded-lg border ${
                feedback.correct
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                {feedback.message}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {!hasAnsweredCurrent && (
                <>
                  <Button
                    variant="ghost"
                    onClick={handleCheckAnswer}
                    disabled={!canCheckAnswer}
                    aria-label="Check Answer"
                    className="bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 text-blue-300 disabled:opacity-40"
                  >
                    Check Answer
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setShowHint(true)}
                    className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400"
                    disabled={showHint}
                  >
                    Hint
                  </Button>
                </>
              )}
            </div>

            {/* Hint */}
            {showHint && currentChallenge.hint && (
              <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
                {currentChallenge.hint}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

/** Spoken mode is isolated from the calendar grid so each response channel has
 * one honest lifecycle: the tutor owns progression here; taps own it above. */
const CalendarSequenceSurface = ({ data, runtimePlanItemId }: CalendarExplorerProps) => {
  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const items = useMemo(
    () => calendarSequenceItemsFromChallenges(data.challenges ?? []),
    [data.challenges],
  );
  const dayOnly = items.length > 0 && items.every((item) => item.type === 'day_sequence');
  const monthOnly = items.length > 0 && items.every((item) => item.type === 'month_sequence');
  const unit = monthOnly ? 'month' : dayOnly ? 'day' : 'calendar item';
  const resolvedInstanceId = data.instanceId || 'calendar-sequence-standalone';
  const evaluation = usePrimitiveEvaluation<CalendarExplorerMetrics>({
    primitiveType: 'calendar-explorer',
    instanceId: resolvedInstanceId,
    skillId: data.skillId,
    subskillId: data.subskillId,
    objectiveId: data.objectiveId,
    exhibitId: data.exhibitId,
    componentIntent: data.componentIntent,
    objectiveText: data.objectiveText,
    onSubmit: data.onEvaluationSubmit,
  });

  const finish = (summary: TeachingEvaluationResult) => {
    const metrics: CalendarExplorerMetrics = {
      type: 'calendar-explorer',
      questionsCorrect: summary.solvedCount,
      questionsTotal: summary.outcomes.length,
      accuracy: summary.accuracy,
      attemptsCount: summary.attemptsCount,
    };
    evaluation.submitResult(summary.passed, summary.accuracy, metrics, { learningResponses: summary.learningResponses,
      ...(summary.teachingAttempts ? { teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance } : {}) },
      undefined, summary.diagnosisEvidence);
  };

  const runner = useWorkspaceRunner<CalendarSequenceItem>({
    primitiveId: 'calendar-explorer',
    assignment: calendarSequenceAssignment,
    items,
    workspace,
    objectiveId: data.objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    instanceId: resolvedInstanceId,
    onFinished: finish,
  });
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;

  // The `model_pair` lever (`calendarExplorerLevers.ts`), keyed by the turn it was pulled on.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const turn = runner.currentItem;
  const pulledLevers = turn && leverState.item === turn.id ? leverState.pulled : [];
  const pair = turn && pulledLevers.includes(MODEL_PAIR_LEVER) ? modelPair(turn, items) : null;

  // What the tutor and the observer are shown, republished every render, with the turn's lever.
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!turn) return;
    const scene = calendarSequenceScene(turn);
    const levers = calendarSequenceLevers(turn, items, pulledLevers);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(pair ? { onScreen: modelPairFact(turn, pair) } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this turn.`;
        if (lever.pulled) return `${id} is already on screen.`;
        setLeverState({ item: turn.id, pulled: [...pulledLevers, id] });
        return true as const;
      },
    };
  });

  /** Asks the tutor for the question again: a silent host request, never the answer. */
  const hearQuestion = useCallback(() => {
    if (!runner.currentItem) return;
    ctx.sendText(hearSequenceRequest(runner.currentItem), { silent: true, author: 'host' });
  }, [ctx, runner.currentItem]);

  // ── Pip shared surface ──────────────────────────────────────────
  // A projection of the runner's phase onto the listen card; Pip never says,
  // judges, or advances anything.
  const sequenceItem = runner.currentItem;
  const pip = usePipTargets(sequenceItem?.id ?? null, false);
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !sequenceItem || showSummary) return null;
    const targets = pip.targets(['stimulus'], () => 'The listen card');
    const pose = calendarSequencePipPose({
      running: runner.running, preparing: false,
      currentSolved: runner.currentSolved, revealHeld: runner.revealHeld,
      judging: false, tutorSpeaking: runner.tutorSpeaking,
      cueMatchesItem: runner.cuedItemId === sequenceItem.id,
      visibleIds: targets.map((target) => target.id),
    });
    return {
      instanceId: resolvedInstanceId, scopeId: sequenceItem.id, label: 'Calendar chain',
      dock: pip.dock.current, targets, pose,
    };
  });

  const phaseResults = useMemo(
    () => phaseResultsFromSummary(items, runner.practiceSummary ?? null, (item) => ({
      label: `${item.type === 'day_sequence' ? 'Day' : 'Month'} turn ${item.chainPosition}`,
      icon: item.type === 'day_sequence' ? '📅' : '🗓️',
      accentColor: 'cyan',
    })),
    [items, runner.practiceSummary],
  );

  if (items.length === 0) {
    return (
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="p-8 text-center text-slate-400">
          No spoken day chain is available.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid={monthOnly ? 'calendar-month-sequence' : 'calendar-day-sequence'}>
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-light text-slate-100">{data.title}</CardTitle>
              <p className="text-sm text-slate-400 mt-1">
                Listen, then say the {unit} that comes next. Keep the chain going!
              </p>
            </div>
            <Badge className="bg-cyan-500/10 border border-cyan-400/30 text-cyan-200 text-xs">
              Say it out loud
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          {!showSummary && (
            <>
              <div className="flex justify-center">
                <Badge className="bg-white/5 border border-white/20 text-slate-300 text-xs">
                  {Math.min(runner.currentIndex + 1, items.length)} / {items.length}
                </Badge>
              </div>

              {/* Intentionally no printed sequence names or strip. The tutor's
                  voice is the stimulus and the child's voice is the answer. */}
              <div ref={pip.ref('stimulus')} data-pip-object="stimulus"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-10 text-center">
                <div className="text-6xl" aria-hidden="true">📅</div>
                <p className="mt-4 text-sm uppercase tracking-[0.3em] text-slate-500">
                  listen · think · say
                </p>
              </div>

              {/* The help lever `model_pair`: two OTHER names in order, never this turn's or a turn still ahead. */}
              {pair && (
                <div data-lever="model-pair" aria-label="Model pair"
                  className="mx-auto flex w-fit items-center gap-3 rounded-2xl border border-cyan-300/30 bg-cyan-950/20 px-4 py-3 text-lg text-cyan-100">
                  <span><span aria-hidden="true">📅 </span>{pair[0]}</span>
                  <span aria-hidden="true" className="text-cyan-300">→</span>
                  <span><span aria-hidden="true">📅 </span>{pair[1]}</span>
                </div>
              )}

              {pipStore && <div ref={pip.dock} data-pip-dock={resolvedInstanceId}
                className="mx-auto flex min-h-28 w-full max-w-xl items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />}

              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  onClick={hearQuestion}
                  aria-label="Hear the question again"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300 text-xs"
                >
                  🔊 Hear the question again
                </Button>
              </div>
            </>
          )}

          {showSummary && (
            <PhaseSummaryPanel
              phases={phaseResults}
              overallScore={evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy ?? 0}
              durationMs={evaluation.elapsedMs}
              heading={`${monthOnly ? 'Month' : dayOnly ? 'Day' : 'Calendar'} Chain Complete!`}
              celebrationMessage={`You kept the ${monthOnly ? 'months' : dayOnly ? 'days' : 'calendar sequences'} moving in order with your voice!`}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const CalendarGridExplorer = withWorkspaceOnly<CalendarExplorerProps>('calendar-explorer', CalendarGridSurface, props => props.data.title);
const CalendarSequenceExplorer = withWorkspaceOnly<CalendarExplorerProps>('calendar-explorer', CalendarSequenceSurface, props => props.data.title);


export const CalendarExplorer: React.FC<CalendarExplorerProps> = (props) =>
  isSpokenCalendarSession(props.data.challenges)
    ? <CalendarSequenceExplorer {...props} />
    : <CalendarGridExplorer {...props} />;

export default CalendarExplorer;
