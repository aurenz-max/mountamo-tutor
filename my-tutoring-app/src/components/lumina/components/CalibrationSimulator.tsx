'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, TrendingUp, Zap, Target, ChevronDown, Info, AlertTriangle, Clock, Shield } from 'lucide-react';

// ============================================================================
// IRT Math — 2PL/3PL model with discrimination parameter
// ============================================================================

const IRT_CORRECT_THRESHOLD = 9.0;
const DEFAULT_SIGMA = 2.0;
const THETA_GRID_MIN = 0.0;
const THETA_GRID_MAX = 10.0;
const THETA_GRID_STEP = 0.1;
const ITEM_CREDIBILITY_STANDARD = 200;

// Process noise τ for dynamic θ model (Kalman-style drift).
// Before each update: σ_prior = √(σ² + τ²)
// Old observations lose weight over time → faster recovery from failures.
const THETA_PROCESS_NOISE = 0.15;

// ── 3PL probability: P(correct) = c + (1-c) / (1 + exp(-a(θ-b))) ──────────
function pCorrect(theta: number, a: number, b: number, c: number = 0): number {
  const logit = Math.max(-20, Math.min(20, a * (theta - b)));
  return c + (1 - c) / (1 + Math.exp(-logit));
}

// ── Item information: how much this item reduces uncertainty about θ ────────
function itemInformation(theta: number, a: number, b: number, c: number = 0): number {
  const p = pCorrect(theta, a, b, c);
  const q = 1 - p;
  if (p <= c || q <= 0) return 0;
  const numerator = Math.pow(a, 2) * Math.pow(p - c, 2) * q;
  const denominator = p * Math.pow(1 - c, 2);
  return denominator > 0 ? numerator / denominator : 0;
}

// ============================================================================
// Retention & Mastery Model — IRT-Derived Gates + Memory Decay
// ============================================================================

const DEFAULT_DECAY_RATE = 1.5;
const DEFAULT_INITIAL_STABILITY = 3.0;   // days (display only — derived from gate)
const DEFAULT_STUDENT_THETA = 3.0;       // floor — never decay below "untaught"
const DEFAULT_TARGET_RETENTION = 0.85;   // P below this → review candidate

interface RetentionParams {
  decayRate: number;
  initialStability: number;
  targetRetention: number;
}

const DEFAULT_RETENTION_PARAMS: RetentionParams = {
  decayRate: DEFAULT_DECAY_RATE,
  initialStability: DEFAULT_INITIAL_STABILITY,
  targetRetention: DEFAULT_TARGET_RETENTION,
};

/**
 * Compute effective theta reflecting memory decay over time.
 * Uses power-law decay (√t) — matches Ebbinghaus forgetting curve research.
 * Stability (S) controls the rate: higher S = slower decay.
 */
function effectiveTheta(
  thetaTested: number,
  daysSinceTest: number,
  stability: number,
  decayRate: number = DEFAULT_DECAY_RATE,
): number {
  if (daysSinceTest <= 0) return thetaTested;
  const decay = decayRate * Math.sqrt(daysSinceTest / stability);
  const floor = Math.max(DEFAULT_STUDENT_THETA, thetaTested * 0.5);
  return Math.max(floor, thetaTested - decay);
}

/**
 * Derive mastery gate from IRT state alone — the core of the simplified model.
 * Checks gates 4→1 (highest first), returns the highest passing gate.
 * This is the TypeScript mirror of backend derive_gate_from_irt().
 */
function deriveGateFromIrt(
  theta: number, sigma: number,
  minBeta: number, maxBeta: number, avgA: number = 1.4,
): { gate: number; state: string; p: number; gateName: string } {
  for (const gd of [...GATE_DEFINITIONS].reverse()) {
    const refBeta = minBeta + (maxBeta - minBeta) * gd.refBetaFraction;
    const p = pCorrect(theta, avgA, refBeta);
    if (p >= gd.pThreshold && sigma <= gd.sigmaMax) {
      return {
        gate: gd.gate,
        state: gd.gate >= 4 ? 'mastered' : 'active',
        p,
        gateName: gd.label,
      };
    }
  }
  return { gate: 0, state: 'not_started', p: pCorrect(theta, avgA, minBeta), gateName: 'Not Started' };
}

/** Simulate IRT mastery progression: a sequence of scores updating θ/σ → gate */
interface MasteryProgressionEvent {
  itemNum: number;
  score: number;
  isCorrect: boolean;
  thetaBefore: number;
  thetaAfter: number;
  sigmaBefore: number;
  sigmaAfter: number;
  gate: number;
  gateName: string;
  state: string;
  pAtGateRef: number;
}

function simulateMasteryProgression(
  scores: number[],
  minBeta: number,
  maxBeta: number,
  avgA: number,
  primitiveKey: string,
): MasteryProgressionEvent[] {
  const events: MasteryProgressionEvent[] = [];
  const prim = PRIMITIVE_REGISTRY[primitiveKey];
  if (!prim) return events;

  // Start with default ability
  let ability: AbilityState = { theta: DEFAULT_STUDENT_THETA, sigma: DEFAULT_SIGMA, totalItemsSeen: 0 };
  const history: SubmissionRecord[] = [];
  let cals = makeInitialCalibrations(primitiveKey);

  for (let i = 0; i < scores.length; i++) {
    const score = scores[i];
    const isCorrect = score >= IRT_CORRECT_THRESHOLD;

    // Select best mode for current theta
    let bestMode = prim.modes[0];
    let bestInfo = 0;
    for (const mode of prim.modes) {
      const cal = cals[mode.evalMode];
      const info = itemInformation(ability.theta, cal.currentA, cal.calibratedBeta, cal.c);
      if (info > bestInfo) { bestInfo = info; bestMode = mode; }
    }

    const cal = cals[bestMode.evalMode];
    const useBeta = cal.calibratedBeta;
    const useA = cal.currentA;
    const useC = cal.c;

    const pBefore = pCorrect(ability.theta, useA, useBeta, useC);
    const info = itemInformation(ability.theta, useA, useBeta, useC);

    const { ability: updated, mismatchDetected, streak, effectiveTau } = updateTheta(
      ability, useBeta, useA, useC, isCorrect, history,
    );

    const updatedCal = updateItemCalibration(cal, ability.theta, isCorrect);
    cals = { ...cals, [bestMode.evalMode]: updatedCal };

    history.push({
      index: i, score, isCorrect, itemBeta: useBeta, itemPriorBeta: bestMode.priorBeta,
      itemA: useA, itemPriorA: bestMode.a, itemC: useC,
      mode: thetaToMode(ability.theta),
      thetaBefore: ability.theta, thetaAfter: updated.theta,
      sigmaBefore: ability.sigma, sigmaAfter: updated.sigma,
      pCorrectBefore: pBefore, information: info,
      mismatchDetected, streak, effectiveTau,
      aCredibility: updatedCal.aCredibility, betaCredibility: updatedCal.credibilityZ,
    });

    const gateResult = deriveGateFromIrt(updated.theta, updated.sigma, minBeta, maxBeta, avgA);

    events.push({
      itemNum: i,
      score,
      isCorrect,
      thetaBefore: ability.theta,
      thetaAfter: updated.theta,
      sigmaBefore: ability.sigma,
      sigmaAfter: updated.sigma,
      gate: gateResult.gate,
      gateName: gateResult.gateName,
      state: gateResult.state,
      pAtGateRef: gateResult.p,
    });

    ability = updated;
    if (gateResult.state === 'mastered') break;
  }
  return events;
}

// ── θ → mode mapping (from pulse.py) ───────────────────────────────────────
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
// Probability-based gate thresholds
// ============================================================================

interface GateThreshold {
  gate: number;
  label: string;
  description: string;
  pThreshold: number;
  sigmaMax: number;
  refBetaFraction: number;
  color: string;
  strokeColor: string;
}

const GATE_DEFINITIONS: GateThreshold[] = [
  {
    gate: 1, label: 'Emerging', description: '70% chance at easiest mode',
    pThreshold: 0.70, sigmaMax: 1.5, refBetaFraction: 0.0,
    color: 'bg-emerald-500', strokeColor: '#10b981',
  },
  {
    gate: 2, label: 'Developing', description: '75% chance at mid difficulty',
    pThreshold: 0.75, sigmaMax: 1.2, refBetaFraction: 0.5,
    color: 'bg-blue-500', strokeColor: '#3b82f6',
  },
  {
    gate: 3, label: 'Proficient', description: '80% chance at hard difficulty',
    pThreshold: 0.80, sigmaMax: 1.0, refBetaFraction: 0.8,
    color: 'bg-violet-500', strokeColor: '#8b5cf6',
  },
  {
    gate: 4, label: 'Mastered', description: '90% chance at hardest mode',
    pThreshold: 0.90, sigmaMax: 0.8, refBetaFraction: 1.0,
    color: 'bg-purple-500', strokeColor: '#a855f7',
  },
];

function getGateRefBeta(gate: GateThreshold, minBeta: number, maxBeta: number): number {
  return minBeta + (maxBeta - minBeta) * gate.refBetaFraction;
}

function isGatePassed(
  theta: number, sigma: number,
  gate: GateThreshold,
  minBeta: number, maxBeta: number,
  refA: number,
): boolean {
  const refBeta = getGateRefBeta(gate, minBeta, maxBeta);
  const p = pCorrect(theta, refA, refBeta);
  return p >= gate.pThreshold && sigma <= gate.sigmaMax;
}

// ============================================================================
// Phase 6: σ floor constants (model-mismatch detection)
// ============================================================================

const MISMATCH_WINDOW = 10;
const MISMATCH_MIN_ITEMS = 5;
const MISMATCH_THRESHOLD = 0.15;
const MISMATCH_SIGMA_FLOOR = 0.5;

// Mastery acceleration: when a student has a long consecutive-correct streak,
// process noise τ is amplified so θ converges faster — redundant evidence
// shouldn't force the student to keep proving what's already demonstrated.
const MASTERY_STREAK_THRESHOLD = 5;
const TAU_CAP = 0.5;

// ============================================================================
// Phase 6: Empirical a constants (point-biserial correlation)
// ============================================================================

const A_CREDIBILITY_K = 30;
const A_MIN_OBSERVATIONS = 20;
const A_MIN_P_OBS = 0.1;
const A_MAX_P_OBS = 0.9;
const A_CLAMP_MIN = 0.3;
const A_CLAMP_MAX = 3.0;

// ============================================================================
// Item Calibration State (Phase 6: tracks per-mode empirical parameters)
// ============================================================================

interface ItemCalibrationState {
  priorBeta: number;
  empiricalBeta: number | null;
  calibratedBeta: number;
  credibilityZ: number;
  priorA: number;          // original categorical prior
  currentA: number;        // may update via empirical calibration
  aCredibility: number;
  aSource: 'categorical_prior' | 'empirical';
  c: number;
  totalObservations: number;
  totalCorrect: number;
  sumRespondentTheta: number;
  sumCorrectTheta: number;
  sumThetaSquared: number;
}

function makeItemCalibration(mode: EvalModeConfig): ItemCalibrationState {
  return {
    priorBeta: mode.priorBeta,
    empiricalBeta: null,
    calibratedBeta: mode.priorBeta,
    credibilityZ: 0,
    priorA: mode.a,
    currentA: mode.a,
    aCredibility: 0,
    aSource: 'categorical_prior',
    c: mode.c,
    totalObservations: 0,
    totalCorrect: 0,
    sumRespondentTheta: 0,
    sumCorrectTheta: 0,
    sumThetaSquared: 0,
  };
}

// ============================================================================
// Ability state & Bayesian update (2PL likelihood + Phase 6 σ floor)
// ============================================================================

interface AbilityState {
  theta: number;
  sigma: number;
  totalItemsSeen: number;
}

interface SubmissionRecord {
  index: number;
  score: number;
  isCorrect: boolean;
  itemBeta: number;         // calibrated beta used for this submission
  itemPriorBeta: number;    // original prior for comparison
  itemA: number;            // current a (may be empirical)
  itemPriorA: number;       // original categorical prior for comparison
  itemC: number;
  mode: number;
  thetaBefore: number;
  thetaAfter: number;
  sigmaBefore: number;
  sigmaAfter: number;
  pCorrectBefore: number;
  information: number;
  mismatchDetected: boolean;
  streak: number;
  effectiveTau: number;
  aCredibility: number;
  betaCredibility: number;
}

