'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { AnalogClockMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface ClockChallenge {
  id: string;
  type: 'read' | 'set_time' | 'match' | 'elapsed';
  instruction: string;
  /** Target time as { hour: 1-12, minute: 0-59 } */
  targetHour: number;
  targetMinute: number;
  /** For read/match: multiple-choice options as "H:MM" strings */
  option0?: string;
  option1?: string;
  option2?: string;
  option3?: string;
  /** Index of correct option (0-3) for read/match modes */
  correctOptionIndex?: number;
  /** For elapsed: the start time */
  startHour?: number;
  startMinute?: number;
  /** For elapsed: duration description e.g. "1 hour" */
  elapsedDescription?: string;
  hint: string;
}

export interface AnalogClockData {
  title: string;
  description?: string;
  challenges: ClockChallenge[];
  /** Grade band controls snap granularity: K = :00/:30, G1 = :15, G2+ = :05 */
  gradeBand?: 'K' | '1-2' | '3-5';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<AnalogClockMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CLOCK_SIZE = 280;
const CENTER = CLOCK_SIZE / 2;
const FACE_RADIUS = CENTER - 16;
const HOUR_HAND_LENGTH = FACE_RADIUS * 0.5;
const MINUTE_HAND_LENGTH = FACE_RADIUS * 0.75;
const NUMERAL_RADIUS = FACE_RADIUS - 24;
const TICK_OUTER = FACE_RADIUS - 4;
const TICK_INNER_MAJOR = FACE_RADIUS - 16;
const TICK_INNER_MINOR = FACE_RADIUS - 10;

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  read: { label: 'Read', icon: '🕐', accentColor: 'blue' },
  set_time: { label: 'Set Time', icon: '🖐️', accentColor: 'purple' },
  match: { label: 'Match', icon: '🔗', accentColor: 'emerald' },
  elapsed: { label: 'Elapsed', icon: '⏱️', accentColor: 'amber' },
};

// Timeline bar day-cycle icons and labels
const DAY_CYCLE = [
  { pos: 0, label: '12 AM', icon: '🌙' },
  { pos: 0.125, label: '3 AM', icon: '🌙' },
  { pos: 0.25, label: '6 AM', icon: '🌅' },
  { pos: 0.375, label: '9 AM', icon: '☀️' },
  { pos: 0.5, label: '12 PM', icon: '☀️' },
  { pos: 0.625, label: '3 PM', icon: '☀️' },
  { pos: 0.75, label: '6 PM', icon: '🌅' },
  { pos: 0.875, label: '9 PM', icon: '🌙' },
];

// ============================================================================
// Utility Functions
// ============================================================================

/** Convert hour (1-12) and minute (0-59) to degrees for the hour hand */
function hourToDegrees(hour: number, minute: number): number {
  const h = hour % 12;
  return (h * 30) + (minute * 0.5); // 360/12 = 30 deg/hour, 0.5 deg/minute
}

/** Convert minute (0-59) to degrees for the minute hand */
function minuteToDegrees(minute: number): number {
  return minute * 6; // 360/60 = 6 deg/minute
}

