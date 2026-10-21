'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { LuminaBadge, LuminaButton } from '../../../ui';
import {
  usePrimitiveEvaluation,
  type FractionBarMetrics,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import { useLiveRuntime } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { fractionBarDiagnosisEvidence, type FractionBarResponse } from './fractionBarEvidence';
import { barItems, describeWork, fractionBarMiss, workspaceScene, type FractionBarItem, type FractionBarView } from './fractionBarWorkspace';
import {
  FRACTION_BAR_LEVERS, MODEL_LEVER, NUMBER_PARTS_LEVER, REFERENCE_LEVER, STEP_COUNT_LEVER, modelFraction,
  startLevers,
} from './fractionBarLevers';
import { fractionBarBoss } from './fractionBar.boss';
import { cutInto, cutsFor, equalBuildMiss, halvePiece, makesEqual, readBuild, toggleShade, wholeCircle,
  type EqualBuildMiss, type Piece } from './fractionEqualBuild';
import { BAR_H, BAR_W, FractionBarEqualScene, barParts } from './FractionBarEqualScene';
import { useBuildWatcher } from '../../build-layer/buildLayer';

/**
 * Fraction Bar — multi-challenge interactive fraction model, taught only on the shared teaching workspace
 * (`fractionBar.boss.ts`): the runtime owns progression, the tutor and the levers own help.
 *
 * Each session walks the student through 3-6 distinct fractions in the SAME
 * eval mode. Each fraction runs through a three-phase within-challenge flow:
 *   Phase 1: Identify the Numerator (multiple choice)
 *   Phase 2: Identify the Denominator (multiple choice)
 *   Phase 3: Build the Fraction on the bar (shade partitions)
 * except `build_equal`, the open build: the learner splits the bar into equal
 * parts of their choosing and shades some to make a fraction equal to the
 * target, then presses "I'm done!" (`fractionBarWorkspace.ts`), and `compare`,
 * two shaded bars and a sign to pick between them.
 *
 * The session ends when every challenge has been completed; results aggregate
 * into one PhaseSummaryPanel row per eval mode (PRD §6e pattern).
 */

export type FractionBarChallengeType =
  | 'identify'
  | 'build'
  // The three-step item on denominators 4-12 (this mode was named `compare` until 10-16; it compared nothing).
  | 'larger_denominators'
  // Two bars of the same whole: pick <, = or > (pair and key from the fraction-compare item space).
  | 'compare'
  | 'add_subtract'
  // Open build: make a fraction equal to numerator/denominator on the bar, any equal split but the target's own.
  | 'build_equal';

export interface FractionBarChallenge {
  id: string;
  numerator: number;
  denominator: number;
  numeratorChoices: number[];
  denominatorChoices: number[];
  /** build_equal: the ask, stating the target (code writes it). */
  instruction?: string;
  /** compare: the second fraction (the first is numerator/denominator), drawn as a second bar of the same whole. */
  compareWith?: { numerator: number; denominator: number };
  /** compare: the true relation of the first fraction to the second. Code computes it; never shown before the check. */
  relation?: CompareRelation;
  /** compare: where the pair came from (the item space and its predicted difficulty). */
  itemSpace?: { space: string; structure: string; beta: number };
}

export type CompareRelation = '<' | '=' | '>';

import type { LearningAdaptation } from '../../../service/generation/learningAdaptation';
export interface FractionBarData {
  /** Safe adaptation metadata only; `source` is stamped by the generation server. */
  learningAdaptation?: LearningAdaptation<'contrast_shared_digit_roles'>;
  title: string;
  description: string;
  /** 1-6 challenges. Walked sequentially by the component. */
  challenges: FractionBarChallenge[];
  /** Eval mode pinned for this session (all challenges share one mode). */
  challengeType: FractionBarChallengeType;
  /** Whether to show the decimal approximation in the build phase. */
  showDecimal?: boolean;
  /**
   * Support-tier lever: show the partition-index numerals ({i+1}) inside each bar
   * cell (denominator ≤ 12). These label POSITION, not the shaded count, so hiding
   * them never leaks the answer. Default true (current behavior; withdrawn at hard).
   */
  showPartitionNumerals?: boolean;
  /**
   * Support-tier lever: show the live "Shaded: X/N" + target restatement above the
   * bar in the build phase. Default true (current behavior; withdrawn at hard so the
   * student shades from the fraction alone).
   */
  showShadedReadout?: boolean;
  /**
   * Support-tier lever: include the "(the top number)/(the bottom number)" gloss in
   * the identify-phase prompts. Default true; dropped at hard so the student must
   * recall which position is numerator vs denominator.
   */
  showPromptGloss?: boolean;
  /** Support tier in effect ('easy' | 'medium' | 'hard'): when the model lever comes (`FRACTION_BAR_LEVERS.support`). */
  supportTier?: 'easy' | 'medium' | 'hard';
  gradeLevel?: string;
  /** build_equal: the split buttons offered (`cutsFor`): K-2 halves to fourths, 3-5 up to twelfths. */
  gradeBand?: 'K-2' | '3-5';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<FractionBarMetrics>) => void;
}

interface FractionBarProps {
  data: FractionBarData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED pin from the mount; a pin the family binds mounts the teaching workspace. */
  runtimeEvalMode?: string;
}

type LearningPhase = 'identify-numerator' | 'identify-denominator' | 'build-fraction' | 'compare';

const RELATIONS: readonly CompareRelation[] = ['<', '=', '>'];

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  identify:     { label: 'Identify Fractions',  icon: '🔢', accentColor: 'purple' },
  build:        { label: 'Build Fractions',     icon: '🎯', accentColor: 'emerald' },
  larger_denominators: { label: 'Larger Denominators', icon: '🧩', accentColor: 'blue' },
  compare:      { label: 'Compare Fractions',   icon: '⚖️', accentColor: 'blue' },
  add_subtract: { label: 'Fraction Operations', icon: '➕',       accentColor: 'pink' },
  build_equal:  { label: 'Your Way',            icon: '✂️', accentColor: 'purple' },
};

