'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { AdditionSubtractionSceneMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface AddSubChallenge {
  id: string;
  type: 'act-out' | 'build-equation' | 'solve-story' | 'create-story';
  instruction: string;
  storyText: string;
  scene: 'pond' | 'farm' | 'playground' | 'space' | 'kitchen' | 'garden';
  objectType: string;
  operation: 'addition' | 'subtraction';
  storyType: 'join' | 'separate' | 'compare' | 'part-whole';
  startCount: number;
  changeCount: number;
  resultCount: number;
  equation: string;
  unknownPosition?: 'result' | 'change' | 'start';
}

export interface AdditionSubtractionSceneData {
  title: string;
  description?: string;
  challenges: AddSubChallenge[];
  maxNumber: number;
  showTenFrame: boolean;
  showEquationBar: boolean;
  gradeBand: 'K' | '1';

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<AdditionSubtractionSceneMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'act-out':        { label: 'Act Out',        icon: '🎭', accentColor: 'orange' },
  'build-equation': { label: 'Build Equation', icon: '🧩', accentColor: 'purple' },
  'solve-story':    { label: 'Solve Story',    icon: '📖', accentColor: 'blue' },
  'create-story':   { label: 'Create Story',   icon: '✨', accentColor: 'emerald' },
};

const SCENE_BACKGROUNDS: Record<string, { gradient: string; label: string }> = {
  pond:       { gradient: 'from-cyan-900/40 to-blue-900/40',    label: 'Pond' },
  farm:       { gradient: 'from-green-900/40 to-yellow-900/40', label: 'Farm' },
  playground: { gradient: 'from-amber-900/40 to-orange-900/40', label: 'Playground' },
  space:      { gradient: 'from-indigo-900/40 to-purple-900/40', label: 'Space' },
  kitchen:    { gradient: 'from-rose-900/40 to-orange-900/40',  label: 'Kitchen' },
  garden:     { gradient: 'from-emerald-900/40 to-lime-900/40', label: 'Garden' },
};

const OBJECT_EMOJI: Record<string, string> = {
  ducks: '🦆', frogs: '🐸', apples: '🍎', birds: '🐦', fish: '🐟',
  butterflies: '🦋', dogs: '🐶', cats: '🐱', stars: '⭐', flowers: '🌸',
  cookies: '🍪', cupcakes: '🧁', rockets: '🚀', bunnies: '🐰',
};

const EQUATION_TILES = ['0','1','2','3','4','5','6','7','8','9','10','+','-','='];

const SCENE_WIDTH = 480;
const SCENE_HEIGHT = 220;
const OBJ_SIZE = 38;

// ============================================================================
// Helpers
// ============================================================================

function getEmoji(objectType: string): string {
  return OBJECT_EMOJI[objectType] || '⭐';
}

/** Deterministic scattered positions for scene objects */
function scenePositions(count: number, seed: number = 7): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  let s = seed;
  const rand = () => { s = (s * 16807) % 2147483647; return (s & 0x7fffffff) / 2147483647; };
  const padX = 30;
  const padY = 30;
  for (let i = 0; i < count; i++) {
    let bestX = padX + rand() * (SCENE_WIDTH - 2 * padX);
    let bestY = padY + rand() * (SCENE_HEIGHT - 2 * padY);
    for (let a = 0; a < 20; a++) {
      const x = padX + rand() * (SCENE_WIDTH - 2 * padX);
      const y = padY + rand() * (SCENE_HEIGHT - 2 * padY);
      let tooClose = false;
      for (const p of positions) {
        if (Math.hypot(x - p.x, y - p.y) < OBJ_SIZE + 6) { tooClose = true; break; }
      }
      if (!tooClose) { bestX = x; bestY = y; break; }
    }
    positions.push({ x: bestX, y: bestY });
  }
  return positions;
}

// ============================================================================
// Sub-components
// ============================================================================

