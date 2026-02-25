'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { CvcSpellerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface CvcSpellerChallenge {
  id: string;
  targetWord: string;
  targetLetters: string[];     // e.g. ['c', 'a', 't']
  targetPhonemes: string[];    // e.g. ['/k/', '/æ/', '/t/']
  emoji: string;               // e.g. "🐱" for "cat"
  imageDescription: string;
  distractorLetters: string[];
  commonErrors?: Array<{
    errorSpelling: string;
    feedback: string;
  }>;
}

export interface CvcSpellerData {
  title: string;
  vowelFocus: 'short-a' | 'short-e' | 'short-i' | 'short-o' | 'short-u';
  letterGroup: 1 | 2 | 3 | 4;
  availableLetters: string[];
  challenges: CvcSpellerChallenge[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<CvcSpellerMetrics>) => void;
}

// ============================================================================
// Props Interface
// ============================================================================

interface CvcSpellerProps {
  data: CvcSpellerData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

const VOWEL_LABELS: Record<string, string> = {
  'short-a': 'Short A (/\u0103/)',
  'short-e': 'Short E (/\u0115/)',
  'short-i': 'Short I (/\u012D/)',
  'short-o': 'Short O (/\u014F/)',
  'short-u': 'Short U (/\u016D/)',
};

const VOWEL_KEYWORDS: Record<string, string> = {
  'a': 'apple',
  'e': 'egg',
  'i': 'itch',
  'o': 'octopus',
  'u': 'up',
};

const PHASE_CONFIG: Record<string, PhaseConfig> = {
  spelling: { label: 'CVC Spelling', icon: '📝', accentColor: 'emerald' },
};

// ============================================================================
// Component
// ============================================================================

const CvcSpeller: React.FC<CvcSpellerProps> = ({ data, className }) => {
  const {
    title,
    vowelFocus,
    letterGroup,
    availableLetters = [],
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // -------------------------------------------------------------------------
  // Challenge progress (shared hook)
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
    getChallengeType: () => 'spelling',
    phaseConfig: PHASE_CONFIG,
  });

  const currentChallenge = challenges[currentChallengeIndex] ?? null;

  // -------------------------------------------------------------------------
  // Domain-specific state
  // -------------------------------------------------------------------------
  const [slots, setSlots] = useState<(string | null)[]>([null, null, null]);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(0);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  const [isShaking, setIsShaking] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [wordComplete, setWordComplete] = useState(false);

  // Tracking (domain-specific, not covered by shared hooks)
  const [vowelErrors, setVowelErrors] = useState(0);
  const [vowelCorrect, setVowelCorrect] = useState(0);
  const [consonantErrors, setConsonantErrors] = useState(0);
  const [consonantCorrect, setConsonantCorrect] = useState(0);
  const [stretchUsedCount, setStretchUsedCount] = useState(0);
  const [errorPatterns, setErrorPatterns] = useState<string[]>([]);

