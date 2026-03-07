'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, TrendingUp, Zap, Target, ChevronDown } from 'lucide-react';

// ============================================================================
// IRT Math — ported from backend/app/services/calibration_engine.py
// ============================================================================

const IRT_CORRECT_THRESHOLD = 9.0;
const DEFAULT_THETA = 3.0;
const DEFAULT_SIGMA = 2.0;
const THETA_GRID_MIN = 0.0;
const THETA_GRID_MAX = 10.0;
const THETA_GRID_STEP = 0.1;

// θ → mode mapping (from pulse.py)
const THETA_TO_MODE: [number, number][] = [
  [2.0, 1], [3.0, 2], [4.5, 3], [6.0, 4], [7.5, 5], [Infinity, 6],
];

function thetaToMode(theta: number): number {
  for (const [threshold, mode] of THETA_TO_MODE) {
    if (theta < threshold) return mode;
  }
  return 6;
}

const MODE_LABELS: Record<number, { label: string; beta: number; color: string }> = {
  1: { label: 'Concrete manipulatives', beta: 1.5, color: 'text-green-400' },
  2: { label: 'Pictorial + prompts', beta: 2.5, color: 'text-emerald-400' },
  3: { label: 'Pictorial, reduced', beta: 3.5, color: 'text-cyan-400' },
  4: { label: 'Transitional symbolic', beta: 5.0, color: 'text-blue-400' },
  5: { label: 'Fully symbolic', beta: 6.5, color: 'text-violet-400' },
  6: { label: 'Multi-step symbolic', beta: 8.0, color: 'text-purple-400' },
};

// ============================================================================
// Relative gate thresholds — derived from primitive's max beta
// ============================================================================

interface GateThreshold {
  gate: number;
  minTheta: number;
  label: string;
  color: string;
  strokeColor: string;
}

const GATE_META = [
  { gate: 1, label: 'Gate 1: Emerging', color: 'bg-emerald-500', strokeColor: '#10b981' },
  { gate: 2, label: 'Gate 2: Developing', color: 'bg-blue-500', strokeColor: '#3b82f6' },
  { gate: 3, label: 'Gate 3: Proficient', color: 'bg-violet-500', strokeColor: '#8b5cf6' },
  { gate: 4, label: 'Gate 4: Mastered', color: 'bg-purple-500', strokeColor: '#a855f7' },
];

/**
 * Compute gate thresholds from a primitive's beta range.
 *
 * Uses proportional placement with a minimum spread to ensure:
 *  1. Gates are always monotonically increasing
 *  2. Easy primitives still require meaningful evidence (~6-8 correct)
 *  3. Hard primitives require proportionally more (~10-14 correct)
 *
 * MIN_SPREAD prevents the gate range from collapsing for easy/single-mode
 * primitives where maxBeta - minBeta is small. Without it, Sorting Station
 * (single mode, beta=1.5) has a 1.0-unit spread and clears G4 in 2-3 attempts.
 *
 * Starting theta = min_beta, so no gate is pre-passed.
 */
const MIN_GATE_SPREAD = 2.5;

function computeGateThresholds(maxBeta: number, minBeta: number): GateThreshold[] {
  const rawSpread = maxBeta + 1.0 - minBeta;
  const spread = Math.max(MIN_GATE_SPREAD, rawSpread);

  const thresholds = [
    minBeta + spread * 0.20,  // G1: 20% of journey
    minBeta + spread * 0.45,  // G2: 45% of journey
    minBeta + spread * 0.75,  // G3: 75% of journey
    minBeta + spread * 1.00,  // G4: full mastery
  ];
  return GATE_META.map((g, i) => ({
    ...g,
    minTheta: Math.round(thresholds[i] * 100) / 100,
  }));
}

interface AbilityState {
  theta: number;
  sigma: number;
  earnedLevel: number;
  totalItemsSeen: number;
}

interface SubmissionRecord {
  index: number;
  score: number;
  isCorrect: boolean;
  itemBeta: number;
  mode: number;
  thetaBefore: number;
  thetaAfter: number;
  sigmaBefore: number;
  sigmaAfter: number;
  earnedLevel: number;
}

/**
 * Bayesian grid-approximation EAP update.
 * Exact port of CalibrationEngine._update_student_theta().
 */
