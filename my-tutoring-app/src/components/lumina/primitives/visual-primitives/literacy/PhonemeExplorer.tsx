'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { PhonemeExplorerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

interface PhonemeChoice {
  word: string;
  emoji: string;
  correct: boolean;
}

interface PhonemeChallenge {
  id: string;
  phoneme: string;         // The letter/sound displayed, e.g. "B"
  phonemeSound: string;    // Pronunciation hint, e.g. "buh"
  exampleWord: string;     // Example word starting with phoneme, e.g. "Bear"
  exampleEmoji: string;    // Emoji for example word, e.g. "🐻"
  choices: PhonemeChoice[]; // 4 choices (1 correct, 3 distractors)
}

export interface PhonemeExplorerData {
  title: string;
  challenges: PhonemeChallenge[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PhonemeExplorerMetrics>) => void;
}

// ============================================================================
// Props
// ============================================================================

interface PhonemeExplorerProps {
  data: PhonemeExplorerData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_CONFIG: Record<string, PhaseConfig> = {
  'phoneme-match': { label: 'Sound Match', icon: '\uD83D\uDD0A', accentColor: 'blue' },
};

const MAX_ATTEMPTS = 3;

// ============================================================================
// Component
// ============================================================================

const PhonemeExplorer: React.FC<PhonemeExplorerProps> = ({ data, className }) => {
  const {
    title,
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── Activity gate ──────────────────────────────────────────────
  const [hasStarted, setHasStarted] = useState(false);

  // ── Interaction state ──────────────────────────────────────────
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [showResult, setShowResult] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // ── Timing ─────────────────────────────────────────────────────
  const startTimeRef = useRef(Date.now());

  // ── Instance ID ────────────────────────────────────────────────
  const stableInstanceIdRef = useRef(instanceId || `phoneme-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Shared challenge progress hook ─────────────────────────────
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
    getChallengeType: () => 'phoneme-match',
    phaseConfig: PHASE_CONFIG,
  });

  // ── Evaluation ─────────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<PhonemeExplorerMetrics>({
    primitiveType: 'phoneme-explorer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const [submittedScore, setSubmittedScore] = useState<number | null>(null);

  const currentChallenge = challenges[currentIndex];

  // ── Shuffle choices once per challenge ─────────────────────────
  const shuffledChoices = useMemo(() => {
    if (!currentChallenge?.choices) return [];
    return [...currentChallenge.choices].sort(() => Math.random() - 0.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // ── AI Tutoring integration ────────────────────────────────────
  // NOTE: Only include progress metadata here, NOT challenge-specific content.
  // Challenge data (phoneme, choices, etc.) is sent explicitly via [NEW_CHALLENGE]
  // messages. Including it here causes a duplicate context update (500ms debounced)
  // that triggers Gemini to hallucinate a second response.
  const aiPrimitiveData = useMemo(() => ({
    currentChallenge: currentIndex + 1,
    totalChallenges: challenges.length,
    attempts: currentAttempts,
  }), [currentIndex, challenges.length, currentAttempts]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'phoneme-explorer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'K',
  });

  // ── Activity introduction ──────────────────────────────────────
  const hasIntroducedRef = useRef(false);

  useEffect(() => {
    if (!hasStarted || !isConnected || hasIntroducedRef.current || !currentChallenge) return;
    hasIntroducedRef.current = true;

    const choiceWords = currentChallenge.choices.map(c => c.word).join(', ');
    sendText(
      `[ACTIVITY_START] This is a phoneme matching activity. `
      + `There are ${challenges.length} challenges. `
      + `Warmly introduce: "Let's listen for beginning sounds!" `
      + `Then say the sound "${currentChallenge.phonemeSound}" clearly and slowly. `
      + `Say: "This is the ${currentChallenge.phoneme} sound, like in ${currentChallenge.exampleWord}! `
      + `Which word starts with ${currentChallenge.phonemeSound}?" `
      + `Then read each option aloud: "${choiceWords}". `
      + `Say each word clearly so the student can hear the beginning sounds.`,
      { silent: true },
    );
  }, [hasStarted, isConnected, currentChallenge, challenges.length, sendText]);

