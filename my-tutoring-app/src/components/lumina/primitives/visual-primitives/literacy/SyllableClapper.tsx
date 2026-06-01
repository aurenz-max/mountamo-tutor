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
  LuminaProgress,
  LuminaFeedbackCard,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { SyllableClapperMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

interface SyllableChallenge {
  id: string;
  word: string;
  syllableCount: number;       // 1-4
  syllables: string[];         // ["but", "ter", "fly"]
  imageDescription: string;
  difficulty: number;           // 3-5
  challengeType: 'easy' | 'medium' | 'hard';
}

export interface SyllableClapperData {
  title: string;
  challenges: SyllableChallenge[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SyllableClapperMetrics>) => void;
}

// ============================================================================
// Props
// ============================================================================

interface SyllableClapperProps {
  data: SyllableClapperData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const SYLLABLE_COLORS = [
  'bg-blue-500/30 border-blue-400/50 text-blue-200',
  'bg-purple-500/30 border-purple-400/50 text-purple-200',
  'bg-emerald-500/30 border-emerald-400/50 text-emerald-200',
  'bg-amber-500/30 border-amber-400/50 text-amber-200',
];

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  easy: { label: 'Easy Words', icon: '👏', accentColor: 'blue' },
  medium: { label: 'Medium Words', icon: '👏👏', accentColor: 'purple' },
  hard: { label: 'Hard Words', icon: '👏👏👏', accentColor: 'emerald' },
};

const MAX_CLAPS = 6;
const MAX_ATTEMPTS = 3;
const GRADE_LEVEL = 'K';

// ============================================================================
// Component
// ============================================================================

const SyllableClapper: React.FC<SyllableClapperProps> = ({ data, className }) => {
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

  // ── Activity gate ─────────────────────────────────────────────
  const [hasStarted, setHasStarted] = useState(false);

  // ── Clapping state ────────────────────────────────────────────
  const [clapCount, setClapCount] = useState(0);
  const [hasChecked, setHasChecked] = useState(false);
  const [showSyllables, setShowSyllables] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [isClapping, setIsClapping] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // ── Timing ────────────────────────────────────────────────────
  const startTimeRef = useRef(Date.now());

  // ── Instance ID ───────────────────────────────────────────────
  const stableInstanceIdRef = useRef(instanceId || `syllable-clapper-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Shared challenge progress hook ────────────────────────────
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
    getChallengeType: (ch) => ch.challengeType,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // ── Evaluation ────────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<SyllableClapperMetrics>({
    primitiveType: 'syllable-clapper',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const [submittedScore, setSubmittedScore] = useState<number | null>(null);

  const currentChallenge = challenges[currentIndex];

  // ── AI Tutoring integration ───────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    currentWord: currentChallenge?.word ?? '',
    syllableCount: currentChallenge?.syllableCount ?? 0,
    syllables: currentChallenge?.syllables?.join(', ') ?? '',
    studentClaps: clapCount,
    currentChallenge: currentIndex + 1,
    totalChallenges: challenges.length,
    attempts: currentAttempts,
  }), [currentChallenge, currentIndex, challenges.length, currentAttempts, clapCount]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'syllable-clapper',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: GRADE_LEVEL,
  });

  // ── Activity introduction — fire once when connected ──────────
  const hasIntroducedRef = useRef(false);

  useEffect(() => {
    if (!hasStarted || !isConnected || hasIntroducedRef.current || !currentChallenge) return;
    hasIntroducedRef.current = true;

    sendText(
      `[ACTIVITY_START] This is a syllable clapping activity for kindergarten. `
      + `There are ${challenges.length} words to clap. `
      + `Warmly introduce the activity: "We're going to clap the parts of words!" `
      + `Then say the first word "${currentChallenge.word}" clearly and naturally.`,
      { silent: true },
    );
  }, [hasStarted, isConnected, currentChallenge, challenges.length, sendText]);

  // ── Pronounce word when challenge changes ─────────────────────
  useEffect(() => {
    if (!currentChallenge || !isConnected || !hasIntroducedRef.current) return;
    if (currentIndex === 0) return; // First challenge handled by ACTIVITY_START

    sendText(
      `[PRONOUNCE_SOUND] The word is "${currentChallenge.word}". ${currentChallenge.word}.`,
      { silent: true },
    );
  }, [currentIndex, currentChallenge, isConnected, sendText]);

  // ── Reset state when challenge advances ───────────────────────
  useEffect(() => {
    setClapCount(0);
    setHasChecked(false);
    setShowSyllables(false);
    setFeedback('');
    setFeedbackType('');
    setIsCelebrating(false);
  }, [currentIndex]);

  // ── Handle clap ───────────────────────────────────────────────
  const handleClap = useCallback(() => {
    if (hasChecked || clapCount >= MAX_CLAPS) return;

    SoundManager.tap();
    setClapCount(prev => prev + 1);
    setIsClapping(true);
    setTimeout(() => setIsClapping(false), 200);
  }, [hasChecked, clapCount]);

  // ── Handle check (submit clap count) ──────────────────────────
  const handleCheck = useCallback(() => {
    if (hasChecked || clapCount === 0 || !currentChallenge) return;

    incrementAttempts();
    const isCorrect = clapCount === currentChallenge.syllableCount;

    if (isCorrect) {
      SoundManager.playCorrect();
      setHasChecked(true);
      setShowSyllables(true);
      setFeedback(
        `Yes! "${currentChallenge.word}" has ${currentChallenge.syllableCount} `
        + `part${currentChallenge.syllableCount > 1 ? 's' : ''}!`,
      );
      setFeedbackType('success');
      setIsCelebrating(true);
      setTimeout(() => setIsCelebrating(false), 1500);

      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });

      sendText(
        `[CLAP_CORRECT] Student correctly clapped ${clapCount} times for "${currentChallenge.word}" `
        + `(${currentChallenge.syllableCount} syllables: ${currentChallenge.syllables.join(', ')}). `
        + `Celebrate briefly: "Yes! ${currentChallenge.word} has ${currentChallenge.syllableCount} parts! Let's hear them..."`,
        { silent: true },
      );

      // After a beat, ask AI to pronounce the syllables
      setTimeout(() => {
        sendText(
          `[PRONOUNCE_SYLLABLES] Say "${currentChallenge.word}" broken into syllables with clear pauses: `
          + `"${currentChallenge.syllables.join('...')}". Exaggerate the breaks slightly.`,
          { silent: true },
        );
      }, 2000);
    } else {
      SoundManager.playIncorrect();
      setFeedback(
        clapCount > currentChallenge.syllableCount
          ? "That's too many claps. Listen again..."
          : "That's not enough claps. Listen again...",
      );
      setFeedbackType('error');

      sendText(
        `[CLAP_INCORRECT] Student clapped ${clapCount} times but "${currentChallenge.word}" has `
        + `${currentChallenge.syllableCount} syllables. Attempt ${currentAttempts + 1}. `
        + `Say "Hmm, let me say it again slowly. Listen for the parts..." `
        + `then re-say with breaks: "${currentChallenge.syllables.join('...')}".`,
        { silent: true },
      );

      // After max attempts, reveal answer
      if (currentAttempts + 1 >= MAX_ATTEMPTS) {
        setTimeout(() => {
          setHasChecked(true);
          setShowSyllables(true);
          setFeedback(
            `"${currentChallenge.word}" has ${currentChallenge.syllableCount} `
            + `part${currentChallenge.syllableCount > 1 ? 's' : ''}: `
            + `${currentChallenge.syllables.join(' · ')}`,
          );
          setFeedbackType('success');
          recordResult({
            challengeId: currentChallenge.id,
            correct: false,
            attempts: currentAttempts + 1,
          });
        }, 1500);
      } else {
        // Reset claps for retry
        setTimeout(() => {
          setClapCount(0);
          setFeedback('');
          setFeedbackType('');
        }, 1500);
      }
    }
  }, [hasChecked, clapCount, currentChallenge, currentAttempts, incrementAttempts, recordResult, sendText]);

  // ── Handle syllable segment tap ───────────────────────────────
  const handleSyllableTap = useCallback((syllable: string) => {
    if (!showSyllables) return;

    sendText(
      `[PRONOUNCE_SYLLABLE] Say just the syllable "${syllable}" clearly. Nothing else.`,
      { silent: true },
    );
  }, [showSyllables, sendText]);

  // ── Submit final evaluation ───────────────────────────────────
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;

    const correctCount = challengeResults.filter(r => r.correct).length;
    const totalCount = challenges.length;
    const overallPct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    const totalAttempts = challengeResults.reduce((sum, r) => sum + r.attempts, 0);
    const elapsed = Date.now() - startTimeRef.current;

    // Calculate syllable count distribution
    const syllableCountsEncountered: Record<number, number> = {};
    for (const ch of challenges) {
      syllableCountsEncountered[ch.syllableCount] =
        (syllableCountsEncountered[ch.syllableCount] || 0) + 1;
    }

    const metrics: SyllableClapperMetrics = {
      type: 'syllable-clapper',
      wordsCorrect: correctCount,
      wordsTotal: totalCount,
      clapCountAccuracy: overallPct,
      syllableCountsEncountered,
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
      `[SESSION_COMPLETE] All ${totalCount} words done! Scores by syllable count: ${phaseScoreStr}. `
      + `Overall: ${overallPct}%. Celebrate the full session!`,
      { silent: true },
    );
  }, [
    hasSubmittedEvaluation, challengeResults, challenges,
    phaseResults, submitEvaluation, sendText,
  ]);

  // ── Advance to next challenge ─────────────────────────────────
  const handleNext = useCallback(() => {
    if (!advanceProgress()) {
      submitFinalEvaluation();
      setShowSummary(true);
      return;
    }
    sendText(
      `[NEXT_CHALLENGE] Moving to word ${currentIndex + 2} of ${challenges.length}.`,
      { silent: true },
    );
  }, [advanceProgress, currentIndex, challenges.length, sendText, submitFinalEvaluation]);

  // ── Undo last clap ────────────────────────────────────────────
  const handleUndoClap = useCallback(() => {
    if (hasChecked || clapCount === 0) return;
    setClapCount(prev => prev - 1);
  }, [hasChecked, clapCount]);

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

  // ── Start screen ──────────────────────────────────────────────
  if (!hasStarted) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-8 flex flex-col items-center text-center space-y-5">
          <div className="text-4xl">{'👏'}</div>
          <LuminaCardTitle className="text-xl">{title}</LuminaCardTitle>
          <LuminaBadge className="text-xs">Kindergarten</LuminaBadge>
          <p className="text-slate-400 text-sm max-w-sm">
            {challenges.length} words to clap. Listen to each word and clap once
            for each part you hear!
          </p>
          <LuminaButton
            tone="primary"
            onClick={() => {
              startTimeRef.current = Date.now();
              setHasStarted(true);
            }}
            className="px-8 py-3 text-lg"
          >
            Start Clapping!
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
            <LuminaBadge className="text-xs">Kindergarten</LuminaBadge>
          </div>
          {currentChallenge && !showSummary && (
            <LuminaBadge accent="purple" className="text-xs">
              {'👏'} Syllable Clapping
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Progress indicator */}
        {!showSummary && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">
                Word {currentIndex + 1} of {challenges.length}
              </span>
              <span className="text-slate-500 text-xs">
                {challengeResults.filter(r => r.correct).length} correct
              </span>
            </div>
            <LuminaProgress
              accent="purple"
              value={((hasChecked ? currentIndex + 1 : currentIndex) / challenges.length) * 100}
            />
          </>
        )}

        {/* Challenge content */}
        {!showSummary && currentChallenge && (
          <div className="space-y-6">
            {/* Word display / Syllable bar */}
            <div className="flex flex-col items-center space-y-3">
              {!showSyllables ? (
                /* Unsplit word bar */
                <div className={`
                  w-full max-w-md rounded-2xl border-2 p-6 text-center transition-all duration-300
                  bg-white/5 border-white/15
                  ${isCelebrating ? 'ring-2 ring-emerald-500/50' : ''}
                `}>
                  <span className="text-4xl font-bold text-slate-100">
                    {currentChallenge.word}
                  </span>
                  {currentChallenge.imageDescription && (
                    <p className="text-sm text-slate-500 italic mt-2">
                      {currentChallenge.imageDescription}
                    </p>
                  )}
                </div>
              ) : (
                /* Split syllable bar */
                <div className="w-full max-w-md">
                  <div className={`
                    flex gap-1 transition-all duration-500
                    ${isCelebrating ? 'animate-bounce' : ''}
                  `}>
                    {currentChallenge.syllables.map((syllable, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSyllableTap(syllable)}
                        className={`
                          flex-1 rounded-xl border-2 p-4 text-center
                          transition-all duration-300 cursor-pointer
                          hover:scale-105 active:scale-95
                          ${SYLLABLE_COLORS[idx % SYLLABLE_COLORS.length]}
                        `}
                      >
                        <span className="text-2xl font-bold block">{syllable}</span>
                      </button>
                    ))}
                  </div>
                  {currentChallenge.imageDescription && (
                    <p className="text-sm text-slate-500 italic mt-2 text-center">
                      {currentChallenge.imageDescription}
                    </p>
                  )}
                  <p className="text-xs text-slate-600 text-center mt-1">
                    Tap each part to hear it
                  </p>
                </div>
              )}
            </div>

            {/* Clap counter (circles) */}
            {!hasChecked && (
              <div className="flex justify-center gap-2">
                {Array.from({ length: MAX_CLAPS }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`
                      w-8 h-8 rounded-full border-2 transition-all duration-200
                      flex items-center justify-center text-sm
                      ${idx < clapCount
                        ? 'bg-amber-500/30 border-amber-400/60 text-amber-300 scale-110'
                        : 'bg-white/5 border-white/10 text-slate-600'
                      }
                    `}
                  >
                    {idx < clapCount ? '👏' : ''}
                  </div>
                ))}
              </div>
            )}

            {/* Clap + Check buttons */}
            {!hasChecked && (
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={handleClap}
                  disabled={clapCount >= MAX_CLAPS}
                  className={`
                    rounded-xl bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-amber-300
                    px-10 py-6 text-2xl transition-transform disabled:opacity-50
                    ${isClapping ? 'scale-110' : 'scale-100'}
                  `}
                >
                  {'👏'} Clap!
                </button>

                <div className="flex gap-3">
                  {clapCount > 0 && (
                    <LuminaButton
                      tone="subtle"
                      onClick={handleUndoClap}
                      className="text-sm"
                    >
                      Undo
                    </LuminaButton>
                  )}
                  {clapCount > 0 && (
                    <LuminaActionButton action="check" onClick={handleCheck}>
                      Check ({clapCount} clap{clapCount !== 1 ? 's' : ''})
                    </LuminaActionButton>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Feedback banner */}
        {feedback && !showSummary && (
          <LuminaFeedbackCard
            status={feedbackType === 'error' ? 'incorrect' : 'correct'}
            className="text-center"
          >
            {feedback}
          </LuminaFeedbackCard>
        )}

        {/* Next / Finish button */}
        {hasChecked && !showSummary && (
          <div className="flex justify-center">
            <LuminaActionButton action="next" onClick={handleNext}>
              {currentIndex < challenges.length - 1 ? 'Next Word' : 'Finish'}
            </LuminaActionButton>
          </div>
        )}

        {/* Phase summary panel */}
        {showSummary && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedScore ?? undefined}
            durationMs={elapsedMs}
            heading="Syllable Clapping Complete!"
            celebrationMessage="You clapped out all the word parts!"
            className="mb-6"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default SyllableClapper;
