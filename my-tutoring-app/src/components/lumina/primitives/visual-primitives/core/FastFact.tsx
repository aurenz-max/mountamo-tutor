'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaButton,
  LuminaAnswerChoice,
  type AnswerChoiceState,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { FastFactMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { describeFactWork, fastFactMiss, isAnswerCorrect, workspaceAssignment, workspaceScene, type FastFactView }
  from './fastFactWorkspace';
import { DROP_LEVER, MODEL_LEVER, NO_LEVERS, SPREAD_LEVER, countModel, farChoice, fastFactLevers, leversOnScreen, pictureRun,
  type CountModel, type FastFactLeverState } from './fastFactLevers';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

/** Visual element attached to a challenge prompt. */
export interface FastFactVisual {
  type: 'emoji' | 'image' | 'text-large';
  emoji?: string;
  imageUrl?: string;
  largeText?: string;
  alt?: string;
}

/** A single drill challenge. */
export interface FastFactChallenge {
  id: string;
  /** Phase grouping key — drives PhaseSummaryPanel (e.g. 'recall', 'match', 'speed-round'). */
  type: string;
  /** Stable eval-mode task identity; intentionally independent of the phase key. */
  challengeType: 'recognize' | 'recall' | 'apply';
  prompt: {
    /** Primary question or stimulus text shown large. */
    text: string;
    /** Optional instruction shown above the question. */
    subtext?: string;
    /** Optional rich visual (emoji, large text, image). */
    visual?: FastFactVisual;
  };
  /** Canonical correct answer (always string). */
  correctAnswer: string;
  /** Additional accepted answers (case-insensitive). */
  acceptableAnswers?: string[];
  /** How the student responds (always 'choice' — free-form deprecated). */
  responseMode: 'choice';
  /** Answer options (required — always multiple choice). */
  options: string[];
  /** Brief explanation shown after the correct answer is revealed. */
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

/** Top-level data contract for the FastFact primitive. */
export interface FastFactData {
  title: string;
  description?: string;
  /** Subject area inferred from the learning objective. */
  subject: string;
  challenges: FastFactChallenge[];

  /**
   * Seconds — answers within this threshold count as "fast". Used ONLY as a
   * silent automaticity signal for analytics/IRT. Never surfaced to the student
   * and never enforced as a deadline.
   */
  targetResponseTime: number;
  /** Phase display config keyed by challenge.type. */
  phaseConfig: Record<string, { label: string; icon: string; accentColor: string }>;

  showStreakCounter: boolean;
  showAccuracy: boolean;
  /** Max wrong answers before recording incorrect and advancing (scripted path only; the workspace owns retries). */
  maxAttemptsPerChallenge: number;
  gradeBand?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<FastFactMetrics>) => void;
}

// ============================================================================
// Visual Renderer
// ============================================================================

/** The generator's alt text states a counting picture's count ("3 yellow stars"); the label keeps only what is drawn. */
const COUNT_WORD = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b\s*/gi;
const uncountedAlt = (alt?: string) => alt?.replace(COUNT_WORD, '').trim() || undefined;

function VisualRenderer({ visual }: { visual: FastFactVisual }) {
  switch (visual.type) {
    case 'emoji':
      return (
        <div className="text-5xl text-center select-none" role="img" aria-label={uncountedAlt(visual.alt)}>
          {visual.emoji}
        </div>
      );
    case 'text-large':
      return (
        <div className="text-5xl font-bold text-center text-slate-100 font-mono tracking-wider select-none">
          {visual.largeText}
        </div>
      );
    case 'image':
      return visual.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={visual.imageUrl}
          alt={visual.alt || ''}
          className="max-h-32 mx-auto rounded-lg object-contain"
        />
      ) : null;
    default:
      return null;
  }
}

