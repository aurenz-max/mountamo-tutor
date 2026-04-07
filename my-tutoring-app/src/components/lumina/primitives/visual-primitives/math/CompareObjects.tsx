'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { CompareObjectsMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

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
  identify_attribute: { label: 'Identify', icon: '\uD83D\uDD0D', accentColor: 'purple' },
  compare_two: { label: 'Compare', icon: '\u2696\uFE0F', accentColor: 'blue' },
  order_three: { label: 'Order', icon: '\uD83D\uDCCA', accentColor: 'emerald' },
  non_standard: { label: 'Measure', icon: '\uD83D\uDCCF', accentColor: 'amber' },
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
  const tiltDirection = diff > 0 ? 1 : diff < 0 ? -1 : 0;

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

function renderNonStandardMeasure(obj: CompareObject, unitName: string, unitCount: number) {
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
              <span className="text-[10px] text-cyan-300">{i + 1}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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
      + `Introduce warmly: "Let's look at some objects and figure out which is bigger, longer, or heavier!"`,
      { silent: true },
    );
  }, [isConnected, challenges.length, gradeBand, currentChallenge, sendText]);

  // -------------------------------------------------------------------------
  // Interaction Handlers
  // -------------------------------------------------------------------------
  const handleObjectSelect = useCallback((objectName: string) => {
    if (hasSubmittedEvaluation || showCorrectAnswer) return;
    setSelectedObject(objectName);
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation, showCorrectAnswer]);

  const handleAttributeSelect = useCallback((attr: string) => {
    if (hasSubmittedEvaluation || showCorrectAnswer) return;
    setSelectedAttribute(attr);
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation, showCorrectAnswer]);

  const handleOrderSelect = useCallback((objectName: string) => {
    if (hasSubmittedEvaluation || showCorrectAnswer) return;
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
          sendText(
            `[ANSWER_INCORRECT] Student chose "${selectedAttribute}" but correct attribute is "${currentChallenge.correctAttribute}". Give a hint about what's different between these objects.`,
            { silent: true },
          );
        }
        break;
      }
      case 'compare_two': {
        if (!selectedObject) {
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
          sendText(
            `[ANSWER_INCORRECT] Student chose "${selectedObject}" but "${currentChallenge.correctAnswer}" is ${currentChallenge.comparisonWord}. Hint: "${currentChallenge.hint}".`,
            { silent: true },
          );
        }
        break;
      }
      case 'order_three': {
        if (orderSelection.length !== (currentChallenge.objects?.length ?? 3)) {
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
          setOrderSelection([]);
          sendText(
            `[ANSWER_INCORRECT] Student ordered: ${orderSelection.join(', ')} but correct is: ${correctOrder.join(', ')}. Hint: "${currentChallenge.hint}".`,
            { silent: true },
          );
        }
        break;
      }
      case 'non_standard': {
        const answer = parseInt(nonStandardAnswer, 10);
        if (isNaN(answer)) {
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
          sendText(
            `[ANSWER_INCORRECT] Student answered ${answer} but correct is ${currentChallenge.unitCount} ${currentChallenge.unitName}s. Give a counting hint.`,
            { silent: true },
          );
        }
        break;
      }
    }

    if (correct) {
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
      setShowCorrectAnswer(true);
    } else if (currentAttempts + 1 >= 3) {
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
  }, [
    currentChallenge, selectedObject, selectedAttribute, orderSelection, nonStandardAnswer,
    currentAttempts, incrementAttempts, recordResult, sendText, hasSubmittedEvaluation, showCorrectAnswer,
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

        submitEvaluation(
          totalCorrect === challenges.length,
          score,
          metrics,
          { challengeResults },
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
      );
    }

    // Weight: seesaw (renders both objects together)
    if (attribute === 'weight' && objects.length >= 2) {
      return renderWeightObject(objects[0], 0, objects);
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
            <input
              type="number"
              value={nonStandardAnswer}
              onChange={e => setNonStandardAnswer(e.target.value)}
              className="w-20 px-3 py-2 bg-slate-800/60 border border-white/20 rounded-lg text-slate-100 text-center text-lg focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
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
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className ?? ''}`}>
        <CardHeader>
          <CardTitle className="text-slate-100">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-400">No challenges available.</p>
        </CardContent>
      </Card>
    );
  }

  const localOverallScore = challenges.length > 0
    ? Math.round((challengeResults.filter(r => r.correct).length / challenges.length) * 100)
    : 0;

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className ?? ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-xl">{title}</CardTitle>
          {challenges.length > 1 && (
            <Badge className="bg-white/10 text-slate-300 border-white/20">
              {Math.min(currentChallengeIndex + 1, challenges.length)} / {challenges.length}
            </Badge>
          )}
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </CardHeader>

      <CardContent className="space-y-6">
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
              <Badge className="bg-white/10 text-slate-400 border-white/10">
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.icon} {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.label}
              </Badge>
            </div>

            {/* Instruction */}
            <p className="text-slate-100 text-lg font-medium text-center">
              {currentChallenge.instruction}
            </p>

            {/* Visual display */}
            <div className="flex justify-center py-4">
              <div className="bg-slate-800/40 rounded-xl p-6 border border-white/5 w-full max-w-md flex justify-center">
                {renderObjectVisuals()}
              </div>
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
                <Button
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100 px-6"
                  onClick={handleCheckAnswer}
                >
                  Check Answer
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  className="bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 text-emerald-200 px-6"
                  onClick={advanceToNextChallenge}
                >
                  {currentChallengeIndex + 1 < challenges.length ? 'Next Challenge' : 'See Results'}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CompareObjects;
