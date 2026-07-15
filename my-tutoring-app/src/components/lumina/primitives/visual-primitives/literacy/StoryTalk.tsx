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
  LuminaReadAloudGlyph,
  answerStateClass,
  type LuminaAccent,
} from '../../../ui';
import { useVoiceChoice } from '../../../hooks/useVoiceChoice';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { StoryTalkMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

// Comprehension task identities, all sharing the "listen → tap the picture that
// answers" surface. who_what_where = literal recall (answer stated); feeling_check
// = emotion inference (feeling NOT stated); why_because = causal inference.
// (first_next_last needs a sequencing render; retell needs the phrase judge — both
// remain deferred.)
export type StoryTalkChallengeType = 'who_what_where' | 'feeling_check' | 'why_because';

export interface StoryTalkOption {
  /** The single picturable word (e.g. "squirrel"). */
  word: string;
  /** Emoji picture of the word (🐿️). */
  emoji: string;
}

export interface StoryTalkChallenge {
  id: string;
  type: StoryTalkChallengeType;
  /** Kid-friendly title for the mini-story ("Milo's Acorn"). */
  storyTitle: string;
  /**
   * 3-5 short sentences the TUTOR READS ALOUD with character voices. This is a
   * listening task: the story text is NEVER shown while the student is answering
   * (it contains the answer verbatim). It surfaces only after the answer, as
   * reinforcement, or as a no-audio fallback when the tutor isn't connected.
   */
  story: string;
  /** The comprehension question ("Who hid the acorn?"). MUST NOT contain the answer. */
  question: string;
  /** The correct single-word answer ("squirrel"). */
  answer: string;
  /** Emoji picture of the answer. */
  answerEmoji: string;
  /** Exactly 4 options — the answer once + 3 same-category distractors. */
  options: StoryTalkOption[];
}

export interface StoryTalkData {
  title: string;
  description: string;
  /** Session-level mode. The field exists at birth so densification is cheap. */
  challengeType: StoryTalkChallengeType;
  /** 3-6 challenges. REQUIRED — built by the generator's story orchestrator. */
  challenges: StoryTalkChallenge[];
  gradeLevel?: string;
  /**
   * Screen-owner arbitration: when several voice-capable primitives stack on
   * one screen, only one may hold the live mic (the engine has no global
   * single-mic lock). Default true.
   */
  voiceEligible?: boolean;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<StoryTalkMetrics>) => void;
}

interface StoryTalkProps {
  data: StoryTalkData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_CONFIG: Record<string, PhaseConfig> = {
  who_what_where: { label: 'Listen & Tell', icon: '👂', accentColor: 'emerald' },
  feeling_check: { label: 'How Did They Feel?', icon: '💗', accentColor: 'pink' },
  why_because: { label: 'Why Did It Happen?', icon: '🤔', accentColor: 'amber' },
};

const MODE_META: Record<StoryTalkChallengeType, { badge: string; icon: string; accent: LuminaAccent }> = {
  who_what_where: { badge: 'Listen & Tell', icon: '👂', accent: 'emerald' },
  feeling_check: { badge: 'How Did They Feel?', icon: '💗', accent: 'pink' },
  why_because: { badge: 'Why Did It Happen?', icon: '🤔', accent: 'amber' },
};

const MAX_WRONG_TAPS = 3;

// ── Voice sayability gate (see /add-voice-control) ─────────────────────────
// The option captions are voice-selectable only when every one is a short
// plain-English word a Kindergartner can say, and no two captions collide
// after lowercasing (a spoken verdict would misroute). Gate fails → the mic
// never renders and the tap path is exactly what it was before voice existed.
const SAYABLE_WORD = /^[a-z][a-z' -]*$/;
export function storyTalkVoiceReady(options: StoryTalkOption[], answer: string): boolean {
  if (!options || options.length === 0) return false;
  const words = options.map((o) => o.word.trim().toLowerCase());
  if (new Set(words).size !== words.length) return false; // ambiguous when spoken
  if (!words.includes(answer.trim().toLowerCase())) return false;
  return words.every(
    (w) => w.length > 0 && w.length <= 24 && w.split(/\s+/).length <= 2 && SAYABLE_WORD.test(w),
  );
}

// ============================================================================
// Component
// ============================================================================

const StoryTalk: React.FC<StoryTalkProps> = ({ data, className }) => {
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

  // ── Activity gate ──────────────────────────────────────────────
  const [hasStarted, setHasStarted] = useState(false);

  // ── Interaction state (reset per challenge) ────────────────────
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [isShaking, setIsShaking] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const startTimeRef = useRef(Date.now());
  const recordedRef = useRef(false);

  const stableInstanceIdRef = useRef(instanceId || `story-talk-${Date.now()}`);
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
  } = usePrimitiveEvaluation<StoryTalkMetrics>({
    primitiveType: 'story-talk',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const [submittedScore, setSubmittedScore] = useState<number | null>(null);

  // ── Shuffle options once per challenge ─────────────────────────
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
    question: currentChallenge?.question,
  }), [currentChallenge?.type, currentChallenge?.question, currentIndex, challenges.length, currentAttempts]);

