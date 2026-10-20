'use client';

/**
 * fast-fact: an untimed drill of closed-choice fact questions in any subject. Taught only on the shared tutor/JEV
 * workspace (`withWorkspaceOnly`; its wiring is `fastFact.card.ts` + `fastFact.boss.ts`): a tap commits a checked
 * gesture with a named miss (`fastFactMiss`), a choice said aloud is judged by the tutor, and the runtime moves on.
 * No clock: nothing is timed, shown or published about speed (user ruling: no timer on fact fluency). The levers are
 * one lever set in `fastFactLevers.ts`.
 */

import React, { useState, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaAnswerChoice,
  type AnswerChoiceState,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { FastFactMetrics } from '../../../evaluation/types';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { describeFactWork, fastFactMiss, isAnswerCorrect, workspaceScene, type FastFactView } from './fastFactWorkspace';
import { DROP_LEVER, FAST_FACT_LEVERS, MODEL_LEVER, NO_LEVERS, SPREAD_LEVER, countModel, farChoice, pictureRun,
  type CountModel, type FastFactLeverState } from './fastFactLevers';
import { fastFactBoss } from './fastFact.boss';

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

  /** Legacy generator field (seconds). Nothing reads it: the drill is untimed in every sense. */
  targetResponseTime: number;
  /** Phase display config keyed by challenge.type. */
  phaseConfig: Record<string, { label: string; icon: string; accentColor: string }>;

  showStreakCounter: boolean;
  showAccuracy: boolean;
  /** Legacy generator field; the workspace owns retries, so nothing reads it. */
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
// Component
// ============================================================================

const useFastFactProgress = useWorkspaceProgressFor('fast-fact');

const FastFactSurface = ({ data, className, runtimePlanItemId }: FastFactProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    subject,
    challenges = [],
    phaseConfig = {},
    showStreakCounter = true,
    showAccuracy = true,
    gradeBand,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // -------------------------------------------------------------------------
  // Challenge progress: the runtime moves the index.
  // -------------------------------------------------------------------------
  const stableInstanceIdRef = useRef(instanceId || `fast-fact-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  // Bound below, once the setters and the evaluation exist.
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  /** Bound below: records a challenge the learner answered aloud and the tutor's feedback credited. */
  const solvedAloud = useRef<(index: number) => void>(() => {});
  const progress = useFastFactProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: fastFactBoss.assignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: result => finish.current(result),
    onSolved: index => solvedAloud.current(index),
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
  } = progress;
  /** A checked answer stays closed until Try again or Next challenge on the shell. */
  const learnerBlocked = useRef(false);
  learnerBlocked.current = progress.canAttempt === false;
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
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');

  /** In-item levers (`fastFactLevers.ts`), keyed by the challenge they belong to; a new challenge starts from none.
   *  Try again keeps them: the help stays on screen for the next answer. */
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

  // Streak and accuracy, never speed.
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);

  const currentChallenge = useMemo(() => challenges[currentChallengeIndex] || null, [challenges, currentChallengeIndex]);

  /** True once the current challenge is credited. */
  const isCurrentChallengeComplete = challengeResults.some(r => r.challengeId === currentChallenge?.id);

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
  } = usePrimitiveEvaluation<FastFactMetrics>({
    primitiveType: 'fast-fact',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 100;

  // A fresh challenge and Try again both open with no choice tapped and no feedback. A retry counts the wrong try,
  // spoken or tapped, so `drop_far_choice` never leaves the answer alone.
  openItem.current = (_index, retry) => {
    setSelectedAnswer(null);
    setFeedback('');
    setFeedbackType('');
    if (retry && currentChallenge) updateLevers(currentChallenge.id, s => ({ wrongs: (s.wrongs ?? 0) + 1 }));
  };

  // -------------------------------------------------------------------------
  // Answer handling
  // -------------------------------------------------------------------------
  const tappedCorrect = useRef<string | null>(null);
  const processAnswer = useCallback((answer: string) => {
    if (!currentChallenge || isCurrentChallengeComplete) return;
    const correct = isAnswerCorrect(answer, currentChallenge);
    const view: FastFactView = { picked: answer };
    setTotalAnswered(prev => prev + 1);

    if (correct) {
      tappedCorrect.current = currentChallenge.id;
      SoundManager.playCorrect();
      setTotalCorrect(prev => prev + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);
      setFeedback('Correct!');
      setFeedbackType('success');
    } else {
      SoundManager.playIncorrect();
      setStreak(0);
      setFeedback('Not quite.');
      setFeedbackType('error');
      // A tried choice: `drop_far_choice` never greys out one the learner already tapped.
      const id = currentChallenge.id;
      setLeverState(prev => {
        const base = prev.item === id ? prev : { item: id, ...NO_LEVERS };
        return base.picked.includes(answer) ? base : { ...base, picked: [...base.picked, answer] };
      });
    }
    // The checked gesture: counts the attempt and records a correct result.
    commitCheck.current(describeFactWork(currentChallenge, view), correct,
      correct ? undefined : fastFactMiss(currentChallenge, view));
  }, [currentChallenge, isCurrentChallengeComplete, streak, bestStreak]);

  // A spoken answer the observer credited (`onSolved` fires once per challenge, for a tap too): the books a correct
  // tap keeps, with the matching choice shown as picked. The shared lifecycle plays the success sound.
  solvedAloud.current = (index) => {
    const solved = challenges[index];
    if (!solved || tappedCorrect.current === solved.id) return;
    const newStreak = streak + 1;
    setTotalAnswered(prev => prev + 1);
    setTotalCorrect(prev => prev + 1);
    setStreak(newStreak);
    if (newStreak > bestStreak) setBestStreak(newStreak);
    setSelectedAnswer(solved.options.find(o => isAnswerCorrect(o, solved)) ?? null);
    setFeedback('Correct!');
    setFeedbackType('success');
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
  };

  const handleSelectOption = useCallback((value: string) => {
    if (isCurrentChallengeComplete || allChallengesComplete || learnerBlocked.current) return;
    setSelectedAnswer(value);
    processAnswer(value);
  }, [isCurrentChallengeComplete, allChallengesComplete, processAnswer]);

  // Under a lesson's evaluation provider only: the scored session, whose item scores count corrections and whose
  // evidence carries each wrong answer's named miss (`diagnosisEvidence.phases`). No timing is measured or claimed.
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

  // What the tutor and the observer are shown, republished every render. The levers are the lever set's
  // (`FAST_FACT_LEVERS`); which ones an item offers follows from what it carries.
  useLayoutEffect(() => {
    if (!currentChallenge) return;
    const scene = workspaceScene(currentChallenge, { picked: selectedAnswer });
    const s = leversFor(currentChallenge.id);
    const leverCtx = { state: s };
    const levers = FAST_FACT_LEVERS.declare(currentChallenge, leverCtx, s.pulled);
    workspace.current = {
      ...leverScene(scene, { support: '', onScreen: FAST_FACT_LEVERS.onScreen(currentChallenge, leverCtx, s.pulled) }),
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
  const choicesClosed = isCurrentChallengeComplete || allChallengesComplete || progress.canAttempt === false;
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
          const state: AnswerChoiceState = selectedAnswer === opt ? 'selected' : 'idle';
          return (
            <LuminaAnswerChoice
              key={opt}
              state={state}
              className={`${glyphOnly ? 'min-w-20 h-20 text-4xl px-5' : 'min-w-16 h-14 text-lg px-6'} w-auto font-bold text-center flex items-center justify-center ${
                dropped ? 'opacity-30 line-through' : ''}`}
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
        {/* Progress & Stats Bar */}
        {challenges.length > 0 && !allChallengesComplete && (
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
        {currentChallenge && !allChallengesComplete && currentChallenge.prompt.subtext && (
          <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
            <p className="text-slate-200 text-sm font-medium">
              {currentChallenge.prompt.subtext}
            </p>
          </div>
        )}

        {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the fact and its choices as its region. */}
        {currentChallenge && !allChallengesComplete && (
          <>
            <PipDock />
            <PipWorkspace className="relative">
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
            </PipWorkspace>
          </>
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
            overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localOverallScore)}
            /* No duration: the drill is untimed in every sense, the summary included. */
            heading="Fact Fluency Complete!"
            celebrationMessage={`You completed ${challenges.length} challenges! Best streak: ${bestStreak} in a row!`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

const FastFact = withWorkspaceOnly<FastFactProps>('fast-fact', FastFactSurface, props => props.data.title);

export default FastFact;
