'use client';

/**
 * StatesOfMatter — TWO surfaces, forked on whether judged challenges arrived:
 *
 *  - DI JUDGED LOOP (challenges present — the normal path now): the Live tutor
 *    owns the clock. It asks ONCE, waits, judges the spoken answer in-band,
 *    corrects contrastively, and its own affirmation is the advance. No advance
 *    timer, no Next button, no Check button, no push-to-talk mic, no printed
 *    answer before the affirm.
 *
 *  - EXPLORATION (no challenges, or every one dropped by a build gate): the
 *    free particle sim — slider, beaker, particle view, heating curve,
 *    substance switcher — with the tutor as a silent guide reacting to
 *    [PHASE_CHANGE] beats. The honest degrade, and a real reference surface.
 *
 * ⭐ ALL THREE EVAL MODES ARE SPOKEN. observe says the state, predict says the
 * state it will reach or names the change, compare says one of two substances.
 * The click era answered every one of those with a tile, a True/False pair or a
 * text box, and the costume test cleared the board in one pass: a child who
 * cannot read a particle view can still click one of three tiles.
 *
 * WHAT THE JUDGED SURFACE HIDES, and why each one is the answer rather than
 * chrome:
 *  - the TEMPERATURE SLIDER — the ask is "what state WILL it be", and a slider
 *    beside a live beaker answers that by experiment (drag until the picture
 *    changes). It is a Check button in a range input's clothes, so the tutor
 *    gets it: the experiment runs on the affirmation, as the reveal.
 *  - the STATE BADGE and the PARTICLE CAPTION ("Particles vibrate in place —
 *    tightly packed") — both print the observe answer in words, above the
 *    picture the child is supposed to read.
 *  - the NUMERIC TEMPERATURE and the colour-zoned track with its MP/BP markers
 *    — a spoken threshold plus a printed number is arithmetic, not observation,
 *    and the coloured track paints the three states onto the scale itself.
 *  - the SUBSTANCE SWITCHER — a compare item's other beaker is the question.
 * All of them return in the REVEAL, behind `runner.revealHeld` (18b).
 *
 * Cue lines, judging contracts, build gates and the substance table live in
 * `statesOfMatterScript.ts` (hand-authored, DISTAR). Nothing in this file
 * writes a spoken line.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { StatesOfMatterMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SoundManager } from '../../../utils/SoundManager';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaButton,
  LuminaChallengeCounter,
  type LuminaAccent,
} from '../../../ui';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import {
  SUBSTANCES,
  carriesAnswerVocabulary,
  itemsFromChallenges,
  stateAt,
  statesOfMatterPackBase,
  substanceFactsOf,
  tempSpoken,
  type MatterState,
  type StatesBand,
  type StatesKind,
  type StatesOfMatterItem,
  type StatesTier,
  type SubstanceFacts,
} from './statesOfMatterScript';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface SubstanceConfig {
  name: string;
  formula: string | null;
  meltingPoint: number;
  boilingPoint: number;
  currentTemp: number;
  color: {
    solid: string;
    liquid: string;
    gas: string;
  };
}

export interface ParticleConfig {
  count: number;
  size: 'small' | 'medium' | 'large';
  showTrails: boolean;
  showBonds: boolean;
}

/**
 * One judged states-of-matter challenge — CODE-DRAWN from the substance table
 * (never LLM-authored; every answer key is computed). The script module's build
 * gates (`statesOfMatterScript.itemFromChallenge`) validate and DROP, never
 * backfill: a placeholder item in a judged loop becomes a spoken ask the tutor
 * has to stand behind.
 */
export interface StatesOfMatterChallenge {
  id: string;
  /** Maps 1:1 to the catalog eval modes. */
  challengeType: 'observe' | 'predict' | 'compare';
  /** The facet within the mode. Omitted = the mode's first facet. */
  kind?: 'name_state' | 'predict_state' | 'predict_change' | 'melt_first' | 'stay_solid';
  /** observe / predict: which substance, by key into the code table. */
  substanceKey?: string;
  /** The temperature the beaker sits at while the child answers. */
  startTemp?: number;
  /** predict / stay_solid: where the tutor takes it. Never in the ask's picture. */
  targetTemp?: number;
  /** compare: the two substances on offer, by key, in ask order. */
  pairKeys?: string[];
}

