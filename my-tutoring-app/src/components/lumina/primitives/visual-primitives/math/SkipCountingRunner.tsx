'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaButton,
  LuminaBadge,
  LuminaPanel,
  LuminaActionButton,
  LuminaInput,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { SkipCountingRunnerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import {
  INPUT_LABEL, aidsFor, describeSkipWork, fillFits, gapsOf, linePositions, nextLanding, openingSpots, parseJumps,
  skipMatches, skipMiss, workspaceAssignment, workspaceScene, type SkipAids, type SkipLine, type SkipView,
} from './skipCountingWorkspace';
import {
  ARRAY_ROWS, COUNT_TRAIL, DOTS_FACT, HOP_DOTS, JUMP_MARKS, JUMP_SIZES, MODEL_COUNT, PRACTICE_NOTE, RING_GAPS, STEP_ARCS,
  TICK_NUMBERS, countModel, hopDots, leverFact, modelFact, practiceItem, skipLevers, type CountModel, type SkipPractice,
} from './skipCountingLevers';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface SkipCountingChallenge {
  id: string;
  type: 'count_along' | 'predict' | 'fill_missing' | 'find_skip_value' | 'connect_multiplication';
  instruction: string;
  /** fill_missing: the numbers shown as "?" that the learner types (answer-bearing). predict: "?" labels only. */
  hiddenPositions?: number[];
  targetFact?: string | null;
  startPosition?: number;
  hint: string;
  narration: string;
}

export interface SkipCountingRunnerData {
  title: string;
  description?: string;
  skipValue: number;
  startFrom: number;
  endAt: number;
  direction: 'forward' | 'backward';
  character: {
    type: 'frog' | 'kangaroo' | 'rabbit' | 'rocket' | 'custom';
    imagePrompt?: string;
  };
  challenges: SkipCountingChallenge[];
  showOptions?: {
    showArray?: boolean;
    showJumpArcs?: boolean;
    showEquation?: boolean;
    showDigitPattern?: boolean;
    autoPlay?: boolean;
    /** Gate the always-on multiple-number labels under the number-line ticks.
     *  Support lever: at hard tiers (predict / find_skip_value) hiding prior
     *  landing labels forces the student to track the sequence unaided. */
    showTrackLabels?: boolean;
    /** Gate the bottom sequence-chip row AND the "→ ?" next cue. Withdrawing it
     *  removes the running written record of landings the student can read off. */
    showSequenceChips?: boolean;
    /** Gate the "Count by Ns" header badge AND the "+N" in the Jump button label.
     *  Never shown on find_skip_value, where N is the answer (`aidsFor`). */
    showSkipValueBadge?: boolean;
  };
  gameMode?: {
    enabled?: boolean;
    type?: 'catch_the_number' | 'fill_the_gaps' | 'speed_count';
    timeLimit?: number | null;
  };
  gradeBand?: '1-2' | '2-3';
  /** Within-mode support tier persisted from the generator so the live tutor's
   *  reveal policy matches what the on-screen scaffold withholds. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SkipCountingRunnerMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

type Phase = 'watch' | 'jump' | 'predict' | 'connect';

const PHASE_CONFIG: Record<Phase, { label: string; description: string }> = {
  watch: { label: 'Watch', description: 'Watch the character jump' },
  jump: { label: 'Jump', description: 'Tap to make each jump' },
  predict: { label: 'Predict', description: 'Guess the next landing' },
  connect: { label: 'Connect', description: 'Link to multiplication' },
};

const phaseOf = (type: SkipCountingChallenge['type'] | undefined): Phase =>
  type === 'predict' ? 'predict' : type === 'connect_multiplication' ? 'connect' : type === 'count_along' || !type ? 'watch' : 'jump';

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  count_along:             { label: 'Count Along',    icon: '👀', accentColor: 'amber' },
  predict:                 { label: 'Predict',        icon: '🎯', accentColor: 'orange' },
  fill_missing:            { label: 'Fill Missing',   icon: '🧩', accentColor: 'cyan' },
  find_skip_value:         { label: 'Find Skip Value',icon: '🔍', accentColor: 'purple' },
  connect_multiplication:  { label: 'Multiply',       icon: '✖️', accentColor: 'emerald' },
};

const CHARACTER_EMOJI: Record<string, string> = {
  frog: '🐸',
  kangaroo: '🦘',
  rabbit: '🐰',
  rocket: '🚀',
  custom: '⭐',
};

// Number line layout
const NL_PADDING = 40;
const NL_HEIGHT = 160;
const TICK_HEIGHT = 12;
const JUMP_ARC_HEIGHT = 50;
const SVG_WIDTH = 600;

const parseNumber = (text: string): number | null => (/^\s*-?\d+\s*$/.test(text) ? parseInt(text, 10) : null);

// ============================================================================
// Props
// ============================================================================

interface SkipCountingRunnerProps {
  data: SkipCountingRunnerData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Component
// ============================================================================

const SkipCountingRunnerSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  SkipCountingRunnerProps & { tutorOwned: boolean; useController: (options: ProgressOptions<SkipCountingChallenge>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    skipValue,
    startFrom = 0,
    endAt,
    direction = 'forward',
    character = { type: 'frog' as const },
    challenges = [],
    showOptions = {},
    gradeBand = '1-2',
    supportTier,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    showArray = false,
    showDigitPattern = false,
    autoPlay: autoPlayOption = false,
  } = showOptions;
  // On the tutor's workspace nothing moves on its own: the learner makes every jump.
  const autoPlay = autoPlayOption && !tutorOwned;
  const line = useMemo<SkipLine>(() => ({ skipValue, startFrom, endAt, direction }), [skipValue, startFrom, endAt, direction]);

  const stableInstanceIdRef = useRef(instanceId || `skip-counting-runner-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Progress. On the workspace path the runtime moves the index.
  // -------------------------------------------------------------------------
  /** Bound below, once the setters exist; the progress hook calls it only after render. */
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const progress = useController({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    advance: advanceProgress,
  } = progress;
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const blocked = tutorOwned && progress.canAttempt === false;
  const workspaceClosed = useRef(false);
  workspaceClosed.current = blocked;
  const learnerBlocked = () => workspaceClosed.current;

  // In-item levers (`skipCountingLevers.ts`), keyed by the session item they were pulled on, and the easier practice
  // count a simplify lever puts in place of the session item until the observer returns to it.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<SkipPractice | null>(null);
  const sessionChallenge = challenges[currentChallengeIndex] ?? null;
  const currentChallenge = practice?.challenge ?? sessionChallenge;
  const activeLine = practice?.line ?? line;
  const pulledLevers = sessionChallenge && leverState.item === sessionChallenge.id ? leverState.pulled : [];

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [currentPosition, setCurrentPosition] = useState(() => {
    const spots = openingSpots(line, challenges[0]);
    return spots[spots.length - 1];
  });
  const [landingSpots, setLandingSpots] = useState<number[]>(() => openingSpots(line, challenges[0]));
  /** fill_missing: the gaps the learner has filled. */
  const [filled, setFilled] = useState<number[]>([]);
  /** The item (session or practice) whose check came back correct, until another opens. */
  const [solvedId, setSolvedId] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [predictionInput, setPredictionInput] = useState('');
  const [predictedPosition, setPredictedPosition] = useState<number | null>(null);
  const [multiplicationInput, setMultiplicationInput] = useState('');
  const [fillInput, setFillInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');

  // Tracking
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [skipValuesExplored] = useState(new Set<number>([skipValue]));
  const [backwardCountingAttempted] = useState(direction === 'backward');
  const [multiplicationConnectionMade, setMultiplicationConnectionMade] = useState(false);
  const [patternIdentified, setPatternIdentified] = useState(false);

  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The jump's 400ms animation flag and the predict auto-jump (800ms after a correct prediction). Both are cleared
  // whenever an item opens, so a stale timer never moves the next item's character (SCR-1).
  const jumpAnimationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const predictAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingJumpTimers = useCallback(() => {
    if (predictAdvanceTimerRef.current) {
      clearTimeout(predictAdvanceTimerRef.current);
      predictAdvanceTimerRef.current = null;
    }
    if (jumpAnimationTimerRef.current) {
      clearTimeout(jumpAnimationTimerRef.current);
      jumpAnimationTimerRef.current = null;
    }
    setIsAnimating(false);
  }, []);

  useEffect(() => {
    return () => {
      if (predictAdvanceTimerRef.current) clearTimeout(predictAdvanceTimerRef.current);
      if (jumpAnimationTimerRef.current) clearTimeout(jumpAnimationTimerRef.current);
    };
  }, []);

  /** Put an item on screen: its line's opening landings, every input blank. `keepWork` (Try again) keeps the
   *  landings made and the gaps filled, and clears only what was typed. */
  const showChallenge = (ch: SkipCountingChallenge | null, ln: SkipLine, keepWork: boolean) => {
    clearPendingJumpTimers();
    setFeedback(''); setFeedbackType('');
    setPredictionInput(''); setPredictedPosition(null); setMultiplicationInput(''); setFillInput('');
    setSolvedId(null);
    if (keepWork) return;
    const spots = openingSpots(ln, ch);
    setLandingSpots(spots);
    setCurrentPosition(spots[spots.length - 1]);
    setFilled([]);
    setCurrentStreak(0);
  };

  // Workspace path: a fresh item (or the item back after practice) opens blank; Try again keeps the work and any
  // practice item, and clears what was typed.
  openItem.current = (index, retry) => {
    if (retry) { showChallenge(currentChallenge, activeLine, true); return; }
    setPractice(null);
    showChallenge(challenges[index] ?? null, line, false);
  };

  const nextExpectedPosition = nextLanding(activeLine, currentPosition);
  const jumpCount = landingSpots.length - 1;
  const nlMin = Math.min(activeLine.startFrom, activeLine.endAt, 0);
  const nlMax = Math.max(activeLine.startFrom, activeLine.endAt);
  const isPractice = !!practice;
  const isCurrentChallengeComplete = (!!currentChallenge && solvedId === currentChallenge.id)
    || (!practice && challengeResults.some(r => r.challengeId === sessionChallenge?.id && r.correct));
  const currentPhase = phaseOf(currentChallenge?.type);

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<SkipCountingRunnerMetrics>({
    primitiveType: 'skip-counting-runner',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring Integration (scripted path only: its cues carry the answers)
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    skipValue,
    startFrom,
    endAt,
    direction,
    currentPosition,
    jumpCount,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    instruction: currentChallenge?.instruction ?? 'Free exploration',
    challengeType: currentChallenge?.type ?? 'count_along',
    attemptNumber: currentAttempts + 1,
    currentPhase,
    currentStreak,
    landingSpots: landingSpots.join(', '),
    gradeBand,
    supportTier,
  }), [
    skipValue, startFrom, endAt, direction, currentPosition, jumpCount,
    challenges.length, currentChallengeIndex, currentChallenge,
    currentAttempts, currentPhase, currentStreak, landingSpots, gradeBand,
    supportTier,
  ]);

  // Mode-aware tutor reveal policy — keeps the scripted tutor's spoken help consistent with what the on-screen
  // support tier withholds. For find_skip_value / predict the skip value must not be named at hard.
  const tutorRevealClause = useCallback(
    (challengeType: string): string => {
      if (!supportTier) return '';
      const answerIsSkipValue =
        challengeType === 'find_skip_value' || challengeType === 'predict';
      if (supportTier === 'easy') {
        return answerIsSkipValue
          ? ` SUPPORT TIER: easy — you may name the count-by-${skipValue} strategy and walk the next step with the student.`
          : ` SUPPORT TIER: easy — you may name the count-by-${skipValue} strategy and model the setup step by step.`;
      }
      if (supportTier === 'medium') {
        return ` SUPPORT TIER: medium — the strategy is partly on screen; nudge the student's execution, do not solve it for them.`;
      }
      return answerIsSkipValue
        ? ` SUPPORT TIER: hard — the skip value is the ANSWER and is hidden on screen. Do NOT name it or say "count by ${skipValue}". Ask the student how much the number GROWS from one jump to the next, and what they notice. Never reveal the answer.`
        : ` SUPPORT TIER: hard — scaffolds are withdrawn. Do NOT name the strategy; ask the student what they see in the sequence. Never reveal the answer.`;
    },
    [supportTier, skipValue],
  );

  const { sendText: sendLegacyText, isConnected, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'skip-counting-runner',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === '1-2' ? 'Grade 1-2' : 'Grade 2-3',
    enabled: !tutorOwned,
  });
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

  const aids: SkipAids = aidsFor(currentChallenge, showOptions);
  const charName = character.type === 'custom' ? 'the character' : `the ${character.type}`;

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (tutorOwned || !isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    const first = challenges[0];
    const named = aidsFor(first, showOptions).jumpSize;
    const skipPhrase = named
      ? `Skip value: ${skipValue}. Count ${direction} from ${startFrom} to ${endAt}. `
      : `Count ${direction} from ${startFrom} to ${endAt} (the skip value is the answer the student must discover — do not state it). `;
    const introExcitement = named
      ? `Introduce the activity with excitement: "${charName} is going to jump by ${skipValue}s! Let's count together!" `
      : `Introduce the activity with excitement: "${charName} is going to jump! Watch the pattern and figure out how far each jump goes!" `;
    sendText(
      `[ACTIVITY_START] This is a skip counting activity for ${gradeBand === '1-2' ? 'Grades 1-2' : 'Grades 2-3'}. `
      + skipPhrase
      + `Character: ${charName}. There are ${challenges.length} challenges. `
      + `First challenge: "${first?.instruction}". `
      + introExcitement
      + `Then read the first instruction.`
      + tutorRevealClause(first?.type ?? 'count_along'),
      { silent: true }
    );
  }, [tutorOwned, isConnected, challenges, skipValue, direction, startFrom, endAt, charName, gradeBand, sendText, tutorRevealClause, showOptions]);

  // -------------------------------------------------------------------------
  // Jump Logic
  // -------------------------------------------------------------------------
  /** One jump to the next landing, at once; the 400ms flag only spaces the Jump button and auto-play. */
  const performJump = () => {
    if (hasSubmittedEvaluation) return;
    const to = nextLanding(activeLine, currentPosition);
    if (to === null) return;
    SoundManager.snap();
    setCurrentPosition(to);
    setLandingSpots(prev => [...prev, to]);
    setIsAnimating(true);
    if (jumpAnimationTimerRef.current) clearTimeout(jumpAnimationTimerRef.current);
    jumpAnimationTimerRef.current = setTimeout(() => {
      jumpAnimationTimerRef.current = null;
      setIsAnimating(false);
    }, 400);
    setCurrentStreak(prev => {
      const newStreak = prev + 1;
      setLongestStreak(longest => Math.max(longest, newStreak));
      return newStreak;
    });
    if (isConnected) {
      const jumpNum = jumpCount + 1;
      if (jumpNum % 3 === 0 || to === activeLine.endAt) {
        sendText(
          `[JUMP_LANDING] The character landed on ${to}! `
          + `That's ${jumpNum} jumps of ${activeLine.skipValue}. `
          + `${to === activeLine.endAt ? 'They reached the end!' : `Count along: "${landingSpots.slice(-2).join('... ')}... ${to}!"`} `
          + `${jumpNum >= 3 ? `Connect to multiplication: "${jumpNum} × ${activeLine.skipValue} = ${to}!"` : 'Keep counting along rhythmically.'}`
          + tutorRevealClause(currentChallenge?.type ?? 'count_along'),
          { silent: true }
        );
      }
    }
  };
  const jumpRef = useRef(performJump);
  jumpRef.current = performJump;

  // Auto-play (scripted path, easy count_along): the character demonstrates the rhythm.
  useEffect(() => {
    if (!autoPlay || currentChallenge?.type !== 'count_along' || isAnimating || nextExpectedPosition === null) return;
    autoPlayTimerRef.current = setTimeout(() => jumpRef.current(), 1200);
    return () => {
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
    };
  }, [autoPlay, currentChallenge?.type, isAnimating, nextExpectedPosition]);

  // -------------------------------------------------------------------------
  // Checking: the activity's own check, committed as the workspace's checked gesture
  // -------------------------------------------------------------------------
  const view = (over: Partial<SkipView> = {}): SkipView =>
    ({ position: currentPosition, landings: landingSpots, filled, answer: null, ...over });

  const commit = (work: SkipView): boolean => {
    const ch = currentChallenge!;
    const correct = skipMatches(ch, activeLine, work);
    progress.commitCheck(describeSkipWork(ch, activeLine, work), correct, correct ? undefined : skipMiss(ch, activeLine, work));
    if (correct) { SoundManager.playCorrect(); setSolvedId(ch.id); } else SoundManager.playIncorrect();
    return correct;
  };

  const handleCheckAnswer = () => {
    if (!currentChallenge || learnerBlocked() || hasSubmittedEvaluation || isCurrentChallengeComplete) return;
    const ch = currentChallenge;
    const sv = activeLine.skipValue;
    switch (ch.type) {
      case 'count_along': {
        // Checked once the count reaches the end of the line; each tap before that is checked as it lands.
        if (nextExpectedPosition !== null) return;
        if (commit(view())) {
          setFeedback('You counted all the way! Great job!');
          setFeedbackType('success');
          sendText(`[COUNT_COMPLETE] Student completed counting by ${sv}s from ${activeLine.startFrom} to ${activeLine.endAt}. Celebrate the full count!`, { silent: true });
        }
        return;
      }
      case 'predict': {
        const answer = parseNumber(predictionInput);
        if (answer === null || nextExpectedPosition === null) return;
        const next = nextExpectedPosition;
        if (commit(view({ answer }))) {
          setPredictedPosition(next);
          setFeedback(`Yes! ${next} is correct!`);
          setFeedbackType('success');
          setCurrentStreak(prev => {
            const newStreak = prev + 1;
            setLongestStreak(longest => Math.max(longest, newStreak));
            return newStreak;
          });
          sendText(
            `[PREDICT_CORRECT] Student correctly predicted ${next}! Skip counting by ${sv}s from ${currentPosition}. `
            + `${currentAttempts === 0 ? 'First try!' : `After ${currentAttempts + 1} attempts.`} Streak: ${currentStreak + 1}. `
            + `Celebrate: "You knew it was ${next}! ${sv} more than ${currentPosition}!"`,
            { silent: true }
          );
          // The character makes the predicted jump.
          if (predictAdvanceTimerRef.current) clearTimeout(predictAdvanceTimerRef.current);
          predictAdvanceTimerRef.current = setTimeout(() => {
            predictAdvanceTimerRef.current = null;
            jumpRef.current();
            setPredictionInput('');
            setPredictedPosition(null);
          }, 800);
        } else {
          // The jump size is not named where the tier hides it.
          setFeedback(aids.jumpSize ? `Not quite. You said ${answer}. What is ${currentPosition} + ${sv}?`
            : `Not quite. You said ${answer}. How far is each jump?`);
          setFeedbackType('error');
          setCurrentStreak(0);
          sendText(
            `[PREDICT_INCORRECT] Student predicted ${answer} but the next landing is ${next}. `
            + `Current position: ${currentPosition}, skip value: ${sv}. `
            + `Hint: "We're counting by ${sv}s. What is ${currentPosition} plus ${sv}?"`
            + tutorRevealClause('predict'),
            { silent: true }
          );
        }
        return;
      }
      case 'fill_missing': {
        const answer = parseNumber(fillInput);
        if (answer === null) return;
        const work = view({ answer });
        if (fillFits(ch, activeLine, work)) {
          setFilled(prev => [...prev, answer].sort((a, b) => a - b));
          setFillInput('');
          setFeedback(`Yes! ${answer} is in the sequence!`);
          setFeedbackType('success');
          // A gap filled with others still open is progress, not a check: the item is checked on its last gap.
          if (!skipMatches(ch, activeLine, work)) { SoundManager.snap(); return; }
          commit(work);
          sendText(`[FILL_CORRECT] Student found missing number ${answer} and filled every gap.`, { silent: true });
          return;
        }
        commit(work);
        setFeedback(`${answer} doesn't fit. We're counting by ${sv}s.`);
        setFeedbackType('error');
        sendText(
          `[FILL_INCORRECT] Student guessed ${answer} but it's not a missing multiple of ${sv} from ${activeLine.startFrom}. `
          + `Hint: "Start from ${activeLine.startFrom} and add ${sv} each time."`
          + tutorRevealClause('fill_missing'),
          { silent: true }
        );
        return;
      }
      case 'find_skip_value': {
        const answer = parseNumber(fillInput);
        if (answer === null) return;
        if (commit(view({ answer }))) {
          if (!isPractice) setPatternIdentified(true);
          setFeedback(`You got it! We're counting by ${sv}s!`);
          setFeedbackType('success');
          sendText(`[SKIP_VALUE_CORRECT] Student identified the skip value as ${sv}. Celebrate: "You found the pattern! Every jump is ${sv} more!"`, { silent: true });
        } else {
          setFeedback('Not quite. Look at the difference between each number.');
          setFeedbackType('error');
          const shown = linePositions(activeLine).slice(0, 4).join(', ');
          sendText(
            (supportTier === 'hard'
              ? `[SKIP_VALUE_INCORRECT] Student guessed ${answer}, which is not the skip value. Do NOT reveal the correct skip value. Point them to the sequence: "${shown}". `
              : `[SKIP_VALUE_INCORRECT] Student guessed ${answer} but the skip value is ${sv}. Hint: "Look at the numbers: ${shown}. What do you add each time?"`)
            + tutorRevealClause('find_skip_value'),
            { silent: true }
          );
        }
        return;
      }
      case 'connect_multiplication': {
        const answer = parseJumps(multiplicationInput);
        if (answer === null) return;
        const product = Math.abs(currentPosition - activeLine.startFrom);
        if (commit(view({ answer }))) {
          if (!isPractice) setMultiplicationConnectionMade(true);
          setFeedback(`Correct! ${jumpCount} × ${sv} = ${product}`);
          setFeedbackType('success');
          sendText(`[MULTIPLY_CORRECT] Student connected skip counting to multiplication: ${jumpCount} × ${sv} = ${product}. Celebrate!`, { silent: true });
        } else {
          setFeedback(`Think about how many jumps of ${sv} you see.`);
          setFeedbackType('error');
          sendText(
            `[MULTIPLY_INCORRECT] Student answered "${multiplicationInput}" but the fact is: ${jumpCount} × ${sv} = ${product}. `
            + `Hint: "Count the jumps. Each jump is ${sv}."`
            + tutorRevealClause('connect_multiplication'),
            { silent: true }
          );
        }
        return;
      }
    }
  };

  // count_along: the learner taps the tick where the character lands next. The right tick makes the jump; a tick
  // further on is a checked miss, without naming the next number.
  const isTapJumpMode = currentChallenge?.type === 'count_along' && !autoPlay && !isCurrentChallengeComplete
    && !allChallengesComplete && nextExpectedPosition !== null;
  const handleTickTap = (pos: number) => {
    if (learnerBlocked() || hasSubmittedEvaluation || !isTapJumpMode) return;
    if (pos === nextExpectedPosition) { performJump(); return; }
    setCurrentStreak(0);
    commit(view({ answer: pos }));
    setFeedback(`One jump at a time! Where does ${charName} land right after ${currentPosition}?`);
    setFeedbackType('error');
    sendText(
      `[JUMP_WRONG_TARGET] Student tapped ${pos} but the next landing after ${currentPosition} is ${nextExpectedPosition} (skip value ${activeLine.skipValue}). `
      + `Nudge WITHOUT stating the answer: ask how far ${charName} hops each time and where it would land from ${currentPosition}.`
      + tutorRevealClause('count_along'),
      { silent: true },
    );
  };

  // -------------------------------------------------------------------------
  // Completion: submitted once every challenge is correct (both paths; under an evaluation provider only)
  // -------------------------------------------------------------------------
  const submittedRef = useRef(false);
  useEffect(() => {
    if (!allChallengesComplete || hasSubmittedEvaluation || submittedRef.current) return;
    // The live host has no evaluation provider; a workspace family submits only under one.
    if (progress.recordsEvaluation === false) return;
    submittedRef.current = true;
    const typeOf = (id: string) => challenges.find(c => c.id === id)?.type;
    const totalCorrect = challengeResults.filter(r => r.correct).length;
    const overallPct = challenges.length > 0 ? Math.round((totalCorrect / challenges.length) * 100) : 0;
    const jumpResults = challengeResults.filter(r => typeOf(r.challengeId) === 'count_along' || typeOf(r.challengeId) === 'predict');
    const predictionResults = challengeResults.filter(r => typeOf(r.challengeId) === 'predict');
    const metrics: SkipCountingRunnerMetrics = {
      type: 'skip-counting-runner',
      landingsCorrect: jumpResults.filter(r => r.correct).length,
      landingsTotal: jumpResults.length,
      predictionsCorrect: predictionResults.filter(r => r.correct).length,
      predictionsTotal: predictionResults.length,
      skipValuesExplored: Array.from(skipValuesExplored),
      backwardCountingAttempted,
      multiplicationConnectionMade,
      patternIdentified,
      longestCorrectStreak: longestStreak,
      attemptsCount: challengeResults.reduce((s, r) => s + (r.attempts ?? 0), 0),
    };
    submitEvaluation(totalCorrect === challenges.length, overallPct, metrics, { challengeResults });
    const phaseScoreStr = phaseResults.map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`).join(', ');
    sendText(
      `[CHALLENGE_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
      + `Skip value: ${skipValue}. Longest streak: ${longestStreak}. Give encouraging phase-specific feedback about counting by ${skipValue}s.`,
      { silent: true }
    );
  }, [allChallengesComplete, hasSubmittedEvaluation, progress.recordsEvaluation, challengeResults, challenges, skipValuesExplored,
    backwardCountingAttempted, multiplicationConnectionMade, patternIdentified, longestStreak, submitEvaluation, phaseResults,
    sendText, skipValue]);

  // Next (scripted path only: on the workspace the runtime advances).
  const advanceToNextChallenge = () => {
    if (!advanceProgress()) return;
    const nextIndex = currentChallengeIndex + 1;
    const nextChallenge = challenges[nextIndex];
    if (!nextChallenge) return;
    showChallenge(nextChallenge, line, false);
    sendText(
      `[PHASE_TRANSITION] Moving to challenge ${nextIndex + 1} of ${challenges.length}: `
      + `"${nextChallenge.instruction}" (type: ${nextChallenge.type}). Read the instruction and encourage them.`
      + tutorRevealClause(nextChallenge.type),
      { silent: true }
    );
  };

  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    const correct = challengeResults.filter(r => r.correct).length;
    return Math.round((correct / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  const isCountAlongComplete = currentChallenge?.type === 'count_along' && nextExpectedPosition === null;

  // -------------------------------------------------------------------------
  // Levers: what the session item shows. A practice count shows its aids plainly and carries no levers.
  // -------------------------------------------------------------------------
  const leverSession = { challenges, line, showOptions, supportTier };
  const itemLevers = sessionChallenge ? skipLevers(sessionChallenge, leverSession, pulledLevers, currentPosition) : [];
  const helpOn = (id: string) => !practice && itemLevers.some(l => l.id === id && l.pulled);
  const type = currentChallenge?.type;
  const labelsOn = isPractice || (type === 'count_along' ? helpOn(TICK_NUMBERS) : aids.labels);
  const chipsOn = isPractice || ((type === 'count_along' || type === 'predict') ? helpOn(COUNT_TRAIL) : aids.sequence);
  const jumpSizesOn = helpOn(JUMP_SIZES);
  const marksOn = helpOn(JUMP_MARKS);
  const arcsOn = isPractice || aids.arcs || jumpSizesOn || marksOn;
  const stepArcsOn = helpOn(STEP_ARCS);
  const ringsOn = helpOn(RING_GAPS);
  const dots = helpOn(HOP_DOTS) ? hopDots(line) : null;
  const model: CountModel | null = helpOn(MODEL_COUNT) && sessionChallenge ? countModel(sessionChallenge, line) : null;
  const solvedOrNot = (hidden: boolean) => !hidden || isCurrentChallengeComplete;
  const arrayOn = type === 'connect_multiplication' ? (!isPractice && (aids.array || helpOn(ARRAY_ROWS))) : aids.array;
  const arrayCaptionOn = solvedOrNot(type === 'connect_multiplication' || type === 'find_skip_value');
  const equationOn = type === 'connect_multiplication' ? isCurrentChallengeComplete && !!showOptions.showEquation : aids.equation;
  const digitPatternOn = showDigitPattern && solvedOrNot(type === 'find_skip_value');
  const jumpSizeOn = aids.jumpSize && !(isPractice && type === 'find_skip_value');

  // Workspace path: what the tutor and the observer are shown, republished every render.
  useLayoutEffect(() => {
    if (!tutorOwned || !currentChallenge || !sessionChallenge) return;
    const shown: SkipAids = { labels: labelsOn, arcs: arcsOn, sequence: chipsOn, jumpSize: jumpSizeOn, equation: equationOn, array: arrayOn };
    const scene = workspaceScene(currentChallenge, { line: activeLine, character: character.type,
      supportTier: practice ? undefined : supportTier, aids: shown }, view());
    const levers = practice ? [] : itemLevers;
    const onScreen = practice ? '' : levers.filter(l => l.pulled).map(l => l.id === HOP_DOTS ? DOTS_FACT
      : l.id === MODEL_COUNT ? (model ? modelFact(model) : '') : leverFact(l.id, line, character.type)).filter(Boolean).join('. ');
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}), ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const next = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = practiceItem(sessionChallenge, leverSession);
          if (!easier) return 'This item is already the plainest of its kind.';
          setLeverState(next); setPractice(easier); showChallenge(easier.challenge, easier.line, false);
          return { practice: workspaceAssignment(easier.challenge) };
        }
        setLeverState(next);
        return true as const;
      },
      // Back to the full item, blank: the practice count is not the learner's work on it.
      endPractice: () => { setPractice(null); showChallenge(sessionChallenge, line, false); },
    };
  });

  // -------------------------------------------------------------------------
  // SVG Number Line Rendering
  // -------------------------------------------------------------------------
  const lineY = NL_HEIGHT - 40;
  const usableWidth = SVG_WIDTH - NL_PADDING * 2;
  const posToX = (pos: number) => {
    const range = nlMax - nlMin;
    if (range === 0) return NL_PADDING;
    return NL_PADDING + ((pos - nlMin) / range) * usableWidth;
  };

  const tickMarks = useMemo(() => {
    const ticks: number[] = [];
    const step = nlMax - nlMin <= 50 ? 1 : activeLine.skipValue;
    for (let n = nlMin; n <= nlMax; n += step) ticks.push(n);
    return ticks;
  }, [nlMin, nlMax, activeLine.skipValue]);

  const hiddenSet = new Set(currentChallenge?.hiddenPositions || []);
  const gapSet = new Set(currentChallenge?.type === 'fill_missing' ? gapsOf(currentChallenge, activeLine) : []);
  const isAhead = (n: number) => (activeLine.direction === 'forward' ? n > currentPosition : n < currentPosition);
  const allPositions = linePositions(activeLine);
  const sign = activeLine.direction === 'backward' ? '-' : '+';

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const charEmoji = CHARACTER_EMOJI[character.type] || '⭐';
  const inputClosed = allChallengesComplete || blocked || hasSubmittedEvaluation;

  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of this item's check state, the tutor's speech on it, and
  // the child's touches; Pip points only at the workspace as a whole and never
  // chooses, checks, or advances.
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: allChallengesComplete || hasSubmittedEvaluation ? null : currentChallenge?.id ?? null,
    label: 'The number line',
    solved: isCurrentChallengeComplete,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  const arc = (from: number, to: number, i: number, key: string, stroke: string, label?: string) => {
    const x1 = posToX(from), x2 = posToX(to), midX = (x1 + x2) / 2;
    const arcY = lineY - JUMP_ARC_HEIGHT - Math.min(i * 3, 20);
    return (
      <g key={key}>
        <path d={`M ${x1} ${lineY - 8} Q ${midX} ${arcY} ${x2} ${lineY - 8}`} fill="none" stroke={stroke}
          strokeWidth={2} strokeDasharray="4 3" />
        {label && <text x={midX} y={(lineY - 8 + arcY) / 2 - 2} textAnchor="middle" fill="#fdba74" fontSize={10}>{label}</text>}
      </g>
    );
  };

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">
            <span className="mr-2">{charEmoji}</span>{title}
          </LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="orange" className="text-xs">
              {gradeBand === '1-2' ? 'Grades 1-2' : 'Grades 2-3'}
            </LuminaBadge>
            {/* "Count by Ns": never on find_skip_value, where N is the answer, and off where the tier hides it. */}
            {jumpSizeOn && (
              <LuminaBadge accent="emerald" className="text-xs">
                Count by {activeLine.skipValue}s
              </LuminaBadge>
            )}
            {activeLine.direction === 'backward' && (
              <LuminaBadge accent="purple" className="text-xs">
                Backward
              </LuminaBadge>
            )}
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Phase Progress */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(PHASE_CONFIG).map(([phase, config]) => (
              <LuminaBadge
                key={phase}
                className={`text-xs ${
                  currentPhase === phase
                    ? 'bg-orange-500/20 border-orange-400/50 text-orange-300'
                    : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
                }`}
              >
                {config.label}
              </LuminaBadge>
            ))}
            <span className="text-slate-500 text-xs ml-auto">
              Challenge {Math.min(currentChallengeIndex + 1, challenges.length)} of {challenges.length}
            </span>
          </div>
        )}

        {isPractice && <div className="text-center text-xs text-amber-300" data-practice>Practice count</div>}

        {/* Instruction */}
        {currentChallenge && !allChallengesComplete && (
          <LuminaPanel className="p-3">
            <p className="text-slate-200 text-sm font-medium">
              {currentChallenge.instruction}
            </p>
          </LuminaPanel>
        )}

        {/* Pip's dock sits above the workspace, which it outlines as a region. */}
        {pip.store && !allChallengesComplete && <div {...pip.dock} />}
        <div {...pip.workspace} className="space-y-4">
        {/* Number Line SVG */}
        <div className="flex justify-center">
          <svg
            width={SVG_WIDTH}
            height={NL_HEIGHT}
            viewBox={`0 0 ${SVG_WIDTH} ${NL_HEIGHT}`}
            className="max-w-full h-auto"
          >
            <line x1={NL_PADDING - 10} y1={lineY} x2={SVG_WIDTH - NL_PADDING + 10} y2={lineY}
              stroke="rgba(255,255,255,0.3)" strokeWidth={2} />
            <polygon
              points={`${SVG_WIDTH - NL_PADDING + 10},${lineY} ${SVG_WIDTH - NL_PADDING + 2},${lineY - 5} ${SVG_WIDTH - NL_PADDING + 2},${lineY + 5}`}
              fill="rgba(255,255,255,0.3)"
            />

            {/* Tick marks and labels */}
            {tickMarks.map(n => {
              const x = posToX(n);
              const isLanding = landingSpots.includes(n);
              const isGap = gapSet.has(n) && !filled.includes(n);
              const isQuestion = isGap || (hiddenSet.has(n) && !isLanding && type !== 'fill_missing');
              const isMultiple = (n - activeLine.startFrom) % activeLine.skipValue === 0
                && n >= Math.min(activeLine.startFrom, activeLine.endAt) && n <= Math.max(activeLine.startFrom, activeLine.endAt);
              // predict: no number is written ahead of the character (the next landing is the answer).
              const labelled = labelsOn && !(type === 'predict' && isAhead(n) && !isLanding);
              return (
                <g key={n}>
                  <line
                    x1={x}
                    y1={lineY - (isMultiple ? TICK_HEIGHT : TICK_HEIGHT / 2)}
                    x2={x}
                    y2={lineY + (isMultiple ? TICK_HEIGHT : TICK_HEIGHT / 2)}
                    stroke={isLanding ? '#f97316' : isMultiple ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)'}
                    strokeWidth={isLanding ? 2 : 1}
                  />
                  {/* A "?" always marks a gap; a filled gap shows its number. */}
                  {isMultiple && (labelled || isQuestion || filled.includes(n)) && (
                    <text
                      x={x}
                      y={lineY + TICK_HEIGHT + 14}
                      textAnchor="middle"
                      fill={filled.includes(n) ? '#34d399' : isLanding ? '#fb923c' : isQuestion ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.6)'}
                      fontSize={11}
                      fontWeight={isLanding || filled.includes(n) ? 'bold' : 'normal'}
                    >
                      {isQuestion ? '?' : n}
                    </text>
                  )}
                  {/* The help lever `ring_gaps`: a ring on each "?" still to fill. */}
                  {ringsOn && isGap && (
                    <circle cx={x} cy={lineY + TICK_HEIGHT + 10} r={9} fill="none" stroke="#fbbf24" strokeWidth={1.5} data-lever="ring-gap" />
                  )}
                  {isLanding && (
                    <circle cx={x} cy={lineY} r={6} fill="#f97316" opacity={0.6} className="animate-pulse" />
                  )}
                  {/* Tap-to-place hit target — only the multiples AHEAD of the character. */}
                  {isTapJumpMode && isMultiple && isAhead(n) && (
                    <circle
                      cx={x}
                      cy={lineY}
                      r={16}
                      className="cursor-pointer fill-transparent hover:fill-orange-500/15 transition-colors"
                      data-pip-object={`tick-${n}`}
                      onClick={() => handleTickTap(n)}
                    />
                  )}
                </g>
              );
            })}

            {/* The help lever `hop_dots`: a bare dot on each whole number passed over in the first three jumps. */}
            {dots && (
              <g data-lever="hop-dots" aria-hidden>
                {dots.map(d => <circle key={`dot-${d}`} cx={posToX(d)} cy={lineY - 6} r={2} fill="#93c5fd" />)}
              </g>
            )}

            {/* The help lever `step_arcs`: the step between every two neighbouring numbers; each gap keeps its "?". */}
            {stepArcsOn && (
              <g data-lever="step-arcs">
                {allPositions.slice(1).map((to, i) => arc(allPositions[i], to, 0, `step-${i}`, 'rgba(147,197,253,0.5)',
                  `${sign}${activeLine.skipValue}`))}
              </g>
            )}

            {/* Jump arcs over the jumps made; `jump_sizes` writes the step over each, `jump_marks` alternates colours. */}
            {arcsOn && !stepArcsOn && landingSpots.length > 1 && (
              <g data-lever={jumpSizesOn ? 'jump-sizes' : marksOn ? 'jump-marks' : undefined}>
                {landingSpots.slice(1).map((pos, i) => arc(landingSpots[i], pos, i, `arc-${i}`,
                  marksOn ? (i % 2 ? 'rgba(96,165,250,0.8)' : 'rgba(249,115,22,0.8)') : 'rgba(249,115,22,0.3)',
                  jumpSizesOn ? `${sign}${activeLine.skipValue}` : undefined))}
              </g>
            )}

            {/* Character */}
            <text x={posToX(currentPosition)} y={lineY - 22} textAnchor="middle" fontSize={24}>
              {charEmoji}
            </text>

            {/* Predicted position marker */}
            {predictedPosition !== null && (
              <g>
                <circle cx={posToX(predictedPosition)} cy={lineY} r={8} fill="none" stroke="#22c55e" strokeWidth={2} strokeDasharray="3 3" />
                <text x={posToX(predictedPosition)} y={lineY - 14} textAnchor="middle" fill="#22c55e" fontSize={10}>✓</text>
              </g>
            )}
          </svg>
        </div>

        {/* The help lever `model_count`: another count on a small line beside the item, never the item's step. */}
        {model && <CountModelLine model={model} />}

        {isTapJumpMode && (
          <div className="text-center text-orange-300/80 text-sm">
            👆 Tap the number where {charName} lands next
          </div>
        )}

        {/* Sequence Display — the written running record of landings and the "→ ?" next cue. */}
        {chipsOn && type !== 'fill_missing' && (
          <div className="flex items-center justify-center gap-2 flex-wrap" data-lever={helpOn(COUNT_TRAIL) ? 'count-trail' : undefined}>
            {landingSpots.map((pos, i) => (
              <React.Fragment key={pos}>
                {i > 0 && <span className="text-slate-600 text-xs">→</span>}
                <span className={`text-sm font-mono font-bold ${pos === currentPosition ? 'text-orange-400' : 'text-slate-300'}`}>
                  {pos}
                </span>
              </React.Fragment>
            ))}
            {nextExpectedPosition !== null && (
              <>
                <span className="text-slate-600 text-xs">→</span>
                <span className="text-slate-600 text-sm font-mono">?</span>
              </>
            )}
          </div>
        )}

        {/* Equation Display: never on find_skip_value; on connect_multiplication only once it is answered. */}
        {equationOn && jumpCount > 0 && (
          <div className="text-center">
            <span className="text-slate-300 text-sm font-mono">
              {jumpCount} × {activeLine.skipValue} = <span className="text-orange-300 font-bold">{Math.abs(currentPosition - activeLine.startFrom)}</span>
            </span>
          </div>
        )}

        {digitPatternOn && landingSpots.length > 2 && (
          <div className="text-center">
            <span className="text-slate-500 text-xs">
              Ones digits: {landingSpots.map(n => Math.abs(n) % 10).join(', ')}
            </span>
          </div>
        )}

        {/* Array: one row per jump. Its caption names the answer on find and connect, so it waits for the answer. */}
        {arrayOn && jumpCount > 0 && (
          <div className="bg-slate-800/20 rounded-lg p-3 border border-white/5" data-lever={helpOn(ARRAY_ROWS) ? 'array-rows' : undefined}>
            {arrayCaptionOn && (
              <p className="text-slate-500 text-xs mb-2 text-center">Array: {jumpCount} rows of {activeLine.skipValue}</p>
            )}
            <div className="flex flex-col items-center gap-1">
              {Array.from({ length: Math.min(jumpCount, 12) }, (_, row) => (
                <div key={row} className="flex gap-1">
                  {Array.from({ length: activeLine.skipValue }, (_, col) => (
                    <div key={col} className="w-4 h-4 rounded-sm bg-orange-500/40 border border-orange-400/30" />
                  ))}
                </div>
              ))}
              {jumpCount > 12 && <span className="text-slate-600 text-xs">...</span>}
            </div>
          </div>
        )}

        {/* Prediction Input */}
        {currentChallenge?.type === 'predict' && !isCurrentChallengeComplete && nextExpectedPosition !== null && (
          <div className="flex items-center justify-center gap-3">
            <span className="text-slate-300 text-sm">Next landing:</span>
            <LuminaInput
              type="number"
              inputMode="numeric"
              aria-label={INPUT_LABEL.predict}
              value={predictionInput}
              onChange={e => setPredictionInput(e.target.value)}
              disabled={inputClosed}
              className="w-20 text-center text-lg"
              onKeyDown={e => e.key === 'Enter' && handleCheckAnswer()}
              autoFocus
            />
          </div>
        )}

        {/* Fill Missing / Find Skip Value Input */}
        {(currentChallenge?.type === 'fill_missing' || currentChallenge?.type === 'find_skip_value') && !isCurrentChallengeComplete && (
          <div className="flex items-center justify-center gap-3">
            <span className="text-slate-300 text-sm">
              {currentChallenge.type === 'find_skip_value' ? 'Skip value:' : 'Missing number:'}
            </span>
            <LuminaInput
              type="number"
              inputMode="numeric"
              aria-label={INPUT_LABEL[currentChallenge.type as 'fill_missing' | 'find_skip_value']}
              value={fillInput}
              onChange={e => setFillInput(e.target.value)}
              disabled={inputClosed}
              className="w-20 text-center text-lg"
              onKeyDown={e => e.key === 'Enter' && handleCheckAnswer()}
              autoFocus
            />
          </div>
        )}

        {/* Multiplication: the learner gives the number of jumps, the factor the line shows only by counting. */}
        {currentChallenge?.type === 'connect_multiplication' && !isCurrentChallengeComplete && (
          <div className="flex items-center justify-center gap-3">
            <LuminaInput
              type="text"
              inputMode="numeric"
              aria-label={INPUT_LABEL.connect_multiplication}
              value={multiplicationInput}
              onChange={e => setMultiplicationInput(e.target.value)}
              disabled={inputClosed}
              placeholder="?"
              className="w-20 text-center text-lg"
              onKeyDown={e => e.key === 'Enter' && handleCheckAnswer()}
              autoFocus
            />
            <span className="text-slate-300 text-sm font-mono">
              × {activeLine.skipValue} = {Math.abs(currentPosition - activeLine.startFrom)}
            </span>
          </div>
        )}

        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium ${
            feedbackType === 'success' ? 'text-emerald-400' :
            feedbackType === 'error' ? 'text-red-400' :
            'text-slate-300'
          }`}>
            {feedback}
          </div>
        )}

        {currentStreak >= 3 && (
          <div className="text-center">
            <LuminaBadge accent="orange" className="text-xs">
              Streak: {currentStreak} correct in a row!
            </LuminaBadge>
          </div>
        )}

        {/* Action Buttons */}
        {challenges.length > 0 && (
          <div className="flex justify-center gap-3">
            {!isCurrentChallengeComplete && !allChallengesComplete && (
              <>
                {/* Jump button — find_skip_value only, where hopping builds the arcs the learner reads. Never on
                    fill_missing: a jump would land on a gap and show its number. */}
                {currentChallenge?.type === 'find_skip_value' && nextExpectedPosition !== null && (
                  <LuminaButton
                    className="bg-orange-500/10 border border-orange-400/30 hover:bg-orange-500/20 text-orange-300"
                    onClick={() => { if (!learnerBlocked()) performJump(); }}
                    disabled={isAnimating || inputClosed}
                  >
                    {charEmoji} Jump!{jumpSizeOn ? ` (+${activeLine.skipValue})` : ''}
                  </LuminaButton>
                )}

                {(isCountAlongComplete || (currentChallenge && currentChallenge.type !== 'count_along')) && (
                  <LuminaActionButton action="check" onClick={handleCheckAnswer} disabled={inputClosed} />
                )}
              </>
            )}
            {!tutorOwned && isCurrentChallengeComplete && !allChallengesComplete && (
              <LuminaActionButton action="next" onClick={advanceToNextChallenge}>
                Next Challenge
              </LuminaActionButton>
            )}
            {allChallengesComplete && (
              <div className="text-center">
                <p className="text-emerald-400 text-sm font-medium mb-2">
                  All challenges complete!
                </p>
              </div>
            )}
          </div>
        )}

        {/* Hint (scripted path: generated hints can name the answer; on the workspace the tutor helps) */}
        {!tutorOwned && currentChallenge?.hint && feedbackType === 'error' && currentAttempts >= 2 && (
          <LuminaPanel className="p-2 text-center">
            <p className="text-slate-400 text-xs italic">{currentChallenge.hint}</p>
          </LuminaPanel>
        )}

        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Challenge Complete!"
            celebrationMessage={`You completed all ${challenges.length} skip counting challenges!${longestStreak > 0 ? ` Best streak: ${longestStreak}!` : ''}`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

/** The help lever `model_count`: a small line counting by another step, its jump size over each jump. */
function CountModelLine({ model }: { model: CountModel }) {
  const w = 300, y = 40, pad = 20, last = model.numbers[model.numbers.length - 1];
  const x = (n: number) => pad + (n / last) * (w - pad * 2);
  return (
    <div className="flex flex-col items-center gap-1" data-lever="model-count">
      <span className="text-xs text-slate-400">Another count</span>
      <svg width={w} height={60} viewBox={`0 0 ${w} 60`} className="max-w-full h-auto">
        <line x1={pad - 6} y1={y} x2={w - pad + 6} y2={y} stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} />
        {model.numbers.map((n, i) => (
          <g key={n}>
            <line x1={x(n)} y1={y - 6} x2={x(n)} y2={y + 6} stroke="rgba(255,255,255,0.5)" />
            <text x={x(n)} y={y + 18} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={10}>{n}</text>
            {i > 0 && (
              <g>
                <path d={`M ${x(model.numbers[i - 1])} ${y - 4} Q ${(x(model.numbers[i - 1]) + x(n)) / 2} ${y - 26} ${x(n)} ${y - 4}`}
                  fill="none" stroke="rgba(147,197,253,0.6)" strokeWidth={1.5} />
                <text x={(x(model.numbers[i - 1]) + x(n)) / 2} y={y - 18} textAnchor="middle" fill="#93c5fd" fontSize={9}>+{model.step}</text>
              </g>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const SkipCountingRunner = withWorkspaceController<SkipCountingRunnerProps, ProgressOptions<SkipCountingChallenge>, Progress>(
  'skip-counting-runner', SkipCountingRunnerSurface, useScriptedProgress, useWorkspaceProgressFor('skip-counting-runner'));

export default SkipCountingRunner;
