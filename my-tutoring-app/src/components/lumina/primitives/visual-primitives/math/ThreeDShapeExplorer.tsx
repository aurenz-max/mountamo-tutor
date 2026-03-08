'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { ThreeDShapeExplorerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface ThreeDShapeExplorerChallenge {
  id: string;
  type: 'identify-3d' | '2d-vs-3d' | 'match-to-real-world' | 'faces-and-properties' | 'shape-riddle';
  instruction: string;
  // identify-3d
  shape3d?: string;
  options?: string[];
  // 2d-vs-3d
  mixedShapes?: Array<{ name: string; emoji: string; is3d: boolean }>;
  // match-to-real-world
  matchPairs?: Array<{ realWorldObject: string; emoji: string; shape3d: string }>;
  // faces-and-properties
  displayShape?: string;
  properties?: {
    flatFaces: number;
    curvedSurfaces: number;
    faceShapes: string[];
    canRoll: boolean;
    canStack: boolean;
    canSlide: boolean;
  };
  propertyQuestions?: Array<{
    question: string;
    answerType: 'boolean' | 'number' | 'choice';
    correctAnswer: string | number | boolean;
    options?: string[];  // for 'choice' type
  }>;
  // shape-riddle (reuses shape3d + options from identify-3d)
  clues?: string[];
}

export interface ThreeDShapeExplorerData {
  title: string;
  description?: string;
  challenges: ThreeDShapeExplorerChallenge[];
  gradeBand?: 'K' | '1';
  showUnfoldAnimation?: boolean;
  show3dRotation?: boolean;

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ThreeDShapeExplorerMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'identify-3d':        { label: 'Identify 3D',       icon: '🔷', accentColor: 'blue' },
  '2d-vs-3d':           { label: '2D vs 3D',          icon: '📐', accentColor: 'purple' },
  'match-to-real-world': { label: 'Real World Match', icon: '🌍', accentColor: 'emerald' },
  'faces-and-properties': { label: 'Properties',      icon: '🔍', accentColor: 'amber' },
  'shape-riddle':       { label: 'Shape Riddle',        icon: '🔎', accentColor: 'cyan' },
};

const SHAPE_LABELS: Record<string, string> = {
  cube: 'Cube',
  sphere: 'Sphere',
  cylinder: 'Cylinder',
  cone: 'Cone',
  'rectangular-prism': 'Rectangular Prism',
};

// ============================================================================
// SVG 3D Shape Renderer
// ============================================================================