  const { sendText, isConnected, isAIResponding, isAudioPlaying } = useLuminaAI({
    primitiveType: 'story-talk',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // ── Read the story aloud (the listening stimulus) ──────────────
  // PROMPT LAW: the story IS the source material — the tutor reads it fully and
  // expressively. But the tutor must NOT re-answer the question after reading:
  // it reads, asks the question, then goes quiet for the child to answer.
  const readStory = useCallback((ch: StoryTalkChallenge, isFirst: boolean) => {
    const frame = isFirst
      ? `[ACTIVITY_START] Listen & Tell — ${challenges.length} short stories. Give ONE warm sentence to set it up (e.g. "I'll read you a little story — listen closely, then tell me the answer!"), then read the first story. `
      : `[NEXT_ITEM] Story ${currentIndex + 1} of ${challenges.length}. `;
    sendText(
      frame
      + `Read this story SLOWLY and expressively, with fun character voices: "${ch.story}" `
      + `Then ask exactly this question once: "${ch.question}" `
      + `Then STOP and wait — do NOT say or hint the answer. The child answers by tapping a picture.`,
      { silent: true },
    );
  }, [challenges.length, currentIndex, sendText]);

  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!hasStarted || !isConnected || hasIntroducedRef.current || !currentChallenge) return;
    hasIntroducedRef.current = true;
    readStory(currentChallenge, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStarted, isConnected, currentChallenge]);

  useEffect(() => {
    if (!currentChallenge || !isConnected || !hasIntroducedRef.current) return;
    if (currentIndex === 0) return;
    readStory(currentChallenge, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const replayStory = useCallback(() => {
    if (!currentChallenge || !isConnected) return;
    sendText(
      `[READ_AGAIN] The child asked to hear it again. Re-read this story expressively: "${currentChallenge.story}" `
      + `Then ask once: "${currentChallenge.question}" and STOP. Never say the answer.`,
      { silent: true },
    );
  }, [currentChallenge, isConnected, sendText]);

  // ── Complete current challenge (stale-state guarded) ───────────
  const completeCurrentChallenge = useCallback((correct: boolean) => {
    if (!currentChallenge || recordedRef.current) return;
    recordedRef.current = true;
    const wrongTaps = currentAttempts;
    const score = correct ? Math.max(25, 100 - wrongTaps * 25) : 0;
    recordResult({
      challengeId: currentChallenge.id,
      correct,
      attempts: wrongTaps + 1,
      score,
    });
  }, [currentChallenge, currentAttempts, recordResult]);

  // ── Answer path (tap AND voice land here) ──────────────────────
  // `viaVoice` submissions skip the outcome SoundManager calls — the voice
  // controller already played them (useVoiceChoice owns actuation sounds).
  const voiceCorrectCountRef = useRef(0);
  const answerOption = useCallback((idx: number, viaVoice: boolean) => {
    if (!currentChallenge || showResult) return;
    const option = shuffledOptions[idx];
    if (!option) return;
    setSelectedIndex(idx);

    if (option.word === currentChallenge.answer) {
      if (viaVoice) voiceCorrectCountRef.current += 1;
      else SoundManager.playCorrect();
      setShowResult(true);
      setFeedback(`Yes! ${currentChallenge.answerEmoji} "${currentChallenge.answer}"!`);
      setFeedbackType('success');
      completeCurrentChallenge(true);
      sendText(
        `[ANSWER_CORRECT] Student correctly chose "${currentChallenge.answer}". Congratulate briefly and warmly.`,
        { silent: true },
      );
    } else {
      if (!viaVoice) SoundManager.playIncorrect();
      incrementAttempts();
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setSelectedIndex(null);
      setFeedback('Hmm, listen again and try once more!');
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student chose "${option.word}" but the answer is "${currentChallenge.answer}" (attempt ${currentAttempts + 1}). `
        + `Give a tiny listening hint — remind them of a story detail WITHOUT saying "${currentChallenge.answer}".`,
        { silent: true },
      );
      if (currentAttempts + 1 >= MAX_WRONG_TAPS) {
        setTimeout(() => {
          setShowResult(true);
          setFeedback(`It's ${currentChallenge.answerEmoji} "${currentChallenge.answer}"!`);
          setFeedbackType('success');
          completeCurrentChallenge(false);
          sendText(
            `[ANSWER_REVEALED] Out of tries — the answer "${currentChallenge.answer}" is now shown. Say it warmly and move on. No shame.`,
            { silent: true },
          );
        }, 900);
      }
    }
  }, [currentChallenge, showResult, shuffledOptions, currentAttempts, incrementAttempts, completeCurrentChallenge, sendText]);

