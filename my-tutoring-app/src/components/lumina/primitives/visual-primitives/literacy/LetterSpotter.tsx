'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { LetterSpotterMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface LetterSpotterChallenge {
  id: string;
  mode: 'name-it' | 'find-it' | 'match-it';
  targetLetter: string;
  targetCase: 'uppercase' | 'lowercase' | 'both';
  /** Letter-name options for name-it / lowercase options for match-it */
  options?: string[];
  /** Grid of mixed letters for find-it mode */
  letterGrid?: string[];
  /** Number of target letter instances in the grid */
  targetCount?: number;
}

export interface LetterSpotterData {
  title: string;
  letterGroup: 1 | 2 | 3 | 4;
  cumulativeLetters: string[];
  newLetters: string[];
  challenges: LetterSpotterChallenge[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<LetterSpotterMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const MODE_CONFIG: Record<string, { label: string; description: string }> = {
  'name-it': { label: 'Name It', description: 'Name the letter you see' },
  'find-it': { label: 'Find It', description: 'Find all matching letters' },
  'match-it': { label: 'Match It', description: 'Match uppercase to lowercase' },
};

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'name-it': { label: 'Name It', accentColor: 'blue' },
  'find-it': { label: 'Find It', accentColor: 'purple' },
  'match-it': { label: 'Match It', accentColor: 'emerald' },
};

/** Rotate font families so students see letters in varied visual forms. */
const FONT_CLASSES = ['font-sans', 'font-serif', 'font-mono'];

const MAX_ATTEMPTS = 3;

// ============================================================================
// Props
// ============================================================================

interface LetterSpotterProps {
  data: LetterSpotterData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const LetterSpotter: React.FC<LetterSpotterProps> = ({ data, className }) => {
  const {
    title,
    letterGroup,
    cumulativeLetters = [],
    newLetters = [],
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ---------------------------------------------------------------------------
  // Refs & IDs
  // ---------------------------------------------------------------------------
  const stableInstanceIdRef = useRef(instanceId || `letter-spotter-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const startTimeRef = useRef(Date.now());

  // ---------------------------------------------------------------------------
  // Shared hooks — challenge progression
  // ---------------------------------------------------------------------------
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
    getChallengeType: (ch) => ch.mode,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // ---------------------------------------------------------------------------
  // Local UI state
  // ---------------------------------------------------------------------------
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedGridCells, setSelectedGridCells] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [isLocked, setIsLocked] = useState(false);
  const [confusedPairs, setConfusedPairs] = useState<Set<string>>(new Set());
  const [submittedResult, setSubmittedResult] = useState<{ score: number } | null>(null);

  const currentChallenge = challenges[currentChallengeIndex];
  const fontClass = useMemo(
    () => FONT_CLASSES[currentChallengeIndex % FONT_CLASSES.length],
    [currentChallengeIndex],
  );

  // ---------------------------------------------------------------------------
  // Evaluation hook
  // ---------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<LetterSpotterMetrics>({
    primitiveType: 'letter-spotter',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ---------------------------------------------------------------------------
  // AI Tutoring
  // ---------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    letterGroup,
    cumulativeLetters: cumulativeLetters.join(', '),
    newLetters: newLetters.join(', '),
    challengeMode: currentChallenge?.mode ?? '',
    targetLetter: currentChallenge?.targetLetter ?? '',
    targetCase: currentChallenge?.targetCase ?? '',
    currentChallenge: currentChallengeIndex + 1,
    totalChallenges: challenges.length,
    attempts: currentAttempts,
  }), [
    letterGroup, cumulativeLetters, newLetters,
    currentChallenge, currentChallengeIndex, challenges.length, currentAttempts,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'letter-spotter',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'K',
  });

  // Activity introduction — once on AI connect
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || !currentChallenge) return;
    hasIntroducedRef.current = true;

    const isNew = newLetters.includes(currentChallenge.targetLetter.toLowerCase());
    const modeLabel = MODE_CONFIG[currentChallenge.mode]?.description ?? currentChallenge.mode;

    sendText(
      `[ACTIVITY_START] Letter spotting activity for Group ${letterGroup} `
      + `(letters: ${cumulativeLetters.join(', ')}). `
      + `New letters in this group: ${newLetters.length > 0 ? newLetters.join(', ') : 'none — review only'}. `
      + `There are ${challenges.length} challenges. `
      + `Introduce the activity warmly — we're learning to recognize letters! `
      + `First challenge: ${modeLabel} for the letter "${currentChallenge.targetLetter.toUpperCase()}". `
      + (currentChallenge.mode === 'find-it'
        ? `Say "Find the letter ${currentChallenge.targetLetter.toUpperCase()}!" with enthusiasm. `
        : '')
      + (isNew ? `This is a NEW letter — introduce it warmly with a brief description of its shape. ` : '')
      + `Keep it brief and enthusiastic — 2-3 sentences max.`,
      { silent: true },
    );
  }, [isConnected, currentChallenge, letterGroup, cumulativeLetters, newLetters, challenges.length, sendText]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Display letter(s) based on target case. */
  const getDisplayLetter = useCallback((letter: string, targetCase: string) => {
    if (targetCase === 'uppercase') return letter.toUpperCase();
    if (targetCase === 'lowercase') return letter.toLowerCase();
    return `${letter.toUpperCase()}  ${letter.toLowerCase()}`; // 'both'
  }, []);

  /** Record a confused pair (sorted alphabetically so "b-d" and "d-b" are the same). */
  const trackConfusion = useCallback((target: string, chosen: string) => {
    const pair = [target.toLowerCase(), chosen.toLowerCase()].sort().join('-');
    setConfusedPairs(prev => new Set(Array.from(prev).concat(pair)));
  }, []);

  // ---------------------------------------------------------------------------
  // Name-It & Match-It: option selection (auto-check on tap)
  // ---------------------------------------------------------------------------
  const handleOptionSelect = useCallback((option: string) => {
    if (isLocked || hasSubmittedEvaluation || !currentChallenge) return;

    setSelectedOption(option);
    incrementAttempts();

    const isCorrect = option.toLowerCase() === currentChallenge.targetLetter.toLowerCase();

    if (isCorrect) {
      setFeedback(`Yes! That's the letter ${currentChallenge.targetLetter.toUpperCase()}!`);
      setFeedbackType('success');
      setIsLocked(true);

      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        mode: currentChallenge.mode,
        targetLetter: currentChallenge.targetLetter,
        targetCase: currentChallenge.targetCase,
        isNewLetter: newLetters.includes(currentChallenge.targetLetter.toLowerCase()),
      });

      sendText(
        `[ANSWER_CORRECT] The student correctly identified the letter "${currentChallenge.targetLetter.toUpperCase()}"` +
        `${currentAttempts === 0 ? ' on the first try!' : ` after ${currentAttempts + 1} attempts.`} ` +
        `[SAY_LETTER_NAME] Say the letter name clearly and congratulate briefly.`,
        { silent: true },
      );
    } else {
      setFeedback('Try again! Look at the letter carefully.');
      setFeedbackType('error');
      trackConfusion(currentChallenge.targetLetter, option);

      sendText(
        `[ANSWER_INCORRECT] The student chose "${option.toUpperCase()}" but the correct letter is "${currentChallenge.targetLetter.toUpperCase()}". ` +
        `This is attempt ${currentAttempts + 1}. Give a brief shape hint without giving the answer.`,
        { silent: true },
      );

      // After max attempts, reveal and lock
      if (currentAttempts + 1 >= MAX_ATTEMPTS) {
        setFeedback(`This is the letter ${currentChallenge.targetLetter.toUpperCase()}. Let's keep going!`);
        setFeedbackType('error');
        setIsLocked(true);

        recordResult({
          challengeId: currentChallenge.id,
          correct: false,
          attempts: currentAttempts + 1,
          mode: currentChallenge.mode,
          targetLetter: currentChallenge.targetLetter,
          targetCase: currentChallenge.targetCase,
          isNewLetter: newLetters.includes(currentChallenge.targetLetter.toLowerCase()),
        });
      }
    }
  }, [
    isLocked, hasSubmittedEvaluation, currentChallenge, currentAttempts,
    newLetters, incrementAttempts, recordResult, sendText, trackConfusion,
  ]);

