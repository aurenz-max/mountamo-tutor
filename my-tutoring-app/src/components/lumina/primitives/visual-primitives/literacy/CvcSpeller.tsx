'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaActionButton,
  LuminaFeedbackCard,
  LuminaMicListener,
  dropZoneStateClass,
  motion,
  type DropZoneState,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { CvcSpellerMetrics } from '../../../evaluation/types';
import type { DiagnosisEvidence } from '../../../evaluation/diagnosis/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useSpokenWordCapture, type SpokenJudgeResult } from '../../../hooks/useSpokenWordCapture';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface CvcSpellerChallenge {
  id: string;
  taskType: 'fill-vowel' | 'spell-word' | 'word-sort';
  targetWord: string;
  /** Private generator trace; never rendered as student-visible copy. */
  remediationMove?: 'contrast_vowel' | 'phoneme_slots' | 'minimal_pair_sort';
  targetLetters: string[];     // e.g. ['c', 'a', 't']
  targetPhonemes: string[];    // e.g. ['/k/', '/æ/', '/t/']
  emoji: string;
  imageDescription: string;
  distractorLetters: string[];
  /** Support-tier lever (spell-word + word-sort): show emoji/image self-check cue.
   *  Withdrawn at the hard tier so the student decodes purely from the heard sounds.
   *  Undefined (no tier) = treated as shown (default behavior preserved). */
  showPictureCue?: boolean;
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

  /** Within-mode support tier ('easy'|'medium'|'hard') — set by the generator from
   *  config.difficulty. Tunes the live tutor's reveal policy; never changes the words. */
  supportTier?: 'easy' | 'medium' | 'hard';

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

// Child-facing labels: no phoneme slash-notation in the child's field (reader-fit
// PRE contract); the tutor SPEAKS the sounds instead.
const VOWEL_LABELS: Record<string, string> = {
  'short-a': 'Short A',
  'short-e': 'Short E',
  'short-i': 'Short I',
  'short-o': 'Short O',
  'short-u': 'Short U',
};

const VOWEL_KEYWORDS: Record<string, string> = {
  a: 'apple', e: 'egg', i: 'itch', o: 'octopus', u: 'up',
};

