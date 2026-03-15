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
  taskType: 'fill-vowel' | 'spell-word' | 'word-sort';
  targetWord: string;
  targetLetters: string[];     // e.g. ['c', 'a', 't']
  targetPhonemes: string[];    // e.g. ['/k/', '/æ/', '/t/']
  emoji: string;
  imageDescription: string;
  distractorLetters: string[];
  vowelOptions?: string[];     // fill-vowel: exactly 2 vowels
  sortBucketLabel?: string;    // word-sort: which bucket (e.g. 'short-a')
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
  a: 'apple', e: 'egg', i: 'itch', o: 'octopus', u: 'up',
};

const TASK_TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  'fill-vowel': { label: 'Fill the Vowel', icon: '\uD83D\uDD24' },
  'spell-word': { label: 'Spell It', icon: '\uD83D\uDCDD' },
  'word-sort': { label: 'Sort by Sound', icon: '\uD83D\uDCE5' },
};

const PHASE_CONFIG: Record<string, PhaseConfig> = {
  'fill-vowel': { label: 'Fill the Vowel', accentColor: 'purple' },
  'spell-word': { label: 'Spell It', accentColor: 'emerald' },
  'word-sort': { label: 'Sort by Sound', accentColor: 'amber' },
};

const MAX_ATTEMPTS = 3;

// ============================================================================
// Speaker Icon SVG
// ============================================================================