export interface StatesOfMatterData {
  title: string;
  description?: string;
  substance: SubstanceConfig;
  particleConfig: ParticleConfig;
  /** DI judged loop: present (non-empty) = the live tutor owns the session;
   *  absent = the free exploration surface. */
  challenges?: StatesOfMatterChallenge[];
  /** Within-mode support tier — the spoken DISTAR lead-in ladder, and the
   *  tier-conditional three-way menu on observe items. */
  supportTier?: StatesTier;
  showOptions?: {
    showParticleView?: boolean;
    showTemperatureSlider?: boolean;
    showStateLabels?: boolean;
    showEnergyGraph?: boolean;
    showPhaseMarkers?: boolean;
    showParticleSpeed?: boolean;
  };
  substances?: string[];
  imagePrompt?: string | null;
  gradeBand?: StatesBand;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<StatesOfMatterMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const STATE_CONFIG = {
  solid: {
    label: 'Solid',
    emoji: '🧊',
    textClass: 'text-blue-300',
    bgClass: 'bg-blue-500/10 border-blue-400/30',
    sliderColor: '#60a5fa',
    particleDesc: 'Particles vibrate in place — tightly packed, holding their shape',
  },
  liquid: {
    label: 'Liquid',
    emoji: '💧',
    textClass: 'text-cyan-300',
    bgClass: 'bg-cyan-500/10 border-cyan-400/30',
    sliderColor: '#22d3ee',
    particleDesc: 'Particles slide past each other — close together, but free to move',
  },
  gas: {
    label: 'Gas',
    emoji: '💨',
    textClass: 'text-orange-300',
    bgClass: 'bg-orange-500/10 border-orange-400/30',
    sliderColor: '#fb923c',
    particleDesc: 'Particles fly freely — spread apart, bouncing off walls',
  },
} as const;

const PRESET_SUBSTANCES: Record<string, SubstanceConfig> = Object.fromEntries(
  Object.values(SUBSTANCES).map((s) => [
    s.key,
    {
      name: s.name,
      formula: null,
      meltingPoint: s.meltingPoint,
      boilingPoint: s.boilingPoint,
      currentTemp: Math.round((s.meltingPoint + Math.min(s.boilingPoint, s.meltingPoint + 60)) / 2),
      color: s.color,
    } satisfies SubstanceConfig,
  ]),
);

const PARTICLE_SIZE_MAP = { small: 6, medium: 8, large: 10 };

const DEFAULT_PARTICLES: ParticleConfig = {
  count: 30,
  size: 'medium',
  showTrails: true,
  showBonds: true,
};

// ============================================================================
// Particle Simulation Sub-component
// ============================================================================

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
}

const ParticleSimulation: React.FC<{
  state: MatterState;
  config: ParticleConfig;
  color: string;
  temperature: number;
  meltingPoint: number;
  boilingPoint: number;
  width?: number;
  height?: number;
}> = ({ state, config, color, temperature, meltingPoint, boilingPoint, width = 240, height = 180 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);

  const particleRadius = PARTICLE_SIZE_MAP[config.size] || 8;
  const W = width;
  const H = height;

  // Initialize particles
  useEffect(() => {
    const count = config.count || 30;
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const spacingX = W / (cols + 1);
    const spacingY = H / (rows + 1);

    particlesRef.current = Array.from({ length: count }, (_, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = spacingX * (col + 1);
      const by = spacingY * (row + 1);
      return { id: i, x: bx, y: by, vx: 0, vy: 0, baseX: bx, baseY: by };
    });
  }, [config.count, W, H]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Normalized energy 0-1 from where temp sits relative to melting/boiling
    const range = Math.max(boilingPoint - meltingPoint, 1);
    const rawEnergy = (temperature - (meltingPoint - range * 0.3)) / (range * 1.6);
    const energy = Math.max(0, Math.min(1, rawEnergy));

    const animate = () => {
      ctx.clearRect(0, 0, W, H);

      const particles = particlesRef.current;
      particles.forEach(p => {
        if (state === 'solid') {
          const amplitude = 1 + energy * 6;
          p.x = p.baseX + (Math.random() - 0.5) * amplitude;
          p.y = p.baseY + (Math.random() - 0.5) * amplitude;
        } else if (state === 'liquid') {
          const speed = 0.3 + energy * 1.5;
          p.vx += (Math.random() - 0.5) * speed;
          p.vy += (Math.random() - 0.5) * speed;
          p.vx *= 0.95;
          p.vy *= 0.95;
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < particleRadius) { p.x = particleRadius; p.vx *= -0.5; }
          if (p.x > W - particleRadius) { p.x = W - particleRadius; p.vx *= -0.5; }
          if (p.y < H * 0.3) { p.y = H * 0.3; p.vy *= -0.5; }
          if (p.y > H - particleRadius) { p.y = H - particleRadius; p.vy *= -0.5; }
        } else {
          const speed = 1 + energy * 3;
          p.vx += (Math.random() - 0.5) * speed;
          p.vy += (Math.random() - 0.5) * speed;
          p.vx *= 0.98;
          p.vy *= 0.98;
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < particleRadius) { p.x = particleRadius; p.vx = Math.abs(p.vx); }
          if (p.x > W - particleRadius) { p.x = W - particleRadius; p.vx = -Math.abs(p.vx); }
          if (p.y < particleRadius) { p.y = particleRadius; p.vy = Math.abs(p.vy); }
          if (p.y > H - particleRadius) { p.y = H - particleRadius; p.vy = -Math.abs(p.vy); }
        }

        if (config.showTrails && state !== 'solid') {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
          ctx.strokeStyle = color + '40';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, particleRadius, 0, Math.PI * 2);
        ctx.fillStyle = color + 'cc';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      if (config.showBonds && state === 'solid') {
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = color + '50';
        ctx.lineWidth = 1;
        particles.forEach((p, i) => {
          particles.forEach((q, j) => {
            if (j <= i) return;
            const dist = Math.hypot(p.x - q.x, p.y - q.y);
            if (dist < 40) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(q.x, q.y);
              ctx.stroke();
            }
          });
        });
        ctx.setLineDash([]);
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [state, config.showTrails, config.showBonds, color, particleRadius, temperature, meltingPoint, boilingPoint, W, H]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className="rounded-lg bg-slate-900/60 border border-white/5 w-full"
      style={{ maxWidth: W, imageRendering: 'auto' }}
    />
  );
};

// ============================================================================
// Substance Beaker Sub-component
// ============================================================================

const SubstanceBeaker: React.FC<{
  state: MatterState;
  color: string;
  caption: string;
}> = ({ state, color, caption }) => {
  return (
    <div className="relative flex flex-col items-center justify-end h-[180px] w-full max-w-[240px] mx-auto">
      <div className="relative w-28 h-36 border-2 border-white/25 rounded-b-xl bg-slate-800/20 overflow-hidden">
        {state === 'solid' && (
          <div
            className="absolute bottom-0 left-0 right-0 h-1/2 rounded-t-sm transition-all duration-700"
            style={{ background: color }}
          />
        )}
        {state === 'liquid' && (
          <div
            className="absolute bottom-0 left-0 right-0 h-2/3 transition-all duration-700"
            style={{ background: `${color}90` }}
          >
            <div className="absolute top-0 left-0 right-0 h-1 animate-pulse" style={{ background: `${color}50` }} />
          </div>
        )}
        {state === 'gas' && (
          <div className="absolute inset-0 flex items-center justify-center">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="absolute w-4 h-4 rounded-full animate-bounce opacity-30"
                style={{
                  background: color,
                  left: `${20 + i * 14}%`,
                  top: `${12 + ((i * 17) % 60)}%`,
                  animationDelay: `${i * 0.3}s`,
                  animationDuration: `${1.5 + i * 0.2}s`,
                }}
              />
            ))}
          </div>
        )}

        {state === 'gas' && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-white/10 animate-bounce"
                style={{ animationDelay: `${i * 0.2}s`, animationDuration: '1.8s' }}
              />
            ))}
          </div>
        )}
      </div>

      <span className="text-slate-400 text-[10px] mt-1">{caption}</span>
    </div>
  );
};

