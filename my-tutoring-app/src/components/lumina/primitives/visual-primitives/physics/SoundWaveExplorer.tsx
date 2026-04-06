'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { SoundWaveExplorerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// =============================================================================
// Data Interface — Single Source of Truth
// =============================================================================

export type VibrationSource = 'guitar_string' | 'drum' | 'tuning_fork' | 'rubber_band' | 'bell' | 'whistle';
export type SoundMedium = 'air' | 'water' | 'solid_wall' | 'vacuum';
export type SoundDistance = 'close' | 'medium' | 'far';
export type SoundChallengeType = 'observe' | 'predict' | 'classify' | 'apply';
export type SoundLabTheme = 'music_room' | 'playground' | 'science_lab';

export interface VibrationObject {
  type: VibrationSource;
  label: string;
  basePitch: 'low' | 'medium' | 'high';
  baseLoudness: 'quiet' | 'medium' | 'loud';
}

export interface SoundChallenge {
  id: string;
  type: SoundChallengeType;
  instruction: string;
  vibrationObject: VibrationSource;
  forceLevel?: number;    // 1-5, affects amplitude/volume
  speedLevel?: number;    // 1-5, affects frequency/pitch
  medium?: SoundMedium;
  distance?: SoundDistance;
  correctAnswer: string;
  distractor0?: string;
  distractor1?: string;
  distractor2?: string;
  hint?: string;
}

export interface SoundWaveExplorerData {
  title: string;
  description: string;
  theme: SoundLabTheme;
  gradeLevel: 'K' | '1' | '2' | '3';
  objects: VibrationObject[];
  challenges: SoundChallenge[];

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SoundWaveExplorerMetrics>) => void;
}

interface SoundWaveExplorerProps {
  data: SoundWaveExplorerData;
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const SVG_WIDTH = 700;
const SVG_HEIGHT = 220;
const WAVE_Y = SVG_HEIGHT / 2;
const WAVE_START_X = 40;
const WAVE_END_X = SVG_WIDTH - 40;

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  observe:  { label: 'Observe',  icon: '👀', accentColor: 'blue' },
  predict:  { label: 'Predict',  icon: '🔮', accentColor: 'purple' },
  classify: { label: 'Classify', icon: '📊', accentColor: 'emerald' },
  apply:    { label: 'Apply',    icon: '🧠', accentColor: 'amber' },
};

const OBJECT_LABELS: Record<VibrationSource, string> = {
  guitar_string: 'Guitar String',
  drum: 'Drum',
  tuning_fork: 'Tuning Fork',
  rubber_band: 'Rubber Band',
  bell: 'Bell',
  whistle: 'Whistle',
};

const OBJECT_ICONS: Record<VibrationSource, string> = {
  guitar_string: '🎸',
  drum: '🥁',
  tuning_fork: '🎵',
  rubber_band: '〰️',
  bell: '🔔',
  whistle: '📯',
};

const MEDIUM_LABELS: Record<SoundMedium, string> = {
  air: 'Air',
  water: 'Water',
  solid_wall: 'Solid Wall',
  vacuum: 'Vacuum (Space)',
};

const DISTANCE_LABELS: Record<SoundDistance, string> = {
  close: 'Close',
  medium: 'Medium',
  far: 'Far Away',
};

// Frequency ranges (Hz) mapped from speedLevel 1-5
const FREQ_MIN = 200;
const FREQ_MAX = 800;

// =============================================================================
// Audio helpers — Web Audio API
// =============================================================================

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(
  frequency: number,
  volume: number,
  medium: SoundMedium,
  distance: SoundDistance,
  durationMs: number = 500,
) {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    // Vacuum = silence
    if (medium === 'vacuum') return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.value = frequency;

    // Medium filtering
    switch (medium) {
      case 'water':
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        break;
      case 'solid_wall':
        filter.type = 'highpass';
        filter.frequency.value = 300;
        filter.Q.value = 2;
        break;
      default:
        filter.type = 'allpass';
        break;
    }

    // Distance attenuation
    const distanceFactor = distance === 'close' ? 1.0 : distance === 'medium' ? 0.5 : 0.2;
    gain.gain.value = Math.min(volume * distanceFactor, 0.4);

    // Fade out
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    // Audio not available — silent fallback
  }
}