/** The count_model lever: a sum as two groups in two colors, a difference with the taken dots hollow, a product as rows. */
function DotModel({ model }: { model: CountModel }) {
  const dot = (key: string, cls: string) => <span key={key} className={`inline-block h-4 w-4 rounded-full ${cls}`} />;
  const filled = 'bg-sky-400', other = 'bg-amber-400', hollow = 'border-2 border-slate-400 bg-transparent';
  const row = (n: number, cls: string, key: string, from = 0) =>
    <div key={key} className="flex flex-wrap gap-1.5">{Array.from({ length: n }, (_, i) => dot(`${key}-${i + from}`, cls))}</div>;
  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-6 rounded-xl border border-white/10 bg-slate-800/20 p-3"
      data-lever="count-model" aria-hidden>
      {model.kind === 'sum' && (<>{row(model.a, filled, 'a')}{row(model.b, other, 'b')}</>)}
      {model.kind === 'difference' && (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: model.a }, (_, i) => dot(`d-${i}`, i >= model.a - model.b ? hollow : filled))}
        </div>
      )}
      {model.kind === 'product' && (
        <div className="space-y-1.5">{Array.from({ length: model.a }, (_, r) => row(model.b, filled, `r${r}`))}</div>
      )}
    </div>
  );
}

// ============================================================================
// Props
// ============================================================================