function Shape3DSVG({ shape, size = 120, className }: { shape: string; size?: number; className?: string }) {
  const cx = size / 2;
  const cy = size / 2;
  const s = size * 0.35; // scale factor

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className}>
      <defs>
        <radialGradient id={`sphere-grad-${size}`} cx="35%" cy="30%">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="70%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </radialGradient>
        <linearGradient id={`cube-top-${size}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id={`cube-left-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#5b21b6" />
        </linearGradient>
        <linearGradient id={`cube-right-${size}`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#6d28d9" />
          <stop offset="100%" stopColor="#4c1d95" />
        </linearGradient>
        <linearGradient id={`cyl-body-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="50%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
        <linearGradient id={`cone-body-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id={`prism-top-${size}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        <linearGradient id={`prism-left-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#be185d" />
        </linearGradient>
        <linearGradient id={`prism-right-${size}`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#db2777" />
          <stop offset="100%" stopColor="#9d174d" />
        </linearGradient>
      </defs>

      {shape === 'sphere' && (
        <>
          <circle cx={cx} cy={cy} r={s} fill={`url(#sphere-grad-${size})`} />
          <ellipse cx={cx} cy={cy} rx={s} ry={s * 0.15}
            fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="4 3" />
          <ellipse cx={cx - s * 0.15} cy={cy - s * 0.2} rx={s * 0.15} ry={s * 0.08}
            fill="rgba(255,255,255,0.25)" />
        </>
      )}

      {shape === 'cube' && (() => {
        const h = s * 0.8;
        const dx = s * 0.5;
        const dy = s * 0.3;
        // top face
        const top = `M${cx},${cy - h} L${cx + dx},${cy - h + dy} L${cx},${cy - h + 2 * dy} L${cx - dx},${cy - h + dy} Z`;
        // left face
        const left = `M${cx - dx},${cy - h + dy} L${cx},${cy - h + 2 * dy} L${cx},${cy + dy} L${cx - dx},${cy} Z`;
        // right face
        const right = `M${cx + dx},${cy - h + dy} L${cx},${cy - h + 2 * dy} L${cx},${cy + dy} L${cx + dx},${cy} Z`;
        return (
          <>
            <path d={left} fill={`url(#cube-left-${size})`} />
            <path d={right} fill={`url(#cube-right-${size})`} />
            <path d={top} fill={`url(#cube-top-${size})`} />
            <path d={left} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
            <path d={right} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
            <path d={top} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
          </>
        );
      })()}

      {shape === 'cylinder' && (() => {
        const rh = s * 0.7; // horizontal radius
        const rv = s * 0.2;  // vertical radius of ellipses
        const bodyH = s * 1.0;
        const topY = cy - bodyH / 2;
        const botY = cy + bodyH / 2;
        return (
          <>
            <rect x={cx - rh} y={topY} width={rh * 2} height={bodyH}
              fill={`url(#cyl-body-${size})`} />
            <ellipse cx={cx} cy={botY} rx={rh} ry={rv} fill="#0f766e" />
            <ellipse cx={cx} cy={botY} rx={rh} ry={rv} fill="none"
              stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
            <ellipse cx={cx} cy={topY} rx={rh} ry={rv} fill="#5eead4" />
            <ellipse cx={cx} cy={topY} rx={rh} ry={rv} fill="none"
              stroke="rgba(255,255,255,0.2)" strokeWidth={0.5} />
          </>
        );
      })()}

      {shape === 'cone' && (() => {
        const rh = s * 0.7;
        const rv = s * 0.2;
        const botY = cy + s * 0.5;
        const tipY = cy - s * 0.8;
        return (
          <>
            <path d={`M${cx - rh},${botY} Q${cx},${botY + rv * 2} ${cx + rh},${botY} L${cx},${tipY} Z`}
              fill={`url(#cone-body-${size})`} />
            <ellipse cx={cx} cy={botY} rx={rh} ry={rv} fill="#92400e" />
            <ellipse cx={cx} cy={botY} rx={rh} ry={rv} fill="none"
              stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
            <line x1={cx} y1={tipY} x2={cx - rh} y2={botY}
              stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} />
            <line x1={cx} y1={tipY} x2={cx + rh} y2={botY}
              stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} />
          </>
        );
      })()}

      {shape === 'rectangular-prism' && (() => {
        const w = s * 0.6;
        const h = s * 0.5;
        const dx = s * 0.4;
        const dy = s * 0.25;
        const top = `M${cx - w + dx},${cy - h} L${cx + dx},${cy - h} L${cx + dx - dx},${cy - h + dy} L${cx - w},${cy - h + dy} Z`;
        const left = `M${cx - w},${cy - h + dy} L${cx - w + dx},${cy - h} L${cx - w + dx},${cy + h - dy} L${cx - w},${cy + h} Z`;
        const front = `M${cx - w},${cy - h + dy} L${cx},${cy - h + dy} L${cx},${cy + h} L${cx - w},${cy + h} Z`;
        const right = `M${cx},${cy - h + dy} L${cx + dx},${cy - h} L${cx + dx},${cy + h - dy} L${cx},${cy + h} Z`;
        const topFace = `M${cx - w + dx},${cy - h} L${cx + dx},${cy - h} L${cx},${cy - h + dy} L${cx - w},${cy - h + dy} Z`;
        return (
          <>
            <path d={front} fill={`url(#prism-left-${size})`} />
            <path d={right} fill={`url(#prism-right-${size})`} />
            <path d={topFace} fill={`url(#prism-top-${size})`} />
            <path d={front} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
            <path d={right} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
            <path d={topFace} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
          </>
        );
      })()}
    </svg>
  );
}

// 2D shape renderer for the 2d-vs-3d sorting
function Shape2DSVG({ shape, size = 60 }: { shape: string; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.35;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {shape === 'circle' && <circle cx={cx} cy={cy} r={r} fill="#60a5fa" stroke="#93c5fd" strokeWidth={1.5} />}
      {shape === 'square' && <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill="#a78bfa" stroke="#c4b5fd" strokeWidth={1.5} />}
      {shape === 'triangle' && (
        <polygon points={`${cx},${cy - r} ${cx + r},${cy + r} ${cx - r},${cy + r}`} fill="#34d399" stroke="#6ee7b7" strokeWidth={1.5} />
      )}
      {shape === 'rectangle' && <rect x={cx - r * 1.3} y={cy - r * 0.7} width={r * 2.6} height={r * 1.4} fill="#f472b6" stroke="#f9a8d4" strokeWidth={1.5} />}
    </svg>
  );
}

// ============================================================================
// Props
// ============================================================================

interface ThreeDShapeExplorerProps {
  data: ThreeDShapeExplorerData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const ThreeDShapeExplorer: React.FC<ThreeDShapeExplorerProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    gradeBand = 'K',
    show3dRotation = true,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── State ──────────────────────────────────────────────────────
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

  const currentChallenge = challenges[currentChallengeIndex] ?? null;

  // Challenge-specific state
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [sortedShapes, setSortedShapes] = useState<Map<string, '2d' | '3d'>>(new Map());
  const [matchSelections, setMatchSelections] = useState<Map<string, string>>(new Map());
  const [selectedMatchObject, setSelectedMatchObject] = useState<string | null>(null);
  const [propertyAnswers, setPropertyAnswers] = useState<Map<number, string | number | boolean>>(new Map());
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');

  // Shuffle the right-side shapes so positional matching doesn't give away answers
  const shuffledMatchShapes = useMemo(() => {
    if (currentChallenge?.type !== 'match-to-real-world' || !currentChallenge.matchPairs) return [];
    const unique = Array.from(new Set(currentChallenge.matchPairs.map(p => p.shape3d)));
    // Fisher-Yates shuffle
    const arr = [...unique];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [currentChallenge?.id]);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `3d-shape-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Evaluation ─────────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<ThreeDShapeExplorerMetrics>({
    primitiveType: '3d-shape-explorer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── AI Tutoring ────────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    gradeBand,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    challengeType: currentChallenge?.type ?? 'identify-3d',
    shape3d: currentChallenge?.shape3d ?? currentChallenge?.displayShape ?? '',
    displayShape: currentChallenge?.displayShape ?? '',
    properties: currentChallenge?.properties ?? null,
    attemptNumber: currentAttempts + 1,
    instruction: currentChallenge?.instruction ?? '',
  }), [
    gradeBand, challenges.length, currentChallengeIndex, currentChallenge, currentAttempts,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: '3d-shape-explorer',
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
      `[ACTIVITY_START] 3D Shape Explorer for ${gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}. `
      + `${challenges.length} challenges covering 3D shape identification, sorting, matching, properties, and comparison. `
      + `First challenge: "${currentChallenge?.instruction}". `
      + `Introduce warmly: "Today we're going to explore solid shapes — shapes you can hold in your hand!"`,
      { silent: true }
    );
  }, [isConnected, challenges.length, gradeBand, currentChallenge, sendText]);

  // ── Reset state on challenge change ────────────────────────────
  const resetChallengeState = useCallback(() => {
    setSelectedOption(null);
    setSortedShapes(new Map());
    setMatchSelections(new Map());
    setSelectedMatchObject(null);
    setPropertyAnswers(new Map());
    setFeedback('');
    setFeedbackType('');
  }, []);

  // ── Check Handlers ─────────────────────────────────────────────

  const checkIdentify3D = useCallback(() => {
    if (!currentChallenge || !selectedOption) return false;
    const correct = selectedOption.toLowerCase() === currentChallenge.shape3d?.toLowerCase();
    incrementAttempts();

    if (correct) {
      setFeedback(`Yes! That's a ${SHAPE_LABELS[currentChallenge.shape3d || ''] || currentChallenge.shape3d}!`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student correctly identified "${currentChallenge.shape3d}". `
        + `Congratulate: "Great job! You know your 3D shapes!"`,
        { silent: true }
      );
    } else {
      setFeedback(`Not quite. Look at the shape carefully and try again!`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student chose "${selectedOption}" but correct is "${currentChallenge.shape3d}". `
        + `Attempt ${currentAttempts + 1}. Give a hint about the shape's features without revealing the answer.`,
        { silent: true }
      );
    }
    return correct;
  }, [currentChallenge, selectedOption, currentAttempts, sendText, incrementAttempts]);

  const check2DVs3D = useCallback(() => {
    if (!currentChallenge?.mixedShapes) return false;
    incrementAttempts();
    const allShapes = currentChallenge.mixedShapes;
    let allCorrect = true;

    for (const shape of allShapes) {
      const sorted = sortedShapes.get(shape.name);
      const expected = shape.is3d ? '3d' : '2d';
      if (sorted !== expected) {
        allCorrect = false;
        break;
      }
    }

    if (allCorrect) {
      setFeedback('Perfect! You sorted all shapes correctly!');
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student correctly sorted all shapes into 2D and 3D. `
        + `Celebrate: "Amazing! You can tell flat shapes from solid shapes!"`,
        { silent: true }
      );
    } else {
      const unsorted = allShapes.filter(s => !sortedShapes.has(s.name));
      const misplaced = allShapes.filter(s => {
        const sorted = sortedShapes.get(s.name);
        return sorted && sorted !== (s.is3d ? '3d' : '2d');
      });
      setFeedback(
        unsorted.length > 0
          ? `Sort all shapes first! ${unsorted.length} still unsorted.`
          : `Some shapes are in the wrong group. Remember: flat shapes are 2D, solid shapes are 3D!`
      );
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Sorting errors. Misplaced: ${misplaced.map(s => s.name).join(', ')}. `
        + `Unsorted: ${unsorted.map(s => s.name).join(', ')}. `
        + `Hint: "Can you pick up a circle? No, it's flat! But you can hold a sphere — it's solid!"`,
        { silent: true }
      );
    }
    return allCorrect;
  }, [currentChallenge, sortedShapes, sendText, incrementAttempts]);

  const checkMatchToRealWorld = useCallback(() => {
    if (!currentChallenge?.matchPairs) return false;
    incrementAttempts();

    let correctCount = 0;
    for (const pair of currentChallenge.matchPairs) {
      if (matchSelections.get(pair.realWorldObject) === pair.shape3d) {
        correctCount++;
      }
    }

    const allCorrect = correctCount === currentChallenge.matchPairs.length;
    if (allCorrect) {
      setFeedback('All matched! You know your real-world shapes!');
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student matched all real-world objects to their 3D shapes correctly. `
        + `Celebrate: "You can see shapes everywhere in the real world!"`,
        { silent: true }
      );
    } else {
      const unmatched = currentChallenge.matchPairs.filter(p => !matchSelections.has(p.realWorldObject));
      setFeedback(
        unmatched.length > 0
          ? `Match all objects first! ${unmatched.length} left.`
          : `${correctCount} of ${currentChallenge.matchPairs.length} correct. Try looking at the shape of each object again!`
      );
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] ${correctCount}/${currentChallenge.matchPairs.length} correct. `
        + `Give a hint connecting a real-world object to its shape.`,
        { silent: true }
      );
    }
    return allCorrect;
  }, [currentChallenge, matchSelections, sendText, incrementAttempts]);

  const checkFacesAndProperties = useCallback(() => {
    if (!currentChallenge?.propertyQuestions) return false;
    incrementAttempts();

    let correctCount = 0;
    for (let i = 0; i < currentChallenge.propertyQuestions.length; i++) {
      const q = currentChallenge.propertyQuestions[i];
      const answer = propertyAnswers.get(i);
      if (answer === undefined) continue;

      if (q.answerType === 'boolean') {
        const expected = typeof q.correctAnswer === 'string'
          ? q.correctAnswer === 'true'
          : !!q.correctAnswer;
        if (answer === expected) correctCount++;
      } else if (q.answerType === 'number') {
        if (Number(answer) === Number(q.correctAnswer)) correctCount++;
      } else {
        if (String(answer).toLowerCase() === String(q.correctAnswer).toLowerCase()) correctCount++;
      }
    }

    const total = currentChallenge.propertyQuestions.length;
    const allCorrect = correctCount === total;

    if (allCorrect) {
      setFeedback(`Perfect! You know all about the ${SHAPE_LABELS[currentChallenge.displayShape || ''] || currentChallenge.displayShape}!`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student answered all ${total} property questions for "${currentChallenge.displayShape}" correctly. `
        + `Celebrate their knowledge of 3D shape properties!`,
        { silent: true }
      );
    } else {
      const unanswered = total - propertyAnswers.size;
      setFeedback(
        unanswered > 0
          ? `Answer all questions first! ${unanswered} left.`
          : `${correctCount} of ${total} correct. Think about the shape's flat faces and curved parts!`
      );
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] ${correctCount}/${total} correct for "${currentChallenge.displayShape}". `
        + `Attempt ${currentAttempts + 1}. Give a specific hint about one wrong property.`,
        { silent: true }
      );
    }
    return allCorrect;
  }, [currentChallenge, propertyAnswers, currentAttempts, sendText, incrementAttempts]);

  const checkShapeRiddle = useCallback(() => {
    if (!currentChallenge || !selectedOption) return false;
    const correct = selectedOption.toLowerCase() === currentChallenge.shape3d?.toLowerCase();
    incrementAttempts();

    if (correct) {
      setFeedback(`You solved the riddle! It's a ${SHAPE_LABELS[currentChallenge.shape3d || ''] || currentChallenge.shape3d}!`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student solved the shape riddle — correctly identified "${currentChallenge.shape3d}" from clues. `
        + `Celebrate: "Amazing detective work! You used the clues to find the mystery shape!"`,
        { silent: true }
      );
    } else {
      setFeedback(`Not quite! Read the clues again carefully.`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Shape riddle: student guessed "${selectedOption}" but answer is "${currentChallenge.shape3d}". `
        + `Attempt ${currentAttempts + 1}. Re-read one clue and give a hint without revealing the answer.`,
        { silent: true }
      );
    }
    return correct;
  }, [currentChallenge, selectedOption, currentAttempts, sendText, incrementAttempts]);

  // ── Main Check Handler ─────────────────────────────────────────
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge || hasSubmittedEvaluation) return;

    let correct = false;
    switch (currentChallenge.type) {
      case 'identify-3d':
        correct = checkIdentify3D();
        break;
      case '2d-vs-3d':
        correct = check2DVs3D();
        break;
      case 'match-to-real-world':
        correct = checkMatchToRealWorld();
        break;
      case 'faces-and-properties':
        correct = checkFacesAndProperties();
        break;
      case 'shape-riddle':
        correct = checkShapeRiddle();
        break;
    }

    if (correct) {
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
    }
  }, [
    currentChallenge, hasSubmittedEvaluation, currentAttempts,
    checkIdentify3D, check2DVs3D, checkMatchToRealWorld, checkFacesAndProperties, checkShapeRiddle,
    recordResult,
  ]);

  // ── Challenge Navigation ───────────────────────────────────────
  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All complete
      const phaseScoreStr = phaseResults
        .map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = Math.round(
        (challengeResults.filter(r => r.correct).length / challenges.length) * 100
      );

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging phase-specific feedback about their 3D shape knowledge!`,
        { silent: true }
      );

      if (!hasSubmittedEvaluation) {
        const correct = challengeResults.filter(r => r.correct).length;
        const accuracy = Math.round((correct / challenges.length) * 100);
        const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);

        const metrics: ThreeDShapeExplorerMetrics = {
          type: '3d-shape-explorer',
          identificationAccuracy: accuracy,
          propertyKnowledge: accuracy >= 80,
          realWorldConnections: accuracy >= 70,
          attemptsCount: totalAttempts,
        };

        submitEvaluation(correct === challenges.length, accuracy, metrics, { challengeResults });
      }
      return;
    }

    resetChallengeState();
    const nextChallenge = challenges[currentChallengeIndex + 1];
    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
      + `"${nextChallenge.instruction}" (type: ${nextChallenge.type}). Introduce it briefly.`,
      { silent: true }
    );
  }, [
    advanceProgress, phaseResults, challenges, challengeResults, sendText,
    hasSubmittedEvaluation, submitEvaluation, resetChallengeState, currentChallengeIndex,
  ]);

  // Auto-submit on complete
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      advanceToNextChallenge();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, advanceToNextChallenge]);

  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct
  );

  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    return Math.round((challengeResults.filter(r => r.correct).length / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  // ── Sorting handler (2d-vs-3d) ────────────────────────────────
  const handleSort = useCallback((shapeName: string, bin: '2d' | '3d') => {
    if (hasSubmittedEvaluation || isCurrentChallengeComplete) return;
    setSortedShapes(prev => {
      const next = new Map(prev);
      if (next.get(shapeName) === bin) {
        next.delete(shapeName);
      } else {
        next.set(shapeName, bin);
      }
      return next;
    });
  }, [hasSubmittedEvaluation, isCurrentChallengeComplete]);

  // ── Matching handler ──────────────────────────────────────────
  const handleMatchSelect = useCallback((shape3d: string) => {
    if (!selectedMatchObject || hasSubmittedEvaluation || isCurrentChallengeComplete) return;
    setMatchSelections(prev => {
      const next = new Map(prev);
      next.set(selectedMatchObject, shape3d);
      return next;
    });
    setSelectedMatchObject(null);
  }, [selectedMatchObject, hasSubmittedEvaluation, isCurrentChallengeComplete]);

  // ── Property answer handler ───────────────────────────────────
  const handlePropertyAnswer = useCallback((qIndex: number, answer: string | number | boolean) => {
    if (hasSubmittedEvaluation || isCurrentChallengeComplete) return;
    setPropertyAnswers(prev => {
      const next = new Map(prev);
      next.set(qIndex, answer);
      return next;
    });
  }, [hasSubmittedEvaluation, isCurrentChallengeComplete]);

  // ── Can check? ─────────────────────────────────────────────────
  const canCheck = useMemo(() => {
    if (!currentChallenge || isCurrentChallengeComplete || hasSubmittedEvaluation) return false;
    switch (currentChallenge.type) {
      case 'identify-3d': return !!selectedOption;
      case '2d-vs-3d': return sortedShapes.size === (currentChallenge.mixedShapes?.length ?? 0);
      case 'match-to-real-world': return matchSelections.size === (currentChallenge.matchPairs?.length ?? 0);
      case 'faces-and-properties': return propertyAnswers.size === (currentChallenge.propertyQuestions?.length ?? 0);
      case 'shape-riddle': return !!selectedOption;
      default: return false;
    }
  }, [
    currentChallenge, isCurrentChallengeComplete, hasSubmittedEvaluation,
    selectedOption, sortedShapes, matchSelections, propertyAnswers,
  ]);

  // ── Render ─────────────────────────────────────────────────────
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <Badge className="bg-slate-800/50 border-slate-700/50 text-blue-300 text-xs">
            {gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}
          </Badge>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress */}
        {challenges.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(CHALLENGE_TYPE_CONFIG).map(([type, config]) => {
              const hasType = challenges.some(c => c.type === type);
              if (!hasType) return null;
              return (
                <Badge
                  key={type}
                  className={`text-xs ${
                    currentChallenge?.type === type
                      ? 'bg-blue-500/20 border-blue-400/50 text-blue-300'
                      : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
                  }`}
                >
                  {config.icon} {config.label}
                </Badge>
              );
            })}
            <span className="text-slate-500 text-xs ml-auto">
              {Math.min(currentChallengeIndex + 1, challenges.length)} / {challenges.length}
            </span>
          </div>
        )}

        {/* Instruction */}
        {currentChallenge && !allChallengesComplete && (
          <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
            <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>
          </div>
        )}

        {/* ── Challenge-specific UI ──────────────────── */}
        {currentChallenge && !allChallengesComplete && (
          <>
            {/* IDENTIFY-3D */}
            {currentChallenge.type === 'identify-3d' && currentChallenge.shape3d && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className={`${show3dRotation ? 'animate-pulse' : ''}`}
                    style={show3dRotation ? { animation: 'spin 8s linear infinite', animationName: undefined } : undefined}
                  >
                    <Shape3DSVG shape={currentChallenge.shape3d} size={160} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
                  {currentChallenge.options?.map(opt => (
                    <Button
                      key={opt}
                      variant="ghost"
                      className={`border ${
                        selectedOption === opt
                          ? 'bg-blue-500/20 border-blue-400/50 text-blue-200'
                          : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                      }`}
                      onClick={() => setSelectedOption(opt)}
                      disabled={isCurrentChallengeComplete}
                    >
                      {SHAPE_LABELS[opt] || opt}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* 2D VS 3D */}
            {currentChallenge.type === '2d-vs-3d' && currentChallenge.mixedShapes && (
              <div className="space-y-4">
                {/* Bins */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/30 rounded-lg p-3 border border-purple-500/20 min-h-[100px]">
                    <p className="text-purple-300 text-xs font-medium mb-2 text-center">Flat Shapes (2D)</p>
                    <div className="flex flex-wrap gap-1 justify-center">
                      {currentChallenge.mixedShapes.filter(s => sortedShapes.get(s.name) === '2d').map(s => (
                        <Badge key={s.name} className="bg-purple-500/20 border-purple-400/30 text-purple-200 text-xs cursor-pointer"
                          onClick={() => handleSort(s.name, '2d')}>
                          {s.emoji} {s.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="bg-slate-800/30 rounded-lg p-3 border border-blue-500/20 min-h-[100px]">
                    <p className="text-blue-300 text-xs font-medium mb-2 text-center">Solid Shapes (3D)</p>
                    <div className="flex flex-wrap gap-1 justify-center">
                      {currentChallenge.mixedShapes.filter(s => sortedShapes.get(s.name) === '3d').map(s => (
                        <Badge key={s.name} className="bg-blue-500/20 border-blue-400/30 text-blue-200 text-xs cursor-pointer"
                          onClick={() => handleSort(s.name, '3d')}>
                          {s.emoji} {s.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Unsorted shapes */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {currentChallenge.mixedShapes.filter(s => !sortedShapes.has(s.name)).map(s => (
                    <div key={s.name} className="flex flex-col items-center gap-1">
                      <span className="text-2xl">{s.emoji}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm"
                          className="bg-purple-500/10 border border-purple-400/30 hover:bg-purple-500/20 text-purple-300 text-xs px-2 py-0.5 h-auto"
                          onClick={() => handleSort(s.name, '2d')}>
                          2D
                        </Button>
                        <Button variant="ghost" size="sm"
                          className="bg-blue-500/10 border border-blue-400/30 hover:bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 h-auto"
                          onClick={() => handleSort(s.name, '3d')}>
                          3D
                        </Button>
                      </div>
                      <span className="text-slate-400 text-xs">{s.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MATCH TO REAL WORLD */}
            {currentChallenge.type === 'match-to-real-world' && currentChallenge.matchPairs && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Objects column */}
                  <div className="space-y-2">
                    <p className="text-slate-400 text-xs font-medium text-center mb-1">Real-World Objects</p>
                    {currentChallenge.matchPairs.map(pair => {
                      const matched = matchSelections.get(pair.realWorldObject);
                      return (
                        <Button
                          key={pair.realWorldObject}
                          variant="ghost"
                          className={`w-full border ${
                            selectedMatchObject === pair.realWorldObject
                              ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                              : matched
                              ? 'bg-slate-700/30 border-slate-600/30 text-slate-400'
                              : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                          }`}
                          onClick={() => setSelectedMatchObject(
                            selectedMatchObject === pair.realWorldObject ? null : pair.realWorldObject
                          )}
                          disabled={isCurrentChallengeComplete}
                        >
                          <span className="mr-2">{pair.emoji}</span>
                          {pair.realWorldObject}
                          {matched && <span className="ml-1 text-xs text-slate-500">→ {SHAPE_LABELS[matched] || matched}</span>}
                        </Button>
                      );
                    })}
                  </div>
                  {/* Shapes column */}
                  <div className="space-y-2">
                    <p className="text-slate-400 text-xs font-medium text-center mb-1">3D Shapes</p>
                    {shuffledMatchShapes.map(shape => (
                      <Button
                        key={shape}
                        variant="ghost"
                        className={`w-full border ${
                          selectedMatchObject
                            ? 'bg-white/5 border-emerald-400/30 hover:bg-emerald-500/10 text-slate-300'
                            : 'bg-white/5 border-white/10 text-slate-500'
                        }`}
                        onClick={() => handleMatchSelect(shape)}
                        disabled={!selectedMatchObject || isCurrentChallengeComplete}
                      >
                        <Shape3DSVG shape={shape} size={28} className="mr-2 inline-block" />
                        {SHAPE_LABELS[shape] || shape}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* FACES AND PROPERTIES */}
            {currentChallenge.type === 'faces-and-properties' && currentChallenge.displayShape && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <Shape3DSVG shape={currentChallenge.displayShape} size={140} />
                </div>
                <p className="text-center text-slate-300 text-sm font-medium">
                  {SHAPE_LABELS[currentChallenge.displayShape] || currentChallenge.displayShape}
                </p>
                <div className="space-y-3 max-w-md mx-auto">
                  {currentChallenge.propertyQuestions?.map((q, i) => (
                    <div key={i} className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
                      <p className="text-slate-200 text-sm mb-2">{q.question}</p>
                      {q.answerType === 'boolean' ? (
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm"
                            className={`border ${propertyAnswers.get(i) === true
                              ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                              : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                            }`}
                            onClick={() => handlePropertyAnswer(i, true)}
                            disabled={isCurrentChallengeComplete}>
                            Yes
                          </Button>
                          <Button variant="ghost" size="sm"
                            className={`border ${propertyAnswers.get(i) === false
                              ? 'bg-red-500/20 border-red-400/50 text-red-200'
                              : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                            }`}
                            onClick={() => handlePropertyAnswer(i, false)}
                            disabled={isCurrentChallengeComplete}>
                            No
                          </Button>
                        </div>
                      ) : q.answerType === 'number' ? (
                        <div className="flex flex-wrap gap-1.5">
                          {[0, 1, 2, 3, 4, 5, 6, 8].map(n => (
                            <Button key={n} variant="ghost" size="sm"
                              className={`border min-w-[36px] ${propertyAnswers.get(i) === n
                                ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                                : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                              }`}
                              onClick={() => handlePropertyAnswer(i, n)}
                              disabled={isCurrentChallengeComplete}>
                              {n}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {(q.options || ['circle', 'square', 'rectangle', 'triangle']).map(opt => (
                            <Button key={opt} variant="ghost" size="sm"
                              className={`border capitalize ${
                                String(propertyAnswers.get(i)).toLowerCase() === opt.toLowerCase()
                                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                                  : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                              }`}
                              onClick={() => handlePropertyAnswer(i, opt)}
                              disabled={isCurrentChallengeComplete}>
                              {opt}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SHAPE RIDDLE */}
            {currentChallenge.type === 'shape-riddle' && currentChallenge.clues && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="bg-slate-800/40 rounded-xl p-5 border border-cyan-500/20 max-w-sm w-full">
                    <p className="text-cyan-300 text-xs font-medium mb-3 text-center">Clues</p>
                    <ul className="space-y-2">
                      {currentChallenge.clues.map((clue, i) => (
                        <li key={i} className="flex items-start gap-2 text-slate-200 text-sm">
                          <span className="text-cyan-400 mt-0.5 shrink-0">{i + 1}.</span>
                          <span>{clue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
                  {currentChallenge.options?.map(opt => (
                    <Button
                      key={opt}
                      variant="ghost"
                      className={`border flex flex-col items-center gap-1 py-3 ${
                        selectedOption === opt
                          ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                          : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                      }`}
                      onClick={() => setSelectedOption(opt)}
                      disabled={isCurrentChallengeComplete}
                    >
                      <Shape3DSVG shape={opt} size={48} />
                      <span className="text-xs">{SHAPE_LABELS[opt] || opt}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium ${
            feedbackType === 'success' ? 'text-emerald-400' :
            feedbackType === 'error' ? 'text-red-400' : 'text-slate-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* Action Buttons */}
        {challenges.length > 0 && (
          <div className="flex justify-center gap-3">
            {!isCurrentChallengeComplete && !allChallengesComplete && (
              <Button
                variant="ghost"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                onClick={handleCheckAnswer}
                disabled={!canCheck}
              >
                Check Answer
              </Button>
            )}
            {isCurrentChallengeComplete && !allChallengesComplete && (
              <Button
                variant="ghost"
                className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
                onClick={advanceToNextChallenge}
              >
                Next Challenge
              </Button>
            )}
            {allChallengesComplete && (
              <div className="text-center">
                <p className="text-emerald-400 text-sm font-medium mb-2">All challenges complete!</p>
                <p className="text-slate-400 text-xs">
                  {challengeResults.filter(r => r.correct).length} / {challenges.length} correct
                </p>
              </div>
            )}
          </div>
        )}

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Shape Explorer Complete!"
            celebrationMessage={`You explored all ${challenges.length} 3D shape challenges!`}
            className="mt-4"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default ThreeDShapeExplorer;