/** Format time as "H:MM" */
function formatTime(hour: number, minute: number): string {
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h}:${minute.toString().padStart(2, '0')}`;
}

/** Snap minute to the nearest valid interval based on grade band */
function snapMinute(minute: number, gradeBand: string): number {
  let interval: number;
  switch (gradeBand) {
    case 'K': interval = 30; break;
    case '1-2': interval = 15; break;
    default: interval = 5; break;
  }
  return Math.round(minute / interval) * interval % 60;
}

/** Get angle from center to pointer position */
function getAngleFromCenter(
  centerX: number, centerY: number,
  clientX: number, clientY: number,
): number {
  const dx = clientX - centerX;
  const dy = clientY - centerY;
  // atan2 gives angle from positive X axis; we need from 12 o'clock (negative Y)
  let angle = Math.atan2(dx, -dy) * (180 / Math.PI);
  if (angle < 0) angle += 360;
  return angle;
}

// ============================================================================
// Sub-Components
// ============================================================================

/** SVG Clock Face — pure, no interaction logic */
const ClockFace: React.FC<{
  hourDeg: number;
  minuteDeg: number;
  showMinuteTicks: boolean;
  highlightColor?: string;
  isPulsing?: boolean;
}> = ({ hourDeg, minuteDeg, showMinuteTicks, highlightColor = '#60a5fa', isPulsing }) => {
  const numerals = Array.from({ length: 12 }, (_, i) => {
    const num = i + 1;
    const angle = (num * 30 - 90) * (Math.PI / 180);
    return { num, x: CENTER + NUMERAL_RADIUS * Math.cos(angle), y: CENTER + NUMERAL_RADIUS * Math.sin(angle) + 1 };
  });

  const majorTicks = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30) * (Math.PI / 180);
    return {
      x1: CENTER + TICK_INNER_MAJOR * Math.sin(angle),
      y1: CENTER - TICK_INNER_MAJOR * Math.cos(angle),
      x2: CENTER + TICK_OUTER * Math.sin(angle),
      y2: CENTER - TICK_OUTER * Math.cos(angle),
    };
  });

  const minorTicks = showMinuteTicks ? Array.from({ length: 60 }, (_, i) => {
    if (i % 5 === 0) return null; // skip major tick positions
    const angle = (i * 6) * (Math.PI / 180);
    return {
      x1: CENTER + TICK_INNER_MINOR * Math.sin(angle),
      y1: CENTER - TICK_INNER_MINOR * Math.cos(angle),
      x2: CENTER + TICK_OUTER * Math.sin(angle),
      y2: CENTER - TICK_OUTER * Math.cos(angle),
    };
  }).filter(Boolean) : [];

  return (
    <svg
      width={CLOCK_SIZE}
      height={CLOCK_SIZE}
      viewBox={`0 0 ${CLOCK_SIZE} ${CLOCK_SIZE}`}
      className="select-none"
      role="img"
      aria-label="Analog clock"
    >
      {/* Face background */}
      <circle
        cx={CENTER} cy={CENTER} r={FACE_RADIUS}
        fill="rgba(15, 23, 42, 0.6)"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={2}
      />

      {/* Subtle inner ring */}
      <circle
        cx={CENTER} cy={CENTER} r={FACE_RADIUS - 2}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={1}
      />

      {/* Minor ticks */}
      {minorTicks.map((t, i) => t && (
        <line
          key={`minor-${i}`}
          x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1}
          strokeLinecap="round"
        />
      ))}

      {/* Major ticks */}
      {majorTicks.map((t, i) => (
        <line
          key={`major-${i}`}
          x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke="rgba(255,255,255,0.4)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      ))}

      {/* Numerals */}
      {numerals.map(({ num, x, y }) => (
        <text
          key={num}
          x={x} y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fill="rgba(255,255,255,0.85)"
          fontSize={num === 12 ? 18 : 16}
          fontWeight={num === 12 ? 700 : 500}
          fontFamily="system-ui, sans-serif"
        >
          {num}
        </text>
      ))}

      {/* Hour hand */}
      <line
        x1={CENTER} y1={CENTER}
        x2={CENTER} y2={CENTER - HOUR_HAND_LENGTH}
        stroke={highlightColor}
        strokeWidth={5}
        strokeLinecap="round"
        transform={`rotate(${hourDeg}, ${CENTER}, ${CENTER})`}
        style={{ transition: isPulsing ? 'none' : 'transform 0.3s ease-out' }}
      />

      {/* Minute hand */}
      <line
        x1={CENTER} y1={CENTER}
        x2={CENTER} y2={CENTER - MINUTE_HAND_LENGTH}
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={3}
        strokeLinecap="round"
        transform={`rotate(${minuteDeg}, ${CENTER}, ${CENTER})`}
        style={{ transition: isPulsing ? 'none' : 'transform 0.3s ease-out' }}
      />

      {/* Center cap */}
      <circle cx={CENTER} cy={CENTER} r={6} fill={highlightColor} />
      <circle cx={CENTER} cy={CENTER} r={3} fill="rgba(15, 23, 42, 0.8)" />
    </svg>
  );
};

/** Timeline scrubber bar with sun/moon icons */
const TimelineScrubber: React.FC<{
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
  disabled?: boolean;
}> = ({ hour, minute, onChange, disabled }) => {
  // Convert to 0-1440 range (minutes in a day)
  const totalMinutes = ((hour % 12) * 60 + minute);
  // Map to slider value 0-100
  const sliderValue = (totalMinutes / 720) * 100;

  // Sky gradient based on time
  const getGradient = () => {
    const t = sliderValue / 100;
    if (t < 0.2 || t > 0.85) return 'from-indigo-950 via-indigo-900 to-slate-900'; // night
    if (t < 0.3) return 'from-indigo-900 via-orange-900 to-amber-800'; // dawn
    if (t < 0.7) return 'from-sky-600 via-sky-400 to-sky-600'; // day
    return 'from-amber-800 via-orange-900 to-indigo-900'; // dusk
  };

  return (
    <div className="w-full mt-4 px-2">
      {/* Icon strip */}
      <div className="relative h-6 mb-1">
        {DAY_CYCLE.map((mark) => (
          <span
            key={mark.label}
            className="absolute text-sm transform -translate-x-1/2"
            style={{ left: `${mark.pos * 100}%` }}
            title={mark.label}
          >
            {mark.icon}
          </span>
        ))}
      </div>

      {/* Gradient track + interactive slider — share a single relative container
           so the invisible Slider's absolute inset-0 is scoped here, not the whole card */}
      <div className="relative h-2">
        <div className={`absolute inset-0 rounded-full bg-gradient-to-r ${getGradient()} border border-white/10 overflow-hidden`}>
          {/* Position indicator */}
          <div
            className="absolute top-0 h-full w-1 bg-white/80 rounded-full shadow-lg shadow-white/30"
            style={{ left: `${sliderValue}%`, transform: 'translateX(-50%)' }}
          />
        </div>
        {/* Invisible slider — contained within this relative div */}
        <Slider
          value={[sliderValue]}
          min={0}
          max={100}
          step={0.5}
          disabled={disabled}
          onValueChange={([val]) => {
            const mins = Math.round((val / 100) * 720);
            const newHour = Math.floor(mins / 60) || 12;
            const newMinute = mins % 60;
            onChange(newHour, newMinute);
          }}
          className="opacity-0 absolute inset-0 cursor-pointer"
        />
      </div>

      {/* Time labels */}
      <div className="flex justify-between mt-0.5 text-[10px] text-slate-500">
        <span>12:00</span>
        <span>3:00</span>
        <span>6:00</span>
        <span>9:00</span>
        <span>12:00</span>
      </div>
    </div>
  );
};

// ============================================================================
// Props
// ============================================================================

interface AnalogClockProps {
  data: AnalogClockData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const AnalogClock: React.FC<AnalogClockProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    gradeBand = 'K',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

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
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  const currentChallenge = challenges[currentChallengeIndex] ?? null;

  // Clock display state
  const [displayHour, setDisplayHour] = useState<number>(12);
  const [displayMinute, setDisplayMinute] = useState<number>(0);

  // Interaction state
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [isDragging, setIsDragging] = useState(false);

  // Elapsed / stopwatch state
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [stopwatchStartTime, setStopwatchStartTime] = useState<{ hour: number; minute: number } | null>(null);
  const stopwatchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const prevMinuteRef = useRef<number>(0); // tracks last snapped minute for wraparound detection (sync, no stale closure)
  const stableInstanceIdRef = useRef(instanceId || `analog-clock-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Set clock to challenge target when challenge changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!currentChallenge) return;
    setSelectedOption(null);
    setFeedback('');
    setFeedbackType('');

    if (currentChallenge.type === 'read' || currentChallenge.type === 'match') {
      // Show the target time on the clock
      setDisplayHour(currentChallenge.targetHour);
      setDisplayMinute(currentChallenge.targetMinute);
    } else if (currentChallenge.type === 'set_time') {
      // Reset clock to 12:00 — student drags to target
      setDisplayHour(12);
      setDisplayMinute(0);
      prevMinuteRef.current = 0;
    } else if (currentChallenge.type === 'elapsed') {
      // Show start time, student will use stopwatch
      setDisplayHour(currentChallenge.startHour ?? currentChallenge.targetHour);
      setDisplayMinute(currentChallenge.startMinute ?? 0);
      setStopwatchRunning(false);
      setStopwatchStartTime(null);
    }
  }, [currentChallengeIndex, currentChallenge]);

  // -------------------------------------------------------------------------
  // Stopwatch animation for elapsed mode
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (stopwatchRunning) {
      stopwatchIntervalRef.current = setInterval(() => {
        setDisplayMinute(prev => {
          const next = prev + 1;
          if (next >= 60) {
            setDisplayHour(h => (h % 12) + 1);
            return 0;
          }
          return next;
        });
      }, 100); // 100ms per "minute" for fast-forward feel
    } else if (stopwatchIntervalRef.current) {
      clearInterval(stopwatchIntervalRef.current);
      stopwatchIntervalRef.current = null;
    }
    return () => {
      if (stopwatchIntervalRef.current) clearInterval(stopwatchIntervalRef.current);
    };
  }, [stopwatchRunning]);

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    elapsedMs,
  } = usePrimitiveEvaluation<AnalogClockMetrics>({
    primitiveType: 'analog-clock',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring Integration
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    gradeBand,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    instruction: currentChallenge?.instruction ?? 'Explore the clock',
    challengeType: currentChallenge?.type ?? 'read',
    targetTime: currentChallenge ? formatTime(currentChallenge.targetHour, currentChallenge.targetMinute) : '12:00',
    attemptNumber: currentAttempts + 1,
  }), [
    gradeBand, challenges.length, currentChallengeIndex,
    currentChallenge, currentAttempts,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'analog-clock',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : gradeBand === '1-2' ? 'Grade 1-2' : 'Grade 3-5',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] This is an analog clock activity for ${gradeBand === 'K' ? 'Kindergarten' : `Grades ${gradeBand}`}. `
      + `There are ${challenges.length} challenges. `
      + `First challenge: "${currentChallenge?.instruction}". `
      + `Introduce the activity warmly — we're going to learn about telling time on a clock!`,
      { silent: true },
    );
  }, [isConnected, challenges.length, gradeBand, currentChallenge, sendText]);

  // -------------------------------------------------------------------------
  // Drag-to-set interaction (for set_time mode)
  // -------------------------------------------------------------------------
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (currentChallenge?.type !== 'set_time' || hasSubmittedEvaluation) return;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [currentChallenge?.type, hasSubmittedEvaluation]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !svgContainerRef.current) return;
    const rect = svgContainerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = getAngleFromCenter(centerX, centerY, e.clientX, e.clientY);

    // Map angle to minute (0-59)
    const rawMinute = Math.round(angle / 6);
    const snapped = snapMinute(rawMinute >= 60 ? 0 : rawMinute, gradeBand);
    setDisplayMinute(snapped);

    // Detect hour change via wraparound using ref (not stale state)
    const prevMin = prevMinuteRef.current;
    prevMinuteRef.current = snapped;
    if (prevMin >= 45 && snapped <= 15) {
      setDisplayHour(h => (h % 12) + 1);
    } else if (prevMin <= 15 && snapped >= 45) {
      setDisplayHour(h => (h <= 1 ? 12 : h - 1));
    }
  }, [isDragging, gradeBand]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // -------------------------------------------------------------------------
  // Answer Checking
  // -------------------------------------------------------------------------
  const getOptions = useCallback((ch: ClockChallenge): string[] => {
    return [ch.option0, ch.option1, ch.option2, ch.option3].filter((o): o is string => !!o);
  }, []);

  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge || hasSubmittedEvaluation) return;

    let correct = false;
    const targetTime = formatTime(currentChallenge.targetHour, currentChallenge.targetMinute);

    if (currentChallenge.type === 'read' || currentChallenge.type === 'match') {
      if (selectedOption === null) return;
      correct = selectedOption === currentChallenge.correctOptionIndex;
    } else if (currentChallenge.type === 'set_time') {
      // Check if displayed time matches target
      const dispH = displayHour % 12;
      const targH = currentChallenge.targetHour % 12;
      correct = dispH === targH && displayMinute === currentChallenge.targetMinute;
    } else if (currentChallenge.type === 'elapsed') {
      if (selectedOption === null) return;
      correct = selectedOption === currentChallenge.correctOptionIndex;
    }

    if (correct) {
      setFeedback('Correct!');
      setFeedbackType('success');
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        score: Math.max(100 - (currentAttempts * 25), 25),
        targetTime,
      });
      sendText(
        `[ANSWER_CORRECT] Student got it right on attempt ${currentAttempts + 1}. Target: ${targetTime}. Congratulate briefly!`,
        { silent: true },
      );
    } else {
      incrementAttempts();
      setFeedback(currentAttempts === 0 ? 'Not quite — try again!' : currentChallenge.hint);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student answered wrong. Target: ${targetTime}. `
        + `Displayed: ${formatTime(displayHour, displayMinute)}. `
        + `Attempt ${currentAttempts + 1}. Give a gentle hint.`,
        { silent: true },
      );
    }
  }, [
    currentChallenge, selectedOption, displayHour, displayMinute,
    currentAttempts, hasSubmittedEvaluation, recordResult, incrementAttempts, sendText,
  ]);

  // -------------------------------------------------------------------------
  // Advance to next challenge
  // -------------------------------------------------------------------------
  const handleNext = useCallback(() => {
    if (!advanceProgress()) {
      // All done — compute and submit eval
      const totalCorrect = challengeResults.filter(r => r.correct).length;
      const overallScore = Math.round((totalCorrect / challenges.length) * 100);

      const phaseScoreStr = phaseResults
        .map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallScore}%. `
        + `Give encouraging phase-specific feedback about telling time!`,
        { silent: true },
      );

      if (!hasSubmittedEvaluation) {
        const metrics: AnalogClockMetrics = {
          type: 'analog-clock',
          accuracy: overallScore / 100,
          totalChallenges: challenges.length,
          correctAnswers: totalCorrect,
          averageAttempts: challengeResults.reduce((s, r) => s + r.attempts, 0) / challenges.length,
          challengeTypes: Array.from(new Set(challenges.map(c => c.type))),
        };
        submitEvaluation(
          totalCorrect === challenges.length,
          overallScore,
          metrics,
          { challengeResults },
        );
      }
      return;
    }

    // Reset for next challenge
    setSelectedOption(null);
    setFeedback('');
    setFeedbackType('');

    const next = challenges[currentChallengeIndex + 1];
    if (next) {
      sendText(
        `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}. `
        + `Type: ${next.type}. Instruction: "${next.instruction}". Introduce it briefly.`,
        { silent: true },
      );
    }
  }, [
    advanceProgress, challengeResults, challenges, phaseResults,
    currentChallengeIndex, hasSubmittedEvaluation, submitEvaluation, sendText,
  ]);

  // -------------------------------------------------------------------------
  // Stopwatch controls
  // -------------------------------------------------------------------------
  const handleStopwatchToggle = useCallback(() => {
    if (!stopwatchRunning && !stopwatchStartTime) {
      // Starting — record current time
      setStopwatchStartTime({ hour: displayHour, minute: displayMinute });
    }
    setStopwatchRunning(prev => !prev);
  }, [stopwatchRunning, stopwatchStartTime, displayHour, displayMinute]);

  const handleStopwatchReset = useCallback(() => {
    setStopwatchRunning(false);
    setStopwatchStartTime(null);
    if (currentChallenge?.type === 'elapsed') {
      setDisplayHour(currentChallenge.startHour ?? currentChallenge.targetHour);
      setDisplayMinute(currentChallenge.startMinute ?? 0);
    }
  }, [currentChallenge]);

  // -------------------------------------------------------------------------
  // Timeline scrubber change
  // -------------------------------------------------------------------------
  const handleTimelineChange = useCallback((hour: number, minute: number) => {
    if (currentChallenge?.type === 'read' || currentChallenge?.type === 'match') return; // locked in read/match
    const snapped = snapMinute(minute, gradeBand);
    setDisplayHour(hour);
    setDisplayMinute(snapped);
  }, [currentChallenge?.type, gradeBand]);

  // -------------------------------------------------------------------------
  // Computed values
  // -------------------------------------------------------------------------
  const hourDeg = hourToDegrees(displayHour, displayMinute);
  const minuteDeg = minuteToDegrees(displayMinute);
  const showMinuteTicks = gradeBand !== 'K';
  const digitalDisplay = formatTime(displayHour, displayMinute);

  const isCurrentChallengeCorrect = currentChallenge
    ? challengeResults.some(r => r.challengeId === currentChallenge.id && r.correct)
    : false;

  const localOverallScore = challenges.length > 0
    ? Math.round((challengeResults.filter(r => r.correct).length / challenges.length) * 100)
    : 0;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className ?? ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
            {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
          </div>
          {challenges.length > 0 && (
            <Badge variant="outline" className="border-white/20 text-slate-300">
              {Math.min(currentChallengeIndex + 1, challenges.length)} / {challenges.length}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col items-center gap-4">
        {/* Instruction */}
        {currentChallenge && !allChallengesComplete && (
          <p className="text-slate-200 text-center font-medium text-base">
            {currentChallenge.instruction}
          </p>
        )}

        {/* Phase summary when complete */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={localOverallScore}
            durationMs={elapsedMs}
            heading="Time Telling Complete!"
            celebrationMessage="You learned to read the clock!"
            className="mb-4 w-full"
          />
        )}

        {/* Clock face */}
        {!allChallengesComplete && (
          <>
            <div
              ref={svgContainerRef}
              className={`relative cursor-${currentChallenge?.type === 'set_time' ? 'grab' : 'default'} touch-none`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <ClockFace
                hourDeg={hourDeg}
                minuteDeg={minuteDeg}
                showMinuteTicks={showMinuteTicks}
                highlightColor={
                  feedbackType === 'success' ? '#4ade80' :
                  feedbackType === 'error' ? '#f87171' :
                  '#60a5fa'
                }
                isPulsing={stopwatchRunning}
              />

              {/* Drag hint overlay for set_time */}
              {currentChallenge?.type === 'set_time' && !isDragging && !isCurrentChallengeCorrect && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-xs text-slate-500 bg-slate-900/70 px-2 py-1 rounded-full">
                    Drag to set time
                  </span>
                </div>
              )}
            </div>

            {/* Digital display — hidden in read/match (leaks answer) and set_time (defeats purpose) */}
            {(currentChallenge?.type === 'elapsed' || isCurrentChallengeCorrect) && (
              <div className="font-mono text-3xl text-slate-100 tracking-widest bg-slate-800/50 border border-white/10 rounded-lg px-6 py-2">
                {digitalDisplay}
              </div>
            )}

            {/* Timeline scrubber */}
            <div className="w-full max-w-sm">
              <TimelineScrubber
                hour={displayHour}
                minute={displayMinute}
                onChange={handleTimelineChange}
                disabled={
                  currentChallenge?.type === 'read' ||
                  currentChallenge?.type === 'match' ||
                  stopwatchRunning ||
                  hasSubmittedEvaluation
                }
              />
            </div>

            {/* Stopwatch controls (elapsed mode) */}
            {currentChallenge?.type === 'elapsed' && !isCurrentChallengeCorrect && (
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  className={`border border-white/20 ${
                    stopwatchRunning
                      ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300'
                      : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300'
                  }`}
                  onClick={handleStopwatchToggle}
                >
                  {stopwatchRunning ? 'Stop' : stopwatchStartTime ? 'Resume' : 'Start'}
                </Button>
                <Button
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
                  onClick={handleStopwatchReset}
                >
                  Reset
                </Button>
              </div>
            )}

            {/* Multiple choice options (read / match / elapsed) */}
            {currentChallenge && ['read', 'match', 'elapsed'].includes(currentChallenge.type) && !isCurrentChallengeCorrect && (
              <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                {getOptions(currentChallenge).map((option, i) => (
                  <Button
                    key={i}
                    variant="ghost"
                    className={`text-lg font-mono py-6 border ${
                      selectedOption === i
                        ? 'bg-blue-500/20 border-blue-400/50 text-blue-200'
                        : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-200'
                    }`}
                    onClick={() => setSelectedOption(i)}
                    disabled={hasSubmittedEvaluation}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            )}

            {/* Feedback */}
            {feedback && (
              <p className={`text-sm font-medium ${
                feedbackType === 'success' ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {feedback}
              </p>
            )}

            {/* Action buttons */}
            {currentChallenge && !allChallengesComplete && (
              <div className="flex gap-3">
                {!isCurrentChallengeCorrect ? (
                  <Button
                    variant="ghost"
                    className="bg-blue-500/20 border border-blue-400/30 hover:bg-blue-500/30 text-blue-200"
                    onClick={handleCheckAnswer}
                    disabled={
                      hasSubmittedEvaluation ||
                      (currentChallenge.type !== 'set_time' && selectedOption === null) ||
                      stopwatchRunning
                    }
                  >
                    Check Answer
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    className="bg-emerald-500/20 border border-emerald-400/30 hover:bg-emerald-500/30 text-emerald-200"
                    onClick={handleNext}
                  >
                    {currentChallengeIndex < challenges.length - 1 ? 'Next' : 'Finish'}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AnalogClock;