// ============================================================================
// Energy Graph Sub-component (exploration only — a heating curve with phase
// markers reads the answer off the scale during a judged ask)
// ============================================================================

const EnergyGraph: React.FC<{
  temperature: number;
  meltingPoint: number;
  boilingPoint: number;
  minTemp: number;
  maxTemp: number;
}> = ({ temperature, meltingPoint, boilingPoint, minTemp, maxTemp }) => {
  const W = 240;
  const H = 80;
  const padding = 20;

  const tempToX = (t: number) => padding + ((t - minTemp) / (maxTemp - minTemp)) * (W - 2 * padding);
  const currentX = tempToX(temperature);
  const meltX = tempToX(meltingPoint);
  const boilX = tempToX(boilingPoint);

  const yBottom = H - 10;
  const yTop = 10;
  const curvePoints = [
    { x: padding, y: yBottom },
    { x: meltX - 5, y: yBottom - (yBottom - yTop) * 0.3 },
    { x: meltX + 5, y: yBottom - (yBottom - yTop) * 0.3 },
    { x: (meltX + boilX) / 2, y: yBottom - (yBottom - yTop) * 0.6 },
    { x: boilX - 5, y: yBottom - (yBottom - yTop) * 0.7 },
    { x: boilX + 5, y: yBottom - (yBottom - yTop) * 0.7 },
    { x: W - padding, y: yTop },
  ];

  const pathD = curvePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div className="bg-slate-800/20 rounded-lg p-2 border border-white/5">
      <span className="text-slate-500 text-[10px] uppercase tracking-wider">Heating Curve</span>
      <svg width={W} height={H} className="w-full" viewBox={`0 0 ${W} ${H}`}>
        <line x1={padding} y1={yBottom} x2={W - padding} y2={yBottom} stroke="#334155" strokeWidth={1} />
        <path d={pathD} fill="none" stroke="#06b6d4" strokeWidth={2} opacity={0.6} />
        <line x1={meltX} y1={yTop} x2={meltX} y2={yBottom} stroke="#60a5fa" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
        <text x={meltX} y={H - 1} textAnchor="middle" fill="#60a5fa" fontSize={8}>MP</text>
        <line x1={boilX} y1={yTop} x2={boilX} y2={yBottom} stroke="#fb923c" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
        <text x={boilX} y={H - 1} textAnchor="middle" fill="#fb923c" fontSize={8}>BP</text>
        <circle cx={Math.max(padding, Math.min(W - padding, currentX))} cy={yBottom - 3} r={4} fill="#22d3ee" />
      </svg>
    </div>
  );
};