function updateTheta(
  ability: AbilityState,
  itemBeta: number,
  isCorrect: boolean,
): AbilityState {
  const gridSize = Math.round((THETA_GRID_MAX - THETA_GRID_MIN) / THETA_GRID_STEP) + 1;
  const gridPoints: number[] = [];
  for (let i = 0; i < gridSize; i++) {
    gridPoints.push(Math.round((THETA_GRID_MIN + i * THETA_GRID_STEP) * 10) / 10);
  }

  // Prior: normal centered on current θ
  let prior = gridPoints.map((t) => {
    const z = (t - ability.theta) / ability.sigma;
    return Math.exp(-0.5 * z * z);
  });
  const priorSum = prior.reduce((a, b) => a + b, 0);
  if (priorSum > 0) prior = prior.map((p) => p / priorSum);

  // Likelihood: 1PL Rasch
  const likelihood = gridPoints.map((t) => {
    const logit = Math.max(-20, Math.min(20, t - itemBeta));
    const pCorrect = 1 / (1 + Math.exp(-logit));
    return isCorrect ? pCorrect : 1 - pCorrect;
  });

  // Posterior
  let posterior = prior.map((p, i) => p * likelihood[i]);
  const postSum = posterior.reduce((a, b) => a + b, 0);
  if (postSum > 0) posterior = posterior.map((p) => p / postSum);
  else posterior = prior;

  // EAP
  let newTheta = gridPoints.reduce((sum, t, i) => sum + t * posterior[i], 0);
  newTheta = Math.round(Math.max(0, Math.min(10, newTheta)) * 100) / 100;

  // Posterior sigma
  const variance = gridPoints.reduce(
    (sum, t, i) => sum + posterior[i] * (t - newTheta) ** 2,
    0,
  );
  const newSigma =
    Math.round(Math.max(0.1, Math.min(5, Math.sqrt(variance))) * 1000) / 1000;

  return {
    theta: newTheta,
    sigma: newSigma,
    earnedLevel: Math.round(newTheta * 10) / 10,
    totalItemsSeen: ability.totalItemsSeen + 1,
  };
}

// ============================================================================
// Problem Type Registry (subset from backend)
// ============================================================================

interface PrimitiveConfig {
  label: string;
  modes: { evalMode: string; label: string; priorBeta: number }[];
}

const PRIMITIVE_REGISTRY: Record<string, PrimitiveConfig> = {
  'ten-frame': {
    label: 'Ten Frame',
    modes: [
      { evalMode: 'build', label: 'Build (concrete)', priorBeta: 1.5 },
      { evalMode: 'subitize', label: 'Subitize (perceptual)', priorBeta: 2.5 },
      { evalMode: 'make_ten', label: 'Make Ten (strategy)', priorBeta: 3.5 },
      { evalMode: 'operate', label: 'Operate (symbolic)', priorBeta: 5.0 },
    ],
  },
  'number-line': {
    label: 'Number Line',
    modes: [
      { evalMode: 'explore', label: 'Explore', priorBeta: 1.5 },
      { evalMode: 'plot', label: 'Plot values', priorBeta: 2.0 },
      { evalMode: 'compare', label: 'Compare/order', priorBeta: 3.0 },
      { evalMode: 'jump', label: 'Show jumps', priorBeta: 3.5 },
    ],
  },
  'counting-board': {
    label: 'Counting Board',
    modes: [
      { evalMode: 'count', label: 'Count objects', priorBeta: 1.0 },
      { evalMode: 'subitize', label: 'Quick-count', priorBeta: 2.0 },
      { evalMode: 'group', label: 'Group by attribute', priorBeta: 2.0 },
      { evalMode: 'compare', label: 'Compare groups', priorBeta: 2.5 },
      { evalMode: 'count_on', label: 'Count on', priorBeta: 2.5 },
    ],
  },
  'function-machine': {
    label: 'Function Machine',
    modes: [
      { evalMode: 'observe', label: 'Observe I/O', priorBeta: 2.5 },
      { evalMode: 'predict', label: 'Predict output', priorBeta: 3.0 },
      { evalMode: 'discover', label: 'Discover rule', priorBeta: 3.5 },
      { evalMode: 'create', label: 'Create function', priorBeta: 4.5 },
    ],
  },
  'pattern-builder': {
    label: 'Pattern Builder',
    modes: [
      { evalMode: 'identify', label: 'Identify pattern', priorBeta: 2.5 },
      { evalMode: 'extend', label: 'Extend pattern', priorBeta: 3.0 },
      { evalMode: 'create', label: 'Create pattern', priorBeta: 3.5 },
      { evalMode: 'translate', label: 'Translate pattern', priorBeta: 4.0 },
    ],
  },
  'sorting-station': {
    label: 'Sorting Station',
    modes: [{ evalMode: 'default', label: 'Sort by attribute', priorBeta: 1.5 }],
  },
  'math-fact-fluency': {
    label: 'Math Fact Fluency',
    modes: [{ evalMode: 'default', label: 'Timed recall', priorBeta: 4.0 }],
  },
  'area-model': {
    label: 'Area Model',
    modes: [{ evalMode: 'default', label: 'Multiplication', priorBeta: 5.0 }],
  },
  'strategy-picker': {
    label: 'Strategy Picker',
    modes: [{ evalMode: 'default', label: 'Choose strategy', priorBeta: 5.0 }],
  },
  'knowledge-check': {
    label: 'Knowledge Check',
    modes: [{ evalMode: 'default', label: 'Multiple choice', priorBeta: 3.0 }],
  },
  'true-false': {
    label: 'True / False',
    modes: [{ evalMode: 'default', label: 'True/false', priorBeta: 2.0 }],
  },
};