// =============================================================================
// SVG Wave path generator
// =============================================================================

function generateWavePath(
  amplitude: number,
  wavelength: number,
  medium: SoundMedium,
  distance: SoundDistance,
): string {
  // Vacuum = flat line
  if (medium === 'vacuum') {
    return `M ${WAVE_START_X} ${WAVE_Y} L ${WAVE_END_X} ${WAVE_Y}`;
  }

  const distanceFactor = distance === 'close' ? 1.0 : distance === 'medium' ? 0.6 : 0.25;
  const mediumFactor = medium === 'water' ? 0.7 : medium === 'solid_wall' ? 0.85 : 1.0;
  const effectiveAmplitude = amplitude * distanceFactor * mediumFactor;
  const totalWidth = WAVE_END_X - WAVE_START_X;

  const points: string[] = [`M ${WAVE_START_X} ${WAVE_Y}`];
  const step = 2;
  for (let x = 0; x <= totalWidth; x += step) {
    const y = WAVE_Y - effectiveAmplitude * Math.sin((2 * Math.PI * x) / wavelength);
    points.push(`L ${WAVE_START_X + x} ${y}`);
  }
  return points.join(' ');
}

// =============================================================================
// Object Stage SVG — vibrating objects
// =============================================================================

const OBJECT_STAGE_WIDTH = 240;
const OBJECT_STAGE_HEIGHT = 200;

interface ObjectStageProps {
  objectType: VibrationSource;
  isVibrating: boolean;
  forceLevel: number;
  speedLevel: number;
  onTap: () => void;
}