// ============================================================================
// Props
// ============================================================================

interface StatesOfMatterProps {
  data: StatesOfMatterData;
  className?: string;
}

// ============================================================================
// Judged surface (DI modality)
// ============================================================================

const MODE_META: Record<StatesKind, { badge: string; icon: string; accent: LuminaAccent }> = {
  name_state: { badge: 'What State?', icon: '🔍', accent: 'blue' },
  predict_state: { badge: 'Predict', icon: '🔮', accent: 'purple' },
  predict_change: { badge: 'Name the Change', icon: '🔄', accent: 'purple' },
  melt_first: { badge: 'Which Melts First?', icon: '⚖️', accent: 'emerald' },
  stay_solid: { badge: 'Still Solid?', icon: '⚖️', accent: 'emerald' },
};

/** What the reveal ramps TO — the experiment the child predicted, run. */
const revealTempFor = (item: StatesOfMatterItem): number => {
  if (item.kind === 'melt_first') {
    const [a, b] = item.pair!;
    return Math.min(a.meltingPoint, b.meltingPoint) + 20;
  }
  return item.targetTemp ?? item.startTemp ?? 0;
};

interface RevealPayload {
  item: StatesOfMatterItem;
  fromTemp: number;
  toTemp: number;
  line: string;
}

/** One beaker + its particle view, with everything that NAMES a state stripped
 *  unless the reveal is open. */