function getPrimitiveBetaRange(key: string): { min: number; max: number } {
  const prim = PRIMITIVE_REGISTRY[key];
  const betas = prim.modes.map((m) => m.priorBeta);
  return { min: Math.min(...betas), max: Math.max(...betas) };
}

// ============================================================================
// Trajectory Chart (SVG)
// ============================================================================

const ThetaChart: React.FC<{
  history: SubmissionRecord[];
  gates: GateThreshold[];
  maxBeta: number;
  width?: number;
  height?: number;
}> = ({ history, gates, maxBeta, width = 600, height = 240 }) => {
  if (history.length === 0) return null;

  // Dynamic Y-axis: scale to show all gates + headroom
  const yMax = Math.max(10, gates[gates.length - 1].minTheta + 2);
  const yMin = 0;

  const pad = { top: 20, right: 30, bottom: 30, left: 40 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  const xScale = (i: number) => pad.left + (i / Math.max(1, history.length - 1)) * w;
  const yScale = (v: number) => pad.top + h - ((v - yMin) / (yMax - yMin)) * h;

  // Build theta path
  const thetaPoints = history.map((r, i) => `${xScale(i)},${yScale(r.thetaAfter)}`);
  const thetaPath = `M${thetaPoints.join(' L')}`;

  // Sigma band
  const bandUp = history.map(
    (r, i) => `${xScale(i)},${yScale(Math.min(yMax, r.thetaAfter + r.sigmaAfter))}`,
  );
  const bandDown = history
    .map(
      (r, i) => `${xScale(i)},${yScale(Math.max(yMin, r.thetaAfter - r.sigmaAfter))}`,
    )
    .reverse();
  const bandPath = `M${bandUp.join(' L')} L${bandDown.join(' L')} Z`;

  // Y-axis ticks
  const yTicks: number[] = [];
  for (let v = 0; v <= yMax; v += 2) yTicks.push(v);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
      {/* Y-axis gridlines + labels */}
      {yTicks.map((v) => (
        <g key={v}>
          <line
            x1={pad.left}
            y1={yScale(v)}
            x2={width - pad.right}
            y2={yScale(v)}
            stroke="rgba(148,163,184,0.15)"
            strokeDasharray="4,4"
          />
          <text
            x={pad.left - 8}
            y={yScale(v) + 4}
            textAnchor="end"
            className="fill-slate-500"
            fontSize={10}
          >
            {v}
          </text>
        </g>
      ))}

      {/* Gate threshold lines (dynamic per-primitive) */}
      {gates.map((g) => (
        <g key={g.gate}>
          <line
            x1={pad.left}
            y1={yScale(g.minTheta)}
            x2={width - pad.right}
            y2={yScale(g.minTheta)}
            stroke={g.strokeColor}
            strokeWidth={1.5}
            strokeDasharray="6,4"
            opacity={0.6}
          />
          <text
            x={width - pad.right + 3}
            y={yScale(g.minTheta) + 3}
            fontSize={9}
            className="fill-slate-400"
          >
            G{g.gate}
          </text>
        </g>
      ))}

      {/* Max beta reference line */}
      <line
        x1={pad.left}
        y1={yScale(maxBeta)}
        x2={width - pad.right}
        y2={yScale(maxBeta)}
        stroke="#f59e0b"
        strokeWidth={1}
        strokeDasharray="2,3"
        opacity={0.5}
      />
      <text
        x={width - pad.right + 3}
        y={yScale(maxBeta) + 3}
        fontSize={8}
        className="fill-amber-500"
      >
        Bmax
      </text>

      {/* Sigma confidence band */}
      <path d={bandPath} fill="rgba(99,102,241,0.15)" />

      {/* Theta line */}
      <path d={thetaPath} fill="none" stroke="#818cf8" strokeWidth={2} />

      {/* Score dots */}
      {history.map((r, i) => (
        <circle
          key={i}
          cx={xScale(i)}
          cy={yScale(r.thetaAfter)}
          r={3.5}
          fill={r.isCorrect ? '#34d399' : '#f87171'}
          stroke="rgba(0,0,0,0.3)"
          strokeWidth={1}
        />
      ))}

      {/* X-axis label */}
      <text
        x={pad.left + w / 2}
        y={height - 4}
        textAnchor="middle"
        fontSize={10}
        className="fill-slate-500"
      >
        Submissions ({history.length})
      </text>

      {/* Y-axis label */}
      <text
        x={12}
        y={pad.top + h / 2}
        textAnchor="middle"
        fontSize={10}
        className="fill-slate-500"
        transform={`rotate(-90, 12, ${pad.top + h / 2})`}
      >
        theta
      </text>
    </svg>
  );
};

