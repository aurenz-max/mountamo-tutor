'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { LightShadowLabMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// =============================================================================
// Data Interface — Single Source of Truth
// =============================================================================

export type ShadowDirection = 'E' | 'W' | 'N';
export type RelativeLength = 'short' | 'medium' | 'long';
export type ChallengeType = 'observe' | 'predict' | 'measure' | 'apply';
export type LabTheme = 'playground' | 'sundial' | 'science_lab';

export interface ShadowObject {
  type: 'stick_figure' | 'tree' | 'flagpole' | 'building';
  height: number; // relative height units (1-5)
  label?: string;
}

export interface SunPosition {
  time: string;       // e.g., "7:00 AM", "12:00 PM"
  altitude: number;   // degrees above horizon (0-90)
  azimuth: number;    // degrees from east (0=east, 90=south, 180=west)
}

export interface ShadowChallenge {
  id: string;
  type: ChallengeType;
  instruction: string;
  sunPosition: SunPosition;
  correctShadow: {
    direction: ShadowDirection;
    relativeLength: RelativeLength;
  };
  distractor0?: string;
  distractor1?: string;
  distractor2?: string;
  hint?: string;
}

export interface LightShadowLabData {
  title: string;
  description: string;
  theme: LabTheme;
  gradeLevel: 'K' | '1' | '2' | '3' | '4' | '5';

  objects: ShadowObject[];
  sunPositions: SunPosition[];
  challenges: ShadowChallenge[];

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<LightShadowLabMetrics>) => void;
}

interface LightShadowLabProps {
  data: LightShadowLabData;
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const SVG_WIDTH = 700;
const SVG_HEIGHT = 400;
const GROUND_Y = 320;
const SUN_ARC_CX = SVG_WIDTH / 2;
const SUN_ARC_CY = GROUND_Y;
const SUN_ARC_RX = 300;
const SUN_ARC_RY = 260;
const OBJECT_X = SVG_WIDTH / 2;

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  observe:  { label: 'Observe',  icon: '👀', accentColor: 'blue' },
  predict:  { label: 'Predict',  icon: '🔮', accentColor: 'purple' },
  measure:  { label: 'Measure',  icon: '📏', accentColor: 'emerald' },
  apply:    { label: 'Apply',    icon: '🧠', accentColor: 'amber' },
};

const DIRECTION_LABELS: Record<ShadowDirection, string> = {
  E: 'East (left)',
  W: 'West (right)',
  N: 'Directly below',
};

const LENGTH_LABELS: Record<RelativeLength, string> = {
  short: 'Short',
  medium: 'Medium',
  long: 'Long',
};

// =============================================================================
// Shadow geometry helpers
// =============================================================================

/** Convert sun altitude (0-90°) and azimuth to SVG position on the arc. */
function sunToSvg(altitude: number, azimuth: number): { x: number; y: number } {
  // Map altitude 0-90 to angle on the arc: 0° alt = horizon, 90° = zenith
  // Azimuth: 0=east, 90=south (overhead for 2D side view), 180=west
  // For our side-view, we map azimuth to horizontal position along the arc
  const t = azimuth / 180; // 0 = east, 1 = west
  const angle = Math.PI * (1 - t); // π (left/east) → 0 (right/west)
  const heightFactor = altitude / 90; // 0 at horizon, 1 at zenith

  const x = SUN_ARC_CX + SUN_ARC_RX * Math.cos(angle);
  const y = SUN_ARC_CY - SUN_ARC_RY * heightFactor * Math.sin(angle === 0 || angle === Math.PI ? Math.PI / 2 : angle);

  // Simpler mapping: position along arc based on azimuth, height based on altitude
  const xPos = SUN_ARC_CX - SUN_ARC_RX * (1 - 2 * t);
  const yPos = GROUND_Y - (SUN_ARC_RY * (altitude / 90));

  return { x: xPos, y: Math.max(40, yPos) };
}