function ObjectStage({ objectType, isVibrating, forceLevel, speedLevel, onTap }: ObjectStageProps) {
  const vibOffset = isVibrating ? forceLevel * 1.5 : 0;
  const vibSpeed = 100 + (6 - speedLevel) * 40; // faster speed = shorter duration

  return (
    <svg
      viewBox={`0 0 ${OBJECT_STAGE_WIDTH} ${OBJECT_STAGE_HEIGHT}`}
      className="w-full cursor-pointer"
      onClick={onTap}
      role="button"
      aria-label={`Tap to ${isVibrating ? 'stop' : 'play'} ${OBJECT_LABELS[objectType]}`}
    >
      <rect x={0} y={0} width={OBJECT_STAGE_WIDTH} height={OBJECT_STAGE_HEIGHT} fill="transparent" />

      {/* Object label */}
      <text x={OBJECT_STAGE_WIDTH / 2} y={20} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={12} fontFamily="sans-serif">
        {OBJECT_ICONS[objectType]} {OBJECT_LABELS[objectType]}
      </text>

      {/* Vibrating object */}
      <g
        style={isVibrating ? {
          animation: `vibrate ${vibSpeed}ms linear infinite`,
        } : undefined}
      >
        {objectType === 'guitar_string' && (
          <g>
            <rect x={30} y={60} width={8} height={120} fill="#92400E" rx={2} />
            <rect x={OBJECT_STAGE_WIDTH - 38} y={60} width={8} height={120} fill="#92400E" rx={2} />
            {[0, 1, 2, 3].map(i => {
              const y = 80 + i * 25;
              const waveMid = isVibrating
                ? Math.sin(Date.now() / vibSpeed + i) * vibOffset
                : 0;
              return (
                <path
                  key={i}
                  d={`M 38 ${y} Q ${OBJECT_STAGE_WIDTH / 2} ${y + waveMid} ${OBJECT_STAGE_WIDTH - 38} ${y}`}
                  stroke={['#EAB308', '#F59E0B', '#D97706', '#B45309'][i]}
                  strokeWidth={2.5 - i * 0.3}
                  fill="none"
                />
              );
            })}
          </g>
        )}

        {objectType === 'drum' && (
          <g>
            <ellipse cx={OBJECT_STAGE_WIDTH / 2} cy={130} rx={70} ry={20} fill="#78350F" />
            <rect x={OBJECT_STAGE_WIDTH / 2 - 70} y={90} width={140} height={40} fill="#92400E" />
            <ellipse
              cx={OBJECT_STAGE_WIDTH / 2}
              cy={90}
              rx={70}
              ry={20}
              fill="#F5F5DC"
              stroke="#D4A574"
              strokeWidth={2}
            />
            {isVibrating && (
              <>
                <ellipse cx={OBJECT_STAGE_WIDTH / 2} cy={90} rx={50} ry={14} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
                <ellipse cx={OBJECT_STAGE_WIDTH / 2} cy={90} rx={30} ry={8} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
              </>
            )}
          </g>
        )}

        {objectType === 'tuning_fork' && (
          <g>
            <rect x={OBJECT_STAGE_WIDTH / 2 - 3} y={120} width={6} height={60} fill="#94A3B8" rx={2} />
            <rect x={OBJECT_STAGE_WIDTH / 2 - 20} y={60} width={6} height={65} fill="#CBD5E1" rx={3} />
            <rect x={OBJECT_STAGE_WIDTH / 2 + 14} y={60} width={6} height={65} fill="#CBD5E1" rx={3} />
            <path d={`M ${OBJECT_STAGE_WIDTH / 2 - 17} 125 Q ${OBJECT_STAGE_WIDTH / 2} 135 ${OBJECT_STAGE_WIDTH / 2 + 17} 125`} fill="none" stroke="#CBD5E1" strokeWidth={5} />
          </g>
        )}

        {objectType === 'rubber_band' && (
          <g>
            <rect x={40} y={80} width={20} height={80} fill="#64748B" rx={3} />
            <rect x={OBJECT_STAGE_WIDTH - 60} y={80} width={20} height={80} fill="#64748B" rx={3} />
            <path
              d={`M 60 120 Q ${OBJECT_STAGE_WIDTH / 2} ${120 + (isVibrating ? vibOffset * 2 : 0)} ${OBJECT_STAGE_WIDTH - 60} 120`}
              stroke="#EF4444"
              strokeWidth={4}
              fill="none"
            />
          </g>
        )}

        {objectType === 'bell' && (
          <g>
            <path
              d={`M ${OBJECT_STAGE_WIDTH / 2 - 35} 140 Q ${OBJECT_STAGE_WIDTH / 2 - 40} 90 ${OBJECT_STAGE_WIDTH / 2} 70 Q ${OBJECT_STAGE_WIDTH / 2 + 40} 90 ${OBJECT_STAGE_WIDTH / 2 + 35} 140`}
              fill="#FFD700"
              stroke="#DAA520"
              strokeWidth={2}
            />
            <circle cx={OBJECT_STAGE_WIDTH / 2} cy={145} r={5} fill="#B8860B" />
            <line x1={OBJECT_STAGE_WIDTH / 2} y1={65} x2={OBJECT_STAGE_WIDTH / 2} y2={50} stroke="#94A3B8" strokeWidth={2} />
          </g>
        )}

        {objectType === 'whistle' && (
          <g>
            <rect x={60} y={100} width={100} height={30} fill="#3B82F6" rx={15} />
            <rect x={150} y={95} width={30} height={15} fill="#3B82F6" rx={3} />
            <circle cx={90} cy={115} r={8} fill="#1E40AF" />
            {isVibrating && (
              <g>
                <circle cx={185} cy={102} r={3} fill="rgba(255,255,255,0.3)" />
                <circle cx={195} cy={97} r={2} fill="rgba(255,255,255,0.2)" />
                <circle cx={200} cy={105} r={2} fill="rgba(255,255,255,0.2)" />
              </g>
            )}
          </g>
        )}
      </g>

      {/* Vibration indicator rings (when vibrating) */}
      {isVibrating && (
        <g opacity={0.3}>
          <circle cx={OBJECT_STAGE_WIDTH / 2} cy={OBJECT_STAGE_HEIGHT / 2 + 10} r={80} fill="none" stroke="#60A5FA" strokeWidth={1} strokeDasharray="4 4">
            <animate attributeName="r" from="60" to="95" dur={`${vibSpeed * 3}ms`} repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.4" to="0" dur={`${vibSpeed * 3}ms`} repeatCount="indefinite" />
          </circle>
        </g>
      )}

      {/* Tap hint */}
      {!isVibrating && (
        <text x={OBJECT_STAGE_WIDTH / 2} y={OBJECT_STAGE_HEIGHT - 10} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={11} fontFamily="sans-serif">
          Tap to play!
        </text>
      )}
    </svg>
  );
}

