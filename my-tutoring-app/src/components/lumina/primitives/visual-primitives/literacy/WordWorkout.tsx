'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { WordWorkoutMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type WordWorkoutMode =
  | 'real-vs-nonsense'
  | 'picture-match'
  | 'word-chains'
  | 'sentence-reading';

export interface WordWorkoutChallenge {
  id: string;
  /** Per-challenge mode (for multi-mode sessions). Falls back to top-level mode. */
  mode?: WordWorkoutMode;
  // Real vs. Nonsense
  realWord?: string;
  nonsenseWord?: string;
  // Picture Match
  targetWord?: string;
  targetImage?: string;
  distractorImages?: Array<{ word: string; image: string }>;
  // Word Chains
  chain?: string[];
  changedPositions?: number[];
  // Sentence Reading
  sentence?: string;
  cvcWords?: string[];
  sightWords?: string[];
  comprehensionQuestion?: string;
  comprehensionAnswer?: string;
}

export interface WordWorkoutData {
  title: string;
  /** Default/primary mode. Per-challenge mode overrides this. */
  mode: WordWorkoutMode;
  masteredVowels: string[];
  challenges: WordWorkoutChallenge[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (
    result: PrimitiveEvaluationResult<WordWorkoutMetrics>
  ) => void;
}

// ============================================================================
// Props
// ============================================================================

interface WordWorkoutProps {
  data: WordWorkoutData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const MODE_CONFIG: Record<
  WordWorkoutMode,
  { label: string; icon: string; instruction: string }
> = {
  'real-vs-nonsense': {
    label: 'Real vs. Nonsense',
    icon: '\uD83D\uDD24',
    instruction: 'Which is a real word?',
  },
  'picture-match': {
    label: 'Picture Match',
    icon: '\uD83D\uDDBC\uFE0F',
    instruction: 'Which picture matches this word?',
  },
  'word-chains': {
    label: 'Word Chains',
    icon: '\uD83D\uDD17',
    instruction: 'Read each word as it changes',
  },
  'sentence-reading': {
    label: 'Sentence Reading',
    icon: '\uD83D\uDCD6',
    instruction: 'Read this sentence',
  },
};

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'real-vs-nonsense': { label: 'Real vs. Nonsense', icon: '\uD83D\uDD24', accentColor: 'blue' },
  'picture-match': { label: 'Picture Match', icon: '\uD83D\uDDBC\uFE0F', accentColor: 'purple' },
  'word-chains': { label: 'Word Chains', icon: '\uD83D\uDD17', accentColor: 'emerald' },
  'sentence-reading': { label: 'Sentence Reading', icon: '\uD83D\uDCD6', accentColor: 'amber' },
};

/** Attempt-based scoring: first try = 100, 2nd = 80, 3+ = 60 */
function attemptScore(attempts: number): number {
  if (attempts <= 1) return 100;
  if (attempts === 2) return 80;
  return 60;
}

// ============================================================================
// Component
// ============================================================================

const WordWorkout: React.FC<WordWorkoutProps> = ({ data, className }) => {
  const {
    title,
    mode: defaultMode,
    masteredVowels = [],
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── Challenge progression ─────────────────────────────────────────
  const {
    currentIndex,
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

  const currentChallenge = challenges[currentIndex];
  const currentMode: WordWorkoutMode = currentChallenge?.mode || defaultMode;

  // ── Phase results for PhaseSummaryPanel ───────────────────────────
  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.mode || defaultMode,
    phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) =>
      rs.length > 0
        ? Math.round(rs.reduce((s, r) => s + (r.score ?? 100), 0) / rs.length)
        : 0,
  });

  // ── UI state ──────────────────────────────────────────────────────
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [isShaking, setIsShaking] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [showNext, setShowNext] = useState(false);

  // Word Chains state
  const [chainPosition, setChainPosition] = useState(0);
  const [chainStartTime, setChainStartTime] = useState<number | null>(null);

  // Sentence Reading state
  const [tappedWords, setTappedWords] = useState<Set<string>>(new Set());
  const [showComprehension, setShowComprehension] = useState(false);
  const [comprehensionSelected, setComprehensionSelected] = useState<string | null>(null);