const MatterLab: React.FC<{
  substance: SubstanceFacts;
  temperature: number;
  particles: ParticleConfig;
  revealed: boolean;
  compact?: boolean;
}> = ({ substance, temperature, particles, revealed, compact }) => {
  const state = stateAt(substance, temperature);
  const conf = STATE_CONFIG[state];
  const color = substance.color[state];
  const size = compact ? { w: 190, h: 140 } : { w: 240, h: 180 };

  return (
    <div className="flex-1 min-w-0">
      <span className="text-slate-500 text-[10px] uppercase tracking-wider block text-center mb-1">
        {substance.name}
      </span>
      <div className={compact ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-1 sm:grid-cols-2 gap-4'}>
        <SubstanceBeaker
          state={state}
          color={color}
          /* The numeric temperature is the REVEAL, not the stimulus: a spoken
             threshold beside a printed number turns observation into
             arithmetic. */
          caption={revealed ? `${substance.name} at ${temperature}°C` : substance.name}
        />
        <div>
          <ParticleSimulation
            state={state}
            config={particles}
            color={color}
            temperature={temperature}
            meltingPoint={substance.meltingPoint}
            boilingPoint={substance.boilingPoint}
            width={size.w}
            height={size.h}
          />
          {/* The caption states the answer in words. It comes back with the
              affirmation and not one moment sooner. */}
          {revealed && (
            <p className="text-slate-400 text-[10px] text-center mt-1 italic">
              {conf.particleDesc}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const StatesOfMatterJudged: React.FC<StatesOfMatterProps> = ({ data, className }) => {
  const {
    title,
    challenges = [],
    particleConfig,
    supportTier,
    gradeBand = '3-5',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `states-of-matter-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const tier: StatesTier = supportTier ?? 'medium';
  const particles = particleConfig ?? DEFAULT_PARTICLES;

  /** Build gates drop what cannot be asked — a placeholder in a judged loop
   *  becomes a spoken ask the tutor has to stand behind. */
  const items = useMemo<StatesOfMatterItem[]>(
    () => itemsFromChallenges(challenges, { band: gradeBand, tier }),
    [challenges, gradeBand, tier],
  );

  /**
   * Defect 11, the PIXELS half done in strings: the lesson title is read by the
   * child (and printed over the beaker), so a generated "Watch the Ice Melt!"
   * answers an observe item before the tutor has finished asking.
   */
  const safeTitle = useMemo(
    () => (title && !carriesAnswerVocabulary(title) ? title : 'States of Matter'),
    [title],
  );

  /** The reveal payload (18b): set in `onAffirmed`, rendered behind
   *  `runner.revealHeld`, deliberately NOT cleared in `onItemOpened` — the
   *  runner fires both in ONE dispatch on the advance path, so clearing there
   *  paints the reveal on the last item and nowhere else. */
  const [reveal, setReveal] = useState<RevealPayload | null>(null);
  const [rampTemp, setRampTemp] = useState<number | null>(null);

  const evaluation = usePrimitiveEvaluation<StatesOfMatterMetrics>({
    primitiveType: 'states-of-matter',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const rate = (predicate: (item: StatesOfMatterItem) => boolean) => {
      const scoped = items.filter(predicate);
      if (scoped.length === 0) return 100;
      const solved = scoped.filter(
        (item) => summary.outcomes.find((o) => o.id === item.id)?.solved,
      ).length;
      return Math.round((solved / scoped.length) * 100);
    };

    const metrics: StatesOfMatterMetrics = {
      type: 'states-of-matter',
      challengesCorrect: summary.solvedCount,
      challengesTotal: items.length,
      observeAccuracy: rate((item) => item.challengeType === 'observe'),
      predictAccuracy: rate((item) => item.challengeType === 'predict'),
      compareAccuracy: rate((item) => item.challengeType === 'compare'),
      substancesExplored: new Set(
        items.flatMap((item) => (item.pair ? item.pair.map((s) => s.key) : item.substance ? [item.substance.key] : [])),
      ).size,
      attemptsCount: summary.attemptsCount,
    };

    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes, hearTaps: summary.hearTaps },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items, evaluation]);

  // ── The pack — wording lives in statesOfMatterScript.ts ────────────────────
  // The cue surface is SPREAD, not re-declared, so the DI drive harness reads
  // the same bytes this component sends.
  const pack = useMemo<JudgedScriptPack<StatesOfMatterItem>>(() => ({
    ...statesOfMatterPackBase(items),
    statusLines: {
      ready: () => 'Listen, then say your answer.',
      retry: () => 'Listen again — then say your answer.',
      done: 'Great science today!',
    },
    diagnosisObservation: (item, { lastHeard }) => {
      const heard = (lastHeard ?? '').trim();
      const observed = heard ? `Said "${heard}".` : 'Said something that did not match.';
      switch (item.kind) {
        case 'name_state':
          return {
            challenge: `Read the particle view and name the state of ${item.substance?.name}.`,
            expected: `"${item.answerState}".`,
            observed,
          };
        case 'predict_state':
          return {
            challenge: `Predict the state of ${item.substance?.name} at ${tempSpoken(item.targetTemp ?? 0)}.`,
            expected: `"${item.answerState}".`,
            observed,
          };
        case 'predict_change':
          return {
            challenge: `Name the phase change ${item.substance?.name} goes through at ${tempSpoken(item.targetTemp ?? 0)}.`,
            expected: `"${item.answerChange}".`,
            observed,
          };
        case 'melt_first':
        case 'stay_solid':
          return {
            challenge: `Melting-point comparison: ${item.pair?.[0].name} vs ${item.pair?.[1].name}.`,
            expected: `"${item.answerName}".`,
            observed,
          };
      }
    },
  }), [items]);

  const runner = useJudgedScriptRunner<StatesOfMatterItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel: gradeBand === 'K-2' ? 'Kindergarten' : 'Grade 3-5',
    exhibitId,
    onFinished: handleFinished,
    onAffirmed: (item) => {
      const from = item.startTemp ?? 0;
      const to = revealTempFor(item);
      const line = item.kind === 'name_state'
        ? `${item.substance!.name} at ${item.startTemp}°C`
        : item.kind === 'predict_state'
          ? `${item.substance!.name} reaches ${to}°C`
          : item.kind === 'predict_change'
            ? `${item.substance!.name}: ${item.answerChange}`
            : `${item.answerName} — melting point ${
              (item.pair ?? []).find((s) => s.name === item.answerName)?.meltingPoint ?? ''
            }°C`;
      setReveal({ item, fromTemp: from, toTemp: to, line });
    },
  });

  const showReveal = runner.revealHeld && reveal !== null;

  /**
   * The experiment RUNS on the affirmation — the reveal ramps the beaker from
   * where the child saw it to where the tutor said she was taking it, while she
   * says so.
   *
   * ⚠️ Every dependency here is a PRIMITIVE. A timer effect that depends on
   * `runner` tears down and re-arms faster than it can fire, because the runner
   * is a fresh object every render and the open mic re-renders many times a
   * second — that is how ten-frame's subitize flash never once ran while
   * passing 42 tests and a clean tsc.
   */
  const revealId = reveal?.item.id ?? null;
  const revealFrom = reveal?.fromTemp ?? null;
  const revealTo = reveal?.toTemp ?? null;
  useEffect(() => {
    if (!showReveal || revealFrom == null || revealTo == null) {
      setRampTemp(null);
      return;
    }
    if (revealFrom === revealTo) {
      setRampTemp(revealTo);
      return;
    }
    setRampTemp(revealFrom);
    const steps = 20;
    let step = 0;
    const id = setInterval(() => {
      step += 1;
      setRampTemp(Math.round(revealFrom + ((revealTo - revealFrom) * step) / steps));
      if (step >= steps) clearInterval(id);
    }, 60);
    return () => clearInterval(id);
  }, [showReveal, revealId, revealFrom, revealTo]);

  useEffect(() => {
    if (showReveal) SoundManager.playCorrect();
  }, [showReveal, revealId]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (item) => {
      const meta = MODE_META[item.kind];
      return { label: meta.badge, icon: meta.icon };
    });
  }, [evaluation.hasSubmitted, runner.summary, items]);

  const currentItem = runner.currentItem;

  /**
   * WHICH item is on the bench right now. On the advance path the runner opens
   * the next item in the SAME dispatch as the affirmation, so by render time
   * `currentItem` is already the NEXT one while the tutor is still saying the
   * verdict for the last. The reveal therefore renders its OWN item — anything
   * else puts the previous item's answer over the next item's substance.
   */
  const staged = showReveal && reveal ? reveal.item : currentItem;
  const stagedTemp = showReveal && rampTemp != null
    ? rampTemp
    : staged?.startTemp ?? 0;

  const modeMeta = MODE_META[staged?.kind ?? 'name_state'];

  if (items.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <LuminaCardTitle className="text-lg">{safeTitle}</LuminaCardTitle>
          {!evaluation.hasSubmitted && staged && (
            <LuminaBadge accent={modeMeta.accent} className="text-xs">
              {modeMeta.icon} {modeMeta.badge}
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!evaluation.hasSubmitted && (
          <>
            <div className="flex items-center justify-center gap-4">
              <LuminaChallengeCounter
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
              {/* Tap-to-hear the question again — never the answer. */}
              <button
                type="button"
                onClick={runner.hearStimulus}
                aria-label="Hear the question again"
                className={`
                  flex items-center justify-center w-10 h-10 rounded-full
                  bg-amber-500/15 border-2 border-amber-500/30 text-amber-300
                  hover:bg-amber-500/25 hover:scale-105 active:scale-95 transition-all
                  ${runner.stimulusTapped ? 'ring-2 ring-cyan-300/60' : ''}
                `}
              >
                <Volume2 size={18} />
              </button>
            </div>

            {/* THE BENCH. No slider, no thermometer readout, no phase markers,
                no state badge, no substance switcher — every one of them either
                answers the ask or lets the child run the experiment the tutor
                is asking them to predict. */}
            <div className="flex flex-col sm:flex-row gap-4 items-start justify-center">
              {staged?.pair
                ? staged.pair.map((s) => (
                    <MatterLab
                      key={s.key}
                      substance={s}
                      temperature={stagedTemp}
                      particles={particles}
                      revealed={showReveal}
                      compact
                    />
                  ))
                : staged?.substance && (
                    <MatterLab
                      substance={staged.substance}
                      temperature={stagedTemp}
                      particles={particles}
                      revealed={showReveal}
                    />
                  )}
            </div>

            {/* Reveal-on-affirm: the state, in words, for exactly as long as
                the tutor's affirmation is being spoken (runner.revealHeld). */}
            {showReveal && reveal && (
              <div className="flex justify-center">
                <div className="flex items-center gap-3 rounded-2xl border-2 border-emerald-400/30 bg-emerald-500/10 px-5 py-2.5 animate-in fade-in duration-300">
                  {!reveal.item.pair && (
                    <LuminaBadge
                      accent="emerald"
                      className={`text-sm ${STATE_CONFIG[stateAt(reveal.item.substance!, stagedTemp)].textClass}`}
                    >
                      {STATE_CONFIG[stateAt(reveal.item.substance!, stagedTemp)].emoji}{' '}
                      {STATE_CONFIG[stateAt(reveal.item.substance!, stagedTemp)].label}
                    </LuminaBadge>
                  )}
                  <span className="text-emerald-200 text-sm font-medium">{reveal.line}</span>
                </div>
              </div>
            )}

            <JudgedMicPanel run={runner} />
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Experiment Complete!"
            celebrationMessage={`You worked out what heat does across ${items.length} rounds — out loud!`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// ============================================================================
// Exploration surface (pre-DI behavior, preserved)
// ============================================================================

const StatesOfMatterExplorer: React.FC<StatesOfMatterProps> = ({ data, className }) => {
  const {
    title,
    description,
    substance: initialSubstance,
    particleConfig,
    showOptions = {},
    substances: availableSubstances,
    gradeBand = 'K-2',
    instanceId,
  } = data;

  const {
    showParticleView = true,
    showTemperatureSlider = true,
    showStateLabels = true,
    showEnergyGraph = gradeBand === '3-5',
    showPhaseMarkers = true,
    showParticleSpeed = false,
  } = showOptions;

  const [substance, setSubstance] = useState<SubstanceConfig>(initialSubstance);
  const [temperature, setTemperature] = useState(initialSubstance.currentTemp);
  const [substancesExplored, setSubstancesExplored] = useState<Set<string>>(new Set([initialSubstance.name]));
  const [lastCrossedTransition, setLastCrossedTransition] = useState<'melting' | 'boiling' | null>(null);
  const [previousState, setPreviousState] = useState<MatterState | null>(null);

  // Spoken-narration gating: settle timer + witnessed set, so dragging back and
  // forth across a threshold stays silent and the first melt is illuminating
  // where the fifth would be nagging.
  const speakTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const witnessedTransitionsRef = useRef<Set<string>>(new Set());
  const prevSubstanceNameRef = useRef(initialSubstance.name);

  const stableInstanceIdRef = useRef(instanceId || `states-of-matter-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const currentState: MatterState = useMemo(() => {
    if (temperature < substance.meltingPoint) return 'solid';
    if (temperature < substance.boilingPoint) return 'liquid';
    return 'gas';
  }, [temperature, substance.meltingPoint, substance.boilingPoint]);

  const currentColor = substance.color[currentState];

  const tempRange = useMemo(() => {
    const range = substance.boilingPoint - substance.meltingPoint;
    const padding = Math.max(range * 0.3, 30);
    return {
      min: Math.floor(substance.meltingPoint - padding),
      max: Math.ceil(substance.boilingPoint + padding),
    };
  }, [substance.meltingPoint, substance.boilingPoint]);

  const particleSpeed = useMemo(() => {
    const range = tempRange.max - tempRange.min;
    return Math.max(0, Math.min(100, ((temperature - tempRange.min) / range) * 100));
  }, [temperature, tempRange]);

  const aiPrimitiveData = useMemo(() => ({
    challengeType: 'free_explore',
    stimulus: `${substance.name} in a beaker with its particle view, temperature under the learner's hand`,
  }), [substance.name]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'states-of-matter',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K-2' ? 'Kindergarten' : 'Grade 3-5',
  });

  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Free states-of-matter exploration for ${gradeBand}. `
      + `The learner controls the temperature of ${substance.name} and watches the particles respond. `
      + `Greet them warmly and invite them to try heating it up.`,
      { silent: true },
    );
  }, [isConnected, substance.name, gradeBand, sendText]);

  useEffect(() => {
    if (prevSubstanceNameRef.current !== substance.name) {
      prevSubstanceNameRef.current = substance.name;
      if (speakTransitionTimerRef.current) clearTimeout(speakTransitionTimerRef.current);
      setPreviousState(currentState);
      return;
    }

    if (previousState && previousState !== currentState) {
      const transition = (previousState === 'solid' && currentState === 'liquid') ? 'melting'
        : (previousState === 'liquid' && currentState === 'gas') ? 'boiling'
        : null;

      if (transition) {
        setLastCrossedTransition(transition);
        setTimeout(() => setLastCrossedTransition(null), 2000);
      }

      const reverseTransition = (previousState === 'liquid' && currentState === 'solid') ? 'freezing'
        : (previousState === 'gas' && currentState === 'liquid') ? 'condensing'
        : null;

      if (transition || reverseTransition) {
        if (speakTransitionTimerRef.current) clearTimeout(speakTransitionTimerRef.current);
        const fromState = previousState;
        const toState = currentState;
        const crossingTemp = temperature;
        speakTransitionTimerRef.current = setTimeout(() => {
          const key = `${substance.name}:${fromState}->${toState}`;
          if (witnessedTransitionsRef.current.has(key)) return;
          witnessedTransitionsRef.current.add(key);
          sendText(
            `[PHASE_CHANGE] ${substance.name} went from ${fromState} to ${toState} at ${crossingTemp} degrees. `
            + `Celebrate what the particles just did, in one short sentence.`,
            { silent: true },
          );
        }, 1200);
      }
    }
    setPreviousState(currentState);
  }, [currentState, previousState, substance.name, temperature, sendText]);

  useEffect(() => () => {
    if (speakTransitionTimerRef.current) clearTimeout(speakTransitionTimerRef.current);
  }, []);

  const handleTemperatureChange = useCallback((newTemp: number) => {
    SoundManager.tick();
    setTemperature(newTemp);
  }, []);

  const handleSwitchSubstance = useCallback((key: string) => {
    const preset = PRESET_SUBSTANCES[key];
    if (!preset) return;
    SoundManager.select();
    setSubstance(preset);
    setTemperature(preset.currentTemp);
    setSubstancesExplored(prev => { const next = new Set(prev); next.add(preset.name); return next; });
    sendText(
      `[SUBSTANCE_CHANGED] The learner switched to ${preset.name}. Invite them to explore it.`,
      { silent: true },
    );
  }, [sendText]);

  const stateConf = STATE_CONFIG[currentState];

  const sliderBackground = useMemo(() => {
    const meltPct = ((substance.meltingPoint - tempRange.min) / (tempRange.max - tempRange.min)) * 100;
    const boilPct = ((substance.boilingPoint - tempRange.min) / (tempRange.max - tempRange.min)) * 100;
    return `linear-gradient(to right, ${STATE_CONFIG.solid.sliderColor} ${meltPct}%, ${STATE_CONFIG.liquid.sliderColor} ${meltPct}%, ${STATE_CONFIG.liquid.sliderColor} ${boilPct}%, ${STATE_CONFIG.gas.sliderColor} ${boilPct}%)`;
  }, [substance.meltingPoint, substance.boilingPoint, tempRange]);

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="blue" className="text-xs">
              {gradeBand === 'K-2' ? 'Kindergarten' : 'Grades 3-5'}
            </LuminaBadge>
            <LuminaBadge accent="emerald" className={`text-xs ${stateConf.textClass}`}>
              {stateConf.emoji} {stateConf.label}
            </LuminaBadge>
          </div>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {lastCrossedTransition && (
          <div className="text-center animate-bounce">
            <span className="text-2xl">{lastCrossedTransition === 'melting' ? '🫠' : '☁️'}</span>
            <p className="text-emerald-400 text-sm font-medium">
              {lastCrossedTransition === 'melting' ? 'Melting! Solid → Liquid' : 'Boiling! Liquid → Gas'}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="text-slate-500 text-[10px] uppercase tracking-wider block text-center mb-1">
              {substance.name} — Real View
            </span>
            <SubstanceBeaker
              state={currentState}
              color={currentColor}
              caption={`${substance.name} at ${temperature}°C`}
            />
          </div>

          {showParticleView && (
            <div>
              <span className="text-slate-500 text-[10px] uppercase tracking-wider block text-center mb-1">
                Particle View
              </span>
              <ParticleSimulation
                state={currentState}
                config={particleConfig ?? DEFAULT_PARTICLES}
                color={currentColor}
                temperature={temperature}
                meltingPoint={substance.meltingPoint}
                boilingPoint={substance.boilingPoint}
              />
              <p className="text-slate-500 text-[10px] text-center mt-1 italic">
                {stateConf.particleDesc}
              </p>
            </div>
          )}
        </div>

        {showTemperatureSlider && (
          <div className="bg-slate-800/20 rounded-xl p-3 border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs">Temperature</span>
              <span className={`text-sm font-mono font-medium ${stateConf.textClass}`}>
                {temperature}°C
              </span>
            </div>

            <input
              type="range"
              min={tempRange.min}
              max={tempRange.max}
              value={temperature}
              onChange={e => handleTemperatureChange(parseInt(e.target.value, 10))}
              className="w-full h-2.5 rounded-lg appearance-none cursor-pointer"
              style={{ background: sliderBackground }}
              aria-label="Temperature"
            />

            {showStateLabels && showPhaseMarkers && (
              <div className="relative h-5">
                <div
                  className="absolute text-[9px] text-blue-400 font-mono -translate-x-1/2"
                  style={{ left: `${((substance.meltingPoint - tempRange.min) / (tempRange.max - tempRange.min)) * 100}%` }}
                >
                  {substance.meltingPoint}° MP
                </div>
                <div
                  className="absolute text-[9px] text-orange-400 font-mono -translate-x-1/2"
                  style={{ left: `${((substance.boilingPoint - tempRange.min) / (tempRange.max - tempRange.min)) * 100}%` }}
                >
                  {substance.boilingPoint}° BP
                </div>
              </div>
            )}

            {showParticleSpeed && (
              <div className="flex items-center gap-2">
                <span className="text-slate-600 text-[10px]">Particle Energy</span>
                <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${particleSpeed}%`,
                      background: `linear-gradient(to right, ${STATE_CONFIG.solid.sliderColor}, ${STATE_CONFIG.gas.sliderColor})`,
                    }}
                  />
                </div>
                <span className="text-slate-500 text-[10px] font-mono">{Math.round(particleSpeed)}%</span>
              </div>
            )}
          </div>
        )}

        {showEnergyGraph && (
          <EnergyGraph
            temperature={temperature}
            meltingPoint={substance.meltingPoint}
            boilingPoint={substance.boilingPoint}
            minTemp={tempRange.min}
            maxTemp={tempRange.max}
          />
        )}

        {availableSubstances && availableSubstances.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-slate-500 text-[10px] uppercase tracking-wider self-center mr-1">Substance:</span>
            {availableSubstances.map(key => {
              const preset = PRESET_SUBSTANCES[key];
              if (!preset) return null;
              const isActive = substance.name === preset.name;
              return (
                <LuminaButton
                  key={key}
                  tone={isActive ? 'primary' : 'ghost'}
                  className="h-auto py-1 px-2 text-xs"
                  onClick={() => handleSwitchSubstance(key)}
                >
                  {preset.name}
                </LuminaButton>
              );
            })}
          </div>
        )}

        <p className="text-slate-600 text-[10px] text-center">
          Explored {substancesExplored.size} substance{substancesExplored.size === 1 ? '' : 's'}
        </p>
      </LuminaCardContent>
    </LuminaCard>
  );
};

// ============================================================================
// Component — the fork
// ============================================================================

const StatesOfMatter: React.FC<StatesOfMatterProps> = ({ data, className }) => {
  const band: StatesBand = data.gradeBand ?? '3-5';
  const judgedItems = useMemo(
    () => itemsFromChallenges(data.challenges ?? [], {
      band,
      tier: data.supportTier ?? 'medium',
    }),
    [data.challenges, band, data.supportTier],
  );

  // A payload whose challenges ALL dropped degrades to exploration rather than
  // to an empty judged session — the build gates never repair, they drop, and
  // the free sim is a real surface rather than a placeholder.
  if (judgedItems.length === 0) {
    const explorerData: StatesOfMatterData = {
      ...data,
      substance: data.substance ?? PRESET_SUBSTANCES.water,
      particleConfig: data.particleConfig ?? DEFAULT_PARTICLES,
      substances: data.substances ?? Object.keys(PRESET_SUBSTANCES).filter(
        (k) => (substanceFactsOf(k)?.bands ?? []).includes(band),
      ),
    };
    return <StatesOfMatterExplorer data={explorerData} className={className} />;
  }

  return <StatesOfMatterJudged data={data} className={className} />;
};

export default StatesOfMatter;
