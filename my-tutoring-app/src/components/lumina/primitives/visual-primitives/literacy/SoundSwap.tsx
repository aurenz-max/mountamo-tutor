'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaButton,
  LuminaActionButton,
  LuminaChallengeCounter,
  LuminaProgress,
  LuminaFeedbackCard,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { SoundSwapMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useSpokenWordCapture, type SpokenJudgeResult } from '../../../hooks/useSpokenWordCapture';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

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

  // ── Within-mode support tier scaffolds (set by the generator from config.difficulty).
  //    Display/instruction only — NEVER change the word, phonemes, or the answer.
  //    All optional; absent ⇒ legacy full-scaffold behavior (every cue shown). ──
  /** #1 perception — show the original-word picture cue (self-check). Default: shown. */
  showWordImage?: boolean;
  /** #1 perception (substitution) — highlight the tile to change. Default: shown. */
  showTargetHighlight?: boolean;
  /** #2 instruction — name the exact target sound in the instruction. Default: named. */
  nameTargetSound?: boolean;
  /** #5 answer-form (addition/substitution) — number of phoneme choice buttons. Default: 3. */
  optionCount?: number;
}

export interface SoundSwapData {
  title: string;
  gradeLevel: string;
  /** Within-mode support tier from the manifest. Threaded to the tutor reveal policy. */
  supportTier?: 'easy' | 'medium' | 'hard';
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
  addition: '➕',
  deletion: '➖',
  substitution: '🔄',
};

const OPERATION_DESCRIPTIONS: Record<string, string> = {
  addition: 'Add a sound to make a new word',
  deletion: 'Remove a sound to find a new word',
  substitution: 'Change one sound to make a new word',
};

const OPERATION_ACCENTS: Record<string, LuminaAccent> = {
  addition: 'blue',
  deletion: 'purple',
  substitution: 'emerald',
};

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  addition: { label: 'Addition', icon: '➕', accentColor: 'blue' },
  deletion: { label: 'Deletion', icon: '➖', accentColor: 'purple' },
  substitution: { label: 'Substitution', icon: '🔄', accentColor: 'emerald' },
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

/** The instruction the tutor PRESENTS. At the hard tier (nameTargetSound === false)
 *  this matches the neutral on-screen instruction — the tutor must not name the
 *  target sound the screen withheld. (The tutor still knows the answer internally
 *  via aiPrimitiveData; this only governs what it says aloud.) */