const TASK_TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  'fill-vowel': { label: 'Fill the Vowel', icon: '🔤' },
  'spell-word': { label: 'Spell It', icon: '📝' },
  'word-sort': { label: 'Sort by Sound', icon: '📥' },
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
    supportTier,
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
  const [spellFlash, setSpellFlash] = useState<'correct' | 'incorrect' | null>(null);
  const spellFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [wordComplete, setWordComplete] = useState(false);

  // Tracking
  const [vowelErrors, setVowelErrors] = useState(0);
  const [vowelCorrect, setVowelCorrect] = useState(0);
  const [consonantErrors, setConsonantErrors] = useState(0);
  const [consonantCorrect, setConsonantCorrect] = useState(0);
  const [stretchUsedCount, setStretchUsedCount] = useState(0);
  const [errorPatterns, setErrorPatterns] = useState<string[]>([]);
  const diagnosisObservationsRef = useRef<Array<{
    challenge: string;
    expected: string;
    observed: string;
    judgeFeedback?: string;
  }>>([]);
  // Words the student said ALOUD (judge-confirmed) — the culminating production beat
  const [spokenWords, setSpokenWords] = useState<Set<string>>(new Set());

  // Stable instance ID
  const stableInstanceIdRef = useRef(instanceId || `cvc-speller-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  useEffect(
    () => () => {
      if (spellFlashTimer.current) clearTimeout(spellFlashTimer.current);
    },
    [],
  );

  // Mic availability, read inside sendText callbacks defined before spokenCapture
  const micSupportedRef = useRef(false);
  // Single audio control: tap 1 = hear the word, taps 2+ = progressive stretch
  const audioTapsRef = useRef(0);

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
    // Bank = targets + generator-tiered distractors only; availableLetters just
    // tops up to a floor of 5 so the support-tier distractor cap (clean/some/full)
    // actually controls how cluttered the bank is — unioning ALL availableLetters
    // defeated the tier lever and inflated the PRE screen to 13-16 elements.
    const allLetters = new Set<string>();
    currentChallenge.targetLetters.forEach(l => allLetters.add(l.toLowerCase()));
    currentChallenge.distractorLetters.forEach(l => allLetters.add(l.toLowerCase()));
    for (const l of availableLetters) {
      if (allLetters.size >= 5) break;
      allLetters.add(l.toLowerCase());
    }

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
    supportTier: supportTier ?? '',
    tutorRevealPolicy:
      supportTier === 'easy'
        ? 'EASY tier: you MAY name the strategy — tell the student to listen for the 3 sounds (or stretch the vowel), and walk them through the segmentation before they answer.'
        : supportTier === 'hard'
          ? 'HARD tier: do NOT name the segmentation strategy or pre-stretch unprompted. Say the word, then ask what sounds the student hears and let them work unaided. Only scaffold if they ask or after a wrong attempt. Never reveal the answer.'
          : supportTier === 'medium'
            ? 'MEDIUM tier: nudge execution only — say the word clearly and let the student work; offer a stretch only if they hesitate or miss.'
            : 'No support tier set — use the default progressive scaffolding.',
  }), [
    vowelFocus, letterGroup, currentChallenge, slots,
    currentChallengeIndex, challenges.length, currentAttempts, supportTier,
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
    const tierPosture =
      supportTier === 'easy'
        ? ' SUPPORT POSTURE (easy): name the listening strategy up front — tell the student to listen for the 3 sounds and stretch the vowel before answering.'
        : supportTier === 'hard'
          ? ' SUPPORT POSTURE (hard): do NOT name the segmentation strategy or pre-stretch. Say the word, then let the student work unaided; ask what sounds they hear rather than telling them. Never reveal the answer.'
          : supportTier === 'medium'
            ? ' SUPPORT POSTURE (medium): say the word clearly and let the student try; offer a stretch only if they hesitate.'
            : '';
    sendText(
      `[ACTIVITY_START] This is a CVC spelling activity focusing on ${vowelLabel}. `
      + `There are ${challenges.length} challenges. First up: ${taskLabel}. `
      + `Introduce the activity warmly, then say the first word "${currentChallenge.targetWord}" clearly. `
      + `Keep it brief — 2-3 sentences.${tierPosture}`,
      { silent: true }
    );
  }, [isConnected, currentChallenge, vowelFocus, challenges.length, supportTier, sendText]);

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
    audioTapsRef.current = 0;
    setSlots([null, null, null]);
    setActiveSlotIndex(0);
    setSelectedVowel(null);
    setSortedBucket(null);
    setFeedback('');
    setFeedbackType('');
    setWordComplete(false);
    setIsShaking(false);
    setIsCelebrating(false);
    setSpellFlash(null);
    if (spellFlashTimer.current) clearTimeout(spellFlashTimer.current);
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

  // One audio affordance for a pre-reader: first tap replays the word, further
  // taps walk the existing progressive stretch ladder (which self-limits by
  // attempts, so a zero-attempt tapper only ever gets the level-1 stretch).
  const handleAudioTap = useCallback(() => {
    audioTapsRef.current += 1;
    if (audioTapsRef.current === 1) {
      handleHearAgain();
    } else {
      handleStretch();
    }
  }, [handleHearAgain, handleStretch]);

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
      SoundManager.playCorrect();
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
        + `Say the word and emphasize the vowel: "${currentChallenge.targetWord}... yes, ${currentChallenge.targetPhonemes[1]}!" Celebrate briefly.`
        + (micSupportedRef.current ? ' Then warmly invite the student to say the whole word out loud themselves.' : ''),
        { silent: true }
      );
    } else {
      SoundManager.playIncorrect();
      setVowelErrors(prev => prev + 1);
      setSelectedVowel(null);
      const correctKeyword = VOWEL_KEYWORDS[correctVowel] || '';
      const wrongKeyword = VOWEL_KEYWORDS[vowel] || '';
      diagnosisObservationsRef.current.push({
        challenge: `Hear "${currentChallenge.targetWord}" and choose its middle vowel.`,
        expected: `Choose ${correctVowel}, matching the middle phoneme ${currentChallenge.targetPhonemes[1]}.`,
        observed: `Chose ${vowel} instead of ${correctVowel}.`,
      });

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

    SoundManager.tap();
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

    if (spellFlashTimer.current) clearTimeout(spellFlashTimer.current);
    setSpellFlash(isCorrect ? 'correct' : 'incorrect');
    spellFlashTimer.current = setTimeout(() => setSpellFlash(null), 900);

    if (isCorrect) {
      SoundManager.playCorrect();
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
        + `Say "You spelled ${currentChallenge.targetWord}! Great job!" and say the word.`
        + (micSupportedRef.current ? ' Then warmly invite the student to say the whole word out loud themselves.' : ''),
        { silent: true }
      );
    } else {
      SoundManager.playIncorrect();
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
      diagnosisObservationsRef.current.push({
        challenge: `Hear "${currentChallenge.targetWord}" and spell all three phonemes in order.`,
        expected: `Spell ${target.join('')} from ${currentChallenge.targetPhonemes.join(' ')}.`,
        observed: `Spelled ${placedStr || '(blank)'}.`,
      });
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
    // Child-facing + spoken strings use the vowel and its keyword, never the
    // `short-a` dev slug (reader-fit RF-4 — the tutor was reading the slug aloud).
    const correctVowel = correctBucket.replace('short-', '');
    const correctKeyword = VOWEL_KEYWORDS[correctVowel] || '';

    if (isCorrect) {
      SoundManager.playCorrect();
      setVowelCorrect(prev => prev + 1);
      setFeedback(`Yes! "${currentChallenge.targetWord}" has the ${correctVowel} sound!`);
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
        `[SORT_CORRECT] Student correctly sorted "${currentChallenge.targetWord}" into the /${correctVowel}/ bucket (like ${correctKeyword})! `
        + `${attempt === 1 ? 'First try!' : `After ${attempt} attempts.`} `
        + `Say the word and confirm the vowel sound. Brief celebration.`
        + (micSupportedRef.current ? ' Then warmly invite the student to say the whole word out loud themselves.' : ''),
        { silent: true }
      );
    } else {
      SoundManager.playIncorrect();
      setVowelErrors(prev => prev + 1);
      setSortedBucket(null);

      setFeedback('Listen to the middle sound again — which vowel is it?');
      setFeedbackType('error');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);

      const wrongVowel = bucketLabel.replace('short-', '');
      const wrongKeyword = VOWEL_KEYWORDS[wrongVowel] || '';
      diagnosisObservationsRef.current.push({
        challenge: `Sort "${currentChallenge.targetWord}" by its middle vowel sound.`,
        expected: `Sort into ${correctBucket}.`,
        observed: `Sorted into ${bucketLabel}.`,
      });

      if (attempt === 1) {
        // Level 1: say word naturally, contrast
        sendText(
          `[SORT_WRONG_L1] Student sorted "${currentChallenge.targetWord}" into the /${wrongVowel}/ bucket but it belongs in /${correctVowel}/. `
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
        setFeedback(`"${currentChallenge.targetWord}" has the /${correctVowel}/ sound — like ${correctKeyword}!`);
        setFeedbackType('error');
        setWordComplete(true);
        recordResult({
          challengeId: currentChallenge.id,
          correct: false,
          attempts: attempt,
          taskType: currentChallenge.taskType,
        });
        sendText(
          `[SORT_REVEAL] Reveal: "${currentChallenge.targetWord}" has /${correctVowel}/ like ${correctKeyword}. It goes in the /${correctVowel}/ bucket. Keep encouraging.`,
          { silent: true }
        );
      }
    }
  }, [currentChallenge, wordComplete, hasSubmittedEvaluation, currentAttempts, vowelFocus, incrementAttempts, recordResult, sendText]);

  // -------------------------------------------------------------------------
  // Spoken production beat — once the word is solved and displayed, the student
  // says the WHOLE word aloud; the judge ladder (Azure dual-signal → Gemini,
  // utils/spokenWordJudge.ts) confirms it. Purely additive: the mic never
  // bypasses the decoding challenge (it appears only after wordComplete), the
  // Next Word button is always available, and 'no-match' is never penalized.
  //   'match'   → celebrate + track (bonus production credit)
  //   'no-match'→ tutor models the word by voice, NO penalty
  //   'unclear' → invite a retry, silently
  // -------------------------------------------------------------------------
  const handleSpokenResult = useCallback((result: SpokenJudgeResult) => {
    if (!currentChallenge || spokenWords.has(currentChallenge.id)) return;
    if (result.outcome === 'match') {
      SoundManager.playCorrect();
      setSpokenWords(prev => new Set(Array.from(prev).concat(currentChallenge.id)));
      sendText(
        `[STUDENT_SAID_WORD] The student said "${currentChallenge.targetWord}" out loud all by themselves! Celebrate enthusiastically that they SAID the whole word (one sentence).`,
        { silent: true }
      );
    } else if (result.outcome === 'no-match' && result.verdict?.heard) {
      diagnosisObservationsRef.current.push({
        challenge: `Say the whole CVC word after decoding it.`,
        expected: `Produce all phonemes in "${currentChallenge.targetWord}" in order.`,
        observed: `Judge heard "${result.verdict.heard}".`,
        judgeFeedback: result.verdict.misconception
          || `The spoken-word judge heard "${result.verdict.heard}" instead of the decoded target and rated the mismatch high confidence.`,
      });
      sendText(
        `[SPOKEN_MISS] The student tried to say "${currentChallenge.targetWord}" aloud but it sounded like "${result.verdict.heard}". Gently model it — stretch the sounds "${currentChallenge.targetPhonemes.join('... ')}", then say the whole word — and invite one more try. Warm, never scolding. Two short sentences max.`,
        { silent: true }
      );
    } else {
      sendText(
        `[SPOKEN_UNCLEAR] The microphone didn't catch the student clearly. One friendly sentence: invite them to say "${currentChallenge.targetWord}" again a little louder, or just tap Next Word.`,
        { silent: true }
      );
    }
  }, [currentChallenge, spokenWords, sendText]);

  const spokenCapture = useSpokenWordCapture({
    targetWord: currentChallenge?.targetWord ?? '',
    gradeLevel: 'K',
    onResult: handleSpokenResult,
    onNoSpeech: () => {
      if (!currentChallenge || spokenWords.has(currentChallenge.id)) return;
      sendText(
        `[SPOKEN_UNCLEAR] The microphone didn't hear the student. One friendly sentence: invite them to say "${currentChallenge.targetWord}" again a little louder, or just tap Next Word.`,
        { silent: true }
      );
    },
  });
  micSupportedRef.current = spokenCapture.isSupported;

  // -------------------------------------------------------------------------
  // Move to next word or submit evaluation
  // -------------------------------------------------------------------------
  const handleNextWord = useCallback(() => {
    spokenCapture.cancel(); // never carry a live mic across challenges
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

        const observations = diagnosisObservationsRef.current;
        const latest = observations[observations.length - 1];
        const judgeBacked = [...observations].reverse().find(item => item.judgeFeedback);
        const evidenceSource = judgeBacked || latest;
        const diagnosisEvidence: DiagnosisEvidence | undefined = overallAcc < 60 && evidenceSource
          ? {
              challengeSummary: evidenceSource.challenge,
              expected: evidenceSource.expected,
              observed: evidenceSource.observed,
              judgeFeedback: judgeBacked?.judgeFeedback,
              priorAttempts: observations
                .filter(item => item !== evidenceSource)
                .slice(-4)
                .map(item => ({ challenge: item.challenge, observed: item.observed })),
            }
          : undefined;

        submitEvaluation(overallAcc >= 60, overallAcc, metrics, {
          challengeResults,
          spokenWords: Array.from(spokenWords),
        }, undefined, diagnosisEvidence);

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
    errorPatterns, stretchUsedCount, vowelFocus, phaseResults, spokenWords,
    submitEvaluation, sendText, resetDomainState, spokenCapture,
  ]);

  // Keep a live ref so the auto-advance timer always calls the latest handler.
  const handleNextWordRef = useRef(handleNextWord);
  handleNextWordRef.current = handleNextWord;

  // Strong-flow UX: once the student says the word aloud (judge-confirmed), glide
  // to the next challenge on their behalf — no extra click. The mic itself stays
  // tap-to-start (push-to-talk is the echo gate against the tutor's voice), but
  // everything after a successful production advances automatically.
  useEffect(() => {
    if (!currentChallenge || !spokenWords.has(currentChallenge.id)) return;
    const t = setTimeout(() => handleNextWordRef.current(), 1400);
    return () => clearTimeout(t);
  }, [spokenWords, currentChallenge]);

  // -------------------------------------------------------------------------
  // Session end. NOT allChallengesComplete: that flips the moment the LAST
  // result is recorded, which used to hide the feedback card, the spoken-
  // production beat, and the Finish button on the final word — making
  // handleNextWord (the only submitEvaluation call site) unreachable, so the
  // evaluation never submitted. The session ends when the student taps
  // Finish/skip (or says the word) and the submission has gone out.
  // -------------------------------------------------------------------------
  const sessionDone = hasSubmittedEvaluation;

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
          {/* dropzone-triage: answer display, not a selection-to-place target. */}
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
        {/* Picture self-check cue — emoji only (withdrawn at hard tier). The
            imageDescription sentence is unreadable at PRE; keep it for a11y only. */}
        {currentChallenge.showPictureCue !== false && currentChallenge.emoji && (
          <LuminaPanel className="flex items-center justify-center px-5 py-3">
            <span
              className="text-4xl"
              role="img"
              aria-label={currentChallenge.imageDescription || currentChallenge.targetWord}
            >
              {currentChallenge.emoji}
            </span>
          </LuminaPanel>
        )}

        {/* Elkonin box slots */}
        <div className="flex items-center justify-center gap-3">
          {slots.map((letter, index) => {
            const isActive = activeSlotIndex === index;
            const isFilled = letter !== null;
            const isVowelSlot = index === 1;
            const slotState: DropZoneState = spellFlash
              ?? (isFilled ? 'filled' : isActive ? 'dragOver' : 'idle');

            return (
              <button
                key={index}
                onClick={() => handleSlotTap(index)}
                disabled={sessionDone}
                className={`
                  relative w-20 h-20 rounded-xl border-2 flex items-center justify-center
                  text-3xl font-bold uppercase transition-all duration-200 cursor-pointer select-none
                  ${dropZoneStateClass(slotState)}
                  ${slotState === 'correct' ? motion.pop : ''}
                  ${slotState === 'incorrect' ? motion.shake : ''}
                  ${isVowelSlot && isFilled && !spellFlash ? 'text-red-300' : ''}
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
          <LuminaPanel className="p-4">
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
          </LuminaPanel>
        )}

        {/* Check — explicit confirm stays: a 3-slot construction is not an atomic
            selection. (Clear removed at PRE — tapping a filled box clears it.) */}
        {!wordComplete && (
          <div className="flex items-center justify-center">
            <LuminaActionButton
              action="check"
              onClick={handleCheckSpelling}
              disabled={slots.some(s => s === null)}
            >
              Check Spelling
            </LuminaActionButton>
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
        {/* Word to sort — emoji picture cue (withdrawn at hard tier); the shared
            Hear It control above is the single audio affordance */}
        {currentChallenge.showPictureCue !== false && currentChallenge.emoji && (
          <div className="flex justify-center">
            <span className="text-5xl">{currentChallenge.emoji}</span>
          </div>
        )}

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
                <span className="text-xs text-slate-400">like {keyword}</span>
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
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No spelling challenges available.</p>
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
              <LuminaBadge className="text-xs">
                {VOWEL_LABELS[vowelFocus] || vowelFocus}
              </LuminaBadge>
              {currentChallenge && (
                <LuminaBadge
                  className="text-xs"
                  accent={
                    currentChallenge.taskType === 'fill-vowel'
                      ? 'purple'
                      : currentChallenge.taskType === 'word-sort'
                        ? 'amber'
                        : 'emerald'
                  }
                >
                  {TASK_TYPE_CONFIG[currentChallenge.taskType]?.label || currentChallenge.taskType}
                </LuminaBadge>
              )}
            </div>
          </div>
          {!sessionDone && (
            <LuminaBadge accent="blue" className="text-xs">
              {currentChallengeIndex + 1} / {challenges.length}
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-5">
        {/* Progress dots */}
        {!sessionDone && (
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

        {/* One audio affordance (all modes): tap to hear the word; keep tapping
            and it stretches — Hear It + Stretch It collapsed for the PRE band */}
        {!sessionDone && (
          <div className="flex items-center justify-center">
            <button
              onClick={handleAudioTap}
              className="flex items-center rounded-full px-5 py-2.5 text-sm font-medium bg-amber-500/15 border-2 border-amber-500/30 hover:bg-amber-500/25 hover:scale-105 text-amber-300 transition-all cursor-pointer"
            >
              <SpeakerIcon className="text-amber-300 mr-1.5" size="w-5 h-5" /> Hear It
            </button>
          </div>
        )}

        {/* Task-specific content */}
        {!sessionDone && currentChallenge && (
          <>
            {currentChallenge.taskType === 'fill-vowel' && renderFillVowel()}
            {currentChallenge.taskType === 'spell-word' && renderSpellWord()}
            {currentChallenge.taskType === 'word-sort' && renderWordSort()}
          </>
        )}

        {/* Feedback */}
        {feedback && !sessionDone && (
          <LuminaFeedbackCard
            status={
              feedbackType === 'success'
                ? 'correct'
                : feedbackType === 'error'
                  ? 'incorrect'
                  : 'insight'
            }
            className="p-4"
          >
            {feedback}
          </LuminaFeedbackCard>
        )}

        {/* Culminating production beat — say the whole word aloud. Once solved,
            this IS the next step: a single prominent mic CTA, and a successful
            spoken word auto-advances (no click). Next Word is a quiet skip. */}
        {wordComplete && !sessionDone && currentChallenge && (
          <div className="flex flex-col items-center gap-3">
            {spokenWords.has(currentChallenge.id) ? (
              // Said it → celebrate, then auto-glide to the next challenge (effect above)
              <div className="flex flex-col items-center gap-1">
                <span className="text-emerald-300 text-base font-semibold">
                  {'🎉'} You said “{currentChallenge.targetWord}” out loud!
                </span>
                <span className="text-slate-500 text-xs">Next word coming up…</span>
              </div>
            ) : spokenCapture.isSupported ? (
              // Mic available → the say-it beat is the PRIMARY next step
              <div className="flex flex-col items-center gap-3">
                <p className="text-slate-300 text-sm font-medium">Your turn — say the word!</p>
                <div className="flex items-center justify-center gap-3 flex-wrap min-h-[52px]">
                  <LuminaMicListener
                    state={spokenCapture.state}
                    level={spokenCapture.level}
                    isSupported={spokenCapture.isSupported}
                    onStart={() => void spokenCapture.start()}
                    onCancel={spokenCapture.cancel}
                    size="sm"
                    idleLabel={`Say “${currentChallenge.targetWord}”!`}
                    listeningLabel={`Say “${currentChallenge.targetWord}”!`}
                  />
                </div>
                {/* Quiet skip — never traps a student who can't or won't speak */}
                {spokenCapture.state === 'idle' && (
                  <button
                    onClick={handleNextWord}
                    className="text-slate-500 text-xs hover:text-slate-300 transition-colors"
                  >
                    {currentChallengeIndex < challenges.length - 1 ? 'Skip →' : 'Skip to finish →'}
                  </button>
                )}
              </div>
            ) : (
              // No mic → original prominent Next / Finish
              <LuminaActionButton
                action="next"
                onClick={handleNextWord}
              >
                {currentChallengeIndex < challenges.length - 1 ? 'Next Word' : 'Finish'}
              </LuminaActionButton>
            )}
          </div>
        )}

        {/* Phase Summary */}
        {sessionDone && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Spelling Complete!"
            celebrationMessage={`You got ${challengeResults.filter(r => r.correct).length} out of ${challenges.length} correct!${spokenWords.size > 0 ? ` You said ${spokenWords.size} out loud — amazing!` : ''}`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default CvcSpeller;