// ============================================================================
// Presets — scripted sequences to demonstrate different scenarios
// ============================================================================

interface Preset {
  label: string;
  desc: string;
  primitiveKey: string;
  steps: { modeIdx: number; score: number }[];
}

const PRESETS: Preset[] = [
  {
    label: 'Counting Board: Full Mastery',
    desc: 'Escalate through all counting modes. Spread clamped to 3.0 minimum.',
    primitiveKey: 'counting-board',
    steps: [
      ...Array.from({ length: 3 }, () => ({ modeIdx: 0, score: 10 })), // count B=1.0
      ...Array.from({ length: 3 }, () => ({ modeIdx: 1, score: 10 })), // subitize B=2.0
      ...Array.from({ length: 3 }, () => ({ modeIdx: 3, score: 10 })), // compare B=2.5
      ...Array.from({ length: 5 }, () => ({ modeIdx: 4, score: 10 })), // count_on B=2.5
    ],
  },
  {
    label: 'Ten Frame: Scaled Mastery',
    desc: 'Build through all 4 modes. Wide beta range uses natural spread.',
    primitiveKey: 'ten-frame',
    steps: [
      ...Array.from({ length: 3 }, () => ({ modeIdx: 0, score: 10 })), // build B=1.5
      ...Array.from({ length: 3 }, () => ({ modeIdx: 1, score: 10 })), // subitize B=2.5
      ...Array.from({ length: 3 }, () => ({ modeIdx: 2, score: 10 })), // make_ten B=3.5
      ...Array.from({ length: 5 }, () => ({ modeIdx: 3, score: 10 })), // operate B=5.0
    ],
  },
  {
    label: 'Ten Frame: Grind Easy (stalls)',
    desc: 'Only Build mode (B=1.5), never escalates. Can never reach Gate 3+.',
    primitiveKey: 'ten-frame',
    steps: Array.from({ length: 20 }, () => ({ modeIdx: 0, score: 10 })),
  },
  {
    label: 'Function Machine: Struggle + Recovery',
    desc: 'Overreach at Create mode, fail, drop back, then climb properly.',
    primitiveKey: 'function-machine',
    steps: [
      ...Array.from({ length: 3 }, () => ({ modeIdx: 0, score: 10 })), // observe B=2.5
      { modeIdx: 3, score: 3 }, // overreach: create B=4.5
      { modeIdx: 3, score: 4 },
      ...Array.from({ length: 3 }, () => ({ modeIdx: 1, score: 10 })), // recover: predict B=3.0
      ...Array.from({ length: 3 }, () => ({ modeIdx: 2, score: 10 })), // discover B=3.5
      ...Array.from({ length: 5 }, () => ({ modeIdx: 3, score: 10 })), // create B=4.5
    ],
  },
  {
    label: 'Sorting Station: Ceiling Demo',
    desc: 'Only 1 mode (B=1.5). Min spread forces G4 to 4.5 — grinding stalls without harder modes.',
    primitiveKey: 'sorting-station',
    steps: Array.from({ length: 12 }, () => ({ modeIdx: 0, score: 10 })),
  },
];

