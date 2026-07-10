'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaPanel,
  LuminaActionButton,
  LuminaInput,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
  type DiagnosisEvidence,
} from '../../../evaluation';
import type { CompareObjectsMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface CompareObject {
  name: string;
  visualSize: number; // relative render size (0-100 scale)
  actualValue: number; // hidden true measurement for scoring
}

export interface CompareObjectsChallenge {
  id: string;
  type: 'identify_attribute' | 'compare_two' | 'order_three' | 'non_standard';
  instruction: string;
  attribute: 'length' | 'height' | 'weight' | 'capacity';
  objects: CompareObject[];
  correctAnswer: string; // object name for compare_two, comma-separated ordered names for order_three
  comparisonWord: 'longer' | 'shorter' | 'taller' | 'shorter_height' | 'heavier' | 'lighter' | 'holds_more' | 'holds_less';
  hint: string;
  // identify_attribute fields
  attributeOptions?: string[];
  correctAttribute?: string;
  // non_standard fields
  unitName?: string;
  unitCount?: number;
  // weight order_three: unit shown on each scale readout (e.g. 'lbs', 'kg')
  weightUnit?: string;
  // ── Support-tier scaffolding (set by generator when config.difficulty present) ──
  supportTier?: 'easy' | 'medium' | 'hard';
  showUnitNumbers?: boolean;  // non_standard: number the unit boxes 1..n (hard → hidden)
  showScaleReadout?: boolean; // order_three weight: show digital readout (hard → hidden)
}

export interface CompareObjectsData {
  title: string;
  description?: string;
  challenges: CompareObjectsChallenge[];
  gradeBand?: 'K' | '1';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<CompareObjectsMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  identify_attribute: { label: 'Identify', icon: '🔍', accentColor: 'purple' },
  compare_two: { label: 'Compare', icon: '⚖️', accentColor: 'blue' },
  order_three: { label: 'Order', icon: '📊', accentColor: 'emerald' },
  non_standard: { label: 'Measure', icon: '📏', accentColor: 'amber' },
};

const ATTRIBUTE_COLORS: Record<string, string> = {
  length: 'from-blue-500/30 to-cyan-500/30',
  height: 'from-emerald-500/30 to-green-500/30',
  weight: 'from-amber-500/30 to-orange-500/30',
  capacity: 'from-purple-500/30 to-pink-500/30',
};

// ============================================================================
// Visual Renderers
// ============================================================================

function renderLengthObject(obj: CompareObject, index: number, maxWidth: number) {
  const width = Math.max(30, (obj.visualSize / 100) * maxWidth);
  const colors = [
    'from-blue-400 to-blue-600',
    'from-rose-400 to-rose-600',
    'from-emerald-400 to-emerald-600',
  ];
  return (
    <div key={index} className="flex items-center gap-3">
      <span className="text-slate-300 text-sm w-24 text-right shrink-0">{obj.name}</span>
      <div
        className={`h-8 rounded-full bg-gradient-to-r ${colors[index % colors.length]} border border-white/20 shadow-lg transition-all duration-500`}
        style={{ width: `${width}px` }}
      />
    </div>
  );
}

function renderHeightObject(obj: CompareObject, index: number, maxHeight: number) {
  const height = Math.max(20, (obj.visualSize / 100) * maxHeight);
  const colors = [
    'from-blue-400 to-blue-600',
    'from-rose-400 to-rose-600',
    'from-emerald-400 to-emerald-600',
  ];
  return (
    <div key={index} className="flex flex-col items-center gap-2">
      <div className="flex-1 flex items-end">
        <div
          className={`w-16 rounded-t-lg bg-gradient-to-t ${colors[index % colors.length]} border border-white/20 border-b-0 shadow-lg transition-all duration-500`}
          style={{ height: `${height}px` }}
        />
      </div>
      <div className="w-16 h-1 bg-slate-500 rounded" />
      <span className="text-slate-300 text-sm text-center">{obj.name}</span>
    </div>
  );
}

function renderWeightObject(obj: CompareObject, _index: number, objects: CompareObject[]) {
  // Seesaw visualization
  const totalWeight = objects.reduce((s, o) => s + o.actualValue, 0);
  const leftObj = objects[0];
  const rightObj = objects[1];
  if (!leftObj || !rightObj) return null;

  const diff = leftObj.actualValue - rightObj.actualValue;
  const maxDiff = Math.max(leftObj.actualValue, rightObj.actualValue);
  const tiltDeg = maxDiff > 0 ? Math.min(12, (Math.abs(diff) / maxDiff) * 15) : 0;
  // SVG positive rotation = clockwise → left side goes UP. Heavier left needs
  // CCW (negative) so the heavier side sinks. Invert sign of diff.
  const tiltDirection = diff > 0 ? -1 : diff < 0 ? 1 : 0;

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {/* Seesaw beam */}
      <svg viewBox="0 0 300 120" className="w-full max-w-sm">
        {/* Fulcrum */}
        <polygon points="150,110 135,85 165,85" fill="rgb(100,116,139)" />
        {/* Beam */}
        <g transform={`rotate(${tiltDirection * tiltDeg}, 150, 85)`}>
          <rect x="30" y="80" width="240" height="8" rx="4" fill="rgb(148,163,184)" />
          {/* Left platform */}
          <rect x="40" y="70" width="50" height="12" rx="3" fill="rgb(96,165,250)" opacity="0.8" />
          <text x="65" y="65" textAnchor="middle" fill="rgb(203,213,225)" fontSize="11">{leftObj.name}</text>
          {/* Left weight indicator */}
          <circle cx="65" cy="55" r={Math.max(8, (leftObj.visualSize / 100) * 18)} fill="rgb(96,165,250)" opacity="0.6" />
          {/* Right platform */}
          <rect x="210" y="70" width="50" height="12" rx="3" fill="rgb(244,114,182)" opacity="0.8" />
          <text x="235" y="65" textAnchor="middle" fill="rgb(203,213,225)" fontSize="11">{rightObj.name}</text>
          {/* Right weight indicator */}
          <circle cx="235" cy="55" r={Math.max(8, (rightObj.visualSize / 100) * 18)} fill="rgb(244,114,182)" opacity="0.6" />
        </g>
      </svg>
    </div>
  );
}

