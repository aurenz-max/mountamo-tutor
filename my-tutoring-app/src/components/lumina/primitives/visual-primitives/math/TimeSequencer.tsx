'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaPanel,
  LuminaActionButton,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { TimeSequencerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface EventCard {
  id: string;
  label: string;
  emoji: string;
  typicalTime?: string;
  /**
   * Position through the day, 0 (midnight) to 1 (the next midnight), derived in the
   * generator from `typicalTime`. It is the PRE-READER form of the same information:
   * the card draws a sun on a dawn-to-night strip at this fraction instead of printing
   * "8:30 AM", which a Kindergarten student cannot read.
   */
  dayFraction?: number;
  /**
   * Whole-hour position on a 12-hour dial, 0-11, derived in the generator from
   * `typicalTime`. `clock-sequence` draws an analog FACE at this hour on the
   * card. It is a PICTURE, not a printed time: a pre-reader who cannot read
   * "8:00" can still see where the short hand points, and connecting that
   * position to an activity is the K objective (TIME001-03-G, skill "Telling
   * Time to the Hour"). Only whole hours ever reach it — the generator drops a
   * challenge whose events are not all on the hour.
   */
  clockHour?: number;
}

export interface ScheduleEntry {
  time: string;
  activity: string;
  emoji: string;
}

export interface TimeSequencerChallenge {
  id: string;
  type: 'sequence-events' | 'clock-sequence' | 'match-time-of-day' | 'before-after' | 'duration-compare' | 'read-schedule';
  instruction: string;

  // sequence-events
  events?: EventCard[];
  correctOrder?: string[];

  // match-time-of-day
  event?: EventCard;
  correctPeriod?: 'morning' | 'afternoon' | 'evening' | 'night';

  // before-after
  referenceEvent?: EventCard;
  relation?: 'before' | 'after';
  options?: EventCard[];
  correctEvent?: string;

  // duration-compare
  eventA?: EventCard;
  eventB?: EventCard;
  correctAnswer?: 'A' | 'B' | 'same';

  // read-schedule
  schedule?: ScheduleEntry[];
  targetTime?: string;
  correctActivity?: string;
  activityOptions?: string[];

  hint?: string;

  // ── Within-mode support tier (scaffolding only; never changes events/times/answer) ──
  /** #1 perception: show per-event elapsed-time (typicalTime) anchors. easy = on, hard = off.
   *  Kindergarten never sets this — reading a clock is not a scaffold at that band. */
  showTimeAnchors?: boolean;
  /** #1 perception, Kindergarten form: show the sun-position strip built from `dayFraction`. */
  showSkyCue?: boolean;
  /** clock-sequence: draw the analog face on every card. Structural, NOT a
   *  scaffold — the face IS the task, so no support tier withdraws it. */
  showClockFace?: boolean;
  /** #1 answer-leak-guarded: pre-seed ONLY the first ordered slot as a start-here anchor. */
  prelabelFirstSlot?: boolean;
  /** #2 instruction-as-scaffold: surface the named ordering/time-reasoning strategy. */
  showStrategyHint?: boolean;
  /** The strategy text to surface when showStrategyHint is true. */
  strategyHint?: string;
}

export interface TimeSequencerData {
  title: string;
  description?: string;
  challenges: TimeSequencerChallenge[];
  gradeBand?: 'K' | '1' | '2';
  /** Within-mode support tier ('easy' | 'medium' | 'hard') — calibrates the AI tutor reveal level. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<TimeSequencerMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'sequence-events': { label: 'Sequence', icon: '📋', accentColor: 'purple' },
  'clock-sequence': { label: 'Clock Order', icon: '🕐', accentColor: 'purple' },
  'match-time-of-day': { label: 'Time of Day', icon: '🌅', accentColor: 'orange' },
  'before-after': { label: 'Before/After', icon: '⏪', accentColor: 'blue' },
  'duration-compare': { label: 'Duration', icon: '⏱️', accentColor: 'emerald' },
  'read-schedule': { label: 'Schedule', icon: '📅', accentColor: 'cyan' },
};

const PERIOD_DISPLAY: Record<string, { label: string; emoji: string; color: string }> = {
  morning: { label: 'Morning', emoji: '🌅', color: 'bg-amber-500/20 border-amber-400/50 text-amber-300' },
  afternoon: { label: 'Afternoon', emoji: '☀️', color: 'bg-yellow-500/20 border-yellow-400/50 text-yellow-300' },
  evening: { label: 'Evening', emoji: '🌇', color: 'bg-orange-500/20 border-orange-400/50 text-orange-300' },
  night: { label: 'Night', emoji: '🌙', color: 'bg-indigo-500/20 border-indigo-400/50 text-indigo-300' },
};

// ============================================================================
// Tutor reveal policy — calibrate AI reveal to the support tier (mode-aware)
// ============================================================================

/**
 * The support tier withdraws on-screen anchors (elapsed-time cues, the start-here
 * slot) and the named strategy at harder tiers — so the tutor must not hand back
 * what the tier hid. At 'hard' the tutor must NOT name the order or the elapsed
 * time; it asks what the student thinks happens first and never reveals the sequence.
 */
function tutorRevealPolicy(tier: 'easy' | 'medium' | 'hard' | undefined, isPreReader = false): string {
  if (!tier) return '';
  const common = 'Never state the correct order, the answer, or which option is right.';
  switch (tier) {
    case 'easy':
      // At Kindergarten the on-screen anchor is a sun picture, not a clock time, so the
      // strategy the tutor is allowed to name has to be the picture one. Naming the
      // clock strategy here would hand a pre-reader back the exact demand the band
      // removed from the screen.
      return isPreReader
        ? `SUPPORT TIER easy (Kindergarten): maximum scaffolding. You may point to the sky picture on each card — the sun comes up, climbs, goes down, then it is dark. NEVER mention a clock, a time, or a number: this student cannot read one. ${common}`
        : `SUPPORT TIER easy: maximum scaffolding. You may name the ordering strategy (read the time on each card, go earliest to latest) and point to the time anchors on screen. ${common}`;
    case 'medium':
      return `SUPPORT TIER medium: the on-screen anchors are withdrawn. Nudge the reasoning — ask what the student does first in their day — but do not name the full strategy${isPreReader ? '' : ' or the elapsed times'}. ${common}`;
    default:
      return `SUPPORT TIER hard: minimal coaching. The on-screen instruction does NOT name a strategy and there are no anchors — reasoning out the order is the task. Do NOT name the order or the elapsed time; ask the student what they think happens first and let them judge it. ${common}`;
  }
}

// ============================================================================
// Sun-position strip — the pre-reader's time anchor
// ============================================================================

/** Sky colour at a point in the day, midnight through midnight. The stops are the
 *  ordinary shape of a day — dark, dawn amber, midday blue, dusk orange, dark — so the
 *  strip reads as a sky without a single word on it. */
const SKY_STOPS: readonly [number, [number, number, number]][] = [
  [0.00, [30, 27, 75]],
  [0.22, [49, 46, 129]],
  [0.30, [245, 158, 11]],
  [0.50, [125, 211, 252]],
  [0.76, [251, 146, 60]],
  [0.86, [49, 46, 129]],
  [1.00, [30, 27, 75]],
];

function skyColorAt(f: number): string {
  const x = Math.min(1, Math.max(0, f));
  let lo = SKY_STOPS[0];
  let hi = SKY_STOPS[SKY_STOPS.length - 1];
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    if (x >= SKY_STOPS[i][0] && x <= SKY_STOPS[i + 1][0]) {
      lo = SKY_STOPS[i];
      hi = SKY_STOPS[i + 1];
      break;
    }
  }
  const span = hi[0] - lo[0];
  const t = span === 0 ? 0 : (x - lo[0]) / span;
  const [r, g, b] = lo[1].map((c, i) => Math.round(c + (hi[1][i] - c) * t));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * The window one challenge's strips are drawn over, from the day fractions of its own
 * events.
 *
 * A full-day strip is unusable when a challenge's three events sit inside one morning:
 * 7:00, 8:00 and 9:00 land 4% apart, which on a 140px strip is about five pixels and
 * no five-year-old can order that. Zooming to the challenge's own span — padded, and
 * never narrower than a couple of hours — puts those same three cards a third of the
 * strip apart while the gradient still says "this is morning", so the picture stays
 * true and becomes readable.
 */
function skyWindowFor(fractions: (number | undefined)[]): [number, number] {
  const valid = fractions.filter((f): f is number => typeof f === 'number');
  if (valid.length === 0) return [0, 1];
  const lo = Math.min(...valid);
  const hi = Math.max(...valid);
  const pad = Math.max(0.03, (hi - lo) * 0.35);
  return [Math.max(0, lo - pad), Math.min(1, hi + pad)];
}

/**
 * The sun (or moon) drawn on a slice of sky at the event's own time — the pre-reader's
 * replacement for the printed clock time.
 *
 * It is a POSITION, not one of four sky emojis, on purpose: three events inside one
 * morning would all be the same sunrise picture and the child could not order them.
 * The marker slides monotonically with the time, so two events that differ in time
 * differ on screen.
 */
/**
 * A small analog face at a whole hour — the PICTURE form of a clock time.
 *
 * The hour hand is the load-bearing mark and is drawn short and thick; the
 * minute hand points straight up because every hour this mode uses is on the
 * hour. Twelve tick marks give the hand something to point AT, and the 12/3/6/9
 * numerals are the only text on the card — single or double digits a pre-reader
 * matches by shape, which is the same demand analog-clock's K modes already
 * make (hand_name, count_face, hear_time).
 */
// 44px, not the 34 the first draft used: at 34 the hour hand was legible to an
// adult reading a desktop screenshot and marginal for the five-year-old who has
// to tell 7 o'clock from 9 o'clock, and telling them apart IS the task here.
const ClockFace: React.FC<{ hour: number; size?: number }> = ({ hour, size = 44 }) => {
  const r = size / 2;
  const h12 = ((hour % 12) + 12) % 12;
  const hourAngle = (h12 / 12) * 2 * Math.PI;
  const hx = r + Math.sin(hourAngle) * r * 0.46;
  const hy = r - Math.cos(hourAngle) * r * 0.46;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="flex-shrink-0">
      <circle cx={r} cy={r} r={r - 1} fill="rgb(248 250 252)" stroke="rgb(100 116 139)" strokeWidth="1.5" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * 2 * Math.PI;
        const inner = r * 0.76;
        return (
          <line
            key={i}
            x1={r + Math.sin(a) * inner} y1={r - Math.cos(a) * inner}
            x2={r + Math.sin(a) * (r * 0.9)} y2={r - Math.cos(a) * (r * 0.9)}
            stroke="rgb(148 163 184)" strokeWidth={i % 3 === 0 ? 1.4 : 0.7}
          />
        );
      })}
      {/* Minute hand — straight up on every whole hour. */}
      <line x1={r} y1={r} x2={r} y2={r - r * 0.72} stroke="rgb(71 85 105)" strokeWidth="1.4" strokeLinecap="round" />
      {/* Hour hand — short and thick, the mark the child reads. */}
      <line x1={r} y1={r} x2={hx} y2={hy} stroke="rgb(15 23 42)" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx={r} cy={r} r="1.8" fill="rgb(15 23 42)" />
    </svg>
  );
};

