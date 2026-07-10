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
  LuminaMicListener,
  answerStateClass,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { WordFlipMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useVoiceAnswer, type SpokenJudgeResult } from '../../../hooks/useVoiceAnswer';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

// Grammar-transformation task identities. The child sees a counted-picture
// frame ("One dog 🐕 · Three ___?") and SAYS the transformed word ("dogs").
// plural_s = regular -s plurals, the birth mode. The ladder the design implies
// (article_choice tap-only, plural_es, pronoun_swap, verb_past, irregulars)
// widens this union via /add-eval-modes — do not add rungs here by hand.
export type WordFlipChallengeType = 'plural_s';

export interface WordFlipChallenge {
  id: string;
  type: WordFlipChallengeType;
  /** The base (singular) word shown in the frame — the stimulus ("dog"). */
  singular: string;
  /**
   * The transformed word the student must PRODUCE ("dogs"). Derived by code
   * (singular + 's' for plural_s) so it can never desync from the stimulus.
   */
  answer: string;
  /** Emoji picture of the noun (🐕). Repeated `count` times on the many-side. */
  emoji: string;
  /** How many on the many-side (2-5) — the counted-picture stimulus. */
  count: number;
  /**
   * Exactly 3 tap chips: the answer, the bare singular (no plural marking),
   * and the over-regularized form ("dogses") — the two authentic K error
   * shapes. Code-built and shuffled; the support net for the spoken beat.
   */
  options: string[];
}

export interface WordFlipData {
  title: string;
  description: string;
  /** Session-level mode. Single value at birth; /add-eval-modes widens it. */
  challengeType: WordFlipChallengeType;
  /** 4-6 challenges. REQUIRED — assembled by the generator from Gemini's noun pool. */
  challenges: WordFlipChallenge[];
  gradeLevel?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<WordFlipMetrics>) => void;
}