  // Stable fallback instance ID
  const stableInstanceIdRef = useRef(instanceId || `cvc-speller-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Evaluation hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<CvcSpellerMetrics>({
    primitiveType: 'cvc-speller',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // Build the letter bank for this challenge: target letters + distractors, shuffled
  const letterBank = useMemo(() => {
    if (!currentChallenge) return [];
    const allLetters = new Set<string>();
    currentChallenge.targetLetters.forEach(l => allLetters.add(l.toLowerCase()));
    currentChallenge.distractorLetters.forEach(l => allLetters.add(l.toLowerCase()));
    availableLetters.forEach(l => allLetters.add(l.toLowerCase()));

    const letters = Array.from(allLetters);
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    return letters;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallengeIndex]);

  // ---------------------------------------------------------------------------
  // AI Tutoring Integration
  // ---------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    vowelFocus,
    letterGroup,
    targetWord: currentChallenge?.targetWord ?? '',
    targetPhonemes: currentChallenge?.targetPhonemes?.join(' ') ?? '',
    targetLetters: currentChallenge?.targetLetters?.join(', ') ?? '',
    placedLetters: slots.map(s => s || '_').join(', '),
    currentChallenge: currentChallengeIndex + 1,
    totalChallenges: challenges.length,
    attempts: currentAttempts,
    firstPhoneme: currentChallenge?.targetPhonemes?.[0] ?? '',
  }), [
    vowelFocus, letterGroup, currentChallenge, slots,
    currentChallengeIndex, challenges.length, currentAttempts,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'cvc-speller',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'K',
  });

  // ---------------------------------------------------------------------------
  // Activity introduction — fire once when the AI tutor connects
  // ---------------------------------------------------------------------------
  const hasIntroducedRef = useRef(false);

  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || !currentChallenge) return;
    hasIntroducedRef.current = true;

    const vowelLabel = VOWEL_LABELS[vowelFocus] || vowelFocus;
    sendText(
      `[ACTIVITY_START] This is a CVC spelling activity focusing on ${vowelLabel}. `
      + `There are ${challenges.length} words to spell. `
      + `Introduce the activity warmly: "Let's spell some words! I'll say a word, and you pick the letters." `
      + `Then say the first word "${currentChallenge.targetWord}" clearly. Keep it brief and enthusiastic — 2-3 sentences max.`,
      { silent: true }
    );
  }, [isConnected, currentChallenge, vowelFocus, challenges.length, sendText]);

  // ---------------------------------------------------------------------------
  // Pronounce the word when moving to a new challenge
  // ---------------------------------------------------------------------------
  const prevChallengeIndexRef = useRef(0);
  useEffect(() => {
    if (currentChallengeIndex > 0 && currentChallengeIndex !== prevChallengeIndexRef.current && currentChallenge) {
      sendText(
        `[NEXT_WORD] Moving to word ${currentChallengeIndex + 1} of ${challenges.length}. `
        + `Say: "Next word! Listen closely... ${currentChallenge.targetWord}." Then say it once more: "${currentChallenge.targetWord}."`,
        { silent: true }
      );
    }
    prevChallengeIndexRef.current = currentChallengeIndex;
  }, [currentChallengeIndex, currentChallenge, challenges.length, sendText]);

  // ---------------------------------------------------------------------------
  // Reset domain state for next challenge
  // ---------------------------------------------------------------------------
  const resetDomainState = useCallback(() => {
    setSlots([null, null, null]);
    setActiveSlotIndex(0);
    setFeedback('');
    setFeedbackType('');
    setWordComplete(false);
    setIsShaking(false);
    setIsCelebrating(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleHearAgain = useCallback(() => {
    if (!currentChallenge) return;
    sendText(
      `[REPEAT_WORD] Say: "The word is... ${currentChallenge.targetWord}." Say it slowly and clearly so the student can hear every sound. Then say it once more: "${currentChallenge.targetWord}."`,
      { silent: true }
    );
  }, [currentChallenge, sendText]);

  const handleStretch = useCallback(() => {
    if (!currentChallenge) return;
    setStretchUsedCount(prev => prev + 1);
    const stretched = currentChallenge.targetPhonemes.join('... ');
    sendText(
      `[STRETCH_WORD] Say the word "${currentChallenge.targetWord}" stretched out slowly, phoneme by phoneme: "${stretched}". `
      + `Pause between each sound. Nothing else.`,
      { silent: true }
    );
  }, [currentChallenge, sendText]);

  // Place a letter from the bank into the active slot
  const handleSelectLetter = useCallback((letter: string) => {
    if (hasSubmittedEvaluation || wordComplete || activeSlotIndex === null) return;

    setSlots(prev => {
      const next = [...prev];
      next[activeSlotIndex] = letter;
      return next;
    });

    // Confirm the sound via AI
    sendText(
      `[CONFIRM_SOUND] The student placed the letter "${letter}". Say just the sound that "${letter}" makes — a clean phoneme, nothing else.`,
      { silent: true }
    );

    // Auto-advance to next empty slot
    setActiveSlotIndex(prev => {
      if (prev === null) return null;
      const newSlots = [...slots];
      newSlots[prev] = letter;
      for (let i = 0; i < 3; i++) {
        const nextIdx = (prev + 1 + i) % 3;
        if (newSlots[nextIdx] === null) return nextIdx;
      }
      return null; // All slots filled
    });

    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation, wordComplete, activeSlotIndex, slots, sendText]);

  // Tap a slot to make it active or clear it
  const handleSlotTap = useCallback((index: number) => {
    if (hasSubmittedEvaluation || wordComplete) return;

    if (slots[index] !== null) {
      setSlots(prev => {
        const next = [...prev];
        next[index] = null;
        return next;
      });
      setActiveSlotIndex(index);
    } else {
      setActiveSlotIndex(index);
    }
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation, wordComplete, slots]);

  // Check the spelling
  const handleCheckSpelling = useCallback(() => {
    if (!currentChallenge) return;

    incrementAttempts();
    const attempt = currentAttempts + 1;

    const target = currentChallenge.targetLetters.map(l => l.toLowerCase());
    const placed = slots.map(s => (s || '').toLowerCase());
    const isCorrect = placed.length === target.length && placed.every((l, i) => l === target[i]);

    if (isCorrect) {
      // Track accuracy
      target.forEach((letter) => {
        if (VOWELS.has(letter)) {
          setVowelCorrect(prev => prev + 1);
        } else {
          setConsonantCorrect(prev => prev + 1);
        }
      });

      // Record result via shared hook
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: attempt,
        firstTry: attempt === 1,
      });

      setFeedback(`You spelled "${currentChallenge.targetWord}"!`);
      setFeedbackType('success');
      setWordComplete(true);
      setIsCelebrating(true);
      setTimeout(() => setIsCelebrating(false), 1500);

      sendText(
        `[SPELLING_CORRECT] The student correctly spelled "${currentChallenge.targetWord}"${attempt === 1 ? ' on the first try!' : ` after ${attempt} attempts.`} `
        + `Say "You spelled ${currentChallenge.targetWord}! Great job!" and say the word.`,
        { silent: true }
      );
    } else {
      // Track errors per position
      const wrongPositions: string[] = [];
      target.forEach((letter, i) => {
        if (placed[i] !== letter) {
          const posLabel = i === 0 ? 'beginning' : i === 1 ? 'middle' : 'end';
          wrongPositions.push(posLabel);

          if (VOWELS.has(letter)) {
            setVowelErrors(prev => prev + 1);
          } else {
            setConsonantErrors(prev => prev + 1);
          }
        }
      });

      // Check for vowel confusion specifically (middle position)
      const isVowelConfusion = placed[1] !== target[1] && VOWELS.has(target[1]) && VOWELS.has(placed[1]);

      // Check for known common errors
      const placedStr = placed.join('');
      const matchedError = currentChallenge.commonErrors?.find(e => e.errorSpelling.toLowerCase() === placedStr);

      if (matchedError) {
        setErrorPatterns(prev => [...prev, matchedError.errorSpelling]);
        setFeedback(matchedError.feedback);
        setFeedbackType('error');
      } else {
        setFeedback(`Not quite! Check the ${wrongPositions.join(' and ')} sound${wrongPositions.length > 1 ? 's' : ''}.`);
        setFeedbackType('error');
      }

      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);

      if (isVowelConfusion) {
        const correctVowel = target[1];
        const wrongVowel = placed[1];
        const correctKeyword = VOWEL_KEYWORDS[correctVowel] || correctVowel;
        const wrongKeyword = VOWEL_KEYWORDS[wrongVowel] || wrongVowel;

        sendText(
          `[VOWEL_CONFUSION] The student placed "${wrongVowel}" instead of "${correctVowel}" in the middle of "${currentChallenge.targetWord}". `
          + `Give specific corrective feedback: "Listen again — the middle sound is /${correctVowel}/ as in ${correctKeyword}, not /${wrongVowel}/ as in ${wrongKeyword}." `
          + `Say both sounds so the student can hear the difference.`,
          { silent: true }
        );
      } else {
        sendText(
          `[SPELLING_INCORRECT] The student tried to spell "${currentChallenge.targetWord}" but wrote "${placedStr}". `
          + `The correct spelling is "${target.join('')}". Wrong position(s): ${wrongPositions.join(', ')}. `
          + `This is attempt ${attempt}. Give targeted feedback about the ${wrongPositions[0]} sound without giving the answer.`,
          { silent: true }
        );
      }
    }
  }, [currentChallenge, slots, currentAttempts, incrementAttempts, recordResult, sendText]);

  // Move to next word or submit evaluation
  const handleNextWord = useCallback(() => {
    const advanced = advanceProgress();

    if (!advanced) {
      // All done — submit evaluation
      if (!hasSubmittedEvaluation) {
        const totalWords = challenges.length;
        const wordsCorrect = challengeResults.filter(r => r.correct).length;
        const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);
        const totalVowelAttempts = vowelCorrect + vowelErrors;
        const totalConsonantAttempts = consonantCorrect + consonantErrors;
        const vowelAcc = totalVowelAttempts > 0 ? Math.round((vowelCorrect / totalVowelAttempts) * 100) : 100;
        const consonantAcc = totalConsonantAttempts > 0 ? Math.round((consonantCorrect / totalConsonantAttempts) * 100) : 100;
        const overallAcc = totalWords > 0 ? Math.round((wordsCorrect / totalWords) * 100) : 0;

        const metrics: CvcSpellerMetrics = {
          type: 'cvc-speller',
          vowelFocus,
          wordsSpelledCorrectly: wordsCorrect,
          wordsTotal: totalWords,
          vowelAccuracy: vowelAcc,
          consonantAccuracy: consonantAcc,
          commonErrors: Array.from(new Set(errorPatterns)),
          stretchUsed: stretchUsedCount,
          attemptsCount: totalAttempts,
        };

        submitEvaluation(
          overallAcc >= 60,
          overallAcc,
          metrics,
          { challengeResults }
        );

        // AI celebration
        const phaseStr = `${wordsCorrect}/${totalWords} words correct, vowel accuracy ${vowelAcc}%, consonant accuracy ${consonantAcc}%`;
        sendText(
          `[ALL_COMPLETE] The student finished the CVC spelling activity! Results: ${phaseStr}. `
          + `Overall score: ${overallAcc}%. Give encouraging, specific feedback about their spelling.`,
          { silent: true }
        );
      }
      return;
    }

    // Reset domain state for next challenge
    resetDomainState();
  }, [
    advanceProgress, challenges, challengeResults, hasSubmittedEvaluation,
    vowelCorrect, vowelErrors, consonantCorrect, consonantErrors,
    errorPatterns, stretchUsedCount, vowelFocus,
    submitEvaluation, sendText, resetDomainState,
  ]);

  // Clear all slots
  const handleClearAll = useCallback(() => {
    setSlots([null, null, null]);
    setActiveSlotIndex(0);
    setFeedback('');
    setFeedbackType('');
  }, []);

  // -------------------------------------------------------------------------
  // Overall Score (for PhaseSummaryPanel fallback)
  // -------------------------------------------------------------------------
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    return Math.round((challengeResults.filter(r => r.correct).length / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  // Render the three Elkonin box slots
  const renderSlots = () => {
    if (!currentChallenge) return null;
    return (
      <div className="flex items-center justify-center gap-3">
        {slots.map((letter, index) => {
          const isActive = activeSlotIndex === index;
          const isFilled = letter !== null;
          const isCorrectLetter = wordComplete && letter === currentChallenge.targetLetters[index]?.toLowerCase();

          return (
            <button
              key={index}
              onClick={() => handleSlotTap(index)}
              disabled={allChallengesComplete}
              className={`
                relative w-20 h-20 rounded-xl border-2 flex items-center justify-center
                text-3xl font-bold uppercase transition-all duration-200 cursor-pointer select-none
                ${isCorrectLetter
                  ? 'bg-emerald-500/30 border-emerald-400/60 text-emerald-200 shadow-lg shadow-emerald-500/20'
                  : isActive
                    ? 'bg-blue-500/20 border-blue-400/60 text-blue-200 shadow-md shadow-blue-500/10'
                    : isFilled
                      ? 'bg-slate-700/50 border-slate-500/40 text-slate-200 hover:border-slate-400/60'
                      : 'bg-slate-800/40 border-dashed border-slate-600/40 text-slate-600 hover:border-slate-500/50'
                }
                ${isShaking && isFilled && !isCorrectLetter ? 'animate-shake' : ''}
                ${isCelebrating && isCorrectLetter ? 'animate-bounce' : ''}
              `}
            >
              {letter ? (
                <span>{letter}</span>
              ) : (
                <span className="text-lg">?</span>
              )}
              {/* Position indicator */}
              <span className="absolute -bottom-5 text-[10px] text-slate-600">
                {index === 0 ? 'begin' : index === 1 ? 'middle' : 'end'}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  // Render the letter bank
  const renderLetterBank = () => {
    return (
      <div className="rounded-xl bg-slate-800/40 border border-white/5 p-4">
        <p className="text-xs text-slate-500 mb-3">Letter Bank:</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {letterBank.map((letter, index) => {
            const isVowel = VOWELS.has(letter);
            return (
              <button
                key={`${letter}-${index}`}
                onClick={() => handleSelectLetter(letter)}
                disabled={hasSubmittedEvaluation || wordComplete || activeSlotIndex === null}
                className={`
                  w-12 h-12 rounded-lg border-2 flex items-center justify-center
                  text-xl font-bold uppercase transition-all duration-150
                  cursor-pointer select-none hover:scale-110
                  ${isVowel
                    ? 'bg-red-500/15 border-red-500/30 text-red-300 hover:bg-red-500/25 hover:border-red-400/50'
                    : 'bg-blue-500/15 border-blue-500/30 text-blue-300 hover:bg-blue-500/25 hover:border-blue-400/50'
                  }
                  ${(hasSubmittedEvaluation || wordComplete || activeSlotIndex === null) ? 'opacity-40 cursor-not-allowed hover:scale-100' : ''}
                `}
              >
                {letter}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4 justify-center mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-blue-500/30 border border-blue-500/40" />
            <span className="text-[10px] text-slate-500">consonants</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-500/30 border border-red-500/40" />
            <span className="text-[10px] text-slate-500">vowels</span>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  if (!currentChallenge && !allChallengesComplete) {
    return (
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
        <CardContent className="p-6">
          <p className="text-slate-400 text-center">No spelling challenges available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg text-slate-100">{title}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-400 text-xs">
                {VOWEL_LABELS[vowelFocus] || vowelFocus}
              </Badge>
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-400 text-xs">
                Group {letterGroup}
              </Badge>
            </div>
          </div>
          {!allChallengesComplete && (
            <Badge
              variant="outline"
              className="bg-blue-500/20 border-blue-500/40 text-blue-300 text-xs"
            >
              Word {currentChallengeIndex + 1} / {challenges.length}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Progress dots */}
        {!allChallengesComplete && (
          <div className="flex items-center justify-center gap-1.5">
            {challenges.map((ch, i) => (
              <div
                key={ch.id}
                className={`w-2 h-2 rounded-full transition-all ${
                  i < currentChallengeIndex
                    ? 'bg-emerald-500/60'
                    : i === currentChallengeIndex
                      ? 'bg-blue-400 scale-125'
                      : 'bg-slate-600/40'
                }`}
              />
            ))}
          </div>
        )}

        {/* Audio controls */}
        {!allChallengesComplete && (
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="ghost"
              onClick={handleHearAgain}
              className="bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 text-amber-300"
            >
              <span className="mr-1.5">&#x1F50A;</span> Hear It Again
            </Button>
            <Button
              variant="ghost"
              onClick={handleStretch}
              className="bg-purple-500/15 border border-purple-500/30 hover:bg-purple-500/25 text-purple-300"
            >
              <span className="mr-1.5">&#x1F40C;</span> Stretch It
            </Button>
          </div>
        )}

        {/* Word hint: emoji + description */}
        {currentChallenge && !allChallengesComplete && (
          <div className="flex items-center justify-center gap-3 rounded-xl bg-white/5 border border-white/10 px-5 py-3">
            {currentChallenge.emoji && (
              <span className="text-4xl">{currentChallenge.emoji}</span>
            )}
            {currentChallenge.imageDescription && (
              <p className="text-slate-400 text-sm italic">{currentChallenge.imageDescription}</p>
            )}
          </div>
        )}

        {/* Elkonin box slots */}
        {!allChallengesComplete && (
          <div className="py-4">
            {renderSlots()}
          </div>
        )}

        {/* Feedback */}
        {feedback && !allChallengesComplete && (
          <div
            className={`
              px-4 py-2 rounded-lg text-sm font-medium text-center
              ${feedbackType === 'success'
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                : feedbackType === 'error'
                  ? 'bg-red-500/20 border border-red-500/40 text-red-300'
                  : 'bg-blue-500/20 border border-blue-500/40 text-blue-300'
              }
            `}
          >
            {feedback}
          </div>
        )}

        {/* Letter Bank */}
        {!wordComplete && !allChallengesComplete && renderLetterBank()}

        {/* Action buttons */}
        {!allChallengesComplete && (
          <div className="flex items-center gap-2">
            {!wordComplete && (
              <>
                <Button
                  variant="ghost"
                  onClick={handleClearAll}
                  disabled={slots.every(s => s === null)}
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
                >
                  Clear
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleCheckSpelling}
                  disabled={slots.some(s => s === null)}
                  className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300 ml-auto"
                >
                  Check Spelling
                </Button>
              </>
            )}
            {wordComplete && (
              <Button
                variant="ghost"
                onClick={handleNextWord}
                className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300 ml-auto"
              >
                {currentChallengeIndex < challenges.length - 1 ? 'Next Word' : 'Finish'}
              </Button>
            )}
          </div>
        )}

        {/* Phase Summary Panel */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Spelling Complete!"
            celebrationMessage={`You spelled ${challengeResults.filter(r => r.correct).length} out of ${challenges.length} words correctly!`}
            className="mt-4"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default CvcSpeller;