/** Calculate shadow length and direction from sun position. */
function computeShadow(
  objectHeight: number,
  altitude: number,
  azimuth: number,
): { length: number; direction: ShadowDirection; tipX: number } {
  const heightPx = objectHeight * 40; // scale to pixels

  if (altitude >= 85) {
    return { length: 5, direction: 'N', tipX: OBJECT_X };
  }

  const altRad = (altitude * Math.PI) / 180;
  const shadowLen = heightPx / Math.tan(Math.max(altRad, 0.05));
  const clampedLen = Math.min(shadowLen, 280);

  // Shadow points AWAY from sun. If sun is in east (azimuth < 90), shadow points west (right in our view)
  // If sun is in west (azimuth > 90), shadow points east (left in our view)
  let direction: ShadowDirection;
  let tipX: number;

  if (azimuth < 80) {
    direction = 'W';
    tipX = OBJECT_X + clampedLen;
  } else if (azimuth > 100) {
    direction = 'E';
    tipX = OBJECT_X - clampedLen;
  } else {
    direction = 'N';
    tipX = OBJECT_X;
  }

  return { length: clampedLen, direction, tipX };
}

function getRelativeLength(shadowLen: number): RelativeLength {
  if (shadowLen < 60) return 'short';
  if (shadowLen < 150) return 'medium';
  return 'long';
}

/** Get display icon/color for object types. */
function getObjectVisual(type: ShadowObject['type']): { color: string; width: number } {
  switch (type) {
    case 'stick_figure': return { color: '#F59E0B', width: 14 };
    case 'tree': return { color: '#22C55E', width: 20 };
    case 'flagpole': return { color: '#94A3B8', width: 6 };
    case 'building': return { color: '#8B5CF6', width: 30 };
    default: return { color: '#F59E0B', width: 14 };
  }
}

function getThemeBackground(theme: LabTheme): string {
  switch (theme) {
    case 'playground': return '#1a2744'; // dark blue night
    case 'sundial': return '#1e293b';
    case 'science_lab': return '#0f172a';
    default: return '#1a2744';
  }
}

// =============================================================================
// Sun component (draggable along arc)
// =============================================================================

interface SunProps {
  x: number;
  y: number;
  isDragging: boolean;
}