  // ── Pronounce phoneme when challenge changes ───────────────────
  useEffect(() => {
    if (!currentChallenge || !isConnected || !hasIntroducedRef.current) return;
    if (currentIndex === 0) return;

    const choiceWords = currentChallenge.choices.map(c => c.word).join(', ');
    sendText(
      `[NEW_CHALLENGE] Say the sound "${currentChallenge.phonemeSound}" clearly and slowly. `
      + `Say: "This is the ${currentChallenge.phoneme} sound, like in ${currentChallenge.exampleWord}! `
      + `Which word starts with ${currentChallenge.phonemeSound}?" `
      + `Then read each option aloud: "${choiceWords}". `
      + `Say each word clearly so the student can hear the beginning sounds.`,
      { silent: true },
    );
  }, [currentIndex, currentChallenge, isConnected, sendText]);

  // ── Reset interaction state when challenge advances ────────────
  useEffect(() => {
    setSelectedIndex(null);
    setFeedback('');
    setFeedbackType('');
    setShowResult(false);
    setIsCelebrating(false);
    setIsShaking(false);
  }, [currentIndex]);

  // ── Submit final evaluation ────────────────────────────────────
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;

    const correctCount = challengeResults.filter(r => r.correct).length;
    const totalCount = challenges.length;
    const overallPct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    const totalAttempts = challengeResults.reduce((sum, r) => sum + r.attempts, 0);
    const elapsed = Date.now() - startTimeRef.current;

    const metrics: PhonemeExplorerMetrics = {
      type: 'phoneme-explorer',
      challengesCorrect: correctCount,
      challengesTotal: totalCount,
      accuracy: overallPct,
      attemptsCount: totalAttempts,
    };

    setSubmittedScore(overallPct);
    submitEvaluation(
      overallPct >= 60,
      overallPct,
      metrics,
      { durationMs: elapsed, challengeResults },
    );

    const phaseScoreStr = phaseResults.map(
      p => `${p.label} ${p.score}% (${p.attempts} attempts)`,
    ).join(', ');
    sendText(
      `[ALL_COMPLETE] All ${totalCount} challenges done! Scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
      + `Celebrate and summarize which letter sounds were practiced. Then STOP.`,
      { silent: true },
    );
  }, [
    hasSubmittedEvaluation, challengeResults, challenges, phaseResults,
    submitEvaluation, sendText,
  ]);

  // ── Handle choice selection ────────────────────────────────────
  const handleSelect = useCallback((choiceIndex: number) => {
    if (showResult || !currentChallenge) return;

    const choice = shuffledChoices[choiceIndex];
    if (!choice) return;
    setSelectedIndex(choiceIndex);
    incrementAttempts();

    if (choice.correct) {
      setFeedback(
        `Yes! ${choice.emoji} "${choice.word}" starts with the ${currentChallenge.phoneme} sound!`
      );
      setFeedbackType('success');
      setShowResult(true);
      setIsCelebrating(true);
      setTimeout(() => setIsCelebrating(false), 1500);

      recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 });
      sendText(
        `[ANSWER_CORRECT] Student correctly picked "${choice.word}" ${choice.emoji} for the ${currentChallenge.phoneme} sound. `
        + `Brief celebration! Say: "Yes! ${choice.word} starts with ${currentChallenge.phonemeSound}!" `
        + `Then STOP. Do NOT present a new challenge. Wait for the student to click Next.`,
        { silent: true },
      );
    } else {
      setFeedback(`Hmm, "${choice.word}" starts with a different sound. Try again!`);
      setFeedbackType('error');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setSelectedIndex(null);

      sendText(
        `[ANSWER_INCORRECT] Student chose "${choice.word}" ${choice.emoji} but that doesn't start with ${currentChallenge.phoneme}. `
        + `Attempt ${currentAttempts + 1}. Help: "Listen... ${currentChallenge.phonemeSound}... `
        + `${currentChallenge.exampleWord} starts with ${currentChallenge.phonemeSound}. Which other word starts the same way?"`,
        { silent: true },
      );