/** build_equal's verdict words by miss: the learner's work, never the target's other forms. */
const BUILD_EQUAL_FEEDBACK: Record<EqualBuildMiss, string> = {
  unequal_pieces: 'Those parts are not all the same size, so they do not make a fraction yet.',
  same_pieces: 'That is the same fraction. Can you split the bar a different way?',
  shaded_the_rest: 'Not the same amount yet. Look again at which part is shaded.',
  cut_cannot_make: 'Not the same amount yet. Try a different number of parts.',
  one_off: 'Not the same amount yet.',
  off_by_more: 'Not the same amount yet.',
};

/** Per-challenge score: 100 first try, then -20 per extra attempt, floored at 20. */
function phaseScore(attempts: number): number {
  if (attempts <= 0) return 0;
  return Math.max(20, 100 - (attempts - 1) * 20);
}

/** The teaching workspace is fraction-bar's only controller: the runtime owns progression. */
const useFractionBarProgress = useWorkspaceProgressFor('fraction-bar');

const FractionBarSurface = ({ data, className, runtimePlanItemId }: FractionBarProps) => {
  const liveRuntime = useLiveRuntime();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const componentMounted = useRef(true);
  useLayoutEffect(() => { componentMounted.current = true; return () => { componentMounted.current = false; }; }, []);
  /** A checked answer stays closed until Try again or Next challenge on the shell. */
  const workspaceClosed = useRef(false);
  const learnerBlocked = () => !componentMounted.current || workspaceClosed.current
    || !!liveRuntime && !['empty', 'active'].includes(liveRuntime.getSnapshot().status);
  const {
    title,
    description,
    challenges: generated = [],
    challengeType: sessionChallengeType,
    showDecimal: dataShowDecimal = true,
    showPartitionNumerals = true,
    showShadedReadout = true,
    showPromptGloss = true,
    supportTier,
    gradeBand,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;
  /** The lesson's items, each carrying the session's mode and tier (`barItems`). */
  const challenges = useMemo(() => barItems({ challenges: generated, challengeType: sessionChallengeType, supportTier }),
    [generated, sessionChallengeType, supportTier]);
  /** The open build: no numerator/denominator steps, the learner's own split, and no readout that would judge it. */
  const building = sessionChallengeType === 'build_equal';
  /** compare: two shaded bars and a symbol to pick; no decimal, which would answer it. */
  const comparing = sessionChallengeType === 'compare';
  const firstPhase: LearningPhase = building ? 'build-fraction' : comparing ? 'compare' : 'identify-numerator';
  const showDecimal = dataShowDecimal && !building && !comparing;

  const stableInstanceIdRef = useRef(instanceId || `fraction-bar-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Challenge progress (the runtime moves the index) ──
  const progress = useFractionBarProgress<FractionBarItem>({
    challenges,
    getChallengeId: (c) => c.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: fractionBarBoss.assignment!,
    // A fresh challenge starts from step one (the reset below). Try again keeps the step reached and clears
    // its work; an open build keeps the learner's bar and the verdict's words, to revise. The setters are declared
    // below; this runs only after render.
    onItemOpened: (_index, retry) => {
      if (!retry) { setPractice(null); return; }
      if (building) return;
      setSelectedRelation(null);
      setSelectedNumerator(null); setSelectedDenominator(null); setShadedCount(0);
      setFeedback(''); setFeedbackType('info');
    },
  });
  const {
    currentIndex,
    results,
    isComplete,
    recordResult,
  } = progress;
  workspaceClosed.current = progress.canAttempt === false;

  const sessionChallenge = challenges[currentIndex] ?? null;
  // The levers (`fractionBarLevers.ts`), keyed by the session item they were pulled on, and the easier practice item a
  // simplify lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<FractionBarItem | null>(null);
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  /** The tier's readout and numerals: starting positions on the three-step item, never pulls. */
  const startPulled = startLevers(sessionChallengeType, { readout: showShadedReadout, numerals: showPartitionNumerals });
  /** The levers on the session item, as the lever set reads them: the tier's starts and this item's pulls. */
  const shownLevers = Array.from(new Set([...startPulled, ...pulledLevers]));
  /** What is drawn: on a practice item only the tier's starts (the session item's pulls belong to it). */
  const drawn = practice ? startPulled : shownLevers;
  const leverOn = (id: string) => drawn.includes(id);
  const readoutOn = leverOn(STEP_COUNT_LEVER);
  const numeralsOn = leverOn(NUMBER_PARTS_LEVER);
  const model = !building && leverOn(MODEL_LEVER) && sessionChallenge ? modelFraction(sessionChallenge) : null;
  /** What is on screen: the easier practice item while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const numerator = currentChallenge?.numerator ?? 1;
  const denominator = currentChallenge?.denominator ?? 2;
  const numeratorChoices = currentChallenge?.numeratorChoices ?? [];
  const denominatorChoices = currentChallenge?.denominatorChoices ?? [];

  // ── Per-challenge interaction state (resets on advance) ────────
  const [currentPhase, setCurrentPhase] = useState<LearningPhase>(firstPhase);
  const [feedback, setFeedback] = useState<string>('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'hint' | 'info'>('info');

  const [selectedNumerator, setSelectedNumerator] = useState<number | null>(null);
  const [numeratorAttempts, setNumeratorAttempts] = useState(0);

  const [selectedDenominator, setSelectedDenominator] = useState<number | null>(null);
  const [denominatorAttempts, setDenominatorAttempts] = useState(0);

  const [selectedRelation, setSelectedRelation] = useState<CompareRelation | null>(null);
  const [compareAttempts, setCompareAttempts] = useState(0);

  const [shadedCount, setShadedCount] = useState(0);
  const [shadingChanges, setShadingChanges] = useState(0);
  const [buildAttempts, setBuildAttempts] = useState(0);

  // build_equal: the learner's bar as split and shaded, and whether the next tap cuts a part in half.
  const [pieces, setPieces] = useState<Piece[]>(wholeCircle);
  const [knife, setKnife] = useState(false);
  const buildSvgRef = useRef<SVGSVGElement | null>(null);
  const made = readBuild(pieces);

  const [challengeDone, setChallengeDone] = useState(false);

  const recordedRef = useRef(false);
  const sessionCompleteFiredRef = useRef(false);
  // Every checked response, for factual misconception evidence at submit.
  const responsesRef = useRef<FractionBarResponse[]>([]);

  // ── Reset every per-challenge slot when the active challenge changes ──
  // PRD §6c: missing any slot leaks state from challenge N into challenge N+1. Reset during the render that shows
  // the new challenge, not in an effect after it: a committed render with the old step on the new item would publish
  // a scene the next render replaces, and the workspace's visibility wait for the advance would end superseded.
  const [openedId, setOpenedId] = useState(currentChallenge?.id);
  if (currentChallenge && openedId !== currentChallenge.id) {
    setOpenedId(currentChallenge.id);
    setCurrentPhase(firstPhase);
    setSelectedRelation(null);
    setCompareAttempts(0);
    setFeedback('');
    setFeedbackType('info');
    setSelectedNumerator(null);
    setNumeratorAttempts(0);
    setSelectedDenominator(null);
    setDenominatorAttempts(0);
    setShadedCount(0);
    setShadingChanges(0);
    setBuildAttempts(0);
    setPieces(wholeCircle());
    setKnife(false);
    setChallengeDone(false);
    recordedRef.current = false;
  }

  // ── Evaluation hook ──────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<FractionBarMetrics>({
    primitiveType: 'fraction-bar',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── PhaseSummaryPanel: one row, aggregated by eval mode ────────
  const phaseResults = usePhaseResults({
    challenges,
    results,
    isComplete,
    getChallengeType: () => sessionChallengeType,
    phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) =>
      rs.length === 0
        ? 0
        : Math.round(rs.reduce((s, r) => s + Number(r.score ?? 0), 0) / rs.length),
  });

  // ── Per-challenge content match (stale-state guard, §6a #8) ────
  const stateMatchesChallenge = useCallback(
    (challenge: FractionBarChallenge | null): boolean => {
      if (!challenge) return false;
      return challenge.numerator === numerator && challenge.denominator === denominator;
    },
    [numerator, denominator],
  );

  // ── Per-challenge completion (called from submit handlers) ─────
  // An easier practice item (a simplify lever) is not the session's challenge: it records nothing.
  const completeCurrentChallenge = useCallback(
    (
      correct: boolean,
      score: number,
      totalAttempts: number,
      extras: Record<string, unknown> = {},
    ) => {
      if (!currentChallenge) return;
      setChallengeDone(true);
      if (practice) return;
      if (recordedRef.current) return;
      if (!stateMatchesChallenge(currentChallenge)) return;
      recordedRef.current = true;
      recordResult({
        challengeId: currentChallenge.id,
        correct,
        attempts: totalAttempts,
        score,
        hintsUsed: 0,
        ...extras,
      });
    },
    [currentChallenge, practice, stateMatchesChallenge, recordResult],
  );

  // ── Session complete → aggregate metrics + submitEvaluation ────
  // Submits once, and only under a lesson's evaluation provider (the live host has none).
  useEffect(() => {
    if (!isComplete) return;
    if (sessionCompleteFiredRef.current) return;
    if (challenges.length === 0) return;
    if (progress.recordsEvaluation === false) return;
    sessionCompleteFiredRef.current = true;

    const totalAttempts = results.reduce((s, r) => s + r.attempts, 0);
    const correctCount = results.filter((r) => r.correct).length;
    const firstTryCount = results.filter((r) => Number(r.score ?? 0) === 100).length;
    const hintsViewed = results.filter((r) => Number(r.hintsUsed ?? 0) > 0).length;
    const overallAccuracy = Math.round(
      results.reduce((s, r) => s + Number(r.score ?? 0), 0) / Math.max(1, results.length),
    );
    const averageAttemptsPerChallenge =
      Math.round((totalAttempts / Math.max(1, results.length)) * 10) / 10;

    const metrics: FractionBarMetrics = {
      type: 'fraction-bar',
      challengeType: sessionChallengeType,
      totalChallenges: challenges.length,
      correctCount,
      attemptsCount: totalAttempts,
      firstTryCount,
      hintsViewed,
      overallAccuracy,
      averageAttemptsPerChallenge,
    };

    if (!hasSubmittedEvaluation) {
      const goalMet = correctCount === challenges.length;
      submitEvaluation(goalMet, overallAccuracy, metrics, {
        studentWork: {
          challengeCount: challenges.length,
          challengeType: sessionChallengeType,
          fractions: challenges.map((c) => ({
            numerator: c.numerator,
            denominator: c.denominator,
          })),
          scoresPerChallenge: challenges.map((c) => {
            const r = results.find((rr) => rr.challengeId === c.id);
            return Number(r?.score ?? 0);
          }),
          responses: responsesRef.current.map(({ challengeId, phase, expected, selected, attempt }) =>
            ({ challengeId, phase, expected, selected, attempt })),
          ...(progress.teachingResult ? { teachingAttempts: progress.teachingResult.teachingAttempts,
            assistanceProvenance: progress.teachingResult.assistanceProvenance } : {}),
        },
      }, undefined, fractionBarDiagnosisEvidence(challenges.map((c) => c.id), responsesRef.current, sessionChallengeType, supportTier));
    }
  }, [
    isComplete, results, challenges, sessionChallengeType,
    submitEvaluation, hasSubmittedEvaluation, supportTier, progress.recordsEvaluation, progress.teachingResult,
  ]);

  /** The learner's work on the current step, as the workspace and the miss read it. */
  const view = (over: Partial<FractionBarView> = {}): FractionBarView => ({
    phase: currentPhase,
    picked: currentPhase === 'identify-numerator' ? selectedNumerator : selectedDenominator,
    ...(comparing ? { relation: selectedRelation } : {}),
    shaded: building ? made.shaded : shadedCount,
    ...(building ? { parts: made.pieces, equalParts: made.equal } : {}),
    readout: readoutOn,
    practice: !!practice,
    ...over,
  });

  /** A step's check; a right numerator or denominator only moves to the next step (the runtime, not a timer, owns the pace). */
  const commitStep = (correct: boolean, work: FractionBarView) => {
    if (!currentChallenge) return;
    if (!correct || work.phase === 'build-fraction' || work.phase === 'compare') {
      progress.commitCheck(describeWork(sessionChallengeType, currentChallenge, work), correct,
        correct ? undefined : building ? equalBuildMiss(currentChallenge, made) : fractionBarMiss(currentChallenge, work));
    }
  };
  const toPhase = (next: LearningPhase) => { setCurrentPhase(next); setFeedback(''); };

  // ── Phase 1: Check numerator ─────────────────────────────────
  const handleCheckNumerator = () => {
    if (learnerBlocked()) return;
    if (selectedNumerator === null || challengeDone) {
      if (selectedNumerator === null) {
        setFeedback('Please select an answer first!');
        setFeedbackType('error');
      }
      return;
    }
    const nextAttempts = numeratorAttempts + 1;
    setNumeratorAttempts(nextAttempts);
    if (currentChallenge && !practice) responsesRef.current.push({ challengeId: currentChallenge.id, numerator, denominator,
      phase: 'numerator', expected: numerator, selected: selectedNumerator, attempt: nextAttempts,
      hintsBefore: 0, choices: numeratorChoices });
    const correct = selectedNumerator === numerator;
    commitStep(correct, view({ phase: 'identify-numerator', picked: selectedNumerator }));

    if (correct) {
      SoundManager.playCorrect();
      toPhase('identify-denominator');
    } else {
      SoundManager.playIncorrect();
      setFeedback(
        `Not quite. The numerator is the top number in a fraction. In ${numerator}/${denominator}, look at which number is on top.`,
      );
      setFeedbackType('error');
    }
  };

  // ── Phase 2: Check denominator ───────────────────────────────
  const handleCheckDenominator = () => {
    if (learnerBlocked()) return;
    if (selectedDenominator === null || challengeDone) {
      if (selectedDenominator === null) {
        setFeedback('Please select an answer first!');
        setFeedbackType('error');
      }
      return;
    }
    const nextAttempts = denominatorAttempts + 1;
    setDenominatorAttempts(nextAttempts);
    if (currentChallenge && !practice) responsesRef.current.push({ challengeId: currentChallenge.id, numerator, denominator,
      phase: 'denominator', expected: denominator, selected: selectedDenominator, attempt: nextAttempts,
      hintsBefore: 0, choices: denominatorChoices });
    const correct = selectedDenominator === denominator;
    commitStep(correct, view({ phase: 'identify-denominator', picked: selectedDenominator }));

    if (correct) {
      SoundManager.playCorrect();
      toPhase('build-fraction');
    } else {
      SoundManager.playIncorrect();
      setFeedback(
        `Not quite. The denominator is the bottom number in a fraction. In ${numerator}/${denominator}, look at which number is on the bottom.`,
      );
      setFeedbackType('error');
    }
  };

  // ── compare: check the symbol picked between the two bars ──
  const second = currentChallenge?.compareWith;
  const handleCheckCompare = () => {
    if (learnerBlocked() || challengeDone || !currentChallenge || !second) return;
    if (selectedRelation === null) {
      setFeedback('Pick <, = or > first!');
      setFeedbackType('error');
      return;
    }
    const nextAttempts = compareAttempts + 1;
    setCompareAttempts(nextAttempts);
    if (!practice) responsesRef.current.push({ challengeId: currentChallenge.id, numerator, denominator, phase: 'compare',
      expected: currentChallenge.relation ?? '', selected: selectedRelation, attempt: nextAttempts,
      hintsBefore: 0, compareWith: second });
    const correct = selectedRelation === currentChallenge.relation;
    commitStep(correct, view({ phase: 'compare', relation: selectedRelation }));
    const statement = `${numerator}/${denominator} ${selectedRelation} ${second.numerator}/${second.denominator}`;
    if (correct) {
      SoundManager.playCorrect();
      setFeedback(`Yes! ${statement}.`);
      setFeedbackType('success');
      completeCurrentChallenge(true, phaseScore(nextAttempts), nextAttempts, { compareAttempts: nextAttempts });
    } else {
      SoundManager.playIncorrect();
      // Never the right symbol: the learner looks at the bars again.
      setFeedback(selectedRelation === '='
        ? 'Not quite. Look again: do the two bars have the same amount shaded?'
        : 'Not quite. Look again at how much of each bar is shaded.');
      setFeedbackType('error');
    }
  };

  // ── Phase 3: Toggle partition ────────────────────────────────
  const togglePartition = (partitionIndex: number) => {
    if (challengeDone || learnerBlocked()) return;
    SoundManager.tap();
    if (partitionIndex < shadedCount) {
      setShadedCount(partitionIndex);
    } else {
      setShadedCount(partitionIndex + 1);
    }
    setShadingChanges((p) => p + 1);
  };

  // ── Phase 3: Submit build ────────────────────────────────────
  const handleSubmitBuild = () => {
    if (challengeDone || !currentChallenge || learnerBlocked()) return;
    const nextBuildAttempts = buildAttempts + 1;
    setBuildAttempts(nextBuildAttempts);
    if (!practice) responsesRef.current.push({ challengeId: currentChallenge.id, numerator, denominator, phase: 'build',
      expected: numerator, selected: shadedCount, attempt: nextBuildAttempts, hintsBefore: 0 });

    const isCorrect = shadedCount === numerator;
    commitStep(isCorrect, view({ phase: 'build-fraction', shaded: shadedCount }));
    const selectedFraction = `${shadedCount}/${denominator}`;
    const targetFraction = `${numerator}/${denominator}`;

    if (!isCorrect) {
      SoundManager.playIncorrect();
      setFeedback(
        `You shaded ${shadedCount} out of ${denominator} parts, making ${selectedFraction}. The target is ${targetFraction}. Try shading exactly ${numerator} part${numerator !== 1 ? 's' : ''}!`,
      );
      setFeedbackType('error');
      return;
    }

    // ── Score each within-challenge phase ──
    const p1 = phaseScore(numeratorAttempts);
    const p2 = phaseScore(denominatorAttempts);
    const p3 = phaseScore(nextBuildAttempts);
    const score = Math.round((p1 + p2 + p3) / 3);

    SoundManager.playCorrect();
    setFeedback(
      `Excellent! You correctly built ${targetFraction} by shading ${numerator} out of ${denominator} equal parts!`,
    );
    setFeedbackType('success');

    const totalAttempts = numeratorAttempts + denominatorAttempts + nextBuildAttempts;
    completeCurrentChallenge(true, score, totalAttempts, {
      numeratorAttempts,
      denominatorAttempts,
      buildAttempts: nextBuildAttempts,
      shadingChanges,
    });
  };

  // ── Open build (build_equal): split, cut a part in half, shade; "I'm done!" commits ──
  const buildOpen = building && !challengeDone && !hasSubmittedEvaluation;
  const handleCut = (n: number) => {
    if (!buildOpen || learnerBlocked()) return;
    SoundManager.tap();
    setPieces(cutInto(n)); setKnife(false);
  };
  const handlePiece = (index: number) => {
    if (!buildOpen || learnerBlocked()) return;
    if (knife) {
      const next = halvePiece(pieces, index);
      if (!next) return;
      SoundManager.tap();
      setPieces(next);
      return;
    }
    SoundManager.toggle(!pieces[index]?.shaded);
    setPieces(toggleShade(pieces, index));
  };
  const handleDone = () => {
    if (!buildOpen || !currentChallenge || learnerBlocked()) return;
    const nextBuildAttempts = buildAttempts + 1;
    setBuildAttempts(nextBuildAttempts);
    const correct = makesEqual(currentChallenge, made);
    commitStep(correct, view());
    if (correct) {
      SoundManager.playCorrect();
      setFeedback(`Yes! ${made.shaded}/${made.pieces} is the same amount as ${numerator}/${denominator}.`);
      setFeedbackType('success');
      completeCurrentChallenge(true, phaseScore(nextBuildAttempts), nextBuildAttempts, { buildAttempts: nextBuildAttempts,
        partsCut: made.pieces, partsShaded: made.shaded });
    } else {
      SoundManager.playIncorrect();
      setFeedback(BUILD_EQUAL_FEEDBACK[equalBuildMiss(currentChallenge, made) ?? 'off_by_more']);
      setFeedbackType('error');
    }
  };
  // The live line (shared build layer): what the bar looks like so far, NEVER a number or a fraction word.
  const buildSeeing = useBuildWatcher({
    buildKey: pieces.map(p => `${p.start.toFixed(4)}${p.shaded ? '*' : ''}`).join('|'),
    enabled: buildOpen && progress.canAttempt !== false && (made.pieces > 1 || made.shaded > 0),
    svg: buildSvgRef,
    request: { task: currentChallenge?.instruction ?? '',
      sceneNote: 'A plain bar on a dark rectangle; the child splits it into parts and colors some purple.', numbers: 'never' },
  });

  // ── What the tutor and the observer are shown, republished every render ──
  useLayoutEffect(() => {
    if (!currentChallenge) return;
    const ctx = { band: gradeBand, phase: currentPhase };
    const levers = practice ? [] : FRACTION_BAR_LEVERS.declare(sessionChallenge, ctx, shownLevers);
    const clear = () => { setPieces(wholeCircle()); setKnife(false); setFeedback(''); setFeedbackType('info'); };
    workspace.current = { ...leverScene(workspaceScene(currentChallenge, view()), {
      support: practice ? '' : FRACTION_BAR_LEVERS.support(sessionChallenge, ctx),
      onScreen: FRACTION_BAR_LEVERS.onScreen(currentChallenge, ctx, drawn) }),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the bar changes before this returns.
      pullLever: id => {
        const lever = levers.find(l => l.id === id);
        if (practice || !sessionChallenge || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        if (lever.kind === 'simplify') {
          const easier = FRACTION_BAR_LEVERS.simpler(sessionChallenge, ctx, id);
          if (!easier) return 'There is no easier item for this one.';
          setLeverState({ item: sessionChallenge.id, pulled: [...pulledLevers, id] });
          setPractice(easier); clear();
          return { practice: fractionBarBoss.assignment!(easier) };
        }
        setLeverState({ item: sessionChallenge.id, pulled: [...pulledLevers, id] });
        return true;
      },
      endPractice: () => { setPractice(null); clear(); },
    };
  });

  // ── Helpers ──────────────────────────────────────────────────
  const feedbackColors: Record<typeof feedbackType, string> = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    error: 'bg-red-500/10 border-red-500/30 text-red-300',
    hint: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
    info: 'bg-white/5 border-white/10 text-slate-300',
  };

  const stepOpen = progress.canAttempt !== false;

  // ── Empty state ────────────────────────────────────────────────
  if (challenges.length === 0) {
    return (
      <div className={`w-full ${className || ''}`}>
        <div className="max-w-6xl mx-auto p-8 text-center text-slate-400">
          No fraction bar challenges available.
        </div>
      </div>
    );
  }

  // ── Session summary ────────────────────────────────────────────
  if (isComplete) {
    return (
      <div className={`w-full ${className || ''}`}>
        <div className="max-w-6xl mx-auto my-16">
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(progress.practiceSummary) ?? submittedResult?.score}
            durationMs={elapsedMs}
            heading="Fraction Bar Session Complete"
            celebrationMessage={
              results.every((r) => r.correct)
                ? 'Perfect! You built every fraction correctly.'
                : 'Great work — review the fractions you struggled with and try again next time.'
            }
          />
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className={`w-full ${className || ''}`}>
      <div className="max-w-6xl mx-auto glass-panel rounded-3xl border border-white/10 p-8 relative overflow-hidden shadow-2xl">
        {/* Ambient glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[150px] opacity-15 bg-purple-500" />

        <div className="relative z-10">
          {/* ── Header ─────────────────────────────────────── */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                Math:
              </span>
              <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-mono border bg-purple-500/20 text-purple-300 border-purple-500/30">
                FRACTION BAR
              </span>
              {practice && (
                <LuminaBadge accent="amber" className="text-[10px] uppercase tracking-wider">Practice</LuminaBadge>
              )}
            </div>
            <h2 className="text-3xl font-light text-white mb-3">{title}</h2>
            <p className="text-slate-300 leading-relaxed">{description}</p>
          </div>

          {/* ── Session progress dots ──────────────────────── */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {challenges.map((c, idx) => {
              const r = results.find((rr) => rr.challengeId === c.id);
              const isDone = !!r;
              const isCurrent = idx === currentIndex && !challengeDone;
              return (
                <div
                  key={c.id}
                  className={`flex items-center justify-center rounded-full border text-xs font-mono w-8 h-8 ${
                    isDone
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : isCurrent
                        ? 'bg-purple-500/20 text-purple-200 border-purple-400/50 shadow-lg scale-105'
                        : 'bg-white/5 text-slate-400 border-white/10'
                  }`}
                >
                  {idx + 1}
                </div>
              );
            })}
            <span className="ml-3 text-xs font-mono uppercase tracking-wider text-slate-400">
              Problem {currentIndex + 1} / {challenges.length}
            </span>
          </div>

          {/* ── Fraction display (constant reference; compare prints both fractions beside their bars) ── */}
          {!comparing && (
          <div className="flex justify-center mb-8">
            <div className="glass-panel rounded-2xl border border-purple-500/20 px-12 py-6 text-center">
              <div className="text-6xl font-bold text-white font-mono flex items-center justify-center gap-2">
                <span className="text-purple-300">{numerator}</span>
                <span className="text-slate-500 text-4xl">/</span>
                <span className="text-blue-300">{denominator}</span>
              </div>
              {showDecimal && (
                <div className="mt-2 text-sm text-slate-400 font-mono">
                  = {(numerator / denominator).toFixed(3)}
                </div>
              )}
            </div>
          </div>
          )}

          {/* ── model_fraction lever: a different fraction, its parts named and drawn; never this item's numbers ── */}
          {model && (
            <div className="flex flex-wrap items-center justify-center gap-6 mb-8 rounded-2xl border border-white/10 bg-slate-900/40 px-6 py-4"
              data-lever="model_fraction">
              <div className="grid grid-cols-[auto_auto] items-center gap-x-3 font-mono" aria-label={`Model fraction ${model.numerator}/${model.denominator}`}>
                <span className="text-3xl text-white text-center">{model.numerator}</span>
                <span className="text-sm text-purple-300">numerator</span>
                <span className="h-px bg-slate-400" />
                <span />
                <span className="text-3xl text-white text-center">{model.denominator}</span>
                <span className="text-sm text-blue-300">denominator</span>
              </div>
              <div className="flex h-10 w-48 overflow-hidden rounded border border-slate-500" data-model-bar>
                {Array.from({ length: model.denominator }).map((_, i) => (
                  <div key={i} className={`flex-1 border-r border-slate-500 last:border-r-0 ${i < model.numerator ? 'bg-slate-400' : 'bg-slate-800'}`}
                    data-model-part={i < model.numerator ? 'shaded' : 'empty'} />
                ))}
              </div>
            </div>
          )}

          {/* ── Within-challenge phase indicator (the three-step item) ── */}
          {!building && !comparing && (
          <div className="flex items-center justify-center gap-3 mb-8">
            <div
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-300 ${
                currentPhase === 'identify-numerator'
                  ? 'glass-panel border-white/30 text-white shadow-lg scale-105'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}
            >
              <span className="text-lg">
                {currentPhase === 'identify-numerator' ? '🔢' : '✅'}
              </span>
              <span className="font-medium text-sm">1. Numerator</span>
            </div>
            <div className="text-slate-600">{'→'}</div>

            <div
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-300 ${
                currentPhase === 'identify-denominator'
                  ? 'glass-panel border-white/30 text-white shadow-lg scale-105'
                  : currentPhase === 'build-fraction'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-white/5 border-white/10 text-slate-400'
              }`}
            >
              <span className="text-lg">
                {currentPhase === 'build-fraction'
                  ? '✅'
                  : '🔢'}
              </span>
              <span className="font-medium text-sm">2. Denominator</span>
            </div>
            <div className="text-slate-600">{'→'}</div>

            <div
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-300 ${
                currentPhase === 'build-fraction'
                  ? 'glass-panel border-white/30 text-white shadow-lg scale-105'
                  : 'bg-white/5 border-white/10 text-slate-400'
              }`}
            >
              <span className="text-lg">
                {challengeDone ? '✅' : '🎯'}
              </span>
              <span className="font-medium text-sm">3. Build It</span>
            </div>
          </div>
          )}

          {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the step panels as the
              workspace — never one button or one part. */}
          <PipDock />
          <PipWorkspace>
          {/* ═══════════════════════════════════════════════════
              Phase 1 — Identify the Numerator
             ═══════════════════════════════════════════════════ */}
          {!building && currentPhase === 'identify-numerator' && !challengeDone && (
            <div className="glass-panel rounded-2xl border border-purple-500/30 p-6 mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
              <div className="pt-2">
                <h3 className="text-xl font-light text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">{'🔢'}</span>
                  Step 1: Identify the Numerator
                </h3>
                <p className="text-slate-300 leading-relaxed mb-6">
                  In the fraction{' '}
                  <span className="font-mono font-bold text-purple-300">
                    {numerator}/{denominator}
                  </span>
                  , which number is the{' '}
                  <span className="text-purple-300 font-semibold">numerator</span>
                  {showPromptGloss && ' (the top number)'}?
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {numeratorChoices.map((choice, idx) => (
                    <button
                      key={`${choice}-${idx}`}
                      onClick={() => { if (learnerBlocked()) return; SoundManager.select(); setSelectedNumerator(choice); }}
                      className={`p-4 rounded-xl border text-center transition-all duration-300 text-2xl font-bold font-mono ${
                        selectedNumerator === choice
                          ? 'glass-panel border-purple-400/50 text-purple-300 shadow-lg scale-105'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      {choice}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleCheckNumerator}
                  disabled={selectedNumerator === null || !stepOpen}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-medium py-3 px-6 rounded-xl disabled:bg-white/10 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.02]"
                >
                  Check Answer
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════
              Phase 2 — Identify the Denominator
             ═══════════════════════════════════════════════════ */}
          {!building && currentPhase === 'identify-denominator' && !challengeDone && (
            <div className="glass-panel rounded-2xl border border-blue-500/30 p-6 mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
              <div className="pt-2">
                <h3 className="text-xl font-light text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">{'🔢'}</span>
                  Step 2: Identify the Denominator
                </h3>
                <p className="text-slate-300 leading-relaxed mb-6">
                  In the fraction{' '}
                  <span className="font-mono font-bold text-blue-300">
                    {numerator}/{denominator}
                  </span>
                  , which number is the{' '}
                  <span className="text-blue-300 font-semibold">denominator</span>
                  {showPromptGloss && ' (the bottom number)'}?
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {denominatorChoices.map((choice, idx) => (
                    <button
                      key={`${choice}-${idx}`}
                      onClick={() => { if (learnerBlocked()) return; SoundManager.select(); setSelectedDenominator(choice); }}
                      className={`p-4 rounded-xl border text-center transition-all duration-300 text-2xl font-bold font-mono ${
                        selectedDenominator === choice
                          ? 'glass-panel border-blue-400/50 text-blue-300 shadow-lg scale-105'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      {choice}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleCheckDenominator}
                  disabled={selectedDenominator === null || !stepOpen}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-6 rounded-xl disabled:bg-white/10 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.02]"
                >
                  Check Answer
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════
              Phase 3 — Build the Fraction on the Bar
             ═══════════════════════════════════════════════════ */}
          {!building && currentPhase === 'build-fraction' && !challengeDone && (
            <div className="glass-panel rounded-2xl border border-emerald-500/30 p-6 mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <div className="pt-2">
                <h3 className="text-xl font-light text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">{'🎯'}</span>
                  Step 3: Build the Fraction
                </h3>
                <p className="text-slate-300 leading-relaxed mb-6">
                  Now shade exactly{' '}
                  <span className="text-purple-300 font-bold">{numerator}</span> out of{' '}
                  <span className="text-blue-300 font-bold">{denominator}</span> equal parts to
                  build the fraction{' '}
                  <span className="font-mono font-bold text-white">
                    {numerator}/{denominator}
                  </span>
                  .
                </p>

                {/* running_count lever (or the tier's readout): the learner's own count, never coloured by the verdict.
                    Withdrawn at the hard tier so the student shades from the fraction alone. */}
                {readoutOn && (
                  <div className="flex items-center justify-between mb-4" data-lever="running_count">
                    <div className="text-lg font-mono text-white">
                      Shaded:{' '}
                      <span className="font-bold text-purple-300">
                        {shadedCount}
                      </span>
                      <span className="text-slate-500">/{denominator}</span>
                    </div>
                    <div className="text-sm text-slate-400">
                      Target:{' '}
                      <span className="font-mono text-white">
                        {numerator}/{denominator}
                      </span>
                    </div>
                  </div>
                )}

                {/* The fraction bar */}
                <div className="flex border-2 border-slate-600 rounded-lg overflow-hidden h-20 shadow-lg mb-4"
                  {...(numeralsOn && denominator <= 12 ? { 'data-lever': 'number_parts' } : {})}>
                  {Array.from({ length: denominator }).map((_, i) => {
                    const isShaded = i < shadedCount;
                    return (
                      <button
                        key={i}
                        data-pip-object={`part-${i}`}
                        onClick={() => togglePartition(i)}
                        disabled={challengeDone}
                        className={`flex-1 border-r border-slate-600 last:border-r-0 transition-all duration-200 flex items-center justify-center ${
                          challengeDone
                            ? 'cursor-default'
                            : 'cursor-pointer hover:brightness-110'
                        } ${
                          isShaded
                            ? 'bg-gradient-to-br from-purple-500 to-purple-600'
                            : 'bg-slate-700/50 hover:bg-slate-700'
                        }`}
                        title={`${isShaded ? 'Unshade' : 'Shade'} part ${i + 1}`}
                      >
                        {numeralsOn && denominator <= 12 && (
                          <span className="text-xs text-white/40 font-mono">{i + 1}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {showDecimal && (
                  <div className="text-xs text-slate-400 text-right font-mono mb-4">
                    {'≈'} {(shadedCount / denominator).toFixed(3)}
                  </div>
                )}

                <button
                  onClick={handleSubmitBuild}
                  disabled={challengeDone || !stepOpen}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-6 rounded-xl transition-all duration-300 hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Submit Fraction
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════
              compare — two bars of the same whole, a symbol between
             ═══════════════════════════════════════════════════ */}
          {comparing && currentChallenge && second && (
            <div className="glass-panel rounded-2xl border border-blue-500/30 p-6 mb-6 relative overflow-hidden" data-compare>
              <p className="text-slate-300 leading-relaxed mb-6 text-center">
                Both bars are the same whole. Pick the sign that makes the statement true.
              </p>
              <div className="flex flex-col gap-4 mb-6">
                {[{ n: numerator, d: denominator, key: 'top' }, { n: second.numerator, d: second.denominator, key: 'bottom' }].map(bar => (
                  <div key={bar.key} className="flex items-center gap-4" data-compare-bar={bar.key}>
                    <span className="w-16 shrink-0 text-right text-2xl font-bold font-mono text-white">{bar.n}/{bar.d}</span>
                    <div className="flex flex-1 border-2 border-slate-600 rounded-lg overflow-hidden h-14">
                      {Array.from({ length: bar.d }).map((_, i) => (
                        <div key={i} data-part={i < bar.n ? 'shaded' : 'empty'}
                          className={`flex-1 border-r border-slate-600 last:border-r-0 flex items-center justify-center ${
                            i < bar.n ? 'bg-gradient-to-br from-purple-500 to-purple-600' : 'bg-slate-700/50'}`}>
                          {showPartitionNumerals && <span className="text-xs text-white/40 font-mono">{i + 1}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-4 mb-6 text-3xl font-bold font-mono text-white">
                <span>{numerator}/{denominator}</span>
                <span className="min-w-12 rounded-lg border border-white/20 px-3 text-center text-blue-300">{selectedRelation ?? '?'}</span>
                <span>{second.numerator}/{second.denominator}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-6" role="group" aria-label="Pick a sign">
                {RELATIONS.map(r => (
                  <button key={r} aria-label={r === '<' ? 'less than' : r === '>' ? 'greater than' : 'equal to'}
                    onClick={() => { if (learnerBlocked() || challengeDone) return; SoundManager.select(); setSelectedRelation(r); }}
                    disabled={challengeDone}
                    className={`p-4 rounded-xl border text-center transition-all duration-300 text-3xl font-bold font-mono ${
                      selectedRelation === r
                        ? 'glass-panel border-blue-400/50 text-blue-300 shadow-lg scale-105'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20'}`}>
                    {r}
                  </button>
                ))}
              </div>
              {!challengeDone && (
                <button onClick={handleCheckCompare} disabled={selectedRelation === null || !stepOpen}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-6 rounded-xl disabled:bg-white/10 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.02]">
                  Check Answer
                </button>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════
              build_equal — the learner's own bar (open build)
             ═══════════════════════════════════════════════════ */}
          {building && currentChallenge && (
            <div className="glass-panel rounded-2xl border border-purple-500/30 p-6 mb-6 relative overflow-hidden">
              <div className="flex flex-col items-center gap-3">
                <p className="text-slate-200 leading-relaxed text-center">{currentChallenge.instruction}</p>
                <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Split the bar">
                  <span className="text-slate-300 text-sm">Split into equal parts:</span>
                  {cutsFor(gradeBand).map(n => (
                    <LuminaButton key={n} tone={made.equal && made.pieces === n ? 'primary' : 'ghost'} disabled={!buildOpen}
                      aria-label={`Split into ${n} equal parts`} onClick={() => handleCut(n)}>{n}</LuminaButton>
                  ))}
                  <LuminaButton tone={knife ? 'primary' : 'ghost'} disabled={!buildOpen || made.pieces < 2} aria-pressed={knife}
                    onClick={() => { if (!learnerBlocked()) setKnife(k => !k); }}>
                    ✂️ Cut a part in half
                  </LuminaButton>
                </div>
                <FractionBarEqualScene ref={buildSvgRef} pieces={pieces} knife={knife} disabled={!buildOpen} onPiece={handlePiece} />
                {/* show_reference lever: the target as a picture under the learner's bar, which it never touches */}
                {leverOn(REFERENCE_LEVER) && (
                  <div className="flex w-full flex-col items-center gap-1" data-lever="show_reference">
                    <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox={`0 0 ${BAR_W} ${BAR_H / 2}`} style={{ maxWidth: BAR_W }}
                      aria-label="Reference bar">
                      {barParts(cutInto(currentChallenge.denominator).map((p, i) => ({ ...p, shaded: i < currentChallenge.numerator })),
                        8, BAR_H / 2 - 16, () => ({}), '#64748b')}
                    </svg>
                    <span className="text-slate-400 text-xs">{currentChallenge.numerator}/{currentChallenge.denominator}</span>
                  </div>
                )}
                {/* running_count lever: the learner's own parts and shading. Never the target, never "equal". */}
                {leverOn(STEP_COUNT_LEVER) && (
                  <p className="text-slate-300 text-sm" data-lever="running_count">
                    {made.pieces} {made.pieces === 1 ? 'part' : 'parts'}, {made.shaded} shaded
                  </p>
                )}
                <div className="flex min-h-8 items-center justify-center" aria-live="polite" data-testid="build-watcher">
                  {buildSeeing && <span className="rounded-full bg-white/10 px-4 py-1.5 text-base text-amber-100">👀 {buildSeeing}</span>}
                </div>
                {!challengeDone && (
                  <LuminaButton tone="primary" disabled={!buildOpen || made.pieces < 2 || made.shaded < 1 || !stepOpen}
                    onClick={handleDone}>
                    I&apos;m done!
                  </LuminaButton>
                )}
              </div>
            </div>
          )}
          </PipWorkspace>

          {/* ── Feedback bar ───────────────────────────────── */}
          {feedback && (
            <div
              className={`p-4 rounded-xl mb-6 border transition-all duration-300 ${feedbackColors[feedbackType]}`}
            >
              {feedback}
            </div>
          )}

          {/* ── Between-challenge interstitial (the runtime advances) ── */}
          {challengeDone && !practice && (
            <div className="glass-panel rounded-2xl border border-emerald-500/30 p-6 mb-6">
              <h4 className="text-lg font-bold text-emerald-300 mb-4">
                &#x2713; Problem {currentIndex + 1} complete!
              </h4>
              {!building && !comparing && (
                <p className="text-sm text-slate-300">
                  You correctly built the fraction{' '}
                  <span className="font-bold text-white">
                    {numerator}/{denominator}
                  </span>{' '}
                  by shading {numerator} out of {denominator} equal parts.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const FractionBar = withWorkspaceOnly<FractionBarProps>('fraction-bar', FractionBarSurface, props => props.data.title);

export default FractionBar;
