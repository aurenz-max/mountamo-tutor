'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { SoundSwapMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface SoundSwapChallenge {
  id: string;
  operation: 'addition' | 'deletion' | 'substitution';
  originalWord: string;
  originalPhonemes: string[];
  originalImage: string;
  addPhoneme?: string;
  addPosition?: 'beginning' | 'end';
  deletePhoneme?: string;
  deletePosition?: 'beginning' | 'middle' | 'end';
  oldPhoneme?: string;
  newPhoneme?: string;
  substitutePosition?: 'beginning' | 'middle' | 'end';
  resultWord: string;
  resultPhonemes: string[];
  resultImage: string;
}

export interface SoundSwapData {
  title: string;
  gradeLevel: string;
  challenges: SoundSwapChallenge[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SoundSwapMetrics>) => void;
}

// ============================================================================
// Props
// ============================================================================

interface SoundSwapProps {
  data: SoundSwapData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const OPERATION_LABELS: Record<string, string> = {
  addition: 'Addition',
  deletion: 'Deletion',
  substitution: 'Substitution',
};

const OPERATION_ICONS: Record<string, string> = {
  addition: '\u2795',
  deletion: '\u2796',
  substitution: '\uD83D\uDD04',
};

const OPERATION_DESCRIPTIONS: Record<string, string> = {
  addition: 'Add a sound to make a new word',
  deletion: 'Remove a sound to find a new word',
  substitution: 'Change one sound to make a new word',
};

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  addition: { label: 'Addition', icon: '\u2795', accentColor: 'blue' },
  deletion: { label: 'Deletion', icon: '\u2796', accentColor: 'purple' },
  substitution: { label: 'Substitution', icon: '\uD83D\uDD04', accentColor: 'emerald' },
};

const MAX_ATTEMPTS = 3;

// Distractor phonemes for addition/substitution option buttons
const DISTRACTOR_PHONEMES = [
  '/b/', '/d/', '/f/', '/g/', '/h/', '/k/', '/l/', '/m/', '/n/', '/p/',
  '/r/', '/s/', '/t/', '/v/', '/w/', '/z/',
];

// ============================================================================
// Helpers
// ============================================================================

function getOperationInstruction(ch: SoundSwapChallenge): string {
  switch (ch.operation) {
    case 'addition':
      return `Say "${ch.originalWord}." Add ${ch.addPhoneme} to the ${ch.addPosition}. What word?`;
    case 'deletion':
      return `Say "${ch.originalWord}." Take away the ${ch.deletePhoneme}. What's left?`;
    case 'substitution':
      return `Say "${ch.originalWord}." Change the ${ch.oldPhoneme} to ${ch.newPhoneme}. What word?`;
  }
}

function getOperationDescription(ch: SoundSwapChallenge): string {
  switch (ch.operation) {
    case 'addition':
      return `add ${ch.addPhoneme} to the ${ch.addPosition}`;
    case 'deletion':
      return `remove the ${ch.deletePhoneme}`;
    case 'substitution':
      return `change ${ch.oldPhoneme} to ${ch.newPhoneme}`;
  }
}

/** Find the index of the target phoneme based on position. */
function findTargetIndex(
  phonemes: string[],
  targetPhoneme: string,
  position: 'beginning' | 'middle' | 'end',
): number {
  const normalized = targetPhoneme.toLowerCase();
  if (position === 'beginning') {
    return phonemes[0]?.toLowerCase() === normalized ? 0 : -1;
  }
  if (position === 'end') {
    const last = phonemes.length - 1;
    return phonemes[last]?.toLowerCase() === normalized ? last : -1;
  }
  // middle — first match not at first or last index
  for (let i = 1; i < phonemes.length - 1; i++) {
    if (phonemes[i]?.toLowerCase() === normalized) return i;
  }
  return -1;
}

