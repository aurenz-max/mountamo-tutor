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
  mode: 'isolate' | 'blend' | 'segment' | 'manipulate';
  // -- isolate fields --
  phoneme?: string;
  phonemeSound?: string;
  exampleWord?: string;
  exampleEmoji?: string;
  // -- blend fields --
  phonemeSequence?: string[];
  phonemeDisplay?: string;
  // -- segment fields --
  targetWord?: string;
  targetEmoji?: string;
  segmentOptions?: string[];
  correctSegmentation?: number;
  // -- manipulate fields --
  originalWord?: string;
  originalEmoji?: string;
  operation?: string;
  operationDescription?: string;
  // -- shared choices (isolate, blend, manipulate) --
  choices?: PhonemeChoice[];
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
  isolate: { label: 'Sound Match', icon: '\uD83D\uDD0A', accentColor: 'blue' },
  blend: { label: 'Sound Blend', icon: '\uD83E\uDDE9', accentColor: 'purple' },
  segment: { label: 'Sound Split', icon: '\u2702\uFE0F', accentColor: 'emerald' },
  manipulate: { label: 'Sound Swap', icon: '\uD83D\uDD00', accentColor: 'amber' },
};

const MODE_LABELS: Record<string, { badge: string; icon: string; instruction: string }> = {
  isolate: {
    badge: 'Sound Match',
    icon: '\uD83D\uDD0A',
    instruction: 'Which word starts with the same sound?',
  },
  blend: {
    badge: 'Sound Blend',
    icon: '\uD83E\uDDE9',
    instruction: 'What word do these sounds make?',
  },
  segment: {
    badge: 'Sound Split',
    icon: '\u2702\uFE0F',
    instruction: 'How do you break this word into sounds?',
  },
  manipulate: {
    badge: 'Sound Swap',
    icon: '\uD83D\uDD00',
    instruction: 'What new word do you get?',
  },
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
    getChallengeType: (ch) => ch.mode,
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

  // ── Shuffle choices once per challenge (for choice-based modes) ─
  const shuffledChoices = useMemo(() => {
    if (!currentChallenge?.choices) return [];
    return [...currentChallenge.choices].sort(() => Math.random() - 0.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // ── AI Tutoring integration ────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    currentChallenge: currentIndex + 1,
    totalChallenges: challenges.length,
    attempts: currentAttempts,
    mode: currentChallenge?.mode,
  }), [currentIndex, challenges.length, currentAttempts, currentChallenge?.mode]);

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
    sendChallengeIntro(currentChallenge, challenges.length, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStarted, isConnected, currentChallenge]);

  // ── Introduce new challenge when index changes ─────────────────
  useEffect(() => {
    if (!currentChallenge || !isConnected || !hasIntroducedRef.current) return;
    if (currentIndex === 0) return;
    sendChallengeIntro(currentChallenge, challenges.length, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, currentChallenge, isConnected]);

  function sendChallengeIntro(ch: PhonemeChallenge, total: number, isFirst: boolean) {
    const prefix = isFirst
      ? `[ACTIVITY_START] This is a phoneme awareness activity with ${total} challenges. Warmly introduce: "Let's explore sounds!" `
      : `[NEW_CHALLENGE] `;

    switch (ch.mode) {
      case 'isolate': {
        const choiceWords = ch.choices?.map(c => c.word).join(', ') ?? '';
        sendText(
          prefix
          + `Mode: Sound Match. Say the sound "${ch.phonemeSound}" clearly and slowly. `
          + `Say: "This is the ${ch.phoneme} sound, like in ${ch.exampleWord}! `
          + `Which word starts with ${ch.phonemeSound}?" `
          + `Then read each option aloud: "${choiceWords}".`,
          { silent: true },
        );
        break;
      }
      case 'blend': {
        const choiceWords = ch.choices?.map(c => c.word).join(', ') ?? '';
        sendText(
          prefix
          + `Mode: Sound Blend. Say each sound slowly: "${ch.phonemeDisplay}". `
          + `Say: "Listen... ${ch.phonemeDisplay}... What word do these sounds make?" `
          + `Read each option aloud: "${choiceWords}".`,
          { silent: true },
        );
        break;
      }
      case 'segment': {
        sendText(
          prefix
          + `Mode: Sound Split. Show the word "${ch.targetWord}" ${ch.targetEmoji}. `
          + `Say: "Let's break '${ch.targetWord}' into sounds! How many sounds do you hear?" `
          + `Read each option aloud: "${ch.segmentOptions?.join(', ')}".`,
          { silent: true },
        );
        break;
      }
      case 'manipulate': {
        const choiceWords = ch.choices?.map(c => c.word).join(', ') ?? '';
        sendText(
          prefix
          + `Mode: Sound Swap. Show word "${ch.originalWord}" ${ch.originalEmoji}. `
          + `Say: "${ch.operationDescription}" `
          + `"What new word do you get?" Read options: "${choiceWords}".`,
          { silent: true },
        );
        break;
      }
    }
  }

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
      + `Celebrate and summarize which sounds were practiced. Then STOP.`,
      { silent: true },
    );
  }, [
    hasSubmittedEvaluation, challengeResults, challenges, phaseResults,
    submitEvaluation, sendText,
  ]);

  // ── Handle choice selection (isolate, blend, manipulate) ───────
  const handleChoiceSelect = useCallback((choiceIndex: number) => {
    if (showResult || !currentChallenge) return;

    const choice = shuffledChoices[choiceIndex];
    if (!choice) return;
    setSelectedIndex(choiceIndex);
    incrementAttempts();

    if (choice.correct) {
      setFeedback(`Yes! ${choice.emoji} "${choice.word}" is correct!`);
      setFeedbackType('success');
      setShowResult(true);
      setIsCelebrating(true);
      setTimeout(() => setIsCelebrating(false), 1500);

      recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 });
      sendText(
        `[ANSWER_CORRECT] Student correctly picked "${choice.word}" ${choice.emoji}. `
        + `Brief celebration! Then STOP and wait for student to click Next.`,
        { silent: true },
      );
    } else {
      setFeedback(`Hmm, that's not quite right. Try again!`);
      setFeedbackType('error');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setSelectedIndex(null);

      sendText(
        `[ANSWER_INCORRECT] Student chose "${choice.word}" ${choice.emoji} — incorrect. `
        + `Attempt ${currentAttempts + 1}. Give a brief hint.`,
        { silent: true },
      );

      if (currentAttempts + 1 >= MAX_ATTEMPTS) {
        const correctChoice = shuffledChoices.find(c => c.correct);
        setTimeout(() => {
          setShowResult(true);
          setFeedback(
            `The answer is ${correctChoice?.emoji} "${correctChoice?.word}"!`
          );
          setFeedbackType('success');
          recordResult({ challengeId: currentChallenge.id, correct: false, attempts: currentAttempts + 1 });
        }, 1000);
      }
    }
  }, [showResult, currentChallenge, shuffledChoices, currentAttempts, incrementAttempts, recordResult, sendText]);

  // ── Handle segment option selection ────────────────────────────
  const handleSegmentSelect = useCallback((optionIndex: number) => {
    if (showResult || !currentChallenge || currentChallenge.mode !== 'segment') return;

    setSelectedIndex(optionIndex);
    incrementAttempts();

    const isCorrect = optionIndex === currentChallenge.correctSegmentation;

    if (isCorrect) {
      const correctOption = currentChallenge.segmentOptions?.[optionIndex] ?? '';
      setFeedback(`Yes! "${currentChallenge.targetWord}" breaks into ${correctOption}!`);
      setFeedbackType('success');
      setShowResult(true);
      setIsCelebrating(true);
      setTimeout(() => setIsCelebrating(false), 1500);

      recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 });
      sendText(
        `[ANSWER_CORRECT] Student correctly segmented "${currentChallenge.targetWord}" as ${correctOption}. `
        + `Celebrate! Then STOP.`,
        { silent: true },
      );
    } else {
      setFeedback(`Not quite — listen carefully to each sound. Try again!`);
      setFeedbackType('error');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setSelectedIndex(null);

      sendText(
        `[ANSWER_INCORRECT] Student picked wrong segmentation. Attempt ${currentAttempts + 1}. Help them count the sounds.`,
        { silent: true },
      );

      if (currentAttempts + 1 >= MAX_ATTEMPTS) {
        const correctOption = currentChallenge.segmentOptions?.[currentChallenge.correctSegmentation ?? 0] ?? '';
        setTimeout(() => {
          setShowResult(true);
          setFeedback(
            `The answer is ${correctOption}!`
          );
          setFeedbackType('success');
          recordResult({ challengeId: currentChallenge.id, correct: false, attempts: currentAttempts + 1 });
        }, 1000);
      }
    }
  }, [showResult, currentChallenge, currentAttempts, incrementAttempts, recordResult, sendText]);

  // ── Advance to next challenge ──────────────────────────────────
  const handleNext = useCallback(() => {
    if (!advanceProgress()) {
      submitFinalEvaluation();
      setShowSummary(true);
      return;
    }
  }, [advanceProgress, submitFinalEvaluation]);

  // ============================================================================
  // Render helpers per mode
  // ============================================================================

  const renderIsolateChallenge = (ch: PhonemeChallenge) => (
    <div className="space-y-5">
      {/* Phoneme display */}
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-2xl bg-blue-500/15 border-2 border-blue-500/30 px-10 py-6 text-center">
          <div className="text-5xl font-black text-blue-200 tracking-wide">
            {ch.phoneme}
          </div>
          <p className="text-sm text-blue-400/70 mt-2 italic">
            &ldquo;{ch.phonemeSound}&rdquo;
          </p>
        </div>
      </div>

      {/* Example word */}
      <div className="flex items-center justify-center gap-3 rounded-xl bg-white/5 border border-white/10 px-5 py-3">
        <span className="text-3xl">{ch.exampleEmoji}</span>
        <div className="text-center">
          <span className="text-xl font-bold text-slate-100">{ch.exampleWord}</span>
          <p className="text-xs text-slate-500">
            starts with <span className="text-blue-300 font-semibold">{ch.phoneme}</span>
          </p>
        </div>
      </div>

      {/* Question */}
      <p className="text-center text-base text-slate-300 font-medium">
        Which word also starts with the{' '}
        <span className="text-blue-300 font-bold">{ch.phoneme}</span> sound?
      </p>

      {/* 4 choice buttons */}
      {renderChoiceGrid()}
    </div>
  );

  const renderBlendChallenge = (ch: PhonemeChallenge) => (
    <div className="space-y-5">
      {/* Phoneme tiles */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-purple-400/70 font-medium">Blend these sounds together:</p>
        <div className="flex items-center gap-2">
          {ch.phonemeSequence?.map((p, i) => (
            <React.Fragment key={i}>
              <div className="rounded-xl bg-purple-500/15 border-2 border-purple-500/30 px-5 py-4 text-center">
                <span className="text-2xl font-black text-purple-200">/{p}/</span>
              </div>
              {i < (ch.phonemeSequence?.length ?? 0) - 1 && (
                <span className="text-purple-400/50 text-lg">+</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Question */}
      <p className="text-center text-base text-slate-300 font-medium">
        What word do these sounds make?
      </p>

      {/* 4 choice buttons */}
      {renderChoiceGrid()}
    </div>
  );

  const renderSegmentChallenge = (ch: PhonemeChallenge) => (
    <div className="space-y-5">
      {/* Target word display */}
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/30 px-10 py-6 text-center">
          <span className="text-4xl">{ch.targetEmoji}</span>
          <div className="text-3xl font-black text-emerald-200 mt-2">
            {ch.targetWord}
          </div>
        </div>
      </div>

      {/* Question */}
      <p className="text-center text-base text-slate-300 font-medium">
        How do you break <span className="text-emerald-300 font-bold">&ldquo;{ch.targetWord}&rdquo;</span> into sounds?
      </p>

      {/* 4 segmentation options */}
      <div className={`grid grid-cols-1 gap-2 ${isShaking ? 'animate-shake' : ''}`}>
        {ch.segmentOptions?.map((option, idx) => {
          const isCorrectOption = showResult && idx === ch.correctSegmentation;
          const isWrongSelected = showResult && selectedIndex === idx && idx !== ch.correctSegmentation;

          return (
            <button
              key={idx}
              onClick={() => !showResult && handleSegmentSelect(idx)}
              disabled={showResult}
              className={`
                rounded-xl border-2 p-4 text-center transition-all duration-200 cursor-pointer
                ${isCorrectOption
                  ? 'bg-emerald-500/20 border-emerald-500/50 ring-2 ring-emerald-400/40'
                  : isWrongSelected
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }
                ${isCelebrating && isCorrectOption ? 'animate-bounce' : ''}
              `}
            >
              <span className={`text-lg font-mono font-bold ${
                isCorrectOption
                  ? 'text-emerald-200'
                  : isWrongSelected
                    ? 'text-red-300'
                    : 'text-slate-200'
              }`}>
                {option}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderManipulateChallenge = (ch: PhonemeChallenge) => (
    <div className="space-y-5">
      {/* Original word */}
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-2xl bg-amber-500/15 border-2 border-amber-500/30 px-10 py-6 text-center">
          <span className="text-4xl">{ch.originalEmoji}</span>
          <div className="text-3xl font-black text-amber-200 mt-2">
            {ch.originalWord}
          </div>
        </div>
      </div>

      {/* Operation instruction */}
      <div className="rounded-xl bg-white/5 border border-white/10 px-5 py-3 text-center">
        <p className="text-base text-slate-200 font-medium">
          {ch.operationDescription}
        </p>
      </div>

      {/* Question */}
      <p className="text-center text-base text-slate-300 font-medium">
        What new word do you get?
      </p>

      {/* 4 choice buttons */}
      {renderChoiceGrid()}
    </div>
  );

  const renderChoiceGrid = () => (
    <div className={`grid grid-cols-2 gap-3 ${isShaking ? 'animate-shake' : ''}`}>
      {shuffledChoices.map((choice, idx) => {
        const isCorrectChoice = showResult && choice.correct;
        const isWrongSelected = showResult && selectedIndex === idx && !choice.correct;
        const modeColor = currentChallenge?.mode === 'blend' ? 'purple'
          : currentChallenge?.mode === 'manipulate' ? 'amber'
          : 'emerald';

        return (
          <button
            key={idx}
            onClick={() => !showResult && handleChoiceSelect(idx)}
            disabled={showResult}
            className={`
              rounded-xl border-2 p-4 flex flex-col items-center gap-2
              transition-all duration-200 cursor-pointer
              ${isCorrectChoice
                ? `bg-${modeColor}-500/20 border-${modeColor}-500/50 ring-2 ring-${modeColor}-400/40 bg-emerald-500/20 border-emerald-500/50 ring-2 ring-emerald-400/40`
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
  );

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
  const modeInfo = MODE_LABELS[currentChallenge?.mode ?? 'isolate'];

  // ── Start screen ──────────────────────────────────────────────
  if (!hasStarted) {
    return (
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
        <CardContent className="p-8 flex flex-col items-center text-center space-y-5">
          <div className="text-5xl">{'\uD83D\uDD0A'}</div>
          <CardTitle className="text-xl text-slate-100">{title}</CardTitle>
          <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-400 text-xs">
            Phoneme Explorer
          </Badge>
          <p className="text-slate-400 text-sm max-w-sm">
            Listen to sounds and explore how words are built!
            {' '}{challenges.length} challenges to complete.
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
              className={`text-xs ${
                currentChallenge?.mode === 'blend' ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                : currentChallenge?.mode === 'segment' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : currentChallenge?.mode === 'manipulate' ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-blue-500/20 border-blue-500/40 text-blue-300'
              }`}
            >
              {modeInfo.icon} {modeInfo.badge}
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

        {/* Challenge content — mode-specific rendering */}
        {!showSummary && currentChallenge && (
          <>
            {currentChallenge.mode === 'isolate' && renderIsolateChallenge(currentChallenge)}
            {currentChallenge.mode === 'blend' && renderBlendChallenge(currentChallenge)}
            {currentChallenge.mode === 'segment' && renderSegmentChallenge(currentChallenge)}
            {currentChallenge.mode === 'manipulate' && renderManipulateChallenge(currentChallenge)}
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
            heading="Phoneme Explorer Complete!"
            celebrationMessage="Great job exploring sounds!"
            className="mb-6"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default PhonemeExplorer;
