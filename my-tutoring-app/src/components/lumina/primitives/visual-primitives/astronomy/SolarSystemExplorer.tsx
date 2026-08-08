'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { LuminaReadAloud } from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { SolarSystemExplorerMetrics } from '../../../evaluation/types';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// Export data interface - single source of truth
export interface CelestialBody {
  id: string;
  name: string;
  type: 'star' | 'planet' | 'dwarf-planet';
  color: string;
  radiusKm: number;
  distanceAu: number;
  orbitalPeriodDays: number;
  rotationPeriodHours: number;
  moons: number;
  description: string;
  textureGradient: string;
  temperatureC: number;
  funFact?: string;
}

// ============================================================================
// Evaluation surface
// ============================================================================
// Until now this primitive had NO evaluation hook at all: it produced a model
// and nothing else, while `supportsEvaluation: true` let the manifest route
// assessment demand at it. The measurable act here is the one the explorer is
// already built around — TAP A BODY — so a challenge asks a question whose
// answer IS a body, and the student answers by touching it in the live model
// rather than by picking a lettered option next to it
// ([[feedback_direct-manipulation-first]]).
//
// The five types are SKILLS, not difficulty steps (see the catalog `evalModes`).
// The answer key is a SET (`answerBodyIds`) because `classify` genuinely has
// several right answers — "tap a gas giant" is satisfied by any of four.

export type SolarChallengeType =
  | 'identify'
  | 'order_from_sun'
  | 'classify'
  | 'compare_attribute'
  | 'orbital_reasoning';

export interface SolarChallenge {
  id: string;
  type: SolarChallengeType;
  /** Student-facing question. NEVER names a body that answers it. */
  prompt: string;
  /** Every body that satisfies the prompt. Length > 1 for `classify`. */
  answerBodyIds: string[];
  /** Shown after a miss. Teaches the STRATEGY; never narrows to the answer. */
  hint?: string;
  /** Shown once the answer is settled. May name the body — it is over by then. */
  explanation?: string;
}

export interface SolarSystemExplorerData {
  title: string;
  description: string;
  bodies: CelestialBody[];
  initialZoom?: 'system' | 'inner' | 'outer' | 'planet' | 'moon';
  focusBody?: string;
  timeScale?: number;
  showOrbits?: boolean;
  showLabels?: boolean;
  scaleMode?: 'size_accurate' | 'distance_accurate' | 'hybrid';
  showHabitableZone?: boolean;
  dateTime?: string;
  showDistances?: boolean;
  compareMode?: boolean;
  gradeLevel?: 'K' | '1' | '2' | '3' | '4' | '5';

  /** Graded tap-the-body questions. Absent/empty → pure exploration, as before. */
  challenges?: SolarChallenge[];

  /** Within-mode support tier — present only when the manifest emitted difficulty. */
  supportTier?: 'easy' | 'medium' | 'hard';

  /** Auto-injected by ManifestOrderRenderer; scopes the tutor session. */
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SolarSystemExplorerMetrics>) => void;
}

interface SolarSystemExplorerProps {
  data: SolarSystemExplorerData;
  className?: string;
}

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  identify:          { label: 'Name It',  icon: '🔎', accentColor: 'blue' },
  order_from_sun:    { label: 'In Order', icon: '🔢', accentColor: 'cyan' },
  classify:          { label: 'Sort It',  icon: '🗂️', accentColor: 'purple' },
  compare_attribute: { label: 'Compare',  icon: '⚖️', accentColor: 'emerald' },
  orbital_reasoning: { label: 'Orbits',   icon: '🌀', accentColor: 'amber' },
};

/** Attempts allowed before the answer is revealed and the item scored wrong. */
const MAX_ATTEMPTS = 3;