function Sun({ x, y, isDragging }: SunProps) {
  return (
    <g>
      {/* Glow */}
      <circle cx={x} cy={y} r={30} fill="rgba(255, 215, 0, 0.15)" />
      <circle cx={x} cy={y} r={20} fill="rgba(255, 215, 0, 0.3)" />
      {/* Sun body */}
      <circle
        cx={x}
        cy={y}
        r={14}
        fill="#FFD700"
        stroke="#FFA500"
        strokeWidth={2}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', filter: 'drop-shadow(0 0 6px rgba(255, 215, 0, 0.6))' }}
      />
      {/* Rays */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <line
            key={angle}
            x1={x + 16 * Math.cos(rad)}
            y1={y + 16 * Math.sin(rad)}
            x2={x + 22 * Math.cos(rad)}
            y2={y + 22 * Math.sin(rad)}
            stroke="#FFD700"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.7}
          />
        );
      })}
    </g>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function LightShadowLab({ data, className = '' }: LightShadowLabProps) {
  const {
    title,
    description,
    theme,
    gradeLevel,
    objects,
    sunPositions,
    challenges,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const resolvedInstanceId = instanceId || 'light-shadow-lab-default';

  // ── Evaluation hook ──────────────────────────────────────────────
  const { submitResult, startedAt, elapsedMs } = usePrimitiveEvaluation<LightShadowLabMetrics>({
    primitiveType: 'light-shadow-lab',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
  });

  // ── AI tutoring ──────────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    theme,
    gradeLevel,
    challengeCount: challenges.length,
  }), [theme, gradeLevel, challenges.length]);

  const { sendText } = useLuminaAI({
    primitiveType: 'light-shadow-lab',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // ── Challenge progress (shared hooks) ────────────────────────────
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({ challenges, getChallengeId: (ch) => ch.id });

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // ── Sun position state ───────────────────────────────────────────
  const currentChallenge = challenges[currentChallengeIndex] ?? challenges[0];
  const [sunAltitude, setSunAltitude] = useState(currentChallenge?.sunPosition?.altitude ?? 45);
  const [sunAzimuth, setSunAzimuth] = useState(currentChallenge?.sunPosition?.azimuth ?? 90);
  const [isDragging, setIsDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // ── Answer selection state ───────────────────────────────────────
  const [selectedDirection, setSelectedDirection] = useState<ShadowDirection | null>(null);
  const [selectedLength, setSelectedLength] = useState<RelativeLength | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [showingAnswer, setShowingAnswer] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{ score: number } | null>(null);

  // ── Derived values ───────────────────────────────────────────────
  const primaryObject = objects[0] ?? { type: 'flagpole' as const, height: 3 };
  const shadow = useMemo(
    () => computeShadow(primaryObject.height, sunAltitude, sunAzimuth),
    [primaryObject.height, sunAltitude, sunAzimuth],
  );
  const sunSvg = useMemo(() => sunToSvg(sunAltitude, sunAzimuth), [sunAltitude, sunAzimuth]);
  const currentRelLen = getRelativeLength(shadow.length);
  const timeLabel = useMemo(() => {
    if (sunAzimuth < 60) return 'Early Morning';
    if (sunAzimuth < 80) return 'Morning';
    if (sunAzimuth < 100) return 'Midday';
    if (sunAzimuth < 140) return 'Afternoon';
    return 'Evening';
  }, [sunAzimuth]);

  // ── Sync sun to challenge position ───────────────────────────────
  useEffect(() => {
    if (currentChallenge && !allChallengesComplete) {
      const { altitude, azimuth } = currentChallenge.sunPosition;
      // For 'observe' type, let the student drag; for others, set position
      if (currentChallenge.type !== 'observe') {
        setSunAltitude(altitude);
        setSunAzimuth(azimuth);
      }
      setSelectedDirection(null);
      setSelectedLength(null);
      setFeedback(null);
      setShowingAnswer(false);
    }
  }, [currentChallengeIndex, currentChallenge, allChallengesComplete]);

  // ── Sun dragging ─────────────────────────────────────────────────
  const handleSunDrag = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * SVG_WIDTH;
    const svgY = ((clientY - rect.top) / rect.height) * SVG_HEIGHT;

    // Map x to azimuth: left = east (0°), right = west (180°)
    const rawAzimuth = ((svgX - (SUN_ARC_CX - SUN_ARC_RX)) / (2 * SUN_ARC_RX)) * 180;
    const azimuth = Math.max(5, Math.min(175, rawAzimuth));

    // Map y to altitude: ground = 0°, top = 90°
    const rawAlt = ((GROUND_Y - svgY) / SUN_ARC_RY) * 90;
    const altitude = Math.max(5, Math.min(85, rawAlt));

    setSunAzimuth(azimuth);
    setSunAltitude(altitude);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only allow dragging for observe challenges or when exploring
    if (currentChallenge?.type === 'observe' || allChallengesComplete) {
      setIsDragging(true);
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }
  }, [currentChallenge, allChallengesComplete]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isDragging) handleSunDrag(e.clientX, e.clientY);
  }, [isDragging, handleSunDrag]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // ── Build MC options from challenge ──────────────────────────────
  const mcOptions = useMemo(() => {
    if (!currentChallenge) return [];
    const correct = currentChallenge.correctShadow;

    // For observe and predict: direction + length combo
    if (currentChallenge.type === 'observe' || currentChallenge.type === 'predict') {
      const correctAnswer = `${DIRECTION_LABELS[correct.direction]}, ${LENGTH_LABELS[correct.relativeLength]}`;
      const distractors = [
        currentChallenge.distractor0,
        currentChallenge.distractor1,
        currentChallenge.distractor2,
      ].filter(Boolean) as string[];

      if (distractors.length === 0) {
        // Generate distractors from other combos
        const dirs: ShadowDirection[] = ['E', 'W', 'N'];
        const lens: RelativeLength[] = ['short', 'medium', 'long'];
        const allCombos = dirs.flatMap(d => lens.map(l => `${DIRECTION_LABELS[d]}, ${LENGTH_LABELS[l]}`));
        const filtered = allCombos.filter(c => c !== correctAnswer);
        const shuffled = filtered.sort(() => Math.random() - 0.5).slice(0, 3);
        return [correctAnswer, ...shuffled].sort(() => Math.random() - 0.5);
      }

      return [correctAnswer, ...distractors].sort(() => Math.random() - 0.5);
    }

    // For measure: direction + length identification
    if (currentChallenge.type === 'measure') {
      const correctAnswer = `${DIRECTION_LABELS[correct.direction]}, ${LENGTH_LABELS[correct.relativeLength]}`;
      const distractors = [
        currentChallenge.distractor0 ?? `${DIRECTION_LABELS['E']}, ${LENGTH_LABELS['short']}`,
        currentChallenge.distractor1 ?? `${DIRECTION_LABELS['W']}, ${LENGTH_LABELS['long']}`,
        currentChallenge.distractor2 ?? `${DIRECTION_LABELS['N']}, ${LENGTH_LABELS['medium']}`,
      ];
      return [correctAnswer, ...distractors].sort(() => Math.random() - 0.5);
    }

    // For apply: time of day from shadow
    if (currentChallenge.type === 'apply') {
      const correctTime = currentChallenge.sunPosition.time;
      const distractors = [
        currentChallenge.distractor0 ?? '7:00 AM',
        currentChallenge.distractor1 ?? '12:00 PM',
        currentChallenge.distractor2 ?? '5:00 PM',
      ].filter(d => d !== correctTime);
      return [correctTime, ...distractors.slice(0, 3)].sort(() => Math.random() - 0.5);
    }

    return [];
  }, [currentChallenge]);

  // ── Memoize correct answer for current challenge ────────────────
  const correctMcAnswer = useMemo(() => {
    if (!currentChallenge) return '';
    const c = currentChallenge.correctShadow;
    if (currentChallenge.type === 'apply') return currentChallenge.sunPosition.time;
    return `${DIRECTION_LABELS[c.direction]}, ${LENGTH_LABELS[c.relativeLength]}`;
  }, [currentChallenge]);

  // ── Answer checking ──────────────────────────────────────────────
  const [selectedMcAnswer, setSelectedMcAnswer] = useState<string | null>(null);

  // Reset selected MC answer when challenge changes
  useEffect(() => {
    setSelectedMcAnswer(null);
  }, [currentChallengeIndex]);

  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge || !selectedMcAnswer) return;

    incrementAttempts();
    const isCorrect = selectedMcAnswer === correctMcAnswer;

    if (isCorrect) {
      setFeedback({ correct: true, message: 'Correct! Great observation!' });
      const challengeStartTime = Date.now() - 5000; // approximate
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        timeMs: Date.now() - challengeStartTime,
      });

      sendText(
        `[ANSWER_CORRECT] Student correctly identified shadow as "${correctMcAnswer}" for challenge "${currentChallenge.instruction}". Attempt ${currentAttempts + 1}. Congratulate briefly and explain the science.`,
        { silent: true },
      );
    } else {
      setFeedback({
        correct: false,
        message: currentChallenge.hint ?? 'Not quite — look at where the sun is and think about which way the shadow would fall.',
      });

      if (currentAttempts >= 2) {
        // After 3 attempts, record incorrect and move on
        recordResult({
          challengeId: currentChallenge.id,
          correct: false,
          attempts: currentAttempts + 1,
        });
        setShowingAnswer(true);
      }

      sendText(
        `[ANSWER_INCORRECT] Student chose "${selectedMcAnswer}" but correct is "${correctMcAnswer}". Challenge: "${currentChallenge.instruction}". Attempt ${currentAttempts + 1}. Give a hint without revealing the answer.`,
        { silent: true },
      );
    }
  }, [currentChallenge, selectedMcAnswer, correctMcAnswer, currentAttempts, incrementAttempts, recordResult, sendText]);

  // ── Advance to next challenge ────────────────────────────────────
  const handleNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All challenges done — compute and submit evaluation
      const correctCount = challengeResults.filter(r => r.correct).length;
      const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);
      const overallScore = Math.round((correctCount / Math.max(challengeResults.length, 1)) * 100);

      const metrics: LightShadowLabMetrics = {
        type: 'light-shadow-lab',
        evalMode: currentChallenge?.type,
        challengesCompleted: challengeResults.length,
        challengesCorrect: correctCount,
        totalAttempts,
        accuracy: overallScore,
        averageAttemptsPerChallenge: totalAttempts / Math.max(challengeResults.length, 1),
      };

      submitResult(overallScore >= 70, overallScore, metrics);
      setSubmittedResult({ score: overallScore });

      const phaseScoreStr = phaseResults.map(
        p => `${p.label} ${p.score}% (${p.attempts} attempts)`,
      ).join(', ');
      sendText(
        `[ALL_COMPLETE] Student finished all shadow challenges! Phase scores: ${phaseScoreStr || `Overall ${overallScore}%`}. Overall: ${overallScore}%. Give encouraging phase-specific feedback about shadows and light.`,
        { silent: true },
      );
      return;
    }

    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}. Introduce it briefly.`,
      { silent: true },
    );
  }, [
    advanceProgress, challengeResults, resolvedInstanceId,
    currentChallenge, skillId, subskillId, objectiveId, exhibitId,
    submitResult, phaseResults, sendText, currentChallengeIndex, challenges.length,
  ]);

  // ── Object rendering ─────────────────────────────────────────────
  const objVisual = getObjectVisual(primaryObject.type);
  const objectHeightPx = primaryObject.height * 40;

  // ── Render ───────────────────────────────────────────────────────
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-slate-100">{title}</CardTitle>
            <CardDescription className="text-slate-400">{description}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="border-white/20 text-slate-300">
              {theme === 'playground' ? '🏫 Playground' : theme === 'sundial' ? '☀️ Sundial' : '🔬 Science Lab'}
            </Badge>
            {!allChallengesComplete && (
              <Badge variant="outline" className="border-white/20 text-slate-300">
                {currentChallengeIndex + 1}/{challenges.length}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── SVG Scene ────────────────────────────────────────── */}
        <div className="relative rounded-xl overflow-hidden border border-white/10">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="w-full"
            style={{ background: getThemeBackground(theme) }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {/* Sky gradient */}
            <defs>
              <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={sunAltitude > 30 ? '#1e40af' : '#0f172a'} />
                <stop offset="100%" stopColor={sunAltitude > 30 ? '#3b82f6' : '#1e293b'} />
              </linearGradient>
              <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={theme === 'playground' ? '#166534' : '#374151'} />
                <stop offset="100%" stopColor={theme === 'playground' ? '#14532d' : '#1f2937'} />
              </linearGradient>
            </defs>

            {/* Sky */}
            <rect x={0} y={0} width={SVG_WIDTH} height={GROUND_Y} fill="url(#skyGrad)" />

            {/* Sun arc guide (dashed) */}
            <ellipse
              cx={SUN_ARC_CX}
              cy={SUN_ARC_CY}
              rx={SUN_ARC_RX}
              ry={SUN_ARC_RY}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="4 8"
            />

            {/* Ground */}
            <rect x={0} y={GROUND_Y} width={SVG_WIDTH} height={SVG_HEIGHT - GROUND_Y} fill="url(#groundGrad)" />

            {/* Direction labels */}
            <text x={30} y={GROUND_Y + 20} fill="rgba(255,255,255,0.4)" fontSize={13} fontFamily="sans-serif">E (East)</text>
            <text x={SVG_WIDTH - 80} y={GROUND_Y + 20} fill="rgba(255,255,255,0.4)" fontSize={13} fontFamily="sans-serif">W (West)</text>

            {/* Shadow */}
            <line
              x1={OBJECT_X}
              y1={GROUND_Y}
              x2={shadow.tipX}
              y2={GROUND_Y}
              stroke="rgba(0,0,0,0.5)"
              strokeWidth={Math.max(objVisual.width * 0.6, 8)}
              strokeLinecap="round"
              opacity={sunAltitude < 5 ? 0.2 : 0.6}
            />
            {/* Shadow blur overlay for realism */}
            <line
              x1={OBJECT_X}
              y1={GROUND_Y}
              x2={shadow.tipX}
              y2={GROUND_Y}
              stroke="rgba(0,0,0,0.2)"
              strokeWidth={Math.max(objVisual.width * 0.9, 14)}
              strokeLinecap="round"
              opacity={sunAltitude < 20 ? 0.4 : 0.2}
            />

            {/* Object */}
            {primaryObject.type === 'tree' ? (
              <g>
                {/* Trunk */}
                <rect
                  x={OBJECT_X - 4}
                  y={GROUND_Y - objectHeightPx}
                  width={8}
                  height={objectHeightPx}
                  fill="#92400E"
                  rx={2}
                />
                {/* Canopy */}
                <circle
                  cx={OBJECT_X}
                  cy={GROUND_Y - objectHeightPx - 15}
                  r={22}
                  fill="#22C55E"
                  opacity={0.9}
                />
              </g>
            ) : primaryObject.type === 'stick_figure' ? (
              <g>
                {/* Body */}
                <line x1={OBJECT_X} y1={GROUND_Y - objectHeightPx * 0.4} x2={OBJECT_X} y2={GROUND_Y} stroke="#F59E0B" strokeWidth={3} />
                {/* Head */}
                <circle cx={OBJECT_X} cy={GROUND_Y - objectHeightPx * 0.4 - 12} r={10} fill="#F59E0B" />
                {/* Arms */}
                <line x1={OBJECT_X - 15} y1={GROUND_Y - objectHeightPx * 0.25} x2={OBJECT_X + 15} y2={GROUND_Y - objectHeightPx * 0.25} stroke="#F59E0B" strokeWidth={2.5} />
                {/* Legs */}
                <line x1={OBJECT_X} y1={GROUND_Y} x2={OBJECT_X - 10} y2={GROUND_Y + 2} stroke="#F59E0B" strokeWidth={2.5} />
                <line x1={OBJECT_X} y1={GROUND_Y} x2={OBJECT_X + 10} y2={GROUND_Y + 2} stroke="#F59E0B" strokeWidth={2.5} />
              </g>
            ) : primaryObject.type === 'building' ? (
              <rect
                x={OBJECT_X - 15}
                y={GROUND_Y - objectHeightPx}
                width={30}
                height={objectHeightPx}
                fill="#8B5CF6"
                stroke="#A78BFA"
                strokeWidth={1}
                rx={2}
              />
            ) : (
              /* Flagpole */
              <g>
                <line x1={OBJECT_X} y1={GROUND_Y} x2={OBJECT_X} y2={GROUND_Y - objectHeightPx} stroke="#94A3B8" strokeWidth={3} />
                <rect x={OBJECT_X} y={GROUND_Y - objectHeightPx} width={18} height={12} fill="#EF4444" rx={1} />
              </g>
            )}

            {/* Sun */}
            <Sun x={sunSvg.x} y={sunSvg.y} isDragging={isDragging} />

            {/* Time label */}
            <text
              x={SVG_WIDTH / 2}
              y={25}
              textAnchor="middle"
              fill="rgba(255,255,255,0.6)"
              fontSize={14}
              fontFamily="sans-serif"
            >
              {currentChallenge?.sunPosition?.time ?? timeLabel}
            </text>

            {/* Shadow info (when exploring or after answer) */}
            {(allChallengesComplete || feedback?.correct) && (
              <text
                x={shadow.tipX > OBJECT_X ? shadow.tipX + 10 : shadow.tipX - 10}
                y={GROUND_Y - 8}
                textAnchor={shadow.tipX > OBJECT_X ? 'start' : 'end'}
                fill="rgba(255,255,255,0.5)"
                fontSize={11}
                fontFamily="sans-serif"
              >
                Shadow: {currentRelLen}, {shadow.direction}
              </text>
            )}
          </svg>

          {/* Drag instruction overlay */}
          {currentChallenge?.type === 'observe' && !feedback?.correct && !allChallengesComplete && (
            <div className="absolute top-2 right-2 bg-black/50 text-slate-300 text-xs px-2 py-1 rounded">
              Drag the sun to explore
            </div>
          )}
        </div>

        {/* ── Challenge / Question Area ────────────────────────── */}
        {!allChallengesComplete && currentChallenge && (
          <div className="space-y-3">
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="border-white/20 text-slate-300 text-xs">
                  {PHASE_TYPE_CONFIG[currentChallenge.type]?.icon} {PHASE_TYPE_CONFIG[currentChallenge.type]?.label}
                </Badge>
              </div>
              <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>
            </div>

            {/* MC options */}
            {!feedback?.correct && !showingAnswer && (
              <div className="grid grid-cols-2 gap-2">
                {mcOptions.map((option, i) => (
                  <Button
                    key={i}
                    variant="ghost"
                    className={`bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200 text-sm h-auto py-2 px-3 text-left justify-start ${
                      selectedMcAnswer === option ? 'ring-2 ring-blue-400 bg-blue-500/10' : ''
                    }`}
                    onClick={() => setSelectedMcAnswer(option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            )}

            {/* Check / Next buttons */}
            <div className="flex gap-2">
              {!feedback?.correct && !showingAnswer && (
                <Button
                  variant="ghost"
                  className="bg-blue-500/20 border border-blue-400/30 hover:bg-blue-500/30 text-blue-200"
                  onClick={handleCheckAnswer}
                  disabled={!selectedMcAnswer}
                >
                  Check Answer
                </Button>
              )}
              {(feedback?.correct || showingAnswer) && (
                <Button
                  variant="ghost"
                  className="bg-emerald-500/20 border border-emerald-400/30 hover:bg-emerald-500/30 text-emerald-200"
                  onClick={handleNextChallenge}
                >
                  {currentChallengeIndex < challenges.length - 1 ? 'Next Challenge' : 'See Results'}
                </Button>
              )}
            </div>

            {/* Feedback */}
            {feedback && (
              <div className={`rounded-lg p-3 text-sm ${
                feedback.correct
                  ? 'bg-emerald-500/10 border border-emerald-400/20 text-emerald-200'
                  : 'bg-amber-500/10 border border-amber-400/20 text-amber-200'
              }`}>
                {feedback.message}
                {showingAnswer && (
                  <p className="mt-1 text-slate-300">The answer was: <strong>{correctMcAnswer}</strong></p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Phase Summary ────────────────────────────────────── */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? 0}
            durationMs={elapsedMs}
            heading="Shadow Lab Complete!"
            celebrationMessage="You explored how light and shadows work!"
            className="mb-6"
          />
        )}
      </CardContent>
    </Card>
  );
}