/** Ten-frame visual helper */
const TenFrameHelper: React.FC<{ filled: number; max?: number }> = ({ filled, max = 10 }) => {
  const cells = Array.from({ length: max }, (_, i) => i < filled);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="grid grid-cols-5 gap-0.5">
        {cells.map((on, i) => (
          <div
            key={i}
            className={`w-5 h-5 rounded border ${
              on ? 'bg-amber-400/60 border-amber-400/80' : 'bg-slate-800/30 border-white/10'
            }`}
          />
        ))}
      </div>
      <span className="text-slate-500 text-[10px] mt-0.5">ten frame</span>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

interface AdditionSubtractionSceneProps {
  data: AdditionSubtractionSceneData;
  className?: string;
}

const AdditionSubtractionScene: React.FC<AdditionSubtractionSceneProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    maxNumber = 10,
    showTenFrame = false,
    showEquationBar = true,
    gradeBand = 'K',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── Shared challenge hooks ──────────────────────────────────────
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

  // ── Local state ─────────────────────────────────────────────────
  const [tappedObjects, setTappedObjects] = useState<Set<number>>(new Set());
  const [countAnswer, setCountAnswer] = useState('');
  const [equationTiles, setEquationTiles] = useState<string[]>([]);
  const [solveAnswer, setSolveAnswer] = useState('');
  const [createSelection, setCreateSelection] = useState<{ scene: string; object: string } | null>(null);

  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [showTenFrameHelper, setShowTenFrameHelper] = useState(false);
  const [animatingObjects, setAnimatingObjects] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────
  const stableInstanceIdRef = useRef(instanceId || `add-sub-scene-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Current challenge ───────────────────────────────────────────
  const currentChallenge = useMemo(
    () => challenges[currentChallengeIndex] || null,
    [challenges, currentChallengeIndex],
  );

  const sceneConfig = currentChallenge
    ? SCENE_BACKGROUNDS[currentChallenge.scene] || SCENE_BACKGROUNDS.pond
    : SCENE_BACKGROUNDS.pond;

  // Compute visible objects based on phase & operation
  const totalVisible = useMemo(() => {
    if (!currentChallenge) return 0;
    const { type, operation, startCount, changeCount, resultCount } = currentChallenge;
    if (type === 'act-out') {
      // Show all objects (start + change) for the student to count
      return operation === 'addition' ? resultCount : startCount;
    }
    return resultCount;
  }, [currentChallenge]);

  const positions = useMemo(
    () => scenePositions(totalVisible, currentChallengeIndex * 31 + 7),
    [totalVisible, currentChallengeIndex],
  );

  // Which objects are "start" vs "change" for animation grouping
  const startGroup = useMemo(() => {
    if (!currentChallenge) return new Set<number>();
    const s = new Set<number>();
    for (let i = 0; i < currentChallenge.startCount && i < totalVisible; i++) s.add(i);
    return s;
  }, [currentChallenge, totalVisible]);

  // ── Evaluation ──────────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<AdditionSubtractionSceneMetrics>({
    primitiveType: 'addition-subtraction-scene',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── AI Tutoring ─────────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    storyText: currentChallenge?.storyText ?? '',
    operation: currentChallenge?.operation ?? 'addition',
    storyType: currentChallenge?.storyType ?? 'join',
    startCount: currentChallenge?.startCount ?? 0,
    changeCount: currentChallenge?.changeCount ?? 0,
    resultCount: currentChallenge?.resultCount ?? 0,
    unknownPosition: currentChallenge?.unknownPosition ?? 'result',
    challengeType: currentChallenge?.type ?? 'act-out',
    equation: currentChallenge?.equation ?? '',
    objectType: currentChallenge?.objectType ?? '',
    scene: currentChallenge?.scene ?? 'pond',
    attemptNumber: currentAttempts + 1,
    currentChallengeIndex,
    totalChallenges: challenges.length,
    gradeBand,
    maxNumber,
  }), [currentChallenge, currentAttempts, currentChallengeIndex, challenges.length, gradeBand, maxNumber]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'addition-subtraction-scene',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    const ch = challenges[0];
    sendText(
      `[ACTIVITY_START] Addition & subtraction story scene for ${gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}. `
      + `${challenges.length} challenges total. First story: "${ch.storyText}" (${ch.operation}, ${ch.storyType}). `
      + `Scene: ${ch.scene}, objects: ${ch.objectType}. `
      + `Introduce warmly: "Let's tell a story with ${ch.objectType}!" Then read the story aloud.`,
      { silent: true },
    );
  }, [isConnected, challenges, gradeBand, sendText]);

  // Play entrance animation for act-out
  useEffect(() => {
    if (currentChallenge?.type === 'act-out') {
      setAnimatingObjects(true);
      const timer = setTimeout(() => setAnimatingObjects(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [currentChallengeIndex, currentChallenge?.type]);

  // ── Check Answers ───────────────────────────────────────────────

  const handleCheckActOut = useCallback(() => {
    if (!currentChallenge) return;
    incrementAttempts();
    const answer = parseInt(countAnswer, 10);
    const target = currentChallenge.resultCount;
    const correct = answer === target;

    if (correct) {
      setFeedback(`Yes! ${currentChallenge.equation}`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student counted ${target} ${currentChallenge.objectType} correctly! `
        + `Story: "${currentChallenge.storyText}". Congratulate and connect to the equation: ${currentChallenge.equation}.`,
        { silent: true },
      );
      recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 });
    } else {
      setFeedback(`Not quite — you said ${answer || '?'}. ${currentChallenge.operation === 'addition' ? 'Count all the objects together!' : 'Count what\'s left!'}`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student answered ${answer || 'nothing'} but correct is ${target}. `
        + `Story: "${currentChallenge.storyText}". Attempt ${currentAttempts + 1}. `
        + `Hint: "What happened in the story? Did ${currentChallenge.objectType} come or go?"`,
        { silent: true },
      );
    }
  }, [currentChallenge, countAnswer, currentAttempts, sendText, incrementAttempts, recordResult]);

  const handleCheckEquation = useCallback(() => {
    if (!currentChallenge) return;
    incrementAttempts();
    const studentEquation = equationTiles.join(' ');
    const { startCount, changeCount, resultCount, operation } = currentChallenge;

    // Parse student equation: "A + B = C" or "A - B = C"
    const stripped = studentEquation.replace(/\s+/g, '');
    const eqMatch = stripped.match(/^(\d+)([+-])(\d+)=(\d+)$/);

    if (!eqMatch) {
      setFeedback('Build an equation like 3 + 2 = 5');
      setFeedbackType('error');
      return;
    }

    const left = parseInt(eqMatch[1], 10);
    const op = eqMatch[2];
    const right = parseInt(eqMatch[3], 10);
    const result = parseInt(eqMatch[4], 10);

    // Check 1: arithmetic is correct
    const mathCorrect = op === '+'
      ? left + right === result
      : left - right === result;

    // Check 2: uses the correct three numbers (order-independent for addition)
    const studentNums = [left, right, result].sort((a, b) => a - b);
    const expectedNums = [startCount, changeCount, resultCount].sort((a, b) => a - b);
    const usesCorrectNumbers = studentNums[0] === expectedNums[0]
      && studentNums[1] === expectedNums[1]
      && studentNums[2] === expectedNums[2];

    // Check 3: correct operation type
    const correctOp = (operation === 'addition' && op === '+')
      || (operation === 'subtraction' && op === '-');

    const correct = mathCorrect && usesCorrectNumbers && correctOp;

    if (correct) {
      setFeedback(`Perfect! ${stripped} matches the story!`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student built the equation: ${stripped}. `
        + `Celebrate: "The equation tells the same story as the ${currentChallenge.objectType}!"`,
        { silent: true },
      );
      recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 });
    } else if (!mathCorrect) {
      setFeedback('The math doesn\'t add up — check the numbers.');
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student built "${stripped}" but the arithmetic is wrong. `
        + `Attempt ${currentAttempts + 1}. Hint: "Check if ${left} ${op} ${right} really equals ${result}."`,
        { silent: true },
      );
    } else if (!correctOp) {
      setFeedback(`Think about the story — did the ${currentChallenge.objectType} come or go away?`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student used "${op}" but the story is ${operation}. `
        + `Attempt ${currentAttempts + 1}. Guide: "In the story, did things join together or go away?"`,
        { silent: true },
      );
    } else {
      setFeedback(`Use the numbers from the story: ${startCount}, ${changeCount}, and ${resultCount}`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student built "${stripped}" — valid math but wrong numbers for this story. `
        + `Attempt ${currentAttempts + 1}. Remind them to look at the story again.`,
        { silent: true },
      );
    }
  }, [currentChallenge, equationTiles, currentAttempts, sendText, incrementAttempts, recordResult]);

  const handleCheckSolveStory = useCallback(() => {
    if (!currentChallenge) return;
    incrementAttempts();
    const answer = parseInt(solveAnswer, 10);
    const { unknownPosition = 'result', startCount, changeCount, resultCount } = currentChallenge;
    const target = unknownPosition === 'result' ? resultCount
      : unknownPosition === 'change' ? changeCount : startCount;
    const correct = answer === target;

    if (correct) {
      setFeedback(`That's right! The answer is ${target}.`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student solved the word problem correctly: ${target}. `
        + `Unknown was "${unknownPosition}". Celebrate and explain why.`,
        { silent: true },
      );
      recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 });
    } else {
      setFeedback(`Not quite — try again! Read the story carefully.`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student answered ${answer || 'nothing'} but correct is ${target}. `
        + `Unknown position: "${unknownPosition}". Attempt ${currentAttempts + 1}. `
        + `Scaffolding: "You started with ${startCount} ${currentChallenge.objectType}. Then ${changeCount} ${currentChallenge.operation === 'addition' ? 'more came' : 'went away'}."`,
        { silent: true },
      );
    }
  }, [currentChallenge, solveAnswer, currentAttempts, sendText, incrementAttempts, recordResult]);

  const handleCheckCreateStory = useCallback(() => {
    if (!currentChallenge || !createSelection) return;
    incrementAttempts();
    // Create-story is open-ended — accept any scene+object selection as correct
    const correct = true;
    setFeedback(`Great story! You showed ${currentChallenge.equation} with ${createSelection.object} at the ${createSelection.scene}!`);
    setFeedbackType('success');
    sendText(
      `[ANSWER_CORRECT] Student created a story for ${currentChallenge.equation} using ${createSelection.object} in a ${createSelection.scene} scene. `
      + `Celebrate their creativity! Ask them to tell you the story in words.`,
      { silent: true },
    );
    recordResult({ challengeId: currentChallenge.id, correct, attempts: currentAttempts + 1 });
  }, [currentChallenge, createSelection, currentAttempts, sendText, incrementAttempts, recordResult]);

  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;
    switch (currentChallenge.type) {
      case 'act-out': handleCheckActOut(); break;
      case 'build-equation': handleCheckEquation(); break;
      case 'solve-story': handleCheckSolveStory(); break;
      case 'create-story': handleCheckCreateStory(); break;
    }
  }, [currentChallenge, handleCheckActOut, handleCheckEquation, handleCheckSolveStory, handleCheckCreateStory]);

  // ── Navigation ──────────────────────────────────────────────────

  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All complete
      const phaseScoreStr = phaseResults
        .map((p) => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = Math.round(
        (challengeResults.filter((r) => r.correct).length / challenges.length) * 100,
      );

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging phase-specific feedback about their addition and subtraction story skills!`,
        { silent: true },
      );

      if (!hasSubmittedEvaluation) {
        const correctCount = challengeResults.filter((r) => r.correct).length;
        const accuracy = Math.round((correctCount / challenges.length) * 100);
        const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);
        const equationChallenges = challengeResults.filter((_, i) => challenges[i]?.type === 'build-equation');
        const equationAccuracy = equationChallenges.length > 0
          ? Math.round((equationChallenges.filter((r) => r.correct).length / equationChallenges.length) * 100) : 0;
        const storySolveChallenges = challengeResults.filter((_, i) => challenges[i]?.type === 'solve-story');
        const storyAccuracy = storySolveChallenges.length > 0
          ? Math.round((storySolveChallenges.filter((r) => r.correct).length / storySolveChallenges.length) * 100) : 0;

        const metrics: AdditionSubtractionSceneMetrics = {
          type: 'addition-subtraction-scene',
          overallAccuracy: accuracy,
          equationBuildingAccuracy: equationAccuracy,
          storySolvingAccuracy: storyAccuracy,
          attemptsCount: totalAttempts,
          operationsUsed: Array.from(new Set(challenges.map((c) => c.operation))),
          storyTypesUsed: Array.from(new Set(challenges.map((c) => c.storyType))),
        };

        submitEvaluation(correctCount === challenges.length, accuracy, metrics, { challengeResults });
      }
      return;
    }

    // Reset domain-specific state for next challenge
    setFeedback('');
    setFeedbackType('');
    setCountAnswer('');
    setEquationTiles([]);
    setSolveAnswer('');
    setCreateSelection(null);
    setTappedObjects(new Set());
    setShowTenFrameHelper(false);

    const nextCh = challenges[currentChallengeIndex + 1];
    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
      + `"${nextCh.storyText}" (${nextCh.type}, ${nextCh.operation}). `
      + `Read the story to the student and introduce the new task.`,
      { silent: true },
    );
  }, [
    advanceProgress, phaseResults, challenges, challengeResults, sendText,
    hasSubmittedEvaluation, submitEvaluation, currentChallengeIndex,
  ]);

  // ── Auto-submit when complete ───────────────────────────────────
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      advanceToNextChallenge();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, advanceToNextChallenge]);

  // ── Computed ────────────────────────────────────────────────────
  const isCurrentChallengeComplete = challengeResults.some(
    (r) => r.challengeId === currentChallenge?.id && r.correct,
  );

  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    return Math.round((challengeResults.filter((r) => r.correct).length / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  // ── Equation tile handlers ──────────────────────────────────────
  const addTile = useCallback((tile: string) => {
    setEquationTiles((prev) => [...prev, tile]);
  }, []);
  const removeTile = useCallback((index: number) => {
    setEquationTiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Object tap handler (act-out counting) ───────────────────────
  const handleObjectTap = useCallback((index: number) => {
    if (currentChallenge?.type !== 'act-out' || isCurrentChallengeComplete) return;
    setTappedObjects((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, [currentChallenge?.type, isCurrentChallengeComplete]);

  // Determine if Check button should be enabled
  const canCheck = useMemo(() => {
    if (!currentChallenge || isCurrentChallengeComplete) return false;
    switch (currentChallenge.type) {
      case 'act-out': return countAnswer.trim() !== '';
      case 'build-equation': return equationTiles.length >= 3;
      case 'solve-story': return solveAnswer.trim() !== '';
      case 'create-story': return createSelection !== null;
      default: return false;
    }
  }, [currentChallenge, isCurrentChallengeComplete, countAnswer, equationTiles, solveAnswer, createSelection]);

  // ── Render ──────────────────────────────────────────────────────
  if (challenges.length === 0) {
    return (
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
        <CardHeader><CardTitle className="text-slate-100">{title}</CardTitle></CardHeader>
        <CardContent><p className="text-slate-400 text-sm">No challenges configured.</p></CardContent>
      </Card>
    );
  }

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-orange-300 text-xs">
              {gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}
            </Badge>
            {currentChallenge && (
              <Badge className="bg-slate-800/50 border-slate-700/50 text-cyan-300 text-xs">
                {currentChallenge.operation}
              </Badge>
            )}
          </div>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Phase Progress */}
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(PHASE_TYPE_CONFIG).map(([type, config]) => {
            const isActive = currentChallenge?.type === type;
            return (
              <Badge
                key={type}
                className={`text-xs ${
                  isActive
                    ? 'bg-orange-500/20 border-orange-400/50 text-orange-300'
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

        {/* Story Text */}
        {currentChallenge && !allChallengesComplete && (
          <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
            <p className="text-slate-200 text-sm font-medium mb-1">
              {currentChallenge.storyText}
            </p>
            <p className="text-slate-400 text-xs italic">
              {currentChallenge.instruction}
            </p>
          </div>
        )}

        {/* Scene Visualization */}
        {currentChallenge && !allChallengesComplete && (
          <div className="flex justify-center">
            <div
              className={`relative rounded-xl overflow-hidden border border-white/10 bg-gradient-to-br ${sceneConfig.gradient}`}
              style={{ width: SCENE_WIDTH, maxWidth: '100%', height: SCENE_HEIGHT }}
            >
              {/* Scene label */}
              <div className="absolute top-2 left-2">
                <Badge className="bg-black/30 border-white/10 text-white/70 text-[10px]">
                  {sceneConfig.label}
                </Badge>
              </div>

              {/* Objects */}
              <svg
                width={SCENE_WIDTH}
                height={SCENE_HEIGHT}
                viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`}
                className="absolute inset-0 w-full h-full"
              >
                {positions.map((pos, i) => {
                  const isTapped = tappedObjects.has(i);
                  const isChangeGroup = !startGroup.has(i);
                  const animDelay = isChangeGroup && animatingObjects ? '0.5s' : '0s';

                  return (
                    <g
                      key={i}
                      className={`cursor-pointer transition-transform duration-300 ${
                        animatingObjects && isChangeGroup ? 'opacity-0 animate-fadeIn' : 'opacity-100'
                      }`}
                      style={{
                        animationDelay: animDelay,
                        animationFillMode: 'forwards',
                      }}
                      onClick={() => handleObjectTap(i)}
                    >
                      {/* Tap highlight */}
                      {isTapped && (
                        <circle
                          cx={pos.x} cy={pos.y} r={OBJ_SIZE / 2 + 3}
                          fill="none" stroke="rgba(234,179,8,0.5)" strokeWidth={2}
                        />
                      )}
                      <text
                        x={pos.x} y={pos.y}
                        textAnchor="middle" dominantBaseline="central"
                        fontSize={OBJ_SIZE * 0.7}
                        className="select-none pointer-events-none"
                      >
                        {getEmoji(currentChallenge.objectType)}
                      </text>
                      {/* Count badge for tapped objects */}
                      {isTapped && (
                        <>
                          <circle
                            cx={pos.x + OBJ_SIZE / 2 - 2} cy={pos.y - OBJ_SIZE / 2 + 2}
                            r={8} fill="#eab308" stroke="rgba(0,0,0,0.3)" strokeWidth={1}
                          />
                          <text
                            x={pos.x + OBJ_SIZE / 2 - 2} y={pos.y - OBJ_SIZE / 2 + 2}
                            textAnchor="middle" dominantBaseline="central"
                            fontSize={9} fill="white" fontWeight="bold"
                            className="pointer-events-none select-none"
                          >
                            {Array.from(tappedObjects).sort((a, b) => a - b).indexOf(i) + 1}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {/* Ten-frame toggle */}
        {showTenFrame && currentChallenge && !allChallengesComplete && (
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="ghost"
              className="bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 text-xs h-7 px-2"
              onClick={() => setShowTenFrameHelper((v) => !v)}
            >
              {showTenFrameHelper ? 'Hide' : 'Show'} Ten Frame
            </Button>
            {showTenFrameHelper && (
              <TenFrameHelper filled={currentChallenge.resultCount} max={maxNumber <= 5 ? 5 : 10} />
            )}
          </div>
        )}

        {/* ── Phase-specific input areas ─────────────────────── */}

        {/* Act-Out: count input */}
        {currentChallenge?.type === 'act-out' && !isCurrentChallengeComplete && !allChallengesComplete && (
          <div className="flex items-center justify-center gap-3">
            <span className="text-slate-300 text-sm">How many {currentChallenge.objectType} are there now?</span>
            <input
              type="number"
              min={0}
              max={maxNumber}
              value={countAnswer}
              onChange={(e) => setCountAnswer(e.target.value)}
              className="w-16 px-3 py-1.5 bg-slate-800/50 border border-white/20 rounded-lg text-slate-100 text-center text-lg focus:outline-none focus:border-orange-400/50"
              onKeyDown={(e) => e.key === 'Enter' && canCheck && handleCheckAnswer()}
            />
          </div>
        )}

        {/* Build-Equation: tile builder */}
        {currentChallenge?.type === 'build-equation' && !isCurrentChallengeComplete && !allChallengesComplete && showEquationBar && (
          <div className="space-y-3">
            {/* Built equation display */}
            <div className="flex items-center justify-center gap-1 min-h-[44px] bg-slate-800/30 rounded-lg p-2 border border-white/5">
              {equationTiles.length === 0 ? (
                <span className="text-slate-600 text-sm">Drag tiles here to build the equation</span>
              ) : (
                equationTiles.map((tile, i) => (
                  <Button
                    key={i}
                    variant="ghost"
                    className="bg-purple-500/20 border border-purple-400/30 text-purple-200 text-lg font-mono h-9 w-9 p-0 hover:bg-red-500/20 hover:border-red-400/30"
                    onClick={() => removeTile(i)}
                    title="Click to remove"
                  >
                    {tile}
                  </Button>
                ))
              )}
            </div>
            {/* Available tiles */}
            <div className="flex flex-wrap justify-center gap-1">
              {EQUATION_TILES.filter((t) => {
                const num = parseInt(t, 10);
                return isNaN(num) || num <= maxNumber;
              }).map((tile) => (
                <Button
                  key={tile}
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200 text-sm font-mono h-8 w-8 p-0"
                  onClick={() => addTile(tile)}
                >
                  {tile}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Solve-Story: answer input */}
        {currentChallenge?.type === 'solve-story' && !isCurrentChallengeComplete && !allChallengesComplete && (
          <div className="flex items-center justify-center gap-3">
            <span className="text-slate-300 text-sm">
              What is the answer?
              {currentChallenge.unknownPosition === 'start' && ' (How many at the start?)'}
              {currentChallenge.unknownPosition === 'change' && ' (How many came or left?)'}
            </span>
            <input
              type="number"
              min={0}
              max={maxNumber}
              value={solveAnswer}
              onChange={(e) => setSolveAnswer(e.target.value)}
              className="w-16 px-3 py-1.5 bg-slate-800/50 border border-white/20 rounded-lg text-slate-100 text-center text-lg focus:outline-none focus:border-blue-400/50"
              onKeyDown={(e) => e.key === 'Enter' && canCheck && handleCheckAnswer()}
            />
          </div>
        )}

        {/* Create-Story: scene & object picker */}
        {currentChallenge?.type === 'create-story' && !isCurrentChallengeComplete && !allChallengesComplete && (
          <div className="space-y-3">
            <div className="text-center">
              <span className="text-slate-300 text-sm">
                Show <span className="text-emerald-300 font-bold">{currentChallenge.equation}</span> — pick a scene and objects:
              </span>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {Object.entries(SCENE_BACKGROUNDS).map(([key, cfg]) => (
                <Button
                  key={key}
                  variant="ghost"
                  className={`text-xs h-8 ${
                    createSelection?.scene === key
                      ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300'
                      : 'bg-white/5 border border-white/20 text-slate-400 hover:bg-white/10'
                  }`}
                  onClick={() => setCreateSelection((prev) => ({ scene: key, object: prev?.object || '' }))}
                >
                  {cfg.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {Object.entries(OBJECT_EMOJI).map(([key, emoji]) => (
                <Button
                  key={key}
                  variant="ghost"
                  className={`text-xs h-8 ${
                    createSelection?.object === key
                      ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300'
                      : 'bg-white/5 border border-white/20 text-slate-400 hover:bg-white/10'
                  }`}
                  onClick={() => setCreateSelection((prev) => ({ scene: prev?.scene || '', object: key }))}
                >
                  {emoji} {key}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium ${
            feedbackType === 'success' ? 'text-emerald-400' : feedbackType === 'error' ? 'text-red-400' : 'text-slate-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center gap-3">
          {!isCurrentChallengeComplete && !allChallengesComplete && (
            <Button
              variant="ghost"
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
              onClick={handleCheckAnswer}
              disabled={!canCheck || hasSubmittedEvaluation}
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
          {allChallengesComplete && !hasSubmittedEvaluation && (
            <div className="text-center">
              <p className="text-emerald-400 text-sm font-medium">All challenges complete!</p>
            </div>
          )}
        </div>

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Story Complete!"
            celebrationMessage={`You completed all ${challenges.length} addition & subtraction story challenges!`}
            className="mt-4"
          />
        )}
      </CardContent>

      {/* CSS animation for object entrance */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px) scale(0.8); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </Card>
  );
};

export default AdditionSubtractionScene;
