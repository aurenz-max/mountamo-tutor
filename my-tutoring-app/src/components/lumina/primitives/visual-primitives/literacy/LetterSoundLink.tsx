'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaButton,
  LuminaProgress,
  LuminaActionButton,
  LuminaFeedbackCard,
  LuminaChallengeCounter,
  answerStateClasses,
  LuminaMicListener,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { LetterSoundLinkMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useSpokenWordCapture, type SpokenJudgeResult } from '../../../hooks/useSpokenWordCapture';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

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

/** Mode → accent for chrome badges. */
const MODE_ACCENT: Record<string, LuminaAccent> = {
  'see-hear': 'blue',
  'hear-see': 'purple',
  'keyword-match': 'emerald',
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

/** Speaker bubble colors for the two binary options */
const SPEAKER_COLORS = [
  {
    bg: 'bg-rose-500/15',
    border: 'border-rose-400/30',
    hoverBg: 'hover:bg-rose-500/25',
    activeBg: 'bg-rose-500/30',
    activeBorder: 'border-rose-400/50',
    ring: 'ring-rose-400/40',
    iconColor: 'text-rose-300',
    label: 'rose',
  },
  {
    bg: 'bg-sky-500/15',
    border: 'border-sky-400/30',
    hoverBg: 'hover:bg-sky-500/25',
    activeBg: 'bg-sky-500/30',
    activeBorder: 'border-sky-400/50',
    ring: 'ring-sky-400/40',
    iconColor: 'text-sky-300',
    label: 'sky',
  },
];

const MAX_ATTEMPTS = 3;

// ============================================================================
// Speaker Icon SVG
// ============================================================================

const SpeakerIcon: React.FC<{ className?: string; playing?: boolean }> = ({ className = '', playing = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`${className} ${playing ? 'animate-pulse' : ''}`}
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" opacity={0.3} />
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    {playing && (
      <>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </>
    )}
  </svg>
);

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
  const [listenedOption, setListenedOption] = useState<number | null>(null);
  const [playingOption, setPlayingOption] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [isLocked, setIsLocked] = useState(false);
  const [confusedPairs, setConfusedPairs] = useState<Array<[string, string]>>([]);
  const [submittedResult, setSubmittedResult] = useState<{ score: number } | null>(null);
  const [showKeywordHint, setShowKeywordHint] = useState(false);
  // Keywords the student said ALOUD (judge-confirmed) — the culminating production beat
  const [spokenWords, setSpokenWords] = useState<Set<string>>(new Set());

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
  // Auto-play sound for hear-see mode on challenge load
  // ---------------------------------------------------------------------------
  const lastAutoPlayedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isConnected || !currentChallenge || isLocked) return;
    if (currentChallenge.mode !== 'hear-see') return;
    if (lastAutoPlayedRef.current === currentChallenge.id) return;

    lastAutoPlayedRef.current = currentChallenge.id;
    // Small delay to let the UI render first
    const timer = setTimeout(() => {
      sendText(
        `[PRONOUNCE_SOUND] Say ONLY the sound ${currentChallenge.targetSound}. Just the clean phoneme, nothing else. Then pause.`,
        { silent: true },
      );
    }, 600);
    return () => clearTimeout(timer);
  }, [isConnected, currentChallenge, isLocked, sendText]);

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
  // Speaker bubble: tap to hear, tap again to choose
  // ---------------------------------------------------------------------------
  const handleSpeakerTap = useCallback((optionIndex: number) => {
    if (isLocked || hasSubmittedEvaluation || !currentChallenge) return;

    const options = currentChallenge.options || [];
    const option = options[optionIndex];
    if (!option) return;

    // First tap on this option: play the sound
    if (listenedOption !== optionIndex) {
      setListenedOption(optionIndex);
      setPlayingOption(optionIndex);
      setSelectedOption(null);

      // Play the sound via AI
      if (currentChallenge.mode === 'see-hear' || currentChallenge.mode === 'keyword-match') {
        const soundToPlay = option.sound || '';
        if (currentChallenge.mode === 'keyword-match') {
          // For keyword match, say the word
          sendText(
            `[TAP_OPTION] Say the word "${soundToPlay}" clearly. Just the word, nothing else.`,
            { silent: true },
          );
        } else {
          // For see-hear, say the phoneme
          sendText(
            `[TAP_OPTION] Say only the sound ${soundToPlay}. Just the clean phoneme, nothing else.`,
            { silent: true },
          );
        }
      } else if (currentChallenge.mode === 'hear-see') {
        // For hear-see, say the letter name
        const letterToSay = option.letter || '';
        sendText(
          `[TAP_OPTION] Say the name of the letter "${letterToSay.toUpperCase()}". Just the letter name, nothing else.`,
          { silent: true },
        );
      }

      // Clear playing animation after a short delay
      setTimeout(() => setPlayingOption(null), 1500);
      return;
    }

    // Second tap on same option: confirm selection
    setSelectedOption(optionIndex);
    confirmSelection(optionIndex);
  }, [isLocked, hasSubmittedEvaluation, currentChallenge, listenedOption, sendText]);

  // ---------------------------------------------------------------------------
  // Confirm selection (called on second tap)
  // ---------------------------------------------------------------------------
  const confirmSelection = useCallback((optionIndex: number) => {
    if (!currentChallenge) return;

    const options = currentChallenge.options || [];
    const option = options[optionIndex];
    if (!option) return;

    incrementAttempts();
    const isCorrect = option.isCorrect;

    if (isCorrect) {
      SoundManager.playCorrect();
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
    } else {
      SoundManager.playIncorrect();
      const wrongDisplay = currentChallenge.mode === 'hear-see'
        ? `letter "${option.letter || '?'}"`
        : `sound "${option.sound || '?'}"`;
      setFeedback('Not quite! Listen again and try the other one.');
      setFeedbackType('error');

      // Show keyword hint after first wrong attempt (progressive scaffolding)
      setShowKeywordHint(true);

      // Track confusion
      if (currentChallenge.mode === 'see-hear' && option.sound) {
        trackConfusion(currentChallenge.targetSound, option.sound);
      } else if (currentChallenge.mode === 'hear-see' && option.letter) {
        trackConfusion(currentChallenge.targetLetter, option.letter);
      }

      // Reset listened state so they can tap again
      setListenedOption(null);
      setSelectedOption(null);

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
    currentChallenge, currentAttempts,
    incrementAttempts, recordResult, sendText, trackConfusion, updateModeAccuracy,
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
      { challengeResults, durationMs: elapsedMs, spokenWords: Array.from(spokenWords) },
    );

    // AI celebration
    const phaseScoreStr = phaseResults.length > 0
      ? phaseResults.map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`).join(', ')
      : `Overall: ${overallScore}%`;
    sendText(
      `[ALL_COMPLETE] Student finished all ${total} letter-sound challenges! `
      + `Score: ${correct}/${total} (${overallScore}%). ${phaseScoreStr}. `
      + (uniquePairs.length > 0 ? `Confused sound pairs: ${uniquePairs.join(', ')}. ` : '')
      + (spokenWords.size > 0 ? `They also said ${spokenWords.size} keyword${spokenWords.size > 1 ? 's' : ''} out loud! ` : '')
      + `Celebrate and give encouraging feedback about their letter-sound knowledge!`,
      { silent: true },
    );
  }, [
    hasSubmittedEvaluation, challengeResults, letterGroup, confusedPairs,
    seeHearResults, hearSeeResults, vowelResults, consonantResults,
    phaseResults, spokenWords, submitEvaluation, sendText,
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
  // Spoken production beat — once a challenge is resolved, the student says the
  // KEYWORD aloud (the anchor of the letter-sound link — "A makes /a/ like
  // APPLE — now YOU say APPLE!"). The judge ladder (Azure dual-signal → Gemini,
  // utils/spokenWordJudge.ts) confirms it. Purely additive: the mic never
  // bypasses the recognition challenge (it appears only after isLocked), the
  // Next button is always available, and 'no-match' is never penalized.
  //   'match'   → celebrate + track (bonus production credit)
  //   'no-match'→ tutor models the keyword by voice, NO penalty
  //   'unclear' → invite a retry, silently
  // ---------------------------------------------------------------------------
  const handleSpokenResult = useCallback((result: SpokenJudgeResult) => {
    if (!currentChallenge || spokenWords.has(currentChallenge.id)) return;
    const target = currentChallenge.keywordWord;
    if (result.outcome === 'match') {
      SoundManager.playCorrect();
      setSpokenWords(prev => new Set(Array.from(prev).concat(currentChallenge.id)));
      sendText(
        `[STUDENT_SAID_WORD] The student said the keyword "${target}" out loud all by themselves — the word for the letter "${currentChallenge.targetLetter.toUpperCase()}" that makes the sound ${currentChallenge.targetSound}! Celebrate enthusiastically that they SAID the whole word (one sentence).`,
        { silent: true },
      );
    } else if (result.outcome === 'no-match' && result.verdict?.heard) {
      sendText(
        `[SPOKEN_MISS] The student tried to say the keyword "${target}" aloud but it sounded like "${result.verdict.heard}". Gently model it — start with the ${currentChallenge.targetSound} sound, then say the whole word "${target}" — and invite one more try. Warm, never scolding. Two short sentences max.`,
        { silent: true },
      );
    } else {
      sendText(
        `[SPOKEN_UNCLEAR] The microphone didn't catch the student clearly. One friendly sentence: invite them to say "${target}" again a little louder, or just tap Next.`,
        { silent: true },
      );
    }
  }, [currentChallenge, spokenWords, sendText]);

  const spokenCapture = useSpokenWordCapture({
    targetWord: currentChallenge?.keywordWord ?? '',
    gradeLevel: 'K',
    onResult: handleSpokenResult,
    onNoSpeech: () => {
      if (!currentChallenge || spokenWords.has(currentChallenge.id)) return;
      sendText(
        `[SPOKEN_UNCLEAR] The microphone didn't hear the student. One friendly sentence: invite them to say "${currentChallenge.keywordWord}" again a little louder, or just tap Next.`,
        { silent: true },
      );
    },
  });

  // ---------------------------------------------------------------------------
  // Advance to next challenge
  // ---------------------------------------------------------------------------
  const handleNextChallenge = useCallback(() => {
    spokenCapture.cancel(); // never carry a live mic across challenges
    setSelectedOption(null);
    setListenedOption(null);
    setPlayingOption(null);
    setFeedback('');
    setFeedbackType('');
    setIsLocked(false);
    setShowKeywordHint(false);

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
  }, [advanceProgress, submitFinalEvaluation, challenges, currentChallengeIndex, sendText, spokenCapture]);

  // Keep a live ref so the auto-advance timer always calls the latest handler.
  const handleNextChallengeRef = useRef(handleNextChallenge);
  handleNextChallengeRef.current = handleNextChallenge;

  // Strong-flow UX: once the student says the keyword aloud (judge-confirmed),
  // glide to the next challenge on their behalf — no extra click. The mic itself
  // stays tap-to-start (push-to-talk is the echo gate against the tutor's voice),
  // but everything after a successful production advances automatically.
  useEffect(() => {
    if (!currentChallenge || !spokenWords.has(currentChallenge.id)) return;
    const t = setTimeout(() => handleNextChallengeRef.current(), 1400);
    return () => clearTimeout(t);
  }, [spokenWords, currentChallenge]);

  // ============================================================================
  // Render: Speaker Bubble (shared by see-hear & keyword-match modes)
  // ============================================================================
  const renderSpeakerBubble = (idx: number, colorConfig: typeof SPEAKER_COLORS[0]) => {
    const isListened = listenedOption === idx;
    const isSelected = selectedOption === idx;
    const isPlaying = playingOption === idx;
    const showCorrect = isLocked && currentChallenge?.options?.[idx]?.isCorrect;
    const showWrong = isSelected && feedbackType === 'error' && !currentChallenge?.options?.[idx]?.isCorrect;

    return (
      <button
        key={idx}
        onClick={() => handleSpeakerTap(idx)}
        disabled={isLocked}
        className={`
          relative flex flex-col items-center justify-center gap-2
          w-28 h-28 sm:w-32 sm:h-32 rounded-full
          border-2 transition-all duration-300
          ${showCorrect
            ? `${answerStateClasses.correct} scale-110`
            : showWrong
              ? `${answerStateClasses.incorrect} scale-95`
              : isListened
                ? `${colorConfig.activeBg} ${colorConfig.activeBorder} ring-2 ${colorConfig.ring} scale-105`
                : `${colorConfig.bg} ${colorConfig.border} ${colorConfig.hoverBg} hover:scale-105`
          }
          ${isLocked ? 'cursor-default' : 'cursor-pointer'}
          disabled:opacity-70
        `}
      >
        <SpeakerIcon
          className={`w-10 h-10 sm:w-12 sm:h-12 ${
            showCorrect ? 'text-emerald-300' : showWrong ? 'text-rose-300' : colorConfig.iconColor
          }`}
          playing={isPlaying}
        />
        {isListened && !isLocked && (
          <span className="text-[10px] text-slate-400 animate-pulse">
            tap to choose
          </span>
        )}
        {!isListened && !isLocked && (
          <span className="text-[10px] text-slate-500">
            tap to hear
          </span>
        )}
      </button>
    );
  };

  // ============================================================================
  // Render: See → Hear Mode (audio-first speaker bubbles)
  // ============================================================================
  const renderSeeHear = () => {
    if (!currentChallenge) return null;
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
          <p className="text-slate-400 text-sm">Which sound does this letter make?</p>
        </div>

        {/* Keyword hint — only after wrong attempt */}
        {showKeywordHint && (
          <div className="flex items-center justify-center gap-2 text-slate-400 text-xs animate-in fade-in duration-500">
            <span className="text-lg">{getKeywordEmoji(currentChallenge.keywordWord)}</span>
            <span>Think of &quot;{currentChallenge.keywordWord}&quot;</span>
          </div>
        )}

        {/* Two speaker bubbles */}
        <div className="flex items-center justify-center gap-6 sm:gap-10">
          {(currentChallenge.options || []).slice(0, 2).map((_, idx) =>
            renderSpeakerBubble(idx, SPEAKER_COLORS[idx])
          )}
        </div>

        <p className="text-center text-xs text-slate-600">
          Tap each speaker to hear the sound, then tap your answer again to choose it
        </p>
      </div>
    );
  };

  // ============================================================================
  // Render: Hear → See Mode (auto-play sound, pick the letter)
  // ============================================================================
  const renderHearSee = () => {
    if (!currentChallenge) return null;
    const options = currentChallenge.options || [];

    return (
      <div className="space-y-6">
        {/* Sound play button — no phoneme text shown */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => {
              sendText(
                `[PRONOUNCE_SOUND] Say ONLY the sound ${currentChallenge.targetSound}. Just the clean phoneme, nothing else.`,
                { silent: true },
              );
            }}
            className="
              flex items-center justify-center
              w-28 h-28 rounded-full
              bg-amber-500/15 border-2 border-amber-500/30
              cursor-pointer select-none
              hover:bg-amber-500/25 hover:scale-105 transition-all
              active:scale-95
            "
          >
            <SpeakerIcon className="w-14 h-14 text-amber-300" playing={false} />
          </button>
          <p className="text-slate-400 text-sm">Tap to hear the sound, then find the letter!</p>
        </div>

        {/* Keyword hint — only after wrong attempt */}
        {showKeywordHint && (
          <div className="flex items-center justify-center gap-2 text-slate-400 text-xs animate-in fade-in duration-500">
            <span className="text-lg">{getKeywordEmoji(currentChallenge.keywordWord)}</span>
            <span>Think of &quot;{currentChallenge.keywordWord}&quot;</span>
          </div>
        )}

        {/* Shared sound note */}
        {currentChallenge.sharedSoundLetters && currentChallenge.sharedSoundLetters.length > 0 && (
          <p className="text-center text-xs text-slate-600">
            Hint: More than one letter might make this sound!
          </p>
        )}

        {/* Letter options — these stay as visible letters (letters are what's being tested) */}
        <div className="flex items-center justify-center gap-6 sm:gap-10">
          {options.slice(0, 2).map((option, idx) => {
            const isSelected = selectedOption === idx;
            const showCorrect = isLocked && option.isCorrect;
            const showWrong = isSelected && feedbackType === 'error' && !option.isCorrect;
            const letter = option.letter || '?';
            const letterColor = getLetterColorClass(letter);

            return (
              <button
                key={idx}
                onClick={() => {
                  if (isLocked) return;
                  setSelectedOption(idx);
                  incrementAttempts();

                  // Directly confirm for hear-see (no two-tap needed — letters are visible)
                  const isCorrect = option.isCorrect;

                  if (isCorrect) {
                    SoundManager.playCorrect();
                    setFeedback(`Yes! The letter "${currentChallenge.targetLetter.toUpperCase()}" makes the sound ${currentChallenge.targetSound}!`);
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
                      `[ANSWER_CORRECT] The student correctly picked letter "${currentChallenge.targetLetter.toUpperCase()}" for the sound ${currentChallenge.targetSound}! `
                      + `${currentAttempts === 0 ? 'First try!' : `After ${currentAttempts + 1} attempts.`} `
                      + `[PRONOUNCE_SOUND] ${currentChallenge.targetSound}. Celebrate briefly!`,
                      { silent: true },
                    );
                  } else {
                    SoundManager.playIncorrect();
                    setFeedback('Not quite! Listen to the sound again and try the other letter.');
                    setFeedbackType('error');
                    setShowKeywordHint(true);
                    setSelectedOption(null);
                    trackConfusion(currentChallenge.targetLetter, option.letter || '');
                    sendText(
                      `[ANSWER_INCORRECT] Student chose "${(option.letter || '').toUpperCase()}" but correct is "${currentChallenge.targetLetter.toUpperCase()}" (${currentChallenge.targetSound}). `
                      + `Attempt ${currentAttempts + 1}. `
                      + `[PRONOUNCE_SOUND] ${currentChallenge.targetSound}. Give a brief hint.`,
                      { silent: true },
                    );

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
                    }
                  }
                }}
                disabled={isLocked}
                className={`
                  w-28 h-28 sm:w-32 sm:h-32 rounded-2xl text-5xl font-bold border-2 transition-all
                  ${showCorrect
                    ? `${answerStateClasses.correct} scale-110`
                    : showWrong
                      ? `${answerStateClasses.incorrect} scale-95`
                      : `bg-white/5 border-white/20 hover:bg-white/10 hover:scale-105 ${letterColor}`
                  }
                `}
              >
                {letter.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ============================================================================
  // Render: Keyword Match Mode (speaker bubbles with word audio)
  // ============================================================================
  const renderKeywordMatch = () => {
    if (!currentChallenge) return null;
    const letterColor = getLetterColorClass(currentChallenge.targetLetter);

    return (
      <div className="space-y-6">
        {/* Letter display */}
        <div className="flex flex-col items-center gap-2">
          <div className={`
            text-7xl font-bold ${letterColor}
            bg-white/5 border-2 border-white/15 rounded-2xl
            px-10 py-6 select-none
          `}>
            {currentChallenge.targetLetter.toUpperCase()}
          </div>
          <p className="text-slate-400 text-sm">Which word starts with this letter&apos;s sound?</p>
        </div>

        {/* Two keyword options as speaker bubbles with emoji */}
        <div className="flex items-center justify-center gap-6 sm:gap-10">
          {(currentChallenge.options || []).slice(0, 2).map((option, idx) => {
            const keyword = option.sound || '';
            const emoji = getKeywordEmoji(keyword);
            const colorConfig = SPEAKER_COLORS[idx];
            const isListened = listenedOption === idx;
            const isSelected = selectedOption === idx;
            const showCorrect = isLocked && option.isCorrect;
            const showWrong = isSelected && feedbackType === 'error' && !option.isCorrect;

            return (
              <button
                key={idx}
                onClick={() => handleSpeakerTap(idx)}
                disabled={isLocked}
                className={`
                  relative flex flex-col items-center justify-center gap-1.5
                  w-28 h-28 sm:w-32 sm:h-32 rounded-2xl
                  border-2 transition-all duration-300
                  ${showCorrect
                    ? `${answerStateClasses.correct} scale-110`
                    : showWrong
                      ? `${answerStateClasses.incorrect} scale-95`
                      : isListened
                        ? `${colorConfig.activeBg} ${colorConfig.activeBorder} ring-2 ${colorConfig.ring} scale-105`
                        : `${colorConfig.bg} ${colorConfig.border} ${colorConfig.hoverBg} hover:scale-105`
                  }
                  ${isLocked ? 'cursor-default' : 'cursor-pointer'}
                  disabled:opacity-70
                `}
              >
                <span className="text-3xl">{emoji}</span>
                {isListened && !isLocked && (
                  <span className="text-[10px] text-slate-400 animate-pulse">
                    tap to choose
                  </span>
                )}
                {!isListened && !isLocked && (
                  <span className="text-[10px] text-slate-500">
                    tap to hear
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="text-center text-xs text-slate-600">
          Tap each picture to hear the word, then choose which one starts with this letter&apos;s sound
        </p>
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

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            <div className="flex items-center gap-2">
              <LuminaBadge className="text-xs">
                Group {letterGroup}
              </LuminaBadge>
              {currentChallenge && (
                <LuminaBadge accent={MODE_ACCENT[currentChallenge.mode]} className="text-xs">
                  {MODE_CONFIG[currentChallenge.mode]?.label || currentChallenge.mode}
                </LuminaBadge>
              )}
            </div>
          </div>
          <LuminaChallengeCounter current={currentChallengeIndex + 1} total={challenges.length} />
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
            {currentChallenge.mode === 'see-hear' && renderSeeHear()}
            {currentChallenge.mode === 'hear-see' && renderHearSee()}
            {currentChallenge.mode === 'keyword-match' && renderKeywordMatch()}
          </>
        )}

        {/* Feedback */}
        {feedback && (
          <LuminaFeedbackCard status={feedbackType === 'success' ? 'correct' : 'incorrect'}>
            {feedback}
          </LuminaFeedbackCard>
        )}

        {/* Culminating production beat — say the KEYWORD aloud. Once a challenge
            is resolved, this IS the next step: a single prominent mic CTA, and a
            successful spoken keyword auto-advances (no click). Next is a quiet skip. */}
        {isLocked && !allChallengesComplete && currentChallenge && (
          <div className="flex flex-col items-center gap-3">
            {spokenWords.has(currentChallenge.id) ? (
              // Said it → celebrate, then auto-glide to the next challenge (effect above)
              <div className="flex flex-col items-center gap-1">
                <span className="text-emerald-300 text-base font-semibold">
                  {'🎉'} You said “{currentChallenge.keywordWord}” out loud!
                </span>
                <span className="text-slate-500 text-xs">Next one coming up…</span>
              </div>
            ) : spokenCapture.isSupported ? (
              // Mic available → the say-it beat is the PRIMARY next step
              <div className="flex flex-col items-center gap-3">
                <p className="text-slate-300 text-sm font-medium">
                  Your turn — say “{currentChallenge.keywordWord}”!
                </p>
                <div className="flex items-center justify-center gap-3 flex-wrap min-h-[52px]">
                  <LuminaMicListener
                    state={spokenCapture.state}
                    level={spokenCapture.level}
                    isSupported={spokenCapture.isSupported}
                    onStart={() => void spokenCapture.start()}
                    onCancel={spokenCapture.cancel}
                    size="sm"
                    idleLabel={`Say “${currentChallenge.keywordWord}”!`}
                    listeningLabel={`Say “${currentChallenge.keywordWord}”!`}
                  />
                </div>
                {/* Quiet skip — never traps a student who can't or won't speak */}
                {spokenCapture.state === 'idle' && (
                  <button
                    onClick={handleNextChallenge}
                    className="text-slate-500 text-xs hover:text-slate-300 transition-colors"
                  >
                    {currentChallengeIndex < challenges.length - 1 ? 'Skip →' : 'Skip to finish →'}
                  </button>
                )}
              </div>
            ) : (
              // No mic → original prominent Next / Finish
              <LuminaActionButton action="next" onClick={handleNextChallenge}>
                {currentChallengeIndex < challenges.length - 1 ? 'Next Challenge' : 'Finish'}
              </LuminaActionButton>
            )}
          </div>
        )}

        {/* Completion summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Letter-Sound Link Complete!"
            celebrationMessage={`Great job connecting letters to their sounds!${spokenWords.size > 0 ? ` You said ${spokenWords.size} keyword${spokenWords.size > 1 ? 's' : ''} out loud — amazing!` : ''}`}
            className="mb-6"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default LetterSoundLink;