const SkyStrip: React.FC<{ fraction: number; window?: [number, number] }> = ({ fraction, window }) => {
  const clamped = Math.min(1, Math.max(0, fraction));
  const [start, end] = window ?? [0, 1];
  const span = Math.max(0.02, end - start);
  const offset = Math.min(1, Math.max(0, (clamped - start) / span));
  const glyph = clamped < 0.25 || clamped >= 0.84
    ? '🌙'
    : clamped < 0.46
      ? '🌅'
      : clamped < 0.68
        ? '☀️'
        : '🌇';
  const gradient = [0, 0.25, 0.5, 0.75, 1]
    .map((t) => `${skyColorAt(start + span * t)} ${Math.round(t * 100)}%`)
    .join(', ');
  return (
    <div
      aria-hidden
      className="relative mt-1 h-3.5 w-full max-w-[150px] rounded-full overflow-hidden border border-white/10"
      style={{ background: `linear-gradient(90deg, ${gradient})` }}
    >
      <span
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-[12px] leading-none"
        style={{ left: `${6 + offset * 88}%` }}
      >
        {glyph}
      </span>
    </div>
  );
};

// ============================================================================
// Event Card Visual Component
// ============================================================================

interface EventCardVisualProps {
  event: EventCard;
  index?: number;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  showTime?: boolean;
  /** Kindergarten form of `showTime`: the sun-position strip instead of the digits. */
  showSky?: boolean;
  /** clock-sequence: the analog face at `event.clockHour`, drawn beside the emoji. */
  showClock?: boolean;
  /** The challenge-local day window the sky strips share, so the cards are comparable. */
  skyWindow?: [number, number];
  className?: string;
}