interface WordFlipProps {
  data: WordFlipData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_CONFIG: Record<string, PhaseConfig> = {
  plural_s: { label: 'One & Many', icon: '🔁', accentColor: 'emerald' },
};

const MODE_META: Record<WordFlipChallengeType, { badge: string; icon: string; accent: LuminaAccent }> = {
  plural_s: { badge: 'One & Many', icon: '🔁', accent: 'emerald' },
};

const MAX_WRONG_TAPS = 3;
const AUTO_ADVANCE_MS = 1600;

const COUNT_WORDS: Record<number, string> = { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five' };

// ============================================================================
// Component
// ============================================================================

const WordFlip: React.FC<WordFlipProps> = ({ data, className }) => {
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

  const gradeLevel = data.gradeLevel ?? 'K';

  // ── Activity gate + session voice consent ─────────────────────
  const [hasStarted, setHasStarted] = useState(false);
  // 'auto' = open-mic spoken production (session-level opt-in from the start
  // screen — THE consent gesture). 'off' = tap-only.
  const [voiceMode, setVoiceMode] = useState<'auto' | 'off'>('off');

  // ── Interaction state (reset per challenge) ────────────────────
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [spokenMatched, setSpokenMatched] = useState(false);
  const [spokenMisses, setSpokenMisses] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [isShaking, setIsShaking] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // Session-level spoken metrics
  const [spokenWords, setSpokenWords] = useState<Set<string>>(new Set());
  const [totalSpokenMisses, setTotalSpokenMisses] = useState(0);

  const startTimeRef = useRef(Date.now());
  const recordedRef = useRef(false);

  const stableInstanceIdRef = useRef(instanceId || `word-flip-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Shared challenge progress ──────────────────────────────────
  const {
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({ challenges, getChallengeId: (ch) => ch.id });

  const currentChallenge = challenges[currentIndex];

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_CONFIG,
  });

  // ── Evaluation ─────────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<WordFlipMetrics>({
    primitiveType: 'word-flip',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const [submittedScore, setSubmittedScore] = useState<number | null>(null);

  // ── Shuffle chips once per challenge ───────────────────────────
  const shuffledOptions = useMemo(() => {
    if (!currentChallenge?.options) return [];
    return [...currentChallenge.options].sort(() => Math.random() - 0.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge?.id]);

  // ── AI tutoring ────────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    challengeType: currentChallenge?.type,
    currentChallengeIndex: currentIndex + 1,
    totalChallenges: challenges.length,
    attempts: currentAttempts,
    voiceMode,
  }), [currentChallenge?.type, currentIndex, challenges.length, currentAttempts, voiceMode]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'word-flip',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // ── Session intro (quiet-by-default) ───────────────────────────
  // The counted frame is fully self-evident on screen, so the tutor frames the
  // game ONCE and then stays silent every round — the picture + live mic carry
  // it (the PictureVocabulary 'naming' precedent).
  //
  // PROMPT LAW: the tutor must NEVER say the transformed word ("dogs") — the
  // mic is open while the tutor talks. Saying the SINGULAR ("dog") is safe and
  // allowed: the frame already prints it, and "dog" can never match a judge
  // listening for "dogs".
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!hasStarted || !isConnected || hasIntroducedRef.current || !currentChallenge) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Word Flip — ${challenges.length} quick word flips. `
      + `Give ONE short, warm sentence to set it up (e.g. "One dog… two DOGS! When you see more than one, say the new word!"), `
      + `using an example word that is NOT "${currentChallenge.singular}". `
      + `Then be SILENT and wait — the pictures ask the questions and the mic is live. `
      + `NEVER say the answer form of the word on screen.`,
      { silent: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStarted, isConnected, currentChallenge]);

  // ── Complete current challenge (stale-state guarded) ───────────
  const completeCurrentChallenge = useCallback((correct: boolean, viaSpoken: boolean) => {
    if (!currentChallenge || recordedRef.current) return;
    recordedRef.current = true;
    const wrongTaps = currentAttempts;
    const score = correct ? Math.max(25, 100 - wrongTaps * 25) : 0;
    recordResult({
      challengeId: currentChallenge.id,
      correct,
      attempts: wrongTaps + 1,
      score,
      ...(viaSpoken ? { spoken: true } : {}),
    });
  }, [currentChallenge, currentAttempts, recordResult]);

  // ── Spoken production (the primary judged path) ────────────────
  const spokenActive =
    hasStarted && !showSummary && !showResult && !spokenMatched && voiceMode === 'auto';

  // Asymmetric grading law: match → credit + chime; no-match / unclear →
  // NOTHING scored against the student, tutor SILENT (open mic — any coaching
  // audio talks over a child who is mid-think). The visible chips are the net.
  const handleSpokenResult = useCallback((result: SpokenJudgeResult) => {
    if (!currentChallenge || showResult || spokenMatched) return;
    if (result.outcome === 'match') {
      SoundManager.playCorrect();
      setSpokenMatched(true);
      setShowResult(true);
      setSpokenWords(prev => new Set(Array.from(prev).concat(currentChallenge.id)));
      setFeedback(`You said "${currentChallenge.answer}"! ${currentChallenge.emoji.repeat(Math.min(currentChallenge.count, 3))}`);
      setFeedbackType('success');
      completeCurrentChallenge(true, true);
      // Quiet-by-default: SFX + feedback carry a routine success. The tutor
      // speaks ONLY for the first spoken word of the session or a comeback.
      const firstVoice = spokenWords.size === 0;
      const recovered = spokenMisses > 0;
      if (firstVoice || recovered) {
        sendText(
          `[SPOKEN_MATCH] Student said "${currentChallenge.answer}" out loud`
          + (firstVoice ? ' — their FIRST spoken answer' : ' after trying again')
          + `! ONE short, joyful sentence (you may say the word now). Then STOP.`,
          { silent: true },
        );
      }
    } else if (result.outcome === 'no-match' && result.verdict?.heard) {
      setSpokenMisses(m => m + 1);
      setTotalSpokenMisses(t => t + 1);
    } else {
      setSpokenMisses(m => m + 1);
    }
  }, [currentChallenge, showResult, spokenMatched, spokenWords, spokenMisses, completeCurrentChallenge, sendText]);

  const spokenTurn = useVoiceAnswer({
    targetWord: currentChallenge?.answer ?? '',
    gradeLevel,
    active: spokenActive,
    onResult: handleSpokenResult,
    onNoSpeech: () => {},
  });
  const spokenTurnRef = useRef<typeof spokenTurn | null>(null);
  spokenTurnRef.current = spokenTurn;

  // ── Tap path (the receptive fallback) ──────────────────────────
  const handleOptionTap = useCallback((idx: number) => {
    if (!currentChallenge || showResult) return;
    const option = shuffledOptions[idx];
    if (!option) return;
    setSelectedIndex(idx);

    if (option === currentChallenge.answer) {
      SoundManager.playCorrect();
      setShowResult(true);
      setFeedback(`Yes! ${COUNT_WORDS[currentChallenge.count] ?? currentChallenge.count} "${currentChallenge.answer}"!`);
      setFeedbackType('success');
      completeCurrentChallenge(true, false);
    } else {
      SoundManager.playIncorrect();
      incrementAttempts();
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setSelectedIndex(null);
      setFeedback('Hmm, not that one. Try again!');
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student tapped "${option}" — incorrect (attempt ${currentAttempts + 1}). `
        + `Give a tiny hint about "more than one" WITHOUT saying "${currentChallenge.answer}".`,
        { silent: true },
      );
      if (currentAttempts + 1 >= MAX_WRONG_TAPS) {
        setTimeout(() => {
          setShowResult(true);
          setFeedback(`It's "${currentChallenge.answer}"!`);
          setFeedbackType('success');
          completeCurrentChallenge(false, false);
          sendText(
            `[ANSWER_REVEALED] Out of tries — the answer "${currentChallenge.answer}" is now shown. Say it warmly and move on. No shame.`,
            { silent: true },
          );
        }, 900);
      }
    }
  }, [currentChallenge, showResult, shuffledOptions, currentAttempts, incrementAttempts, completeCurrentChallenge, sendText]);

  // ── Advance / submit ───────────────────────────────────────────
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;
    const correctCount = challengeResults.filter(r => r.correct).length;
    const totalCount = challenges.length;
    const totalAttempts = challengeResults.reduce((sum, r) => sum + r.attempts, 0);
    const firstTryCount = challengeResults.filter(r => r.correct && r.attempts <= 1).length;
    const overallPct = totalCount > 0
      ? Math.round(challengeResults.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0) / totalCount)
      : 0;
    const elapsed = Date.now() - startTimeRef.current;

    const metrics: WordFlipMetrics = {
      type: 'word-flip',
      challengeType: data.challengeType,
      totalChallenges: totalCount,
      correctCount,
      attemptsCount: totalAttempts,
      firstTryCount,
      hintsViewed: 0,
      overallAccuracy: overallPct,
      averageAttemptsPerChallenge: totalCount > 0 ? totalAttempts / totalCount : 0,
    };

    setSubmittedScore(overallPct);
    submitEvaluation(overallPct >= 60, overallPct, metrics, {
      durationMs: elapsed,
      challengeResults,
      spokenWords: Array.from(spokenWords),
      spokenMisses: totalSpokenMisses,
      voiceMode,
    });

    const spokenCount = spokenWords.size;
    const phaseScoreStr = phaseResults.map(p => `${p.label} ${p.score}%`).join(', ');
    sendText(
      `[ALL_COMPLETE] All ${totalCount} word flips done! Scores: ${phaseScoreStr}. Overall ${overallPct}%. `
      + `${spokenCount > 0 ? `The student SAID ${spokenCount} word${spokenCount === 1 ? '' : 's'} out loud — celebrate that especially. ` : ''}`
      + `Short celebration, then STOP.`,
      { silent: true },
    );
  }, [
    hasSubmittedEvaluation, challengeResults, challenges.length, data.challengeType,
    phaseResults, spokenWords, totalSpokenMisses, voiceMode, submitEvaluation, sendText,
  ]);

  const handleNext = useCallback(() => {
    spokenTurnRef.current?.cancel(); // never carry a live mic across challenges
    if (!advanceProgress()) {
      submitFinalEvaluation();
      setShowSummary(true);
    }
  }, [advanceProgress, submitFinalEvaluation]);

  // Auto-advance after a spoken match — ref-guarded so a timer and a click can
  // never both fire (PictureVocabulary latch pattern, incl. the per-challenge
  // latch clear in the reset effect below).
  const advanceRef = useRef(handleNext);
  advanceRef.current = handleNext;
  const autoAdvancedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentChallenge || !spokenMatched || !showResult) return;
    if (autoAdvancedForRef.current === currentChallenge.id) return;
    autoAdvancedForRef.current = currentChallenge.id;
    const t = setTimeout(() => advanceRef.current(), AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spokenMatched, showResult, currentChallenge?.id]);

  // ── Per-challenge reset (PRD §5 rule 8) ────────────────────────
  useEffect(() => {
    setSelectedIndex(null);
    setShowResult(false);
    setSpokenMatched(false);
    setSpokenMisses(0);
    setFeedback('');
    setFeedbackType('');
    setIsShaking(false);
    recordedRef.current = false;
    autoAdvancedForRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge?.id]);

  // ============================================================================
  // Render
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
  const modeMeta = MODE_META[currentChallenge?.type ?? 'plural_s'];
  const micSupported = spokenTurn.isSupported;

  // ── Start screen: the session-level voice consent gesture ─────
  if (!hasStarted) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-8 flex flex-col items-center text-center space-y-5">
          <div className="text-5xl">{'🔁'}</div>
          <LuminaCardTitle className="text-xl">{title}</LuminaCardTitle>
          <LuminaBadge className="text-xs">Word Flip</LuminaBadge>
          <p className="text-slate-400 text-sm max-w-sm">
            {data.description || 'One dog… two DOGS! Flip words to say "more than one"!'}
            {' '}{challenges.length} word flips.
          </p>
          <div className="flex flex-col items-center gap-2.5">
            {micSupported && (
              <LuminaButton
                tone="primary"
                onClick={() => {
                  startTimeRef.current = Date.now();
                  setVoiceMode('auto');
                  setHasStarted(true);
                }}
                className="px-8 py-3 text-lg"
              >
                {'🎙️'} Start with Voice
              </LuminaButton>
            )}
            <LuminaButton
              tone={micSupported ? 'ghost' : 'primary'}
              onClick={() => {
                startTimeRef.current = Date.now();
                setVoiceMode('off');
                setHasStarted(true);
              }}
              className={micSupported ? 'px-6 py-2 text-sm' : 'px-8 py-3 text-lg'}
            >
              Start tap-only
            </LuminaButton>
            {micSupported && (
              <p className="text-slate-600 text-xs max-w-xs">
                Voice mode keeps the microphone open so you can just say your answers — best with a headset.
              </p>
            )}
          </div>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            {!showSummary && voiceMode === 'auto' && (
              <button
                onClick={() => { spokenTurn.cancel(); setVoiceMode('off'); }}
                className="text-xs text-slate-500 hover:text-slate-300 border border-white/10 rounded-full px-2.5 py-1"
                title="Turn off voice mode"
              >
                {'🎙️'} on
              </button>
            )}
            {!showSummary && (
              <LuminaBadge accent={modeMeta.accent} className="text-xs">
                {modeMeta.icon} {modeMeta.badge}
              </LuminaBadge>
            )}
          </div>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!showSummary && (
          <>
            <div className="flex items-center justify-between text-sm">
              <LuminaChallengeCounter
                current={currentIndex + 1}
                total={challenges.length}
                className="text-slate-400 text-sm"
              />
              <span className="text-slate-500 text-xs">
                {challengeResults.filter(r => r.correct).length} correct
                {spokenWords.size > 0 && ` · ${spokenWords.size} spoken 🎙️`}
              </span>
            </div>
            <LuminaProgress
              accent={modeMeta.accent}
              value={((showResult ? currentIndex + 1 : currentIndex) / challenges.length) * 100}
            />
          </>
        )}

        {!showSummary && currentChallenge && (
          <div className="space-y-5">
            {/* The counted-picture frame — the whole stimulus. The singular is
                the shown base word; the transformed word NEVER renders pre-solve. */}
            <div className="flex items-stretch justify-center gap-3">
              <div className="rounded-2xl bg-white/5 border-2 border-white/10 px-5 py-4 text-center flex-1 max-w-[180px]">
                <div className="text-xs uppercase tracking-wide text-slate-500 font-mono mb-1">One</div>
                <div className="text-5xl leading-tight">{currentChallenge.emoji}</div>
                <div className="text-xl font-black text-slate-100 mt-2">{currentChallenge.singular}</div>
              </div>
              <div className="flex items-center text-2xl text-slate-500" aria-hidden>→</div>
              <div className="rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 px-5 py-4 text-center flex-1 max-w-[220px]">
                <div className="text-xs uppercase tracking-wide text-emerald-300/80 font-mono mb-1">
                  {COUNT_WORDS[currentChallenge.count] ?? currentChallenge.count}
                </div>
                <div className="text-4xl leading-tight break-words">
                  {currentChallenge.emoji.repeat(currentChallenge.count)}
                </div>
                <div className="text-xl font-black mt-2">
                  {showResult ? (
                    <span className="text-emerald-300">{currentChallenge.answer}</span>
                  ) : (
                    <span className="text-emerald-300/70 border-b-2 border-emerald-400/60 px-4">&nbsp;___&nbsp;</span>
                  )}
                </div>
              </div>
            </div>

            <p className="text-center text-base text-slate-300 font-medium">
              {COUNT_WORDS[currentChallenge.count] ?? currentChallenge.count} of them!
              {voiceMode === 'auto' ? ' Say the new word!' : ' Tap the new word!'}
            </p>

            {spokenActive && spokenTurn.isSupported && (
              <div className="flex justify-center min-h-[64px] items-center">
                <LuminaMicListener
                  state={spokenTurn.state}
                  level={spokenTurn.level}
                  isSupported={spokenTurn.isSupported}
                  dormant={spokenTurn.dormant}
                  onStart={() => spokenTurn.startManual()}
                  onCancel={() => spokenTurn.cancel()}
                  accent={modeMeta.accent}
                  idleLabel="Say it!"
                  listeningLabel="Your turn — say it!"
                />
              </div>
            )}

            {/* Tap chips — the receptive support net, always available. */}
            {!spokenMatched && (
              <>
                {voiceMode === 'auto' && !showResult && (
                  <p className="text-center text-xs text-slate-500">…or tap the word:</p>
                )}
                <div className={`grid grid-cols-3 gap-3 ${isShaking ? 'animate-shake' : ''}`}>
                  {shuffledOptions.map((option, idx) => {
                    const isCorrectOption = showResult && option === currentChallenge.answer;
                    const isWrongSelected = showResult && selectedIndex === idx && !isCorrectOption;
                    const state = isCorrectOption ? 'correct' : isWrongSelected ? 'incorrect' : 'idle';
                    return (
                      <button
                        key={`${currentChallenge.id}-${idx}`}
                        onClick={() => !showResult && handleOptionTap(idx)}
                        disabled={showResult}
                        className={`
                          rounded-xl border-2 p-4 flex items-center justify-center
                          transition-all duration-200 cursor-pointer
                          ${answerStateClass(state)}
                          ${isCorrectOption ? 'ring-2 ring-emerald-400/40' : ''}
                        `}
                      >
                        <span className="text-lg font-bold">{option}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {feedback && !showSummary && (
          <LuminaFeedbackCard
            status={feedbackType === 'success' ? 'correct' : 'incorrect'}
            className="text-center"
          >
            {feedback}
          </LuminaFeedbackCard>
        )}

        {/* Next: manual for tap path; spoken match auto-advances */}
        {showResult && !showSummary && !spokenMatched && (
          <div className="flex justify-center">
            <LuminaActionButton action="next" onClick={handleNext}>
              {currentIndex < challenges.length - 1 ? 'Next' : 'Finish'}
            </LuminaActionButton>
          </div>
        )}
        {showResult && !showSummary && spokenMatched && (
          <p className="text-center text-slate-500 text-xs animate-pulse">Next one coming up…</p>
        )}

        {showSummary && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedScore ?? undefined}
            durationMs={elapsedMs}
            heading="Word Flip Complete!"
            celebrationMessage={
              spokenWords.size > 0
                ? `Amazing — you flipped ${spokenWords.size} word${spokenWords.size === 1 ? '' : 's'} out loud! 🎙️`
                : 'Great job flipping your words!'
            }
            className="mb-6"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default WordFlip;