interface FastFactProps {
  data: FastFactData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Start screen phases: 'waiting' -> 'playing'
// (No race-start countdown — the drill is untimed and pressure-free.)
// ============================================================================
type GamePhase = 'waiting' | 'playing';

// ============================================================================
// Component
// ============================================================================

const FastFactSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  FastFactProps & { tutorOwned: boolean; useController: (options: ProgressOptions<FastFactChallenge>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    subject,
    challenges = [],
    targetResponseTime = 6,
    phaseConfig = {},
    showStreakCounter = true,
    showAccuracy = true,
    maxAttemptsPerChallenge = 2,
    gradeBand,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // -------------------------------------------------------------------------
  // Challenge progress. On the workspace path the runtime moves the index.
  // -------------------------------------------------------------------------
  const stableInstanceIdRef = useRef(instanceId || `fast-fact-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  // Bound below, once the setters and the evaluation exist.
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: result => finish.current(result),
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    advance: advanceProgress,
  } = progress;
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const workspaceClosed = useRef(false);
  workspaceClosed.current = tutorOwned && progress.canAttempt === false;
  const learnerBlocked = () => workspaceClosed.current;
  // The activity's own check is the workspace's checked gesture. A ref, so the answer callback keeps its deps.
  const commitCheck = useRef(progress.commitCheck);
  commitCheck.current = progress.commitCheck;

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: phaseConfig as Record<string, PhaseConfig>,
  });

  // -------------------------------------------------------------------------
  // Local state
  // -------------------------------------------------------------------------
  // With the tutor there is no Start screen: the tutor opens the drill and reads the first question.
  const [gamePhase, setGamePhase] = useState<GamePhase>(tutorOwned ? 'playing' : 'waiting');
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);

  /** In-item levers (`fastFactLevers.ts`), keyed by the challenge they belong to; a new challenge starts from none.
   *  Try again keeps them: the help stays on screen for the next tap. Workspace path only. */
  const [leverState, setLeverState] = useState<{ item: string } & FastFactLeverState>({ item: '', ...NO_LEVERS });
  const leversFor = (id: string | undefined): FastFactLeverState => (id && leverState.item === id ? leverState : NO_LEVERS);
  const updateLevers = (id: string, change: (s: FastFactLeverState) => Partial<FastFactLeverState>) =>
    setLeverState(prev => { const base = prev.item === id ? prev : { item: id, ...NO_LEVERS }; return { ...base, ...change(base) }; });
  /** spread_pictures: the boxes the learner touched to mark counted, keyed by item. Never published: it is their count. */
  const [marked, setMarked] = useState<{ item: string; boxes: readonly number[] }>({ item: '', boxes: [] });
  const toggleMark = (itemId: string, box: number) => setMarked(prev => {
    const boxes = prev.item === itemId ? prev.boxes : [];
    return { item: itemId, boxes: boxes.includes(box) ? boxes.filter(b => b !== box) : [...boxes, box] };
  });

  // Response timing — measured SILENTLY for the automaticity metric. There is no
  // countdown and no deadline; the student never sees a clock.
  const [challengeStartTime, setChallengeStartTime] = useState(0);

  // Streak tracking
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [responseTimes, setResponseTimes] = useState<number[]>([]);

  // -------------------------------------------------------------------------
  // Start button — begin the drill (no race countdown)
  // -------------------------------------------------------------------------
  const handleStart = useCallback(() => {
    SoundManager.tap();        // ← tactile press to begin
    setGamePhase('playing');
  }, []);

  // -------------------------------------------------------------------------
  // Current challenge
  // -------------------------------------------------------------------------
  const currentChallenge = useMemo(() => {
    return challenges[currentChallengeIndex] || null;
  }, [challenges, currentChallengeIndex]);

  /** True once a result (correct or incorrect after max attempts) has been recorded. */
  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id
  );

  // -------------------------------------------------------------------------
  // Start the (silent) response-time clock when a new challenge appears.
  // No interval, no countdown — just a start timestamp for analytics.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (gamePhase === 'playing' && currentChallenge && !allChallengesComplete && !isCurrentChallengeComplete) {
      setChallengeStartTime(Date.now());
    }
  }, [gamePhase, currentChallengeIndex, currentChallenge, allChallengesComplete, isCurrentChallengeComplete]);

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<FastFactMetrics>({
    primitiveType: 'fast-fact',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring Integration
  // -------------------------------------------------------------------------
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 100;
  const averageTime = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;

  const aiPrimitiveData = useMemo(() => ({
    subject,
    challengeType: currentChallenge?.challengeType ?? '',
    promptText: currentChallenge?.prompt.text ?? '',
    correctAnswer: currentChallenge?.correctAnswer ?? '',
    responseMode: 'choice',
    difficulty: currentChallenge?.difficulty ?? 'easy',
    attemptNumber: currentAttempts + 1,
    streak,
    accuracy,
    averageTime,
    totalChallenges: challenges.length,
    currentIndex: currentChallengeIndex,
    gradeBand: gradeBand ?? '',
    targetResponseTime,
  }), [
    subject, currentChallenge, currentAttempts, streak, accuracy, averageTime,
    challenges.length, currentChallengeIndex, gradeBand, targetResponseTime,
  ]);

  // Its context carries the answer, so it is off on the workspace path, and its scripted cues send nothing there.
  const { sendText: sendLegacyText, isConnected, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'fast-fact',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand ?? 'Elementary',
    enabled: !tutorOwned,
  });
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of this challenge's check state, the tutor's speech on it, and
  // the child's touches; Pip points only at the workspace as a whole and never
  // chooses, checks, or advances.
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: allChallengesComplete || hasSubmittedEvaluation ? null : currentChallenge?.id ?? null,
    label: 'The fact and its choices',
    solved: challengeResults.some((r) => r.challengeId === currentChallenge?.id && r.correct),
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
    running: gamePhase === 'playing',
  });

  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Fact fluency drill. Subject: ${subject}. `
      + `${challenges.length} challenges. Grade: ${gradeBand ?? 'General'}. `
      + `First challenge: "${currentChallenge?.prompt.text}" (${currentChallenge?.type}). `
      + `This drill is untimed — there is NO timer and no time pressure. `
      + `Introduce warmly and reassure the student they can take all the time they need.`,
      { silent: true }
    );
  }, [isConnected, challenges.length, subject, gradeBand, currentChallenge, sendText]);

  // Workspace path: a fresh challenge and Try again both open with no choice tapped and no feedback.
  openItem.current = () => {
    setSelectedAnswer(null);
    setFeedback('');
    setFeedbackType('');
    setShowCorrectAnswer(false);
    setChallengeStartTime(Date.now());
  };