  // ---------------------------------------------------------------------------
  // Find-It: grid cell toggling + check
  // ---------------------------------------------------------------------------
  const handleGridCellToggle = useCallback((index: number) => {
    if (isLocked || hasSubmittedEvaluation) return;
    setSelectedGridCells(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, [isLocked, hasSubmittedEvaluation]);

  const handleCheckFindIt = useCallback(() => {
    if (isLocked || hasSubmittedEvaluation || !currentChallenge) return;

    const grid = currentChallenge.letterGrid || [];
    const target = currentChallenge.targetLetter.toLowerCase();
    incrementAttempts();

    // Build set of correct target indices
    const targetIndices = new Set<number>();
    grid.forEach((letter, i) => {
      if (letter.toLowerCase() === target) targetIndices.add(i);
    });

    const isCorrect =
      selectedGridCells.size === targetIndices.size &&
      Array.from(selectedGridCells).every(i => targetIndices.has(i));

    if (isCorrect) {
      setFeedback(`You found all the ${currentChallenge.targetLetter.toUpperCase()}'s!`);
      setFeedbackType('success');
      setIsLocked(true);

      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        mode: 'find-it',
        targetLetter: currentChallenge.targetLetter,
        targetCase: currentChallenge.targetCase,
        isNewLetter: newLetters.includes(currentChallenge.targetLetter.toLowerCase()),
      });

      sendText(
        `[ANSWER_CORRECT] The student found all ${targetIndices.size} instances of "${currentChallenge.targetLetter.toUpperCase()}" in the grid! ` +
        `${currentAttempts === 0 ? 'First try!' : `After ${currentAttempts + 1} attempts.`} ` +
        `[SAY_LETTER_NAME] Celebrate briefly!`,
        { silent: true },
      );
    } else {
      const missed = Array.from(targetIndices).filter(i => !selectedGridCells.has(i)).length;
      const extra = Array.from(selectedGridCells).filter(i => !targetIndices.has(i)).length;

      setFeedback(
        missed > 0 && extra > 0
          ? `Almost! You missed ${missed} and picked ${extra} wrong.`
          : missed > 0
            ? `Almost! You missed ${missed} letter${missed > 1 ? 's' : ''}.`
            : `Almost! ${extra} of your picks ${extra > 1 ? "aren't" : "isn't"} the right letter.`,
      );
      setFeedbackType('error');

      // Track confused pairs for wrongly selected cells
      Array.from(selectedGridCells)
        .filter(i => !targetIndices.has(i))
        .forEach(i => {
          const wrongLetter = grid[i];
          if (wrongLetter) trackConfusion(currentChallenge.targetLetter, wrongLetter);
        });

      sendText(
        `[ANSWER_INCORRECT] Find-it mode: student selected ${selectedGridCells.size} cells but there are ${targetIndices.size} "${currentChallenge.targetLetter.toUpperCase()}"s. ` +
        `Missed: ${missed}, extra wrong: ${extra}. Attempt ${currentAttempts + 1}. Give a brief hint.`,
        { silent: true },
      );

      // After max attempts, reveal correct cells
      if (currentAttempts + 1 >= MAX_ATTEMPTS) {
        setFeedback(`The ${currentChallenge.targetLetter.toUpperCase()}'s are highlighted. Let's keep going!`);
        setIsLocked(true);
        setSelectedGridCells(targetIndices);

        recordResult({
          challengeId: currentChallenge.id,
          correct: false,
          attempts: currentAttempts + 1,
          mode: 'find-it',
          targetLetter: currentChallenge.targetLetter,
          targetCase: currentChallenge.targetCase,
          isNewLetter: newLetters.includes(currentChallenge.targetLetter.toLowerCase()),
        });
      }
    }
  }, [
    isLocked, hasSubmittedEvaluation, currentChallenge, selectedGridCells,
    currentAttempts, newLetters, incrementAttempts, recordResult, sendText, trackConfusion,
  ]);