/** Pick N random distractors that aren't the correct phoneme. */
function pickDistractors(correctPhoneme: string, count: number): string[] {
  const norm = correctPhoneme.toLowerCase().replace(/\//g, '');
  return DISTRACTOR_PHONEMES
    .filter(p => p.toLowerCase().replace(/\//g, '') !== norm)
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
}

// ============================================================================
// Component
// ============================================================================

const SoundSwap: React.FC<SoundSwapProps> = ({ data, className }) => {
  const {
    title,
    gradeLevel,
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── Activity gate — student must click Start ─────────────────────
  const [hasStarted, setHasStarted] = useState(false);

  // ── Interaction state ─────────────────────────────────────────────
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [showResult, setShowResult] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  // Tile animation state
  const [removedIndex, setRemovedIndex] = useState<number | null>(null);
  const [swappedPhoneme, setSwappedPhoneme] = useState<string | null>(null);
  const [addedPhoneme, setAddedPhoneme] = useState<string | null>(null);

  // ── Timing ────────────────────────────────────────────────────────
  const startTimeRef = useRef(Date.now());

  // ── Instance ID ───────────────────────────────────────────────────
  const stableInstanceIdRef = useRef(instanceId || `sound-swap-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Shared challenge progress hook ────────────────────────────────
  const {
    currentIndex,
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
    getChallengeType: (ch) => ch.operation,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // ── Evaluation ────────────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<SoundSwapMetrics>({
    primitiveType: 'sound-swap',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const [submittedScore, setSubmittedScore] = useState<number | null>(null);

  const currentChallenge = challenges[currentIndex];
  const previousOperationRef = useRef<string | null>(null);

  // ── Shuffled phoneme options for addition/substitution ─────────────
  // Memoised per challenge so it doesn't re-shuffle on every render.
  const phonemeOptions = useMemo(() => {
    if (!currentChallenge) return [];
    if (currentChallenge.operation === 'deletion') return [];

    const correctPhoneme = currentChallenge.operation === 'addition'
      ? currentChallenge.addPhoneme!
      : currentChallenge.newPhoneme!;

    const distractors = pickDistractors(correctPhoneme, 2);
    return [
      { phoneme: correctPhoneme, isCorrect: true },
      ...distractors.map(p => ({ phoneme: p, isCorrect: false })),
    ].sort(() => Math.random() - 0.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // ── AI Tutoring integration ───────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    operation: currentChallenge?.operation ?? '',
    originalWord: currentChallenge?.originalWord ?? '',
    resultWord: currentChallenge?.resultWord ?? '',
    operationDescription: currentChallenge ? getOperationDescription(currentChallenge) : '',
    currentChallenge: currentIndex + 1,
    totalChallenges: challenges.length,
    currentPhase: currentChallenge?.operation ?? '',
    attempts: currentAttempts,
    targetPhoneme: currentChallenge?.deletePhoneme ?? currentChallenge?.oldPhoneme ?? '',
    newPhoneme: currentChallenge?.newPhoneme ?? currentChallenge?.addPhoneme ?? '',
    position: currentChallenge?.deletePosition ?? currentChallenge?.substitutePosition ?? currentChallenge?.addPosition ?? '',
    originalPhonemes: currentChallenge?.originalPhonemes?.join(' ') ?? '',
  }), [currentChallenge, currentIndex, challenges.length, currentAttempts]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'sound-swap',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // ── Activity introduction — fire once when connected ──────────────
  const hasIntroducedRef = useRef(false);

  useEffect(() => {
    if (!hasStarted || !isConnected || hasIntroducedRef.current || !currentChallenge) return;
    hasIntroducedRef.current = true;

    const instruction = getOperationInstruction(currentChallenge);
    sendText(
      `[ACTIVITY_START] This is a Sound Swap phoneme manipulation activity for Grade ${gradeLevel}. `
      + `There are ${challenges.length} challenges covering addition, deletion, and substitution. `
      + `Warmly introduce the activity ("We're going to change sounds in words to make new words!"), `
      + `then present the first challenge: ${instruction}`,
      { silent: true },
    );
  }, [hasStarted, isConnected, currentChallenge, gradeLevel, challenges.length, sendText]);

  // ── Phase transition detection ────────────────────────────────────
  useEffect(() => {
    if (!currentChallenge) return;
    const prevOp = previousOperationRef.current;
    if (prevOp && prevOp !== currentChallenge.operation) {
      sendText(
        `[PHASE_TRANSITION] Moving from ${OPERATION_LABELS[prevOp]} to ${OPERATION_LABELS[currentChallenge.operation]}. `
        + `Briefly explain: ${OPERATION_DESCRIPTIONS[currentChallenge.operation]}.`,
        { silent: true },
      );
    }
    previousOperationRef.current = currentChallenge.operation;
  }, [currentChallenge, sendText]);

  // ── Present challenge when it changes ─────────────────────────────
  useEffect(() => {
    if (!currentChallenge || !isConnected || !hasIntroducedRef.current) return;
    if (currentIndex === 0) return; // First challenge handled by ACTIVITY_START

    const instruction = getOperationInstruction(currentChallenge);
    sendText(
      `[PRESENT_CHALLENGE] Challenge ${currentIndex + 1} of ${challenges.length}. ${instruction}`,
      { silent: true },
    );
  }, [currentIndex, currentChallenge, isConnected, sendText, challenges.length]);

  // ── Reset interaction state when challenge advances ───────────────
  useEffect(() => {
    setFeedback('');
    setFeedbackType('');
    setShowResult(false);
    setIsCelebrating(false);
    setIsShaking(false);
    setRemovedIndex(null);
    setSwappedPhoneme(null);
    setAddedPhoneme(null);
  }, [currentIndex]);

  // ── Compute per-operation accuracy from results ───────────────────
  const computeAccuracies = useCallback(() => {
    const byOp: Record<string, { correct: number; total: number }> = {
      addition: { correct: 0, total: 0 },
      deletion: { correct: 0, total: 0 },
      substitution: { correct: 0, total: 0 },
    };
    for (const ch of challenges) {
      const result = challengeResults.find(r => r.challengeId === ch.id);
      if (result) {
        byOp[ch.operation].total++;
        if (result.correct) byOp[ch.operation].correct++;
      }
    }
    return {
      additionAccuracy: byOp.addition.total > 0
        ? Math.round((byOp.addition.correct / byOp.addition.total) * 100) : 0,
      deletionAccuracy: byOp.deletion.total > 0
        ? Math.round((byOp.deletion.correct / byOp.deletion.total) * 100) : 0,
      substitutionAccuracy: byOp.substitution.total > 0
        ? Math.round((byOp.substitution.correct / byOp.substitution.total) * 100) : 0,
    };
  }, [challenges, challengeResults]);

  // ── Submit final evaluation ───────────────────────────────────────
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;

    const correctCount = challengeResults.filter(r => r.correct).length;
    const totalCount = challenges.length;
    const overallPct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    const totalAttempts = challengeResults.reduce((sum, r) => sum + r.attempts, 0);
    const elapsed = Date.now() - startTimeRef.current;
    const accs = computeAccuracies();

    const metrics: SoundSwapMetrics = {
      type: 'sound-swap',
      operation: currentChallenge?.operation ?? 'substitution',
      challengesCorrect: correctCount,
      challengesTotal: totalCount,
      additionAccuracy: accs.additionAccuracy,
      deletionAccuracy: accs.deletionAccuracy,
      substitutionAccuracy: accs.substitutionAccuracy,
      attemptsCount: totalAttempts,
    };

    setSubmittedScore(overallPct);
    submitEvaluation(
      overallPct >= 60,
      overallPct,
      metrics,
      { durationMs: elapsed, challengeResults },
    );

    // AI celebration
    const phaseScoreStr = phaseResults.map(
      p => `${p.label} ${p.score}% (${p.attempts} attempts)`,
    ).join(', ');
    sendText(
      `[SESSION_COMPLETE] All ${totalCount} challenges done! Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
      + `Celebrate the transformations they made and summarize what operations were practiced.`,
      { silent: true },
    );
  }, [
    hasSubmittedEvaluation, challengeResults, challenges, currentChallenge,
    computeAccuracies, phaseResults, submitEvaluation, sendText,
  ]);

  // ── Handle deletion — student taps a phoneme tile to remove ───────
  const handleDeletionTap = useCallback((tappedIndex: number) => {
    if (showResult || !currentChallenge) return;

    incrementAttempts();
    const correctIndex = findTargetIndex(
      currentChallenge.originalPhonemes,
      currentChallenge.deletePhoneme!,
      currentChallenge.deletePosition!,
    );
    const isCorrect = tappedIndex === correctIndex;

    if (isCorrect) {
      setRemovedIndex(tappedIndex);
      setFeedback(
        `Yes! Take away ${currentChallenge.deletePhoneme} from "${currentChallenge.originalWord}" `
        + `and you get "${currentChallenge.resultWord}"!`,
      );
      setFeedbackType('success');
      setShowResult(true);
      setIsCelebrating(true);
      setTimeout(() => setIsCelebrating(false), 1500);

      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });

      sendText(
        `[ANSWER_CORRECT] Student correctly removed ${currentChallenge.deletePhoneme} from `
        + `"${currentChallenge.originalWord}" to get "${currentChallenge.resultWord}". `
        + `Celebrate and reinforce both words!`,
        { silent: true },
      );
    } else {
      const tappedPhoneme = currentChallenge.originalPhonemes[tappedIndex];
      setFeedback(`That's ${tappedPhoneme} \u2014 look for the ${currentChallenge.deletePhoneme} sound.`);
      setFeedbackType('error');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);

      sendText(
        `[ANSWER_INCORRECT] Student tapped ${tappedPhoneme} but should remove ${currentChallenge.deletePhoneme}. `
        + `Attempt ${currentAttempts + 1}. Hint: say the target sound clearly.`,
        { silent: true },
      );

      if (currentAttempts + 1 >= MAX_ATTEMPTS) {
        setTimeout(() => {
          setRemovedIndex(correctIndex);
          setShowResult(true);
          setFeedback(
            `The ${currentChallenge.deletePhoneme} sound was here. `
            + `"${currentChallenge.originalWord}" without it is "${currentChallenge.resultWord}".`,
          );
          setFeedbackType('success');
          recordResult({
            challengeId: currentChallenge.id,
            correct: false,
            attempts: currentAttempts + 1,
          });
        }, 1000);
      }
    }
  }, [showResult, currentChallenge, currentAttempts, incrementAttempts, recordResult, sendText]);

  // ── Handle addition — student picks a phoneme to add ──────────────
  const handleAdditionPick = useCallback((phoneme: string, isCorrect: boolean) => {
    if (showResult || !currentChallenge) return;

    incrementAttempts();

    if (isCorrect) {
      setAddedPhoneme(phoneme);
      setFeedback(
        `Yes! Add ${phoneme} to "${currentChallenge.originalWord}" `
        + `and you get "${currentChallenge.resultWord}"!`,
      );
      setFeedbackType('success');
      setShowResult(true);
      setIsCelebrating(true);
      setTimeout(() => setIsCelebrating(false), 1500);

      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });

      sendText(
        `[ANSWER_CORRECT] Student correctly added ${phoneme} to the ${currentChallenge.addPosition} of `
        + `"${currentChallenge.originalWord}" to make "${currentChallenge.resultWord}". `
        + `Celebrate and say both words!`,
        { silent: true },
      );
    } else {
      setFeedback(`${phoneme} doesn't make the right word here. Listen to the instruction again...`);
      setFeedbackType('error');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);

      sendText(
        `[ANSWER_INCORRECT] Student picked ${phoneme} but correct is ${currentChallenge.addPhoneme}. `
        + `Attempt ${currentAttempts + 1}. Re-state: add ${currentChallenge.addPhoneme} to the ${currentChallenge.addPosition}.`,
        { silent: true },
      );

      if (currentAttempts + 1 >= MAX_ATTEMPTS) {
        setTimeout(() => {
          setAddedPhoneme(currentChallenge.addPhoneme!);
          setShowResult(true);
          setFeedback(
            `The answer is ${currentChallenge.addPhoneme}. `
            + `"${currentChallenge.originalWord}" + ${currentChallenge.addPhoneme} = "${currentChallenge.resultWord}"!`,
          );
          setFeedbackType('success');
          recordResult({
            challengeId: currentChallenge.id,
            correct: false,
            attempts: currentAttempts + 1,
          });
        }, 1000);
      }
    }
  }, [showResult, currentChallenge, currentAttempts, incrementAttempts, recordResult, sendText]);

  // ── Handle substitution — student picks replacement phoneme ────────
  const handleSubstitutionPick = useCallback((phoneme: string, isCorrect: boolean) => {
    if (showResult || !currentChallenge) return;

    incrementAttempts();

    if (isCorrect) {
      setSwappedPhoneme(phoneme);
      setFeedback(
        `Yes! Change ${currentChallenge.oldPhoneme} to ${phoneme} in "${currentChallenge.originalWord}" `
        + `and you get "${currentChallenge.resultWord}"!`,
      );
      setFeedbackType('success');
      setShowResult(true);
      setIsCelebrating(true);
      setTimeout(() => setIsCelebrating(false), 1500);

      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });

      sendText(
        `[ANSWER_CORRECT] Student correctly changed ${currentChallenge.oldPhoneme} to ${phoneme} in `
        + `"${currentChallenge.originalWord}" to make "${currentChallenge.resultWord}". `
        + `Celebrate \u2014 "When we change ${currentChallenge.oldPhoneme} to ${phoneme}, ${currentChallenge.originalWord} becomes ${currentChallenge.resultWord}!"`,
        { silent: true },
      );
    } else {
      setFeedback(`${phoneme} doesn't make the right word. Which sound replaces ${currentChallenge.oldPhoneme}?`);
      setFeedbackType('error');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);

      sendText(
        `[ANSWER_INCORRECT] Student picked ${phoneme} but correct replacement is ${currentChallenge.newPhoneme}. `
        + `Attempt ${currentAttempts + 1}. Hint: say "${currentChallenge.originalWord}", emphasize ${currentChallenge.oldPhoneme}, and re-state the swap.`,
        { silent: true },
      );

      if (currentAttempts + 1 >= MAX_ATTEMPTS) {
        setTimeout(() => {
          setSwappedPhoneme(currentChallenge.newPhoneme!);
          setShowResult(true);
          setFeedback(
            `We change ${currentChallenge.oldPhoneme} to ${currentChallenge.newPhoneme}. `
            + `"${currentChallenge.originalWord}" becomes "${currentChallenge.resultWord}"!`,
          );
          setFeedbackType('success');
          recordResult({
            challengeId: currentChallenge.id,
            correct: false,
            attempts: currentAttempts + 1,
          });
        }, 1000);
      }
    }
  }, [showResult, currentChallenge, currentAttempts, incrementAttempts, recordResult, sendText]);

  // ── Advance to next challenge ─────────────────────────────────────
  const handleNext = useCallback(() => {
    if (!advanceProgress()) {
      // All challenges done — submit evaluation and show summary
      submitFinalEvaluation();
      setShowSummary(true);
      return;
    }
    sendText(
      `[NEXT_CHALLENGE] Moving to challenge ${currentIndex + 2} of ${challenges.length}.`,
      { silent: true },
    );
  }, [advanceProgress, currentIndex, challenges.length, sendText, submitFinalEvaluation]);

  // ── Render: Phoneme tile row ──────────────────────────────────────
  const renderPhonemeTiles = (
    phonemes: string[],
    options?: {
      onTileTap?: (index: number) => void;
      removedIdx?: number | null;
      swappedIdx?: number | null;
      swappedTo?: string | null;
      addPosition?: 'beginning' | 'end';
      addedTo?: string | null;
      highlightIdx?: number | null;
      disabled?: boolean;
    },
  ) => {
    const {
      onTileTap,
      removedIdx,
      swappedIdx,
      swappedTo,
      addPosition,
      addedTo,
      highlightIdx,
      disabled,
    } = options ?? {};

    const tiles: React.ReactNode[] = [];

    // "+" slot or added phoneme at beginning
    if (addPosition === 'beginning') {
      tiles.push(
        <div
          key="add-begin"
          className={`
            rounded-xl border-2 border-dashed px-4 py-3 text-center transition-all duration-500
            ${addedTo
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 scale-100 opacity-100'
              : 'bg-white/5 border-white/20 text-slate-500 animate-pulse'
            }
          `}
        >
          <span className="text-xl font-bold">{addedTo || '+'}</span>
        </div>,
      );
    }

    phonemes.forEach((phoneme, idx) => {
      const isRemoved = removedIdx === idx;
      const isSwapped = swappedIdx === idx;
      const isHighlighted = highlightIdx === idx;
      const displayPhoneme = isSwapped && swappedTo ? swappedTo : phoneme;

      tiles.push(
        <button
          key={idx}
          onClick={() => !disabled && onTileTap?.(idx)}
          disabled={disabled || isRemoved}
          className={`
            rounded-xl border-2 px-4 py-3 text-center transition-all duration-500
            ${isRemoved
              ? 'opacity-0 scale-0 border-transparent'
              : isSwapped
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
                : isHighlighted
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 animate-pulse'
                  : onTileTap && !disabled
                    ? 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10 hover:border-white/20 cursor-pointer'
                    : 'bg-white/5 border-white/10 text-slate-200'
            }
          `}
        >
          <span className="text-xl font-bold">{displayPhoneme}</span>
        </button>,
      );
    });

    // "+" slot or added phoneme at end
    if (addPosition === 'end') {
      tiles.push(
        <div
          key="add-end"
          className={`
            rounded-xl border-2 border-dashed px-4 py-3 text-center transition-all duration-500
            ${addedTo
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 scale-100 opacity-100'
              : 'bg-white/5 border-white/20 text-slate-500 animate-pulse'
            }
          `}
        >
          <span className="text-xl font-bold">{addedTo || '+'}</span>
        </div>,
      );
    }

    return (
      <div className="flex justify-center gap-2 flex-wrap">
        {tiles}
      </div>
    );
  };

  // ── Render: Phoneme option buttons (addition / substitution) ──────
  const renderPhonemeOptions = (
    onPick: (phoneme: string, isCorrect: boolean) => void,
  ) => (
    <div className={`flex justify-center gap-3 ${isShaking ? 'animate-shake' : ''}`}>
      {phonemeOptions.map((opt, idx) => (
        <button
          key={idx}
          onClick={() => !showResult && onPick(opt.phoneme, opt.isCorrect)}
          disabled={showResult}
          className={`
            rounded-xl border-2 px-5 py-3 text-center transition-all duration-200 cursor-pointer
            ${showResult && opt.isCorrect
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 ring-2 ring-emerald-400/40'
              : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10 hover:border-white/20'
            }
            ${isCelebrating && opt.isCorrect ? 'animate-bounce' : ''}
          `}
        >
          <span className="text-lg font-bold">{opt.phoneme}</span>
        </button>
      ))}
    </div>
  );

  // ── Render: Deletion mode ─────────────────────────────────────────
  const renderDeletionMode = () => {
    if (!currentChallenge) return null;
    return (
      <div className="space-y-5">
        {/* Word display */}
        <div className="text-center space-y-1">
          <p className="text-sm text-slate-500 italic">{currentChallenge.originalImage}</p>
          <p className="text-2xl font-bold text-slate-100">&ldquo;{currentChallenge.originalWord}&rdquo;</p>
        </div>

        {/* Instruction */}
        <p className="text-center text-lg text-slate-300 font-medium">
          Tap the <span className="text-amber-300">{currentChallenge.deletePhoneme}</span> sound to remove it
        </p>

        {/* Phoneme tiles — tappable */}
        <div className={isShaking ? 'animate-shake' : ''}>
          {renderPhonemeTiles(currentChallenge.originalPhonemes, {
            onTileTap: handleDeletionTap,
            removedIdx: removedIndex,
            disabled: showResult,
          })}
        </div>

        {/* Result word (shown after correct/max attempts) */}
        {showResult && (
          <div className="text-center space-y-1">
            <p className="text-sm text-slate-500">&rarr;</p>
            <p className="text-2xl font-bold text-emerald-300">&ldquo;{currentChallenge.resultWord}&rdquo;</p>
            <p className="text-sm text-slate-500 italic">{currentChallenge.resultImage}</p>
          </div>
        )}
      </div>
    );
  };

  // ── Render: Addition mode ─────────────────────────────────────────
  const renderAdditionMode = () => {
    if (!currentChallenge) return null;
    return (
      <div className="space-y-5">
        {/* Word display */}
        <div className="text-center space-y-1">
          <p className="text-sm text-slate-500 italic">{currentChallenge.originalImage}</p>
          <p className="text-2xl font-bold text-slate-100">&ldquo;{currentChallenge.originalWord}&rdquo;</p>
        </div>

        {/* Instruction */}
        <p className="text-center text-lg text-slate-300 font-medium">
          Add a sound to the{' '}
          <span className="text-amber-300">{currentChallenge.addPosition}</span>{' '}
          to make a new word
        </p>

        {/* Phoneme tiles with + slot */}
        {renderPhonemeTiles(currentChallenge.originalPhonemes, {
          addPosition: currentChallenge.addPosition,
          addedTo: addedPhoneme,
          disabled: true,
        })}

        {/* Phoneme options */}
        {!showResult && (
          <div className="space-y-2">
            <p className="text-center text-sm text-slate-400">Pick the right sound:</p>
            {renderPhonemeOptions(handleAdditionPick)}
          </div>
        )}

        {/* Result word */}
        {showResult && (
          <div className="text-center space-y-1">
            <p className="text-sm text-slate-500">&rarr;</p>
            <p className="text-2xl font-bold text-emerald-300">&ldquo;{currentChallenge.resultWord}&rdquo;</p>
            <p className="text-sm text-slate-500 italic">{currentChallenge.resultImage}</p>
          </div>
        )}
      </div>
    );
  };

  // ── Render: Substitution mode ─────────────────────────────────────
  const renderSubstitutionMode = () => {
    if (!currentChallenge) return null;
    const targetIdx = findTargetIndex(
      currentChallenge.originalPhonemes,
      currentChallenge.oldPhoneme!,
      currentChallenge.substitutePosition!,
    );

    return (
      <div className="space-y-5">
        {/* Word display */}
        <div className="text-center space-y-1">
          <p className="text-sm text-slate-500 italic">{currentChallenge.originalImage}</p>
          <p className="text-2xl font-bold text-slate-100">&ldquo;{currentChallenge.originalWord}&rdquo;</p>
        </div>

        {/* Instruction */}
        <p className="text-center text-lg text-slate-300 font-medium">
          Change the <span className="text-amber-300">{currentChallenge.oldPhoneme}</span> to a new sound
        </p>

        {/* Phoneme tiles with highlighted target */}
        {renderPhonemeTiles(currentChallenge.originalPhonemes, {
          highlightIdx: !showResult ? targetIdx : null,
          swappedIdx: showResult ? targetIdx : null,
          swappedTo: swappedPhoneme,
          disabled: true,
        })}

        {/* Phoneme options */}
        {!showResult && (
          <div className="space-y-2">
            <p className="text-center text-sm text-slate-400">Pick the replacement sound:</p>
            {renderPhonemeOptions(handleSubstitutionPick)}
          </div>
        )}

        {/* Result word */}
        {showResult && (
          <div className="text-center space-y-1">
            <p className="text-sm text-slate-500">&rarr;</p>
            <p className="text-2xl font-bold text-emerald-300">&ldquo;{currentChallenge.resultWord}&rdquo;</p>
            <p className="text-sm text-slate-500 italic">{currentChallenge.resultImage}</p>
          </div>
        )}
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

  // ── Start screen ──────────────────────────────────────────────────
  if (!hasStarted) {
    const operations = Array.from(new Set(challenges.map(ch => ch.operation)));
    return (
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
        <CardContent className="p-8 flex flex-col items-center text-center space-y-5">
          <div className="text-4xl">{'\uD83D\uDD04'}</div>
          <CardTitle className="text-xl text-slate-100">{title}</CardTitle>
          <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-400 text-xs">
            Grade {gradeLevel}
          </Badge>
          <p className="text-slate-400 text-sm max-w-sm">
            {challenges.length} challenges across{' '}
            {operations.map(o => OPERATION_LABELS[o]).join(', ')} modes.
            Change sounds in words to make new words!
          </p>
          <Button
            variant="ghost"
            onClick={() => {
              startTimeRef.current = Date.now();
              setHasStarted(true);
            }}
            className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300 px-8 py-3 text-lg"
          >
            Start Activity
          </Button>
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
                Grade {gradeLevel}
              </Badge>
            </div>
          </div>
          {currentChallenge && !showSummary && (
            <Badge
              variant="outline"
              className={`text-xs ${
                currentChallenge.operation === 'addition'
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                  : currentChallenge.operation === 'deletion'
                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                    : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              }`}
            >
              {OPERATION_ICONS[currentChallenge.operation]} {OPERATION_LABELS[currentChallenge.operation]}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress indicator */}
        {!showSummary && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">
                Challenge {currentIndex + 1} of {challenges.length}
              </span>
              <span className="text-slate-500 text-xs">
                {challengeResults.filter(r => r.correct).length} correct
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${((showResult ? currentIndex + 1 : currentIndex) / challenges.length) * 100}%` }}
              />
            </div>
          </>
        )}

        {/* Challenge content */}
        {!showSummary && currentChallenge && (
          <>
            {currentChallenge.operation === 'deletion' && renderDeletionMode()}
            {currentChallenge.operation === 'addition' && renderAdditionMode()}
            {currentChallenge.operation === 'substitution' && renderSubstitutionMode()}
          </>
        )}

        {/* Feedback banner */}
        {feedback && !showSummary && (
          <div
            className={`
              px-4 py-3 rounded-lg text-sm font-medium text-center transition-all
              ${feedbackType === 'success'
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                : feedbackType === 'error'
                  ? 'bg-red-500/20 border border-red-500/40 text-red-300'
                  : ''
              }
            `}
          >
            {feedback}
          </div>
        )}

        {/* Next / Finish button */}
        {showResult && !showSummary && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={handleNext}
              className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300"
            >
              {currentIndex < challenges.length - 1 ? 'Next Challenge' : 'Finish'}
            </Button>
          </div>
        )}

        {/* Phase summary panel */}
        {showSummary && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedScore ?? undefined}
            durationMs={elapsedMs}
            heading="Sound Swap Complete!"
            celebrationMessage="You practiced adding, removing, and swapping sounds in words!"
            className="mb-6"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default SoundSwap;