/**
 * Compute model mismatch using stored per-item predictions.
 * Uses each item's actual P(correct) from submission time, not a retrospective
 * calculation with current parameters. This prevents mismatch from "disappearing"
 * as θ rises — the original predictions capture the model's state when the item
 * was administered.
 */
function computeMismatch(recentHistory: SubmissionRecord[]): number {
  const recent = recentHistory.slice(-MISMATCH_WINDOW);
  if (recent.length < MISMATCH_MIN_ITEMS) return 0;

  let predictedSum = 0;
  let actualSum = 0;
  for (const h of recent) {
    predictedSum += h.pCorrectBefore;
    actualSum += h.isCorrect ? 1 : 0;
  }

  const n = recent.length;
  return (actualSum / n) - (predictedSum / n);
}

/**
 * Count consecutive correct answers from the end of history.
 */
function consecutiveCorrectStreak(history: SubmissionRecord[]): number {
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].isCorrect) streak++;
    else break;
  }
  return streak;
}

/**
 * Bayesian grid-approximation EAP update — 2PL/3PL likelihood
 * with Phase 6.3 adaptive σ floor + mastery streak acceleration.
 *
 * Key improvements over original Phase 6:
 * - Mismatch uses stored per-item predictions (not retrospective)
 * - τ scales proportionally to mismatch magnitude
 * - Consecutive-correct streaks amplify τ (redundant evidence → faster convergence)
 */