function renderThreeScaleWeights(objects: CompareObject[], weightUnit: string, showReadout = true) {
  // Three platform scales side-by-side. Each object sinks the platform by
  // visualSize (heavier = bigger drop), and the readout below shows the weight.
  const platformColors = [
    'from-amber-300 to-amber-500',
    'from-rose-300 to-rose-500',
    'from-emerald-300 to-emerald-500',
  ];
  const maxDropPx = 22;

  return (
    <div className="flex items-end justify-center gap-4 w-full pt-6">
      {objects.map((obj, i) => {
        const dropPx = (obj.visualSize / 100) * maxDropPx;
        // Display weight derived from visualSize (1-9 range) — visualSize 10..90 maps to 1..9
        const displayWeight = Math.max(1, Math.round(obj.visualSize / 10));
        return (
          <div key={obj.name} className="flex flex-col items-center gap-0">
            {/* Object label sitting on the platform */}
            <div
              className={`px-3 py-1.5 rounded-lg bg-gradient-to-br ${platformColors[i % platformColors.length]} border border-white/30 shadow-md text-slate-900 text-xs font-semibold whitespace-nowrap min-w-[78px] text-center`}
              style={{ transform: `translateY(${dropPx}px)`, transition: 'transform 0.4s' }}
            >
              {obj.name}
            </div>
            {/* Platform */}
            <div
              className="w-24 h-2 mt-1 bg-gradient-to-b from-slate-300 to-slate-500 rounded-full shadow-md border border-white/10"
              style={{ transform: `translateY(${dropPx}px)`, transition: 'transform 0.4s' }}
            />
            {/* Spring/post — visually compresses (shrinks) for heavier loads */}
            <div
              className="w-3 bg-slate-500/70 border-x border-slate-400/60"
              style={{ height: `${Math.max(4, 24 - dropPx)}px`, transition: 'height 0.4s' }}
            />
            {/* Scale body with digital readout (hidden at the hard tier — order by drop) */}
            <div className="w-28 h-12 bg-slate-700 rounded-md border border-slate-500 flex items-center justify-center shadow-md">
              <div className="bg-black/70 px-2 py-0.5 rounded font-mono text-amber-300 text-sm font-bold border border-amber-400/30">
                {showReadout ? `${displayWeight} ${weightUnit}` : '— ?'}
              </div>
            </div>
            {/* Base */}
            <div className="w-28 h-1.5 bg-slate-900 rounded-b shadow" />
          </div>
        );
      })}
    </div>
  );
}

