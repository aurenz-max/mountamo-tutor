'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaProgress,
  LuminaChallengeCounter,
  LuminaActionButton,
  LuminaFeedbackCard,
  answerStateClass,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { LetterSpotterMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

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
  /** For name-it: sentence with emoji replacing the target letter (e.g., "The ⭐un is bright") */
  sentence?: string;
  /** For name-it: the emoji used as the placeholder */
  emoji?: string;
  /** For name-it: the full word containing the target letter (e.g., "sun") */
  targetWord?: string;
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
  'name-it': { label: 'Name It', description: 'Spot the missing letter in the sentence' },
  'find-it': { label: 'Find It', description: 'Find all matching letters' },
  'match-it': { label: 'Match It', description: 'Match uppercase to lowercase' },
};

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'name-it': { label: 'Name It', accentColor: 'blue' },
  'find-it': { label: 'Find It', accentColor: 'purple' },
  'match-it': { label: 'Match It', accentColor: 'emerald' },
};

/** Mode → kit accent for the mode badge. */
const MODE_ACCENT = {
  'name-it': 'blue',
  'find-it': 'purple',
  'match-it': 'emerald',
} as const;

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
    targetWord: currentChallenge?.targetWord ?? '',
    sentence: currentChallenge?.sentence ?? '',
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

    // For name-it: reconstruct the full sentence (emoji → letter) so the AI reads it naturally
    const nameItFullSentence = currentChallenge.mode === 'name-it' && currentChallenge.sentence && currentChallenge.targetWord
      ? currentChallenge.sentence.replace(currentChallenge.emoji || '⭐', currentChallenge.targetLetter)
      : '';

    const introExtra = currentChallenge.mode === 'name-it' && nameItFullSentence
      ? `This is a sentence spotter challenge! Say this sentence aloud naturally: "${nameItFullSentence}". `
        + `The student sees the sentence on screen but the word "${currentChallenge.targetWord}" is replaced by a ${currentChallenge.emoji || '⭐'} emoji. `
        + `IMPORTANT: Do NOT say the letter name or give away the answer. Just read the sentence naturally and ask "What letter is the ${currentChallenge.emoji || '⭐'} hiding?" `
      : currentChallenge.mode === 'find-it'
        ? `Say "Find the letter ${currentChallenge.targetLetter.toUpperCase()}!" with enthusiasm. `
        : '';

    sendText(
      `[ACTIVITY_START] Letter spotting activity for Group ${letterGroup} `
      + `(letters: ${cumulativeLetters.join(', ')}). `
      + `New letters in this group: ${newLetters.length > 0 ? newLetters.join(', ') : 'none — review only'}. `
      + `There are ${challenges.length} challenges. `
      + `Introduce the activity warmly — we're learning to recognize letters! `
      + (currentChallenge.mode !== 'name-it' ? `First challenge: ${modeLabel} for the letter "${currentChallenge.targetLetter.toUpperCase()}". ` : '')
      + introExtra
      + (isNew ? `This is a NEW letter — introduce it warmly with a brief description of its shape. ` : '')
      + `Keep it brief and enthusiastic — 2-3 sentences max.`,
      { silent: true },
    );
  }, [isConnected, currentChallenge, letterGroup, cumulativeLetters, newLetters, challenges.length, sendText]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

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
      SoundManager.playCorrect();
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

      const correctExtra = currentChallenge.mode === 'name-it' && currentChallenge.targetWord
        ? ` The word was "${currentChallenge.targetWord}". Read the full sentence aloud as celebration!`
        : '';
      sendText(
        `[ANSWER_CORRECT] The student correctly identified the letter "${currentChallenge.targetLetter.toUpperCase()}"` +
        `${currentAttempts === 0 ? ' on the first try!' : ` after ${currentAttempts + 1} attempts.`} ` +
        `[SAY_LETTER_NAME] Say the letter name clearly and congratulate briefly.${correctExtra}`,
        { silent: true },
      );
    } else {
      SoundManager.playIncorrect();
      setFeedback('Try again! Look at the letter carefully.');
      setFeedbackType('error');
      trackConfusion(currentChallenge.targetLetter, option);

      const nameItSentence = currentChallenge.mode === 'name-it' && currentChallenge.sentence && currentChallenge.targetWord
        ? currentChallenge.sentence.replace(currentChallenge.emoji || '⭐', currentChallenge.targetLetter)
        : '';
      const hintExtra = nameItSentence
        ? ` Re-read the sentence "${nameItSentence}" aloud slowly and emphasize the word "${currentChallenge.targetWord}". Do NOT say the letter name directly.`
        : '';
      sendText(
        `[ANSWER_INCORRECT] The student chose "${option.toUpperCase()}" but the correct letter is "${currentChallenge.targetLetter.toUpperCase()}". ` +
        `This is attempt ${currentAttempts + 1}. Give a brief hint without giving the answer.${hintExtra}`,
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
    SoundManager.tap();
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
      SoundManager.playCorrect();
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
      SoundManager.playIncorrect();
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

    if (nextChallenge.mode === 'name-it' && nextChallenge.sentence) {
      // Sentence spotter: AI reads the full sentence aloud (naturally, without revealing the letter)
      const fullSentence = nextChallenge.sentence.replace(
        nextChallenge.emoji || '⭐',
        nextChallenge.targetLetter,
      );
      sendText(
        `[SENTENCE_SPOTTER] Challenge ${currentChallengeIndex + 2} of ${challenges.length}. ` +
        `Say this sentence aloud naturally: "${fullSentence}". ` +
        `The student sees the sentence on screen but the word "${nextChallenge.targetWord}" is replaced by a ${nextChallenge.emoji || '⭐'} emoji. ` +
        `IMPORTANT: Do NOT say the letter name or give away which letter is missing. ` +
        `Just read the sentence naturally, then ask "What letter is the ${nextChallenge.emoji || '⭐'} hiding?"` +
        (isNew ? ` This is a NEW letter — give an extra hint about its shape without saying the letter name.` : ''),
        { silent: true },
      );
    } else if (nextChallenge.mode === 'find-it') {
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
  // Render: Name-It Mode (Sentence Spotter)
  // ============================================================================
  const renderNameIt = () => {
    if (!currentChallenge) return null;
    const options = currentChallenge.options || [];
    const sentence = currentChallenge.sentence || '';
    const emoji = currentChallenge.emoji || '⭐';
    const targetWord = currentChallenge.targetWord || '';

    // Reconstruct the full sentence (replace emoji back with the target letter),
    // then replace the entire targetWord with the emoji so students see
    // "The ⭐ is bright" instead of "The ⭐un is bright".
    const fullSentence = sentence.replace(emoji, currentChallenge.targetLetter);
    let displaySentence = sentence; // fallback: use original sentence as-is
    if (targetWord) {
      // Try word-boundary match first, then case-insensitive plain match as fallback
      const wordBoundaryMatch = fullSentence.replace(new RegExp(`\\b${targetWord}\\b`, 'i'), emoji);
      if (wordBoundaryMatch !== fullSentence) {
        displaySentence = wordBoundaryMatch;
      } else {
        // Fallback: plain case-insensitive replace (handles punctuation-attached words)
        const plainMatch = fullSentence.replace(new RegExp(targetWord, 'i'), emoji);
        if (plainMatch !== fullSentence) {
          displaySentence = plainMatch;
        }
      }
    }

    // Split the display sentence around the emoji to render it with emphasis
    const parts = displaySentence.split(emoji);
    const hasEmoji = parts.length > 1;

    return (
      <div className="space-y-6">
        {/* Sentence display with emoji replacing the full target word — INTERACTION SURFACE */}
        <div className="flex justify-center">
          <div className="bg-white/5 border-2 border-white/15 rounded-2xl px-8 py-6 max-w-lg">
            <p className={`${fontClass} text-3xl font-bold text-slate-100 text-center leading-relaxed`}>
              {hasEmoji ? (
                <>
                  {parts.map((part, i) => (
                    <React.Fragment key={i}>
                      {part}
                      {i < parts.length - 1 && (
                        <span className="inline-flex items-center justify-center mx-1">
                          <span className="relative inline-block">
                            <span className="absolute inset-0 -m-1.5 rounded-full border-2 border-dashed border-amber-400/70 animate-pulse" />
                            <span className="text-4xl" role="img" aria-label="mystery letter">
                              {emoji}
                            </span>
                          </span>
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </>
              ) : (
                displaySentence
              )}
            </p>
          </div>
        </div>

        <p className="text-center text-slate-400 text-sm">
          Listen to the sentence. What letter does the {emoji} replace?
        </p>

        {/* Letter options grid — letter tiles (interaction surface); grading colors from kit tokens */}
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
          {options.map((option) => {
            const isSelected = selectedOption === option;
            const isCorrectOption = option.toLowerCase() === currentChallenge.targetLetter.toLowerCase();
            const showCorrect = isLocked && isCorrectOption;
            const showWrong = isSelected && feedbackType === 'error' && !isCorrectOption;
            const stateClass = showCorrect
              ? answerStateClass('correct')
              : showWrong
                ? answerStateClass('incorrect')
                : isSelected
                  ? answerStateClass('selected')
                  : answerStateClass('idle');

            return (
              <button
                key={option}
                type="button"
                onClick={() => handleOptionSelect(option)}
                disabled={isLocked}
                className={`h-16 rounded-xl border-2 text-2xl font-bold transition-all ${stateClass}`}
              >
                {option.toUpperCase()}
              </button>
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
        {/* Instruction — letter is spoken by AI, not shown visually */}
        <div className="text-center">
          <p className="text-slate-400 text-sm">
            Listen carefully — find all the matching letters in the grid!
          </p>
        </div>

        {/* Letter grid — interaction surface; grading colors from kit tokens */}
        <div
          className="grid gap-2 max-w-md mx-auto"
          style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}
        >
          {grid.map((letter, i) => {
            const isSelected = selectedGridCells.has(i);
            const isTarget = letter.toLowerCase() === target;
            const showCorrect = isLocked && isTarget;
            const stateClass = showCorrect
              ? answerStateClass('correct')
              : isSelected
                ? answerStateClass('selected')
                : answerStateClass('idle');

            return (
              <button
                key={`${i}-${letter}`}
                onClick={() => handleGridCellToggle(i)}
                disabled={isLocked}
                className={`
                  aspect-square rounded-xl border-2 font-bold text-2xl
                  transition-all select-none
                  ${stateClass}
                  ${(showCorrect || isSelected) ? 'scale-105' : ''}
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
            <LuminaActionButton
              action="check"
              onClick={handleCheckFindIt}
              disabled={selectedGridCells.size === 0}
            >
              Check
            </LuminaActionButton>
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
        {/* Large uppercase letter — interaction surface */}
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

        {/* Lowercase options — letter tiles (interaction surface); grading colors from kit tokens */}
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
          {options.map((option) => {
            const isSelected = selectedOption === option;
            const isCorrectOption = option.toLowerCase() === currentChallenge.targetLetter.toLowerCase();
            const showCorrect = isLocked && isCorrectOption;
            const showWrong = isSelected && feedbackType === 'error' && !isCorrectOption;
            const stateClass = showCorrect
              ? answerStateClass('correct')
              : showWrong
                ? answerStateClass('incorrect')
                : isSelected
                  ? answerStateClass('selected')
                  : answerStateClass('idle');

            return (
              <button
                key={option}
                type="button"
                onClick={() => handleOptionSelect(option)}
                disabled={isLocked}
                className={`h-16 rounded-xl border-2 text-3xl font-bold transition-all ${stateClass}`}
              >
                {option}
              </button>
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
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const elapsedMs = Date.now() - startTimeRef.current;
  const isNewLetterChallenge =
    currentChallenge && newLetters.includes(currentChallenge.targetLetter.toLowerCase());

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            <div className="flex items-center gap-2">
              <LuminaBadge className="text-xs">Group {letterGroup}</LuminaBadge>
              {currentChallenge && (
                <LuminaBadge accent={MODE_ACCENT[currentChallenge.mode]} className="text-xs">
                  {MODE_CONFIG[currentChallenge.mode]?.label || currentChallenge.mode}
                </LuminaBadge>
              )}
              {isNewLetterChallenge && (
                <LuminaBadge accent="amber" className="text-xs">
                  New Letter
                </LuminaBadge>
              )}
            </div>
          </div>
          <LuminaChallengeCounter
            current={currentChallengeIndex + 1}
            total={challenges.length}
          />
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Progress bar */}
        <LuminaProgress
          accent="blue"
          value={((currentChallengeIndex + (isLocked ? 1 : 0)) / challenges.length) * 100}
        />

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
          <LuminaFeedbackCard status={feedbackType === 'success' ? 'correct' : 'incorrect'}>
            {feedback}
          </LuminaFeedbackCard>
        )}

        {/* Next / Finish button */}
        {isLocked && !allChallengesComplete && (
          <div className="flex justify-center">
            <LuminaActionButton action="next" onClick={handleNextChallenge}>
              {currentChallengeIndex < challenges.length - 1 ? 'Next Challenge' : 'Finish'}
            </LuminaActionButton>
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
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default LetterSpotter;
