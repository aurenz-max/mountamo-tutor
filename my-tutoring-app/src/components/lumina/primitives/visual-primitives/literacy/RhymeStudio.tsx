'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { RhymeStudioMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

interface RhymeOption {
  word: string;
  image: string;
  isCorrect: boolean;
}

interface RhymeChallenge {
  id: string;
  mode: 'recognition' | 'identification' | 'production';
  targetWord: string;
  targetWordImage: string;
  rhymeFamily: string;
  comparisonWord?: string;
  comparisonWordImage?: string;
  doesRhyme?: boolean;
  options?: RhymeOption[];
  acceptableAnswers?: string[];
}

export interface RhymeStudioData {
  title: string;
  gradeLevel: string;
  challenges: RhymeChallenge[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<RhymeStudioMetrics>) => void;
}

// ============================================================================
// Props
// ============================================================================

interface RhymeStudioProps {
  data: RhymeStudioData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const MODE_LABELS: Record<string, string> = {
  recognition: 'Recognition',
  identification: 'Identification',
  production: 'Production',
};

const MODE_ICONS: Record<string, string> = {
  recognition: '\uD83D\uDC42',
  identification: '\uD83D\uDD0D',
  production: '\u270F\uFE0F',
};

const MODE_DESCRIPTIONS: Record<string, string> = {
  recognition: 'Do these words rhyme?',
  identification: 'Which word rhymes?',
  production: 'Think of a rhyming word!',
};

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  recognition: { label: 'Recognition', icon: '\uD83D\uDC42', accentColor: 'blue' },
  identification: { label: 'Identification', icon: '\uD83D\uDD0D', accentColor: 'purple' },
  production: { label: 'Production', icon: '\u270F\uFE0F', accentColor: 'emerald' },
};

const MAX_ATTEMPTS = 3;

// Common K-level words used as distractors for the production word bank.
// These are short CVC/CVCC words spanning many different rime patterns so we
// can always find a few that do NOT rhyme with the target family.
const DISTRACTOR_POOL = [
  'bed', 'big', 'box', 'bus', 'cup', 'dog', 'fix', 'got', 'hip',
  'jet', 'kid', 'leg', 'mud', 'net', 'pig', 'red', 'sit', 'top',
  'tub', 'web', 'yes', 'zip', 'nut', 'pen', 'rug', 'win', 'hop',
];

// ============================================================================
// Helper: split word to highlight rhyme family suffix
// ============================================================================

function splitByRhymeFamily(word: string, rhymeFamily: string): [string, string] {
  const suffix = rhymeFamily.startsWith('-') ? rhymeFamily.slice(1) : rhymeFamily;
  if (suffix && word.toLowerCase().endsWith(suffix.toLowerCase())) {
    return [
      word.slice(0, word.length - suffix.length),
      word.slice(word.length - suffix.length),
    ];
  }
  return [word, ''];
}

// ============================================================================
// Component
// ============================================================================