  const handleOptionTap = useCallback((idx: number) => answerOption(idx, false), [answerOption]);

  // ── Voice: say the answer word to pick its picture ──────────────
  // (/add-voice-control, spoken CHOICE shape.) A single-unit useVoiceChoice
  // listens for one of the four captions and routes the verdict into the SAME
  // answer path a tap uses — voice is purely additive, tap unchanged.
  //
  // ANSWER-LEAK GATE — a deliberate, narrow exception to the "never gate the
  // mic on tutor-busy signals" rule: in THIS primitive the tutor reads the
  // story aloud and the story contains the answer word verbatim. An open mic
  // while tutor audio plays could hear the tutor say the answer and credit it.
  // So the mic runs only while the tutor is fully quiet (`!isAIResponding &&
  // !isAudioPlaying` — the response stream can end before the audio tail
  // drains, hence both flags). This is the spoken twin of the hidden-story-
  // text gate below, not a turn-taking window.
  const voiceReady = useMemo(
    () =>
      (data.voiceEligible ?? true) &&
      Boolean(currentChallenge) &&
      storyTalkVoiceReady(shuffledOptions, currentChallenge?.answer ?? ''),
    [data.voiceEligible, currentChallenge, shuffledOptions],
  );

  const voiceItems = useMemo(() => {
    if (!voiceReady || !currentChallenge) return [];
    return [{
      answer: currentChallenge.answer.trim().toLowerCase(),
      options: shuffledOptions.map((o) => o.word.trim().toLowerCase()),
    }];
  }, [voiceReady, currentChallenge, shuffledOptions]);

  const tutorQuiet = !isAIResponding && !isAudioPlaying;
  const voiceActive =
    hasStarted && !showSummary && !showResult && tutorQuiet && voiceItems.length > 0;

  const voiceChoice = useVoiceChoice({
    items: voiceItems,
    gradeLevel,
    active: voiceActive,
    onSubmit: (_unit, word) => {
      const idx = shuffledOptions.findIndex((o) => o.word.trim().toLowerCase() === word);
      if (idx !== -1) answerOption(idx, true);
    },
  });

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

    const metrics: StoryTalkMetrics = {
      type: 'story-talk',
      challengeType: data.challengeType,
      totalChallenges: totalCount,
      correctCount,
      attemptsCount: totalAttempts,
      firstTryCount,
      hintsViewed: 0,
      overallAccuracy: overallPct,
      averageAttemptsPerChallenge: totalCount > 0 ? totalAttempts / totalCount : 0,
      voiceAnswerCount: voiceCorrectCountRef.current,
    };

    setSubmittedScore(overallPct);
    submitEvaluation(overallPct >= 60, overallPct, metrics, {
      durationMs: elapsed,
      challengeResults,
    });

