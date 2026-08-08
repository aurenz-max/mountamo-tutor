'use client';

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { ConstellationBuilderMetrics } from '../../../evaluation/types';
import { LuminaReadAloud } from '../../../ui';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

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

/**
 * F1 (all tiers, defect fix — not a tier lever): static pad pool for the
 * seasonal option collapse. The generator only requires distractors for
 * identify challenges, so a lone seasonal challenge can arrive with a single
 * option — unanswerable as a discrimination. Real constellation names only.
 */
const SEASONAL_NAME_POOL = ['Orion', 'Ursa Major', 'Cassiopeia', 'Leo', 'Scorpius', 'Lyra'];

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

// =============================================================================
// Main Component
// =============================================================================

const ConstellationBuilder: React.FC<ConstellationBuilderProps> = ({ data, className }) => {
  const {
    title,
    description,
    gradeLevel,
    stars,
    challenges,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
  } = data;

  // reader-fit: the instruction line, the constellation names, the "Tap star 3
  // of 5" counter and the Star Lore card are all text a K-1 child cannot read,
  // and this primitive had NO channel to the tutor at all — the catalog
  // tutoring block reached the backend with every contextKey "(not set)" and
  // zero moments wired, so the tutor went silent after the greeting.
  const isPreReader = gradeLevel === 'K' || gradeLevel === '1';

  // Evaluation hook
  const resolvedInstanceId = instanceId ?? 'constellation-builder-default';
  const { submitResult } = usePrimitiveEvaluation<ConstellationBuilderMetrics>({
    primitiveType: 'constellation-builder',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
  });

  // Timer
  const startTimeRef = useRef(Date.now());

  // Challenge progress (shared hook)
  const {
    currentIndex: currentChallengeIndex,
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
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // Current challenge
  const currentChallenge = challenges[currentChallengeIndex] ?? null;

  // ── Support tier (generator-stamped from config.difficulty) ──
  // Absent field → full-support legacy render, byte-identical to 'easy'.
  const supportTier = data.supportTier ?? null;
  /** L1: bright `#fffbe6` fill + forced opacity-1 member-star highlight — easy/legacy only. */
  const highlightMembers = supportTier === null || supportTier === 'easy';
  /** L2/L3 withdrawal gate — medium and hard withdraw the same supports here. */
  const tierWithdrawn = supportTier === 'medium' || supportTier === 'hard';

  // Per-challenge local state
  const [drawnConnections, setDrawnConnections] = useState<ConnectionLine[]>([]);
  const [selectedStarId, setSelectedStarId] = useState<string | null>(null);
  const [guidedStep, setGuidedStep] = useState(0); // for guided_trace: which star in order
  /** Last star the student touched — a catalog contextKey the tutor reads. */
  const [lastStarTapped, setLastStarTapped] = useState<string>('none yet');
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
    setLastStarTapped('none yet');
    setShowMythology(false);
    setIdentifyAnswer(null);
    setSeasonalSelections([]);
    setFeedback(null);
  }, []);

  // Get constellation stars for the current challenge
  const constellationStarIds = useMemo(() => {
    if (!currentChallenge) return new Set<string>();
    const ids = new Set<string>();
    for (const conn of currentChallenge.correctConnections) {
      ids.add(conn.fromStarId);
      ids.add(conn.toStarId);
    }
    return ids;
  }, [currentChallenge]);

  // ---------------------------------------------------------------------------
  // Tutor channel (reader-fit)
  // ---------------------------------------------------------------------------

  /** How many stars of the target pattern the student has placed so far. */
  const connectedCount = currentChallenge?.type === 'guided_trace'
    ? guidedStep
    : drawnConnections.length;
  /** Stars in the target pattern — starOrder when present, else derived from the lines. */
  const totalStars = currentChallenge
    ? (currentChallenge.starOrder.length || currentChallenge.correctConnections.length + 1)
    : 0;

  // Flat object literal — a bag assembled behind statements makes tutor-test
  // report every contextKey as "dynamic, verify at runtime".
  const aiPrimitiveData = useMemo(() => ({
    title,
    gradeLevel,
    constellationName: currentChallenge?.constellationName ?? 'a star pattern',
    connectedCount,
    totalStars,
    evalMode: currentChallenge?.type ?? 'guided_trace',
    season: currentChallenge?.season ?? 'year-round',
    lastStarTapped,
    mythologyFact: currentChallenge?.mythologyFact ?? '',
    instruction: currentChallenge?.instruction ?? '',
  }), [title, gradeLevel, currentChallenge, connectedCount, totalStars, lastStarTapped]);

  const { sendText } = useLuminaAI({
    primitiveType: 'constellation-builder',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: isPreReader ? 'kindergarten' : 'elementary',
  });

  // `silent` suppresses only the chat-transcript entry; the tutor still speaks.
  const readAloud = useCallback((text: string) => {
    if (!text) return;
    sendText(
      `[CONSTELLATION_READ_ALOUD] The young learner tapped "read it to me" and cannot read the screen. `
      + `Read this aloud, word for word, warmly and slowly: "${text}". Then wait.`,
      { silent: true },
    );
  }, [sendText]);

  // ORIENT — fires once so a non-reader learns the task without having to ask.
  const hasOrientedRef = useRef(false);
  useEffect(() => {
    if (hasOrientedRef.current || !currentChallenge) return;
    hasOrientedRef.current = true;
    sendText(
      `[CONSTELLATION_ORIENT] A ${isPreReader ? 'pre-reader who cannot read any text' : 'student'} just opened `
      + `a star-pattern activity: "${title}". The screen reads: "${currentChallenge.instruction}". `
      + `Say that aloud in child words — they tap stars in the sky to draw ${currentChallenge.constellationName}. `
      + `Do NOT say which star to tap; the screen already rings it.`,
      { silent: true },
    );
  }, [sendText, isPreReader, title, currentChallenge]);

  // The instruction line and the whole sky change when the challenge does, and a
  // non-reader cannot see that the words changed. Skips the first run — ORIENT
  // already covered it.
  const lastChallengeIdRef = useRef(currentChallenge?.id);
  useEffect(() => {
    if (!currentChallenge) return;
    if (lastChallengeIdRef.current === currentChallenge.id) return;
    lastChallengeIdRef.current = currentChallenge.id;
    sendText(
      `[CONSTELLATION_CHALLENGE_CHANGED] The sky just changed to a new pattern, ${currentChallenge.constellationName}, `
      + `and the screen now reads: "${currentChallenge.instruction}". SAY that aloud in child words. `
      + `Do not tell them which star to tap.`,
      { silent: true },
    );
  }, [sendText, currentChallenge]);

  // Check if current connections match the target
  const isConstellationComplete = useMemo(() => {
    if (!currentChallenge) return false;
    const target = currentChallenge.correctConnections;
    if (drawnConnections.length < target.length) return false;

    // Check that all target connections exist (order-independent for lines)
    return target.every(tc =>
      drawnConnections.some(dc =>
        (dc.fromStarId === tc.fromStarId && dc.toStarId === tc.toStarId) ||
        (dc.fromStarId === tc.toStarId && dc.toStarId === tc.fromStarId)
      )
    );
  }, [currentChallenge, drawnConnections]);

  // Auto-complete detection for trace/connect modes.
  //
  // Latched per challenge id. `isConstellationComplete` STAYS true once the
  // pattern is traced, so without the latch this body re-runs on every change to
  // any dep — re-firing SoundManager, re-setting `feedback` to a fresh object
  // (which itself re-renders), and re-sending the celebration beat, so the tutor
  // would read the star story again and again. It also makes the effect immune
  // to a `sendText` whose identity is not stable: an unstable one turned this
  // into a render loop that OOM-killed a vitest worker.
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

    // The Star Lore card that just appeared is silent text at K-1. This is the
    // STIMULUS beat: the fact only reaches a non-reader if the tutor reads it.
    sendText(
      `[CONSTELLATION_COMPLETE] They finished ${currentChallenge.constellationName}! Celebrate warmly by name, `
      + `then read this star story aloud, word for word — it is on screen as text they cannot read: `
      + `"${currentChallenge.mythologyFact}"`
      + `${isPreReader ? ' Finish by telling them to tap the big button to go on — they cannot read its label either.' : ''}`,
      { silent: true },
    );

    const score = Math.max(0, 100 - (currentAttempts * 10));
    recordResult({
      challengeId: currentChallenge.id,
      correct: true,
      attempts: currentAttempts + 1,
      score,
    });
  }, [isConstellationComplete, currentChallenge, currentAttempts, recordResult, sendText, isPreReader]);

  // ----- Interaction handlers -----

  const handleStarClick = useCallback((starId: string) => {
    if (!currentChallenge) return;
    if (currentChallenge.type === 'identify' || currentChallenge.type === 'seasonal') return;

    setLastStarTapped(starId);

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
        incrementAttempts();
        // L3: specific directive hint at easy/legacy, generic (never silent) at medium/hard
        // At K-1 the step counter is gone and the only affordance is the pulsing
        // ring, so "the numbered star" names something that is not on screen —
        // and it is the line an adult sitting alongside would read out. Match the
        // register the tutor uses in [CONSTELLATION_WRONG_STAR].
        setFeedback({
          type: 'hint',
          message: tierWithdrawn
            ? GENERIC_HINT
            : isPreReader
              ? 'Look for the star with the sparkly circle!'
              : 'Look for the numbered star!',
        });
        // The correction above is text a non-reader cannot read, and the sound
        // alone does not say what to do instead.
        sendText(
          `[CONSTELLATION_WRONG_STAR] They tapped a star that is not the next one in `
          + `${currentChallenge.constellationName}. Send them back to the star with the pulsing ring — `
          + `say "look for the star with the sparkly circle around it". Do NOT name it or say where it is.`,
          { silent: true },
        );
      }
      return;
    }

    // Free connect: tap star A, then star B to draw a line
    if (currentChallenge.type === 'free_connect') {
      if (!constellationStarIds.has(starId)) {
        incrementAttempts();
        // L3: the discriminating-feature hint ("brighter") is easy/legacy support
        setFeedback({ type: 'wrong', message: tierWithdrawn ? GENERIC_HINT : 'That star isn\'t part of this constellation. Try a brighter one!' });
        sendText(
          `[CONSTELLATION_WRONG_STAR] They tapped a dim background star that is not part of `
          + `${currentChallenge.constellationName}. Tell them warmly to look for a brighter one. `
          + `Do NOT name the star or say where it is.`,
          { silent: true },
        );
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

      // Check if this connection is valid
      const isValid = currentChallenge.correctConnections.some(tc =>
        (tc.fromStarId === selectedStarId && tc.toStarId === starId) ||
        (tc.fromStarId === starId && tc.toStarId === selectedStarId)
      );

      if (isValid) {
        const alreadyDrawn = drawnConnections.some(dc =>
          (dc.fromStarId === selectedStarId && dc.toStarId === starId) ||
          (dc.fromStarId === starId && dc.toStarId === selectedStarId)
        );
        if (!alreadyDrawn) {
          setDrawnConnections(prev => [...prev, { fromStarId: selectedStarId!, toStarId: starId }]);
        }
        setFeedback(null);
      } else {
        incrementAttempts();
        // L3: specific pair hint at easy/legacy, generic at medium/hard
        setFeedback({ type: 'wrong', message: tierWithdrawn ? GENERIC_HINT : 'Those two stars aren\'t connected in this constellation.' });
      }
      setSelectedStarId(null);
    }
  }, [currentChallenge, guidedStep, selectedStarId, constellationStarIds, drawnConnections, incrementAttempts, tierWithdrawn, sendText, isPreReader]);

  // Handle identify mode answer
  const handleIdentifyAnswer = useCallback((answer: string) => {
    if (!currentChallenge || currentChallenge.type !== 'identify') return;
    setIdentifyAnswer(answer);

    const correct = answer === currentChallenge.constellationName;
    if (correct) {
      SoundManager.playCorrect();
      setFeedback({ type: 'correct', message: `Yes! That\'s ${currentChallenge.constellationName}!` });
      setShowMythology(true);
    } else {
      SoundManager.playIncorrect();
      incrementAttempts();
      setFeedback({ type: 'wrong', message: 'Not quite. Look at the shape of the lines carefully.' });
    }

    const score = correct ? Math.max(0, 100 - (currentAttempts * 15)) : 0;
    recordResult({
      challengeId: currentChallenge.id,
      correct,
      attempts: currentAttempts + 1,
      score,
    });
  }, [currentChallenge, currentAttempts, incrementAttempts, recordResult]);

  // Handle seasonal mode
  const handleSeasonalToggle = useCallback((constellationName: string) => {
    setSeasonalSelections(prev =>
      prev.includes(constellationName)
        ? prev.filter(n => n !== constellationName)
        : [...prev, constellationName]
    );
  }, []);

  const handleSeasonalSubmit = useCallback(() => {
    if (!currentChallenge || currentChallenge.type !== 'seasonal') return;

    // For seasonal: the correct answer is the current challenge's constellation name
    const correct = seasonalSelections.includes(currentChallenge.constellationName) && seasonalSelections.length === 1;
    if (correct) {
      SoundManager.playCorrect();
      setFeedback({ type: 'correct', message: `Correct! ${currentChallenge.constellationName} is visible in ${currentChallenge.season}.` });
      setShowMythology(true);
    } else {
      SoundManager.playIncorrect();
      incrementAttempts();
      setFeedback({ type: 'wrong', message: `Not quite. Think about which constellations are visible in ${currentChallenge.season}.` });
    }

    const score = correct ? Math.max(0, 100 - (currentAttempts * 15)) : 0;
    recordResult({
      challengeId: currentChallenge.id,
      correct,
      attempts: currentAttempts + 1,
      score,
    });
  }, [currentChallenge, seasonalSelections, currentAttempts, incrementAttempts, recordResult]);

  // Advance to next challenge
  const handleNext = useCallback(() => {
    resetChallengeState();
    if (!advanceProgress()) {
      // All challenges complete — submit evaluation
      const elapsedMs = Date.now() - startTimeRef.current;
      const totalCorrect = challengeResults.filter(r => r.correct).length;
      const overallScore = Math.round(
        challengeResults.reduce((sum, r) => sum + (r.score ?? (r.correct ? 100 : 0)), 0) / challengeResults.length
      );

      const metrics: ConstellationBuilderMetrics = {
        type: 'constellation-builder',
        totalChallenges: challenges.length,
        correctChallenges: totalCorrect,
        totalAttempts: challengeResults.reduce((sum, r) => sum + r.attempts, 0),
        accuracy: totalCorrect / challenges.length,
        averageScore: overallScore,
        durationMs: elapsedMs,
      };

      setSubmittedResult({ score: overallScore });
      submitResult(
        totalCorrect === challenges.length,
        overallScore,
        metrics,
      );
    }
  }, [advanceProgress, resetChallengeState, challengeResults, challenges, submitResult]);

  // Get star position for SVG
  const getStarPos = useCallback((starId: string) => {
    const star = stars.find(s => s.id === starId);
    if (!star) return { cx: 0, cy: 0 };
    return { cx: star.x * 6, cy: star.y * 4.5 }; // Scale to 600x450 viewport
  }, [stars]);

  // ----- Identify mode options -----
  const identifyOptions = useMemo(() => {
    if (!currentChallenge || currentChallenge.type !== 'identify') return [];
    const opts = [currentChallenge.constellationName];
    if (currentChallenge.distractorName0) opts.push(currentChallenge.distractorName0);
    if (currentChallenge.distractorName1) opts.push(currentChallenge.distractorName1);
    if (currentChallenge.distractorName2) opts.push(currentChallenge.distractorName2);
    // Shuffle
    return opts.sort(() => Math.random() - 0.5);
  }, [currentChallenge]);

  // Seasonal options (constellation names from all challenges of this type)
  const seasonalOptions = useMemo(() => {
    if (!currentChallenge || currentChallenge.type !== 'seasonal') return [];
    const allNames = challenges
      .filter(c => c.type === 'seasonal')
      .map(c => c.constellationName);
    const distractors: string[] = [];
    if (currentChallenge.distractorName0) distractors.push(currentChallenge.distractorName0);
    if (currentChallenge.distractorName1) distractors.push(currentChallenge.distractorName1);
    if (currentChallenge.distractorName2) distractors.push(currentChallenge.distractorName2);
    const options = Array.from(new Set([...allNames, ...distractors]));
    // F1 (all tiers): a collapsed pool (<2 options) is unanswerable as a
    // discrimination — pad deterministically from the static pool up to 3
    // options. The correct answer is always retained (options only grow).
    if (options.length < 2) {
      const existing = new Set(options);
      for (const name of SEASONAL_NAME_POOL) {
        if (options.length >= 3) break;
        if (name === currentChallenge.constellationName || existing.has(name)) continue;
        options.push(name);
      }
    }
    return options.sort(() => Math.random() - 0.5);
  }, [currentChallenge, challenges]);

  // Overall score for display
  const localOverallScore = useMemo(() => {
    if (challengeResults.length === 0) return 0;
    return Math.round(
      challengeResults.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0) / challengeResults.length
    );
  }, [challengeResults]);

  const elapsedMs = Date.now() - startTimeRef.current;

  // Check if current challenge is answered (for Next button visibility)
  const currentChallengeAnswered = useMemo(() => {
    if (!currentChallenge) return false;
    return challengeResults.some(r => r.challengeId === currentChallenge.id);
  }, [currentChallenge, challengeResults]);

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className ?? ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-slate-100">{title}</CardTitle>
            <CardDescription className="text-slate-400">{description}</CardDescription>
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
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Constellation Challenge Complete!"
            celebrationMessage="You mapped the stars!"
            className="mb-6"
          />
        )}

        {/* Current challenge instruction */}
        {currentChallenge && !allChallengesComplete && (
          <>
            <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <p className={`flex-1 text-slate-200 font-medium ${isPreReader ? 'text-base' : 'text-sm'}`}>
                  {currentChallenge.instruction}
                </p>
                {isPreReader && (
                  <LuminaReadAloud
                    iconOnly
                    size="sm"
                    aria-label="Hear what to do"
                    onClick={() => readAloud(currentChallenge.instruction)}
                  />
                )}
              </div>
              {/* "Tap star 3 of 5" is a step counter — adult chrome at K-1, and the
                  pulsing ring on the SVG already says which star is next without
                  a word. Kept from grade 2, where the count is part of the task. */}
              {currentChallenge.type === 'guided_trace' && currentChallenge.starOrder.length > 0 && !isPreReader && (
                <p className="text-slate-400 text-xs mt-1">
                  Tap star {guidedStep + 1} of {currentChallenge.starOrder.length}
                </p>
              )}
              {currentChallenge.type === 'free_connect' && selectedStarId && (
                <p className="text-blue-300 text-xs mt-1">
                  Star selected — tap another star to draw a line
                </p>
              )}
            </div>

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
                  {stars.map((star) => {
                    const cx = star.x * 6;
                    const cy = star.y * 4.5;
                    const r = starRadius(star.magnitude);
                    const opacity = starOpacity(star.magnitude, star.isPartOfConstellation, highlightMembers);
                    const isSelected = star.id === selectedStarId;
                    const isGuidedTarget = currentChallenge.type === 'guided_trace' &&
                      currentChallenge.starOrder[guidedStep] === star.id;
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

            {/* Identify mode: name selection buttons */}
            {currentChallenge.type === 'identify' && (
              <div className="flex flex-wrap gap-2">
                {identifyOptions.map((name) => {
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
                  {seasonalOptions.map((name) => {
                    const isSelected = seasonalSelections.includes(name);
                    return (
                      <Button
                        key={name}
                        variant="ghost"
                        className={`bg-white/5 border border-white/20 hover:bg-white/10 ${
                          isSelected ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300' : 'text-slate-200'
                        }`}
                        disabled={currentChallengeAnswered}
                        onClick={() => handleSeasonalToggle(name)}
                      >
                        {name}
                      </Button>
                    );
                  })}
                </div>
                {!currentChallengeAnswered && (
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

            {/* Mythology card */}
            {showMythology && currentChallenge.mythologyFact && (
              <div className="bg-indigo-500/10 border border-indigo-400/20 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <p className="flex-1 text-indigo-200 text-xs font-medium mb-1">
                    {isPreReader ? '✨ Star Lore' : 'Star Lore'}
                  </p>
                  {/* The [CONSTELLATION_COMPLETE] beat already reads this aloud once;
                      the button is the replay a non-reader needs to hear it again. */}
                  {isPreReader && (
                    <LuminaReadAloud
                      iconOnly
                      size="sm"
                      aria-label="Hear the star story"
                      onClick={() => readAloud(currentChallenge.mythologyFact)}
                    />
                  )}
                </div>
                <p className="text-slate-300 text-sm">{currentChallenge.mythologyFact}</p>
              </div>
            )}

            {/* Next / Continue button */}
            {currentChallengeAnswered && !allChallengesComplete && (
              <Button
                variant="ghost"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200 w-full"
                onClick={handleNext}
              >
                {currentChallengeIndex < challenges.length - 1 ? 'Next Constellation' : 'See Results'}
              </Button>
            )}

            {/* Final submit when on last challenge and answered */}
            {currentChallengeAnswered && currentChallengeIndex === challenges.length - 1 && !submittedResult && (
              <Button
                variant="ghost"
                className="bg-emerald-500/10 border border-emerald-400/20 hover:bg-emerald-500/20 text-emerald-300 w-full"
                onClick={handleNext}
              >
                Submit Results
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ConstellationBuilder;