function updateTheta(
  ability: AbilityState,
  itemBeta: number,
  itemA: number,
  itemC: number,
  isCorrect: boolean,
  recentHistory: SubmissionRecord[],
): { ability: AbilityState; mismatchDetected: boolean; streak: number; effectiveTau: number } {
  const gridSize = Math.round((THETA_GRID_MAX - THETA_GRID_MIN) / THETA_GRID_STEP) + 1;
  const gridPoints: number[] = [];
  for (let i = 0; i < gridSize; i++) {
    gridPoints.push(Math.round((THETA_GRID_MIN + i * THETA_GRID_STEP) * 10) / 10);
  }

  // Mismatch detection using stored per-item predictions
  const mismatchValue = computeMismatch(recentHistory);
  const isMismatch = mismatchValue > MISMATCH_THRESHOLD;

  // Count consecutive correct streak (including current submission)
  const streak = consecutiveCorrectStreak(recentHistory) + (isCorrect ? 1 : 0);

  // Scaled process noise: τ proportional to mismatch magnitude
  // + mastery streak acceleration for consecutive correct answers.
  // When mismatch is large (student WAY outperforming), τ grows so the
  // Bayesian prior widens and θ can jump more per observation.
  let effectiveTau = 0;
  if (isMismatch) {
    const mismatchScale = Math.min(3.0, mismatchValue / MISMATCH_THRESHOLD);
    effectiveTau = THETA_PROCESS_NOISE * mismatchScale;

    // Mastery acceleration: long streaks = redundant evidence.
    // Each correct beyond the threshold adds 0.4× to the τ multiplier.
    if (streak >= MASTERY_STREAK_THRESHOLD) {
      const streakBonus = 1 + (streak - MASTERY_STREAK_THRESHOLD) * 0.4;
      effectiveTau *= Math.min(3.0, streakBonus);
    }

    effectiveTau = Math.min(TAU_CAP, effectiveTau);
  }

  const priorSigma = Math.sqrt(ability.sigma ** 2 + effectiveTau ** 2);

  // Prior: normal centered on current θ
  let prior = gridPoints.map((t) => {
    const z = (t - ability.theta) / priorSigma;
    return Math.exp(-0.5 * z * z);
  });
  const priorSum = prior.reduce((a, b) => a + b, 0);
  if (priorSum > 0) prior = prior.map((p) => p / priorSum);

  // Likelihood: 2PL/3PL using item's discrimination
  const likelihood = gridPoints.map((t) => {
    const p = pCorrect(t, itemA, itemBeta, itemC);
    return isCorrect ? p : 1 - p;
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
  let newSigma =
    Math.round(Math.max(0.1, Math.min(5, Math.sqrt(variance))) * 1000) / 1000;

  // τ-induced σ correction: process noise widens the prior to let θ jump
  // more, but the extra variance is artificial — it shouldn't inflate the
  // student's measurement uncertainty. Subtract the τ contribution from
  // posterior σ so that σ converges at the same rate as without τ.
  if (effectiveTau > 0) {
    const corrected = Math.sqrt(Math.max(0.01, newSigma ** 2 - effectiveTau ** 2));
    newSigma = Math.round(Math.max(0.1, Math.min(5, corrected)) * 1000) / 1000;
  }

  // σ floor with mismatch detection
  let mismatchDetected = false;
  if (mismatchValue > MISMATCH_THRESHOLD) {
    const floored = Math.max(newSigma, MISMATCH_SIGMA_FLOOR);
    if (floored > newSigma) mismatchDetected = true;
    newSigma = floored;
  }

  return {
    ability: {
      theta: newTheta,
      sigma: newSigma,
      totalItemsSeen: ability.totalItemsSeen + 1,
    },
    mismatchDetected,
    streak,
    effectiveTau,
  };
}

// ============================================================================
// Phase 6.1 + 6.2: Item calibration update
// ============================================================================

/**
 * Update item calibration with 2PL β MLE (6.1) and empirical a (6.2).
 * Mirrors CalibrationEngine._update_item_beta() + _update_empirical_a().
 */
function updateItemCalibration(
  item: ItemCalibrationState,
  studentTheta: number,
  isCorrect: boolean,
): ItemCalibrationState {
  const updated = { ...item };

  // Increment counters
  updated.totalObservations += 1;
  if (isCorrect) {
    updated.totalCorrect += 1;
    updated.sumCorrectTheta += studentTheta;
  }
  updated.sumRespondentTheta += studentTheta;
  updated.sumThetaSquared += studentTheta ** 2;

  // --- β update (6.1: 2PL-adjusted MLE) ---
  const n = updated.totalObservations;
  const correct = updated.totalCorrect;
  const incorrect = n - correct;
  const meanTheta = updated.sumRespondentTheta / n;

  if (correct > 0 && incorrect > 0) {
    const a = Math.max(0.3, updated.currentA);
    updated.empiricalBeta = meanTheta - (1.0 / a) * Math.log(correct / incorrect);
  } else if (correct === 0) {
    updated.empiricalBeta = meanTheta + 2.0;
  } else {
    updated.empiricalBeta = meanTheta - 2.0;
  }
  updated.empiricalBeta = Math.max(0, Math.min(10, updated.empiricalBeta));

  // β credibility blending
  updated.credibilityZ = Math.min(1.0, Math.sqrt(n / ITEM_CREDIBILITY_STANDARD));
  const z = updated.credibilityZ;
  updated.calibratedBeta = Math.round(
    (z * updated.empiricalBeta + (1 - z) * updated.priorBeta) * 1000
  ) / 1000;
  updated.calibratedBeta = Math.max(0, Math.min(10, updated.calibratedBeta));

  // --- Empirical a update (6.2: point-biserial correlation) ---
  if (n >= A_MIN_OBSERVATIONS) {
    const pObs = updated.totalCorrect / n;
    if (pObs > A_MIN_P_OBS && pObs < A_MAX_P_OBS && incorrect > 0) {
      const meanCorrect = updated.sumCorrectTheta / updated.totalCorrect;
      const meanIncorrect = (updated.sumRespondentTheta - updated.sumCorrectTheta) / incorrect;
      const thetaVariance = (updated.sumThetaSquared / n) - (updated.sumRespondentTheta / n) ** 2;

      if (thetaVariance > 0.01) {
        let rPb = ((meanCorrect - meanIncorrect) / Math.sqrt(thetaVariance))
          * Math.sqrt(pObs * (1.0 - pObs));
        rPb = Math.max(-0.95, Math.min(0.95, rPb));

        if (rPb > 0) {
          // Lord's formula: correlation → IRT discrimination
          let aEmpirical = rPb * 1.7 / Math.sqrt(1.0 - rPb ** 2);
          aEmpirical = Math.max(A_CLAMP_MIN, Math.min(A_CLAMP_MAX, aEmpirical));

          // Bühlmann credibility blending
          const zA = n / (n + A_CREDIBILITY_K);
          let aUpdated = zA * aEmpirical + (1.0 - zA) * updated.priorA;
          aUpdated = Math.max(A_CLAMP_MIN, Math.min(A_CLAMP_MAX,
            Math.round(aUpdated * 1000) / 1000));

          updated.currentA = aUpdated;
          updated.aCredibility = Math.round(zA * 1000) / 1000;
          updated.aSource = zA > 0.5 ? 'empirical' : 'categorical_prior';
        }
      }
    }
  }

  return updated;
}

// ============================================================================
// Problem Type Registry — with discrimination (a) and guessing (c)
// ============================================================================

interface EvalModeConfig {
  evalMode: string;
  label: string;
  priorBeta: number;
  a: number;
  c: number;
  aSource: 'categorical_prior' | 'llm_seeded' | 'empirical';
}

interface PrimitiveConfig {
  label: string;
  modes: EvalModeConfig[];
}

const PRIMITIVE_REGISTRY: Record<string, PrimitiveConfig> = {
  'ten-frame': {
    label: 'Ten Frame',
    modes: [
      { evalMode: 'build', label: 'Build (concrete)', priorBeta: 1.5, a: 1.8, c: 0, aSource: 'categorical_prior' },
      { evalMode: 'subitize', label: 'Subitize (perceptual)', priorBeta: 2.5, a: 1.6, c: 0, aSource: 'categorical_prior' },
      { evalMode: 'make_ten', label: 'Make Ten (strategy)', priorBeta: 3.5, a: 1.4, c: 0, aSource: 'categorical_prior' },
      { evalMode: 'operate', label: 'Operate (symbolic)', priorBeta: 5.0, a: 1.6, c: 0, aSource: 'categorical_prior' },
    ],
  },
  'number-line': {
    label: 'Number Line',
    modes: [
      { evalMode: 'explore', label: 'Explore', priorBeta: 1.5, a: 1.4, c: 0, aSource: 'categorical_prior' },
      { evalMode: 'plot', label: 'Plot values', priorBeta: 2.0, a: 1.6, c: 0, aSource: 'categorical_prior' },
      { evalMode: 'compare', label: 'Compare/order', priorBeta: 3.0, a: 1.4, c: 0, aSource: 'categorical_prior' },
      { evalMode: 'jump', label: 'Show jumps', priorBeta: 3.5, a: 1.2, c: 0, aSource: 'categorical_prior' },
    ],
  },
  'counting-board': {
    label: 'Counting Board',
    modes: [
      { evalMode: 'count', label: 'Count objects', priorBeta: 1.0, a: 1.8, c: 0, aSource: 'categorical_prior' },
      { evalMode: 'subitize', label: 'Quick-count', priorBeta: 2.0, a: 1.6, c: 0, aSource: 'categorical_prior' },
      { evalMode: 'group', label: 'Group by attribute', priorBeta: 2.0, a: 1.4, c: 0, aSource: 'categorical_prior' },
      { evalMode: 'compare', label: 'Compare groups', priorBeta: 2.5, a: 1.4, c: 0, aSource: 'categorical_prior' },
      { evalMode: 'count_on', label: 'Count on', priorBeta: 2.5, a: 1.6, c: 0, aSource: 'categorical_prior' },
    ],
  },
  'function-machine': {
    label: 'Function Machine',
    modes: [
      { evalMode: 'observe', label: 'Observe I/O', priorBeta: 2.5, a: 1.2, c: 0, aSource: 'categorical_prior' },
      { evalMode: 'predict', label: 'Predict output', priorBeta: 3.0, a: 1.6, c: 0, aSource: 'categorical_prior' },
      { evalMode: 'discover', label: 'Discover rule', priorBeta: 3.5, a: 1.4, c: 0, aSource: 'categorical_prior' },
      { evalMode: 'create', label: 'Create function', priorBeta: 4.5, a: 1.0, c: 0, aSource: 'categorical_prior' },
    ],
  },
  'pattern-builder': {
    label: 'Pattern Builder',
    modes: [
      { evalMode: 'identify', label: 'Identify pattern', priorBeta: 2.5, a: 1.4, c: 0, aSource: 'categorical_prior' },
      { evalMode: 'extend', label: 'Extend pattern', priorBeta: 3.0, a: 1.6, c: 0, aSource: 'categorical_prior' },
      { evalMode: 'create', label: 'Create pattern', priorBeta: 3.5, a: 1.2, c: 0, aSource: 'categorical_prior' },
      { evalMode: 'translate', label: 'Translate pattern', priorBeta: 4.0, a: 1.0, c: 0, aSource: 'categorical_prior' },
    ],
  },
  'sorting-station': {
    label: 'Sorting Station',
    modes: [
      { evalMode: 'default', label: 'Sort by attribute', priorBeta: 1.5, a: 1.4, c: 0, aSource: 'categorical_prior' },
    ],
  },
  'shape-sorter': {
    label: 'Shape Sorter',
    modes: [
      { evalMode: 'identify', label: 'Identify shapes', priorBeta: 1.5, a: 1.6, c: 0, aSource: 'categorical_prior' },
      { evalMode: 'count', label: 'Count sides/vertices', priorBeta: 2.0, a: 1.4, c: 0, aSource: 'categorical_prior' },
      { evalMode: 'sort', label: 'Sort by property', priorBeta: 2.5, a: 1.4, c: 0, aSource: 'categorical_prior' },
      { evalMode: 'compare', label: 'Compare shapes', priorBeta: 3.0, a: 1.2, c: 0, aSource: 'categorical_prior' },
    ],
  },
  'knowledge-check': {
    label: 'Knowledge Check (MC)',
    modes: [
      { evalMode: 'recall', label: 'Recall (easy MC)', priorBeta: 1.5, a: 1.6, c: 0.25, aSource: 'categorical_prior' },
      { evalMode: 'apply', label: 'Apply (medium MC)', priorBeta: 3.0, a: 1.4, c: 0.25, aSource: 'categorical_prior' },
      { evalMode: 'analyze', label: 'Analyze (hard MC)', priorBeta: 4.5, a: 1.6, c: 0.20, aSource: 'categorical_prior' },
      { evalMode: 'evaluate', label: 'Evaluate (expert MC)', priorBeta: 6.0, a: 1.8, c: 0.15, aSource: 'categorical_prior' },
    ],
  },
  'true-false': {
    label: 'True / False',
    modes: [
      { evalMode: 'default', label: 'True/false', priorBeta: 2.0, a: 1.0, c: 0.5, aSource: 'categorical_prior' },
    ],
  },
};

function getPrimitiveBetaRange(key: string): { min: number; max: number } {
  const prim = PRIMITIVE_REGISTRY[key];
  const betas = prim.modes.map((m) => m.priorBeta);
  return { min: Math.min(...betas), max: Math.max(...betas) };
}

/** Build initial item calibration map for a primitive */
function makeInitialCalibrations(primitiveKey: string): Record<string, ItemCalibrationState> {
  const prim = PRIMITIVE_REGISTRY[primitiveKey];
  const cals: Record<string, ItemCalibrationState> = {};
  for (const mode of prim.modes) {
    cals[mode.evalMode] = makeItemCalibration(mode);
  }
  return cals;
}

// ============================================================================
// Probability Curve (SVG) — shows P(correct) for each eval mode
// ============================================================================

const ProbabilityCurve: React.FC<{
  theta: number;
  sigma: number;
  modes: EvalModeConfig[];
  calibrations: Record<string, ItemCalibrationState>;
  width?: number;
  height?: number;
}> = ({ theta, sigma, modes, calibrations, width = 600, height = 200 }) => {
  const pad = { top: 20, right: 80, bottom: 30, left: 40 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  const xMin = 0;
  const xMax = 10;
  const xScale = (v: number) => pad.left + ((v - xMin) / (xMax - xMin)) * w;
  const yScale = (v: number) => pad.top + h - v * h;

  // Generate curves using calibrated parameters
  const curvePoints = 50;
  const curves = modes.map((mode) => {
    const cal = calibrations[mode.evalMode];
    const useA = cal?.currentA ?? mode.a;
    const useB = cal?.calibratedBeta ?? mode.priorBeta;
    const useC = cal?.c ?? mode.c;
    const points: string[] = [];
    for (let i = 0; i <= curvePoints; i++) {
      const t = xMin + (i / curvePoints) * (xMax - xMin);
      const p = pCorrect(t, useA, useB, useC);
      points.push(`${xScale(t)},${yScale(p)}`);
    }
    return { mode, path: `M${points.join(' L')}`, useA, useB, useC };
  });

  const modeColors = ['#34d399', '#2dd4bf', '#22d3ee', '#60a5fa', '#a78bfa', '#c084fc'];
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];
  const thetaX = xScale(theta);
  const sigmaLeft = xScale(Math.max(xMin, theta - sigma));
  const sigmaRight = xScale(Math.min(xMax, theta + sigma));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
      {yTicks.map((v) => (
        <g key={v}>
          <line
            x1={pad.left} y1={yScale(v)} x2={width - pad.right} y2={yScale(v)}
            stroke="rgba(148,163,184,0.15)" strokeDasharray="4,4"
          />
          <text x={pad.left - 8} y={yScale(v) + 4} textAnchor="end" className="fill-slate-500" fontSize={10}>
            {(v * 100).toFixed(0)}%
          </text>
        </g>
      ))}

      {GATE_DEFINITIONS.map((g) => (
        <g key={g.gate}>
          <line
            x1={pad.left} y1={yScale(g.pThreshold)} x2={width - pad.right} y2={yScale(g.pThreshold)}
            stroke={g.strokeColor} strokeWidth={1} strokeDasharray="3,3" opacity={0.4}
          />
          <text x={pad.left + 4} y={yScale(g.pThreshold) - 3} fontSize={8} fill={g.strokeColor} opacity={0.6}>
            G{g.gate} ({(g.pThreshold * 100).toFixed(0)}%)
          </text>
        </g>
      ))}

      <rect
        x={sigmaLeft} y={pad.top} width={sigmaRight - sigmaLeft} height={h}
        fill="rgba(99,102,241,0.08)" rx={2}
      />

      <line
        x1={thetaX} y1={pad.top} x2={thetaX} y2={pad.top + h}
        stroke="#818cf8" strokeWidth={2} strokeDasharray="4,4" opacity={0.8}
      />
      <text x={thetaX} y={pad.top - 5} textAnchor="middle" fontSize={10} className="fill-indigo-400" fontWeight="bold">
        θ={theta.toFixed(2)}
      </text>

      {curves.map((c, i) => (
        <g key={c.mode.evalMode}>
          <path d={c.path} fill="none" stroke={modeColors[i % modeColors.length]} strokeWidth={2} opacity={0.8} />
          <text
            x={width - pad.right + 4}
            y={yScale(pCorrect(xMax, c.useA, c.useB, c.useC)) + 4}
            fontSize={9}
            fill={modeColors[i % modeColors.length]}
          >
            {c.mode.evalMode}
          </text>
          <circle
            cx={thetaX}
            cy={yScale(pCorrect(theta, c.useA, c.useB, c.useC))}
            r={4}
            fill={modeColors[i % modeColors.length]}
            stroke="rgba(0,0,0,0.4)"
            strokeWidth={1}
          />
        </g>
      ))}

      {[0, 2, 4, 6, 8, 10].map((v) => (
        <text key={v} x={xScale(v)} y={height - 4} textAnchor="middle" fontSize={10} className="fill-slate-500">
          {v}
        </text>
      ))}
      <text x={pad.left + w / 2} y={height - 16} textAnchor="middle" fontSize={9} className="fill-slate-600">
        θ (ability)
      </text>
    </svg>
  );
};

// ============================================================================
// Item Information Chart
// ============================================================================

const InformationChart: React.FC<{
  theta: number;
  modes: EvalModeConfig[];
  calibrations: Record<string, ItemCalibrationState>;
  width?: number;
  height?: number;
}> = ({ theta, modes, calibrations, width = 600, height = 140 }) => {
  const pad = { top: 15, right: 80, bottom: 25, left: 40 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  const xMin = 0;
  const xMax = 10;
  const xScale = (v: number) => pad.left + ((v - xMin) / (xMax - xMin)) * w;

  let globalMaxInfo = 0;
  const curvePoints = 50;
  const curves = modes.map((mode) => {
    const cal = calibrations[mode.evalMode];
    const useA = cal?.currentA ?? mode.a;
    const useB = cal?.calibratedBeta ?? mode.priorBeta;
    const useC = cal?.c ?? mode.c;
    const points: { t: number; info: number }[] = [];
    for (let i = 0; i <= curvePoints; i++) {
      const t = xMin + (i / curvePoints) * (xMax - xMin);
      const info = itemInformation(t, useA, useB, useC);
      if (info > globalMaxInfo) globalMaxInfo = info;
      points.push({ t, info });
    }
    return { mode, points, useA, useB, useC };
  });

  const yScale = (v: number) => pad.top + h - (v / Math.max(0.1, globalMaxInfo)) * h;

  const modeColors = ['#34d399', '#2dd4bf', '#22d3ee', '#60a5fa', '#a78bfa', '#c084fc'];
  const thetaX = xScale(theta);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
      {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
        const v = frac * globalMaxInfo;
        return (
          <g key={frac}>
            <line
              x1={pad.left} y1={yScale(v)} x2={width - pad.right} y2={yScale(v)}
              stroke="rgba(148,163,184,0.1)" strokeDasharray="2,3"
            />
          </g>
        );
      })}

      <line
        x1={thetaX} y1={pad.top} x2={thetaX} y2={pad.top + h}
        stroke="#818cf8" strokeWidth={1.5} strokeDasharray="3,3" opacity={0.6}
      />

      {curves.map((c, i) => {
        const pathStr = `M${c.points.map((p) => `${xScale(p.t)},${yScale(p.info)}`).join(' L')}`;
        const infoAtTheta = itemInformation(theta, c.useA, c.useB, c.useC);
        return (
          <g key={c.mode.evalMode}>
            <path d={pathStr} fill="none" stroke={modeColors[i % modeColors.length]} strokeWidth={1.5} opacity={0.7} />
            <circle
              cx={thetaX} cy={yScale(infoAtTheta)} r={3}
              fill={modeColors[i % modeColors.length]} stroke="rgba(0,0,0,0.3)" strokeWidth={1}
            />
            <text
              x={width - pad.right + 4}
              y={yScale(c.points[curvePoints].info) + 4}
              fontSize={8} fill={modeColors[i % modeColors.length]}
            >
              {c.mode.evalMode}
            </text>
          </g>
        );
      })}

      <text x={12} y={pad.top + h / 2} textAnchor="middle" fontSize={9} className="fill-slate-500"
        transform={`rotate(-90, 12, ${pad.top + h / 2})`}>
        I(θ)
      </text>
      <text x={pad.left + w / 2} y={height - 4} textAnchor="middle" fontSize={9} className="fill-slate-600">
        Item Information — peaks where measurement is most valuable
      </text>
    </svg>
  );
};

// ============================================================================
// Trajectory Chart (SVG)
// ============================================================================