function getPresentedInstruction(ch: SoundSwapChallenge): string {
  if (ch.nameTargetSound === false) {
    switch (ch.operation) {
      case 'addition':
        return `Say "${ch.originalWord}." Add one sound to make a new word. What word?`;
      case 'deletion':
        return `Say "${ch.originalWord}." Take one sound away to make a new word. What's left?`;
      case 'substitution':
        return `Say "${ch.originalWord}." Change one sound to make a new word. What word?`;
    }
  }
  return getOperationInstruction(ch);
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

/**
 * Mode-aware tutor reveal policy keyed to the within-mode support tier. The tutor is
 * a second scaffold channel, so its reveal latitude must MATCH the on-screen tier:
 *  - easy   → may name the target sound / position and walk the setup step by step.
 *  - medium → nudge execution only; confirm the sound, don't pre-chew the whole move.
 *  - hard   → the instruction hid the target sound, so the tutor must NOT name it
 *             either; ask what the student hears in the word, never reveal the new word.
 * At EVERY tier the tutor never says the result word outright (the new word IS the
 * answer the student is producing).
 */
function tutorRevealPolicy(
  tier: 'easy' | 'medium' | 'hard' | undefined,
  operation: string,
): string {
  if (!tier) return '';
  if (tier === 'easy') {
    return `[SUPPORT_TIER easy] Full scaffolding: you may name the exact sound to ${operation === 'deletion' ? 'take away' : operation === 'addition' ? 'add and where' : 'change'} and walk the student through the move step by step. Still never say the new result word — let them produce it.`;
  }
  if (tier === 'medium') {
    return `[SUPPORT_TIER medium] Light scaffolding: nudge the execution only — confirm which sound they are working with if asked, but do not pre-solve the whole move, and never say the result word.`;
  }
  return `[SUPPORT_TIER hard] Minimal scaffolding: the on-screen instruction does NOT name the target sound, so you must not name it either. Ask what the student hears in the word and which sound to ${operation === 'deletion' ? 'remove' : operation === 'addition' ? 'add' : 'change'}; guide by questioning. Never reveal the target sound or the new result word.`;
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
    supportTier,
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

  // New words the student said ALOUD (judge-confirmed) — the culminating
  // production beat. Tracked by challenge id, cumulative across the session.
  const [spokenWords, setSpokenWords] = useState<Set<string>>(new Set());

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

    // Support tier (#5 answer-form lever): optionCount sets the size of the choice
    // field. More distractors = harder discrimination at the SAME task, with exactly
    // ONE correct option always present (answer never changes). Default 3.
    const totalOptions = Math.max(2, Math.min(5, currentChallenge.optionCount ?? 3));
    const distractors = pickDistractors(correctPhoneme, totalOptions - 1);
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
    supportTier: supportTier ?? null,
  }), [currentChallenge, currentIndex, challenges.length, currentAttempts, supportTier]);

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

    const instruction = getPresentedInstruction(currentChallenge);
    const policy = tutorRevealPolicy(supportTier, currentChallenge.operation);
    sendText(
      `[ACTIVITY_START] This is a Sound Swap phoneme manipulation activity for Grade ${gradeLevel}. `
      + `There are ${challenges.length} challenges covering addition, deletion, and substitution. `
      + `Warmly introduce the activity ("We're going to change sounds in words to make new words!"), `
      + `then present the first challenge: ${instruction}`
      + (policy ? ` ${policy}` : ''),
      { silent: true },
    );
  }, [hasStarted, isConnected, currentChallenge, gradeLevel, challenges.length, sendText, supportTier]);

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

    const instruction = getPresentedInstruction(currentChallenge);
    const policy = tutorRevealPolicy(supportTier, currentChallenge.operation);
    sendText(
      `[PRESENT_CHALLENGE] Challenge ${currentIndex + 1} of ${challenges.length}. ${instruction}`
      + (policy ? ` ${policy}` : ''),
      { silent: true },
    );
  }, [currentIndex, currentChallenge, isConnected, sendText, challenges.length, supportTier]);

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
      { durationMs: elapsed, challengeResults, spokenWords: Array.from(spokenWords) },
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
    computeAccuracies, phaseResults, submitEvaluation, sendText, spokenWords,
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
      SoundManager.playCorrect();
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
      SoundManager.playIncorrect();
      const tappedPhoneme = currentChallenge.originalPhonemes[tappedIndex];
      setFeedback(`That's ${tappedPhoneme} — look for the ${currentChallenge.deletePhoneme} sound.`);
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
      SoundManager.playCorrect();
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
      SoundManager.playIncorrect();
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
      SoundManager.playCorrect();
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
        + `Celebrate — "When we change ${currentChallenge.oldPhoneme} to ${phoneme}, ${currentChallenge.originalWord} becomes ${currentChallenge.resultWord}!"`,
        { silent: true },
      );
    } else {
      SoundManager.playIncorrect();
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

  // ── Spoken production beat ────────────────────────────────────────
  // Every operation ends by producing a new word ("what word do you get?"). The
  // tile-tap only reports it; once the challenge is resolved the mic turns that
  // into real oral production — the student SAYS the new word, and the judge
  // ladder (Azure dual-signal → Gemini, utils/spokenWordJudge.ts) confirms it.
  // Purely additive: the beat only appears after showResult, the Skip/Next path
  // is always reachable, and a 'no-match' is never scored against the student.
  //   'match'   → celebrate + track (bonus production credit)
  //   'no-match'→ tutor models the new word by voice, NO penalty
  //   'unclear' → invite a retry, silently
  const spokenTargetWord = currentChallenge?.resultWord ?? '';

  const handleSpokenResult = useCallback((result: SpokenJudgeResult) => {
    if (!currentChallenge || !spokenTargetWord || spokenWords.has(currentChallenge.id)) return;

    if (result.outcome === 'match') {
      SoundManager.playCorrect();
      setSpokenWords(prev => new Set(Array.from(prev).concat(currentChallenge.id)));
      sendText(
        `[STUDENT_SAID_WORD] The student said the new word "${spokenTargetWord}" out loud all by themselves — `
        + `the result of the sound swap on "${currentChallenge.originalWord}"! `
        + `Celebrate enthusiastically that they SAID the new word (one sentence).`,
        { silent: true },
      );
    } else if (result.outcome === 'no-match' && result.verdict?.heard) {
      sendText(
        `[SPOKEN_MISS] The student tried to say the new word "${spokenTargetWord}" aloud but it sounded like "${result.verdict.heard}". `
        + `Gently model it — stretch the sounds "${currentChallenge.resultPhonemes.join('... ')}", then say "${spokenTargetWord}" — and invite one more try. `
        + `Warm, never scolding. Two short sentences max.`,
        { silent: true },
      );
    } else {
      sendText(
        `[SPOKEN_UNCLEAR] The microphone didn't catch it. One friendly sentence: invite them to say "${spokenTargetWord}" `
        + `again a little louder, or just tap Next.`,
        { silent: true },
      );
    }
  }, [currentChallenge, spokenTargetWord, spokenWords, sendText]);

  const spokenCapture = useSpokenWordCapture({
    targetWord: spokenTargetWord,
    gradeLevel,
    onResult: handleSpokenResult,
    onNoSpeech: () => {
      if (!currentChallenge || spokenWords.has(currentChallenge.id)) return;
      sendText(
        `[SPOKEN_UNCLEAR] The microphone didn't hear the student. One friendly sentence: invite them to say `
        + `"${spokenTargetWord}" again a little louder, or just tap Next.`,
        { silent: true },
      );
    },
  });

  // ── Advance to next challenge ─────────────────────────────────────
  const handleNext = useCallback(() => {
    spokenCapture.cancel(); // never carry a live mic across challenges
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
  }, [advanceProgress, currentIndex, challenges.length, sendText, submitFinalEvaluation, spokenCapture]);

  // Strong-flow UX: once the student says the new word aloud (judge-confirmed),
  // glide to the next challenge on their behalf — no extra click. The mic itself
  // stays tap-to-start (push-to-talk is the echo gate against the tutor's voice);
  // only the advance is automatic — auto-advance yes, auto-listen no.
  const handleNextRef = useRef(handleNext);
  handleNextRef.current = handleNext;
  useEffect(() => {
    if (!currentChallenge || !spokenWords.has(currentChallenge.id)) return;
    const t = setTimeout(() => handleNextRef.current(), 1400);
    return () => clearTimeout(t);
  }, [spokenWords, currentChallenge]);

  // ── Render: Phoneme tile row ──────────────────────────────────────
  // INTERACTION SURFACE — the phoneme tiles the student taps/manipulates.
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
  // INTERACTION SURFACE — the sound choice tiles the student picks from.
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
    const showImage = currentChallenge.showWordImage !== false;
    const nameSound = currentChallenge.nameTargetSound !== false;
    return (
      <div className="space-y-5">
        {/* Word display */}
        <div className="text-center space-y-1">
          {showImage && (
            <p className="text-sm text-slate-500 italic">{currentChallenge.originalImage}</p>
          )}
          <p className="text-2xl font-bold text-slate-100">&ldquo;{currentChallenge.originalWord}&rdquo;</p>
        </div>

        {/* Instruction */}
        <p className="text-center text-lg text-slate-300 font-medium">
          {nameSound ? (
            <>Tap the <span className="text-amber-300">{currentChallenge.deletePhoneme}</span> sound to remove it</>
          ) : (
            <>Take away one sound to make a new word — tap the sound to remove</>
          )}
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
    const showImage = currentChallenge.showWordImage !== false;
    const nameSound = currentChallenge.nameTargetSound !== false;
    return (
      <div className="space-y-5">
        {/* Word display */}
        <div className="text-center space-y-1">
          {showImage && (
            <p className="text-sm text-slate-500 italic">{currentChallenge.originalImage}</p>
          )}
          <p className="text-2xl font-bold text-slate-100">&ldquo;{currentChallenge.originalWord}&rdquo;</p>
        </div>

        {/* Instruction */}
        <p className="text-center text-lg text-slate-300 font-medium">
          {nameSound ? (
            <>Add a sound to the{' '}
            <span className="text-amber-300">{currentChallenge.addPosition}</span>{' '}
            to make a new word</>
          ) : (
            <>Add one sound to make a new word</>
          )}
        </p>

        {/* Phoneme tiles with + slot. When the instruction does NOT name the sound
            (hard tier), the "+" position slot is also withheld until the answer is
            shown, so the placement isn't a free cue. */}
        {renderPhonemeTiles(currentChallenge.originalPhonemes, {
          addPosition: (nameSound || showResult) ? currentChallenge.addPosition : undefined,
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
    const showImage = currentChallenge.showWordImage !== false;
    const nameSound = currentChallenge.nameTargetSound !== false;
    const showHighlight = currentChallenge.showTargetHighlight !== false;
    const targetIdx = findTargetIndex(
      currentChallenge.originalPhonemes,
      currentChallenge.oldPhoneme!,
      currentChallenge.substitutePosition!,
    );

    return (
      <div className="space-y-5">
        {/* Word display */}
        <div className="text-center space-y-1">
          {showImage && (
            <p className="text-sm text-slate-500 italic">{currentChallenge.originalImage}</p>
          )}
          <p className="text-2xl font-bold text-slate-100">&ldquo;{currentChallenge.originalWord}&rdquo;</p>
        </div>

        {/* Instruction */}
        <p className="text-center text-lg text-slate-300 font-medium">
          {nameSound ? (
            <>Change the <span className="text-amber-300">{currentChallenge.oldPhoneme}</span> to a new sound</>
          ) : (
            <>Change one sound to make a new word</>
          )}
        </p>

        {/* Phoneme tiles. The amber target highlight is a perception scaffold — at
            hard it is withdrawn so the student locates the sound to change, but the
            swap result still animates on the correct tile after answering. */}
        {renderPhonemeTiles(currentChallenge.originalPhonemes, {
          highlightIdx: (!showResult && showHighlight) ? targetIdx : null,
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
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const elapsedMs = Date.now() - startTimeRef.current;

  // ── Start screen ──────────────────────────────────────────────────
  if (!hasStarted) {
    const operations = Array.from(new Set(challenges.map(ch => ch.operation)));
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-8 flex flex-col items-center text-center space-y-5">
          <div className="text-4xl">{'🔄'}</div>
          <LuminaCardTitle className="text-xl">{title}</LuminaCardTitle>
          <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
          <p className="text-slate-400 text-sm max-w-sm">
            {challenges.length} challenges across{' '}
            {operations.map(o => OPERATION_LABELS[o]).join(', ')} modes.
            Change sounds in words to make new words!
          </p>
          <LuminaButton
            tone="primary"
            onClick={() => {
              startTimeRef.current = Date.now();
              setHasStarted(true);
            }}
            className="px-8 py-3 text-lg"
          >
            Start Activity
          </LuminaButton>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            <div className="flex items-center gap-2">
              <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
            </div>
          </div>
          {currentChallenge && !showSummary && (
            <LuminaBadge accent={OPERATION_ACCENTS[currentChallenge.operation]} className="text-xs">
              {OPERATION_ICONS[currentChallenge.operation]} {OPERATION_LABELS[currentChallenge.operation]}
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Progress indicator */}
        {!showSummary && (
          <>
            <div className="flex items-center justify-between text-sm">
              <LuminaChallengeCounter
                current={currentIndex + 1}
                total={challenges.length}
                className="text-slate-400"
              />
              <span className="text-slate-500 text-xs">
                {challengeResults.filter(r => r.correct).length} correct
              </span>
            </div>
            <LuminaProgress
              accent="purple"
              value={((showResult ? currentIndex + 1 : currentIndex) / challenges.length) * 100}
            />
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
          <LuminaFeedbackCard status={feedbackType === 'error' ? 'incorrect' : 'correct'}>
            {feedback}
          </LuminaFeedbackCard>
        )}

        {/* Resolved footer. The culminating say-it beat is the PRIMARY next step
            (auto-advances on a judged new word); it applies to every operation
            because each ends by producing a single result word. The mic is always
            additive — a quiet Skip is always reachable and 'no-match' is never
            scored. When the mic isn't supported, it falls back to Next / Finish. */}
        {showResult && !showSummary && currentChallenge && (
          spokenCapture.isSupported && spokenTargetWord ? (
            <div className="flex flex-col items-center gap-3">
              {spokenWords.has(currentChallenge.id) ? (
                // Said it → celebrate, then auto-glide to the next challenge (effect above)
                <div className="flex flex-col items-center gap-1">
                  <span className="text-emerald-300 text-base font-semibold">
                    🎉 You said “{spokenTargetWord}” out loud!
                  </span>
                  <span className="text-slate-500 text-xs">
                    {currentIndex < challenges.length - 1 ? 'Next challenge coming up…' : 'Wrapping up…'}
                  </span>
                </div>
              ) : (
                // Mic available → the say-the-new-word beat is the PRIMARY next step
                <div className="flex flex-col items-center gap-3">
                  <p className="text-slate-300 text-sm font-medium">Your turn — say the new word!</p>
                  <div className="flex items-center justify-center gap-3 flex-wrap min-h-[52px]">
                    {spokenCapture.state === 'idle' && (
                      <LuminaButton
                        tone="primary"
                        onClick={() => void spokenCapture.start()}
                        className="text-lg px-8 py-3"
                      >
                        🎙️ Say “{spokenTargetWord}”!
                      </LuminaButton>
                    )}
                    {(spokenCapture.state === 'armed' || spokenCapture.state === 'recording') && (
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-semibold ${
                            spokenCapture.state === 'recording'
                              ? 'text-emerald-300'
                              : 'text-amber-300 animate-pulse'
                          }`}
                        >
                          {spokenCapture.state === 'recording'
                            ? 'Listening…'
                            : `Say “${spokenTargetWord}”!`}
                        </span>
                        <div className="w-20 h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-75"
                            style={{ width: `${Math.min(100, Math.round((spokenCapture.level / 0.12) * 100))}%` }}
                          />
                        </div>
                        <button
                          onClick={spokenCapture.cancel}
                          className="text-slate-500 text-xs hover:text-slate-300"
                          aria-label="Stop listening"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    {spokenCapture.state === 'judging' && (
                      <span className="text-blue-300 text-sm animate-pulse">Checking…</span>
                    )}
                  </div>
                  {/* Quiet skip — never traps a student who can't or won't speak */}
                  {spokenCapture.state === 'idle' && (
                    <button
                      onClick={handleNext}
                      className="text-slate-500 text-xs hover:text-slate-300 transition-colors"
                    >
                      {currentIndex < challenges.length - 1 ? 'Skip →' : 'Skip to finish →'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex justify-center">
              <LuminaActionButton action="next" onClick={handleNext}>
                {currentIndex < challenges.length - 1 ? 'Next Challenge' : 'Finish'}
              </LuminaActionButton>
            </div>
          )
        )}

        {/* Phase summary panel */}
        {showSummary && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedScore ?? undefined}
            durationMs={elapsedMs}
            heading="Sound Swap Complete!"
            celebrationMessage={`You practiced adding, removing, and swapping sounds in words!${spokenWords.size > 0 ? ` You said ${spokenWords.size} new word${spokenWords.size === 1 ? '' : 's'} out loud — amazing!` : ''}`}
            className="mb-6"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default SoundSwap;