  // Tracking
  const [chainWPMs, setChainWPMs] = useState<number[]>([]);
  const [wordsReadTotal, setWordsReadTotal] = useState(0);
  const [wordsReadIndependent, setWordsReadIndependent] = useState(0);

  // ── Stable instance ID ────────────────────────────────────────────
  const stableInstanceIdRef = useRef(
    instanceId || `word-workout-${Date.now()}`
  );
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Evaluation ────────────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<WordWorkoutMetrics>({
      primitiveType: 'word-workout',
      instanceId: resolvedInstanceId,
      skillId,
      subskillId,
      objectiveId,
      exhibitId,
      onSubmit: onEvaluationSubmit as
        | ((result: PrimitiveEvaluationResult) => void)
        | undefined,
    });

  // ── AI Tutoring ───────────────────────────────────────────────────
  const aiPrimitiveData = useMemo(
    () => ({
      mode: currentMode,
      masteredVowels: masteredVowels.join(', '),
      currentChallenge: currentIndex + 1,
      totalChallenges: challenges.length,
      currentPhase: currentMode,
      attempts: currentAttempts,
    }),
    [currentMode, masteredVowels, currentIndex, challenges.length, currentAttempts]
  );

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'word-workout',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'K-2',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || !currentChallenge) return;
    hasIntroducedRef.current = true;

    const modeCount = new Set(challenges.map((ch) => ch.mode || defaultMode)).size;
    const isMultiMode = modeCount > 1;

    sendText(
      `[ACTIVITY_START] CVC Word Workout${isMultiMode ? ' \u2014 multi-mode session with ' + modeCount + ' activity types' : ' \u2014 ' + MODE_CONFIG[currentMode].label + ' mode'}. `
      + `${challenges.length} challenges. Mastered vowels: ${masteredVowels.join(', ') || 'all'}. `
      + `Introduce warmly for a young reader. 2-3 sentences.`,
      { silent: true }
    );
  }, [isConnected, currentChallenge, currentMode, defaultMode, challenges, masteredVowels, sendText]);

  // ── Derived values (stable per challenge) ─────────────────────────
  const shuffledPair = useMemo(() => {
    if (
      currentMode !== 'real-vs-nonsense' ||
      !currentChallenge?.realWord ||
      !currentChallenge?.nonsenseWord
    )
      return [];
    const seed = currentChallenge.id
      .split('')
      .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return seed % 2 === 0
      ? [currentChallenge.realWord, currentChallenge.nonsenseWord]
      : [currentChallenge.nonsenseWord, currentChallenge.realWord];
  }, [currentMode, currentChallenge]);

  const pictureOptions = useMemo(() => {
    if (currentMode !== 'picture-match' || !currentChallenge?.targetWord) return [];
    const opts = [
      {
        word: currentChallenge.targetWord,
        image: currentChallenge.targetImage || '',
      },
      ...(currentChallenge.distractorImages || []),
    ];
    const shuffled = [...opts];
    const seed = currentChallenge.id
      .split('')
      .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = (seed + i) % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [currentMode, currentChallenge]);

  // ── Helpers ───────────────────────────────────────────────────────
  const resetChallengeState = useCallback(() => {
    setSelectedAnswer(null);
    setFeedback('');
    setFeedbackType('');
    setIsShaking(false);
    setIsCelebrating(false);
    setShowNext(false);
    setChainPosition(0);
    setChainStartTime(null);
    setTappedWords(new Set());
    setShowComprehension(false);
    setComprehensionSelected(null);
  }, []);

  const handlePronounce = useCallback(
    (word: string) => {
      sendText(`[PRONOUNCE] "${word}"`, { silent: true });
    },
    [sendText]
  );

  // ── Final evaluation ──────────────────────────────────────────────
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;

    const total = challenges.length;
    const correctCount = challengeResults.filter((r) => r.correct).length;
    const accuracy =
      total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const totalAttempts = challengeResults.reduce(
      (sum, r) => sum + r.attempts,
      0
    );

    // Per-mode accuracy
    const modeResults = (m: WordWorkoutMode) =>
      challengeResults.filter(
        (r, i) => (challenges[i]?.mode || defaultMode) === m
      );
    const modeAccuracy = (m: WordWorkoutMode) => {
      const rs = modeResults(m);
      return rs.length > 0
        ? Math.round(rs.filter((r) => r.correct).length / rs.length * 100)
        : 0;
    };

    const avgWPM =
      chainWPMs.length > 0
        ? Math.round(
            chainWPMs.reduce((s, v) => s + v, 0) / chainWPMs.length
          )
        : 0;

    const comprResults = challengeResults.filter(
      (r) => r.comprehensionCorrect !== undefined
    );
    const comprCorrect =
      comprResults.length > 0
        ? comprResults.every((r) => r.comprehensionCorrect)
        : false;

    const metrics: WordWorkoutMetrics = {
      type: 'word-workout',
      mode: defaultMode,
      challengesCorrect: correctCount,
      challengesTotal: total,
      realVsNonsenseAccuracy: modeAccuracy('real-vs-nonsense'),
      pictureMatchAccuracy: modeAccuracy('picture-match'),
      wordChainFluency: avgWPM,
      sentenceComprehensionCorrect: comprCorrect,
      wordsReadIndependently: wordsReadIndependent,
      wordsTotal: wordsReadTotal,
      attemptsCount: totalAttempts,
    };

    submitEvaluation(accuracy >= 60, accuracy, metrics, {
      challengeResults,
    });

    // Build phase score string for AI
    const phaseScoreStr = Object.entries(PHASE_TYPE_CONFIG)
      .map(([m, cfg]) => {
        const rs = modeResults(m as WordWorkoutMode);
        return rs.length > 0 ? `${cfg.label}: ${modeAccuracy(m as WordWorkoutMode)}%` : null;
      })
      .filter(Boolean)
      .join(', ');

    sendText(
      `[SESSION_COMPLETE] Completed all ${total} challenges. ${phaseScoreStr}. `
      + `Overall: ${accuracy}%. Celebrate and give phase-specific feedback.`,
      { silent: true }
    );
  }, [
    hasSubmittedEvaluation,
    challenges,
    challengeResults,
    defaultMode,
    chainWPMs,
    wordsReadIndependent,
    wordsReadTotal,
    submitEvaluation,
    sendText,
  ]);

  // ── Real vs. Nonsense ─────────────────────────────────────────────
  const handleRealNonsenseSelect = useCallback(
    (word: string) => {
      if (hasSubmittedEvaluation || showNext || !currentChallenge) return;
      setSelectedAnswer(word);
      incrementAttempts();

      const isCorrect = word === currentChallenge.realWord;

      if (isCorrect) {
        setFeedback("Correct! That's a real word!");
        setFeedbackType('success');
        setIsCelebrating(true);
        setShowNext(true);
        setTimeout(() => setIsCelebrating(false), 1500);

        recordResult({
          challengeId: currentChallenge.id,
          correct: true,
          attempts: currentAttempts + 1,
          score: attemptScore(currentAttempts + 1),
        });
        sendText(
          `[ANSWER_CORRECT] Correctly identified "${currentChallenge.realWord}" as real `
          + `(vs "${currentChallenge.nonsenseWord}"). Congratulate briefly.`,
          { silent: true }
        );
      } else {
        setFeedback('Try again! Sound out both words.');
        setFeedbackType('error');
        setIsShaking(true);
        setTimeout(() => {
          setIsShaking(false);
          setSelectedAnswer(null);
        }, 800);
        sendText(
          `[ANSWER_INCORRECT] Picked "${word}" but real word is "${currentChallenge.realWord}". `
          + `Attempt ${currentAttempts + 1}. Hint: "Try sounding both out."`,
          { silent: true }
        );
      }
    },
    [
      hasSubmittedEvaluation,
      showNext,
      currentChallenge,
      currentAttempts,
      incrementAttempts,
      recordResult,
      sendText,
    ]
  );

  // ── Picture Match ─────────────────────────────────────────────────
  const handlePictureSelect = useCallback(
    (word: string) => {
      if (hasSubmittedEvaluation || showNext || !currentChallenge) return;
      setSelectedAnswer(word);
      incrementAttempts();

      const isCorrect = word === currentChallenge.targetWord;

      if (isCorrect) {
        setFeedback('Correct! Great match!');
        setFeedbackType('success');
        setIsCelebrating(true);
        setShowNext(true);
        setTimeout(() => setIsCelebrating(false), 1500);

        recordResult({
          challengeId: currentChallenge.id,
          correct: true,
          attempts: currentAttempts + 1,
          score: attemptScore(currentAttempts + 1),
        });
        sendText(
          `[ANSWER_CORRECT] Matched "${currentChallenge.targetWord}" correctly. Congratulate briefly.`,
          { silent: true }
        );
      } else {
        setFeedback('Not quite! Read the word again carefully.');
        setFeedbackType('error');
        setIsShaking(true);
        setTimeout(() => {
          setIsShaking(false);
          setSelectedAnswer(null);
        }, 800);
        sendText(
          `[ANSWER_INCORRECT] Picked "${word}" but word is "${currentChallenge.targetWord}". `
          + `Attempt ${currentAttempts + 1}. Hint: "Read the word again carefully."`,
          { silent: true }
        );
      }
    },
    [
      hasSubmittedEvaluation,
      showNext,
      currentChallenge,
      currentAttempts,
      incrementAttempts,
      recordResult,
      sendText,
    ]
  );

  // ── Word Chains ───────────────────────────────────────────────────
  const handleChainAdvance = useCallback(() => {
    if (!currentChallenge?.chain) return;
    const chain = currentChallenge.chain;

    if (chainStartTime === null) {
      setChainStartTime(Date.now());
      sendText(
        `[CHAIN_WORD] "${chain[0]}". Say the word.`,
        { silent: true }
      );
      return;
    }

    const nextPos = chainPosition + 1;
    if (nextPos < chain.length) {
      setChainPosition(nextPos);
      const prevWord = chain[chainPosition];
      const nextWord = chain[nextPos];
      const changedIdx = currentChallenge.changedPositions?.[chainPosition];
      const posLabel =
        changedIdx === 0 ? 'first' : changedIdx === 2 ? 'last' : 'middle';
      sendText(
        `[CHAIN_WORD] "${nextWord}" \u2014 changed the ${posLabel} letter from "${prevWord}". Say it.`,
        { silent: true }
      );
    } else {
      const elapsed = Math.max((Date.now() - chainStartTime) / 1000, 0.5);
      const wpm = Math.round((chain.length / elapsed) * 60);
      setChainWPMs((prev) => [...prev, wpm]);
      setShowNext(true);
      setIsCelebrating(true);
      setTimeout(() => setIsCelebrating(false), 1500);

      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: 1,
        score: 100,
        wpm,
      });
      sendText(
        `[ANSWER_CORRECT] Read the word chain (${chain.length} words) at ~${wpm} WPM. Celebrate briefly.`,
        { silent: true }
      );
    }
  }, [currentChallenge, chainPosition, chainStartTime, recordResult, sendText]);

  // ── Sentence Reading ──────────────────────────────────────────────
  const handleWordTap = useCallback(
    (word: string) => {
      const clean = word.replace(/[.,!?'"]/g, '');
      setTappedWords((prev) => new Set(Array.from(prev).concat(clean)));
      sendText(`[PRONOUNCE] "${clean}"`, { silent: true });
    },
    [sendText]
  );

  const handleModelRead = useCallback(() => {
    if (!currentChallenge?.sentence) return;
    sendText(`[READ_SENTENCE] "${currentChallenge.sentence}"`, {
      silent: true,
    });
  }, [currentChallenge, sendText]);

  const handleSentenceDone = useCallback(() => {
    if (!currentChallenge?.sentence) return;
    const allWords = currentChallenge.sentence
      .split(/\s+/)
      .map((w) => w.replace(/[.,!?'"]/g, ''));
    const independent = allWords.filter((w) => !tappedWords.has(w)).length;
    setWordsReadTotal((prev) => prev + allWords.length);
    setWordsReadIndependent((prev) => prev + independent);

    if (currentChallenge.comprehensionQuestion) {
      setShowComprehension(true);
    } else {
      setShowNext(true);
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: 1,
        score: 100,
        wordsIndependent: independent,
        wordsTotal: allWords.length,
      });
    }
  }, [currentChallenge, tappedWords, recordResult]);

  const handleComprehensionSelect = useCallback(
    (choice: string) => {
      if (!currentChallenge?.comprehensionAnswer || showNext) return;
      setComprehensionSelected(choice);
      incrementAttempts();

      const isCorrect =
        choice.toLowerCase().trim() ===
        currentChallenge.comprehensionAnswer.toLowerCase().trim();

      if (isCorrect) {
        setFeedback('Great reading comprehension!');
        setFeedbackType('success');
        setShowNext(true);
        setIsCelebrating(true);
        setTimeout(() => setIsCelebrating(false), 1500);

        const allWords = (currentChallenge.sentence || '')
          .split(/\s+/)
          .map((w) => w.replace(/[.,!?'"]/g, ''));
        const independent = allWords.filter((w) => !tappedWords.has(w)).length;
        recordResult({
          challengeId: currentChallenge.id,
          correct: true,
          attempts: currentAttempts + 1,
          score: attemptScore(currentAttempts + 1),
          comprehensionCorrect: true,
          wordsIndependent: independent,
          wordsTotal: allWords.length,
        });
        sendText(
          `[ANSWER_CORRECT] Comprehension correct. Congratulate briefly.`,
          { silent: true }
        );
      } else {
        setFeedback('Read the sentence again and think about what it says.');
        setFeedbackType('error');
        setIsShaking(true);
        setTimeout(() => {
          setIsShaking(false);
          setComprehensionSelected(null);
        }, 800);
        sendText(
          `[ANSWER_INCORRECT] Chose "${choice}" but answer is "${currentChallenge.comprehensionAnswer}". Give a hint.`,
          { silent: true }
        );
      }
    },
    [
      currentChallenge,
      showNext,
      currentAttempts,
      tappedWords,
      incrementAttempts,
      recordResult,
      sendText,
    ]
  );

  // ── Navigation ────────────────────────────────────────────────────
  const handleNextChallenge = useCallback(() => {
    resetChallengeState();
    if (!advanceProgress()) {
      submitFinalEvaluation();
      return;
    }

    const nextChallenge = challenges[currentIndex + 1];
    const nextMode = nextChallenge?.mode || defaultMode;
    const isModeSwitch = nextMode !== currentMode;

    sendText(
      isModeSwitch
        ? `[NEXT_CHALLENGE] Switching to ${MODE_CONFIG[nextMode].label} mode! Challenge ${currentIndex + 2} of ${challenges.length}. Introduce the new activity mode briefly.`
        : `[NEXT_CHALLENGE] Challenge ${currentIndex + 2} of ${challenges.length}. Introduce briefly.`,
      { silent: true }
    );
  }, [
    resetChallengeState,
    advanceProgress,
    submitFinalEvaluation,
    challenges,
    currentIndex,
    currentMode,
    defaultMode,
    sendText,
  ]);

  // ── Auto-submit when all challenges complete ────────────────────
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      submitFinalEvaluation();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, submitFinalEvaluation]);

  // ── Overall score (local fallback before submission resolves) ───
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    return Math.round(
      challengeResults.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0) / challenges.length,
    );
  }, [allChallengesComplete, challenges, challengeResults]);

  // ============================================================================
  // Render helpers
  // ============================================================================

  const renderRealVsNonsense = () => {
    if (!currentChallenge) return null;
    return (
      <div className="space-y-4">
        <p className="text-slate-300 text-center text-lg font-medium">
          {MODE_CONFIG['real-vs-nonsense'].instruction}
        </p>
        <div className="grid grid-cols-2 gap-4">
          {shuffledPair.map((word) => {
            const isSelected = selectedAnswer === word;
            const isCorrectWord = word === currentChallenge.realWord;
            const showResult = showNext;

            return (
              <div
                key={word}
                role="button"
                tabIndex={0}
                onClick={() => !showNext && handleRealNonsenseSelect(word)}
                onKeyDown={(e) =>
                  e.key === 'Enter' &&
                  !showNext &&
                  handleRealNonsenseSelect(word)
                }
                className={`
                  relative px-6 py-8 rounded-2xl border-2 text-center
                  transition-all duration-200 select-none
                  ${
                    showResult && isCorrectWord
                      ? 'bg-emerald-500/20 border-emerald-400/50 scale-105'
                      : showResult && !isCorrectWord
                        ? 'bg-red-500/10 border-red-400/30 opacity-60'
                        : isSelected
                          ? 'bg-blue-500/20 border-blue-400/50'
                          : 'bg-white/5 border-white/20 hover:bg-white/10 hover:scale-[1.02] cursor-pointer'
                  }
                  ${isShaking && isSelected ? 'animate-pulse' : ''}
                  ${isCelebrating && isSelected && isCorrectWord ? 'animate-bounce' : ''}
                `}
              >
                <span className="text-3xl font-bold text-slate-100 tracking-wide">
                  {word}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePronounce(word);
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 text-sm"
                  aria-label={`Hear ${word}`}
                >
                  {'\uD83D\uDD0A'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPictureMatch = () => {
    if (!currentChallenge) return null;
    return (
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-slate-400 text-sm mb-2">
            {MODE_CONFIG['picture-match'].instruction}
          </p>
          <div className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-white/5 border border-white/20">
            <span className="text-3xl font-bold text-slate-100">
              {currentChallenge.targetWord}
            </span>
            <button
              onClick={() =>
                handlePronounce(currentChallenge.targetWord || '')
              }
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400"
              aria-label="Hear the word"
            >
              {'\uD83D\uDD0A'}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {pictureOptions.map((opt) => {
            const isSelected = selectedAnswer === opt.word;
            const isCorrect = opt.word === currentChallenge.targetWord;
            const showResult = showNext;

            return (
              <div
                key={opt.word}
                role="button"
                tabIndex={0}
                onClick={() => !showNext && handlePictureSelect(opt.word)}
                onKeyDown={(e) =>
                  e.key === 'Enter' &&
                  !showNext &&
                  handlePictureSelect(opt.word)
                }
                className={`
                  flex flex-col items-center gap-2 p-4 rounded-2xl border-2
                  transition-all duration-200 select-none
                  ${
                    showResult && isCorrect
                      ? 'bg-emerald-500/20 border-emerald-400/50 scale-105'
                      : showResult && isSelected && !isCorrect
                        ? 'bg-red-500/10 border-red-400/30 opacity-60'
                        : isSelected
                          ? 'bg-blue-500/20 border-blue-400/50'
                          : 'bg-white/5 border-white/20 hover:bg-white/10 hover:scale-[1.02] cursor-pointer'
                  }
                  ${isCelebrating && isSelected && isCorrect ? 'animate-bounce' : ''}
                `}
              >
                <span className="text-4xl">{opt.image}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWordChains = () => {
    if (!currentChallenge?.chain) return null;
    const chain = currentChallenge.chain;
    const isStarted = chainStartTime !== null;
    const isChainComplete = showNext;

    return (
      <div className="space-y-4">
        <p className="text-slate-300 text-center text-lg font-medium">
          {MODE_CONFIG['word-chains'].instruction}
        </p>
        <div className="space-y-2">
          {chain.map((word, idx) => {
            const isActive =
              isStarted && idx === chainPosition && !isChainComplete;
            const isRead = isStarted && idx < chainPosition;
            const changedIdx =
              idx > 0
                ? currentChallenge.changedPositions?.[idx - 1]
                : undefined;
            const prevWord = idx > 0 ? chain[idx - 1] : null;

            return (
              <div
                key={`${word}-${idx}`}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl border
                  transition-all duration-300
                  ${
                    isActive
                      ? 'bg-blue-500/20 border-blue-400/50 scale-[1.02]'
                      : isRead || isChainComplete
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-white/5 border-white/10 opacity-50'
                  }
                `}
              >
                <span
                  className={`text-xs font-mono w-6 ${
                    isRead || isActive || isChainComplete
                      ? 'text-slate-300'
                      : 'text-slate-600'
                  }`}
                >
                  {idx + 1}.
                </span>
                <span className="text-2xl font-bold tracking-wider">
                  {word.split('').map((letter, li) => (
                    <span
                      key={li}
                      className={
                        changedIdx !== undefined &&
                        li === changedIdx &&
                        (isActive || isRead || isChainComplete)
                          ? 'text-amber-300'
                          : isActive
                            ? 'text-blue-200'
                            : isRead || isChainComplete
                              ? 'text-emerald-300'
                              : 'text-slate-600'
                      }
                    >
                      {letter}
                    </span>
                  ))}
                </span>
                {prevWord &&
                  changedIdx !== undefined &&
                  (isActive || isRead || isChainComplete) && (
                    <span className="text-xs text-slate-500 ml-auto">
                      {prevWord[changedIdx]} {'\u2192'} {word[changedIdx]}
                    </span>
                  )}
                {isActive && (
                  <span className="ml-auto text-blue-400 animate-pulse">
                    {'\u25C0'}
                  </span>
                )}
                {isRead && (
                  <span className="ml-auto text-emerald-400">{'\u2713'}</span>
                )}
              </div>
            );
          })}
        </div>
        {!isChainComplete && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={handleChainAdvance}
              className={`px-8 py-3 text-lg ${
                !isStarted
                  ? 'bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300'
                  : 'bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300'
              }`}
            >
              {!isStarted
                ? 'Start Reading'
                : chainPosition < chain.length - 1
                  ? 'Next Word'
                  : 'Finish Chain'}
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderSentenceReading = () => {
    if (!currentChallenge?.sentence) return null;
    const words = currentChallenge.sentence.split(/\s+/);

    return (
      <div className="space-y-4">
        <p className="text-slate-300 text-center text-lg font-medium">
          {MODE_CONFIG['sentence-reading'].instruction}
        </p>
        <div className="rounded-xl bg-white/5 border border-white/10 p-6">
          <div className="flex flex-wrap gap-2 justify-center">
            {words.map((word, idx) => {
              const cleanWord = word.replace(/[.,!?'"]/g, '');
              const isTapped = tappedWords.has(cleanWord);
              const isCVC = currentChallenge.cvcWords?.includes(cleanWord);

              return (
                <button
                  key={`${word}-${idx}`}
                  onClick={() => handleWordTap(word)}
                  className={`
                    px-3 py-2 rounded-lg border text-xl font-bold
                    transition-all cursor-pointer
                    ${
                      isTapped
                        ? 'bg-amber-500/20 border-amber-400/40 text-amber-200'
                        : isCVC
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-200 hover:bg-blue-500/20'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }
                  `}
                >
                  {word}
                </button>
              );
            })}
          </div>
          <p className="text-slate-500 text-xs text-center mt-3">
            Tap any word to hear it
          </p>
        </div>
        <div className="flex justify-center gap-3">
          <Button
            variant="ghost"
            onClick={handleModelRead}
            className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
          >
            {'\uD83D\uDD0A'} Hear the Sentence
          </Button>
          {!showComprehension && !showNext && (
            <Button
              variant="ghost"
              onClick={handleSentenceDone}
              className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300"
            >
              I Read It!
            </Button>
          )}
        </div>
        {showComprehension && (
          <div className="rounded-xl bg-purple-500/10 border border-purple-500/30 p-4 space-y-3">
            <p className="text-purple-200 font-medium">
              {currentChallenge.comprehensionQuestion}
            </p>
            <div className="flex flex-wrap gap-2">
              {(() => {
                // Build choices from CVC words in the sentence
                const answer = currentChallenge.comprehensionAnswer?.toLowerCase().trim() || '';
                const cvcWords = (currentChallenge.cvcWords || []).map((w) => w.toLowerCase());
                // Ensure answer is included, plus 2-3 distractors from CVC words
                const distractors = cvcWords.filter((w) => w !== answer).slice(0, 3);
                const choices = [answer, ...distractors];
                // Deterministic shuffle based on challenge id
                const seed = currentChallenge.id
                  .split('')
                  .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
                const shuffled = [...choices];
                for (let i = shuffled.length - 1; i > 0; i--) {
                  const j = (seed + i) % (i + 1);
                  [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                return shuffled.map((word) => {
                  const isSelected = comprehensionSelected === word;
                  const isCorrect = word === answer;
                  const showResult = showNext;
                  return (
                    <button
                      key={word}
                      onClick={() => handleComprehensionSelect(word)}
                      disabled={showNext}
                      className={`
                        px-5 py-2.5 rounded-xl border-2 text-lg font-bold
                        transition-all duration-200 select-none
                        ${
                          showResult && isCorrect
                            ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200 scale-105'
                            : showResult && isSelected && !isCorrect
                              ? 'bg-red-500/10 border-red-400/30 text-red-300 opacity-60'
                              : isSelected
                                ? 'bg-purple-500/20 border-purple-400/50 text-purple-200'
                                : 'bg-white/5 border-white/20 text-slate-200 hover:bg-white/10 hover:scale-[1.02] cursor-pointer'
                        }
                      `}
                    >
                      {word}
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // Main render
  // ============================================================================

  if (!currentChallenge) {
    return (
      <Card
        className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}
      >
        <CardContent className="p-6">
          <p className="text-slate-400 text-center">
            No challenges available.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg text-slate-100">{title}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="bg-white/5 border-white/20 text-slate-400 text-xs"
              >
                {MODE_CONFIG[currentMode].icon} {MODE_CONFIG[currentMode].label}
              </Badge>
              {masteredVowels.length > 0 && (
                <Badge
                  variant="outline"
                  className="bg-white/5 border-white/20 text-slate-400 text-xs"
                >
                  Vowels: {masteredVowels.join(', ')}
                </Badge>
              )}
            </div>
          </div>
          <Badge
            variant="outline"
            className="bg-blue-500/20 border-blue-500/40 text-blue-300 text-xs"
          >
            {currentIndex + 1} / {challenges.length}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress bar */}
        {!allChallengesComplete && (
          <div className="w-full h-1.5 rounded-full bg-slate-700/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500/60 transition-all duration-500"
              style={{
                width: `${(currentIndex / Math.max(challenges.length, 1)) * 100}%`,
              }}
            />
          </div>
        )}

        {/* Feedback */}
        {!allChallengesComplete && feedback && (
          <div
            className={`
              px-4 py-2 rounded-lg text-sm font-medium text-center
              ${
                feedbackType === 'success'
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                  : 'bg-red-500/20 border border-red-500/40 text-red-300'
              }
            `}
          >
            {feedback}
          </div>
        )}

        {/* Mode content */}
        {!allChallengesComplete && currentMode === 'real-vs-nonsense' && renderRealVsNonsense()}
        {!allChallengesComplete && currentMode === 'picture-match' && renderPictureMatch()}
        {!allChallengesComplete && currentMode === 'word-chains' && renderWordChains()}
        {!allChallengesComplete && currentMode === 'sentence-reading' && renderSentenceReading()}

        {/* Next button */}
        {!allChallengesComplete && showNext && (
          <div className="flex justify-center pt-2">
            <Button
              variant="ghost"
              onClick={handleNextChallenge}
              className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300 px-8"
            >
              {currentIndex < challenges.length - 1
                ? 'Next Challenge'
                : 'Finish'}
            </Button>
          </div>
        )}

        {/* All complete summary */}
        {allChallengesComplete && (
          <div className="text-center">
            <p className="text-emerald-400 text-sm font-medium mb-1">
              All challenges complete!
            </p>
            <p className="text-slate-400 text-xs">
              {challengeResults.filter(r => r.correct).length} / {challenges.length} correct
            </p>
          </div>
        )}

        {/* Phase Summary Panel */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Word Workout Complete!"
            celebrationMessage="You practiced reading in different ways!"
            className="mt-4"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default WordWorkout;