const ThetaChart: React.FC<{
  history: SubmissionRecord[];
  width?: number;
  height?: number;
}> = ({ history, width = 600, height = 220 }) => {
  if (history.length === 0) return null;

  const yMax = 10;
  const yMin = 0;

  const pad = { top: 20, right: 30, bottom: 30, left: 40 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  const xScale = (i: number) => pad.left + (i / Math.max(1, history.length - 1)) * w;
  const yScale = (v: number) => pad.top + h - ((v - yMin) / (yMax - yMin)) * h;

  const thetaPoints = history.map((r, i) => `${xScale(i)},${yScale(r.thetaAfter)}`);
  const thetaPath = `M${thetaPoints.join(' L')}`;

  const bandUp = history.map(
    (r, i) => `${xScale(i)},${yScale(Math.min(yMax, r.thetaAfter + r.sigmaAfter))}`,
  );
  const bandDown = history
    .map(
      (r, i) => `${xScale(i)},${yScale(Math.max(yMin, r.thetaAfter - r.sigmaAfter))}`,
    )
    .reverse();
  const bandPath = `M${bandUp.join(' L')} L${bandDown.join(' L')} Z`;

  const yTicks: number[] = [];
  for (let v = 0; v <= yMax; v += 2) yTicks.push(v);

  // Find mismatch-detected points
  const mismatchPoints = history
    .map((r, i) => ({ i, r }))
    .filter(({ r }) => r.mismatchDetected);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={pad.left} y1={yScale(v)} x2={width - pad.right} y2={yScale(v)}
            stroke="rgba(148,163,184,0.15)" strokeDasharray="4,4" />
          <text x={pad.left - 8} y={yScale(v) + 4} textAnchor="end" className="fill-slate-500" fontSize={10}>
            {v}
          </text>
        </g>
      ))}

      <path d={bandPath} fill="rgba(99,102,241,0.15)" />
      <path d={thetaPath} fill="none" stroke="#818cf8" strokeWidth={2} />

      {/* Mismatch detection indicators */}
      {mismatchPoints.map(({ i, r }) => (
        <g key={`mm-${i}`}>
          <circle
            cx={xScale(i)} cy={yScale(r.thetaAfter)} r={7}
            fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="2,2" opacity={0.7}
          />
        </g>
      ))}

      {history.map((r, i) => (
        <circle
          key={i} cx={xScale(i)} cy={yScale(r.thetaAfter)} r={3.5}
          fill={r.isCorrect ? '#34d399' : '#f87171'}
          stroke="rgba(0,0,0,0.3)" strokeWidth={1}
        />
      ))}

      <text x={pad.left + w / 2} y={height - 4} textAnchor="middle" fontSize={10} className="fill-slate-500">
        Submissions ({history.length})
      </text>
      <text x={12} y={pad.top + h / 2} textAnchor="middle" fontSize={10} className="fill-slate-500"
        transform={`rotate(-90, 12, ${pad.top + h / 2})`}>
        θ
      </text>
    </svg>
  );
};

// ============================================================================
// Retention Model Charts
// ============================================================================

/** Shows effective theta + P(correct) decay over time for given parameters */
const RetentionDecayChart: React.FC<{
  thetaTested: number;
  stability: number;
  itemA: number;
  itemBeta: number;
  itemC: number;
  decayRate: number;
  targetRetention: number;
  width?: number;
  height?: number;
}> = ({ thetaTested, stability, itemA, itemBeta, itemC, decayRate, targetRetention, width = 600, height = 280 }) => {
  const pad = { top: 25, right: 90, bottom: 35, left: 50 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  const maxDays = Math.max(14, Math.min(60, stability * 5));
  const numPoints = 100;

  // Compute decay data
  const data = useMemo(() => {
    const points: { day: number; effTheta: number; p: number; info: number }[] = [];
    for (let i = 0; i <= numPoints; i++) {
      const day = (i / numPoints) * maxDays;
      const effT = effectiveTheta(thetaTested, day, stability, decayRate);
      const p = pCorrect(effT, itemA, itemBeta, itemC);
      const info = itemInformation(effT, itemA, itemBeta, itemC);
      points.push({ day, effTheta: effT, p, info });
    }
    return points;
  }, [thetaTested, stability, itemA, itemBeta, itemC, decayRate, maxDays]);

  // Find the day where P crosses target retention
  const crossDay = useMemo(() => {
    for (let i = 1; i < data.length; i++) {
      if (data[i - 1].p >= targetRetention && data[i].p < targetRetention) {
        // Linear interpolation
        const frac = (targetRetention - data[i].p) / (data[i - 1].p - data[i].p);
        return data[i].day - frac * (data[i].day - data[i - 1].day);
      }
    }
    return null;
  }, [data, targetRetention]);

  const xScale = (d: number) => pad.left + (d / maxDays) * w;
  const yScaleTheta = (t: number) => pad.top + h - ((t - 0) / 10) * h;
  const yScaleP = (p: number) => pad.top + h - p * h;

  // Theta path
  const thetaPath = `M${data.map((d) => `${xScale(d.day)},${yScaleTheta(d.effTheta)}`).join(' L')}`;
  // P(correct) path
  const pPath = `M${data.map((d) => `${xScale(d.day)},${yScaleP(d.p)}`).join(' L')}`;

  const yTicksTheta = [0, 2, 4, 6, 8, 10];
  const yTicksP = [0, 0.25, 0.5, 0.75, 1.0];

  // Day ticks
  const dayTicks: number[] = [];
  const dayStep = maxDays <= 14 ? 2 : maxDays <= 30 ? 5 : 10;
  for (let d = 0; d <= maxDays; d += dayStep) dayTicks.push(d);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
      {/* Grid lines */}
      {yTicksP.map((v) => (
        <g key={`p-${v}`}>
          <line x1={pad.left} y1={yScaleP(v)} x2={pad.left + w} y2={yScaleP(v)}
            stroke="rgba(148,163,184,0.1)" strokeDasharray="3,3" />
        </g>
      ))}

      {/* Left axis (θ) labels */}
      {yTicksTheta.map((v) => (
        <text key={`tl-${v}`} x={pad.left - 8} y={yScaleTheta(v) + 4} textAnchor="end"
          fontSize={9} className="fill-slate-500">{v}</text>
      ))}

      {/* Right axis (P) labels */}
      {yTicksP.map((v) => (
        <text key={`pr-${v}`} x={pad.left + w + 8} y={yScaleP(v) + 4} textAnchor="start"
          fontSize={9} className="fill-slate-500">{(v * 100).toFixed(0)}%</text>
      ))}

      {/* Target retention line */}
      <line x1={pad.left} y1={yScaleP(targetRetention)} x2={pad.left + w} y2={yScaleP(targetRetention)}
        stroke="#f59e0b" strokeWidth={1} strokeDasharray="4,3" opacity={0.6} />
      <text x={pad.left + w + 8} y={yScaleP(targetRetention) + 4} fontSize={8} fill="#f59e0b">
        target {(targetRetention * 100).toFixed(0)}%
      </text>

      {/* Cross-day indicator */}
      {crossDay !== null && (
        <g>
          <line x1={xScale(crossDay)} y1={pad.top} x2={xScale(crossDay)} y2={pad.top + h}
            stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3,3" opacity={0.5} />
          <text x={xScale(crossDay)} y={pad.top - 5} textAnchor="middle" fontSize={9} fill="#f59e0b" fontWeight="bold">
            review ~day {crossDay.toFixed(1)}
          </text>
        </g>
      )}

      {/* Original theta line */}
      <line x1={pad.left} y1={yScaleTheta(thetaTested)} x2={pad.left + w} y2={yScaleTheta(thetaTested)}
        stroke="#818cf8" strokeWidth={1} strokeDasharray="2,4" opacity={0.3} />

      {/* Effective theta curve */}
      <path d={thetaPath} fill="none" stroke="#818cf8" strokeWidth={2.5} opacity={0.9} />

      {/* P(correct) curve */}
      <path d={pPath} fill="none" stroke="#34d399" strokeWidth={2} opacity={0.8} />

      {/* Day axis */}
      {dayTicks.map((d) => (
        <text key={`d-${d}`} x={xScale(d)} y={height - 6} textAnchor="middle" fontSize={9} className="fill-slate-500">
          {d}d
        </text>
      ))}

      {/* Axis labels */}
      <text x={12} y={pad.top + h / 2} textAnchor="middle" fontSize={9} fill="#818cf8"
        transform={`rotate(-90, 12, ${pad.top + h / 2})`}>θ_eff</text>
      <text x={width - 8} y={pad.top + h / 2} textAnchor="middle" fontSize={9} fill="#34d399"
        transform={`rotate(90, ${width - 8}, ${pad.top + h / 2})`}>P(correct)</text>
      <text x={pad.left + w / 2} y={height - 18} textAnchor="middle" fontSize={9} className="fill-slate-600">
        Days since last assessment
      </text>

      {/* Legend */}
      <g transform={`translate(${pad.left + 10}, ${pad.top + 5})`}>
        <line x1={0} y1={0} x2={16} y2={0} stroke="#818cf8" strokeWidth={2} />
        <text x={20} y={4} fontSize={8} fill="#818cf8">θ_eff (ability decay)</text>
        <line x1={0} y1={14} x2={16} y2={14} stroke="#34d399" strokeWidth={2} />
        <text x={20} y={18} fontSize={8} fill="#34d399">P(correct)</text>
      </g>
    </svg>
  );
};

/** Shows IRT mastery progression: theta/sigma/gate through items */
const MasteryProgressionChart: React.FC<{
  events: MasteryProgressionEvent[];
  width?: number;
  height?: number;
}> = ({ events, width = 600, height = 220 }) => {
  if (events.length === 0) return null;

  const pad = { top: 25, right: 40, bottom: 35, left: 50 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  const xScale = (i: number) => pad.left + (i / Math.max(1, events.length - 1)) * w;
  const yMin = 0;
  const yMax = 10;
  const yScale = (v: number) => pad.top + h - ((v - yMin) / (yMax - yMin)) * h;

  // Theta line
  const thetaPoints = events.map((e, i) => `${xScale(i)},${yScale(e.thetaAfter)}`);
  const thetaPath = `M${thetaPoints.join(' L')}`;

  // Sigma band
  const bandUp = events.map((e, i) => `${xScale(i)},${yScale(Math.min(yMax, e.thetaAfter + e.sigmaAfter))}`);
  const bandDown = events.map((e, i) => `${xScale(i)},${yScale(Math.max(yMin, e.thetaAfter - e.sigmaAfter))}`).reverse();
  const bandPath = `M${bandUp.join(' L')} L${bandDown.join(' L')} Z`;

  // Gate color helper
  const gateColor = (gate: number): string => {
    const gd = GATE_DEFINITIONS.find((g) => g.gate === gate);
    return gd ? gd.strokeColor : '#64748b';
  };

  // Find gate transition points
  const transitions: { idx: number; gate: number; gateName: string }[] = [];
  let prevGate = 0;
  for (let i = 0; i < events.length; i++) {
    if (events[i].gate !== prevGate) {
      transitions.push({ idx: i, gate: events[i].gate, gateName: events[i].gateName });
      prevGate = events[i].gate;
    }
  }

  const yTicks = [0, 2, 4, 6, 8, 10];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
      {/* Y grid */}
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={pad.left} y1={yScale(v)} x2={width - pad.right} y2={yScale(v)}
            stroke="rgba(148,163,184,0.15)" strokeDasharray="4,4" />
          <text x={pad.left - 8} y={yScale(v) + 4} textAnchor="end" className="fill-slate-500" fontSize={10}>
            {v}
          </text>
        </g>
      ))}

      {/* Sigma band */}
      <path d={bandPath} fill="rgba(99,102,241,0.12)" />

      {/* Theta line */}
      <path d={thetaPath} fill="none" stroke="#818cf8" strokeWidth={2} />

      {/* Gate transition labels */}
      {transitions.map((t) => (
        <g key={`gate-${t.idx}`}>
          <line x1={xScale(t.idx)} y1={pad.top} x2={xScale(t.idx)} y2={pad.top + h}
            stroke={gateColor(t.gate)} strokeWidth={1} strokeDasharray="3,3" opacity={0.5} />
          <text x={xScale(t.idx)} y={pad.top - 5} textAnchor="middle" fontSize={8}
            fill={gateColor(t.gate)} fontWeight="bold">
            G{t.gate}
          </text>
        </g>
      ))}

      {/* Dots color-coded by gate */}
      {events.map((e, i) => (
        <g key={i}>
          <circle
            cx={xScale(i)} cy={yScale(e.thetaAfter)} r={4}
            fill={gateColor(e.gate)} stroke="rgba(0,0,0,0.3)" strokeWidth={1}
          />
          {/* Error bars (sigma) */}
          <line
            x1={xScale(i)} y1={yScale(Math.min(yMax, e.thetaAfter + e.sigmaAfter))}
            x2={xScale(i)} y2={yScale(Math.max(yMin, e.thetaAfter - e.sigmaAfter))}
            stroke={gateColor(e.gate)} strokeWidth={1} opacity={0.3}
          />
        </g>
      ))}

      {/* X axis labels */}
      {events.map((_, i) => (
        i % Math.max(1, Math.floor(events.length / 10)) === 0 && (
          <text key={`x-${i}`} x={xScale(i)} y={height - 6} textAnchor="middle" fontSize={9} className="fill-slate-500">
            {i + 1}
          </text>
        )
      ))}

      {/* Axis labels */}
      <text x={12} y={pad.top + h / 2} textAnchor="middle" fontSize={9} fill="#818cf8"
        transform={`rotate(-90, 12, ${pad.top + h / 2})`}>theta</text>
      <text x={pad.left + w / 2} y={height - 18} textAnchor="middle" fontSize={9} className="fill-slate-600">
        Item number
      </text>

      {/* Legend */}
      <g transform={`translate(${pad.left + 10}, ${pad.top + 5})`}>
        <line x1={0} y1={0} x2={16} y2={0} stroke="#818cf8" strokeWidth={2} />
        <text x={20} y={4} fontSize={8} fill="#818cf8">theta (ability)</text>
        <rect x={0} y={10} width={16} height={6} fill="rgba(99,102,241,0.12)" />
        <text x={20} y={17} fontSize={8} className="fill-slate-500">+/- sigma</text>
      </g>
    </svg>
  );
};