const SpeakerIcon: React.FC<{ className?: string; size?: string }> = ({ className = '', size = 'w-8 h-8' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`${size} ${className}`}
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" opacity={0.3} />
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

// ============================================================================
// Props
// ============================================================================

interface CvcSpellerProps {
  data: CvcSpellerData;
  className?: string;
}

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
    getChallengeType: (ch) => ch.taskType,
    phaseConfig: PHASE_CONFIG,
  });

  const currentChallenge = challenges[currentChallengeIndex] ?? null;

  // -------------------------------------------------------------------------
  // Domain-specific state
  // -------------------------------------------------------------------------
  // spell-word mode
  const [slots, setSlots] = useState<(string | null)[]>([null, null, null]);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(0);

  // fill-vowel mode
  const [selectedVowel, setSelectedVowel] = useState<string | null>(null);

  // word-sort mode
  const [sortedBucket, setSortedBucket] = useState<string | null>(null);

  // Shared UI state
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  const [isShaking, setIsShaking] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [wordComplete, setWordComplete] = useState(false);

  // Tracking
  const [vowelErrors, setVowelErrors] = useState(0);
  const [vowelCorrect, setVowelCorrect] = useState(0);
  const [consonantErrors, setConsonantErrors] = useState(0);
  const [consonantCorrect, setConsonantCorrect] = useState(0);
  const [stretchUsedCount, setStretchUsedCount] = useState(0);
  const [errorPatterns, setErrorPatterns] = useState<string[]>([]);

  // Stable instance ID
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

  // Build letter bank for spell-word mode
  const letterBank = useMemo(() => {
    if (!currentChallenge || currentChallenge.taskType !== 'spell-word') return [];
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

  // -------------------------------------------------------------------------
  // AI Tutoring Integration
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    vowelFocus,
    letterGroup,
    taskType: currentChallenge?.taskType ?? '',
    targetWord: currentChallenge?.targetWord ?? '',
    targetPhonemes: currentChallenge?.targetPhonemes?.join(' ') ?? '',
    targetLetters: currentChallenge?.targetLetters?.join(', ') ?? '',
    placedLetters: slots.map(s => s || '_').join(', '),
    currentChallenge: currentChallengeIndex + 1,
    totalChallenges: challenges.length,
    attempts: currentAttempts,
    firstPhoneme: currentChallenge?.targetPhonemes?.[0] ?? '',
    middlePhoneme: currentChallenge?.targetPhonemes?.[1] ?? '',
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

  // -------------------------------------------------------------------------
  // Activity introduction
  // -------------------------------------------------------------------------
  const hasIntroducedRef = useRef(false);

  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || !currentChallenge) return;
    hasIntroducedRef.current = true;

    const vowelLabel = VOWEL_LABELS[vowelFocus] || vowelFocus;
    const taskLabel = TASK_TYPE_CONFIG[currentChallenge.taskType]?.label || currentChallenge.taskType;
    sendText(
      `[ACTIVITY_START] This is a CVC spelling activity focusing on ${vowelLabel}. `
      + `There are ${challenges.length} challenges. First up: ${taskLabel}. `
      + `Introduce the activity warmly, then say the first word "${currentChallenge.targetWord}" clearly. `
      + `Keep it brief — 2-3 sentences.`,
      { silent: true }
    );
  }, [isConnected, currentChallenge, vowelFocus, challenges.length, sendText]);

  // -------------------------------------------------------------------------
  // Auto-play word on challenge load (all modes)
  // -------------------------------------------------------------------------
  const lastAutoPlayedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isConnected || !currentChallenge || wordComplete) return;
    if (lastAutoPlayedRef.current === currentChallenge.id) return;
    // Skip for the first challenge — the intro already says the word
    if (currentChallengeIndex === 0 && hasIntroducedRef.current) {
      lastAutoPlayedRef.current = currentChallenge.id;
      return;
    }

    lastAutoPlayedRef.current = currentChallenge.id;
    const timer = setTimeout(() => {
      sendText(
        `[SAY_WORD] Say the word "${currentChallenge.targetWord}" clearly. Just the word, said twice with a pause.`,
        { silent: true },
      );
    }, 500);
    return () => clearTimeout(timer);
  }, [isConnected, currentChallenge, wordComplete, currentChallengeIndex, sendText]);

  // -------------------------------------------------------------------------
  // Reset domain state for next challenge
  // -------------------------------------------------------------------------
  const resetDomainState = useCallback(() => {
    setSlots([null, null, null]);
    setActiveSlotIndex(0);
    setSelectedVowel(null);
    setSortedBucket(null);
    setFeedback('');
    setFeedbackType('');
    setWordComplete(false);
    setIsShaking(false);
    setIsCelebrating(false);
  }, []);

  // -------------------------------------------------------------------------
  // Hear Again / Stretch handlers (shared)
  // -------------------------------------------------------------------------
  const handleHearAgain = useCallback(() => {
    if (!currentChallenge) return;
    sendText(
      `[REPEAT_WORD] Say: "The word is... ${currentChallenge.targetWord}." Say it slowly and clearly. Then say it once more.`,
      { silent: true }
    );
  }, [currentChallenge, sendText]);

  const handleStretch = useCallback(() => {
    if (!currentChallenge) return;
    setStretchUsedCount(prev => prev + 1);
    const stretched = currentChallenge.targetPhonemes.join('... ');

    // Progressive stretching based on attempts
    if (currentAttempts === 0) {
      // Level 1: stretch the whole word
      sendText(
        `[STRETCH_WORD] Say the word "${currentChallenge.targetWord}" stretched out slowly: "${stretched}". Pause between each sound.`,
        { silent: true }
      );
    } else if (currentAttempts === 1) {
      // Level 2: emphasize the vowel
      const vowelPhoneme = currentChallenge.targetPhonemes[1] || '';
      const vowelLetter = currentChallenge.targetLetters[1] || '';
      const keyword = VOWEL_KEYWORDS[vowelLetter] || '';
      sendText(
        `[STRETCH_VOWEL] Stretch the word "${currentChallenge.targetWord}" and EMPHASIZE the middle vowel sound: `
        + `"${currentChallenge.targetPhonemes[0]}... ${vowelPhoneme}${vowelPhoneme}${vowelPhoneme}... ${currentChallenge.targetPhonemes[2]}". `
        + `Then say: "Hear that middle sound? It's ${vowelPhoneme}, like in ${keyword}."`,
        { silent: true }
      );
    } else {
      // Level 3: isolate the vowel
      const vowelPhoneme = currentChallenge.targetPhonemes[1] || '';
      const vowelLetter = currentChallenge.targetLetters[1] || '';
      const keyword = VOWEL_KEYWORDS[vowelLetter] || '';
      sendText(
        `[ISOLATE_VOWEL] Say: "Listen to just the middle sound: ${vowelPhoneme}... ${vowelPhoneme}. `
        + `That's the ${vowelPhoneme} sound, like in ${keyword}. The letter is ${vowelLetter.toUpperCase()}."`,
        { silent: true }
      );
    }
  }, [currentChallenge, currentAttempts, sendText]);

  // =========================================================================
  // FILL-VOWEL MODE HANDLER
  // =========================================================================
  const handleFillVowelSelect = useCallback((vowel: string) => {
    if (!currentChallenge || wordComplete || hasSubmittedEvaluation) return;

    setSelectedVowel(vowel);
    incrementAttempts();
    const attempt = currentAttempts + 1;

    const correctVowel = currentChallenge.targetLetters[1]?.toLowerCase();
    const isCorrect = vowel.toLowerCase() === correctVowel;

    if (isCorrect) {
      setVowelCorrect(prev => prev + 1);
      setFeedback(`Yes! "${currentChallenge.targetWord}" has the ${vowel} sound in the middle!`);
      setFeedbackType('success');
      setWordComplete(true);
      setIsCelebrating(true);
      setTimeout(() => setIsCelebrating(false), 1500);

      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: attempt,
        taskType: currentChallenge.taskType,
      });

      sendText(
        `[ANSWER_CORRECT] Student correctly picked "${vowel}" for "${currentChallenge.targetWord}"! `
        + `${attempt === 1 ? 'First try!' : `After ${attempt} attempts.`} `
        + `Say the word and emphasize the vowel: "${currentChallenge.targetWord}... yes, ${currentChallenge.targetPhonemes[1]}!" Celebrate briefly.`,
        { silent: true }
      );
    } else {
      setVowelErrors(prev => prev + 1);
      setSelectedVowel(null);
      const correctKeyword = VOWEL_KEYWORDS[correctVowel] || '';
      const wrongKeyword = VOWEL_KEYWORDS[vowel] || '';

      setFeedback('Listen again — which vowel sound is in the middle?');
      setFeedbackType('error');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);

      // Progressive AI scaffolding
      if (attempt === 1) {
        // Level 1: say the word naturally, ask to listen
        sendText(
          `[FILL_VOWEL_WRONG] Student chose "${vowel}" but correct is "${correctVowel}" in "${currentChallenge.targetWord}". `
          + `Attempt ${attempt}. Say the word again clearly: "${currentChallenge.targetWord}." `
          + `Ask: "Listen to the middle sound... is it /${vowel}/ like ${wrongKeyword}, or /${correctVowel}/ like ${correctKeyword}?"`,
          { silent: true }
        );
      } else if (attempt === 2) {
        // Level 2: stretch the vowel
        sendText(
          `[FILL_VOWEL_STRETCH] Student still struggling. Stretch the word with emphasis on the vowel: `
          + `"${currentChallenge.targetPhonemes[0]}... ${currentChallenge.targetPhonemes[1]}${currentChallenge.targetPhonemes[1]}${currentChallenge.targetPhonemes[1]}... ${currentChallenge.targetPhonemes[2]}". `
          + `"Hear that long sound in the middle? That's /${correctVowel}/ like ${correctKeyword}!"`,
          { silent: true }
        );
      }

      if (attempt >= MAX_ATTEMPTS) {
        setFeedback(`The word "${currentChallenge.targetWord}" has the letter "${correctVowel}" in the middle — /${correctVowel}/ like ${correctKeyword}.`);
        setFeedbackType('error');
        setWordComplete(true);
        recordResult({
          challengeId: currentChallenge.id,
          correct: false,
          attempts: attempt,
          taskType: currentChallenge.taskType,
        });
        sendText(
          `[FILL_VOWEL_REVEAL] Student couldn't get it. Say: "${currentChallenge.targetWord} has the /${correctVowel}/ sound, `
          + `like in ${correctKeyword}. The letter is ${correctVowel.toUpperCase()}." Say the word one more time. Keep encouraging.`,
          { silent: true }
        );
      }
    }
  }, [currentChallenge, wordComplete, hasSubmittedEvaluation, currentAttempts, incrementAttempts, recordResult, sendText]);

  // =========================================================================
  // SPELL-WORD MODE HANDLERS (existing Elkonin box logic)
  // =========================================================================
  const handleSelectLetter = useCallback((letter: string) => {
    if (hasSubmittedEvaluation || wordComplete || activeSlotIndex === null) return;

    setSlots(prev => {
      const next = [...prev];
      next[activeSlotIndex] = letter;
      return next;
    });

    sendText(
      `[CONFIRM_SOUND] The student placed "${letter}". Say just the sound that "${letter}" makes — a clean phoneme, nothing else.`,
      { silent: true }
    );

    setActiveSlotIndex(prev => {
      if (prev === null) return null;
      const newSlots = [...slots];
      newSlots[prev] = letter;
      for (let i = 0; i < 3; i++) {
        const nextIdx = (prev + 1 + i) % 3;
        if (newSlots[nextIdx] === null) return nextIdx;
      }
      return null;
    });

    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation, wordComplete, activeSlotIndex, slots, sendText]);

  const handleSlotTap = useCallback((index: number) => {
    if (hasSubmittedEvaluation || wordComplete) return;
    if (slots[index] !== null) {
      setSlots(prev => { const next = [...prev]; next[index] = null; return next; });
      setActiveSlotIndex(index);
    } else {
      setActiveSlotIndex(index);
    }
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation, wordComplete, slots]);

  const handleCheckSpelling = useCallback(() => {
    if (!currentChallenge) return;

    incrementAttempts();
    const attempt = currentAttempts + 1;

    const target = currentChallenge.targetLetters.map(l => l.toLowerCase());
    const placed = slots.map(s => (s || '').toLowerCase());
    const isCorrect = placed.length === target.length && placed.every((l, i) => l === target[i]);

    if (isCorrect) {
      target.forEach((letter) => {
        if (VOWELS.has(letter)) setVowelCorrect(prev => prev + 1);
        else setConsonantCorrect(prev => prev + 1);
      });

      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: attempt,
        taskType: currentChallenge.taskType,
        firstTry: attempt === 1,
      });

      setFeedback(`You spelled "${currentChallenge.targetWord}"!`);
      setFeedbackType('success');
      setWordComplete(true);
      setIsCelebrating(true);
      setTimeout(() => setIsCelebrating(false), 1500);

      sendText(
        `[SPELLING_CORRECT] Student correctly spelled "${currentChallenge.targetWord}"${attempt === 1 ? ' on the first try!' : ` after ${attempt} attempts.`} `
        + `Say "You spelled ${currentChallenge.targetWord}! Great job!" and say the word.`,
        { silent: true }
      );
    } else {
      const wrongPositions: string[] = [];
      target.forEach((letter, i) => {
        if (placed[i] !== letter) {
          wrongPositions.push(i === 0 ? 'beginning' : i === 1 ? 'middle' : 'end');
          if (VOWELS.has(letter)) setVowelErrors(prev => prev + 1);
          else setConsonantErrors(prev => prev + 1);
        }
      });

      const isVowelConfusion = placed[1] !== target[1] && VOWELS.has(target[1]) && VOWELS.has(placed[1]);
      const placedStr = placed.join('');
      const matchedError = currentChallenge.commonErrors?.find(e => e.errorSpelling.toLowerCase() === placedStr);

      if (matchedError) {
        setErrorPatterns(prev => [...prev, matchedError.errorSpelling]);
        setFeedback(matchedError.feedback);
      } else {
        setFeedback(`Not quite! Check the ${wrongPositions.join(' and ')} sound${wrongPositions.length > 1 ? 's' : ''}.`);
      }
      setFeedbackType('error');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);

      // Progressive AI scaffolding for spell-word
      if (isVowelConfusion) {
        const correctVowel = target[1];
        const wrongVowel = placed[1];
        const correctKeyword = VOWEL_KEYWORDS[correctVowel] || correctVowel;
        const wrongKeyword = VOWEL_KEYWORDS[wrongVowel] || wrongVowel;

        sendText(
          `[VOWEL_CONFUSION] Student placed "${wrongVowel}" instead of "${correctVowel}" in "${currentChallenge.targetWord}". `
          + `Attempt ${attempt}. Say: "Listen to the middle sound — it's /${correctVowel}/ like ${correctKeyword}, not /${wrongVowel}/ like ${wrongKeyword}." `
          + `Say both sounds.`,
          { silent: true }
        );
      } else if (attempt === 1) {
        // Level 1: say word naturally
        sendText(
          `[SPELLING_HINT_L1] Student tried "${placedStr}" for "${currentChallenge.targetWord}". Wrong position: ${wrongPositions.join(', ')}. `
          + `Attempt ${attempt}. Say the word again: "${currentChallenge.targetWord}." Ask about the ${wrongPositions[0]} sound.`,
          { silent: true }
        );
      } else {
        // Level 2: segment
        sendText(
          `[SPELLING_HINT_L2] Student still struggling with "${currentChallenge.targetWord}" (tried "${placedStr}"). `
          + `Segment it: "${currentChallenge.targetPhonemes.join('... ')}". Point to each sound.`,
          { silent: true }
        );
      }
    }
  }, [currentChallenge, slots, currentAttempts, incrementAttempts, recordResult, sendText]);

  // =========================================================================
  // WORD-SORT MODE HANDLER
  // =========================================================================
  const handleWordSort = useCallback((bucketLabel: string) => {
    if (!currentChallenge || wordComplete || hasSubmittedEvaluation) return;

    setSortedBucket(bucketLabel);
    incrementAttempts();
    const attempt = currentAttempts + 1;

    const correctBucket = currentChallenge.sortBucketLabel || vowelFocus;
    const isCorrect = bucketLabel === correctBucket;

    if (isCorrect) {
      setVowelCorrect(prev => prev + 1);
      setFeedback(`Yes! "${currentChallenge.targetWord}" has the ${correctBucket.replace('short-', '')} sound!`);
      setFeedbackType('success');
      setWordComplete(true);
      setIsCelebrating(true);
      setTimeout(() => setIsCelebrating(false), 1500);

      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: attempt,
        taskType: currentChallenge.taskType,
      });

      sendText(
        `[SORT_CORRECT] Student correctly sorted "${currentChallenge.targetWord}" into the ${correctBucket} bucket! `
        + `${attempt === 1 ? 'First try!' : `After ${attempt} attempts.`} `
        + `Say the word and confirm the vowel sound. Brief celebration.`,
        { silent: true }
      );
    } else {
      setVowelErrors(prev => prev + 1);
      setSortedBucket(null);

      setFeedback('Listen to the middle sound again — which vowel is it?');
      setFeedbackType('error');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);

      const correctVowel = correctBucket.replace('short-', '');
      const wrongVowel = bucketLabel.replace('short-', '');
      const correctKeyword = VOWEL_KEYWORDS[correctVowel] || '';
      const wrongKeyword = VOWEL_KEYWORDS[wrongVowel] || '';

      if (attempt === 1) {
        // Level 1: say word naturally, contrast
        sendText(
          `[SORT_WRONG_L1] Student sorted "${currentChallenge.targetWord}" into ${bucketLabel} but it belongs in ${correctBucket}. `
          + `Say the word again: "${currentChallenge.targetWord}." Then contrast: `
          + `"Is the middle sound /${wrongVowel}/ like ${wrongKeyword}... or /${correctVowel}/ like ${correctKeyword}?"`,
          { silent: true }
        );
      } else {
        // Level 2: stretch and isolate
        sendText(
          `[SORT_WRONG_L2] Student still wrong. Stretch: "${currentChallenge.targetPhonemes.join('... ')}". `
          + `Emphasize: "Hear that middle sound? It's /${correctVowel}/ like ${correctKeyword}!"`,
          { silent: true }
        );
      }

      if (attempt >= MAX_ATTEMPTS) {
        setFeedback(`"${currentChallenge.targetWord}" has the /${correctVowel}/ sound — it goes in the ${correctBucket} bucket!`);
        setFeedbackType('error');
        setWordComplete(true);
        recordResult({
          challengeId: currentChallenge.id,
          correct: false,
          attempts: attempt,
          taskType: currentChallenge.taskType,
        });
        sendText(
          `[SORT_REVEAL] Reveal: "${currentChallenge.targetWord}" has /${correctVowel}/ like ${correctKeyword}. It goes in ${correctBucket}. Keep encouraging.`,
          { silent: true }
        );
      }
    }
  }, [currentChallenge, wordComplete, hasSubmittedEvaluation, currentAttempts, vowelFocus, incrementAttempts, recordResult, sendText]);

  // -------------------------------------------------------------------------
  // Move to next word or submit evaluation
  // -------------------------------------------------------------------------
  const handleNextWord = useCallback(() => {
    const advanced = advanceProgress();

    if (!advanced) {
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
          taskType: challenges[0]?.taskType || 'spell-word',
          wordsSpelledCorrectly: wordsCorrect,
          wordsTotal: totalWords,
          vowelAccuracy: vowelAcc,
          consonantAccuracy: consonantAcc,
          commonErrors: Array.from(new Set(errorPatterns)),
          stretchUsed: stretchUsedCount,
          attemptsCount: totalAttempts,
        };

        submitEvaluation(overallAcc >= 60, overallAcc, metrics, { challengeResults });

        const phaseStr = phaseResults.length > 0
          ? phaseResults.map(p => `${p.label} ${p.score}%`).join(', ')
          : `${wordsCorrect}/${totalWords} correct`;
        sendText(
          `[ALL_COMPLETE] Student finished! ${phaseStr}. Overall: ${overallAcc}%. `
          + `Vowel accuracy: ${vowelAcc}%. Give encouraging, specific feedback.`,
          { silent: true }
        );
      }
      return;
    }

    resetDomainState();
  }, [
    advanceProgress, challenges, challengeResults, hasSubmittedEvaluation,
    vowelCorrect, vowelErrors, consonantCorrect, consonantErrors,
    errorPatterns, stretchUsedCount, vowelFocus, phaseResults,
    submitEvaluation, sendText, resetDomainState,
  ]);

  const handleClearAll = useCallback(() => {
    setSlots([null, null, null]);
    setActiveSlotIndex(0);
    setFeedback('');
    setFeedbackType('');
  }, []);

  // -------------------------------------------------------------------------
  // Overall score
  // -------------------------------------------------------------------------
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    return Math.round((challengeResults.filter(r => r.correct).length / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  // =========================================================================
  // Render: Fill-Vowel Mode
  // =========================================================================
  const renderFillVowel = () => {
    if (!currentChallenge) return null;
    const letters = currentChallenge.targetLetters;
    const vowelOpts = currentChallenge.vowelOptions || [];

    return (
      <div className="space-y-6">
        {/* Consonant frame with blank */}
        <div className="flex items-center justify-center gap-2">
          {/* First consonant */}
          <div className="w-20 h-20 rounded-xl bg-blue-500/15 border-2 border-blue-500/30 flex items-center justify-center text-3xl font-bold uppercase text-blue-300">
            {letters[0]}
          </div>
          {/* Vowel slot — blank or selected */}
          <div className={`
            w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center text-3xl font-bold uppercase transition-all
            ${wordComplete && selectedVowel
              ? 'bg-emerald-500/30 border-emerald-400/60 text-emerald-200'
              : selectedVowel
                ? 'bg-red-500/15 border-red-500/30 text-red-300'
                : 'bg-slate-800/40 border-slate-500/40 text-slate-500 animate-pulse'
            }
            ${isShaking ? 'animate-shake' : ''}
            ${isCelebrating ? 'animate-bounce' : ''}
          `}>
            {selectedVowel || '?'}
          </div>
          {/* Last consonant */}
          <div className="w-20 h-20 rounded-xl bg-blue-500/15 border-2 border-blue-500/30 flex items-center justify-center text-3xl font-bold uppercase text-blue-300">
            {letters[2]}
          </div>
        </div>

        <p className="text-center text-slate-400 text-sm">
          Which vowel sound do you hear in the middle?
        </p>

        {/* Two vowel options — big, chunky, color-coded */}
        <div className="flex items-center justify-center gap-6 sm:gap-10">
          {vowelOpts.map((vowel, idx) => {
            const keyword = VOWEL_KEYWORDS[vowel] || '';
            const isSelected = selectedVowel === vowel;
            const showCorrect = wordComplete && vowel === letters[1]?.toLowerCase();
            const showWrong = isSelected && feedbackType === 'error';

            return (
              <button
                key={idx}
                onClick={() => handleFillVowelSelect(vowel)}
                disabled={wordComplete}
                className={`
                  flex flex-col items-center justify-center gap-1
                  w-24 h-24 sm:w-28 sm:h-28 rounded-2xl
                  border-2 transition-all duration-300 cursor-pointer
                  ${showCorrect
                    ? 'bg-emerald-500/30 border-emerald-400/60 scale-110'
                    : showWrong
                      ? 'bg-red-500/20 border-red-500/40 scale-95'
                      : 'bg-red-500/10 border-red-400/30 hover:bg-red-500/20 hover:scale-105'
                  }
                  disabled:cursor-default
                `}
              >
                <span className="text-4xl font-bold text-red-300 uppercase">{vowel}</span>
                <span className="text-[10px] text-slate-500">{keyword}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // =========================================================================
  // Render: Spell-Word Mode (Elkonin boxes)
  // =========================================================================
  const renderSpellWord = () => {
    if (!currentChallenge) return null;
    return (
      <div className="space-y-5">
        {/* Word hint: emoji */}
        <div className="flex items-center justify-center gap-3 rounded-xl bg-white/5 border border-white/10 px-5 py-3">
          {currentChallenge.emoji && <span className="text-4xl">{currentChallenge.emoji}</span>}
          {currentChallenge.imageDescription && (
            <p className="text-slate-400 text-sm italic">{currentChallenge.imageDescription}</p>
          )}
        </div>

        {/* Elkonin box slots */}
        <div className="flex items-center justify-center gap-3">
          {slots.map((letter, index) => {
            const isActive = activeSlotIndex === index;
            const isFilled = letter !== null;
            const isCorrectLetter = wordComplete && letter === currentChallenge.targetLetters[index]?.toLowerCase();
            const isVowelSlot = index === 1;

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
                        ? isVowelSlot
                          ? 'bg-red-500/15 border-red-500/30 text-red-300 hover:border-red-400/50'
                          : 'bg-slate-700/50 border-slate-500/40 text-slate-200 hover:border-slate-400/60'
                        : 'bg-slate-800/40 border-dashed border-slate-600/40 text-slate-600 hover:border-slate-500/50'
                  }
                  ${isShaking && isFilled && !isCorrectLetter ? 'animate-shake' : ''}
                  ${isCelebrating && isCorrectLetter ? 'animate-bounce' : ''}
                `}
              >
                {letter ? <span>{letter}</span> : <span className="text-lg">?</span>}
                <span className="absolute -bottom-5 text-[10px] text-slate-600">
                  {index === 0 ? 'begin' : index === 1 ? 'middle' : 'end'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Letter Bank */}
        {!wordComplete && (
          <div className="rounded-xl bg-slate-800/40 border border-white/5 p-4">
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
                        ? 'bg-red-500/15 border-red-500/30 text-red-300 hover:bg-red-500/25'
                        : 'bg-blue-500/15 border-blue-500/30 text-blue-300 hover:bg-blue-500/25'
                      }
                      ${(hasSubmittedEvaluation || wordComplete || activeSlotIndex === null) ? 'opacity-40 cursor-not-allowed hover:scale-100' : ''}
                    `}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Check / Clear buttons */}
        {!wordComplete && (
          <div className="flex items-center gap-2">
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
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // Render: Word-Sort Mode
  // =========================================================================
  const renderWordSort = () => {
    if (!currentChallenge) return null;

    // Determine the two bucket labels from the challenge data
    const targetVowelLetter = vowelFocus.replace('short-', '');
    const confusableVowels: Record<string, string> = { a: 'e', e: 'i', i: 'e', o: 'u', u: 'o' };
    const confusableVowel = confusableVowels[targetVowelLetter] || 'e';
    const bucket1 = vowelFocus;
    const bucket2 = `short-${confusableVowel}`;

    const correctBucket = currentChallenge.sortBucketLabel || vowelFocus;

    return (
      <div className="space-y-6">
        {/* Word to sort — shown as emoji + speaker button */}
        <div className="flex flex-col items-center gap-3">
          {currentChallenge.emoji && (
            <span className="text-5xl">{currentChallenge.emoji}</span>
          )}
          <button
            onClick={handleHearAgain}
            className="
              flex items-center justify-center gap-2 px-6 py-3
              rounded-full bg-amber-500/15 border-2 border-amber-500/30
              hover:bg-amber-500/25 hover:scale-105 transition-all cursor-pointer
            "
          >
            <SpeakerIcon className="text-amber-300" />
            <span className="text-amber-300 text-sm font-medium">Hear the word</span>
          </button>
        </div>

        <p className="text-center text-slate-400 text-sm">
          Which vowel sound do you hear? Sort into the right bucket!
        </p>

        {/* Two sort buckets */}
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          {[bucket1, bucket2].map((bucket) => {
            const bucketVowel = bucket.replace('short-', '');
            const keyword = VOWEL_KEYWORDS[bucketVowel] || '';
            const isSelected = sortedBucket === bucket;
            const showCorrect = wordComplete && bucket === correctBucket;
            const showWrong = isSelected && feedbackType === 'error';

            return (
              <button
                key={bucket}
                onClick={() => handleWordSort(bucket)}
                disabled={wordComplete}
                className={`
                  flex flex-col items-center justify-center gap-2
                  w-32 h-32 sm:w-36 sm:h-36 rounded-2xl
                  border-2 transition-all duration-300 cursor-pointer
                  ${showCorrect
                    ? 'bg-emerald-500/30 border-emerald-400/60 scale-110'
                    : showWrong
                      ? 'bg-red-500/20 border-red-500/40 scale-95'
                      : 'bg-purple-500/10 border-purple-400/30 hover:bg-purple-500/20 hover:scale-105'
                  }
                  ${isShaking && isSelected ? 'animate-shake' : ''}
                  disabled:cursor-default
                `}
              >
                <span className="text-3xl font-bold text-purple-300 uppercase">{bucketVowel}</span>
                <span className="text-xs text-slate-400">/{bucketVowel}/ like {keyword}</span>
                <span className="text-[10px] text-slate-600">{bucket}</span>
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
              {currentChallenge && (
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    currentChallenge.taskType === 'fill-vowel'
                      ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                      : currentChallenge.taskType === 'word-sort'
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  }`}
                >
                  {TASK_TYPE_CONFIG[currentChallenge.taskType]?.label || currentChallenge.taskType}
                </Badge>
              )}
            </div>
          </div>
          {!allChallengesComplete && (
            <Badge variant="outline" className="bg-blue-500/20 border-blue-500/40 text-blue-300 text-xs">
              {currentChallengeIndex + 1} / {challenges.length}
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

        {/* Audio controls — shared across all modes */}
        {!allChallengesComplete && (
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="ghost"
              onClick={handleHearAgain}
              className="bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 text-amber-300"
            >
              <SpeakerIcon className="text-amber-300 mr-1.5" size="w-4 h-4" /> Hear It
            </Button>
            <Button
              variant="ghost"
              onClick={handleStretch}
              className="bg-purple-500/15 border border-purple-500/30 hover:bg-purple-500/25 text-purple-300"
            >
              <span className="mr-1.5">{'\uD83D\uDC0C'}</span> Stretch It
            </Button>
          </div>
        )}

        {/* Task-specific content */}
        {!allChallengesComplete && currentChallenge && (
          <>
            {currentChallenge.taskType === 'fill-vowel' && renderFillVowel()}
            {currentChallenge.taskType === 'spell-word' && renderSpellWord()}
            {currentChallenge.taskType === 'word-sort' && renderWordSort()}
          </>
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

        {/* Next / Finish button */}
        {wordComplete && !allChallengesComplete && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={handleNextWord}
              className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300"
            >
              {currentChallengeIndex < challenges.length - 1 ? 'Next Word' : 'Finish'}
            </Button>
          </div>
        )}

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Spelling Complete!"
            celebrationMessage={`You got ${challengeResults.filter(r => r.correct).length} out of ${challenges.length} correct!`}
            className="mt-4"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default CvcSpeller;