  // -------------------------------------------------------------------------
  // Answer handling
  // -------------------------------------------------------------------------
  const processAnswer = useCallback((answer: string) => {
    if (!currentChallenge || isCurrentChallengeComplete) return;

    const responseTime = Date.now() - challengeStartTime;
    const responseTimeSec = responseTime / 1000;
    const correct = isAnswerCorrect(answer, currentChallenge);
    const view: FastFactView = { picked: answer };
    const finalMiss = !tutorOwned && currentAttempts + 1 >= maxAttemptsPerChallenge;

    setTotalAnswered(prev => prev + 1);
    setResponseTimes(prev => [...prev, responseTimeSec]);

    if (correct) {
      SoundManager.playCorrect();   // ← immediate per-challenge feedback
      setTotalCorrect(prev => prev + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);
      setFeedback('Correct!');
      setFeedbackType('success');

      // Scripted path: the primitive's own fields. isFast is a SILENT automaticity signal for the metric —
      // never surfaced as speed praise. The workspace path's record is the scored session (`finish`).
      if (!tutorOwned) {
        recordResult({
          challengeId: currentChallenge.id,
          correct: true,
          attempts: currentAttempts + 1,
          timeMs: responseTime,
          responseTimeSec,
          isFast: responseTimeSec <= targetResponseTime,
          streak: newStreak,
        });
      }

      if (isConnected) {
        sendText(
          `[ANSWER_CORRECT] Student answered "${answer}" correctly for "${currentChallenge.prompt.text}". `
          + `Streak: ${newStreak}. `
          + `Affirm warmly without mentioning speed.`,
          { silent: true }
        );
      }
    } else {
      SoundManager.playIncorrect();
      setStreak(0);
      setFeedbackType('error');
      // A tried choice: `drop_far_choice` never greys out one the learner already tapped, nor leaves the answer alone.
      if (tutorOwned) {
        const id = currentChallenge.id;
        setLeverState(prev => {
          const base = prev.item === id ? prev : { item: id, ...NO_LEVERS };
          return base.picked.includes(answer) ? base : { ...base, picked: [...base.picked, answer] };
        });
      }
      // The answer is shown only once the scripted drill gives up on the challenge; never on a try that continues.
      if (finalMiss) {
        setShowCorrectAnswer(true);
        setFeedback(`Not quite. The answer is ${currentChallenge.correctAnswer}.`
          + (currentChallenge.explanation ? ` ${currentChallenge.explanation}` : ''));
        recordResult({
          challengeId: currentChallenge.id,
          correct: false,
          attempts: currentAttempts + 1,
          timeMs: responseTime,
          responseTimeSec,
          isFast: false,
          streak: 0,
        });
      } else {
        setFeedback(tutorOwned ? 'Not quite.' : 'Not quite. Try again.');
        if (!tutorOwned) {
          // More attempts available — clear selection and reset the silent clock.
          setSelectedAnswer(null);
          setChallengeStartTime(Date.now());
        }
      }

      if (isConnected) {
        sendText(
          `[ANSWER_INCORRECT] Student answered "${answer}" for "${currentChallenge.prompt.text}". `
          + `Correct answer: "${currentChallenge.correctAnswer}". `
          + `Attempt ${currentAttempts + 1} of ${maxAttemptsPerChallenge}. `
          + `${finalMiss
            ? 'Show the correct answer and encourage. Never punish wrong answers.'
            : 'Give a brief hint and let them try again, with no rush.'}`,
          { silent: true }
        );
      }
    }
    // Counts the attempt and records a correct result on both paths; on the workspace path it is the checked gesture.
    commitCheck.current(describeFactWork(currentChallenge, view), correct,
      correct ? undefined : fastFactMiss(currentChallenge, view));
  }, [
    currentChallenge, isCurrentChallengeComplete, challengeStartTime, streak, bestStreak,
    targetResponseTime, currentAttempts, maxAttemptsPerChallenge, tutorOwned,
    isConnected, sendText, recordResult,
  ]);

  const handleSelectOption = useCallback((value: string) => {
    if (isCurrentChallengeComplete || allChallengesComplete || learnerBlocked()) return;
    setSelectedAnswer(value);
    processAnswer(value);
  }, [isCurrentChallengeComplete, allChallengesComplete, processAnswer]);