// ============================================================================
// Retention Presets
// ============================================================================

interface RetentionPreset {
  label: string;
  desc: string;
  primitiveKey: string;
  scores: number[];
  thetaTested: number;
  itemBeta: number;
  itemA: number;
}

const RETENTION_PRESETS: RetentionPreset[] = [
  {
    label: 'Gifted: Quick Mastery',
    desc: 'Strong student aces 6 items — theta rises fast, sigma drops, gates 1->2->3->4.',
    primitiveKey: 'ten-frame', thetaTested: 7.7, itemBeta: 5.0, itemA: 1.6,
    scores: [10, 10, 10, 10, 10, 10],
  },
  {
    label: 'Steady Learner',
    desc: 'Average student with mixed scores — theta rises slowly, sigma drops gradually, reaches gate 2.',
    primitiveKey: 'ten-frame', thetaTested: 4.0, itemBeta: 3.5, itemA: 1.4,
    scores: [6.5, 7.2, 8.0, 9.5, 9.0, 9.2, 9.5, 9.5],
  },
  {
    label: 'Struggle then Recovery',
    desc: 'Student fails early items, then improves — theta dips then recovers, sigma stays high initially.',
    primitiveKey: 'ten-frame', thetaTested: 5.0, itemBeta: 4.0, itemA: 1.4,
    scores: [3.0, 4.0, 5.0, 7.5, 8.5, 9.5, 9.5, 9.5, 9.5, 9.5],
  },
  {
    label: 'Repeated Failure',
    desc: 'Student keeps failing — theta drops, sigma stays wide, stuck at gate 0.',
    primitiveKey: 'ten-frame', thetaTested: 4.5, itemBeta: 5.0, itemA: 1.6,
    scores: [4.0, 3.0, 5.0, 4.5, 3.0, 5.0, 4.0, 3.5],
  },
  {
    label: 'MC Expert Track',
    desc: 'Knowledge check MC from recall->evaluate — tests tiered MC convergence.',
    primitiveKey: 'knowledge-check', thetaTested: 5.0, itemBeta: 3.0, itemA: 1.4,
    scores: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
  },
];

// ============================================================================
// Presets
// ============================================================================

interface Preset {
  label: string;
  desc: string;
  primitiveKey: string;
  steps: { modeIdx: number; score: number }[];
}

const PRESETS: Preset[] = [
  {
    label: 'Ten Frame: Full Mastery',
    desc: 'Escalate through all 4 modes with high discrimination. Watch sigma collapse and gates unlock.',
    primitiveKey: 'ten-frame',
    steps: [
      ...Array.from({ length: 3 }, () => ({ modeIdx: 0, score: 10 })),
      ...Array.from({ length: 3 }, () => ({ modeIdx: 1, score: 10 })),
      ...Array.from({ length: 3 }, () => ({ modeIdx: 2, score: 10 })),
      ...Array.from({ length: 5 }, () => ({ modeIdx: 3, score: 10 })),
    ],
  },
  {
    label: 'P(correct) Plateau Fix (Phase 6)',
    desc: '12× correct on jump mode (b=3.5, a=1.2). Streak acceleration + calibrated gate betas push through Gate 4 without wasting student time.',
    primitiveKey: 'number-line',
    steps: Array.from({ length: 12 }, () => ({ modeIdx: 3, score: 10 })),
  },
  {
    label: 'Mastery Sprint (10× Hardest)',
    desc: 'Student aces the hardest ten-frame mode 10×. Streak acceleration kicks in at item 5 — watch τ amplify and gates unlock rapidly.',
    primitiveKey: 'ten-frame',
    steps: Array.from({ length: 10 }, () => ({ modeIdx: 3, score: 10 })),
  },
  {
    label: 'Ten Frame: Grind Easy (stalls)',
    desc: 'Only Build mode (B=1.5). σ collapses but θ caps at ~1.5 — never reaches Gate 2+.',
    primitiveKey: 'ten-frame',
    steps: Array.from({ length: 15 }, () => ({ modeIdx: 0, score: 10 })),
  },
  {
    label: 'Knowledge Check: Escalate MC Tiers',
    desc: 'Recall → Apply → Analyze → Evaluate. Higher tiers have better discrimination and lower guessing floors — watch σ converge faster on harder items.',
    primitiveKey: 'knowledge-check',
    steps: [
      ...Array.from({ length: 3 }, () => ({ modeIdx: 0, score: 10 })),
      ...Array.from({ length: 3 }, () => ({ modeIdx: 1, score: 10 })),
      ...Array.from({ length: 3 }, () => ({ modeIdx: 2, score: 10 })),
      ...Array.from({ length: 3 }, () => ({ modeIdx: 3, score: 10 })),
    ],
  },
  {
    label: 'True/False: High Noise',
    desc: 'c=0.5 guessing floor + low discrimination (a=1.0). Very noisy — σ stays high.',
    primitiveKey: 'true-false',
    steps: [
      { modeIdx: 0, score: 10 }, { modeIdx: 0, score: 10 },
      { modeIdx: 0, score: 3 }, { modeIdx: 0, score: 10 },
      { modeIdx: 0, score: 10 }, { modeIdx: 0, score: 3 },
      { modeIdx: 0, score: 10 }, { modeIdx: 0, score: 10 },
    ],
  },
  {
    label: 'Function Machine: Struggle + Recovery',
    desc: 'Overreach at Create (low a=1.0), fail, drop back, then climb. Low-a failures hurt θ less.',
    primitiveKey: 'function-machine',
    steps: [
      ...Array.from({ length: 3 }, () => ({ modeIdx: 0, score: 10 })),
      { modeIdx: 3, score: 3 }, { modeIdx: 3, score: 4 },
      ...Array.from({ length: 3 }, () => ({ modeIdx: 1, score: 10 })),
      ...Array.from({ length: 3 }, () => ({ modeIdx: 2, score: 10 })),
      ...Array.from({ length: 5 }, () => ({ modeIdx: 3, score: 10 })),
    ],
  },
  {
    label: 'Shape Sorter: Discrimination Contrast',
    desc: 'Identify (a=1.6) vs Sort (a=1.4) — higher-a items move θ faster per observation.',
    primitiveKey: 'shape-sorter',
    steps: [
      ...Array.from({ length: 4 }, () => ({ modeIdx: 0, score: 10 })),
      ...Array.from({ length: 4 }, () => ({ modeIdx: 2, score: 10 })),
      ...Array.from({ length: 4 }, () => ({ modeIdx: 3, score: 10 })),
    ],
  },
];

// ============================================================================
// Main Component
// ============================================================================

interface CalibrationSimulatorProps {
  onBack: () => void;
}

function makeInitialAbility(startTheta: number): AbilityState {
  return { theta: startTheta, sigma: DEFAULT_SIGMA, totalItemsSeen: 0 };
}