// =============================================================================
// CSS keyframes (injected once)
// =============================================================================

const VIBRATE_STYLE_ID = 'sound-wave-explorer-vibrate-keyframes';

function ensureVibrateKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(VIBRATE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = VIBRATE_STYLE_ID;
  style.textContent = `
    @keyframes vibrate {
      0% { transform: translateX(-1.5px); }
      25% { transform: translateX(1.5px); }
      50% { transform: translateX(-1.5px); }
      75% { transform: translateX(1.5px); }
      100% { transform: translateX(-1.5px); }
    }
  `;
  document.head.appendChild(style);
}

// =============================================================================
// Main Component
// =============================================================================

export default function SoundWaveExplorer({ data, className = '' }: SoundWaveExplorerProps) {
  const {
    title,
    description,
    theme,
    gradeLevel,
    objects,
    challenges,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
  } = data;

  const resolvedInstanceId = instanceId || 'sound-wave-explorer-default';

  // Inject keyframes
  useEffect(() => { ensureVibrateKeyframes(); }, []);

  // ── Evaluation hook ──────────────────────────────────────────────
  const { submitResult, elapsedMs } = usePrimitiveEvaluation<SoundWaveExplorerMetrics>({
    primitiveType: 'sound-wave-explorer',
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
    primitiveType: 'sound-wave-explorer',
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

  // ── Interactive state ────────────────────────────────────────────
  const currentChallenge = challenges[currentChallengeIndex] ?? challenges[0];
  const [forceLevel, setForceLevel] = useState(currentChallenge?.forceLevel ?? 3);
  const [speedLevel, setSpeedLevel] = useState(currentChallenge?.speedLevel ?? 3);
  const [medium, setMedium] = useState<SoundMedium>(currentChallenge?.medium ?? 'air');
  const [distance, setDistance] = useState<SoundDistance>(currentChallenge?.distance ?? 'close');
  const [isVibrating, setIsVibrating] = useState(false);
  const [selectedMcAnswer, setSelectedMcAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [showingAnswer, setShowingAnswer] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{ score: number } | null>(null);

  // ── Auto-submit evaluation when all challenges complete ──────────
  const hasAutoSubmitted = useRef(false);
  useEffect(() => {
    if (!allChallengesComplete || hasAutoSubmitted.current) return;
    hasAutoSubmitted.current = true;

    const correctCount = challengeResults.filter(r => r.correct).length;
    const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const overallScore = Math.round((correctCount / Math.max(challengeResults.length, 1)) * 100);

    const metrics: SoundWaveExplorerMetrics = {
      type: 'sound-wave-explorer',
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
      `[ALL_COMPLETE] Student finished all sound challenges! Phase scores: ${phaseScoreStr || `Overall ${overallScore}%`}. Overall: ${overallScore}%. Give encouraging feedback about sound and vibrations.`,
      { silent: true },
    );
  }, [allChallengesComplete, challengeResults, currentChallenge, submitResult, phaseResults, sendText]);

  const vibrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Active object from challenge or first in list
  const activeObject = useMemo(() => {
    const targetType = currentChallenge?.vibrationObject ?? objects[0]?.type ?? 'guitar_string';
    return objects.find(o => o.type === targetType) ?? objects[0] ?? { type: 'guitar_string' as const, label: 'Guitar String', basePitch: 'medium' as const, baseLoudness: 'medium' as const };
  }, [currentChallenge, objects]);

  // ── Derived wave parameters ──────────────────────────────────────
  const amplitude = forceLevel * 16; // 16-80px
  const wavelength = 40 + (6 - speedLevel) * 20; // faster speed = shorter wavelength
  const frequency = FREQ_MIN + ((speedLevel - 1) / 4) * (FREQ_MAX - FREQ_MIN);
  const volume = forceLevel / 5 * 0.35;

  const pitchLabel = speedLevel <= 2 ? 'Low' : speedLevel <= 3 ? 'Medium' : 'High';
  const volumeLabel = forceLevel <= 2 ? 'Quiet' : forceLevel <= 3 ? 'Medium' : 'Loud';

  const wavePath = useMemo(
    () => generateWavePath(isVibrating ? amplitude : 0, wavelength, medium, distance),
    [isVibrating, amplitude, wavelength, medium, distance],
  );

  // ── Sync state to challenge ──────────────────────────────────────
  useEffect(() => {
    if (currentChallenge && !allChallengesComplete) {
      if (currentChallenge.forceLevel != null) setForceLevel(currentChallenge.forceLevel);
      if (currentChallenge.speedLevel != null) setSpeedLevel(currentChallenge.speedLevel);
      if (currentChallenge.medium) setMedium(currentChallenge.medium);
      if (currentChallenge.distance) setDistance(currentChallenge.distance);
      setSelectedMcAnswer(null);
      setFeedback(null);
      setShowingAnswer(false);
      setIsVibrating(false);
    }
  }, [currentChallengeIndex, currentChallenge, allChallengesComplete]);

  // ── Tap to vibrate / play sound ──────────────────────────────────
  const handleTapObject = useCallback(() => {
    if (isVibrating) {
      setIsVibrating(false);
      if (vibrationTimerRef.current) clearTimeout(vibrationTimerRef.current);
      return;
    }

    setIsVibrating(true);
    playTone(frequency, volume, medium, distance, 600);

    vibrationTimerRef.current = setTimeout(() => {
      setIsVibrating(false);
    }, 1200);
  }, [isVibrating, frequency, volume, medium, distance]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (vibrationTimerRef.current) clearTimeout(vibrationTimerRef.current);
    };
  }, []);

  // ── MC options ───────────────────────────────────────────────────
  const mcOptions = useMemo(() => {
    if (!currentChallenge) return [];
    const correct = currentChallenge.correctAnswer;
    const distractors = [
      currentChallenge.distractor0,
      currentChallenge.distractor1,
      currentChallenge.distractor2,
    ].filter(Boolean) as string[];

    if (distractors.length === 0) {
      // Generate default distractors based on challenge type
      const defaults = ['Gets higher', 'Gets lower', 'Stays the same', 'Disappears']
        .filter(d => d !== correct)
        .slice(0, 3);
      return [correct, ...defaults].sort(() => Math.random() - 0.5);
    }

    return [correct, ...distractors].sort(() => Math.random() - 0.5);
  }, [currentChallenge]);

  // ── Answer checking ──────────────────────────────────────────────
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge || !selectedMcAnswer) return;

    incrementAttempts();
    const isCorrect = selectedMcAnswer === currentChallenge.correctAnswer;

    if (isCorrect) {
      setFeedback({ correct: true, message: 'Correct! Great listening!' });
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        timeMs: 5000,
      });

      sendText(
        `[ANSWER_CORRECT] Student correctly answered "${currentChallenge.correctAnswer}" for challenge "${currentChallenge.instruction}". Attempt ${currentAttempts + 1}. Congratulate briefly and explain the sound science.`,
        { silent: true },
      );
    } else {
      setFeedback({
        correct: false,
        message: currentChallenge.hint ?? 'Not quite — try tapping the object and listening carefully!',
      });

      if (currentAttempts >= 2) {
        recordResult({
          challengeId: currentChallenge.id,
          correct: false,
          attempts: currentAttempts + 1,
        });
        setShowingAnswer(true);
      }

      sendText(
        `[ANSWER_INCORRECT] Student chose "${selectedMcAnswer}" but correct is "${currentChallenge.correctAnswer}". Challenge: "${currentChallenge.instruction}". Attempt ${currentAttempts + 1}. Give a hint without revealing the answer.`,
        { silent: true },
      );
    }
  }, [currentChallenge, selectedMcAnswer, currentAttempts, incrementAttempts, recordResult, sendText]);

  // ── Advance to next challenge ────────────────────────────────────
  const handleNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All done — evaluation auto-submitted via useEffect above
      return;
    }

    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}. Introduce it briefly.`,
      { silent: true },
    );
  }, [advanceProgress, sendText, currentChallengeIndex, challenges.length]);

  // Whether sliders should be interactive (observe mode lets you explore)
  const slidersInteractive = currentChallenge?.type === 'observe' || allChallengesComplete;

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
              {theme === 'music_room' ? '🎵 Music Room' : theme === 'playground' ? '🏫 Playground' : '🔬 Science Lab'}
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
        {/* ── Object Stage + Wave Display ─────────────────────── */}
        <div className="grid grid-cols-[240px_1fr] gap-3">
          {/* Left: Object stage */}
          <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-800/50">
            <ObjectStage
              objectType={activeObject.type}
              isVibrating={isVibrating}
              forceLevel={forceLevel}
              speedLevel={speedLevel}
              onTap={handleTapObject}
            />
          </div>

          {/* Right: Wave display */}
          <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-800/50 relative">
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              className="w-full"
            >
              {/* Center line (rest position) */}
              <line
                x1={WAVE_START_X}
                y1={WAVE_Y}
                x2={WAVE_END_X}
                y2={WAVE_Y}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={1}
                strokeDasharray="4 6"
              />

              {/* Amplitude guide */}
              {isVibrating && medium !== 'vacuum' && (
                <>
                  <line x1={WAVE_START_X - 15} y1={WAVE_Y - amplitude * (distance === 'close' ? 1 : distance === 'medium' ? 0.6 : 0.25)} x2={WAVE_START_X - 5} y2={WAVE_Y - amplitude * (distance === 'close' ? 1 : distance === 'medium' ? 0.6 : 0.25)} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
                  <line x1={WAVE_START_X - 15} y1={WAVE_Y + amplitude * (distance === 'close' ? 1 : distance === 'medium' ? 0.6 : 0.25)} x2={WAVE_START_X - 5} y2={WAVE_Y + amplitude * (distance === 'close' ? 1 : distance === 'medium' ? 0.6 : 0.25)} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
                  <line x1={WAVE_START_X - 10} y1={WAVE_Y - amplitude * (distance === 'close' ? 1 : distance === 'medium' ? 0.6 : 0.25)} x2={WAVE_START_X - 10} y2={WAVE_Y + amplitude * (distance === 'close' ? 1 : distance === 'medium' ? 0.6 : 0.25)} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
                </>
              )}

              {/* Sound wave */}
              <path
                d={wavePath}
                fill="none"
                stroke={medium === 'vacuum' ? 'rgba(255,255,255,0.15)' : '#60A5FA'}
                strokeWidth={isVibrating ? 2.5 : 1}
                opacity={isVibrating ? 1 : 0.3}
              />

              {/* Labels */}
              <text x={SVG_WIDTH / 2} y={20} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={12} fontFamily="sans-serif">
                {medium === 'vacuum'
                  ? 'No sound in vacuum!'
                  : isVibrating
                    ? `Pitch: ${pitchLabel}  •  Volume: ${volumeLabel}`
                    : 'Tap the object to see the wave'
                }
              </text>

              {/* Medium label */}
              <text x={SVG_WIDTH - 50} y={SVG_HEIGHT - 10} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize={11} fontFamily="sans-serif">
                Medium: {MEDIUM_LABELS[medium]}
              </text>
            </svg>
          </div>
        </div>

        {/* ── Controls ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          {/* Force slider (volume) */}
          <div className="space-y-1">
            <label className="text-slate-400 text-xs font-medium flex justify-between">
              <span>Force (Volume)</span>
              <span className="text-slate-500">{volumeLabel}</span>
            </label>
            <Slider
              value={[forceLevel]}
              onValueChange={([v]) => { setForceLevel(v); if (slidersInteractive && isVibrating) playTone(frequency, v / 5 * 0.35, medium, distance, 300); }}
              min={1}
              max={5}
              step={1}
              disabled={!slidersInteractive}
              className="w-full"
            />
          </div>

          {/* Speed slider (pitch) */}
          <div className="space-y-1">
            <label className="text-slate-400 text-xs font-medium flex justify-between">
              <span>Speed (Pitch)</span>
              <span className="text-slate-500">{pitchLabel}</span>
            </label>
            <Slider
              value={[speedLevel]}
              onValueChange={([v]) => { setSpeedLevel(v); if (slidersInteractive && isVibrating) playTone(FREQ_MIN + ((v - 1) / 4) * (FREQ_MAX - FREQ_MIN), volume, medium, distance, 300); }}
              min={1}
              max={5}
              step={1}
              disabled={!slidersInteractive}
              className="w-full"
            />
          </div>

          {/* Medium selector */}
          <div className="space-y-1">
            <label className="text-slate-400 text-xs font-medium">Medium</label>
            <div className="flex gap-1">
              {(['air', 'water', 'solid_wall', 'vacuum'] as SoundMedium[]).map(m => (
                <Button
                  key={m}
                  variant="ghost"
                  size="sm"
                  className={`text-xs px-2 py-1 h-auto ${medium === m
                    ? 'bg-blue-500/20 border border-blue-400/30 text-blue-200'
                    : 'bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400'
                  }`}
                  onClick={() => slidersInteractive && setMedium(m)}
                  disabled={!slidersInteractive}
                >
                  {MEDIUM_LABELS[m]}
                </Button>
              ))}
            </div>
          </div>

          {/* Distance selector */}
          <div className="space-y-1">
            <label className="text-slate-400 text-xs font-medium">Distance</label>
            <div className="flex gap-1">
              {(['close', 'medium', 'far'] as SoundDistance[]).map(d => (
                <Button
                  key={d}
                  variant="ghost"
                  size="sm"
                  className={`text-xs px-2 py-1 h-auto ${distance === d
                    ? 'bg-blue-500/20 border border-blue-400/30 text-blue-200'
                    : 'bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400'
                  }`}
                  onClick={() => slidersInteractive && setDistance(d)}
                  disabled={!slidersInteractive}
                >
                  {DISTANCE_LABELS[d]}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Challenge / Question Area ──────────────────────────── */}
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
                  <p className="mt-1 text-slate-300">The answer was: <strong>{currentChallenge.correctAnswer}</strong></p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Phase Summary ──────────────────────────────────────── */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? 0}
            durationMs={elapsedMs}
            heading="Sound Lab Complete!"
            celebrationMessage="You explored how sound and vibrations work!"
            className="mb-6"
          />
        )}
      </CardContent>
    </Card>
  );
}