  // -------------------------------------------------------------------------
  // Challenge Navigation
  // -------------------------------------------------------------------------
  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All complete — submit evaluation
      const phaseScoreStr = phaseResults
        .map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = challenges.length > 0
        ? Math.round((challengeResults.filter(r => r.correct).length / challenges.length) * 100) : 0;

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Best streak: ${bestStreak}. `
        + `Give encouraging phase-specific feedback. Celebrate accuracy and growing confidence — not speed.`,
        { silent: true }
      );

      // The workspace path submits the scored session from `onFinished` (below), not this tally.
      if (!hasSubmittedEvaluation && !tutorOwned) {
        const correctCount = challengeResults.filter(r => r.correct).length;
        const score = Math.round((correctCount / challenges.length) * 100);
        const fastCount = challengeResults.filter(r => (r.isFast as boolean)).length;
        const avgResponseTime = responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;

        const metrics: FastFactMetrics = {
          type: 'fast-fact',
          subject,
          accuracy: score,
          averageResponseTime: Math.round(avgResponseTime * 1000),
          fastAnswerCount: fastCount,
          bestStreak,
          attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
          challengesTotal: challenges.length,
          challengesCorrect: correctCount,
        };

        submitEvaluation(
          correctCount === challenges.length,
          score,
          metrics,
          { challengeResults }
        );
      }
      return;
    }

    // Reset local state for next challenge
    setSelectedAnswer(null);
    setFeedback('');
    setFeedbackType('');
    setShowCorrectAnswer(false);

    const nextChallenge = challenges[currentChallengeIndex + 1];
    if (nextChallenge && isConnected) {
      sendText(
        `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
        + `"${nextChallenge.prompt.text}" (${nextChallenge.type}). Introduce it briefly.`,
        { silent: true }
      );
    }
  }, [
    advanceProgress, phaseResults, challenges, challengeResults, responseTimes,
    bestStreak, subject, sendText, hasSubmittedEvaluation, submitEvaluation,
    currentChallengeIndex, isConnected, tutorOwned,
  ]);

  // Workspace path, under a lesson's evaluation provider only: the scored session, whose item scores count
  // corrections and whose evidence carries each wrong tap's named miss (`diagnosisEvidence.phases`). No timing:
  // with the tutor the drill is untimed in every sense, so no fast-answer count is claimed.
  finish.current = (result) => {
    if (hasSubmittedEvaluation) return;
    const metrics: FastFactMetrics = {
      type: 'fast-fact',
      subject,
      accuracy: result.accuracy,
      averageResponseTime: 0,
      fastAnswerCount: 0,
      bestStreak,
      attemptsCount: result.attemptsCount,
      challengesTotal: challenges.length,
      challengesCorrect: result.solvedCount,
    };
    submitEvaluation(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // Auto-hide correct answer display
  useEffect(() => {
    if (showCorrectAnswer && isCurrentChallengeComplete) {
      const timer = setTimeout(() => setShowCorrectAnswer(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [showCorrectAnswer, isCurrentChallengeComplete]);

  // Auto-submit evaluation when all challenges are done
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      advanceToNextChallenge();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, advanceToNextChallenge]);

  // Workspace path: what the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  // Every mode declares levers (`fastFactLevers.ts`); which ones an item offers follows from what it carries.
  useLayoutEffect(() => {
    if (!tutorOwned || !currentChallenge) return;
    const scene = workspaceScene(currentChallenge, { picked: selectedAnswer });
    const s = leversFor(currentChallenge.id);
    const levers = fastFactLevers(currentChallenge, s);
    const onScreen = leversOnScreen(currentChallenge, s);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}) },
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        if (id === DROP_LEVER) {
          const drop = farChoice(currentChallenge, s);
          if (!drop) return 'No choice can be greyed out: too few untried choices would remain.';
          updateLevers(currentChallenge.id, prev => ({ pulled: [...prev.pulled, id], dropped: [...prev.dropped, drop] }));
          return true;
        }
        updateLevers(currentChallenge.id, prev => ({ pulled: [...prev.pulled, id] }));
        return true;
      },
    };
  });

  // -------------------------------------------------------------------------
  // Overall Score
  // -------------------------------------------------------------------------
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    const correct = challengeResults.filter(r => r.correct).length;
    return Math.round((correct / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  const choicesClosed = isCurrentChallengeComplete || allChallengesComplete || (tutorOwned && progress.canAttempt === false);
  const currentLevers = leversFor(currentChallenge?.id);
  const run = currentChallenge && currentLevers.pulled.includes(SPREAD_LEVER) ? pictureRun(currentChallenge) : null;
  const model = currentChallenge && currentLevers.pulled.includes(MODEL_LEVER) ? countModel(currentChallenge) : null;
  const renderChoiceButtons = (options: string[]) => {
    // Picture buttons (the pre-reader answer surface the generator emits below
    // Grade 1 — reader-fit PRE 2026-09-05): when no option carries a letter or
    // digit, render them large so an emoji reads as a picture, not a glyph.
    const glyphOnly = options.length > 0 && options.every((o) => !/[A-Za-z0-9À-ɏ]/.test(o));
    return (
    <div className="flex flex-wrap justify-center gap-3">
      {options.map((opt) => {
        // drop_far_choice: greyed out and closed, never the answer; it keeps its text so the menu reads the same.
        const dropped = currentLevers.dropped.includes(opt);
        const isSelected = selectedAnswer === opt;
        const isCorrectOption = currentChallenge && isAnswerCorrect(opt, currentChallenge);
        const showAsCorrect = showCorrectAnswer && isCorrectOption;
        const showAsWrong = showCorrectAnswer && isSelected && !isCorrectOption;

        const state: AnswerChoiceState = showAsCorrect
          ? 'correct'
          : showAsWrong
            ? 'incorrect'
            : isSelected
              ? 'selected'
              : 'idle';

        return (
          <LuminaAnswerChoice
            key={opt}
            state={state}
            className={`${glyphOnly ? 'min-w-20 h-20 text-4xl px-5' : 'min-w-16 h-14 text-lg px-6'} w-auto font-bold text-center flex items-center justify-center ${
              showAsCorrect ? 'scale-110' : showAsWrong ? 'animate-pulse' : ''
            } ${dropped ? 'opacity-30 line-through' : ''}`}
            onClick={() => { if (!dropped) handleSelectOption(opt); }}
            disabled={choicesClosed || dropped}
            data-dropped={dropped || undefined}
            data-lever={dropped ? 'drop-far-choice' : undefined}
          >
            {opt}
          </LuminaAnswerChoice>
        );
      })}
    </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <LuminaCard className={`shadow-2xl ${className || ''}`}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            {gradeBand && (
              <LuminaBadge accent="blue" className="text-xs">
                {gradeBand}
              </LuminaBadge>
            )}
            <LuminaBadge accent="amber" className="text-xs">
              {subject}
            </LuminaBadge>
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Waiting — Start Button Screen */}
        {gamePhase === 'waiting' && challenges.length > 0 && (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="text-4xl font-bold text-slate-100 tracking-tight">
              Ready to practice?
            </div>
            <p className="text-slate-400 text-sm">
              {challenges.length} challenges &middot; {subject}
            </p>
            <LuminaButton
              tone="primary"
              className="h-14 px-10 text-lg font-bold hover:scale-105"
              onClick={handleStart}
            >
              Start
            </LuminaButton>
            <p className="text-slate-600 text-xs">
              Take your time and do your best!
            </p>
          </div>
        )}

        {/* Progress & Stats Bar */}
        {gamePhase === 'playing' && challenges.length > 0 && !allChallengesComplete && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <span className="text-slate-500">
                {currentChallengeIndex + 1} / {challenges.length}
              </span>
              {currentChallenge && phaseConfig[currentChallenge.type] && (
                <LuminaBadge className="text-xs">
                  {phaseConfig[currentChallenge.type].icon}{' '}
                  {phaseConfig[currentChallenge.type].label}
                </LuminaBadge>
              )}
            </div>
            <div className="flex items-center gap-3">
              {showStreakCounter && streak >= 2 && (
                <span className="text-orange-400 font-bold text-sm animate-pulse">
                  {streak} in a row!
                </span>
              )}
              {showAccuracy && accuracy < 100 && totalAnswered > 0 && (
                <span className="text-slate-500 text-xs">{accuracy}% accuracy</span>
              )}
            </div>
          </div>
        )}

        {/* Subtext instruction (if provided) */}
        {gamePhase === 'playing' && currentChallenge && !allChallengesComplete && currentChallenge.prompt.subtext && (
          <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
            <p className="text-slate-200 text-sm font-medium">
              {currentChallenge.prompt.subtext}
            </p>
          </div>
        )}

        {/* Pip's dock sits above the fact and its answer choices, which it
            outlines together as the workspace. */}
        {pip.store && !allChallengesComplete && <div {...pip.dock} />}

        {/* Main Challenge Area */}
        {gamePhase === 'playing' && currentChallenge && !allChallengesComplete && (
          <div {...pip.workspace} className="relative">
            {/* Visual (if present) */}
            {currentChallenge.prompt.visual && (
              <div className="mb-4 p-4 bg-slate-800/20 rounded-xl border border-white/5">
                <VisualRenderer visual={currentChallenge.prompt.visual} />
              </div>
            )}

            {/* Prompt Text */}
            <div className="text-center py-4">
              <span className="text-3xl font-bold text-slate-100 tracking-wide">
                {currentChallenge.prompt.text}
              </span>
            </div>

            {/* spread_pictures: the picture's glyphs again, apart, one per box; no numbers (spreadLeak). */}
            {run && (
              <div className="flex flex-wrap justify-center gap-3" data-lever="spread-pictures">
                {Array.from({ length: run.count }, (_, box) => {
                  const on = marked.item === currentChallenge.id && marked.boxes.includes(box);
                  return (
                    <button key={box} type="button" data-spread-box={box} data-marked={on || undefined}
                      aria-pressed={on} aria-label={on ? 'counted' : 'not counted yet'}
                      onClick={() => toggleMark(currentChallenge.id, box)}
                      className={`flex h-14 w-14 items-center justify-center rounded-xl border-2 text-3xl transition-all duration-150 ${
                        on ? 'border-amber-300/70 bg-amber-400/20 ring-2 ring-amber-300/40' : 'border-white/15 bg-slate-800/50 hover:border-white/30'}`}
                    >
                      <span aria-hidden>{run.picture}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {/* count_model: the question's numbers as dots; no numerals, never the result as one group (modelLeak). */}
            {model && <DotModel model={model} />}

            {/* Answer Choices (always multiple choice) */}
            <div className="mt-4">
              {renderChoiceButtons(currentChallenge.options)}
            </div>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium transition-all duration-300 ${
            feedbackType === 'success'
              ? 'text-emerald-400'
              : feedbackType === 'error'
                ? 'text-red-400'
                : 'text-slate-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* Next Challenge Button (scripted path; with the tutor the shell offers Next challenge) */}
        {isCurrentChallengeComplete && !allChallengesComplete && !tutorOwned && (
          <div className="flex justify-center">
            <LuminaButton
              tone="primary"
              onClick={advanceToNextChallenge}
            >
              Next Challenge
            </LuminaButton>
          </div>
        )}

        {/* All Complete (fallback if no phase config) */}
        {allChallengesComplete && !phaseResults.length && (
          <div className="text-center py-4">
            <p className="text-emerald-400 text-sm font-medium mb-2">All challenges complete!</p>
            <p className="text-slate-400 text-xs">
              {challengeResults.filter(r => r.correct).length} / {challenges.length} correct
              {bestStreak > 1 && ` | Best streak: ${bestStreak}`}
            </p>
          </div>
        )}

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Fact Fluency Complete!"
            celebrationMessage={`You completed ${challenges.length} challenges! Best streak: ${bestStreak} in a row!`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const FastFact = withWorkspaceController<FastFactProps, ProgressOptions<FastFactChallenge>, Progress>(
  'fast-fact', FastFactSurface, useScriptedProgress, useWorkspaceProgressFor('fast-fact'));

export default FastFact;