const CalibrationSimulator: React.FC<CalibrationSimulatorProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'irt' | 'retention'>('irt');

  // ── IRT tab state ──
  const [selectedPrimitive, setSelectedPrimitive] = useState('ten-frame');
  const [selectedModeIdx, setSelectedModeIdx] = useState(0);
  const [score, setScore] = useState(10);

  // ── Retention tab state ──
  const [retPrimitiveKey, setRetPrimitiveKey] = useState('ten-frame');
  const [retScores, setRetScores] = useState<number[]>([9.5, 9.5, 9.5, 9.5, 9.5, 9.5]);
  const [retNewScore, setRetNewScore] = useState(9.5);
  const [retParams, setRetParams] = useState<RetentionParams>(DEFAULT_RETENTION_PARAMS);
  const [retThetaTested, setRetThetaTested] = useState(7.7);
  const [retItemBeta, setRetItemBeta] = useState(5.0);
  const [retItemA, setRetItemA] = useState(1.6);
  const [retItemC] = useState(0);

  const retBetaRange = useMemo(() => getPrimitiveBetaRange(retPrimitiveKey), [retPrimitiveKey]);
  const retAvgA = useMemo(() => {
    const prim = PRIMITIVE_REGISTRY[retPrimitiveKey];
    return prim ? prim.modes.reduce((s, m) => s + m.a, 0) / prim.modes.length : 1.4;
  }, [retPrimitiveKey]);

  const masteryEvents = useMemo(
    () => simulateMasteryProgression(retScores, retBetaRange.min, retBetaRange.max, retAvgA, retPrimitiveKey),
    [retScores, retBetaRange, retAvgA, retPrimitiveKey],
  );

  // Effective theta at various time points for the info table
  const retentionSnapshots = useMemo(() => {
    const days = [0, 1, 3, 5, 7, 10, 14, 21, 30];
    return days.map((d) => {
      const effT = effectiveTheta(retThetaTested, d, retParams.initialStability, retParams.decayRate);
      const p = pCorrect(effT, retItemA, retItemBeta, retItemC);
      const info = itemInformation(effT, retItemA, retItemBeta, retItemC);
      return { day: d, effTheta: effT, p, info };
    });
  }, [retThetaTested, retItemA, retItemBeta, retItemC, retParams.initialStability, retParams.decayRate]);

  const { min: minBeta, max: maxBeta } = useMemo(
    () => getPrimitiveBetaRange(selectedPrimitive),
    [selectedPrimitive],
  );
  const [ability, setAbility] = useState<AbilityState>(() =>
    makeInitialAbility(getPrimitiveBetaRange('ten-frame').min),
  );
  const [history, setHistory] = useState<SubmissionRecord[]>([]);
  const [itemCalibrations, setItemCalibrations] = useState<Record<string, ItemCalibrationState>>(
    () => makeInitialCalibrations('ten-frame'),
  );

  const currentPrimitive = PRIMITIVE_REGISTRY[selectedPrimitive];
  const currentMode = currentPrimitive.modes[selectedModeIdx];
  const currentStudentMode = thetaToMode(ability.theta);
  const currentCal = itemCalibrations[currentMode.evalMode];

  // Use calibrated parameters for display
  const effectiveA = currentCal?.currentA ?? currentMode.a;
  const effectiveBeta = currentCal?.calibratedBeta ?? currentMode.priorBeta;
  const effectiveC = currentCal?.c ?? currentMode.c;

  const currentPCorrect = useMemo(
    () => pCorrect(ability.theta, effectiveA, effectiveBeta, effectiveC),
    [ability.theta, effectiveA, effectiveBeta, effectiveC],
  );
  const currentInformation = useMemo(
    () => itemInformation(ability.theta, effectiveA, effectiveBeta, effectiveC),
    [ability.theta, effectiveA, effectiveBeta, effectiveC],
  );

  // Gate status uses calibrated avg a AND calibrated beta range.
  // As items get answered correctly, their calibrated β drifts down,
  // making gate reference difficulties more achievable.
  const calibratedAvgA = useMemo(() => {
    const prim = PRIMITIVE_REGISTRY[selectedPrimitive];
    const total = prim.modes.reduce((sum, m) => {
      const cal = itemCalibrations[m.evalMode];
      return sum + (cal?.currentA ?? m.a);
    }, 0);
    return total / prim.modes.length;
  }, [selectedPrimitive, itemCalibrations]);

  const calibratedBetaRange = useMemo(() => {
    const prim = PRIMITIVE_REGISTRY[selectedPrimitive];
    const betas = prim.modes.map((m) => {
      const cal = itemCalibrations[m.evalMode];
      return cal?.calibratedBeta ?? m.priorBeta;
    });
    return { min: Math.min(...betas), max: Math.max(...betas) };
  }, [selectedPrimitive, itemCalibrations]);

  const gateStatus = useMemo(() => {
    const gateMinBeta = calibratedBetaRange.min;
    const gateMaxBeta = calibratedBetaRange.max;
    return GATE_DEFINITIONS.map((g) => {
      const refBeta = getGateRefBeta(g, gateMinBeta, gateMaxBeta);
      const p = pCorrect(ability.theta, calibratedAvgA, refBeta);
      const passed = isGatePassed(ability.theta, ability.sigma, g, gateMinBeta, gateMaxBeta, calibratedAvgA);
      const sigmaOk = ability.sigma <= g.sigmaMax;
      const pOk = p >= g.pThreshold;
      return { ...g, refBeta, currentP: p, passed, sigmaOk, pOk };
    });
  }, [ability.theta, ability.sigma, calibratedBetaRange, calibratedAvgA]);

  const maxGateReached = useMemo(() => {
    let gate = 0;
    for (const g of gateStatus) {
      if (g.passed) gate = g.gate;
    }
    return gate;
  }, [gateStatus]);

  const bestMeasurementMode = useMemo(() => {
    let best = currentPrimitive.modes[0];
    let bestInfo = 0;
    for (const mode of currentPrimitive.modes) {
      const cal = itemCalibrations[mode.evalMode];
      const useA = cal?.currentA ?? mode.a;
      const useB = cal?.calibratedBeta ?? mode.priorBeta;
      const useC = cal?.c ?? mode.c;
      const info = itemInformation(ability.theta, useA, useB, useC);
      if (info > bestInfo) {
        bestInfo = info;
        best = mode;
      }
    }
    return { mode: best, info: bestInfo };
  }, [ability.theta, currentPrimitive.modes, itemCalibrations]);

  // Count mismatch detections
  const mismatchCount = useMemo(
    () => history.filter((r) => r.mismatchDetected).length,
    [history],
  );

  const handleSubmit = useCallback(
    (overrideScore?: number, overrideMode?: EvalModeConfig) => {
      const s = overrideScore ?? score;
      const mode = overrideMode ?? currentMode;
      const isCorrect = s >= IRT_CORRECT_THRESHOLD;

      // Compute everything synchronously from current state — no side effects
      // inside state updaters (React strict mode calls updaters twice).
      const cal = itemCalibrations[mode.evalMode];
      const useA = cal?.currentA ?? mode.a;
      const useBeta = cal?.calibratedBeta ?? mode.priorBeta;
      const useC = cal?.c ?? mode.c;

      const pBefore = pCorrect(ability.theta, useA, useBeta, useC);
      const info = itemInformation(ability.theta, useA, useBeta, useC);

      const { ability: updated, mismatchDetected, streak, effectiveTau } = updateTheta(
        ability, useBeta, useA, useC, isCorrect, history,
      );

      const updatedCal = updateItemCalibration(
        cal ?? makeItemCalibration(mode), ability.theta, isCorrect,
      );

      const record: SubmissionRecord = {
        index: ability.totalItemsSeen,
        score: s,
        isCorrect,
        itemBeta: useBeta,
        itemPriorBeta: mode.priorBeta,
        itemA: useA,
        itemPriorA: mode.a,
        itemC: useC,
        mode: thetaToMode(ability.theta),
        thetaBefore: ability.theta,
        thetaAfter: updated.theta,
        sigmaBefore: ability.sigma,
        sigmaAfter: updated.sigma,
        pCorrectBefore: pBefore,
        information: info,
        mismatchDetected,
        streak,
        effectiveTau,
        aCredibility: updatedCal.aCredibility,
        betaCredibility: updatedCal.credibilityZ,
      };

      // Set all three states atomically — no nested state setters
      setAbility(updated);
      setItemCalibrations((cals) => ({ ...cals, [mode.evalMode]: updatedCal }));
      setHistory((h) => [...h, record]);
    },
    [score, currentMode, ability, history, itemCalibrations],
  );

  const handleReset = useCallback(() => {
    const { min } = getPrimitiveBetaRange(selectedPrimitive);
    setAbility(makeInitialAbility(min));
    setHistory([]);
    setItemCalibrations(makeInitialCalibrations(selectedPrimitive));
  }, [selectedPrimitive]);

  const handlePreset = useCallback(
    (preset: Preset) => {
      setSelectedPrimitive(preset.primitiveKey);
      setSelectedModeIdx(0);

      const { min: presetMinBeta } = getPrimitiveBetaRange(preset.primitiveKey);
      let state: AbilityState = makeInitialAbility(presetMinBeta);
      const records: SubmissionRecord[] = [];
      const prim = PRIMITIVE_REGISTRY[preset.primitiveKey];
      let cals = makeInitialCalibrations(preset.primitiveKey);

      for (const step of preset.steps) {
        const mode = prim.modes[step.modeIdx];
        const isCorrect = step.score >= IRT_CORRECT_THRESHOLD;
        const cal = cals[mode.evalMode];
        const useA = cal.currentA;
        const useBeta = cal.calibratedBeta;
        const useC = cal.c;

        const pBefore = pCorrect(state.theta, useA, useBeta, useC);
        const info = itemInformation(state.theta, useA, useBeta, useC);

        const { ability: updated, mismatchDetected, streak, effectiveTau } = updateTheta(
          state, useBeta, useA, useC, isCorrect, records,
        );

        // Update item calibration
        const updatedCal = updateItemCalibration(cal, state.theta, isCorrect);
        cals = { ...cals, [mode.evalMode]: updatedCal };

        records.push({
          index: state.totalItemsSeen,
          score: step.score,
          isCorrect,
          itemBeta: useBeta,
          itemPriorBeta: mode.priorBeta,
          itemA: useA,
          itemPriorA: mode.a,
          itemC: useC,
          mode: thetaToMode(state.theta),
          thetaBefore: state.theta,
          thetaAfter: updated.theta,
          sigmaBefore: state.sigma,
          sigmaAfter: updated.sigma,
          pCorrectBefore: pBefore,
          information: info,
          mismatchDetected,
          streak,
          effectiveTau,
          aCredibility: updatedCal.aCredibility,
          betaCredibility: updatedCal.credibilityZ,
        });

        state = updated;
      }

      setAbility(state);
      setHistory(records);
      setItemCalibrations(cals);
    },
    [],
  );

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
              Calibration Simulator
            </h1>
            {/* Tabs */}
            <div className="flex gap-1 ml-4">
              <button
                onClick={() => setActiveTab('irt')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'irt'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Zap className="w-3.5 h-3.5 inline mr-1.5" />
                IRT / 2PL-3PL
              </button>
              <button
                onClick={() => setActiveTab('retention')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'retention'
                    ? 'bg-violet-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Clock className="w-3.5 h-3.5 inline mr-1.5" />
                Retention Model
              </button>
            </div>
          </div>
          {activeTab === 'irt' && (
            <Button
              variant="ghost"
              className="bg-white/5 border border-white/20 hover:bg-white/10"
              onClick={handleReset}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* RETENTION MODEL TAB */}
      {/* ============================================================ */}
      {activeTab === 'retention' && (
        <div className="max-w-[1920px] mx-auto p-6 grid grid-cols-12 gap-6">
          {/* Left — Controls */}
          <div className="col-span-3 space-y-4">
            {/* Student & Item Parameters */}
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
                Student &amp; Item
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">theta tested</span>
                    <span className="font-mono text-indigo-400">{retThetaTested.toFixed(1)}</span>
                  </div>
                  <input type="range" min={1} max={10} step={0.1} value={retThetaTested}
                    onChange={(e) => setRetThetaTested(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">Item beta (difficulty)</span>
                    <span className="font-mono text-amber-400">{retItemBeta.toFixed(1)}</span>
                  </div>
                  <input type="range" min={0.5} max={9} step={0.5} value={retItemBeta}
                    onChange={(e) => setRetItemBeta(parseFloat(e.target.value))}
                    className="w-full accent-amber-500" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">Item a (discrimination)</span>
                    <span className="font-mono text-cyan-400">{retItemA.toFixed(1)}</span>
                  </div>
                  <input type="range" min={0.5} max={3} step={0.1} value={retItemA}
                    onChange={(e) => setRetItemA(parseFloat(e.target.value))}
                    className="w-full accent-cyan-500" />
                </div>
                <div className="p-2 rounded-lg bg-slate-800/50 border border-white/5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">P(correct) at t=0:</span>
                    <span className="font-mono text-green-400 font-bold">
                      {(pCorrect(retThetaTested, retItemA, retItemBeta, retItemC) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-slate-500">Information at t=0:</span>
                    <span className="font-mono text-cyan-400">
                      {itemInformation(retThetaTested, retItemA, retItemBeta, retItemC).toFixed(3)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Primitive Selector for Mastery Progression */}
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
                Mastery Primitive
              </h3>
              <div className="relative">
                <select
                  value={retPrimitiveKey}
                  onChange={(e) => setRetPrimitiveKey(e.target.value)}
                  className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 appearance-none"
                >
                  {Object.entries(PRIMITIVE_REGISTRY).map(([key, config]) => {
                    const { min, max } = getPrimitiveBetaRange(key);
                    return (
                      <option key={key} value={key}>
                        {config.label} (b={min}-{max})
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              <div className="mt-2 text-xs text-slate-500">
                beta range: {retBetaRange.min}-{retBetaRange.max}, avg a: {retAvgA.toFixed(2)}
              </div>
            </Card>

            {/* Retention Parameters */}
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
                Retention Parameters
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">Decay rate (d)</span>
                    <span className="font-mono text-rose-400">{retParams.decayRate.toFixed(1)}</span>
                  </div>
                  <input type="range" min={0.5} max={3} step={0.1} value={retParams.decayRate}
                    onChange={(e) => setRetParams((p) => ({ ...p, decayRate: parseFloat(e.target.value) }))}
                    className="w-full accent-rose-500" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">Target retention P</span>
                    <span className="font-mono text-amber-400">{(retParams.targetRetention * 100).toFixed(0)}%</span>
                  </div>
                  <input type="range" min={0.7} max={0.95} step={0.05} value={retParams.targetRetention}
                    onChange={(e) => setRetParams((p) => ({ ...p, targetRetention: parseFloat(e.target.value) }))}
                    className="w-full accent-amber-500" />
                </div>
              </div>
            </Card>

            {/* Presets */}
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
                Preset Scenarios
              </h3>
              <div className="space-y-2">
                {RETENTION_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setRetThetaTested(preset.thetaTested);
                      setRetItemBeta(preset.itemBeta);
                      setRetItemA(preset.itemA);
                      setRetPrimitiveKey(preset.primitiveKey);
                      setRetScores(preset.scores);
                      setRetParams(DEFAULT_RETENTION_PARAMS);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:text-white transition-all text-sm"
                  >
                    <div className="font-medium">{preset.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{preset.desc}</div>
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* Center — Charts */}
          <div className="col-span-6 space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-3">
              {(() => {
                const lastEvent = masteryEvents.length > 0 ? masteryEvents[masteryEvents.length - 1] : null;
                const masteredEvent = masteryEvents.find((ev) => ev.state === 'mastered');
                const currentGate = lastEvent ? lastEvent.gate : 0;
                const currentGateDef = GATE_DEFINITIONS.find((g) => g.gate === currentGate);
                const stats = [
                  {
                    label: 'theta tested',
                    value: retThetaTested.toFixed(1),
                    sub: `beta=${retItemBeta}, a=${retItemA}`,
                    color: 'text-indigo-400',
                  },
                  {
                    label: 'Current Gate',
                    value: `G${currentGate}`,
                    sub: currentGateDef ? currentGateDef.label : 'Not Started',
                    color: currentGate >= 4 ? 'text-purple-400' : currentGate >= 2 ? 'text-blue-400' : currentGate >= 1 ? 'text-emerald-400' : 'text-slate-400',
                  },
                  {
                    label: 'Items to Mastery',
                    value: masteredEvent ? `${masteredEvent.itemNum + 1}` : `${retScores.length}+`,
                    sub: masteredEvent ? 'mastered' : 'not yet mastered',
                    color: masteredEvent ? 'text-green-400' : 'text-amber-400',
                  },
                  {
                    label: 'Final sigma',
                    value: lastEvent ? lastEvent.sigmaAfter.toFixed(3) : '-',
                    sub: lastEvent ? `theta=${lastEvent.thetaAfter.toFixed(2)}` : 'no data',
                    color: lastEvent && lastEvent.sigmaAfter <= 1.0 ? 'text-green-400' : 'text-slate-400',
                  },
                ];
                return stats.map((stat) => (
                  <Card key={stat.label} className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4 text-center">
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{stat.label}</div>
                    <div className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
                    <div className="text-xs text-slate-500 mt-1">{stat.sub}</div>
                  </Card>
                ));
              })()}
            </div>

            {/* Decay Chart */}
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                  Memory Decay — theta_eff &amp; P(correct) over time
                </h3>
                <span className="text-xs text-slate-500">
                  theta_eff = theta - d * sqrt(t/S)
                </span>
              </div>
              <RetentionDecayChart
                thetaTested={retThetaTested}
                stability={retParams.initialStability}
                itemA={retItemA}
                itemBeta={retItemBeta}
                itemC={retItemC}
                decayRate={retParams.decayRate}
                targetRetention={retParams.targetRetention}
              />
            </Card>

            {/* Day-by-Day Table */}
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
                Decay Snapshots (S = {retParams.initialStability.toFixed(1)} days)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-slate-500 py-1.5 px-2">Day</th>
                      <th className="text-right text-slate-500 py-1.5 px-2">theta_eff</th>
                      <th className="text-right text-slate-500 py-1.5 px-2">P(correct)</th>
                      <th className="text-right text-slate-500 py-1.5 px-2">Information</th>
                      <th className="text-left text-slate-500 py-1.5 px-2">Engine Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retentionSnapshots.map((snap) => {
                      let action = '';
                      let actionColor = 'text-slate-600';
                      if (snap.p >= 0.95) { action = 'Skip -- trivial'; actionColor = 'text-slate-600'; }
                      else if (snap.p >= retParams.targetRetention) { action = 'Skip -- above target'; actionColor = 'text-slate-500'; }
                      else if (snap.p >= 0.7) { action = 'Review candidate'; actionColor = 'text-amber-400'; }
                      else if (snap.p >= 0.5) { action = 'High-priority review'; actionColor = 'text-orange-400'; }
                      else { action = 'Urgent review'; actionColor = 'text-red-400'; }
                      return (
                        <tr key={snap.day} className="border-b border-white/5">
                          <td className="py-1.5 px-2 font-mono text-slate-300">{snap.day}</td>
                          <td className="py-1.5 px-2 text-right font-mono text-indigo-400">{snap.effTheta.toFixed(2)}</td>
                          <td className={`py-1.5 px-2 text-right font-mono font-bold ${
                            snap.p >= retParams.targetRetention ? 'text-green-400' : snap.p >= 0.5 ? 'text-amber-400' : 'text-red-400'
                          }`}>{(snap.p * 100).toFixed(1)}%</td>
                          <td className="py-1.5 px-2 text-right font-mono text-cyan-400">{snap.info.toFixed(3)}</td>
                          <td className={`py-1.5 px-2 ${actionColor}`}>{action}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Mastery Progression Chart */}
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                  Mastery Progression — theta/sigma/Gate per Item
                </h3>
                <span className="text-xs text-slate-500">
                  {PRIMITIVE_REGISTRY[retPrimitiveKey]?.label ?? retPrimitiveKey}
                </span>
              </div>
              {masteryEvents.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
                  Add scores to see mastery progression
                </div>
              ) : (
                <MasteryProgressionChart events={masteryEvents} />
              )}
            </Card>

            {/* Mastery Progression Table */}
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
                Item-by-Item Mastery Progression
              </h3>
              {masteryEvents.length === 0 ? (
                <div className="text-center py-4 text-slate-600 text-sm">No mastery events yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left text-slate-500 py-1.5 px-2">#</th>
                        <th className="text-right text-slate-500 py-1.5 px-2">Score</th>
                        <th className="text-right text-slate-500 py-1.5 px-2">theta</th>
                        <th className="text-right text-slate-500 py-1.5 px-2">sigma</th>
                        <th className="text-right text-slate-500 py-1.5 px-2">P(gate)</th>
                        <th className="text-left text-slate-500 py-1.5 px-2">Gate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {masteryEvents.map((ev) => {
                        const gateDef = GATE_DEFINITIONS.find((g) => g.gate === ev.gate);
                        return (
                          <tr key={ev.itemNum} className="border-b border-white/5">
                            <td className="py-1.5 px-2 font-mono text-slate-400">{ev.itemNum + 1}</td>
                            <td className={`py-1.5 px-2 text-right font-mono font-bold ${
                              ev.isCorrect ? 'text-green-400' : 'text-red-400'
                            }`}>{ev.score.toFixed(1)}</td>
                            <td className="py-1.5 px-2 text-right font-mono text-indigo-400">
                              {ev.thetaBefore.toFixed(2)} &rarr; {ev.thetaAfter.toFixed(2)}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-slate-400">
                              {ev.sigmaBefore.toFixed(3)} &rarr; {ev.sigmaAfter.toFixed(3)}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-green-400">
                              {(ev.pAtGateRef * 100).toFixed(0)}%
                            </td>
                            <td className="py-1.5 px-2">
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                style={{
                                  backgroundColor: gateDef ? `${gateDef.strokeColor}20` : 'rgba(100,116,139,0.2)',
                                  color: gateDef ? gateDef.strokeColor : '#94a3b8',
                                }}
                              >
                                G{ev.gate} {ev.gateName}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {/* Right — Score Builder + Insights */}
          <div className="col-span-3 space-y-4">
            {/* Score Builder */}
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
                Score Builder
              </h3>
              <div className="space-y-2">
                {retScores.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-6">#{i + 1}</span>
                    <input type="range" min={0} max={10} step={0.5} value={s}
                      onChange={(e) => {
                        const newScores = [...retScores];
                        newScores[i] = parseFloat(e.target.value);
                        setRetScores(newScores);
                      }}
                      className="flex-1 accent-indigo-500" />
                    <span className={`text-sm font-mono w-8 text-right font-bold ${
                      s >= 9.0 ? 'text-green-400' : s >= 7.0 ? 'text-amber-400' : 'text-red-400'
                    }`}>{s.toFixed(1)}</span>
                    <button
                      onClick={() => setRetScores((scores) => scores.filter((_: number, idx: number) => idx !== i))}
                      className="text-slate-600 hover:text-red-400 text-xs px-1"
                    >
                      x
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-2">
                  <input type="range" min={0} max={10} step={0.5} value={retNewScore}
                    onChange={(e) => setRetNewScore(parseFloat(e.target.value))}
                    className="flex-1 accent-violet-500" />
                  <span className="text-sm font-mono w-8 text-right text-slate-400">{retNewScore.toFixed(1)}</span>
                  <Button
                    variant="ghost"
                    className="bg-white/5 border border-white/20 hover:bg-white/10 text-xs px-2 py-1 h-auto"
                    onClick={() => setRetScores((scores) => [...scores, retNewScore])}
                  >
                    + Add
                  </Button>
                </div>
              </div>
            </Card>

            {/* Comparison: Old vs New */}
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
                Old vs New Model
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                  <div className="text-red-400 font-semibold mb-1">Old: Stability Multipliers</div>
                  <div className="text-slate-500">
                    Fixed multipliers (strong x2.5, partial x1.5, fail x0.5).
                    <br />Stability is a single number with no statistical grounding.
                    <br />Gates derived from arbitrary day thresholds.
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-green-500/5 border border-green-500/10">
                  <div className="text-green-400 font-semibold mb-1">New: IRT-Derived Gates</div>
                  <div className="text-slate-500">
                    Gates derived from P(correct) at reference difficulties.
                    <br />theta and sigma update via Bayesian EAP with 2PL/3PL likelihood.
                    <br />sigma (uncertainty) must be low enough to trust the estimate.
                    <br />No arbitrary multipliers -- the math determines readiness.
                  </div>
                </div>
              </div>
            </Card>

            {/* Insights */}
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-slate-400 space-y-2">
                  <p>
                    <span className="text-violet-300 font-semibold">IRT-derived gates:</span>{' '}
                    Each gate checks P(correct) at a reference difficulty within the primitive&apos;s beta range.
                    G1 checks the easiest mode, G4 checks the hardest. Both P threshold AND sigma ceiling must be met.
                  </p>
                  <p>
                    <span className="text-amber-300 font-semibold">Decay model:</span>{' '}
                    theta_eff = theta - d * sqrt(t/S). When P(correct) drops below{' '}
                    {(retParams.targetRetention * 100).toFixed(0)}%, the item becomes a review candidate.
                    No calendar gates needed.
                  </p>
                  <p>
                    <span className="text-green-300 font-semibold">Sigma convergence:</span>{' '}
                    Each correct answer on an informative item reduces sigma. High-discrimination items
                    (large a) reduce sigma faster. Once sigma is low, we trust the theta estimate.
                  </p>
                  <p>
                    <span className="text-cyan-300 font-semibold">Gate progression:</span>{' '}
                    G1 (Emerging, 70% at easiest) &rarr; G2 (Developing, 75% at mid) &rarr;
                    G3 (Proficient, 80% at hard) &rarr; G4 (Mastered, 90% at hardest).
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* IRT CALIBRATION TAB */}
      {/* ============================================================ */}
      {activeTab === 'irt' && (
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
                  const { min } = getPrimitiveBetaRange(newPrim);
                  setAbility(makeInitialAbility(min));
                  setHistory([]);
                  setItemCalibrations(makeInitialCalibrations(newPrim));
                }}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
              >
                {Object.entries(PRIMITIVE_REGISTRY).map(([key, config]) => {
                  const { min, max } = getPrimitiveBetaRange(key);
                  return (
                    <option key={key} value={key}>
                      {config.label} (b={min}–{max})
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-slate-500">b range</div>
                <div className="font-mono text-amber-400">{minBeta}–{maxBeta}</div>
              </div>
              <div className="text-center">
                <div className="text-slate-500">avg a</div>
                <div className="font-mono text-cyan-400">{calibratedAvgA.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <div className="text-slate-500">modes</div>
                <div className="font-mono text-slate-300">{currentPrimitive.modes.length}</div>
              </div>
            </div>
          </Card>

          {/* Eval Mode / Difficulty with calibrated params */}
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Eval Mode
            </h3>
            <div className="space-y-1.5">
              {currentPrimitive.modes.map((mode, idx) => {
                const cal = itemCalibrations[mode.evalMode];
                const useA = cal?.currentA ?? mode.a;
                const useB = cal?.calibratedBeta ?? mode.priorBeta;
                const useC = cal?.c ?? mode.c;
                const modeP = pCorrect(ability.theta, useA, useB, useC);
                const modeInfo = itemInformation(ability.theta, useA, useB, useC);
                const isBestMeasurement = mode.evalMode === bestMeasurementMode.mode.evalMode;
                const hasCalibrated = cal && cal.totalObservations > 0;
                return (
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
                      <span className="flex items-center gap-1.5">
                        {mode.label}
                        {isBestMeasurement && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300">
                            MAX INFO
                          </span>
                        )}
                        {hasCalibrated && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                            n={cal.totalObservations}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className={`flex justify-between text-[10px] mt-1 ${
                      selectedModeIdx === idx ? 'text-indigo-200' : 'text-slate-500'
                    }`}>
                      <span>
                        b={useB.toFixed(1)}
                        {hasCalibrated && useB !== mode.priorBeta && (
                          <span className="text-amber-400"> ({mode.priorBeta})</span>
                        )}
                        {' '}a={useA.toFixed(2)}
                        {hasCalibrated && Math.abs(useA - mode.a) > 0.01 && (
                          <span className="text-amber-400"> ({mode.a})</span>
                        )}
                        {mode.c > 0 ? ` c=${mode.c}` : ''}
                      </span>
                      <span>P={(modeP * 100).toFixed(0)}% I={modeInfo.toFixed(2)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Score Input */}
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Score (0-10)
            </h3>
            <div className="space-y-3">
              <input
                type="range" min={0} max={10} step={0.5} value={score}
                onChange={(e) => setScore(parseFloat(e.target.value))}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between items-center">
                <span className={`text-2xl font-bold font-mono ${
                  score >= IRT_CORRECT_THRESHOLD ? 'text-green-400' : 'text-red-400'
                }`}>
                  {score.toFixed(1)}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  score >= IRT_CORRECT_THRESHOLD
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {score >= IRT_CORRECT_THRESHOLD ? 'CORRECT' : 'INCORRECT'}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-slate-800/50 border border-white/5 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">P(correct) before submit:</span>
                  <span className={`font-mono font-bold ${
                    currentPCorrect >= 0.7 ? 'text-green-400' : currentPCorrect >= 0.4 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {(currentPCorrect * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Information value:</span>
                  <span className="font-mono text-cyan-400">{currentInformation.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Discrimination (a):</span>
                  <span className="font-mono text-slate-300">
                    {effectiveA.toFixed(2)}
                    {currentCal && Math.abs(effectiveA - currentMode.a) > 0.01 && (
                      <span className="text-amber-400 ml-1">(prior: {currentMode.a})</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Calibrated β:</span>
                  <span className="font-mono text-slate-300">
                    {effectiveBeta.toFixed(2)}
                    {currentCal && Math.abs(effectiveBeta - currentMode.priorBeta) > 0.01 && (
                      <span className="text-amber-400 ml-1">(prior: {currentMode.priorBeta})</span>
                    )}
                  </span>
                </div>
                {currentMode.c > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Guessing floor (c):</span>
                    <span className="font-mono text-amber-400">{(currentMode.c * 100).toFixed(0)}%</span>
                  </div>
                )}
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
                  className="w-full text-left px-3 py-2 rounded-lg bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:text-white transition-all text-sm"
                >
                  <div className="font-medium">{preset.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{preset.desc}</div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* ============================================================ */}
        {/* Center — Charts + Stats */}
        {/* ============================================================ */}
        <div className="col-span-6 space-y-4">
          {/* Current State Dashboard */}
          <div className="grid grid-cols-4 gap-3">
            {[
              {
                label: 'θ (ability)',
                value: ability.theta.toFixed(2),
                sub: `σ = ${ability.sigma.toFixed(3)}`,
                color: 'text-indigo-400',
              },
              {
                label: 'P(correct) current',
                value: `${(currentPCorrect * 100).toFixed(0)}%`,
                sub: `${currentMode.label}`,
                color: currentPCorrect >= 0.7 ? 'text-green-400' : currentPCorrect >= 0.4 ? 'text-amber-400' : 'text-red-400',
              },
              {
                label: 'Best Measurement',
                value: bestMeasurementMode.mode.evalMode,
                sub: `I=${bestMeasurementMode.info.toFixed(2)}`,
                color: 'text-cyan-400',
              },
              {
                label: 'Gate Reached',
                value: `Gate ${maxGateReached}`,
                sub: maxGateReached >= 4
                  ? '90%+ at hardest mode'
                  : `Next: G${maxGateReached + 1}`,
                color: maxGateReached >= 4
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
                <div className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-slate-500 mt-1">{stat.sub}</div>
              </Card>
            ))}
          </div>

          {/* Phase 6 Status Banner */}
          {(mismatchCount > 0 || Object.values(itemCalibrations).some((c) => c.totalObservations >= A_MIN_OBSERVATIONS)) && (
            <Card className="backdrop-blur-xl bg-amber-900/20 border-amber-500/20 p-3">
              <div className="flex items-start gap-2 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <div className="text-amber-300 font-semibold">Phase 6: Empirical Calibration Active</div>
                  <div className="flex flex-wrap gap-3 text-slate-400">
                    {mismatchCount > 0 && (
                      <span>
                        <span className="text-amber-400 font-mono">{mismatchCount}×</span> σ floor triggered (mismatch detection)
                      </span>
                    )}
                    {Object.entries(itemCalibrations)
                      .filter(([, c]) => c.totalObservations > 0)
                      .map(([mode, cal]) => (
                        <span key={mode}>
                          <span className="text-cyan-400">{mode}</span>: b={cal.calibratedBeta.toFixed(2)}
                          {Math.abs(cal.currentA - cal.priorA) > 0.01 && (
                            <span className="text-amber-400"> a={cal.currentA.toFixed(2)}</span>
                          )}
                          <span className="text-slate-600"> (n={cal.totalObservations})</span>
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* ICC Probability Curves */}
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Item Characteristic Curves — P(correct) vs θ
              </h3>
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-4 h-0.5 bg-indigo-500" /> θ
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-4 h-2 bg-indigo-500/10" /> ±σ
                </span>
              </div>
            </div>
            <ProbabilityCurve
              theta={ability.theta}
              sigma={ability.sigma}
              modes={currentPrimitive.modes}
              calibrations={itemCalibrations}
            />
          </Card>

          {/* Item Information Curves */}
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Item Information — I(θ) per mode
            </h3>
            <InformationChart
              theta={ability.theta}
              modes={currentPrimitive.modes}
              calibrations={itemCalibrations}
            />
          </Card>

          {/* Theta Trajectory */}
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
            <div className="flex items-center justify-between mb-2">
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
                {mismatchCount > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full border border-amber-400 border-dashed" /> σ floor
                  </span>
                )}
              </div>
            </div>
            {history.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-slate-600 text-sm">
                Submit results or run a preset to see the trajectory
              </div>
            ) : (
              <ThetaChart history={history} />
            )}
          </Card>

          {/* Probability-Based Gate Status */}
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Probability-Based Gates
              </h3>
              <div className="group relative">
                <Info className="w-3.5 h-3.5 text-slate-500 cursor-help" />
                <div className="hidden group-hover:block absolute left-0 top-5 z-10 w-72 p-3 rounded-lg bg-slate-800 border border-white/10 text-xs text-slate-300 shadow-xl">
                  Gates require BOTH conditions:
                  <br />1. P(correct) at the reference difficulty exceeds the threshold
                  <br />2. σ (uncertainty) is low enough that we trust the estimate
                  <br /><br />This means: &quot;we&apos;re statistically confident the student would pass at this level.&quot;
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {gateStatus.map((g) => (
                <div
                  key={g.gate}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    g.passed
                      ? 'bg-indigo-600/20 border-indigo-500/50 ring-1 ring-indigo-500/30'
                      : 'bg-slate-800/30 border-white/5'
                  }`}
                >
                  <div className={`text-lg font-bold font-mono ${g.passed ? 'text-white' : 'text-slate-600'}`}>
                    G{g.gate}
                  </div>
                  <div className={`text-[10px] mt-1 ${g.passed ? 'text-slate-300' : 'text-slate-600'}`}>
                    {g.label}
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className={`text-xs font-mono ${g.pOk ? 'text-green-400' : 'text-slate-600'}`}>
                      P={( g.currentP * 100).toFixed(0)}%
                      <span className="text-slate-600"> / {(g.pThreshold * 100).toFixed(0)}%</span>
                    </div>
                    <div className={`text-[10px] font-mono ${g.sigmaOk ? 'text-green-400' : 'text-amber-500'}`}>
                      σ={ability.sigma.toFixed(2)}
                      <span className="text-slate-600"> / {g.sigmaMax}</span>
                    </div>
                    <div className={`text-[10px] ${g.passed ? 'text-slate-400' : 'text-slate-600'}`}>
                      ref b={g.refBeta.toFixed(1)}
                    </div>
                  </div>
                  {g.passed && (
                    <div className="text-[10px] text-green-400 mt-1 font-semibold">PASSED</div>
                  )}
                  {!g.passed && g.pOk && !g.sigmaOk && (
                    <div className="text-[10px] text-amber-400 mt-1">need more data</div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-slate-500 flex items-start gap-2">
              <Target className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-400" />
              <span>
                Each gate tests P(correct) at a reference difficulty using avg discrimination a={calibratedAvgA.toFixed(2)}.
                G1 checks the easiest mode (b={calibratedBetaRange.min.toFixed(1)}), G4 checks the hardest (b={calibratedBetaRange.max.toFixed(1)}).
                {calibratedBetaRange.max < maxBeta && (
                  <span className="text-amber-400"> (prior: {minBeta}–{maxBeta}, calibrated: {calibratedBetaRange.min.toFixed(1)}–{calibratedBetaRange.max.toFixed(1)})</span>
                )}
                {' '}Both P threshold AND σ ceiling must be met — high probability is meaningless without confidence.
              </span>
            </div>
          </Card>

          {/* Mode Mapping Reference */}
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Mode Mapping (θ to difficulty)
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
                    <div className={`text-lg font-bold font-mono ${isActive ? info.color : 'text-slate-600'}`}>
                      {mode}
                    </div>
                    <div className={`text-[10px] mt-1 ${isActive ? 'text-slate-300' : 'text-slate-600'}`}>
                      {info.label}
                    </div>
                    <div className={`text-[10px] font-mono ${isActive ? 'text-slate-400' : 'text-slate-700'}`}>
                      b={info.beta}
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
                      <span className="font-mono text-slate-400 flex items-center gap-1">
                        #{r.index + 1}
                        {r.mismatchDetected && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300">
                            σ FLOOR
                          </span>
                        )}
                        {r.streak >= MASTERY_STREAK_THRESHOLD && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-green-500/20 text-green-300">
                            STREAK {r.streak}
                          </span>
                        )}
                        {r.effectiveTau > 0 && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-violet-500/20 text-violet-300">
                            τ={r.effectiveTau.toFixed(2)}
                          </span>
                        )}
                      </span>
                      <span className={`font-bold ${r.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                        {r.score.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>
                        b={r.itemBeta.toFixed(1)}
                        {Math.abs(r.itemBeta - r.itemPriorBeta) > 0.01 && (
                          <span className="text-amber-400"> ({r.itemPriorBeta})</span>
                        )}
                        {' '}a={r.itemA.toFixed(2)}
                        {Math.abs(r.itemA - r.itemPriorA) > 0.01 && (
                          <span className="text-amber-400"> ({r.itemPriorA})</span>
                        )}
                        {r.itemC > 0 ? ` c=${r.itemC}` : ''}
                      </span>
                      <span>Mode {r.mode}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-slate-500">P(pre): {(r.pCorrectBefore * 100).toFixed(0)}%</span>
                      <span className="text-cyan-400 font-mono">I={r.information.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">θ: {r.thetaBefore.toFixed(2)}</span>
                      <span className="text-indigo-400 font-mono">&rarr; {r.thetaAfter.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">σ: {r.sigmaBefore.toFixed(3)}</span>
                      <span className={`font-mono ${r.mismatchDetected ? 'text-amber-400' : 'text-slate-400'}`}>
                        &rarr; {r.sigmaAfter.toFixed(3)}
                      </span>
                    </div>
                    {(r.betaCredibility > 0 || r.aCredibility > 0) && (
                      <div className="flex justify-between mt-0.5 text-slate-600">
                        <span>β Z={r.betaCredibility.toFixed(2)}</span>
                        <span>a Z={r.aCredibility.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Key Insights */}
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
            <div className="flex items-start gap-2">
              <Target className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-slate-400 space-y-2">
                <p>
                  <span className="text-amber-300 font-semibold">Phase 6 — Empirical Calibration:</span>{' '}
                  Item parameters learn from observed data. β drifts from priors, `a` updates via
                  point-biserial correlation (n≥20). Gate checks now use calibrated betas — as β
                  drifts down, gate thresholds become more achievable.
                </p>
                <p>
                  <span className="text-green-300 font-semibold">Mastery Streak Acceleration:</span>{' '}
                  When a student gets {MASTERY_STREAK_THRESHOLD}+ consecutive correct, process noise τ is
                  amplified proportional to streak length and mismatch magnitude. This widens
                  the Bayesian prior so θ can jump faster — redundant evidence shouldn&apos;t force
                  students to keep proving what&apos;s already demonstrated. Look for green &quot;STREAK&quot;
                  and violet &quot;τ=&quot; badges in the log.
                </p>
                <p>
                  <span className="text-cyan-300 font-semibold">Stored-prediction mismatch:</span>{' '}
                  Mismatch detection now uses each item&apos;s actual P(correct) from submission time,
                  not a retrospective calculation. This prevents mismatch from &quot;disappearing&quot; as
                  θ rises — the original predictions capture the model&apos;s state when administered.
                </p>
                <p>
                  <span className="text-violet-300 font-semibold">Calibrated gate betas:</span>{' '}
                  Gate reference difficulties use calibrated (not prior) item betas. When a student
                  repeatedly aces an item mode, its β drifts down, and the gate threshold follows.
                  Watch the gate footer for prior vs calibrated β range.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
      )}
    </div>
  );
};

export default CalibrationSimulator;