const SolarSystemExplorer: React.FC<SolarSystemExplorerProps> = ({ data, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });

  const challenges = useMemo(() => data.challenges ?? [], [data.challenges]);
  const hasChallenges = challenges.length > 0;

  // In challenge mode nothing starts selected. `focusBody` is a curator hint for
  // free exploration, and pre-selecting it would hand over question 1's answer
  // whenever the two happen to coincide.
  const [selectedBodyId, setSelectedBodyId] = useState<string | null>(
    hasChallenges ? null : (data.focusBody || null),
  );
  const [hoveredBodyId, setHoveredBodyId] = useState<string | null>(null);
  const [timeScale, setTimeScale] = useState(data.timeScale || 5000);
  const [showOrbits, setShowOrbits] = useState(data.showOrbits !== false);
  const [showLabels, setShowLabels] = useState(data.showLabels !== false);
  const [showDistances, setShowDistances] = useState(data.showDistances || false);
  const [scaleMode, setScaleMode] = useState<'size_accurate' | 'distance_accurate' | 'hybrid'>(
    data.scaleMode || 'hybrid'
  );
  const [paused, setPaused] = useState(false);

  // Animation state - use refs to avoid re-renders during animation
  const simulationDateRef = useRef(data.dateTime ? new Date(data.dateTime) : new Date());
  const [displayDate, setDisplayDate] = useState(simulationDateRef.current);
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();
  const bodyGroupRefs = useRef<Map<string, SVGGElement>>(new Map());
  const dateDisplayRef = useRef<HTMLDivElement>(null);

  // Base scale: 1 AU = pixels
  const AU_TO_PIXELS = 180;

  // ============================================================================
  // Reading band
  // ============================================================================
  // At K-1 the instrument panel (three toggles, a scale <select>, a speed
  // slider, a calendar date) and the six-cell stat grid (AU, km, days, hours,
  // °C, moon count) are all undecodable adult chrome. The interaction that IS
  // K-fit — tap a planet, watch it go round — survives on its own
  // (reader-fit PRE contract rules 1, 4, 7).
  const isPreReader = data.gradeLevel === 'K' || data.gradeLevel === '1';

  const resolvedInstanceId = useMemo(
    () => data.instanceId || `solar-system-explorer-${Date.now()}`,
    [data.instanceId],
  );

  // ── Evaluation ────────────────────────────────────────────────────
  const { submitResult, elapsedMs } = usePrimitiveEvaluation<SolarSystemExplorerMetrics>({
    primitiveType: 'solar-system-explorer',
    instanceId: resolvedInstanceId,
    skillId: data.skillId,
    subskillId: data.subskillId,
    objectiveId: data.objectiveId,
    exhibitId: data.exhibitId,
  });

  // ── Challenge progress ────────────────────────────────────────────
  const {
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({ challenges, getChallengeId: (ch) => ch.id });

  const allChallengesComplete = hasChallenges && isComplete;
  const currentChallenge = hasChallenges
    ? challenges[Math.min(currentIndex, challenges.length - 1)]
    : null;
  // Session score, set once at submit. The challenge strip lives until THIS is
  // set — NOT until `allChallengesComplete`, which the hook flips the instant
  // the last result is recorded, i.e. before the student has read the final
  // feedback or pressed Finish. Gating on that would unmount the Finish button
  // and the session would never be submitted at all.
  const [submittedScore, setSubmittedScore] = useState<number | null>(null);
  const isChallengeActive = hasChallenges && submittedScore === null;

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [revealedAnswerId, setRevealedAnswerId] = useState<string | null>(null);
  const exploredBodiesRef = useRef<Set<string>>(new Set());
  const challengeStartRef = useRef<number>(Date.now());

  // The item is SETTLED once it is right, or once the tries are gone. A wrong
  // answer with tries left is not settled — the student keeps working on it.
  const isSettled = Boolean(feedback?.correct) || revealedAnswerId !== null;

  const selectedBodyForAI = useMemo(
    () => data.bodies.find((b) => b.id === selectedBodyId) ?? null,
    [data.bodies, selectedBodyId],
  );

  const aiPrimitiveData = useMemo(() => ({
    title: data.title,
    initialZoom: data.initialZoom ?? 'system',
    gradeLevel: data.gradeLevel ?? 'unspecified',
    bodyNames: data.bodies.map((b) => b.name).join(', '),
    bodyCount: data.bodies.length,
    selectedBodyName: selectedBodyForAI?.name ?? 'nothing yet',
    selectedBodyDescription: selectedBodyForAI?.description ?? '',
    motionState: paused ? 'paused' : 'orbiting',
    // The question text is safe to send — it never names its own answer. The
    // answer key itself is deliberately NOT in this payload.
    challengePrompt: isChallengeActive ? (currentChallenge?.prompt ?? '') : '',
    challengeNumber: hasChallenges ? Math.min(currentIndex + 1, challenges.length) : 0,
    challengeCount: challenges.length,
    ...(data.supportTier ? { supportTier: data.supportTier } : {}),
  }), [
    data.title, data.initialZoom, data.gradeLevel, data.bodies, data.supportTier,
    selectedBodyForAI, paused, isChallengeActive, currentChallenge, currentIndex,
    challenges.length, hasChallenges,
  ]);

  const { sendText, isAudioPlaying } = useLuminaAI({
    primitiveType: 'solar-system-explorer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: data.gradeLevel,
  });

  // Read-aloud: silent like every system trigger — `silent` suppresses only the
  // chat-transcript entry; the socket payload is unchanged, so the tutor speaks.
  const readAloud = useCallback((text: string) => {
    if (!text) return;
    sendText(
      `[SOLAR_READ_ALOUD] The young learner tapped "read it to me" and cannot read the screen. `
      + `Read this aloud, word for word, warmly and slowly: "${text}". Then wait.`,
      { silent: true },
    );
  }, [sendText]);

  // ORIENT — fires once so a non-reader learns the task without asking.
  const hasOrientedRef = useRef(false);
  useEffect(() => {
    if (hasOrientedRef.current) return;
    hasOrientedRef.current = true;
    sendText(
      `[SOLAR_ORIENT] A ${isPreReader ? 'pre-reader who cannot read any text' : 'student'} just opened `
      + `a solar system model showing: ${data.bodies.map((b) => b.name).join(', ')}. `
      + (hasChallenges
        ? `They will be asked questions they answer by TAPPING a planet and then pressing the big tick button. `
          + `Tell them that in child words, warmly. Do not ask the first question yourself — it is coming.`
        : `They tap a planet to learn about it. Tell them what to do in child words, warmly.`)
      + `${isPreReader ? ' Never speak a measurement to them — no kilometres, AU, degrees or day counts.' : ''}`,
      { silent: true },
    );
  }, [sendText, isPreReader, data.bodies, hasChallenges]);

  // The tutor speaks each question, because at K the student cannot read it.
  const spokenPromptRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isChallengeActive || !currentChallenge) return;
    if (spokenPromptRef.current === currentChallenge.id) return;
    spokenPromptRef.current = currentChallenge.id;
    sendText(
      `[SOLAR_CHALLENGE] Question ${currentIndex + 1} of ${challenges.length}. `
      + `Say this aloud in warm child words, then wait: "${currentChallenge.prompt}". `
      + `You do NOT know which planet is correct and you must never name it, point at it, `
      + `or rule any planet out — not even to be encouraging.`,
      { silent: true },
    );
  }, [isChallengeActive, currentChallenge, currentIndex, challenges.length, sendText]);

  // Tapping a body. During a question this is INSPECTION, so the tutor names it
  // and stops — volunteering "it's the biggest one" here would answer a
  // compare_attribute question outright.
  const lastAnnouncedBodyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedBodyForAI) return;
    if (lastAnnouncedBodyRef.current === selectedBodyForAI.id) return;
    lastAnnouncedBodyRef.current = selectedBodyForAI.id;
    exploredBodiesRef.current.add(selectedBodyForAI.id);

    if (isChallengeActive) {
      sendText(
        `[SOLAR_BODY_INSPECTED] While working on the question, the student is looking at `
        + `${selectedBodyForAI.name}. Say ONLY its name, warmly and briefly. `
        + `Say NOTHING about it and give NO sign of whether it answers the question.`,
        { silent: true },
      );
      return;
    }

    sendText(
      `[SOLAR_BODY_SELECTED] The student tapped ${selectedBodyForAI.name}. `
      + `Say its name and ONE short child-sized thing about it. `
      + `Do not ask a question and do not list numbers.`,
      { silent: true },
    );
  }, [selectedBodyForAI, sendText, isChallengeActive]);

  // Per-challenge reset. Every per-challenge latch is cleared HERE, including
  // `lastAnnouncedBodyRef` — otherwise re-inspecting the same planet on the next
  // question is silent ([[feedback_spoken-auto-advance-footguns]]).
  useEffect(() => {
    if (!hasChallenges) return;
    setSelectedBodyId(null);
    setFeedback(null);
    setRevealedAnswerId(null);
    lastAnnouncedBodyRef.current = null;
    challengeStartRef.current = Date.now();
  }, [currentIndex, hasChallenges]);

  // Window resize listener (more performant than ResizeObserver for this case)
  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // D3 Zoom Behavior
  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0) return;

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 100])
      .on('zoom', (event) => {
        setTransform(event.transform);
      });

    const svg = d3.select(svgRef.current);
    svg.call(zoom);

    // Initial transform based on initialZoom
    let initialScale = 0.3;
    if (data.initialZoom === 'inner') initialScale = 0.8;
    else if (data.initialZoom === 'outer') initialScale = 0.15;
    else if (data.initialZoom === 'planet') initialScale = 2;

    const initialTransform = d3.zoomIdentity
      .translate(dimensions.width / 2, dimensions.height / 2)
      .scale(initialScale);

    svg.call(zoom.transform, initialTransform);
  }, [dimensions.width, dimensions.height, data.initialZoom]);

  // Animation loop - uses direct DOM manipulation for smooth 60fps animation
  useEffect(() => {
    let frameCount = 0;

    const animate = (time: number) => {
      if (previousTimeRef.current !== undefined && !paused) {
        const deltaTime = time - previousTimeRef.current;
        const timeToAdd = timeScale * deltaTime * 100;

        // Update the simulation date (ref only, no React re-render)
        simulationDateRef.current = new Date(simulationDateRef.current.getTime() + timeToAdd);

        // Direct DOM manipulation for planet positions - bypasses React reconciliation
        bodyGroupRefs.current.forEach((element, bodyId) => {
          const body = data.bodies.find(b => b.id === bodyId);
          if (body && body.distanceAu > 0) {
            const periodMs = body.orbitalPeriodDays * 24 * 60 * 60 * 1000;
            const currentTime = simulationDateRef.current.getTime();
            const angle = ((currentTime % periodMs) / periodMs) * 2 * Math.PI;
            const r = body.distanceAu * AU_TO_PIXELS;
            const x = r * Math.cos(angle);
            const y = r * Math.sin(angle);
            element.setAttribute('transform', `translate(${x}, ${y})`);
          }
        });

        // Update date display every 30 frames (~500ms) to avoid layout thrashing
        frameCount++;
        if (frameCount % 30 === 0 && dateDisplayRef.current) {
          dateDisplayRef.current.textContent = simulationDateRef.current.toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
          });
        }
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [paused, timeScale, data.bodies]);

  // Calculate initial position based on orbital period
  const getInitialPosition = useCallback((body: CelestialBody) => {
    if (body.distanceAu === 0) return { x: 0, y: 0 }; // Sun at center

    const periodMs = body.orbitalPeriodDays * 24 * 60 * 60 * 1000;
    const time = simulationDateRef.current.getTime();
    const angle = ((time % periodMs) / periodMs) * 2 * Math.PI;

    const r = body.distanceAu * AU_TO_PIXELS;
    return {
      x: r * Math.cos(angle),
      y: r * Math.sin(angle),
    };
  }, []);

  // Callback to register body group refs for direct DOM manipulation
  const setBodyRef = useCallback((bodyId: string, element: SVGGElement | null) => {
    if (element) {
      bodyGroupRefs.current.set(bodyId, element);
    } else {
      bodyGroupRefs.current.delete(bodyId);
    }
  }, []);

  // Visual radius based on scale mode
  const getVisualRadius = (body: CelestialBody) => {
    if (body.type === 'star') {
      return scaleMode === 'size_accurate' ? 30 : 35;
    }

    if (scaleMode === 'size_accurate') {
      // Logarithmic scale for visibility
      return Math.max(3, Math.log(body.radiusKm) * 1.8);
    } else if (scaleMode === 'distance_accurate') {
      // Very small but proportional
      return Math.max(2, body.radiusKm * 0.0003);
    } else {
      // Hybrid: balanced visibility
      return Math.max(4, Math.log(body.radiusKm) * 1.5);
    }
  };

  const selectedBody = data.bodies.find((b) => b.id === selectedBodyId);

  // Habitable zone calculation (simplified: 0.95 AU to 1.37 AU for Sun-like star)
  const habitableZoneInner = 0.95 * AU_TO_PIXELS;
  const habitableZoneOuter = 1.37 * AU_TO_PIXELS;

  // ── Answer handling ───────────────────────────────────────────────
  // A tap SELECTS; a second, deliberate press ANSWERS. Two steps because these
  // targets are small circles in continuous orbital motion — a tap-is-the-answer
  // loop would score mis-taps on a moving object as misconceptions.
  const handleBodyTap = useCallback((bodyId: string) => {
    if (isSettled) return; // locked once the item is over, until Next
    setSelectedBodyId(bodyId);
    // A new pick retires the previous miss's hint, which also brings the
    // confirm button back — that IS the retry affordance.
    setFeedback(null);
  }, [isSettled]);

  const handleConfirmAnswer = useCallback(() => {
    if (!currentChallenge || !selectedBodyId || isSettled) return;

    incrementAttempts();
    const attempts = currentAttempts + 1;
    const correct = currentChallenge.answerBodyIds.includes(selectedBodyId);
    const chosen = data.bodies.find((b) => b.id === selectedBodyId);

    if (correct) {
      SoundManager.playCorrect();
      setFeedback({
        correct: true,
        message: currentChallenge.explanation ?? `Yes — ${chosen?.name ?? 'that one'}!`,
      });
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts,
        timeMs: Date.now() - challengeStartRef.current,
      });
      sendText(
        `[SOLAR_ANSWER_CORRECT] The student answered "${currentChallenge.prompt}" with `
        + `${chosen?.name} on attempt ${attempts} — that is RIGHT. Say so warmly in one short `
        + `sentence and give ONE child-sized reason why it is right.`,
        { silent: true },
      );
      return;
    }

    SoundManager.playIncorrect();

    if (attempts >= MAX_ATTEMPTS) {
      const answer = data.bodies.find((b) => b.id === currentChallenge.answerBodyIds[0]);
      setRevealedAnswerId(answer?.id ?? null);
      recordResult({
        challengeId: currentChallenge.id,
        correct: false,
        attempts,
        timeMs: Date.now() - challengeStartRef.current,
      });
      setFeedback({
        correct: false,
        message: currentChallenge.explanation ?? `The answer was ${answer?.name ?? 'another one'}.`,
      });
      sendText(
        `[SOLAR_ANSWER_REVEAL] The student ran out of tries on "${currentChallenge.prompt}". `
        + `The answer is ${answer?.name}. Tell them kindly, show them how to see it for `
        + `themselves in the picture, and keep it short. Do not make them feel bad.`,
        { silent: true },
      );
      return;
    }

    // Wrong, with tries left. The item stays open: `revealedAnswerId` is left
    // null, so `isSettled` is false and the next tap clears this hint.
    setFeedback({
      correct: false,
      message: currentChallenge.hint ?? 'Not that one — have another look and try again.',
    });
    sendText(
      `[SOLAR_ANSWER_WRONG] The student picked ${chosen?.name} for "${currentChallenge.prompt}" `
      + `and it is NOT right. Attempt ${attempts} of ${MAX_ATTEMPTS}. Encourage them to look again `
      + `and give a way to LOOK, not the answer. Never name the correct planet and never rule one out.`,
      { silent: true },
    );
  }, [
    currentChallenge, selectedBodyId, isSettled, currentAttempts, data.bodies,
    incrementAttempts, recordResult, sendText,
  ]);

  const handleNext = useCallback(() => {
    if (!currentChallenge) return;
    const advanced = advanceProgress();
    if (advanced) {
      sendText(
        `[SOLAR_NEXT] Moving to question ${currentIndex + 2} of ${challenges.length}.`,
        { silent: true },
      );
      return;
    }

    // Last item — score the session.
    const total = challenges.length;
    const correctCount = challengeResults.filter((r) => r.correct).length;
    const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    // One session = one skill in the pinned case, so the dominant type is the
    // eval mode the evidence belongs to.
    const typeCounts = challenges.reduce<Record<string, number>>((acc, ch) => {
      acc[ch.type] = (acc[ch.type] ?? 0) + 1;
      return acc;
    }, {});
    const dominantMode = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    const metrics: SolarSystemExplorerMetrics = {
      type: 'solar-system-explorer',
      evalMode: dominantMode,
      totalChallenges: total,
      correctChallenges: correctCount,
      totalAttempts,
      accuracy,
      bodiesExplored: exploredBodiesRef.current.size,
      durationMs: elapsedMs,
    };

    submitResult(accuracy >= 70, accuracy, metrics);
    setSubmittedScore(accuracy);
    SoundManager.playStreak();

    const phaseScoreStr = phaseResults.map((p) => `${p.label} ${p.score}%`).join(', ');
    sendText(
      `[SOLAR_ALL_COMPLETE] The student finished all ${total} questions. `
      + `${phaseScoreStr || `Overall ${accuracy}%`}. Overall ${accuracy}%. `
      + `Celebrate briefly and name one thing they now know about the solar system.`,
      { silent: true },
    );
  }, [
    currentChallenge, advanceProgress, sendText, currentIndex, challenges,
    challengeResults, elapsedMs, submitResult, phaseResults,
  ]);

  const selectedName = selectedBody?.name ?? '';
  const promptTextClass = isPreReader ? 'text-2xl' : 'text-lg';

  return (
    <div className={`w-full ${className}`}>
      <div className="max-w-7xl mx-auto glass-panel rounded-3xl border border-white/10 p-8 relative overflow-hidden shadow-2xl">
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[180px] opacity-10 bg-blue-500" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-[150px] opacity-10 bg-purple-500" />

        <div className="relative z-10">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Astronomy:</span>
              <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-mono border bg-blue-500/20 text-blue-300 border-blue-500/30">
                {hasChallenges ? 'CHALLENGE' : 'EXPLORE'}
              </span>
            </div>
            <h3 className="text-3xl font-light text-white mb-2">{data.title}</h3>
            <p className="text-slate-300 leading-relaxed">{data.description}</p>
          </div>

          {/* Challenge strip — the question, the confirm, the feedback */}
          {isChallengeActive && currentChallenge && (
            <div className="mb-4 glass-panel rounded-2xl border border-white/10 p-5">
              <div className="flex items-center gap-2 mb-3">
                {challenges.map((ch, i) => {
                  const done = challengeResults.find((r) => r.challengeId === ch.id);
                  return (
                    <span
                      key={ch.id}
                      className={`h-2.5 rounded-full transition-all duration-300 ${
                        i === currentIndex ? 'w-8 bg-blue-400'
                          : done?.correct ? 'w-2.5 bg-emerald-400'
                          : done ? 'w-2.5 bg-rose-400/70'
                          : 'w-2.5 bg-white/20'
                      }`}
                    />
                  );
                })}
                {!isPreReader && (
                  <span className="ml-2 text-[10px] font-mono uppercase tracking-widest text-slate-400">
                    {currentIndex + 1} / {challenges.length}
                  </span>
                )}
              </div>

              <div className="flex items-start gap-3">
                <p className={`text-white font-light leading-snug flex-1 ${promptTextClass}`}>
                  {currentChallenge.prompt}
                </p>
                <LuminaReadAloud
                  iconOnly
                  size={isPreReader ? 'lg' : 'sm'}
                  accent="cyan"
                  speaking={isAudioPlaying}
                  aria-label="Read the question to me"
                  className="flex-shrink-0"
                  onClick={() => readAloud(currentChallenge.prompt)}
                />
              </div>

              {/* Answer commit. Never shown until something is selected, so the
                  strip cannot hint at what to pick. */}
              {!feedback && (
                <div className="mt-4 flex items-center gap-3">
                  {selectedBody ? (
                    <button
                      onClick={handleConfirmAnswer}
                      className={`flex items-center gap-3 rounded-xl font-medium text-white transition-all duration-300 hover:scale-105 bg-emerald-500/30 hover:bg-emerald-500/40 border border-emerald-400/40 ${
                        isPreReader ? 'px-6 py-4 text-xl' : 'px-5 py-2.5 text-sm'
                      }`}
                    >
                      <span
                        className="inline-block rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: selectedBody.color,
                          width: isPreReader ? 22 : 16,
                          height: isPreReader ? 22 : 16,
                        }}
                      />
                      <span>{isPreReader ? `✓ ${selectedName}!` : `Answer: ${selectedName}`}</span>
                    </button>
                  ) : (
                    <p className={`text-slate-400 ${isPreReader ? 'text-lg' : 'text-sm'}`}>
                      {isPreReader ? 'Tap a planet 👆' : 'Tap a body in the model to choose it.'}
                    </p>
                  )}
                  {currentAttempts > 0 && !isPreReader && (
                    <span className="text-xs text-slate-500 font-mono">
                      try {currentAttempts + 1} of {MAX_ATTEMPTS}
                    </span>
                  )}
                </div>
              )}

              {feedback && (
                <div
                  className={`mt-4 rounded-xl border p-4 flex items-start gap-3 ${
                    feedback.correct
                      ? 'bg-emerald-500/15 border-emerald-400/30'
                      : 'bg-amber-500/15 border-amber-400/30'
                  }`}
                >
                  <span className={isPreReader ? 'text-3xl' : 'text-xl'}>
                    {feedback.correct ? '🎉' : '🤔'}
                  </span>
                  <p className={`flex-1 text-white font-light ${isPreReader ? 'text-xl' : 'text-base'}`}>
                    {feedback.message}
                  </p>
                  <LuminaReadAloud
                    iconOnly
                    size={isPreReader ? 'lg' : 'sm'}
                    accent="emerald"
                    speaking={isAudioPlaying}
                    aria-label="Read this to me"
                    className="flex-shrink-0"
                    onClick={() => readAloud(feedback.message)}
                  />
                  {/* Settled = correct, or out of tries. A wrong answer with
                      tries left clears itself on the next tap instead. */}
                  {(feedback.correct || revealedAnswerId) && (
                    <button
                      onClick={handleNext}
                      className={`flex-shrink-0 rounded-xl font-medium text-white bg-blue-500/30 hover:bg-blue-500/40 border border-blue-400/30 transition-all duration-300 hover:scale-105 ${
                        isPreReader ? 'px-6 py-4 text-xl' : 'px-5 py-2.5 text-sm'
                      }`}
                    >
                      {currentIndex + 1 >= challenges.length ? (isPreReader ? '🏁' : 'Finish') : (isPreReader ? '▶' : 'Next')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Main Viewer */}
          <div className="relative glass-panel rounded-2xl border border-white/10 overflow-hidden" style={{ height: '600px' }}>
            <div ref={containerRef} className="w-full h-full relative overflow-hidden cursor-grab active:cursor-grabbing bg-black/40">
              <StarBackground width={dimensions.width} height={dimensions.height} transform={transform} />

              <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="absolute top-0 left-0">
                <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
                  {/* Habitable Zone */}
                  {data.showHabitableZone && (
                    <g opacity={0.2}>
                      <circle cx={0} cy={0} r={habitableZoneOuter} fill="none" stroke="#22c55e" strokeWidth={20 / transform.k} />
                      <circle cx={0} cy={0} r={habitableZoneInner} fill="none" stroke="#22c55e" strokeWidth={20 / transform.k} />
                      <circle cx={0} cy={0} r={(habitableZoneInner + habitableZoneOuter) / 2} fill="none" stroke="#22c55e" strokeWidth={1 / transform.k} strokeDasharray="4 4" />
                    </g>
                  )}

                  {/* Orbits */}
                  {showOrbits &&
                    data.bodies.map((body) => {
                      if (body.distanceAu === 0) return null;
                      return (
                        <circle
                          key={`orbit-${body.id}`}
                          cx={0}
                          cy={0}
                          r={body.distanceAu * AU_TO_PIXELS}
                          fill="none"
                          stroke="rgba(255, 255, 255, 0.15)"
                          strokeWidth={1 / transform.k}
                        />
                      );
                    })}

                  {/* Bodies */}
                  {data.bodies.map((body) => {
                    const pos = getInitialPosition(body);
                    const r = getVisualRadius(body);
                    const isSelected = selectedBodyId === body.id;
                    const isHovered = hoveredBodyId === body.id;
                    const isRevealed = revealedAnswerId === body.id;

                    return (
                      <g
                        key={body.id}
                        data-body-id={body.id}
                        ref={(el) => setBodyRef(body.id, el)}
                        transform={`translate(${pos.x}, ${pos.y})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBodyTap(body.id);
                        }}
                        onMouseEnter={() => setHoveredBodyId(body.id)}
                        onMouseLeave={() => setHoveredBodyId(null)}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Glow for Sun */}
                        {body.type === 'star' && <circle r={r * 3} fill="url(#sunGlow)" opacity={0.6} />}

                        {/* Transparent hit target — the drawn planet can be a
                            handful of pixels at system zoom, and it is moving.
                            Without this, tapping is a dexterity test rather than
                            an astronomy one. */}
                        <circle r={Math.max(r * 2.2, 14 / transform.k)} fill="transparent" />

                        {/* Hover Glow */}
                        {isHovered && !isSelected && (
                          <circle
                            r={r * 2}
                            fill={body.color}
                            opacity={0.3}
                          />
                        )}

                        {/* Selection Indicator */}
                        {isSelected && (
                          <>
                            <circle
                              r={r * 2.5}
                              fill={body.color}
                              opacity={0.2}
                            />
                            <circle
                              r={r * 1.5 + 5}
                              fill="none"
                              stroke="white"
                              strokeWidth={2 / transform.k}
                              strokeDasharray="4 2"
                            />
                          </>
                        )}

                        {/* Revealed answer — only ever set AFTER the item is
                            scored wrong, never before. */}
                        {isRevealed && (
                          <circle
                            r={r * 1.5 + 9}
                            fill="none"
                            stroke="#34d399"
                            strokeWidth={3 / transform.k}
                          />
                        )}

                        {/* The Body */}
                        <circle
                          r={r}
                          fill={body.color}
                          stroke={isSelected ? 'white' : isHovered ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'}
                          strokeWidth={isHovered || isSelected ? 2 / transform.k : 1 / transform.k}
                        />

                        {/* Gradient Overlay */}
                        <circle r={r} fill={`url(#planetGradient-${body.id})`} opacity={0.7} />

                        {/* Label */}
                        {showLabels && (transform.k > 0.4 || isSelected || isHovered) && (
                          <text
                            y={r + 14 / transform.k}
                            textAnchor="middle"
                            fill="white"
                            fontSize={(isHovered || isSelected ? 12 : 11) / transform.k}
                            className="select-none pointer-events-none font-medium"
                            style={{
                              textShadow: '0 2px 4px rgba(0,0,0,0.9)',
                              fontWeight: isHovered || isSelected ? 600 : 500
                            }}
                          >
                            {body.name}
                          </text>
                        )}

                        {/* Distance Label */}
                        {showDistances && body.distanceAu > 0 && transform.k > 0.5 && (
                          <text
                            y={r + 26 / transform.k}
                            textAnchor="middle"
                            fill="#94a3b8"
                            fontSize={9 / transform.k}
                            className="select-none pointer-events-none"
                            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}
                          >
                            {body.distanceAu.toFixed(2)} AU
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>

                {/* Gradients */}
                <defs>
                  <radialGradient id="sunGlow">
                    <stop offset="0%" stopColor="#FDB813" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#FDB813" stopOpacity="0" />
                  </radialGradient>
                  {data.bodies.map((body) => (
                    <radialGradient id={`planetGradient-${body.id}`} key={`grad-${body.id}`} cx="30%" cy="30%">
                      <stop offset="0%" stopColor="white" stopOpacity="0.2" />
                      <stop offset="70%" stopColor="black" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="black" stopOpacity="0.6" />
                    </radialGradient>
                  ))}
                </defs>
              </svg>

              {/* Help Text — a three-clause protocol instruction in 12px is the
                  one string a non-reader most needs and least can read. At K-1
                  the tutor's ORIENT beat carries it instead. */}
              {!isPreReader && (
                <div className="absolute top-4 right-4 glass-panel backdrop-blur-md px-3 py-2 rounded-lg border border-white/20 text-xs text-slate-300 pointer-events-none">
                  Scroll to Zoom • Drag to Pan • Click Planets
                </div>
              )}
            </div>

            {/* Controls Overlay */}
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
              {/* Left Controls */}
              <div className="glass-panel backdrop-blur-md rounded-xl border border-white/20 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPaused(!paused)}
                    aria-label={paused ? 'Play' : 'Pause'}
                    className={`bg-blue-500/30 hover:bg-blue-500/40 border border-blue-400/30 text-white rounded-lg font-medium transition-all duration-300 hover:scale-105 ${
                      isPreReader ? 'px-4 py-3 text-2xl leading-none' : 'px-3 py-1.5 text-sm'
                    }`}
                  >
                    {isPreReader ? (paused ? '▶' : '⏸') : (paused ? '▶ Play' : '⏸ Pause')}
                  </button>
                  {/* A raw speed multiplier is a number a five-year-old cannot use. */}
                  {!isPreReader && (
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <span className="font-mono">Speed:</span>
                      <input
                        type="range"
                        min="100"
                        max="20000"
                        step="100"
                        value={timeScale}
                        onChange={(e) => setTimeScale(Number(e.target.value))}
                        className="w-24"
                      />
                    </div>
                  )}
                </div>

                {/* Three display toggles and a scale mode selector are exactly the
                    "adult chrome in the child's field" rule 7 forbids — and at K
                    the generator already picks the right defaults for all four. */}
                {!isPreReader && (
                  <>
                    <div className="flex items-center gap-3 text-xs">
                      <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer hover:text-white transition-colors">
                        <input type="checkbox" checked={showOrbits} onChange={(e) => setShowOrbits(e.target.checked)} className="rounded" />
                        Orbits
                      </label>
                      <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer hover:text-white transition-colors">
                        <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} className="rounded" />
                        Labels
                      </label>
                      <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer hover:text-white transition-colors">
                        <input type="checkbox" checked={showDistances} onChange={(e) => setShowDistances(e.target.checked)} className="rounded" />
                        Distances
                      </label>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <span className="font-mono">Scale:</span>
                      <select
                        value={scaleMode}
                        onChange={(e) => setScaleMode(e.target.value as any)}
                        className="bg-white/5 hover:bg-white/10 text-white rounded-lg px-2 py-1 text-xs border border-white/20 transition-colors"
                      >
                        <option value="hybrid">Hybrid</option>
                        <option value="size_accurate">Size Accurate</option>
                        <option value="distance_accurate">Distance Accurate</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Date Display — a calendar date carries no meaning at K-1. */}
              {!isPreReader && (
                <div
                  ref={dateDisplayRef}
                  className="glass-panel backdrop-blur-md rounded-xl border border-white/20 px-4 py-2 text-sm text-slate-300 font-mono"
                >
                  {displayDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
              )}
            </div>
          </div>

          {/* Session results */}
          {allChallengesComplete && submittedScore !== null && (
            <PhaseSummaryPanel
              className="mt-6"
              phases={phaseResults}
              overallScore={submittedScore}
              durationMs={elapsedMs}
              heading="Your Space Journey"
            />
          )}

          {/* Detail Panel */}
          {selectedBody && (
            <div className="mt-6 glass-panel rounded-2xl border border-white/10 p-6 relative overflow-hidden">
              {/* Accent bar */}
              <div
                className="absolute top-0 left-0 w-full h-1"
                style={{ backgroundColor: selectedBody.color }}
              />

              <div className="relative z-10 pt-2">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-2xl font-light text-white mb-2">{selectedBody.name}</h4>
                    <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-[10px] font-mono tracking-widest uppercase">
                      {selectedBody.type.replace('-', ' ')}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedBodyId(null)}
                    className="text-slate-400 hover:text-white transition-colors text-xl leading-none"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex items-start gap-3 mb-4">
                  <p className="text-slate-300 leading-relaxed flex-1">{selectedBody.description}</p>
                  <LuminaReadAloud
                    iconOnly
                    size={isPreReader ? 'lg' : 'sm'}
                    accent="cyan"
                    speaking={isAudioPlaying}
                    aria-label={`Tell me about ${selectedBody.name}`}
                    className="flex-shrink-0"
                    onClick={() => readAloud(
                      `${selectedBody.name}. ${selectedBody.description}`
                      + `${selectedBody.funFact ? ` Here is a fun fact. ${selectedBody.funFact}` : ''}`,
                    )}
                  />
                </div>

                {selectedBody.funFact && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
                    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-mono mb-2">💡 Fun Fact</div>
                    <div className="text-white text-sm font-light">{selectedBody.funFact}</div>
                  </div>
                )}

                {/* Six numeric stats — AU, kilometres, orbital days, rotation
                    hours, °C and a moon count — are the densest adult chrome in
                    this primitive and mean nothing to a K-1 child. The scaffold
                    forbids the tutor from speaking them too. NOT rendered rather
                    than CSS-hidden: `hidden` leaves the text in the DOM and
                    reachable by assistive tech, which is not "gone".
                    This panel is ALSO the research instrument for the
                    compare_attribute and orbital_reasoning modes, which is why
                    the generator never builds those items on hidden data at K-1. */}
                {!isPreReader && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {selectedBody.distanceAu > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-all duration-300">
                      <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest font-mono">Distance from Sun</div>
                      <div className="text-white font-light text-lg">{selectedBody.distanceAu.toFixed(2)} AU</div>
                    </div>
                  )}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-all duration-300">
                    <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest font-mono">Radius</div>
                    <div className="text-white font-light text-lg">{selectedBody.radiusKm.toLocaleString()} km</div>
                  </div>
                  {selectedBody.orbitalPeriodDays > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-all duration-300">
                      <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest font-mono">Year (Orbit)</div>
                      <div className="text-white font-light text-lg">{selectedBody.orbitalPeriodDays.toFixed(0)} days</div>
                    </div>
                  )}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-all duration-300">
                    <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest font-mono">Day (Rotation)</div>
                    <div className="text-white font-light text-lg">{selectedBody.rotationPeriodHours.toFixed(1)} hrs</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-all duration-300">
                    <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest font-mono">Temperature</div>
                    <div className="text-white font-light text-lg">{selectedBody.temperatureC}°C</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-all duration-300">
                    <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest font-mono">Moons</div>
                    <div className="text-white font-light text-lg">{selectedBody.moons}</div>
                  </div>
                </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Star background component - memoized to prevent unnecessary re-renders
const StarBackground = React.memo(({
  width,
  height,
  transform,
}: {
  width: number;
  height: number;
  transform: { x: number; y: number; k: number };
}) => {
  const stars = useMemo(() => {
    const s = [];
    for (let i = 0; i < 400; i++) {
      s.push({
        x: Math.random() * 3000 - 1500,
        y: Math.random() * 3000 - 1500,
        r: Math.random() * 1.5,
        opacity: Math.random() * 0.8 + 0.2,
      });
    }
    return s;
  }, []);

  return (
    <svg width={width} height={height} className="absolute top-0 left-0 pointer-events-none">
      <g
        transform={`translate(${transform.x * 0.1 + width / 2}, ${transform.y * 0.1 + height / 2}) scale(${Math.max(0.3, transform.k * 0.1)})`}
      >
        {stars.map((star, i) => (
          <circle key={i} cx={star.x} cy={star.y} r={star.r} fill="white" opacity={star.opacity} />
        ))}
      </g>
    </svg>
  );
});

export default SolarSystemExplorer;