const EventCardVisual: React.FC<EventCardVisualProps> = ({
  event, index, selected, onClick, disabled, showTime, showSky, showClock, skyWindow, className = '',
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`
      flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all w-full text-left
      ${selected
        ? 'border-emerald-400 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
        : 'border-white/10 bg-slate-800/30 hover:border-white/20 hover:bg-slate-800/50'}
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      ${className}
    `}
  >
    {index !== undefined && (
      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-700/50 border border-white/10 flex items-center justify-center text-xs font-bold text-slate-300">
        {index + 1}
      </span>
    )}
    <span className="text-2xl flex-shrink-0">{event.emoji}</span>
    {/* The face sits BESIDE the activity picture, not under the label: on
        clock-sequence the pairing of the two is the thing being learned. */}
    {showClock && event.clockHour !== undefined && <ClockFace hour={event.clockHour} />}
    <div className="flex-1 min-w-0">
      <span className="text-slate-200 text-sm font-medium block truncate">{event.label}</span>
      {showTime && event.typicalTime && (
        <span className="text-slate-500 text-xs">{event.typicalTime}</span>
      )}
      {showSky && event.dayFraction !== undefined && (
        <SkyStrip fraction={event.dayFraction} window={skyWindow} />
      )}
    </div>
  </button>
);