      if (currentAttempts + 1 >= MAX_ATTEMPTS) {
        const correctChoice = shuffledChoices.find(c => c.correct);
        setTimeout(() => {
          setShowResult(true);
          setFeedback(
            `The answer is ${correctChoice?.emoji} "${correctChoice?.word}" \u2014 it starts with ${currentChallenge.phoneme}!`
          );
          setFeedbackType('success');
          recordResult({ challengeId: currentChallenge.id, correct: false, attempts: currentAttempts + 1 });
        }, 1000);
      }
    }
  }, [showResult, currentChallenge, shuffledChoices, currentAttempts, incrementAttempts, recordResult, sendText]);

  // ── Advance to next challenge ──────────────────────────────────
  const handleNext = useCallback(() => {
    if (!advanceProgress()) {
      submitFinalEvaluation();
      setShowSummary(true);
      return;
    }
    // NOTE: Do NOT sendText here. Advancing currentIndex triggers the
    // [NEW_CHALLENGE] useEffect which already tells Gemini exactly what
    // the new challenge is. Sending a bare "[NEXT_CHALLENGE]" first gives
    // Gemini a turn to respond before the real data arrives, causing it
    // to hallucinate a challenge from its imagination.
  }, [advanceProgress, submitFinalEvaluation]);

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

  // ── Start screen ──────────────────────────────────────────────
  if (!hasStarted) {
    return (
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
        <CardContent className="p-8 flex flex-col items-center text-center space-y-5">
          <div className="text-5xl">{'\uD83D\uDD0A'}</div>
          <CardTitle className="text-xl text-slate-100">{title}</CardTitle>
          <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-400 text-xs">
            Sound Match
          </Badge>
          <p className="text-slate-400 text-sm max-w-sm">
            Listen to a sound, then find the word that starts with it!
            {' '}{challenges.length} sounds to explore.
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
          <CardTitle className="text-lg text-slate-100">{title}</CardTitle>
          {!showSummary && (
            <Badge
              variant="outline"
              className="text-xs bg-blue-500/20 border-blue-500/40 text-blue-300"
            >
              {'\uD83D\uDD0A'} Sound Match
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
                Sound {currentIndex + 1} of {challenges.length}
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
          <div className="space-y-5">
            {/* Phoneme display */}
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-2xl bg-blue-500/15 border-2 border-blue-500/30 px-10 py-6 text-center">
                <div className="text-5xl font-black text-blue-200 tracking-wide">
                  {currentChallenge.phoneme}
                </div>
                <p className="text-sm text-blue-400/70 mt-2 italic">
                  &ldquo;{currentChallenge.phonemeSound}&rdquo;
                </p>
              </div>
            </div>

            {/* Example word with emoji */}
            <div className="flex items-center justify-center gap-3 rounded-xl bg-white/5 border border-white/10 px-5 py-3">
              <span className="text-3xl">{currentChallenge.exampleEmoji}</span>
              <div className="text-center">
                <span className="text-xl font-bold text-slate-100">
                  {currentChallenge.exampleWord}
                </span>
                <p className="text-xs text-slate-500">
                  starts with <span className="text-blue-300 font-semibold">{currentChallenge.phoneme}</span>
                </p>
              </div>
            </div>

            {/* Question prompt */}
            <p className="text-center text-base text-slate-300 font-medium">
              Which word also starts with the{' '}
              <span className="text-blue-300 font-bold">{currentChallenge.phoneme}</span> sound?
            </p>

            {/* 4 choice buttons */}
            <div className={`grid grid-cols-2 gap-3 ${isShaking ? 'animate-shake' : ''}`}>
              {shuffledChoices.map((choice, idx) => {
                const isCorrectChoice = showResult && choice.correct;
                const isWrongSelected = showResult && selectedIndex === idx && !choice.correct;

                return (
                  <button
                    key={idx}
                    onClick={() => !showResult && handleSelect(idx)}
                    disabled={showResult}
                    className={`
                      rounded-xl border-2 p-4 flex flex-col items-center gap-2
                      transition-all duration-200 cursor-pointer
                      ${isCorrectChoice
                        ? 'bg-emerald-500/20 border-emerald-500/50 ring-2 ring-emerald-400/40'
                        : isWrongSelected
                          ? 'bg-red-500/10 border-red-500/30'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }
                      ${isCelebrating && isCorrectChoice ? 'animate-bounce' : ''}
                    `}
                  >
                    <span className="text-3xl">{choice.emoji}</span>
                    <span className={`text-lg font-bold ${
                      isCorrectChoice
                        ? 'text-emerald-200'
                        : isWrongSelected
                          ? 'text-red-300'
                          : 'text-slate-200'
                    }`}>
                      {choice.word}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
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
              {currentIndex < challenges.length - 1 ? 'Next Sound' : 'Finish'}
            </Button>
          </div>
        )}

        {/* Phase summary panel */}
        {showSummary && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedScore ?? undefined}
            durationMs={elapsedMs}
            heading="Phoneme Explorer Complete!"
            celebrationMessage="Great job matching sounds to words!"
            className="mb-6"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default PhonemeExplorer;
