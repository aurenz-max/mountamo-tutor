'use client';

/**
 * Constellation Builder: trace a constellation by tapping its stars, name a drawn one, or name the one a season shows.
 *
 * Taught only on the shared teaching workspace (boss: `constellationBuilder.card.ts` + `constellationBuilder.boss.ts`):
 * `constellationWorkspace.ts` holds the items, options, scene, checks and misses; `constellationLevers.ts` the lever
 * set. The activity's own checks commit through `progress.commitCheck`, and the runtime owns Try again and Next. An
 * unbound mount shows the shared "needs the tutor" card.
 */
import React, { useState, useRef, useCallback, useMemo, useEffect, useLayoutEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { ConstellationBuilderMetrics } from '../../../evaluation/types';
import { usePhaseResults, practiceScore, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { constellationBuilderBoss } from './constellationBuilder.boss';
import {
  constellationItems, describeNames, describeTrace, freeMiss, guidedMiss, isPatternLine, maskAnswer, nameCorrect, nameMiss,
  nameOptions as optionsOf, patternStars, shownInstruction, traceComplete, workspaceScene,
} from './constellationWorkspace';
import {
  BRIGHT_STARS_LEVER, CONSTELLATION_LEVERS, PRACTICE_NOTE, SHAPE_CARD_LEVER, SPOTLIGHT_LEVER, shapeCardLines,
} from './constellationLevers';

// =============================================================================
// Type Definitions — Single Source of Truth
// =============================================================================

export type ChallengeType = 'guided_trace' | 'free_connect' | 'identify' | 'seasonal';

export interface StarData {
  id: string;
  x: number; // 0-100 percentage of field width
  y: number; // 0-100 percentage of field height
  magnitude: number; // 1-6 (lower = brighter)
  isPartOfConstellation: boolean;
}

export interface ConnectionLine {
  fromStarId: string;
  toStarId: string;
}

export interface ConstellationChallenge {
  id: string;
  type: ChallengeType;
  constellationName: string;
  instruction: string;
  /** Star IDs in correct connection order (for guided_trace) */
  starOrder: string[];
  /** The correct connections to draw */
  correctConnections: ConnectionLine[];
  mythologyFact: string;
  season: string;
  /** Distractor constellation names (for identify mode) */
  distractorName0?: string;
  distractorName1?: string;
  distractorName2?: string;
  /** An easier practice item (`easier_pattern`) carries its own star field, in place of the session's. */
  stars?: StarData[];
  /** The names on screen: an easier practice item's two, or a seasonal item's, stamped from the lesson (`constellationItems`). */
  choices?: string[];
}

export interface ConstellationBuilderData {
  title: string;
  description: string;
  gradeLevel: string;

  /**
   * Within-mode support tier stamped by the generator from config.difficulty.
   * Render-side withdrawal ONLY (member-star highlight, distractor-star
   * interactivity, hint specificity) — never content. Absent → full-support
   * legacy render, identical to 'easy'.
   */
  supportTier?: 'easy' | 'medium' | 'hard';

  stars: StarData[];
  challenges: ConstellationChallenge[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ConstellationBuilderMetrics>) => void;
}

interface ConstellationBuilderProps {
  data: ConstellationBuilderData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// =============================================================================
// Phase config for multi-phase hooks
// =============================================================================

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  guided_trace: { label: 'Guided Trace', icon: '1️⃣', accentColor: 'blue' },
  free_connect:  { label: 'Free Connect',  icon: '🔗', accentColor: 'purple' },
  identify:      { label: 'Identify',      icon: '🏷️', accentColor: 'emerald' },
  seasonal:      { label: 'Seasonal',      icon: '🌌', accentColor: 'cyan' },
};

// =============================================================================
// Support-tier constants
// =============================================================================

/** L3 (medium/hard): generic-but-never-silent feedback — the K-5 floor. */
const GENERIC_HINT = 'Not quite — try again.';

// =============================================================================
// Helper: compute star visual size from magnitude
// =============================================================================

function starRadius(magnitude: number): number {
  // magnitude 1 → 5px, magnitude 6 → 1.5px
  return Math.max(1.5, 6 - magnitude * 0.8);
}

function starOpacity(magnitude: number, isConstellation: boolean, highlightMembers: boolean): number {
  // L1 (support tier): forcing member stars to full opacity is an easy/legacy
  // support. At medium/hard the tier withdraws it — opacity comes from
  // magnitude alone, so membership carries no opacity signal.
  if (isConstellation && highlightMembers) return 1;
  // Stars dim with magnitude (higher magnitude = dimmer star)
  return Math.max(0.25, 1 - magnitude * 0.15);
}

/** shape_card lever: the pattern's lines and stars only, on a small card beside the sky. */
const ShapeCard: React.FC<{ challenge: ConstellationChallenge; stars: StarData[] }> = ({ challenge, stars }) => {
  const { lines, dots } = shapeCardLines(challenge, stars, 160, 120);
  return (
    <div data-lever="shape-card" className="flex justify-center">
      <svg viewBox="0 0 160 120" width={160} height={120} className="rounded-md border border-white/10 bg-slate-950" aria-hidden="true">
        {lines.map((l, i) => <line key={i} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} stroke="#a78bfa" strokeWidth={2} />)}
        {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={3.5} fill="#fffbe6" />)}
      </svg>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

const useConstellationProgress = useWorkspaceProgressFor('constellation-builder');

const ConstellationBuilderSurface = ({ data, className, runtimePlanItemId }: ConstellationBuilderProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    gradeLevel,
    stars,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
  } = data;

  // The lesson's items: each seasonal challenge carries its choices, built from the whole lesson.
  const challenges = useMemo(() => constellationItems(data), [data]);

  // reader-fit: the instruction line, the constellation names, the "Tap star 3 of 5" counter and the Star Lore card
  // are text a K-1 child cannot read; the tutor reads them from the scene.
  const isPreReader = gradeLevel === 'K' || gradeLevel === '1';

  // Evaluation hook
  const resolvedInstanceId = instanceId ?? 'constellation-builder-default';
  const evaluation = usePrimitiveEvaluation<ConstellationBuilderMetrics>({
    primitiveType: 'constellation-builder',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
  });
  const { submitResult } = evaluation;

  // Timer
  const startTimeRef = useRef(Date.now());

  // Challenge progress. The runtime moves the index; a fresh item and Try again clear the work (bound below), and a
  // spoken name the observer credited is shown as a tapped one (`onSolved`).
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  /** Bound below; an answer the observer credited on the simplify lever's practice item. */
  const practiceAloud = useRef<(source: 'speech' | 'gesture') => void>(() => {});
  /** The challenge a correct tap already recorded, so its `onSolved` records nothing twice. */
  const tappedCorrect = useRef<string | null>(null);
  const progress = useConstellationProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: constellationBuilderBoss.assignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
    onSolved: (index) => solvedAloud.current(index),
    onPracticeSolved: (_id, source) => practiceAloud.current(source),
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    mergeResult,
  } = progress;
  /** A checked answer stays closed until Try again or Next challenge on the shell. */
  const workspaceClosed = useRef(false);
  workspaceClosed.current = progress.canAttempt === false;
  const learnerBlocked = () => workspaceClosed.current;
  // The activity's own check is the workspace's checked gesture. A ref, so the check callbacks keep their deps.
  const commitCheck = useRef(progress.commitCheck);
  commitCheck.current = progress.commitCheck;

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // The session's challenge, and what is on screen: the easier item while a simplify lever holds it.
  const sessionChallenge = challenges[currentChallengeIndex] ?? null;
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<ConstellationChallenge | null>(null);
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  /** A runtime pull, on the session item only; never drawn on a practice item. */
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);
  /** The stars on screen: a practice item brings its own field. */
  const fieldStars = currentChallenge?.stars ?? stars;

  // ── Support tier (generator-stamped from config.difficulty) ──
  // Absent field → full-support legacy render, byte-identical to 'easy'.
  const supportTier = data.supportTier ?? null;
  /** L1: bright `#fffbe6` fill + forced opacity-1 member-star highlight — easy/legacy only. */
  const tierHighlight = supportTier === null || supportTier === 'easy';
  /** The member highlight on screen: the tier's, or the bright_stars lever's. */
  const highlightMembers = tierHighlight || leverOn(BRIGHT_STARS_LEVER);
  /** L2/L3 withdrawal gate — medium and hard withdraw the same supports here. */
  const tierWithdrawn = supportTier === 'medium' || supportTier === 'hard';
  const spotlight = leverOn(SPOTLIGHT_LEVER);

  // Per-challenge local state
  const [drawnConnections, setDrawnConnections] = useState<ConnectionLine[]>([]);
  const [selectedStarId, setSelectedStarId] = useState<string | null>(null);
  const [guidedStep, setGuidedStep] = useState(0); // for guided_trace: which star in order
  const [showMythology, setShowMythology] = useState(false);
  const [identifyAnswer, setIdentifyAnswer] = useState<string | null>(null);
  const [seasonalSelections, setSeasonalSelections] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'correct' | 'wrong' | 'hint'; message: string } | null>(null);
  const [submittedResult, setSubmittedResult] = useState<{ score: number } | null>(null);

  // SVG ref for coordinate calculations
  const svgRef = useRef<SVGSVGElement>(null);

  // Reset local state when advancing to next challenge
  const resetChallengeState = useCallback(() => {
    setDrawnConnections([]);
    setSelectedStarId(null);
    setGuidedStep(0);
    setShowMythology(false);
    setIdentifyAnswer(null);
    setSeasonalSelections([]);
    setFeedback(null);
  }, []);
  /** Try again: the lines already drawn stay (every drawn line is a right one); the wrong tap and the choice go. */
  const clearAttempt = useCallback(() => {
    setSelectedStarId(null);
    setIdentifyAnswer(null);
    setSeasonalSelections([]);
    setFeedback(null);
  }, []);
  // A fresh item (or the full item back after a practice item) drops the practice and starts blank; Try again keeps
  // the practice and the lines drawn on it.
  openItem.current = (_index, retry) => {
    if (retry) { clearAttempt(); return; }
    setPractice(null); resetChallengeState();
  };

  // Get constellation stars for the current challenge
  const constellationStarIds = useMemo(
    () => currentChallenge ? patternStars(currentChallenge) : new Set<string>(),
    [currentChallenge],
  );

  // Check if current connections match the target
  const isConstellationComplete = useMemo(
    () => !!currentChallenge && traceComplete(currentChallenge, drawnConnections),
    [currentChallenge, drawnConnections],
  );

  // Auto-complete detection for trace/connect modes.
  //
  // Latched per challenge id. `isConstellationComplete` STAYS true once the
  // pattern is traced, so without the latch this body re-runs on every change to
  // any dep — re-firing SoundManager, re-setting `feedback` to a fresh object
  // (which itself re-renders), and committing the check again.
  const completedChallengeIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentChallenge) return;
    if (currentChallenge.type !== 'guided_trace' && currentChallenge.type !== 'free_connect') return;
    if (!isConstellationComplete) return;
    if (completedChallengeIdRef.current === currentChallenge.id) return;
    completedChallengeIdRef.current = currentChallenge.id;

    SoundManager.playCorrect();
    setShowMythology(true);
    setFeedback({ type: 'correct', message: `You traced ${currentChallenge.constellationName}!` });

    // The checked gesture: counts the attempt and records the result.
    commitCheck.current(describeTrace(currentChallenge, drawnConnections.length), true);
    if (!practice) {
      mergeResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        score: Math.max(0, 100 - (currentAttempts * 10)),
      });
    }
  }, [isConstellationComplete, currentChallenge, currentAttempts, mergeResult, drawnConnections.length, practice]);

  // ----- Interaction handlers -----

  const handleStarClick = useCallback((starId: string) => {
    if (!currentChallenge || learnerBlocked()) return;
    if (currentChallenge.type === 'identify' || currentChallenge.type === 'seasonal') return;
    if (isConstellationComplete) return;

    // Guided trace: stars must be tapped in order
    if (currentChallenge.type === 'guided_trace') {
      const order = currentChallenge.starOrder;
      const expectedStarId = order[guidedStep];

      if (starId === expectedStarId) {
        // Correct star in sequence
        SoundManager.tap();
        if (guidedStep > 0) {
          const prevStarId = order[guidedStep - 1];
          setDrawnConnections(prev => [...prev, { fromStarId: prevStarId, toStarId: starId }]);
        }
        setGuidedStep(prev => prev + 1);
        setFeedback(null);
      } else {
        SoundManager.invalid();
        const miss = guidedMiss(currentChallenge, guidedStep, starId);
        commitCheck.current(describeTrace(currentChallenge, drawnConnections.length, miss), false, miss);
        // L3: specific directive hint at easy/legacy, generic (never silent) at medium/hard
        // At K-1 the step counter is gone and the only affordance is the pulsing
        // ring, so "the numbered star" names something that is not on screen —
        // and it is the line an adult sitting alongside would read out.
        setFeedback({
          type: 'hint',
          message: tierWithdrawn
            ? GENERIC_HINT
            : isPreReader
              ? 'Look for the star with the sparkly circle!'
              : 'Look for the numbered star!',
        });
      }
      return;
    }

    // Free connect: tap star A, then star B to draw a line
    if (currentChallenge.type === 'free_connect') {
      if (!constellationStarIds.has(starId)) {
        commitCheck.current(describeTrace(currentChallenge, drawnConnections.length, 'background_star'), false, 'background_star');
        // L3: the discriminating-feature hint ("brighter") is easy/legacy support
        setFeedback({ type: 'wrong', message: tierWithdrawn ? GENERIC_HINT : 'That star isn\'t part of this constellation. Try a brighter one!' });
        setSelectedStarId(null);
        return;
      }

      if (!selectedStarId) {
        setSelectedStarId(starId);
        setFeedback(null);
        return;
      }

      if (starId === selectedStarId) {
        setSelectedStarId(null);
        return;
      }

      if (isPatternLine(currentChallenge, selectedStarId, starId)) {
        const alreadyDrawn = drawnConnections.some(dc =>
          (dc.fromStarId === selectedStarId && dc.toStarId === starId) ||
          (dc.fromStarId === starId && dc.toStarId === selectedStarId)
        );
        if (!alreadyDrawn) {
          setDrawnConnections(prev => [...prev, { fromStarId: selectedStarId!, toStarId: starId }]);
        }
        setFeedback(null);
      } else {
        const miss = freeMiss(currentChallenge, starId);
        commitCheck.current(describeTrace(currentChallenge, drawnConnections.length, miss), false, miss);
        // L3: specific pair hint at easy/legacy, generic at medium/hard
        setFeedback({ type: 'wrong', message: tierWithdrawn ? GENERIC_HINT : 'Those two stars aren\'t connected in this constellation.' });
      }
      setSelectedStarId(null);
    }
  }, [currentChallenge, guidedStep, selectedStarId, constellationStarIds, drawnConnections, tierWithdrawn, isPreReader, isConstellationComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle identify mode answer
  const handleIdentifyAnswer = useCallback((answer: string) => {
    if (!currentChallenge || currentChallenge.type !== 'identify' || identifyAnswer || learnerBlocked()) return;
    setIdentifyAnswer(answer);

    const correct = nameCorrect(currentChallenge, [answer]);
    if (correct) {
      tappedCorrect.current = currentChallenge.id;
      SoundManager.playCorrect();
      setFeedback({ type: 'correct', message: `Yes! That\'s ${currentChallenge.constellationName}!` });
      setShowMythology(true);
    } else {
      SoundManager.playIncorrect();
      setFeedback({ type: 'wrong', message: 'Not quite. Look at the shape of the lines carefully.' });
    }

    commitCheck.current(describeNames([answer]), correct, nameMiss(currentChallenge, [answer]));
    if (practice) return;
    // A miss reopens with Try again; only the credited answer is recorded.
    if (correct) mergeResult({ challengeId: currentChallenge.id, correct, attempts: currentAttempts + 1, score: Math.max(0, 100 - (currentAttempts * 15)) });
  }, [currentChallenge, currentAttempts, identifyAnswer, mergeResult, practice]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle seasonal mode
  const handleSeasonalToggle = useCallback((constellationName: string) => {
    if (learnerBlocked()) return;
    setSeasonalSelections(prev =>
      prev.includes(constellationName)
        ? prev.filter(n => n !== constellationName)
        : [...prev, constellationName]
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSeasonalSubmit = useCallback(() => {
    if (!currentChallenge || currentChallenge.type !== 'seasonal' || learnerBlocked() || feedback?.type === 'correct') return;

    const correct = nameCorrect(currentChallenge, seasonalSelections);
    if (correct) {
      tappedCorrect.current = currentChallenge.id;
      SoundManager.playCorrect();
      setFeedback({ type: 'correct', message: `Correct! ${currentChallenge.constellationName} is visible in ${currentChallenge.season}.` });
      setShowMythology(true);
    } else {
      SoundManager.playIncorrect();
      setFeedback({ type: 'wrong', message: `Not quite. Think about which constellations are visible in ${currentChallenge.season}.` });
    }

    commitCheck.current(describeNames(seasonalSelections), correct, nameMiss(currentChallenge, seasonalSelections));
    if (practice) return;
    if (correct) mergeResult({ challengeId: currentChallenge.id, correct, attempts: currentAttempts + 1, score: Math.max(0, 100 - (currentAttempts * 15)) });
  }, [currentChallenge, seasonalSelections, currentAttempts, mergeResult, practice, feedback]); // eslint-disable-line react-hooks/exhaustive-deps

  // A spoken name the observer credited (`onSolved` fires once per challenge, for a tap too): the result a correct
  // tap records, and the name shown as a correct tap shows it. The shared lifecycle plays the success sound.
  solvedAloud.current = (index) => {
    const solved = challenges[index];
    if (!solved || (solved.type !== 'identify' && solved.type !== 'seasonal') || tappedCorrect.current === solved.id) return;
    tappedCorrect.current = solved.id;
    mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1, score: Math.max(0, 100 - (currentAttempts * 15)) });
    if (solved.type === 'identify') setIdentifyAnswer(solved.constellationName);
    else setSeasonalSelections([solved.constellationName]);
    setFeedback({ type: 'correct', message: `Yes! That\'s ${solved.constellationName}!` });
    setShowMythology(true);
  };

  // A spoken answer credited on the practice item: shown there as on a session item, recorded nowhere. The full item
  // comes back blank when the practice closes. A tap shows its own credit in the check.
  practiceAloud.current = (source) => {
    if (source !== 'speech' || !practice || (practice.type !== 'identify' && practice.type !== 'seasonal')) return;
    if (practice.type === 'identify') setIdentifyAnswer(practice.constellationName);
    else setSeasonalSelections([practice.constellationName]);
    setFeedback({ type: 'correct', message: `Yes! That's ${practice.constellationName}!` });
    setShowMythology(true);
  };

  // Under a lesson's evaluation provider only: the scored session, whose item scores count corrections and whose
  // evidence carries each wrong check's named miss.
  finish.current = (result) => {
    if (evaluation.hasSubmitted || challenges.length === 0) return;
    const metrics: ConstellationBuilderMetrics = {
      type: 'constellation-builder',
      totalChallenges: challenges.length,
      correctChallenges: result.solvedCount,
      totalAttempts: result.attemptsCount,
      accuracy: result.solvedCount / challenges.length,
      averageScore: result.accuracy,
      durationMs: Date.now() - startTimeRef.current,
    };
    setSubmittedResult({ score: result.accuracy });
    submitResult(result.passed, result.accuracy, metrics,
      { studentWork: { challengeCount: challenges.length, instructions: challenges.map((c) => shownInstruction(c)) },
        challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // Get star position for SVG
  const getStarPos = useCallback((starId: string) => {
    const star = fieldStars.find(s => s.id === starId);
    if (!star) return { cx: 0, cy: 0 };
    return { cx: star.x * 6, cy: star.y * 4.5 }; // Scale to 600x450 viewport
  }, [fieldStars]);

  // ----- Choices, built in code in a stable order -----
  const nameOptions = useMemo(() => (currentChallenge ? optionsOf(currentChallenge) : []), [currentChallenge]);

  // Overall score for display
  const localOverallScore = useMemo(() => {
    if (challengeResults.length === 0) return 0;
    return Math.round(
      challengeResults.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0) / challengeResults.length
    );
  }, [challengeResults]);

  const elapsedMs = Date.now() - startTimeRef.current;
  const solved = feedback?.type === 'correct';

  // What the tutor and the observer are shown, republished every render. No demonstration targets and no
  // presentation; the lever set (`CONSTELLATION_LEVERS`) writes the levers and their facts.
  useLayoutEffect(() => {
    if (!currentChallenge || !sessionChallenge || allChallengesComplete) return;
    const drawn = workspaceScene(currentChallenge, {
      drawn: drawnConnections.length, numbered: true, selected: !!selectedStarId, membersBright: highlightMembers,
      dimTappable: tierWithdrawn && currentChallenge.type === 'free_connect', preReader: isPreReader,
      chosen: currentChallenge.type === 'identify' ? (identifyAnswer ? [identifyAnswer] : []) : seasonalSelections, solved,
    });
    const scene = { ...drawn, facts: { ...drawn.facts, ...(practice ? { practice: PRACTICE_NOTE } : {}) } };
    const ctx = { membersBright: tierHighlight };
    const onScreen = practice ? '' : CONSTELLATION_LEVERS.onScreen(sessionChallenge, ctx, pulledLevers);
    const levers = practice ? [] : CONSTELLATION_LEVERS.declare(sessionChallenge, ctx, pulledLevers);
    workspace.current = {
      ...leverScene(scene, { support: CONSTELLATION_LEVERS.support(practice ? null : sessionChallenge, ctx), onScreen }),
      levers,
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = CONSTELLATION_LEVERS.simpler(sessionChallenge, ctx, id);
          if (!easier) return 'This item has no easier version; try a help lever.';
          // The practice item and the full item share no work: both start blank.
          setLeverState(pulled); resetChallengeState(); setPractice(easier);
          return { practice: constellationBuilderBoss.assignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); resetChallengeState(); },
    };
  });

  // The session item's name stays masked while its easier practice item is on screen.
  const shownTitle = maskAnswer(maskAnswer(title, sessionChallenge), practice);
  const shownDescription = maskAnswer(maskAnswer(description, sessionChallenge), practice);

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className ?? ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-slate-100">{shownTitle}</CardTitle>
            <CardDescription className="text-slate-400">{shownDescription}</CardDescription>
          </div>
          {/* Band contract rule 7: a score-ledger counter is adult chrome in the
              child's field, and "2 / 4" is a progress claim a pre-reader cannot
              use. Hidden by conditional render at K-1 (never Tailwind `hidden`,
              which leaves it in the a11y tree). */}
          {challenges.length > 1 && !isPreReader && (
            <Badge variant="outline" className="border-white/20 text-slate-300">
              {Math.min(currentChallengeIndex + 1, challenges.length)} / {challenges.length}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Phase summary when complete */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localOverallScore)}
            durationMs={elapsedMs}
            heading="Constellation Challenge Complete!"
            celebrationMessage="You mapped the stars!"
            className="mb-6"
          />
        )}

        {/* Current challenge instruction */}
        {currentChallenge && !allChallengesComplete && (
          <>
            {practice ? <div className="text-center text-xs text-amber-300" data-practice>Practice</div> : null}
            <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-3">
              <p className={`text-slate-200 font-medium ${isPreReader ? 'text-base' : 'text-sm'}`}>
                {shownInstruction(currentChallenge)}
              </p>
              {/* "Tap star 3 of 5" is a step counter — adult chrome at K-1, and the
                  pulsing ring on the SVG already says which star is next without
                  a word. Kept from grade 2, where the count is part of the task. */}
              {currentChallenge.type === 'guided_trace' && currentChallenge.starOrder.length > 0 && !isPreReader && (
                <p className="text-slate-400 text-xs mt-1">
                  Tap star {Math.min(guidedStep + 1, currentChallenge.starOrder.length)} of {currentChallenge.starOrder.length}
                </p>
              )}
              {currentChallenge.type === 'free_connect' && selectedStarId && (
                <p className="text-blue-300 text-xs mt-1">
                  Star selected — tap another star to draw a line
                </p>
              )}
            </div>

            {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above the activity, and the
                activity as one region, never a single star or name. */}
            <PipDock />
            <PipWorkspace className="space-y-4">
            {/* Star field */}
            {(currentChallenge.type === 'guided_trace' || currentChallenge.type === 'free_connect' || currentChallenge.type === 'identify') && (
              <div className="relative bg-slate-950 rounded-lg border border-white/10 overflow-hidden">
                <svg
                  ref={svgRef}
                  viewBox="0 0 600 450"
                  className="w-full h-auto cursor-crosshair"
                  style={{ minHeight: 300 }}
                >
                  {/* Background glow */}
                  <defs>
                    <radialGradient id="starGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#ffd700" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#ffd700" stopOpacity="0" />
                    </radialGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Drawn connections */}
                  {drawnConnections.map((conn, i) => {
                    const from = getStarPos(conn.fromStarId);
                    const to = getStarPos(conn.toStarId);
                    return (
                      <line
                        key={`conn-${i}`}
                        x1={from.cx}
                        y1={from.cy}
                        x2={to.cx}
                        y2={to.cy}
                        stroke="#ffd700"
                        strokeWidth={2}
                        strokeOpacity={0.8}
                        filter="url(#glow)"
                      />
                    );
                  })}

                  {/* For identify mode: show all correct connections */}
                  {currentChallenge.type === 'identify' && currentChallenge.correctConnections.map((conn, i) => {
                    const from = getStarPos(conn.fromStarId);
                    const to = getStarPos(conn.toStarId);
                    return (
                      <line
                        key={`target-${i}`}
                        x1={from.cx}
                        y1={from.cy}
                        x2={to.cx}
                        y2={to.cy}
                        stroke="#60a5fa"
                        strokeWidth={2}
                        strokeOpacity={0.7}
                      />
                    );
                  })}

                  {/* Stars */}
                  {fieldStars.map((star) => {
                    const cx = star.x * 6;
                    const cy = star.y * 4.5;
                    const r = starRadius(star.magnitude);
                    const isSelected = star.id === selectedStarId;
                    const isGuidedTarget = currentChallenge.type === 'guided_trace' &&
                      currentChallenge.starOrder[guidedStep] === star.id;
                    // spotlight lever: every star but the ringed one and the ones already joined fades.
                    const traced = currentChallenge.type === 'guided_trace' &&
                      currentChallenge.starOrder.indexOf(star.id) > -1 && currentChallenge.starOrder.indexOf(star.id) < guidedStep;
                    const faded = spotlight && !isGuidedTarget && !traced;
                    const opacity = faded ? 0.12 : starOpacity(star.magnitude, star.isPartOfConstellation, highlightMembers);
                    // L2 (medium/hard, free_connect ONLY): background stars become
                    // clickable — a wrong tap costs an attempt via the existing
                    // wrong-star branch in handleStarClick, whose membership source
                    // (constellationStarIds, derived from correctConnections) is the
                    // checker's own. guided_trace stays inert for non-members (order
                    // is the task); identify stays non-interactive by design.
                    const isInteractive = currentChallenge.type !== 'identify' &&
                      (star.isPartOfConstellation ||
                        (tierWithdrawn && currentChallenge.type === 'free_connect'));

                    return (
                      <g key={star.id}>
                        {/* Selection ring */}
                        {isSelected && (
                          <circle cx={cx} cy={cy} r={r + 6} fill="none" stroke="#60a5fa" strokeWidth={1.5} opacity={0.8} />
                        )}
                        {/* Guided target indicator */}
                        {isGuidedTarget && (
                          <>
                            <circle cx={cx} cy={cy} r={r + 10} fill="none" stroke="#34d399" strokeWidth={1} opacity={0.5} strokeDasharray="3,3">
                              <animate attributeName="r" from={String(r + 8)} to={String(r + 14)} dur="1.5s" repeatCount="indefinite" />
                              <animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite" />
                            </circle>
                            {spotlight && (
                              <circle data-lever="spotlight-ring" cx={cx} cy={cy} r={r + 18} fill="none" stroke="#34d399" strokeWidth={2.5} opacity={0.9} />
                            )}
                            <text x={cx} y={cy - r - 6} textAnchor="middle" fill="#34d399" fontSize="10" fontWeight="bold">
                              {guidedStep + 1}
                            </text>
                          </>
                        )}
                        {/* Star dot — L1: the bright member fill is easy/legacy support;
                            at medium/hard all stars share the uniform background fill
                            (magnitude alone drives the render — no membership signal) */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r}
                          fill={star.isPartOfConstellation && highlightMembers ? '#fffbe6' : '#e2e8f0'}
                          opacity={opacity}
                          className={isInteractive ? 'cursor-pointer' : ''}
                          onClick={() => isInteractive && handleStarClick(star.id)}
                        />
                        {/* Clickable area (larger for touch targets) */}
                        {isInteractive && (
                          <circle
                            data-pip-object={`star-${star.id}`}
                            cx={cx}
                            cy={cy}
                            r={Math.max(r + 8, 12)}
                            fill="transparent"
                            className="cursor-pointer"
                            onClick={() => handleStarClick(star.id)}
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}

            {/* shape_card lever: the pattern's shape beside the sky, no field position */}
            {currentChallenge.type === 'free_connect' && leverOn(SHAPE_CARD_LEVER) && (
              <ShapeCard challenge={currentChallenge} stars={fieldStars} />
            )}

            {/* Identify mode: name selection buttons */}
            {currentChallenge.type === 'identify' && (
              <div className="flex flex-wrap gap-2">
                {nameOptions.map((name) => {
                  const isChosen = identifyAnswer === name;
                  const isCorrect = isChosen && name === currentChallenge.constellationName;
                  const isWrong = isChosen && name !== currentChallenge.constellationName;
                  return (
                    <Button
                      key={name}
                      variant="ghost"
                      className={`bg-white/5 border border-white/20 hover:bg-white/10 ${
                        isCorrect ? 'border-green-400 bg-green-400/10 text-green-300' :
                        isWrong ? 'border-red-400 bg-red-400/10 text-red-300' :
                        'text-slate-200'
                      }`}
                      disabled={!!identifyAnswer}
                      onClick={() => handleIdentifyAnswer(name)}
                    >
                      {name}
                    </Button>
                  );
                })}
              </div>
            )}

            {/* Seasonal mode: constellation checklist */}
            {currentChallenge.type === 'seasonal' && (
              <div className="space-y-3">
                <p className="text-slate-300 text-sm">
                  Season: <span className="text-cyan-300 font-medium">{currentChallenge.season}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {nameOptions.map((name) => {
                    const isSelected = seasonalSelections.includes(name);
                    return (
                      <Button
                        key={name}
                        variant="ghost"
                        className={`bg-white/5 border border-white/20 hover:bg-white/10 ${
                          isSelected ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300' : 'text-slate-200'
                        }`}
                        disabled={solved}
                        onClick={() => handleSeasonalToggle(name)}
                      >
                        {name}
                      </Button>
                    );
                  })}
                </div>
                {!solved && (
                  <Button
                    variant="ghost"
                    className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                    onClick={handleSeasonalSubmit}
                    disabled={seasonalSelections.length === 0}
                  >
                    Check Answer
                  </Button>
                )}
              </div>
            )}

            </PipWorkspace>

            {/* Feedback message */}
            {feedback && (
              <div className={`rounded-lg px-4 py-2 text-sm ${
                feedback.type === 'correct' ? 'bg-green-400/10 border border-green-400/30 text-green-300' :
                feedback.type === 'wrong' ? 'bg-red-400/10 border border-red-400/30 text-red-300' :
                'bg-blue-400/10 border border-blue-400/30 text-blue-300'
              }`}>
                {feedback.message}
              </div>
            )}

            {/* Mythology card; the tutor reads it from the scene's star story once the answer is credited. */}
            {showMythology && currentChallenge.mythologyFact && (
              <div className="bg-indigo-500/10 border border-indigo-400/20 rounded-lg px-4 py-3">
                <p className="text-indigo-200 text-xs font-medium mb-1">
                  {isPreReader ? '✨ Star Lore' : 'Star Lore'}
                </p>
                <p className="text-slate-300 text-sm">{currentChallenge.mythologyFact}</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

const ConstellationBuilder = withWorkspaceOnly<ConstellationBuilderProps>('constellation-builder', ConstellationBuilderSurface,
  (props) => props.data.title);

export default ConstellationBuilder;