// ============================================================================
// Props
// ============================================================================

interface TimeSequencerProps {
  data: TimeSequencerData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const TimeSequencer: React.FC<TimeSequencerProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    gradeBand = 'K',
    supportTier,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── Challenge Progress ─────────────────────────────────────────────
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
  });

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  // ── State ──────────────────────────────────────────────────────────
  const currentChallenge = challenges[currentChallengeIndex] ?? null;

  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');

  // sequence-events: ordered list built by tapping events
  const [orderedEvents, setOrderedEvents] = useState<string[]>([]);

  // match-time-of-day
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);

  // before-after
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  // duration-compare
  const [durationAnswer, setDurationAnswer] = useState<'A' | 'B' | 'same' | null>(null);

  // read-schedule
  const [scheduleAnswer, setScheduleAnswer] = useState<string | null>(null);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `time-sequencer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Evaluation Hook ────────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<TimeSequencerMetrics>({
    primitiveType: 'time-sequencer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── AI Tutoring ────────────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    gradeBand,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    challengeType: currentChallenge?.type ?? 'sequence-events',
    instruction: currentChallenge?.instruction ?? '',
    attemptNumber: currentAttempts + 1,
    supportTier: supportTier ?? null,
  }), [gradeBand, challenges.length, currentChallengeIndex, currentChallenge, currentAttempts, supportTier]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'time-sequencer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : `Grade ${gradeBand}`,
  });

  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    const revealPolicy = tutorRevealPolicy(supportTier, gradeBand === 'K');
    sendText(
      `[ACTIVITY_START] Time Sequencer for ${gradeBand === 'K' ? 'Kindergarten' : `Grade ${gradeBand}`}. `
      + `${challenges.length} challenges. First: "${currentChallenge?.instruction}" (type: ${currentChallenge?.type}). `
      + `Introduce warmly: "Let's think about time and the order of our day!" Then read the first instruction.`
      + (revealPolicy ? ` ${revealPolicy}` : ''),
      { silent: true },
    );
  }, [isConnected, challenges.length, gradeBand, currentChallenge, supportTier, sendText]);

  // ── Reset ──────────────────────────────────────────────────────────
  const resetDomainState = useCallback(() => {
    setOrderedEvents([]);
    setSelectedPeriod(null);
    setSelectedEvent(null);
    setDurationAnswer(null);
    setScheduleAnswer(null);
    setFeedback('');
    setFeedbackType('');
  }, []);

  // ── Pre-seed the first ordered slot (easy/medium "start here" anchor) ──
  // ANSWER-LEAK GUARD: seeds ONLY the first event — never the full order. The
  // remaining slots stay blank for the student; the checker reads correctOrder.
  useEffect(() => {
    if (
      (currentChallenge?.type === 'sequence-events' || currentChallenge?.type === 'clock-sequence')
      && currentChallenge.prelabelFirstSlot
      && (currentChallenge.correctOrder?.length ?? 0) > 1
    ) {
      const firstId = currentChallenge.correctOrder![0];
      setOrderedEvents((prev) => (prev.length === 0 ? [firstId] : prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge?.id]);

  // ── Check Handlers ─────────────────────────────────────────────────

  const handleCheckSequence = useCallback(() => {
    if (!currentChallenge) return false;
    incrementAttempts();
    const correct = JSON.stringify(orderedEvents) === JSON.stringify(currentChallenge.correctOrder);

    if (correct) {
      setFeedback('Perfect order! You know the sequence!');
      setFeedbackType('success');
      sendText(`[ANSWER_CORRECT] Student sequenced events correctly. Congratulate briefly.`, { silent: true });
    } else {
      // Count how many are in the right position
      const correctCount = orderedEvents.filter((id, i) => currentChallenge.correctOrder?.[i] === id).length;
      // "2 out of 3 are in the right spot" is a sentence a five-year-old has to read and
      // then do arithmetic on. The tutor still receives the count below; the child gets
      // the plain retry.
      setFeedback(
        gradeBand === 'K'
          ? 'Not quite — try again!'
          : `Not quite — ${correctCount} out of ${orderedEvents.length} are in the right spot. Try again!`,
      );
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student's order: ${orderedEvents.join(', ')}. Correct: ${currentChallenge.correctOrder?.join(', ')}. `
        + `${correctCount}/${orderedEvents.length} correct positions. Give a hint: "Think about your day. What do you do first when you wake up?"`,
        { silent: true },
      );
    }
    return correct;
  }, [currentChallenge, orderedEvents, incrementAttempts, sendText]);

  const handleCheckTimeOfDay = useCallback(() => {
    if (!currentChallenge || !selectedPeriod) return false;
    incrementAttempts();
    const correct = selectedPeriod === currentChallenge.correctPeriod;

    if (correct) {
      setFeedback(`Yes! "${currentChallenge.event?.label}" happens in the ${currentChallenge.correctPeriod}!`);
      setFeedbackType('success');
      sendText(`[ANSWER_CORRECT] Student matched "${currentChallenge.event?.label}" to ${currentChallenge.correctPeriod}. Congratulate!`, { silent: true });
    } else {
      setFeedback(`"${currentChallenge.event?.label}" doesn't usually happen in the ${selectedPeriod}. Think about when you do this!`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student chose "${selectedPeriod}" but "${currentChallenge.event?.label}" happens in the ${currentChallenge.correctPeriod}. `
        + `Hint: "Think about when you ${currentChallenge.event?.label.toLowerCase()}. Is it light or dark outside?"`,
        { silent: true },
      );
    }
    return correct;
  }, [currentChallenge, selectedPeriod, incrementAttempts, sendText]);

  const handleCheckBeforeAfter = useCallback(() => {
    if (!currentChallenge || !selectedEvent) return false;
    incrementAttempts();
    const correct = selectedEvent === currentChallenge.correctEvent;

    if (correct) {
      const rel = currentChallenge.relation;
      setFeedback(`Correct! That happens ${rel} ${currentChallenge.referenceEvent?.label}!`);
      setFeedbackType('success');
      sendText(`[ANSWER_CORRECT] Student correctly identified what happens ${rel} "${currentChallenge.referenceEvent?.label}".`, { silent: true });
    } else {
      setFeedback(`Not quite. Think about what happens ${currentChallenge.relation} ${currentChallenge.referenceEvent?.label}.`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student chose wrong event for "what happens ${currentChallenge.relation} ${currentChallenge.referenceEvent?.label}". `
        + `Correct: ${currentChallenge.correctEvent}. Give a hint connecting to the student's daily routine.`,
        { silent: true },
      );
    }
    return correct;
  }, [currentChallenge, selectedEvent, incrementAttempts, sendText]);

  const handleCheckDuration = useCallback(() => {
    if (!currentChallenge || !durationAnswer) return false;
    incrementAttempts();
    const correct = durationAnswer === currentChallenge.correctAnswer;

    const aLabel = currentChallenge.eventA?.label ?? 'A';
    const bLabel = currentChallenge.eventB?.label ?? 'B';

    if (correct) {
      const explanation = currentChallenge.correctAnswer === 'same'
        ? 'They take about the same time!'
        : `${currentChallenge.correctAnswer === 'A' ? aLabel : bLabel} takes longer!`;
      setFeedback(`Correct! ${explanation}`);
      setFeedbackType('success');
      sendText(`[ANSWER_CORRECT] Student correctly compared durations. ${explanation}`, { silent: true });
    } else {
      setFeedback(`Think about how long each activity takes. Which one would take more time?`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student said "${durationAnswer}" but correct is "${currentChallenge.correctAnswer}". `
        + `${aLabel} vs ${bLabel}. Hint: "Think about how long you spend doing each activity."`,
        { silent: true },
      );
    }
    return correct;
  }, [currentChallenge, durationAnswer, incrementAttempts, sendText]);

  const handleCheckSchedule = useCallback(() => {
    if (!currentChallenge || !scheduleAnswer) return false;
    incrementAttempts();
    const correct = scheduleAnswer === currentChallenge.correctActivity;

    if (correct) {
      setFeedback(`Yes! At ${currentChallenge.targetTime}, it's "${currentChallenge.correctActivity}"!`);
      setFeedbackType('success');
      sendText(`[ANSWER_CORRECT] Student read the schedule correctly for ${currentChallenge.targetTime}.`, { silent: true });
    } else {
      setFeedback(`Look at the schedule again. Find ${currentChallenge.targetTime} and check what activity is listed.`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student chose "${scheduleAnswer}" but at ${currentChallenge.targetTime} it's "${currentChallenge.correctActivity}". `
        + `Hint: "Find ${currentChallenge.targetTime} on the schedule and read across."`,
        { silent: true },
      );
    }
    return correct;
  }, [currentChallenge, scheduleAnswer, incrementAttempts, sendText]);

  // ── Master Check ───────────────────────────────────────────────────
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;

    let correct = false;
    switch (currentChallenge.type) {
      // clock-sequence IS the ordering interaction — same gesture, same
      // `correctOrder` key. What differs is what each card carries.
      case 'sequence-events': case 'clock-sequence': correct = handleCheckSequence(); break;
      case 'match-time-of-day': correct = handleCheckTimeOfDay(); break;
      case 'before-after': correct = handleCheckBeforeAfter(); break;
      case 'duration-compare': correct = handleCheckDuration(); break;
      case 'read-schedule': correct = handleCheckSchedule(); break;
    }

    if (correct) {
      SoundManager.playCorrect();
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
    } else {
      SoundManager.playIncorrect();
    }
  }, [currentChallenge, currentAttempts, handleCheckSequence, handleCheckTimeOfDay, handleCheckBeforeAfter, handleCheckDuration, handleCheckSchedule, recordResult]);

  // ── Advance ────────────────────────────────────────────────────────
  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      const phaseScoreStr = phaseResults
        .map((p) => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = Math.round(
        (challengeResults.filter((r) => r.correct).length / challenges.length) * 100,
      );

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging feedback about their understanding of time and sequences!`,
        { silent: true },
      );

      if (!hasSubmittedEvaluation) {
        const correctCount = challengeResults.filter((r) => r.correct).length;
        const score = Math.round((correctCount / challenges.length) * 100);
        const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);

        const metrics: TimeSequencerMetrics = {
          type: 'time-sequencer',
          accuracy: score,
          totalAttempts,
          challengesCompleted: correctCount,
          challengesTotal: challenges.length,
        };

        submitEvaluation(
          correctCount === challenges.length,
          score,
          metrics,
          { challengeResults },
        );
      }
      return;
    }

    resetDomainState();
    const nextChallenge = challenges[currentChallengeIndex + 1];
    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
      + `"${nextChallenge.instruction}" (type: ${nextChallenge.type}). Read it to the student.`,
      { silent: true },
    );
  }, [
    advanceProgress, phaseResults, challengeResults, challenges, sendText,
    hasSubmittedEvaluation, submitEvaluation, resetDomainState, currentChallengeIndex,
  ]);

  // Auto-submit
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      advanceToNextChallenge();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, advanceToNextChallenge]);

  // ── Computed ───────────────────────────────────────────────────────
  const isCurrentChallengeCorrect = challengeResults.some(
    (r) => r.challengeId === currentChallenge?.id && r.correct,
  );

  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    return Math.round(
      (challengeResults.filter((r) => r.correct).length / challenges.length) * 100,
    );
  }, [allChallengesComplete, challenges, challengeResults]);

  // ── Sequence event toggling ────────────────────────────────────────
  const handleToggleSequenceEvent = useCallback((eventId: string) => {
    if (isCurrentChallengeCorrect) return;
    SoundManager.tap();
    setOrderedEvents((prev) => {
      if (prev.includes(eventId)) {
        return prev.filter((id) => id !== eventId);
      }
      return [...prev, eventId];
    });
  }, [isCurrentChallengeCorrect]);

  // ── Can check answer? ─────────────────────────────────────────────
  const canCheck = useMemo(() => {
    if (!currentChallenge) return false;
    switch (currentChallenge.type) {
      case 'sequence-events':
      case 'clock-sequence':
        return orderedEvents.length === (currentChallenge.events?.length ?? 0);
      case 'match-time-of-day':
        return !!selectedPeriod;
      case 'before-after':
        return !!selectedEvent;
      case 'duration-compare':
        return !!durationAnswer;
      case 'read-schedule':
        return !!scheduleAnswer;
      default:
        return false;
    }
  }, [currentChallenge, orderedEvents, selectedPeriod, selectedEvent, durationAnswer, scheduleAnswer]);

  // ── Stable shuffle for sequence events ────────────────────────────
  const shuffledEvents = useMemo(() => {
    const events = [...(currentChallenge?.events || [])];
    // Fisher-Yates shuffle seeded by challenge id length (stable per challenge)
    for (let i = events.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [events[i], events[j]] = [events[j], events[i]];
    }
    return events;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge?.id]);

  // ── Render Helpers ─────────────────────────────────────────────────

  const renderSequenceEvents = () => {
    if (!currentChallenge) return null;
    const events = shuffledEvents;
    // One window for every card in this challenge — a per-card window would put each
    // sun in the middle of its own strip and destroy the comparison.
    const skyWindow = skyWindowFor(events.map((e) => e.dayFraction));
    const unselected = events.filter((e) => !orderedEvents.includes(e.id));
    const selected = orderedEvents.map((id) => events.find((e) => e.id === id)!).filter(Boolean);

    return (
      <div className="space-y-4">
        {/* Selected order */}
        {selected.length > 0 && (
          <div className="space-y-2">
            <span className="text-slate-400 text-xs font-medium">Your order:</span>
            {selected.map((event, i) => (
              <EventCardVisual
                key={event.id}
                event={event}
                index={i}
                selected
                showTime={currentChallenge.showTimeAnchors}
                showSky={currentChallenge.showSkyCue}
                showClock={currentChallenge.showClockFace}
                skyWindow={skyWindow}
                onClick={() => handleToggleSequenceEvent(event.id)}
                disabled={isCurrentChallengeCorrect}
              />
            ))}
          </div>
        )}

        {/* Remaining events to pick */}
        {unselected.length > 0 && (
          <div className="space-y-2">
            <span className="text-slate-400 text-xs font-medium">
              {selected.length === 0 ? 'Tap events in order:' : 'Remaining:'}
            </span>
            {unselected.map((event) => (
              <EventCardVisual
                key={event.id}
                event={event}
                showTime={currentChallenge.showTimeAnchors}
                showSky={currentChallenge.showSkyCue}
                showClock={currentChallenge.showClockFace}
                skyWindow={skyWindow}
                onClick={() => handleToggleSequenceEvent(event.id)}
                disabled={isCurrentChallengeCorrect}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderMatchTimeOfDay = () => {
    if (!currentChallenge || !currentChallenge.event) return null;
    return (
      <div className="space-y-4">
        {/* No time anchor here — the clock time would reveal the period (the answer). */}
        <div className="flex justify-center">
          <EventCardVisual event={currentChallenge.event} disabled className="max-w-xs" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(PERIOD_DISPLAY).map(([period, display]) => (
            <button
              key={period}
              type="button"
              onClick={() => { if (!isCurrentChallengeCorrect) { SoundManager.select(); setSelectedPeriod(period); } }}
              disabled={isCurrentChallengeCorrect}
              className={`
                p-3 rounded-xl border-2 text-center transition-all
                ${selectedPeriod === period
                  ? display.color + ' shadow-lg'
                  : 'border-white/10 bg-slate-800/30 hover:border-white/20 text-slate-300'}
                ${isCurrentChallengeCorrect ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <span className="text-2xl block">{display.emoji}</span>
              <span className="text-sm font-medium">{display.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderBeforeAfter = () => {
    if (!currentChallenge) return null;
    const ref = currentChallenge.referenceEvent;
    const opts = currentChallenge.options || [];

    return (
      <div className="space-y-4">
        <div className="text-center">
          <span className="text-slate-400 text-xs block mb-1">
            What happens <span className="text-blue-300 font-bold">{currentChallenge.relation}</span>...
          </span>
          {ref && (
            <EventCardVisual
              event={ref}
              disabled
              showTime={currentChallenge.showTimeAnchors}
              showSky={currentChallenge.showSkyCue}
              className="max-w-xs mx-auto"
            />
          )}
        </div>
        <div className="space-y-2">
          {opts.map((event) => (
            <EventCardVisual
              key={event.id}
              event={event}
              selected={selectedEvent === event.id}
              onClick={() => { if (!isCurrentChallengeCorrect) { SoundManager.select(); setSelectedEvent(event.id); } }}
              disabled={isCurrentChallengeCorrect}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderDurationCompare = () => {
    if (!currentChallenge) return null;
    const { eventA, eventB } = currentChallenge;
    if (!eventA || !eventB) return null;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => { if (!isCurrentChallengeCorrect) { SoundManager.select(); setDurationAnswer('A'); } }}
            disabled={isCurrentChallengeCorrect}
            className={`p-3 rounded-xl border-2 transition-all ${
              durationAnswer === 'A'
                ? 'border-blue-400 bg-blue-500/10'
                : 'border-white/10 bg-slate-800/30 hover:border-white/20'
            }`}
          >
            <span className="text-3xl block mb-1">{eventA.emoji}</span>
            <span className="text-slate-200 text-sm font-medium">{eventA.label}</span>
          </button>
          <button
            type="button"
            onClick={() => { if (!isCurrentChallengeCorrect) { SoundManager.select(); setDurationAnswer('B'); } }}
            disabled={isCurrentChallengeCorrect}
            className={`p-3 rounded-xl border-2 transition-all ${
              durationAnswer === 'B'
                ? 'border-blue-400 bg-blue-500/10'
                : 'border-white/10 bg-slate-800/30 hover:border-white/20'
            }`}
          >
            <span className="text-3xl block mb-1">{eventB.emoji}</span>
            <span className="text-slate-200 text-sm font-medium">{eventB.label}</span>
          </button>
        </div>
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { if (!isCurrentChallengeCorrect) { SoundManager.select(); setDurationAnswer('same'); } }}
            disabled={isCurrentChallengeCorrect}
            className={`text-sm ${
              durationAnswer === 'same'
                ? 'bg-blue-500/20 border-blue-400 text-blue-300'
                : 'bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400'
            }`}
          >
            <span className="text-lg mr-2" aria-hidden>⚖️</span>
            About the Same
          </Button>
        </div>
      </div>
    );
  };

  const renderReadSchedule = () => {
    if (!currentChallenge) return null;
    const schedule = currentChallenge.schedule || [];
    const options = currentChallenge.activityOptions || schedule.map((s) => s.activity);

    return (
      <div className="space-y-4">
        {/* Schedule table */}
        <div className="rounded-xl bg-slate-800/30 border border-white/5 overflow-hidden">
          <div className="grid grid-cols-[80px_1fr] text-xs font-medium text-slate-400 bg-slate-800/50 px-3 py-2">
            <span>Time</span>
            <span>Activity</span>
          </div>
          {schedule.map((entry, i) => (
            <div
              key={i}
              className={`grid grid-cols-[80px_1fr] items-center px-3 py-2 border-t border-white/5 ${
                entry.time === currentChallenge.targetTime
                  ? 'bg-blue-500/10 border-l-2 border-l-blue-400'
                  : ''
              }`}
            >
              <span className="text-slate-300 text-sm font-mono">{entry.time}</span>
              <span className="text-slate-200 text-sm">
                {entry.emoji} {entry.activity}
              </span>
            </div>
          ))}
        </div>

        <div className="text-center">
          <span className="text-slate-400 text-sm">
            What happens at <span className="text-blue-300 font-bold">{currentChallenge.targetTime}</span>?
          </span>
        </div>

        {/* Answer options */}
        <div className="space-y-2">
          {options.map((activity) => (
            <button
              key={activity}
              type="button"
              onClick={() => { if (!isCurrentChallengeCorrect) { SoundManager.select(); setScheduleAnswer(activity); } }}
              disabled={isCurrentChallengeCorrect}
              className={`
                w-full px-4 py-3 rounded-xl border-2 text-left text-sm font-medium transition-all
                ${scheduleAnswer === activity
                  ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                  : 'border-white/10 bg-slate-800/30 hover:border-white/20 text-slate-300'}
                ${isCurrentChallengeCorrect ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {activity}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // ── Main Render ────────────────────────────────────────────────────
  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="emerald" className="text-xs">
              {gradeBand === 'K' ? 'Kindergarten' : `Grade ${gradeBand}`}
            </LuminaBadge>
            {challenges.length > 0 && (
              <LuminaBadge accent="blue" className="text-xs">
                {currentChallengeIndex + 1}/{challenges.length}
              </LuminaBadge>
            )}
          </div>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Phase badges */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(CHALLENGE_TYPE_CONFIG).map(([type, config]) => {
              const hasThisType = challenges.some((c) => c.type === type);
              if (!hasThisType) return null;
              const isActive = currentChallenge?.type === type;
              return (
                <LuminaBadge
                  key={type}
                  accent={isActive ? 'emerald' : undefined}
                  className={`text-xs ${
                    isActive
                      ? 'bg-emerald-500/20 border-emerald-400/50'
                      : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
                  }`}
                >
                  {config.icon} {config.label}
                </LuminaBadge>
              );
            })}
          </div>
        )}

        {/* Summary panel */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Challenge Complete!"
            celebrationMessage="Great work understanding time and sequences!"
            className="mb-6"
          />
        )}

        {/* Current challenge */}
        {currentChallenge && !allChallengesComplete && (
          <div className="space-y-4">
            <LuminaPanel className="p-3 rounded-xl">
              <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>
            </LuminaPanel>

            {/* #2 instruction-as-scaffold: named strategy (easy/medium; withdrawn at hard) */}
            {currentChallenge.showStrategyHint && currentChallenge.strategyHint && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-400/20">
                <span className="text-base flex-shrink-0">💡</span>
                <p className="text-blue-200/90 text-xs">{currentChallenge.strategyHint}</p>
              </div>
            )}

            {(currentChallenge.type === 'sequence-events' || currentChallenge.type === 'clock-sequence') && renderSequenceEvents()}
            {currentChallenge.type === 'match-time-of-day' && renderMatchTimeOfDay()}
            {currentChallenge.type === 'before-after' && renderBeforeAfter()}
            {currentChallenge.type === 'duration-compare' && renderDurationCompare()}
            {currentChallenge.type === 'read-schedule' && renderReadSchedule()}

            {/* Feedback */}
            {feedback && (
              <div
                className={`p-3 rounded-xl text-sm font-medium text-center ${
                  feedbackType === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-400/30 text-emerald-300'
                    : 'bg-red-500/10 border border-red-400/30 text-red-300'
                }`}
              >
                {feedback}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-3">
              {!isCurrentChallengeCorrect ? (
                <LuminaActionButton
                  action="check"
                  onClick={handleCheckAnswer}
                  disabled={!canCheck}
                />
              ) : (
                <LuminaActionButton
                  action="next"
                  onClick={advanceToNextChallenge}
                >
                  {currentChallengeIndex < challenges.length - 1 ? 'Next Challenge' : 'See Results'}
                </LuminaActionButton>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {challenges.length === 0 && (
          <div className="text-center py-8">
            <span className="text-4xl">🕐</span>
            <p className="text-slate-400 mt-2">No challenges loaded</p>
          </div>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default TimeSequencer;