    const phaseScoreStr = phaseResults.map(p => `${p.label} ${p.score}%`).join(', ');
    sendText(
      `[ALL_COMPLETE] All ${totalCount} stories done! Scores: ${phaseScoreStr}. Overall ${overallPct}%. `
      + `Short, joyful celebration, then STOP.`,
      { silent: true },
    );
  }, [
    hasSubmittedEvaluation, challengeResults, challenges.length, data.challengeType,
    phaseResults, submitEvaluation, sendText,
  ]);

  const handleNext = useCallback(() => {
    if (!advanceProgress()) {
      submitFinalEvaluation();
      setShowSummary(true);
    }
  }, [advanceProgress, submitFinalEvaluation]);

  // ── Per-challenge reset (PRD §5 rule 8) ────────────────────────
  useEffect(() => {
    setSelectedIndex(null);
    setShowResult(false);
    setFeedback('');
    setFeedbackType('');
    setIsShaking(false);
    recordedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge?.id]);

  // ============================================================================
  // Render
  // ============================================================================

  if (challenges.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No stories available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const elapsedMs = Date.now() - startTimeRef.current;
  const modeMeta = MODE_META[currentChallenge?.type ?? 'who_what_where'];

  // ── Start screen ───────────────────────────────────────────────
  if (!hasStarted) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-8 flex flex-col items-center text-center space-y-5">
          <div className="text-5xl">{'📖'}</div>
          <LuminaCardTitle className="text-xl">{title}</LuminaCardTitle>
          <LuminaBadge className="text-xs">Listen &amp; Tell</LuminaBadge>
          <p className="text-slate-400 text-sm max-w-sm">
            {data.description || 'Listen to a little story, then tap the picture that answers the question!'}
            {' '}{challenges.length} stories.
          </p>
          <LuminaButton
            tone="primary"
            onClick={() => {
              startTimeRef.current = Date.now();
              setHasStarted(true);
            }}
            className="px-8 py-3 text-lg"
          >
            {'👂'} Start Listening
          </LuminaButton>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  // The story text contains the answer verbatim → it stays HIDDEN while the
  // child is answering (audio-only listening, the answer-leak gate). It surfaces
  // only after the answer (reinforcement) OR as a fallback when there is no live
  // tutor to read it aloud.
  const showStoryText = Boolean(currentChallenge) && (showResult || !isConnected);

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!showSummary && (
            <LuminaBadge accent={modeMeta.accent} className="text-xs">
              {modeMeta.icon} {modeMeta.badge}
            </LuminaBadge>
          )}
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
            {/* Story delivery — a "listening" card. Text hidden while answering. */}
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 px-8 py-6 text-center max-w-md w-full">
                <div className="text-xs uppercase tracking-wide text-emerald-300/80 font-mono mb-1">
                  {currentChallenge.storyTitle}
                </div>
                {showStoryText ? (
                  <p className="text-base text-slate-100 leading-relaxed mt-2">
                    {currentChallenge.story}
                  </p>
                ) : (
                  <div className="mt-1 flex justify-center" aria-hidden>
                    <LuminaReadAloudGlyph size={48} speaking />
                  </div>
                )}
              </div>
              {isConnected && !showResult && (
                <LuminaButton
                  tone="ghost"
                  onClick={replayStory}
                  className="text-sm"
                >
                  {'🔁'} Hear it again
                </LuminaButton>
              )}
            </div>

            {/* The question */}
            <p className="text-center text-lg text-slate-200 font-semibold">
              {currentChallenge.question}
            </p>

            {/* Picture options — emoji-primary so this stays a listening task */}
            <div className={`grid grid-cols-2 gap-3 ${isShaking ? 'animate-shake' : ''}`}>
              {shuffledOptions.map((option, idx) => {
                const isCorrectOption = showResult && option.word === currentChallenge.answer;
                const isWrongSelected = showResult && selectedIndex === idx && !isCorrectOption;
                const state = isCorrectOption ? 'correct' : isWrongSelected ? 'incorrect' : 'idle';
                return (
                  <button
                    key={`${currentChallenge.id}-${idx}`}
                    onClick={() => !showResult && handleOptionTap(idx)}
                    disabled={showResult}
                    className={`
                      rounded-xl border-2 p-4 flex flex-col items-center gap-1.5
                      transition-all duration-200 cursor-pointer
                      ${answerStateClass(state)}
                      ${isCorrectOption ? 'ring-2 ring-emerald-400/40' : ''}
                    `}
                  >
                    <span className="text-5xl">{option.emoji}</span>
                    {/* Word caption stays subtle — the picture is the answer for a pre-reader */}
                    <span className="text-xs font-semibold text-slate-400">{option.word}</span>
                  </button>
                );
              })}
            </div>

            {/* Voice: say the answer word instead of tapping. The orb is HIDDEN
                entirely while the tutor is reading — the story contains the
                answer, so there must be no mic (not even a dormant tappable
                one) until the tutor is fully quiet. */}
            {voiceReady && !showResult && tutorQuiet && (
              <div className="flex flex-col items-center">
                <LuminaMicListener
                  state={voiceChoice.voice.state}
                  level={voiceChoice.voice.level}
                  isSupported={voiceChoice.voice.isSupported}
                  dormant={voiceChoice.voice.dormant}
                  onStart={voiceChoice.voice.start}
                  onCancel={voiceChoice.voice.stop}
                  accent={modeMeta.accent}
                  size="sm"
                  idleLabel="Say your answer"
                  listeningLabel="Say the answer!"
                />
                {voiceChoice.note && (
                  <p className="text-amber-300 text-sm mt-2 text-center">{voiceChoice.note}</p>
                )}
              </div>
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

        {showResult && !showSummary && (
          <div className="flex justify-center">
            <LuminaActionButton action="next" onClick={handleNext}>
              {currentIndex < challenges.length - 1 ? 'Next Story' : 'Finish'}
            </LuminaActionButton>
          </div>
        )}

        {showSummary && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedScore ?? undefined}
            durationMs={elapsedMs}
            heading="Story Time Complete!"
            celebrationMessage="Great listening — you told me all the answers!"
            className="mb-6"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default StoryTalk;