function renderCapacityObject(obj: CompareObject, index: number, _maxHeight: number) {
  const fillPercent = Math.max(10, obj.visualSize);
  const colors = [
    'from-blue-400/60 to-blue-500/80',
    'from-rose-400/60 to-rose-500/80',
    'from-emerald-400/60 to-emerald-500/80',
  ];
  return (
    <div key={index} className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-32 border-2 border-white/30 rounded-b-lg overflow-hidden bg-slate-800/50">
        {/* Fill level */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${colors[index % colors.length]} transition-all duration-500`}
          style={{ height: `${fillPercent}%` }}
        />
        {/* Glass effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent" />
      </div>
      <span className="text-slate-300 text-sm text-center">{obj.name}</span>
    </div>
  );
}

function renderNonStandardMeasure(obj: CompareObject, unitName: string, unitCount: number, showNumbers = true) {
  const width = Math.max(60, (obj.visualSize / 100) * 320);
  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Object to measure */}
      <div className="flex items-center gap-3">
        <span className="text-slate-300 text-sm w-20 text-right shrink-0">{obj.name}</span>
        <div
          className="h-8 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 border border-white/20 shadow-lg"
          style={{ width: `${width}px` }}
        />
      </div>
      {/* Measurement units row */}
      <div className="flex items-center gap-3">
        <span className="text-slate-400 text-sm w-20 text-right shrink-0">{unitName}s</span>
        <div className="flex gap-0.5">
          {Array.from({ length: unitCount }).map((_, i) => (
            <div
              key={i}
              className="h-6 border border-dashed border-cyan-400/50 bg-cyan-500/10 rounded-sm flex items-center justify-center"
              style={{ width: `${width / unitCount}px` }}
            >
              {showNumbers && <span className="text-[10px] text-cyan-300">{i + 1}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Tutor reveal policy — keep the AI tutor in sync with the on-screen scaffold
// so a hard tier (read-outs hidden, differences subtle) isn't undone by the
// tutor naming the answer. The task identity (taller/heavier/longer) is the
// same at every tier; the tier only dials how much the tutor may reveal.
// ============================================================================
function tutorRevealClause(tier?: 'easy' | 'medium' | 'hard'): string {
  switch (tier) {
    case 'easy':
      return ' [TIER:easy] Max scaffolding — you may name the comparison strategy and walk it step by step.';
    case 'medium':
      return ' [TIER:medium] Nudge the comparison; do not give the answer outright.';
    case 'hard':
      return ' [TIER:hard] Read-outs are hidden and the differences are subtle — do NOT reveal which object or the count; ask what the student notices about the sizes/units and let them decide.';
    default:
      return '';
  }
}

// ============================================================================
// Component
// ============================================================================

interface CompareObjectsProps {
  data: CompareObjectsData;
  className?: string;
}

const CompareObjects: React.FC<CompareObjectsProps> = ({ data, className }) => {
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
  // Challenge Progress (shared hooks)
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
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  const [selectedAttribute, setSelectedAttribute] = useState<string | null>(null);
  const [orderSelection, setOrderSelection] = useState<string[]>([]);
  const [nonStandardAnswer, setNonStandardAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `compare-objects-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const currentChallenge = useMemo(
    () => challenges[currentChallengeIndex] || null,
    [challenges, currentChallengeIndex],
  );

  // ── Misconception Loop S1 — session-scoped wrong-answer log ────────────────
  // Every wrong submit appends one observation (what was asked, what the
  // student picked, what was expected). On a failed session these become the
  // Tier-B DiagnosisEvidence packet. DATA only — the shared distiller
  // diagnoses; nothing here is ever student-visible.
  const wrongObservationsRef = useRef<
    Array<{ challenge: string; observed: string; expected: string }>
  >([]);

  const noteWrongAnswer = useCallback(
    (asked: string, observedVal: string, expectedVal: string) => {
      const instr = currentChallenge?.instruction
        ? `"${currentChallenge.instruction}"`
        : `a ${currentChallenge?.type ?? 'compare-objects'} challenge`;
      // Bounded: keep the most recent 8 observations.
      const log = wrongObservationsRef.current;
      log.push({
        challenge: `${instr} — ${asked}`,
        observed: observedVal,
        expected: expectedVal,
      });
      if (log.length > 8) log.shift();
    },
    [currentChallenge],
  );

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<CompareObjectsMetrics>({
    primitiveType: 'compare-objects',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    attribute: currentChallenge?.attribute ?? 'length',
    objects: currentChallenge?.objects?.map(o => o.name) ?? [],
    comparisonWord: currentChallenge?.comparisonWord ?? '',
    instruction: currentChallenge?.instruction ?? '',
    challengeType: currentChallenge?.type ?? 'compare_two',
    supportTier: currentChallenge?.supportTier ?? null,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    attemptNumber: currentAttempts + 1,
    gradeBand,
  }), [currentChallenge, challenges.length, currentChallengeIndex, currentAttempts, gradeBand]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'compare-objects',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] CompareObjects activity for ${gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}. `
      + `${challenges.length} challenges about comparing measurable attributes. `
      + `First challenge: "${currentChallenge?.instruction}". `
      + `Introduce warmly: "Let's look at some objects and figure out which is bigger, longer, or heavier!"`
      + tutorRevealClause(currentChallenge?.supportTier),
      { silent: true },
    );
  }, [isConnected, challenges.length, gradeBand, currentChallenge, sendText]);

  // -------------------------------------------------------------------------
  // Interaction Handlers
  // -------------------------------------------------------------------------
  const handleObjectSelect = useCallback((objectName: string) => {
    if (hasSubmittedEvaluation || showCorrectAnswer) return;
    SoundManager.select();
    setSelectedObject(objectName);
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation, showCorrectAnswer]);

  const handleAttributeSelect = useCallback((attr: string) => {
    if (hasSubmittedEvaluation || showCorrectAnswer) return;
    SoundManager.select();
    setSelectedAttribute(attr);
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation, showCorrectAnswer]);

  const handleOrderSelect = useCallback((objectName: string) => {
    if (hasSubmittedEvaluation || showCorrectAnswer) return;
    SoundManager.tap();
    setOrderSelection(prev => {
      if (prev.includes(objectName)) {
        return prev.filter(n => n !== objectName);
      }
      return [...prev, objectName];
    });
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation, showCorrectAnswer]);

  // -------------------------------------------------------------------------
  // Check Answer
  // -------------------------------------------------------------------------
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;
    incrementAttempts();

    let correct = false;

    switch (currentChallenge.type) {
      case 'identify_attribute': {
        if (!selectedAttribute) {
          SoundManager.invalid();
          setFeedback('Pick an attribute first!');
          setFeedbackType('error');
          return;
        }
        correct = selectedAttribute === currentChallenge.correctAttribute;
        if (correct) {
          setFeedback(`Yes! We can measure the ${selectedAttribute} of these objects!`);
          setFeedbackType('success');
          sendText(
            `[ANSWER_CORRECT] Student correctly identified "${selectedAttribute}" as a measurable attribute. Congratulate briefly.`,
            { silent: true },
          );
        } else {
          setFeedback(`Not quite. Look at the objects again - what can we measure about them?`);
          setFeedbackType('error');
          noteWrongAnswer(
            `identify the measurable attribute of ${currentChallenge.objects.map(o => o.name).join(', ')}`,
            `picked "${selectedAttribute}"`,
            `the correct attribute is "${currentChallenge.correctAttribute}"`,
          );
          sendText(
            `[ANSWER_INCORRECT] Student chose "${selectedAttribute}" but correct attribute is "${currentChallenge.correctAttribute}". Give a hint about what's different between these objects.`
            + tutorRevealClause(currentChallenge.supportTier),
            { silent: true },
          );
        }
        break;
      }
      case 'compare_two': {
        if (!selectedObject) {
          SoundManager.invalid();
          setFeedback('Tap on the object you think is the answer!');
          setFeedbackType('error');
          return;
        }
        correct = selectedObject === currentChallenge.correctAnswer;
        if (correct) {
          setFeedback(`Great job! The ${selectedObject} is ${currentChallenge.comparisonWord}!`);
          setFeedbackType('success');
          sendText(
            `[ANSWER_CORRECT] Student correctly picked "${selectedObject}" as ${currentChallenge.comparisonWord}. Congratulate briefly.`,
            { silent: true },
          );
        } else {
          setFeedback(`Look more carefully - which one is ${currentChallenge.comparisonWord}?`);
          setFeedbackType('error');
          noteWrongAnswer(
            `pick which of ${currentChallenge.objects.map(o => o.name).join(', ')} is ${currentChallenge.comparisonWord} (attribute: ${currentChallenge.attribute})`,
            `picked "${selectedObject}"`,
            `the ${currentChallenge.correctAnswer} is ${currentChallenge.comparisonWord}`,
          );
          sendText(
            `[ANSWER_INCORRECT] Student chose "${selectedObject}" but "${currentChallenge.correctAnswer}" is ${currentChallenge.comparisonWord}. Hint: "${currentChallenge.hint}".`
            + tutorRevealClause(currentChallenge.supportTier),
            { silent: true },
          );
        }
        break;
      }
      case 'order_three': {
        if (orderSelection.length !== (currentChallenge.objects?.length ?? 3)) {
          SoundManager.invalid();
          setFeedback(`Tap all ${currentChallenge.objects?.length ?? 3} objects in order!`);
          setFeedbackType('error');
          return;
        }
        const correctOrder = currentChallenge.correctAnswer.split(',').map(s => s.trim());
        correct = orderSelection.every((name, i) => name === correctOrder[i]);
        if (correct) {
          setFeedback(`Perfect! You put them in the right order!`);
          setFeedbackType('success');
          sendText(
            `[ANSWER_CORRECT] Student correctly ordered: ${orderSelection.join(', ')}. Congratulate briefly.`,
            { silent: true },
          );
        } else {
          setFeedback(`Not quite the right order. Try again!`);
          setFeedbackType('error');
          noteWrongAnswer(
            `order ${currentChallenge.objects.map(o => o.name).join(', ')} by ${currentChallenge.attribute} (${currentChallenge.comparisonWord})`,
            `ordered ${orderSelection.join(', ')}`,
            `the correct order is ${correctOrder.join(', ')}`,
          );
          setOrderSelection([]);
          sendText(
            `[ANSWER_INCORRECT] Student ordered: ${orderSelection.join(', ')} but correct is: ${correctOrder.join(', ')}. Hint: "${currentChallenge.hint}".`
            + tutorRevealClause(currentChallenge.supportTier),
            { silent: true },
          );
        }
        break;
      }
      case 'non_standard': {
        const answer = parseInt(nonStandardAnswer, 10);
        if (isNaN(answer)) {
          SoundManager.invalid();
          setFeedback('Type a number!');
          setFeedbackType('error');
          return;
        }
        correct = answer === currentChallenge.unitCount;
        if (correct) {
          setFeedback(`Yes! The ${currentChallenge.objects[0]?.name} is ${answer} ${currentChallenge.unitName}s long!`);
          setFeedbackType('success');
          sendText(
            `[ANSWER_CORRECT] Student correctly measured ${answer} ${currentChallenge.unitName}s. Congratulate briefly.`,
            { silent: true },
          );
        } else {
          setFeedback(`Count the ${currentChallenge.unitName}s again carefully!`);
          setFeedbackType('error');
          noteWrongAnswer(
            `measure the ${currentChallenge.objects[0]?.name ?? 'object'} in ${currentChallenge.unitName}s`,
            `entered ${answer}`,
            `the correct count is ${currentChallenge.unitCount} ${currentChallenge.unitName}s`,
          );
          sendText(
            `[ANSWER_INCORRECT] Student answered ${answer} but correct is ${currentChallenge.unitCount} ${currentChallenge.unitName}s. Give a counting hint.`
            + tutorRevealClause(currentChallenge.supportTier),
            { silent: true },
          );
        }
        break;
      }
    }

    if (correct) {
      SoundManager.playCorrect();
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
      setShowCorrectAnswer(true);
    } else {
      SoundManager.playIncorrect();
      if (currentAttempts + 1 >= 3) {
        // After 3 wrong attempts, show correct answer and record as incorrect
        setShowCorrectAnswer(true);
        recordResult({
          challengeId: currentChallenge.id,
          correct: false,
          attempts: currentAttempts + 1,
        });
        setFeedback(`The answer is: ${currentChallenge.correctAnswer}`);
        setFeedbackType('error');
      }
    }
  }, [
    currentChallenge, selectedObject, selectedAttribute, orderSelection, nonStandardAnswer,
    currentAttempts, incrementAttempts, recordResult, sendText, hasSubmittedEvaluation, showCorrectAnswer,
    noteWrongAnswer,
  ]);

  // -------------------------------------------------------------------------
  // Advance
  // -------------------------------------------------------------------------
  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All complete
      const phaseScoreStr = phaseResults
        .map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = challenges.length > 0
        ? Math.round((challengeResults.filter(r => r.correct).length / challenges.length) * 100)
        : 0;

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. Give encouraging feedback about their measurement skills!`,
        { silent: true },
      );

      if (!hasSubmittedEvaluation) {
        const totalCorrect = challengeResults.filter(r => r.correct).length;
        const score = challenges.length > 0
          ? Math.round((totalCorrect / challenges.length) * 100)
          : 0;

        const metrics: CompareObjectsMetrics = {
          type: 'compare-objects',
          evalMode: challenges[0]?.type ?? 'default',
          accuracy: score,
          attributesTested: Array.from(new Set(challenges.map(c => c.attribute))),
          totalAttempts: challengeResults.reduce((s, r) => s + r.attempts, 0),
          correctCount: totalCorrect,
          totalChallenges: challenges.length,
        };

        // Misconception Loop S1 — Tier-B evidence packet on failed sessions.
        // Latest wrong observation is the headline; earlier ones become
        // priorAttempts (the consistency signal the distiller needs to tell a
        // mental model from a slip). Clean sessions carry no packet.
        const goalMet = totalCorrect === challenges.length;
        const wrongs = wrongObservationsRef.current;
        const latest = wrongs[wrongs.length - 1];
        const diagnosisEvidence: DiagnosisEvidence | undefined =
          !goalMet && latest
            ? {
                challengeSummary: latest.challenge,
                expected: latest.expected,
                observed: latest.observed,
                priorAttempts: wrongs
                  .slice(0, -1)
                  .map((w) => ({ challenge: w.challenge, observed: w.observed })),
              }
            : undefined;

        submitEvaluation(
          goalMet,
          score,
          metrics,
          { challengeResults },
          undefined,
          diagnosisEvidence,
        );
      }
      return;
    }

    // Reset domain state for next challenge
    setSelectedObject(null);
    setSelectedAttribute(null);
    setOrderSelection([]);
    setNonStandardAnswer('');
    setFeedback('');
    setFeedbackType('');
    setShowCorrectAnswer(false);

    const nextChallenge = challenges[currentChallengeIndex + 1];
    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
      + `"${nextChallenge?.instruction}". Introduce it briefly.`,
      { silent: true },
    );
  }, [
    advanceProgress, phaseResults, challenges, challengeResults, currentChallengeIndex,
    hasSubmittedEvaluation, submitEvaluation, sendText,
  ]);

  // -------------------------------------------------------------------------
  // Render Helpers
  // -------------------------------------------------------------------------
  const renderObjectVisuals = useCallback(() => {
    if (!currentChallenge) return null;
    const { attribute, objects, type } = currentChallenge;

    // Non-standard: special rendering with measurement units
    if (type === 'non_standard' && objects[0]) {
      return renderNonStandardMeasure(
        objects[0],
        currentChallenge.unitName ?? 'unit',
        currentChallenge.unitCount ?? 5,
        currentChallenge.showUnitNumbers ?? true,
      );
    }

    // Weight: 2-pan seesaw for exactly 2 objects (compare_two), 3-platform scales
    // for 3+ objects (order_three). A seesaw can't meaningfully render 3 weights.
    if (attribute === 'weight' && objects.length === 2) {
      return renderWeightObject(objects[0], 0, objects);
    }
    if (attribute === 'weight' && objects.length >= 3) {
      return renderThreeScaleWeights(
        objects,
        currentChallenge.weightUnit ?? 'lbs',
        currentChallenge.showScaleReadout ?? true,
      );
    }

    switch (attribute) {
      case 'length':
        return (
          <div className="flex flex-col gap-4 w-full">
            {objects.map((obj, i) => renderLengthObject(obj, i, 280))}
          </div>
        );
      case 'height':
        return (
          <div className="flex items-end justify-center gap-8">
            {objects.map((obj, i) => renderHeightObject(obj, i, 160))}
          </div>
        );
      case 'capacity':
        return (
          <div className="flex items-end justify-center gap-8">
            {objects.map((obj, i) => renderCapacityObject(obj, i, 140))}
          </div>
        );
      default:
        return (
          <div className="flex flex-col gap-4 w-full">
            {objects.map((obj, i) => renderLengthObject(obj, i, 280))}
          </div>
        );
    }
  }, [currentChallenge]);

  const renderInteraction = useCallback(() => {
    if (!currentChallenge) return null;

    switch (currentChallenge.type) {
      case 'identify_attribute':
        return (
          <div className="flex flex-wrap gap-2 justify-center">
            {(currentChallenge.attributeOptions ?? ['length', 'height', 'weight', 'capacity']).map(attr => (
              <Button
                key={attr}
                variant="ghost"
                className={`px-4 py-2 border transition-all ${
                  selectedAttribute === attr
                    ? 'bg-blue-500/30 border-blue-400 text-blue-200'
                    : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                }`}
                onClick={() => handleAttributeSelect(attr)}
                disabled={showCorrectAnswer}
              >
                {attr.charAt(0).toUpperCase() + attr.slice(1)}
              </Button>
            ))}
          </div>
        );

      case 'compare_two':
        return (
          <div className="flex flex-wrap gap-3 justify-center">
            {currentChallenge.objects.map(obj => (
              <Button
                key={obj.name}
                variant="ghost"
                className={`px-5 py-3 border transition-all text-base ${
                  selectedObject === obj.name
                    ? 'bg-blue-500/30 border-blue-400 text-blue-200 ring-2 ring-blue-400/50'
                    : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                }`}
                onClick={() => handleObjectSelect(obj.name)}
                disabled={showCorrectAnswer}
              >
                {obj.name}
              </Button>
            ))}
          </div>
        );

      case 'order_three':
        return (
          <div className="flex flex-col items-center gap-3">
            <p className="text-slate-400 text-sm">
              Tap objects in order ({orderSelection.length}/{currentChallenge.objects.length})
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              {currentChallenge.objects.map(obj => {
                const orderIndex = orderSelection.indexOf(obj.name);
                const isSelected = orderIndex !== -1;
                return (
                  <Button
                    key={obj.name}
                    variant="ghost"
                    className={`px-5 py-3 border transition-all relative ${
                      isSelected
                        ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200'
                        : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                    }`}
                    onClick={() => handleOrderSelect(obj.name)}
                    disabled={showCorrectAnswer}
                  >
                    {isSelected && (
                      <Badge className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs px-1.5">
                        {orderIndex + 1}
                      </Badge>
                    )}
                    {obj.name}
                  </Button>
                );
              })}
            </div>
          </div>
        );

      case 'non_standard':
        return (
          <div className="flex items-center gap-3 justify-center">
            <span className="text-slate-300 text-sm">
              How many {currentChallenge.unitName}s?
            </span>
            <LuminaInput
              type="number"
              inputMode="numeric"
              value={nonStandardAnswer}
              onChange={e => setNonStandardAnswer(e.target.value)}
              className="w-20 text-center text-lg"
              disabled={showCorrectAnswer}
              min={0}
              max={20}
            />
          </div>
        );

      default:
        return null;
    }
  }, [
    currentChallenge, selectedObject, selectedAttribute, orderSelection, nonStandardAnswer,
    showCorrectAnswer, handleObjectSelect, handleAttributeSelect, handleOrderSelect,
  ]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (challenges.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardHeader>
          <LuminaCardTitle>{title}</LuminaCardTitle>
        </LuminaCardHeader>
        <LuminaCardContent>
          <p className="text-slate-400">No challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const localOverallScore = challenges.length > 0
    ? Math.round((challengeResults.filter(r => r.correct).length / challenges.length) * 100)
    : 0;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-xl">{title}</LuminaCardTitle>
          {challenges.length > 1 && (
            <LuminaBadge>
              {Math.min(currentChallengeIndex + 1, challenges.length)} / {challenges.length}
            </LuminaBadge>
          )}
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-6">
        {/* Summary panel when complete */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Comparison Complete!"
            celebrationMessage="You compared all the objects!"
            className="mb-6"
          />
        )}

        {/* Active challenge */}
        {!allChallengesComplete && currentChallenge && (
          <>
            {/* Attribute badge */}
            <div className="flex items-center gap-2">
              <Badge className={`bg-gradient-to-r ${ATTRIBUTE_COLORS[currentChallenge.attribute] ?? ATTRIBUTE_COLORS.length} text-white border-0`}>
                {currentChallenge.attribute.charAt(0).toUpperCase() + currentChallenge.attribute.slice(1)}
              </Badge>
              <LuminaBadge>
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.icon} {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.label}
              </LuminaBadge>
            </div>

            {/* Instruction */}
            <p className="text-slate-100 text-lg font-medium text-center">
              {currentChallenge.instruction}
            </p>

            {/* Visual display */}
            <div className="flex justify-center py-4">
              <LuminaPanel className="w-full max-w-md flex justify-center p-6">
                {renderObjectVisuals()}
              </LuminaPanel>
            </div>

            {/* Interaction area */}
            <div className="py-2">
              {renderInteraction()}
            </div>

            {/* Feedback */}
            {feedback && (
              <div className={`text-center py-2 px-4 rounded-lg ${
                feedbackType === 'success'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
              }`}>
                {feedback}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-center gap-3">
              {!showCorrectAnswer ? (
                <LuminaActionButton action="check" onClick={handleCheckAnswer} />
              ) : (
                <LuminaActionButton action="next" onClick={advanceToNextChallenge}>
                  {currentChallengeIndex + 1 < challenges.length ? 'Next Challenge' : 'See Results'}
                </LuminaActionButton>
              )}
            </div>
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default CompareObjects;