  // ---------------------------------------------------------------------------
  // Submit final evaluation
  // ---------------------------------------------------------------------------
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;

    const total = challengeResults.length;
    const correct = challengeResults.filter(r => r.correct).length;
    const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const elapsedMs = Date.now() - startTimeRef.current;

    // Per-category accuracy helpers
    const acc = (items: typeof challengeResults) =>
      items.length > 0 ? Math.round((items.filter(r => r.correct).length / items.length) * 100) : 100;

    const newLetterResults = challengeResults.filter(r => r.isNewLetter);
    const reviewLetterResults = challengeResults.filter(r => !r.isNewLetter);
    const uppercaseResults = challengeResults.filter(
      r => r.targetCase === 'uppercase' || r.targetCase === 'both',
    );
    const lowercaseResults = challengeResults.filter(
      r => r.targetCase === 'lowercase' || r.targetCase === 'both',
    );

    const overallScore = total > 0 ? Math.round((correct / total) * 100) : 0;

    const metrics: LetterSpotterMetrics = {
      type: 'letter-spotter',
      letterGroup,
      challengesCorrect: correct,
      challengesTotal: total,
      newLetterAccuracy: acc(newLetterResults),
      reviewLetterAccuracy: acc(reviewLetterResults),
      uppercaseAccuracy: acc(uppercaseResults),
      lowercaseAccuracy: acc(lowercaseResults),
      confusedLetterPairs: Array.from(confusedPairs),
      attemptsCount: totalAttempts,
    };

