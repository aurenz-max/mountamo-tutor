'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { LetterSoundLinkMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface LetterSoundLinkChallenge {
  id: string;
  mode: 'see-hear' | 'hear-see' | 'keyword-match';
  targetLetter: string;
  targetSound: string;
  keywordWord: string;
  keywordImage: string;
  options?: Array<{ letter?: string; sound?: string; isCorrect: boolean }>;
  sharedSoundLetters?: string[];
}

export interface LetterSoundLinkData {
  title: string;
  letterGroup: 1 | 2 | 3 | 4;
  cumulativeLetters: string[];
  challenges: LetterSoundLinkChallenge[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<LetterSoundLinkMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const MODE_CONFIG: Record<string, { label: string; description: string; icon: string }> = {
  'see-hear': { label: 'See → Hear', description: 'See a letter, pick its sound', icon: '👁️' },
  'hear-see': { label: 'Hear → See', description: 'Hear a sound, find the letter', icon: '👂' },
  'keyword-match': { label: 'Keyword Match', description: 'Match letter to keyword', icon: '🖼️' },
};

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'see-hear': { label: 'See → Hear', accentColor: 'blue' },
  'hear-see': { label: 'Hear → See', accentColor: 'purple' },
  'keyword-match': { label: 'Keyword Match', accentColor: 'emerald' },
};

/** Vowels for color-coding: vowels = red, consonants = blue */
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/** Keyword image emoji/icon mapping */
const KEYWORD_IMAGES: Record<string, string> = {
  sun: '☀️', apple: '🍎', top: '🔝', itch: '🤏', pig: '🐷', net: '🥅',
  cat: '🐱', kite: '🪁', egg: '🥚', hat: '🎩', run: '🏃', map: '🗺️', dog: '🐶',
  go: '🟢', octopus: '🐙', up: '⬆️', lip: '👄', fan: '🌬️', bat: '🦇',
  jam: '🍯', zip: '⚡', web: '🕸️', van: '🚐', yes: '✅', box: '📦', queen: '👑',
};

const MAX_ATTEMPTS = 3;

// ============================================================================
// Props
// ============================================================================

interface LetterSoundLinkProps {
  data: LetterSoundLinkData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const LetterSoundLink: React.FC<LetterSoundLinkProps> = ({ data, className }) => {
  const {
    title,
    letterGroup,
    cumulativeLetters = [],
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
  const stableInstanceIdRef = useRef(instanceId || `letter-sound-link-${Date.now()}`);
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
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [isLocked, setIsLocked] = useState(false);
  const [confusedPairs, setConfusedPairs] = useState<Array<[string, string]>>([]);
  const [submittedResult, setSubmittedResult] = useState<{ score: number } | null>(null);

  // Per-mode tracking for evaluation metrics
  const [seeHearResults, setSeeHearResults] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 });
  const [hearSeeResults, setHearSeeResults] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 });
  const [vowelResults, setVowelResults] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 });
  const [consonantResults, setConsonantResults] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 });

  const currentChallenge = challenges[currentChallengeIndex];

  // ---------------------------------------------------------------------------
  // Evaluation hook
  // ---------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<LetterSoundLinkMetrics>({
    primitiveType: 'letter-sound-link',
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
    challengeMode: currentChallenge?.mode ?? '',
    targetLetter: currentChallenge?.targetLetter ?? '',
    targetSound: currentChallenge?.targetSound ?? '',
    keywordWord: currentChallenge?.keywordWord ?? '',
    sharedSoundLetters: currentChallenge?.sharedSoundLetters?.join(', ') ?? '',
    currentChallenge: currentChallengeIndex + 1,
    totalChallenges: challenges.length,
    attempts: currentAttempts,
  }), [
    letterGroup, currentChallenge, currentChallengeIndex,
    challenges.length, currentAttempts,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'letter-sound-link',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'K',
  });

  // Activity introduction — once on AI connect
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || !currentChallenge) return;
    hasIntroducedRef.current = true;

    sendText(
      `[ACTIVITY_START] Letter-sound correspondence activity for Group ${letterGroup} `
      + `(letters: ${cumulativeLetters.join(', ')}). `
      + `There are ${challenges.length} challenges. `
      + `Introduce the activity warmly — we're learning the SOUNDS that letters make! `
      + `First challenge: "${currentChallenge.targetLetter.toUpperCase()}" makes the sound ${currentChallenge.targetSound}. `
      + `[SAY_KEYWORD] ${currentChallenge.targetSound} as in ${currentChallenge.keywordWord}. `
      + `Keep it brief — 2-3 sentences.`,
      { silent: true },
    );
  }, [isConnected, currentChallenge, letterGroup, cumulativeLetters, challenges.length, sendText]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Is a letter a vowel? */
  const isVowel = useCallback((letter: string) => VOWELS.has(letter.toLowerCase()), []);

  /** Get color class for a letter based on vowel/consonant */
  const getLetterColorClass = useCallback((letter: string) => {
    return isVowel(letter) ? 'text-red-300' : 'text-blue-300';
  }, [isVowel]);

  /** Get the emoji for a keyword */
  const getKeywordEmoji = useCallback((keyword: string) => {
    return KEYWORD_IMAGES[keyword.toLowerCase()] || '📝';
  }, []);

  /** Track confused sound pairs */
  const trackConfusion = useCallback((targetSound: string, chosenSound: string) => {
    setConfusedPairs(prev => [...prev, [targetSound, chosenSound]]);
  }, []);

  /** Update per-mode accuracy counters */
  const updateModeAccuracy = useCallback((mode: string, isCorrect: boolean, letter: string) => {
    if (mode === 'see-hear') {
      setSeeHearResults(prev => ({ correct: prev.correct + (isCorrect ? 1 : 0), total: prev.total + 1 }));
    } else if (mode === 'hear-see') {
      setHearSeeResults(prev => ({ correct: prev.correct + (isCorrect ? 1 : 0), total: prev.total + 1 }));
    }
    if (isVowel(letter)) {
      setVowelResults(prev => ({ correct: prev.correct + (isCorrect ? 1 : 0), total: prev.total + 1 }));
    } else {
      setConsonantResults(prev => ({ correct: prev.correct + (isCorrect ? 1 : 0), total: prev.total + 1 }));
    }
  }, [isVowel]);

  // ---------------------------------------------------------------------------
  // Option selection handler (all modes)
  // ---------------------------------------------------------------------------
  const handleOptionSelect = useCallback((optionIndex: number) => {
    if (isLocked || hasSubmittedEvaluation || !currentChallenge) return;

    const options = currentChallenge.options || [];
    const option = options[optionIndex];
    if (!option) return;

    setSelectedOption(optionIndex);
    incrementAttempts();

    const isCorrect = option.isCorrect;

    if (isCorrect) {
      const modeLabel = MODE_CONFIG[currentChallenge.mode]?.label ?? currentChallenge.mode;
      setFeedback(
        currentChallenge.mode === 'keyword-match'
          ? `Yes! "${currentChallenge.targetLetter.toUpperCase()}" makes ${currentChallenge.targetSound}, like in "${currentChallenge.keywordWord}"!`
          : `Yes! The letter "${currentChallenge.targetLetter.toUpperCase()}" makes the sound ${currentChallenge.targetSound}!`
      );
      setFeedbackType('success');
      setIsLocked(true);

      updateModeAccuracy(currentChallenge.mode, true, currentChallenge.targetLetter);

      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        mode: currentChallenge.mode,
        targetLetter: currentChallenge.targetLetter,
        targetSound: currentChallenge.targetSound,
      });

      sendText(
        `[ANSWER_CORRECT] The student correctly identified the letter-sound link! `
        + `Letter "${currentChallenge.targetLetter.toUpperCase()}" → sound ${currentChallenge.targetSound}. `
        + `${currentAttempts === 0 ? 'First try!' : `After ${currentAttempts + 1} attempts.`} `
        + `[PRONOUNCE_SOUND] ${currentChallenge.targetSound}. `
        + `Say "Yes! The letter ${currentChallenge.targetLetter.toUpperCase()} makes the sound ${currentChallenge.targetSound}!" `
        + `${currentChallenge.sharedSoundLetters && currentChallenge.sharedSoundLetters.length > 0
          ? `Fun fact: ${currentChallenge.sharedSoundLetters.join(' and ')} also make this sound!`
          : ''}`,
        { silent: true },
      );

      // For hear-see mode, ask AI to pronounce the sound on correct
      if (currentChallenge.mode === 'see-hear') {
        sendText(
          `[PRONOUNCE_SOUND] Say only the sound ${currentChallenge.targetSound}. Just the sound, nothing else.`,
          { silent: true },
        );
      }
    } else {
      const wrongDisplay = currentChallenge.mode === 'hear-see'
        ? `letter "${option.letter || '?'}"`
        : `sound "${option.sound || '?'}"`;
      setFeedback('Not quite! Try again.');
      setFeedbackType('error');

      // Track confusion
      if (currentChallenge.mode === 'see-hear' && option.sound) {
        trackConfusion(currentChallenge.targetSound, option.sound);
      } else if (currentChallenge.mode === 'hear-see' && option.letter) {
        trackConfusion(currentChallenge.targetLetter, option.letter);
      }

      sendText(
        `[ANSWER_INCORRECT] The student chose ${wrongDisplay} but the correct answer is `
        + `letter "${currentChallenge.targetLetter.toUpperCase()}" → sound ${currentChallenge.targetSound}. `
        + `Attempt ${currentAttempts + 1}. `
        + `[SAY_KEYWORD] ${currentChallenge.targetSound} as in ${currentChallenge.keywordWord}. `
        + `Give a brief hint connecting the letter to its keyword.`,
        { silent: true },
      );

      // After max attempts, reveal and lock
      if (currentAttempts + 1 >= MAX_ATTEMPTS) {
        setFeedback(
          `The letter "${currentChallenge.targetLetter.toUpperCase()}" makes the sound ${currentChallenge.targetSound}, like in "${currentChallenge.keywordWord}".`
        );
        setFeedbackType('error');
        setIsLocked(true);

        updateModeAccuracy(currentChallenge.mode, false, currentChallenge.targetLetter);

        recordResult({
          challengeId: currentChallenge.id,
          correct: false,
          attempts: currentAttempts + 1,
          mode: currentChallenge.mode,
          targetLetter: currentChallenge.targetLetter,
          targetSound: currentChallenge.targetSound,
        });

        sendText(
          `[NEW_SOUND_INTRO] The student couldn't get this one. `
          + `Say: "This letter is ${currentChallenge.targetLetter.toUpperCase()}, and it makes the sound ${currentChallenge.targetSound}, like in ${currentChallenge.keywordWord}!" `
          + `[PRONOUNCE_SOUND] ${currentChallenge.targetSound}. Keep it encouraging.`,
          { silent: true },
        );
      }
    }
  }, [
    isLocked, hasSubmittedEvaluation, currentChallenge, currentAttempts,
    incrementAttempts, recordResult, sendText, trackConfusion, updateModeAccuracy,
  ]);

  // ---------------------------------------------------------------------------
  // Tap option to hear it (for see-hear and hear-see modes)
  // ---------------------------------------------------------------------------
  const handleTapToHear = useCallback((soundOrLetter: string, isSound: boolean) => {
    sendText(
      isSound
        ? `[TAP_OPTION] Say only the sound ${soundOrLetter}. Just the clean phoneme, nothing else.`
        : `[TAP_OPTION] Say the name of the letter "${soundOrLetter.toUpperCase()}". Just the letter name, nothing else.`,
      { silent: true },
    );
  }, [sendText]);

  // ---------------------------------------------------------------------------
  // Submit final evaluation
  // ---------------------------------------------------------------------------
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;

    const total = challengeResults.length;
    const correct = challengeResults.filter(r => r.correct).length;
    const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const elapsedMs = Date.now() - startTimeRef.current;
    const overallScore = total > 0 ? Math.round((correct / total) * 100) : 0;

    // Deduplicate confused pairs
    const uniquePairs = Array.from(
      new Set(confusedPairs.map(([a, b]) => [a, b].sort().join('↔')))
    );

    const metrics: LetterSoundLinkMetrics = {
      type: 'letter-sound-link',
      letterGroup,
      challengesCorrect: correct,
      challengesTotal: total,
      graphemeToPhonemeAccuracy: seeHearResults.total > 0
        ? Math.round((seeHearResults.correct / seeHearResults.total) * 100) : 100,
      phonemeToGraphemeAccuracy: hearSeeResults.total > 0
        ? Math.round((hearSeeResults.correct / hearSeeResults.total) * 100) : 100,
      vowelSoundAccuracy: vowelResults.total > 0
        ? Math.round((vowelResults.correct / vowelResults.total) * 100) : 100,
      consonantSoundAccuracy: consonantResults.total > 0
        ? Math.round((consonantResults.correct / consonantResults.total) * 100) : 100,
      confusedSoundPairs: uniquePairs,
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
      `[ALL_COMPLETE] Student finished all ${total} letter-sound challenges! `
      + `Score: ${correct}/${total} (${overallScore}%). ${phaseScoreStr}. `
      + (uniquePairs.length > 0 ? `Confused sound pairs: ${uniquePairs.join(', ')}. ` : '')
      + `Celebrate and give encouraging feedback about their letter-sound knowledge!`,
      { silent: true },
    );
  }, [
    hasSubmittedEvaluation, challengeResults, letterGroup, confusedPairs,
    seeHearResults, hearSeeResults, vowelResults, consonantResults,
    phaseResults, submitEvaluation, sendText,
  ]);

  // Auto-submit when complete
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      submitFinalEvaluation();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, submitFinalEvaluation]);

  // Compute score directly from results for immediate display (avoids 0% flash)
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challengeResults.length === 0) return 0;
    const correct = challengeResults.filter(r => r.correct).length;
    return Math.round((correct / challengeResults.length) * 100);
  }, [allChallengesComplete, challengeResults]);

  // ---------------------------------------------------------------------------
  // Advance to next challenge
  // ---------------------------------------------------------------------------
  const handleNextChallenge = useCallback(() => {
    setSelectedOption(null);
    setFeedback('');
    setFeedbackType('');
    setIsLocked(false);

    if (!advanceProgress()) {
      submitFinalEvaluation();
      return;
    }

    const nextChallenge = challenges[currentChallengeIndex + 1];
    if (!nextChallenge) return;

    const modeLabel = MODE_CONFIG[nextChallenge.mode]?.description ?? nextChallenge.mode;

    sendText(
      `[NEXT_CHALLENGE] Challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
      + `${modeLabel}. Target: letter "${nextChallenge.targetLetter.toUpperCase()}" → sound ${nextChallenge.targetSound}. `
      + `[SAY_KEYWORD] ${nextChallenge.targetSound} as in ${nextChallenge.keywordWord}. `
      + `Briefly introduce the new challenge.`,
      { silent: true },
    );
  }, [advanceProgress, submitFinalEvaluation, challenges, currentChallengeIndex, sendText]);

  // ============================================================================
  // Render: See → Hear Mode
  // ============================================================================
  const renderSeeHear = () => {
    if (!currentChallenge) return null;
    const options = currentChallenge.options || [];
    const letterColor = getLetterColorClass(currentChallenge.targetLetter);

    return (
      <div className="space-y-6">
        {/* Large letter display */}
        <div className="flex flex-col items-center gap-2">
          <div className={`
            text-8xl font-bold ${letterColor}
            bg-white/5 border-2 border-white/15 rounded-2xl
            px-12 py-8 select-none
          `}>
            {currentChallenge.targetLetter.toUpperCase()}
          </div>
          <p className="text-slate-400 text-sm">What sound does this letter make?</p>
        </div>

        {/* Keyword hint */}
        <div className="flex items-center justify-center gap-2 text-slate-500 text-xs">
          <span className="text-lg">{getKeywordEmoji(currentChallenge.keywordWord)}</span>
          <span>Think of &quot;{currentChallenge.keywordWord}&quot;</span>
        </div>

        {/* Sound options */}
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
          {options.map((option, idx) => {
            const isSelected = selectedOption === idx;
            const showCorrect = isLocked && option.isCorrect;
            const showWrong = isSelected && feedbackType === 'error' && !option.isCorrect;

            return (
              <div key={idx} className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  onClick={() => handleOptionSelect(idx)}
                  disabled={isLocked}
                  className={`
                    h-16 text-xl font-bold transition-all
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
                  {option.sound || '?'}
                </Button>
                {/* Tap to hear button */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleTapToHear(option.sound || '', true); }}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  tap to hear
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ============================================================================
  // Render: Hear → See Mode
  // ============================================================================
  const renderHearSee = () => {
    if (!currentChallenge) return null;
    const options = currentChallenge.options || [];

    return (
      <div className="space-y-6">
        {/* Sound display with play button */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => handleTapToHear(currentChallenge.targetSound, true)}
            className="
              text-6xl font-bold text-amber-300
              bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl
              px-12 py-8 select-none cursor-pointer
              hover:bg-amber-500/20 hover:scale-105 transition-all
            "
          >
            {currentChallenge.targetSound}
          </button>
          <p className="text-slate-400 text-sm">Tap the sound to hear it, then find the letter!</p>
        </div>

        {/* Shared sound note */}
        {currentChallenge.sharedSoundLetters && currentChallenge.sharedSoundLetters.length > 0 && (
          <p className="text-center text-xs text-slate-600">
            Hint: More than one letter might make this sound!
          </p>
        )}

        {/* Letter options */}
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
          {options.map((option, idx) => {
            const isSelected = selectedOption === idx;
            const showCorrect = isLocked && option.isCorrect;
            const showWrong = isSelected && feedbackType === 'error' && !option.isCorrect;
            const letter = option.letter || '?';
            const letterColor = getLetterColorClass(letter);

            return (
              <Button
                key={idx}
                variant="ghost"
                onClick={() => handleOptionSelect(idx)}
                disabled={isLocked}
                className={`
                  h-16 text-3xl font-bold transition-all
                  ${showCorrect
                    ? 'bg-emerald-500/30 border-2 border-emerald-400/60 text-emerald-200'
                    : showWrong
                      ? 'bg-red-500/20 border-2 border-red-500/40 text-red-300'
                      : isSelected
                        ? 'bg-blue-500/20 border-2 border-blue-500/40 text-blue-200'
                        : `bg-white/5 border border-white/20 hover:bg-white/10 ${letterColor}`
                  }
                `}
              >
                {letter.toUpperCase()}
              </Button>
            );
          })}
        </div>
      </div>
    );
  };

  // ============================================================================
  // Render: Keyword Match Mode
  // ============================================================================
  const renderKeywordMatch = () => {
    if (!currentChallenge) return null;
    const options = currentChallenge.options || [];
    const letterColor = getLetterColorClass(currentChallenge.targetLetter);

    return (
      <div className="space-y-6">
        {/* Letter and sound display */}
        <div className="flex flex-col items-center gap-2">
          <div className={`
            text-7xl font-bold ${letterColor}
            bg-white/5 border-2 border-white/15 rounded-2xl
            px-10 py-6 select-none
          `}>
            {currentChallenge.targetLetter.toUpperCase()}
          </div>
          <div className="text-xl text-slate-400 font-mono">
            {currentChallenge.targetSound}
          </div>
          <p className="text-slate-400 text-sm">Which picture matches this letter&apos;s sound?</p>
        </div>

        {/* Keyword image options */}
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
          {options.map((option, idx) => {
            const isSelected = selectedOption === idx;
            const showCorrect = isLocked && option.isCorrect;
            const showWrong = isSelected && feedbackType === 'error' && !option.isCorrect;
            const keyword = option.sound || '';
            const emoji = getKeywordEmoji(keyword);

            return (
              <Button
                key={idx}
                variant="ghost"
                onClick={() => handleOptionSelect(idx)}
                disabled={isLocked}
                className={`
                  h-24 flex flex-col gap-1 transition-all
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
                <span className="text-3xl">{emoji}</span>
                <span className="text-sm">{keyword}</span>
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
                    currentChallenge.mode === 'see-hear'
                      ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                      : currentChallenge.mode === 'hear-see'
                        ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                        : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  }`}
                >
                  {MODE_CONFIG[currentChallenge.mode]?.label || currentChallenge.mode}
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
            {currentChallenge.mode === 'see-hear' && renderSeeHear()}
            {currentChallenge.mode === 'hear-see' && renderHearSee()}
            {currentChallenge.mode === 'keyword-match' && renderKeywordMatch()}
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
            heading="Letter-Sound Link Complete!"
            celebrationMessage="Great job connecting letters to their sounds!"
            className="mb-6"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default LetterSoundLink;