const RhymeStudio: React.FC<RhymeStudioProps> = ({ data, className }) => {
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
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [showResult, setShowResult] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // ── Timing ────────────────────────────────────────────────────────
  const startTimeRef = useRef(Date.now());

  // ── Instance ID ───────────────────────────────────────────────────
  const stableInstanceIdRef = useRef(instanceId || `rhyme-studio-${Date.now()}`);
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
    getChallengeType: (ch) => ch.mode,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // ── Evaluation ────────────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<RhymeStudioMetrics>({
    primitiveType: 'rhyme-studio',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const [submittedScore, setSubmittedScore] = useState<number | null>(null);

  const currentChallenge = challenges[currentIndex];
  const previousModeRef = useRef<string | null>(null);

  // ── Shuffled identification options ──────────────────────────────
  // Memoised per challenge so it doesn't re-shuffle on every render.
  const shuffledIdentificationOptions = useMemo(() => {
    if (!currentChallenge?.options || currentChallenge.mode !== 'identification') return [];
    return [...currentChallenge.options].sort(() => Math.random() - 0.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // ── Production word bank (acceptable answers + distractors) ───────
  // Memoised per challenge so it doesn't re-shuffle on every render.
  const productionWordBank = useMemo(() => {
    if (!currentChallenge || currentChallenge.mode !== 'production') return [];

    const suffix = currentChallenge.rhymeFamily.startsWith('-')
      ? currentChallenge.rhymeFamily.slice(1).toLowerCase()
      : currentChallenge.rhymeFamily.toLowerCase();
    const target = currentChallenge.targetWord.toLowerCase();

    // Pick 2 distractors that don't rhyme with the target
    const distractors = DISTRACTOR_POOL
      .filter(w => !w.endsWith(suffix) && w !== target)
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);

    // Take up to 2 acceptable answers
    const correct = (currentChallenge.acceptableAnswers ?? []).slice(0, 2);

    // Combine and shuffle
    const combined = [
      ...correct.map(w => ({ word: w, isCorrect: true })),
      ...distractors.map(w => ({ word: w, isCorrect: false })),
    ].sort(() => Math.random() - 0.5);

    return combined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // ── AI Tutoring integration ───────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    challengeMode: currentChallenge?.mode ?? '',
    targetWord: currentChallenge?.targetWord ?? '',
    rhymeFamily: currentChallenge?.rhymeFamily ?? '',
    currentChallenge: currentIndex + 1,
    totalChallenges: challenges.length,
    currentPhase: currentChallenge?.mode ?? '',
    attempts: currentAttempts,
  }), [currentChallenge, currentIndex, challenges.length, currentAttempts]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'rhyme-studio',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // ── Activity introduction — fire once when connected ──────────────
  const hasIntroducedRef = useRef(false);

  useEffect(() => {
    if (!hasStarted || !isConnected || hasIntroducedRef.current || !currentChallenge) return;
    hasIntroducedRef.current = true;

    // Build mode-specific context so the AI knows the exact words for challenge 1
    let firstChallengeWords = '';
    if (currentChallenge.mode === 'recognition') {
      firstChallengeWords =
        `Say both words clearly: "${currentChallenge.targetWord}" and "${currentChallenge.comparisonWord}". `
        + `Then ask "Do these words rhyme?" Do NOT reveal the answer.`;
    } else if (currentChallenge.mode === 'identification') {
      const optionWords = shuffledIdentificationOptions.map(o => o.word).join(', ');
      firstChallengeWords =
        `Say the target word "${currentChallenge.targetWord}" and the options: ${optionWords}. `
        + `Ask "Which word rhymes with ${currentChallenge.targetWord}?"`;
    } else {
      const bankWords = productionWordBank.map(o => o.word).join(', ');
      firstChallengeWords =
        `Say the target word "${currentChallenge.targetWord}" and the options: ${bankWords}. `
        + `Ask "Which of these words rhymes with ${currentChallenge.targetWord}?"`;
    }

    sendText(
      `[ACTIVITY_START] This is a rhyming activity for Grade ${gradeLevel}. `
      + `There are ${challenges.length} challenges. `
      + `Warmly introduce the activity (1-2 sentences), then: ${firstChallengeWords}`,
      { silent: true },
    );
  }, [hasStarted, isConnected, currentChallenge, gradeLevel, challenges.length, sendText, shuffledIdentificationOptions]);

  // ── Phase transition detection ────────────────────────────────────
  useEffect(() => {
    if (!currentChallenge) return;
    const prevMode = previousModeRef.current;
    if (prevMode && prevMode !== currentChallenge.mode) {
      sendText(
        `[PHASE_TRANSITION] Moving from ${MODE_LABELS[prevMode]} to ${MODE_LABELS[currentChallenge.mode]} mode. `
        + `Briefly explain what's coming: ${MODE_DESCRIPTIONS[currentChallenge.mode]}`,
        { silent: true },
      );
    }
    previousModeRef.current = currentChallenge.mode;
  }, [currentChallenge, sendText]);

  // ── Pronounce words when challenge changes ────────────────────────
  useEffect(() => {
    if (!currentChallenge || !isConnected || !hasIntroducedRef.current) return;
    if (currentIndex === 0) return; // First challenge handled by ACTIVITY_START

    if (currentChallenge.mode === 'recognition') {
      sendText(
        `[PRONOUNCE_WORDS] Say "${currentChallenge.targetWord}" and "${currentChallenge.comparisonWord}". `
        + `Then ask "Do these words rhyme?"`,
        { silent: true },
      );
    } else if (currentChallenge.mode === 'identification') {
      const optionWords = shuffledIdentificationOptions.map(o => o.word).join(', ');
      sendText(
        `[PRONOUNCE_WORDS] Say "${currentChallenge.targetWord}" and ask "Which word rhymes with ${currentChallenge.targetWord}?" `
        + `Then say each option: ${optionWords}.`,
        { silent: true },
      );
    } else {
      const bankWords = productionWordBank.map(o => o.word).join(', ');
      sendText(
        `[PRONOUNCE_WORDS] Say "${currentChallenge.targetWord}" and ask "Which of these words rhymes with ${currentChallenge.targetWord}?" `
        + `Then say each option: ${bankWords}.`,
        { silent: true },
      );
    }
  }, [currentIndex, currentChallenge, isConnected, sendText, productionWordBank, shuffledIdentificationOptions]);

  // ── Reset interaction state when challenge advances ───────────────
  useEffect(() => {
    setSelectedOption(null);
    setFeedback('');
    setFeedbackType('');
    setShowResult(false);
    setIsCelebrating(false);
    setIsShaking(false);
  }, [currentIndex]);

  // ── Compute per-mode accuracy from results ────────────────────────
  const computeAccuracies = useCallback(() => {
    const byMode: Record<string, { correct: number; total: number }> = {
      recognition: { correct: 0, total: 0 },
      identification: { correct: 0, total: 0 },
      production: { correct: 0, total: 0 },
    };
    for (const ch of challenges) {
      const result = challengeResults.find(r => r.challengeId === ch.id);
      if (result) {
        byMode[ch.mode].total++;
        if (result.correct) byMode[ch.mode].correct++;
      }
    }
    return {
      recognitionAccuracy: byMode.recognition.total > 0
        ? Math.round((byMode.recognition.correct / byMode.recognition.total) * 100)
        : 0,
      identificationAccuracy: byMode.identification.total > 0
        ? Math.round((byMode.identification.correct / byMode.identification.total) * 100)
        : 0,
      productionAccuracy: byMode.production.total > 0
        ? Math.round((byMode.production.correct / byMode.production.total) * 100)
        : 0,
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
    const rhymeFamilies = Array.from(new Set(challenges.map(ch => ch.rhymeFamily)));

    const metrics: RhymeStudioMetrics = {
      type: 'rhyme-studio',
      challengeMode: currentChallenge?.mode ?? 'recognition',
      challengesCorrect: correctCount,
      challengesTotal: totalCount,
      recognitionAccuracy: accs.recognitionAccuracy,
      identificationAccuracy: accs.identificationAccuracy,
      productionAccuracy: accs.productionAccuracy,
      rhymeFamiliesPracticed: rhymeFamilies,
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
      + `Rhyme families practiced: ${rhymeFamilies.join(', ')}. `
      + `Celebrate the full session and summarize what patterns were practiced.`,
      { silent: true },
    );
  }, [
    hasSubmittedEvaluation, challengeResults, challenges, currentChallenge,
    computeAccuracies, phaseResults, submitEvaluation, sendText,
  ]);

  // ── Handle recognition answer (Yes / No) ──────────────────────────
  const handleRecognition = useCallback((answer: boolean) => {
    if (showResult || !currentChallenge) return;

    incrementAttempts();
    const isCorrect = answer === currentChallenge.doesRhyme;

    if (isCorrect) {
      const msg = currentChallenge.doesRhyme
        ? `Yes! "${currentChallenge.targetWord}" and "${currentChallenge.comparisonWord}" both end in ${currentChallenge.rhymeFamily}!`
        : `Correct! "${currentChallenge.targetWord}" and "${currentChallenge.comparisonWord}" do NOT rhyme.`;
      setFeedback(msg);
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
        `[ANSWER_CORRECT] Student correctly answered ${answer ? 'YES' : 'NO'} for `
        + `"${currentChallenge.targetWord}" and "${currentChallenge.comparisonWord}" `
        + `(rhyme family: ${currentChallenge.rhymeFamily}). Brief celebration — emphasize the rhyme pattern.`,
        { silent: true },
      );
    } else {
      setFeedback('Not quite \u2014 listen to the ending sounds...');
      setFeedbackType('error');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);

      sendText(
        `[ANSWER_INCORRECT] Student answered ${answer ? 'YES' : 'NO'} but correct was `
        + `${currentChallenge.doesRhyme ? 'YES' : 'NO'} for "${currentChallenge.targetWord}" and `
        + `"${currentChallenge.comparisonWord}". Attempt ${currentAttempts + 1}. Give a gentle hint.`,
        { silent: true },
      );

      // After max attempts, show the answer and move on
      if (currentAttempts + 1 >= MAX_ATTEMPTS) {
        setTimeout(() => {
          setShowResult(true);
          setFeedback(
            currentChallenge.doesRhyme
              ? `They DO rhyme! Both end in ${currentChallenge.rhymeFamily}.`
              : `They do NOT rhyme. "${currentChallenge.targetWord}" ends in ${currentChallenge.rhymeFamily}.`,
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

  // ── Handle identification answer (tap an option) ──────────────────
  const handleIdentification = useCallback((optionIndex: number) => {
    if (showResult || !shuffledIdentificationOptions.length) return;

    setSelectedOption(optionIndex);
    incrementAttempts();
    const option = shuffledIdentificationOptions[optionIndex];
    const isCorrect = option.isCorrect;

    if (isCorrect) {
      setFeedback(
        `Yes! "${option.word}" rhymes with "${currentChallenge.targetWord}" `
        + `\u2014 they both end in ${currentChallenge.rhymeFamily}!`,
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
        `[ANSWER_CORRECT] Student picked "${option.word}" which rhymes with "${currentChallenge.targetWord}" `
        + `(${currentChallenge.rhymeFamily}). Brief celebration \u2014 emphasize the shared ending.`,
        { silent: true },
      );
    } else {
      setFeedback(`"${option.word}" doesn't end with ${currentChallenge.rhymeFamily}. Try again!`);
      setFeedbackType('error');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setSelectedOption(null);

      sendText(
        `[ANSWER_INCORRECT] Student picked "${option.word}" but it doesn't rhyme with "${currentChallenge.targetWord}" `
        + `(${currentChallenge.rhymeFamily}). Attempt ${currentAttempts + 1}. Hint about the ending sound.`,
        { silent: true },
      );

      if (currentAttempts + 1 >= MAX_ATTEMPTS) {
        const correct = shuffledIdentificationOptions.find(o => o.isCorrect);
        setTimeout(() => {
          setShowResult(true);
          setFeedback(
            `The answer is "${correct?.word}" \u2014 it ends in ${currentChallenge.rhymeFamily} `
            + `like "${currentChallenge.targetWord}"!`,
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
  }, [showResult, currentChallenge, currentAttempts, incrementAttempts, recordResult, sendText, shuffledIdentificationOptions]);

  // ── Handle production answer (tap a word card) ─────────────────────
  const handleProductionSelect = useCallback((word: string, isCorrect: boolean, optionIndex: number) => {
    if (showResult || !currentChallenge) return;

    setSelectedOption(optionIndex);
    incrementAttempts();

    if (isCorrect) {
      setFeedback(
        `Great! "${word}" rhymes with "${currentChallenge.targetWord}" `
        + `\u2014 they both end in ${currentChallenge.rhymeFamily}!`,
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
        `[ANSWER_CORRECT] Student picked "${word}" which rhymes with `
        + `"${currentChallenge.targetWord}" (${currentChallenge.rhymeFamily}). Celebrate and emphasize the pattern!`,
        { silent: true },
      );
    } else {
      setFeedback(
        `"${word}" doesn't end with ${currentChallenge.rhymeFamily}. `
        + `Think about the ending sound...`,
      );
      setFeedbackType('error');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setSelectedOption(null);

      sendText(
        `[ANSWER_INCORRECT] Student picked "${word}" but it doesn't rhyme with `
        + `"${currentChallenge.targetWord}" (${currentChallenge.rhymeFamily}). `
        + `Attempt ${currentAttempts + 1}. Hint about the ${currentChallenge.rhymeFamily} family.`,
        { silent: true },
      );

      if (currentAttempts + 1 >= MAX_ATTEMPTS) {
        const examples = currentChallenge.acceptableAnswers?.slice(0, 2).join(', ') ?? '';
        setTimeout(() => {
          setShowResult(true);
          setFeedback(`Words that rhyme: ${examples}. They all end in ${currentChallenge.rhymeFamily}!`);
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

  // ── Render: word card with rhyme-family highlighting ──────────────
  const renderWordCard = (
    word: string,
    rhymeFamily: string,
    imageDesc: string,
    extraClasses?: string,
  ) => {
    const [prefix, suffix] = splitByRhymeFamily(word, rhymeFamily);
    return (
      <div
        className={`rounded-2xl bg-white/5 border border-white/10 p-6 text-center space-y-2 transition-all duration-300 ${extraClasses || ''}`}
      >
        <div className="text-3xl font-bold text-slate-100">
          {suffix ? (
            <>
              <span>{prefix}</span>
              <span className="text-amber-300">{suffix}</span>
            </>
          ) : (
            <span>{word}</span>
          )}
        </div>
        {imageDesc && (
          <p className="text-sm text-slate-500 italic">{imageDesc}</p>
        )}
      </div>
    );
  };

  // ── Render: Recognition mode ──────────────────────────────────────
  const renderRecognitionMode = () => {
    if (!currentChallenge) return null;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {renderWordCard(
            currentChallenge.targetWord,
            currentChallenge.rhymeFamily,
            currentChallenge.targetWordImage,
            isCelebrating ? 'ring-2 ring-emerald-500/50' : '',
          )}
          {currentChallenge.comparisonWord && renderWordCard(
            currentChallenge.comparisonWord,
            currentChallenge.doesRhyme ? currentChallenge.rhymeFamily : '',
            currentChallenge.comparisonWordImage ?? '',
            isCelebrating ? 'ring-2 ring-emerald-500/50' : '',
          )}
        </div>

        <p className="text-center text-lg text-slate-300 font-medium">
          Do these words rhyme?
        </p>

        {!showResult && (
          <div className={`flex justify-center gap-4 ${isShaking ? 'animate-shake' : ''}`}>
            <Button
              variant="ghost"
              onClick={() => handleRecognition(true)}
              className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300 px-8 py-3 text-lg"
            >
              Yes!
            </Button>
            <Button
              variant="ghost"
              onClick={() => handleRecognition(false)}
              className="bg-rose-500/20 border border-rose-500/40 hover:bg-rose-500/30 text-rose-300 px-8 py-3 text-lg"
            >
              No
            </Button>
          </div>
        )}
      </div>
    );
  };

  // ── Render: Identification mode ───────────────────────────────────
  const renderIdentificationMode = () => {
    if (!shuffledIdentificationOptions.length) return null;
    const optionCount = shuffledIdentificationOptions.length;
    const gridClass = optionCount <= 2 ? 'grid-cols-2' : 'grid-cols-3';

    return (
      <div className="space-y-4">
        {renderWordCard(
          currentChallenge.targetWord,
          currentChallenge.rhymeFamily,
          currentChallenge.targetWordImage,
        )}

        <p className="text-center text-lg text-slate-300 font-medium">
          Which word rhymes with{' '}
          <span className="text-amber-300">{currentChallenge.targetWord}</span>?
        </p>

        <div className={`grid ${gridClass} gap-3 ${isShaking ? 'animate-shake' : ''}`}>
          {shuffledIdentificationOptions.map((option, idx) => {
            const isCorrectOption = showResult && option.isCorrect;
            return (
              <button
                key={idx}
                onClick={() => !showResult && handleIdentification(idx)}
                disabled={showResult}
                className={`
                  rounded-xl border-2 p-4 text-center transition-all duration-200 cursor-pointer
                  ${isCorrectOption
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 ring-2 ring-emerald-400/40'
                    : showResult && selectedOption === idx && !option.isCorrect
                      ? 'bg-red-500/10 border-red-500/30 text-red-300'
                      : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10 hover:border-white/20'
                  }
                  ${isCelebrating && isCorrectOption ? 'animate-bounce' : ''}
                `}
              >
                <span className="text-2xl font-bold block">{option.word}</span>
                {option.image && (
                  <span className="text-xs text-slate-500 mt-1 block">{option.image}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Render: Production mode (word bank — no typing) ─────────────────
  const renderProductionMode = () => {
    if (!currentChallenge) return null;
    const gridClass = productionWordBank.length <= 3 ? 'grid-cols-3' : 'grid-cols-2';

    return (
      <div className="space-y-4">
        {renderWordCard(
          currentChallenge.targetWord,
          currentChallenge.rhymeFamily,
          currentChallenge.targetWordImage,
        )}

        <p className="text-center text-lg text-slate-300 font-medium">
          Pick a word that rhymes with{' '}
          <span className="text-amber-300">{currentChallenge.targetWord}</span>
        </p>

        <div className={`grid ${gridClass} gap-3 ${isShaking ? 'animate-shake' : ''}`}>
          {productionWordBank.map((option, idx) => {
            const isCorrectOption = showResult && option.isCorrect;
            return (
              <button
                key={idx}
                onClick={() => !showResult && handleProductionSelect(option.word, option.isCorrect, idx)}
                disabled={showResult}
                className={`
                  rounded-xl border-2 p-4 text-center transition-all duration-200 cursor-pointer
                  ${isCorrectOption
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 ring-2 ring-emerald-400/40'
                    : showResult && selectedOption === idx && !option.isCorrect
                      ? 'bg-red-500/10 border-red-500/30 text-red-300'
                      : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10 hover:border-white/20'
                  }
                  ${isCelebrating && isCorrectOption ? 'animate-bounce' : ''}
                `}
              >
                <span className="text-2xl font-bold block">{option.word}</span>
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
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
        <CardContent className="p-6">
          <p className="text-slate-400 text-center">No challenges available.</p>
        </CardContent>
      </Card>
    );
  }

  const elapsedMs = Date.now() - startTimeRef.current;

  // ── Start screen ────────────────────────────────────────────────
  if (!hasStarted) {
    const modes = Array.from(new Set(challenges.map(ch => ch.mode)));
    return (
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
        <CardContent className="p-8 flex flex-col items-center text-center space-y-5">
          <div className="text-4xl">🎵</div>
          <CardTitle className="text-xl text-slate-100">{title}</CardTitle>
          <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-400 text-xs">
            Grade {gradeLevel}
          </Badge>
          <p className="text-slate-400 text-sm max-w-sm">
            {challenges.length} challenges across{' '}
            {modes.map(m => MODE_LABELS[m]).join(', ')} modes.
            Listen carefully and find the rhyming words!
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
                currentChallenge.mode === 'recognition'
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                  : currentChallenge.mode === 'identification'
                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                    : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              }`}
            >
              {MODE_ICONS[currentChallenge.mode]} {MODE_LABELS[currentChallenge.mode]}
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
            {currentChallenge.mode === 'recognition' && renderRecognitionMode()}
            {currentChallenge.mode === 'identification' && renderIdentificationMode()}
            {currentChallenge.mode === 'production' && renderProductionMode()}
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
            heading="Rhyme Studio Complete!"
            celebrationMessage="You practiced recognizing, identifying, and producing rhymes!"
            className="mb-6"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default RhymeStudio;