    setSubmittedResult({ score: overallScore });

    submitEvaluation(
      overallScore >= 60,
      overallScore,
      metrics,
      { challengeResults, durationMs: elapsedMs },
    );

    // AI celebration
    const phaseScoreStr = phaseResults.length > 0
      ? phaseResults.map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`).join(', ')
      : `Overall: ${overallScore}%`;
    sendText(
      `[ALL_COMPLETE] Student finished all ${total} letter spotting challenges! ` +
      `Score: ${correct}/${total} (${overallScore}%). ${phaseScoreStr}. ` +
      (confusedPairs.size > 0 ? `Confused pairs: ${Array.from(confusedPairs).join(', ')}. ` : '') +
      `Celebrate and give encouraging feedback!`,
      { silent: true },
    );
  }, [
    hasSubmittedEvaluation, challengeResults, letterGroup, confusedPairs,
    phaseResults, submitEvaluation, sendText,
  ]);

  // Auto-submit when all challenges are complete (the "Finish" button disappears
  // because allChallengesComplete hides it, so we need this effect as the trigger).
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation) {
      submitFinalEvaluation();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, submitFinalEvaluation]);

  // Compute score directly from results for immediate display (avoids 0% flash
  // before the submitFinalEvaluation effect fires and sets submittedResult).
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challengeResults.length === 0) return 0;
    const correct = challengeResults.filter(r => r.correct).length;
    return Math.round((correct / challengeResults.length) * 100);
  }, [allChallengesComplete, challengeResults]);

  // ---------------------------------------------------------------------------
  // Advance to next challenge
  // ---------------------------------------------------------------------------
  const handleNextChallenge = useCallback(() => {
    // Reset UI state
    setSelectedOption(null);
    setSelectedGridCells(new Set());
    setFeedback('');
    setFeedbackType('');
    setIsLocked(false);

    if (!advanceProgress()) {
      // All challenges done — submit evaluation
      submitFinalEvaluation();
      return;
    }

    // Introduce next challenge via AI
    const nextChallenge = challenges[currentChallengeIndex + 1];
    if (!nextChallenge) return;

    const isNew = newLetters.includes(nextChallenge.targetLetter.toLowerCase());
    const modeLabel = MODE_CONFIG[nextChallenge.mode]?.description ?? nextChallenge.mode;

    if (nextChallenge.mode === 'find-it') {
      sendText(
        `[FIND_LETTER] Find the letter ${nextChallenge.targetLetter.toUpperCase()}! ` +
        `Challenge ${currentChallengeIndex + 2} of ${challenges.length}. ` +
        `Say "Find the letter ${nextChallenge.targetLetter.toUpperCase()}!" with enthusiasm.`,
        { silent: true },
      );
    } else if (isNew) {
      sendText(
        `[NEW_LETTER_INTRO] Introducing a new letter: ${nextChallenge.targetLetter.toUpperCase()}. ` +
        `Warmly introduce this letter with a brief description of its shape. ` +
        `Then tell the student to ${modeLabel.toLowerCase()}.`,
        { silent: true },
      );
    } else {
      sendText(
        `[NEXT_CHALLENGE] Challenge ${currentChallengeIndex + 2} of ${challenges.length}: ` +
        `${modeLabel} for "${nextChallenge.targetLetter.toUpperCase()}". Briefly introduce the task.`,
        { silent: true },
      );
    }
  }, [advanceProgress, submitFinalEvaluation, challenges, currentChallengeIndex, newLetters, sendText]);

  // ============================================================================
  // Render: Name-It Mode
  // ============================================================================
  const renderNameIt = () => {
    if (!currentChallenge) return null;
    const displayLetter = getDisplayLetter(currentChallenge.targetLetter, currentChallenge.targetCase);
    const options = currentChallenge.options || [];

    return (
      <div className="space-y-6">
        {/* Large letter display */}
        <div className="flex justify-center">
          <div className={`
            ${fontClass} text-8xl font-bold text-slate-100
            bg-white/5 border-2 border-white/15 rounded-2xl
            px-12 py-8 tracking-wider select-none
          `}>
            {displayLetter}
          </div>
        </div>

        <p className="text-center text-slate-400 text-sm">What letter is this?</p>

        {/* Options grid */}
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
          {options.map((option) => {
            const isSelected = selectedOption === option;
            const isCorrectOption = option.toLowerCase() === currentChallenge.targetLetter.toLowerCase();
            const showCorrect = isLocked && isCorrectOption;
            const showWrong = isSelected && feedbackType === 'error' && !isCorrectOption;

            return (
              <Button
                key={option}
                variant="ghost"
                onClick={() => handleOptionSelect(option)}
                disabled={isLocked}
                className={`
                  h-16 text-2xl font-bold transition-all
                  ${showCorrect
                    ? 'bg-emerald-500/30 border-2 border-emerald-400/60 text-emerald-200'
                    : showWrong
                      ? 'bg-red-500/20 border-2 border-red-500/40 text-red-300'
                      : isSelected
                        ? 'bg-blue-500/20 border-2 border-blue-500/40 text-blue-200'
                        : 'bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200'
                  }
                `}
              >
                {option.toUpperCase()}
              </Button>
            );
          })}
        </div>
      </div>
    );
  };

  // ============================================================================
  // Render: Find-It Mode
  // ============================================================================
  const renderFindIt = () => {
    if (!currentChallenge) return null;
    const grid = currentChallenge.letterGrid || [];
    const target = currentChallenge.targetLetter.toLowerCase();
    const gridCols = Math.ceil(Math.sqrt(grid.length));

    return (
      <div className="space-y-4">
        {/* Instruction */}
        <div className="text-center">
          <p className="text-slate-400 text-sm">
            Find all the{' '}
            <span className="text-blue-300 font-bold text-lg">
              {currentChallenge.targetLetter.toUpperCase()}
            </span>
            &apos;s in the grid!
          </p>
        </div>

        {/* Letter grid */}
        <div
          className="grid gap-2 max-w-md mx-auto"
          style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}
        >
          {grid.map((letter, i) => {
            const isSelected = selectedGridCells.has(i);
            const isTarget = letter.toLowerCase() === target;
            const showCorrect = isLocked && isTarget;

            return (
              <button
                key={`${i}-${letter}`}
                onClick={() => handleGridCellToggle(i)}
                disabled={isLocked}
                className={`
                  aspect-square rounded-xl border-2 font-bold text-2xl
                  transition-all select-none
                  ${showCorrect
                    ? 'bg-emerald-500/30 border-emerald-400/60 text-emerald-200 scale-105'
                    : isSelected
                      ? 'bg-blue-500/25 border-blue-400/50 text-blue-200 scale-105'
                      : 'bg-slate-800/40 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20'
                  }
                  ${isLocked ? 'cursor-default' : 'cursor-pointer'}
                `}
              >
                {letter}
              </button>
            );
          })}
        </div>

        {/* Check button */}
        {!isLocked && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={handleCheckFindIt}
              disabled={selectedGridCells.size === 0}
              className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300 px-8"
            >
              Check
            </Button>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // Render: Match-It Mode
  // ============================================================================
  const renderMatchIt = () => {
    if (!currentChallenge) return null;
    const uppercaseLetter = currentChallenge.targetLetter.toUpperCase();
    const options = currentChallenge.options || [];

    return (
      <div className="space-y-6">
        {/* Large uppercase letter */}
        <div className="flex justify-center">
          <div className={`
            ${fontClass} text-8xl font-bold text-slate-100
            bg-white/5 border-2 border-white/15 rounded-2xl
            px-12 py-8 select-none
          `}>
            {uppercaseLetter}
          </div>
        </div>

        <p className="text-center text-slate-400 text-sm">Which lowercase letter matches?</p>

        {/* Lowercase options */}
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
          {options.map((option) => {
            const isSelected = selectedOption === option;
            const isCorrectOption = option.toLowerCase() === currentChallenge.targetLetter.toLowerCase();
            const showCorrect = isLocked && isCorrectOption;
            const showWrong = isSelected && feedbackType === 'error' && !isCorrectOption;

            return (
              <Button
                key={option}
                variant="ghost"
                onClick={() => handleOptionSelect(option)}
                disabled={isLocked}
                className={`
                  h-16 text-3xl font-bold transition-all
                  ${showCorrect
                    ? 'bg-emerald-500/30 border-2 border-emerald-400/60 text-emerald-200'
                    : showWrong
                      ? 'bg-red-500/20 border-2 border-red-500/40 text-red-300'
                      : isSelected
                        ? 'bg-blue-500/20 border-2 border-blue-500/40 text-blue-200'
                        : 'bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200'
                  }
                `}
              >
                {option}
              </Button>
            );
          })}
        </div>
      </div>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  if (challenges.length === 0) {
    return (
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
        <CardContent className="p-6">
          <p className="text-slate-400 text-center">No challenges available.</p>
        </CardContent>
      </Card>
    );
  }

  const elapsedMs = Date.now() - startTimeRef.current;

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg text-slate-100">{title}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-400 text-xs">
                Group {letterGroup}
              </Badge>
              {currentChallenge && (
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    currentChallenge.mode === 'name-it'
                      ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                      : currentChallenge.mode === 'find-it'
                        ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                        : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  }`}
                >
                  {MODE_CONFIG[currentChallenge.mode]?.label || currentChallenge.mode}
                </Badge>
              )}
              {currentChallenge && newLetters.includes(currentChallenge.targetLetter.toLowerCase()) && (
                <Badge variant="outline" className="bg-amber-500/20 border-amber-500/40 text-amber-300 text-xs">
                  New Letter
                </Badge>
              )}
            </div>
          </div>
          <span className="text-xs text-slate-500">
            {currentChallengeIndex + 1} / {challenges.length}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-slate-700/40 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500/60 rounded-full transition-all duration-500"
            style={{
              width: `${((currentChallengeIndex + (isLocked ? 1 : 0)) / challenges.length) * 100}%`,
            }}
          />
        </div>

        {/* Challenge content */}
        {!allChallengesComplete && currentChallenge && (
          <>
            {currentChallenge.mode === 'name-it' && renderNameIt()}
            {currentChallenge.mode === 'find-it' && renderFindIt()}
            {currentChallenge.mode === 'match-it' && renderMatchIt()}
          </>
        )}

        {/* Feedback */}
        {feedback && (
          <div
            className={`
              px-4 py-2 rounded-lg text-sm font-medium text-center
              ${feedbackType === 'success'
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                : 'bg-red-500/20 border border-red-500/40 text-red-300'
              }
            `}
          >
            {feedback}
          </div>
        )}

        {/* Next / Finish button */}
        {isLocked && !allChallengesComplete && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={handleNextChallenge}
              className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300"
            >
              {currentChallengeIndex < challenges.length - 1 ? 'Next Challenge' : 'Finish'}
            </Button>
          </div>
        )}

        {/* Completion summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Letter Spotting Complete!"
            celebrationMessage="Great job recognizing letters!"
            className="mb-6"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default LetterSpotter;