// ============================================================================
// Main Component
// ============================================================================

interface CalibrationSimulatorProps {
  onBack: () => void;
}

function makeInitialAbility(startTheta: number): AbilityState {
  return {
    theta: startTheta,
    sigma: DEFAULT_SIGMA,
    earnedLevel: Math.round(startTheta * 10) / 10,
    totalItemsSeen: 0,
  };
}

const CalibrationSimulator: React.FC<CalibrationSimulatorProps> = ({ onBack }) => {
  // Input state
  const [selectedPrimitive, setSelectedPrimitive] = useState('ten-frame');
  const [selectedModeIdx, setSelectedModeIdx] = useState(0);
  const [score, setScore] = useState(10);

  // Relative gate thresholds for the current primitive
  const { min: minBeta, max: maxBeta } = useMemo(
    () => getPrimitiveBetaRange(selectedPrimitive),
    [selectedPrimitive],
  );
  const gates = useMemo(
    () => computeGateThresholds(maxBeta, minBeta),
    [maxBeta, minBeta],
  );

  // Student state — starting theta = min_beta of selected primitive
  const [ability, setAbility] = useState<AbilityState>(() =>
    makeInitialAbility(getPrimitiveBetaRange('ten-frame').min),
  );
  const [history, setHistory] = useState<SubmissionRecord[]>([]);

  // Preset playback
  const [playingPreset, setPlayingPreset] = useState<string | null>(null);

  const currentPrimitive = PRIMITIVE_REGISTRY[selectedPrimitive];
  const currentMode = currentPrimitive.modes[selectedModeIdx];
  const currentStudentMode = thetaToMode(ability.theta);

  const handleSubmit = useCallback(
    (overrideScore?: number, overrideBeta?: number) => {
      const s = overrideScore ?? score;
      const beta = overrideBeta ?? currentMode.priorBeta;
      const isCorrect = s >= IRT_CORRECT_THRESHOLD;

      setAbility((prev) => {
        const updated = updateTheta(prev, beta, isCorrect);

        const record: SubmissionRecord = {
          index: prev.totalItemsSeen,
          score: s,
          isCorrect,
          itemBeta: beta,
          mode: thetaToMode(prev.theta),
          thetaBefore: prev.theta,
          thetaAfter: updated.theta,
          sigmaBefore: prev.sigma,
          sigmaAfter: updated.sigma,
          earnedLevel: updated.earnedLevel,
        };

        setHistory((h) => [...h, record]);
        return updated;
      });
    },
    [score, currentMode],
  );

  const handleReset = useCallback(() => {
    const { min } = getPrimitiveBetaRange(selectedPrimitive);
    setAbility(makeInitialAbility(min));
    setHistory([]);
    setPlayingPreset(null);
  }, [selectedPrimitive]);

  const handlePreset = useCallback(
    (preset: Preset) => {
      // Switch to preset's primitive
      setSelectedPrimitive(preset.primitiveKey);
      setSelectedModeIdx(0);

      // Start theta at the preset primitive's min_beta
      const { min: presetMinBeta } = getPrimitiveBetaRange(preset.primitiveKey);
      let state: AbilityState = makeInitialAbility(presetMinBeta);
      const records: SubmissionRecord[] = [];
      const prim = PRIMITIVE_REGISTRY[preset.primitiveKey];

      for (const step of preset.steps) {
        const mode = prim.modes[step.modeIdx];
        const isCorrect = step.score >= IRT_CORRECT_THRESHOLD;
        const updated = updateTheta(state, mode.priorBeta, isCorrect);

        records.push({
          index: state.totalItemsSeen,
          score: step.score,
          isCorrect,
          itemBeta: mode.priorBeta,
          mode: thetaToMode(state.theta),
          thetaBefore: state.theta,
          thetaAfter: updated.theta,
          sigmaBefore: state.sigma,
          sigmaAfter: updated.sigma,
          earnedLevel: updated.earnedLevel,
        });

        state = updated;
      }

      setAbility(state);
      setHistory(records);
      setPlayingPreset(null);
    },
    [],
  );

  // Derived stats
  const maxGateReached = useMemo(() => {
    let gate = 0;
    for (const g of gates) {
      if (ability.theta >= g.minTheta) gate = g.gate;
    }
    return gate;
  }, [ability.theta, gates]);

  const submissionsToNextGate = useMemo(() => {
    const nextGate = gates.find((g) => ability.theta < g.minTheta);
    if (!nextGate) return null;
    return {
      gate: nextGate.gate,
      needed: nextGate.minTheta,
      delta: +(nextGate.minTheta - ability.theta).toFixed(2),
    };
  }, [ability.theta, gates]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="max-w-[1920px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
              &larr; Back
            </button>
            <div className="h-6 w-px bg-slate-700" />
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-indigo-400" />
              IRT Calibration Simulator
            </h1>
          </div>
          <Button
            variant="ghost"
            className="bg-white/5 border border-white/20 hover:bg-white/10"
            onClick={handleReset}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      <div className="max-w-[1920px] mx-auto p-6 grid grid-cols-12 gap-6">
        {/* ============================================================ */}
        {/* Left Panel — Controls */}
        {/* ============================================================ */}
        <div className="col-span-3 space-y-4">
          {/* Primitive Selector */}
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Primitive
            </h3>
            <div className="relative">
              <select
                value={selectedPrimitive}
                onChange={(e) => {
                  const newPrim = e.target.value;
                  setSelectedPrimitive(newPrim);
                  setSelectedModeIdx(0);
                  // Reset ability to new primitive's starting theta
                  const { min } = getPrimitiveBetaRange(newPrim);
                  setAbility(makeInitialAbility(min));
                  setHistory([]);
                }}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
              >
                {Object.entries(PRIMITIVE_REGISTRY).map(([key, config]) => {
                  const { max } = getPrimitiveBetaRange(key);
                  return (
                    <option key={key} value={key}>
                      {config.label} (Bmax={max})
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            {/* Beta range summary */}
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="text-slate-500">Beta range:</span>
              <span className="font-mono text-amber-400">{minBeta}</span>
              <span className="text-slate-600">&rarr;</span>
              <span className="font-mono text-amber-400">{maxBeta}</span>
              <span className="text-slate-600 ml-auto">G4 = {gates[3]?.minTheta.toFixed(1)}</span>
            </div>
          </Card>

          {/* Eval Mode / Difficulty */}
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Eval Mode (difficulty)
            </h3>
            <div className="space-y-1.5">
              {currentPrimitive.modes.map((mode, idx) => (
                <button
                  key={mode.evalMode}
                  onClick={() => setSelectedModeIdx(idx)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                    selectedModeIdx === idx
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span>{mode.label}</span>
                    <span
                      className={`text-xs font-mono ${selectedModeIdx === idx ? 'text-indigo-200' : 'text-slate-500'}`}
                    >
                      B={mode.priorBeta}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Score Input */}
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Score (0-10)
            </h3>
            <div className="space-y-3">
              <input
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={score}
                onChange={(e) => setScore(parseFloat(e.target.value))}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between items-center">
                <span
                  className={`text-2xl font-bold font-mono ${
                    score >= IRT_CORRECT_THRESHOLD ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {score.toFixed(1)}
                </span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    score >= IRT_CORRECT_THRESHOLD
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {score >= IRT_CORRECT_THRESHOLD ? 'CORRECT (IRT)' : 'INCORRECT (IRT)'}
                </span>
              </div>
              <Button
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold"
                onClick={() => handleSubmit()}
              >
                <Zap className="w-4 h-4 mr-2" />
                Submit Result
              </Button>
            </div>
          </Card>

          {/* Presets */}
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Preset Scenarios
            </h3>
            <div className="space-y-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePreset(preset)}
                  disabled={playingPreset !== null}
                  className="w-full text-left px-3 py-2 rounded-lg bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:text-white transition-all text-sm disabled:opacity-50"
                >
                  <div className="font-medium">{preset.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{preset.desc}</div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* ============================================================ */}
        {/* Center — Chart + Stats */}
        {/* ============================================================ */}
        <div className="col-span-6 space-y-4">
          {/* Current State Dashboard */}
          <div className="grid grid-cols-4 gap-3">
            {[
              {
                label: 'theta (ability)',
                value: ability.theta.toFixed(2),
                sub: `sigma = ${ability.sigma.toFixed(3)}`,
                color: 'text-indigo-400',
              },
              {
                label: 'Earned Level',
                value: ability.earnedLevel.toFixed(1),
                sub: `/ 10.0`,
                color: 'text-cyan-400',
              },
              {
                label: 'Current Mode',
                value: `${currentStudentMode}`,
                sub: MODE_LABELS[currentStudentMode].label,
                color: MODE_LABELS[currentStudentMode].color,
              },
              {
                label: 'Gate Eligible',
                value: `Gate ${maxGateReached}`,
                sub: submissionsToNextGate
                  ? `Next: G${submissionsToNextGate.gate} needs +${submissionsToNextGate.delta}`
                  : 'Max gate reached',
                color:
                  maxGateReached >= 4
                    ? 'text-purple-400'
                    : maxGateReached >= 2
                      ? 'text-blue-400'
                      : 'text-emerald-400',
              },
            ].map((stat) => (
              <Card
                key={stat.label}
                className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4 text-center"
              >
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                  {stat.label}
                </div>
                <div className={`text-3xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-slate-500 mt-1">{stat.sub}</div>
              </Card>
            ))}
          </div>

          {/* Theta Trajectory Chart */}
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Ability Trajectory
              </h3>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> correct
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400" /> incorrect
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-amber-500/60" /> Bmax
                </span>
              </div>
            </div>
            {history.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-slate-600 text-sm">
                Submit results or run a preset to see the trajectory
              </div>
            ) : (
              <ThetaChart history={history} gates={gates} maxBeta={maxBeta} />
            )}
          </Card>

          {/* EL Progress Bar — relative to this primitive's Gate 4 */}
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Earned Level Progress
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                Start: {minBeta} | G4: {gates[3].minTheta.toFixed(1)} (spread {Math.max(MIN_GATE_SPREAD, maxBeta + 1.0 - minBeta).toFixed(1)})
              </span>
            </div>
            <div className="relative h-8 bg-slate-800 rounded-full overflow-hidden">
              {/* Gate markers — scaled to Gate 4 target */}
              {gates.map((g) => {
                const pct = Math.min(100, (g.minTheta / gates[3].minTheta) * 100);
                return (
                  <div
                    key={g.gate}
                    className="absolute top-0 h-full w-px bg-white/30"
                    style={{ left: `${pct}%` }}
                  >
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 whitespace-nowrap">
                      G{g.gate} ({g.minTheta})
                    </span>
                  </div>
                );
              })}
              {/* Fill */}
              <div
                className="h-full bg-gradient-to-r from-indigo-600 to-violet-500 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (ability.earnedLevel / gates[3].minTheta) * 100)}%`,
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-white drop-shadow">
                  EL {ability.earnedLevel.toFixed(1)}
                </span>
              </div>
            </div>
          </Card>

          {/* Gate Thresholds Table */}
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Gate Thresholds for {currentPrimitive.label}
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {gates.map((g) => {
                const reached = ability.theta >= g.minTheta;
                return (
                  <div
                    key={g.gate}
                    className={`p-3 rounded-lg border text-center transition-all ${
                      reached
                        ? 'bg-indigo-600/20 border-indigo-500/50 ring-1 ring-indigo-500/30'
                        : 'bg-slate-800/30 border-white/5'
                    }`}
                  >
                    <div
                      className={`text-lg font-bold font-mono ${reached ? 'text-white' : 'text-slate-600'}`}
                    >
                      G{g.gate}
                    </div>
                    <div className={`text-xs mt-1 ${reached ? 'text-slate-300' : 'text-slate-600'}`}>
                      {g.label.split(': ')[1]}
                    </div>
                    <div
                      className={`text-sm font-mono mt-1 ${reached ? 'text-indigo-400' : 'text-slate-700'}`}
                    >
                      theta {g.minTheta}
                    </div>
                    {reached && (
                      <div className="text-[10px] text-green-400 mt-1">REACHED</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 text-xs text-slate-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Formula: spread = max({MIN_GATE_SPREAD}, Bmax+1−Bmin) = {Math.max(MIN_GATE_SPREAD, maxBeta + 1.0 - minBeta).toFixed(1)}.
              Gates at 20/45/75/100% of spread from Bmin ({minBeta}).
            </div>
          </Card>

          {/* Mode Mapping Reference */}
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Mode Mapping (theta to difficulty)
            </h3>
            <div className="grid grid-cols-6 gap-2">
              {Object.entries(MODE_LABELS).map(([mode, info]) => {
                const modeNum = parseInt(mode);
                const isActive = currentStudentMode === modeNum;
                return (
                  <div
                    key={mode}
                    className={`p-2 rounded-lg border text-center transition-all ${
                      isActive
                        ? 'bg-indigo-600/20 border-indigo-500/50 ring-1 ring-indigo-500/30'
                        : 'bg-slate-800/30 border-white/5'
                    }`}
                  >
                    <div
                      className={`text-lg font-bold font-mono ${isActive ? info.color : 'text-slate-600'}`}
                    >
                      {mode}
                    </div>
                    <div className={`text-[10px] mt-1 ${isActive ? 'text-slate-300' : 'text-slate-600'}`}>
                      {info.label}
                    </div>
                    <div
                      className={`text-[10px] font-mono ${isActive ? 'text-slate-400' : 'text-slate-700'}`}
                    >
                      B={info.beta}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* ============================================================ */}
        {/* Right Panel — History Log */}
        {/* ============================================================ */}
        <div className="col-span-3 space-y-4">
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Submission Log ({history.length})
            </h3>
            {history.length === 0 ? (
              <div className="text-center py-8 text-slate-600 text-sm">No submissions yet</div>
            ) : (
              <div className="space-y-1.5 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                {[...history].reverse().map((r) => (
                  <div
                    key={r.index}
                    className={`p-2.5 rounded-lg border text-xs ${
                      r.isCorrect
                        ? 'bg-green-500/5 border-green-500/20'
                        : 'bg-red-500/5 border-red-500/20'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-mono text-slate-400">#{r.index + 1}</span>
                      <span className={`font-bold ${r.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                        {r.score.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>B={r.itemBeta}</span>
                      <span>Mode {r.mode}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-slate-500">theta: {r.thetaBefore.toFixed(2)}</span>
                      <span className="text-indigo-400 font-mono">
                        &rarr; {r.thetaAfter.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">sigma: {r.sigmaBefore.toFixed(3)}</span>
                      <span className="text-slate-400 font-mono">
                        &rarr; {r.sigmaAfter.toFixed(3)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Key Insight */}
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
            <div className="flex items-start gap-2">
              <Target className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-slate-400 space-y-2">
                <p>
                  <span className="text-amber-300 font-semibold">Proportional gates:</span>{' '}
                  <span className="text-white font-medium">
                    {currentPrimitive.label}
                  </span>{' '}
                  starts at θ={minBeta}, G4={gates[3].minTheta}.
                  Spread = max({MIN_GATE_SPREAD}, Bmax+1−Bmin) = {Math.max(MIN_GATE_SPREAD, maxBeta + 1.0 - minBeta).toFixed(1)}.
                </p>
                <p>
                  Min spread ({MIN_GATE_SPREAD}) prevents easy/single-mode primitives from
                  clearing all gates in 2-3 attempts. Hard primitives use their natural
                  wider spread.
                </p>
                <p>
                  Theta stalls when item beta is far below theta. Escalate
                  difficulty to keep climbing — grinding easy modes alone
                  can&apos;t reach G4.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CalibrationSimulator;
