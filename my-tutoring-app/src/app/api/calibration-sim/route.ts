/**
 * Calibration Simulator API — runs IRT scenarios without backend.
 *
 * POST /api/calibration-sim
 * Body: { primitive: string, steps: [{ evalMode: string, score: number }] }
 * Returns: full trajectory, final state, gate status, item calibrations.
 *
 * This mirrors CalibrationSimulator.tsx and backend CalibrationEngine exactly.
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// Constants (match backend/app/models/calibration.py)
// ============================================================================

const IRT_CORRECT_THRESHOLD = 9.0;
const DEFAULT_SIGMA = 2.0;
const THETA_GRID_MIN = 0.0;
const THETA_GRID_MAX = 10.0;
const THETA_GRID_STEP = 0.1;
const ITEM_CREDIBILITY_STANDARD = 200;
const THETA_PROCESS_NOISE = 0.15;

// σ floor / mismatch detection
const MISMATCH_WINDOW = 10;
const MISMATCH_MIN_ITEMS = 5;
const MISMATCH_THRESHOLD = 0.15;
const MISMATCH_SIGMA_FLOOR = 0.5;

// Mastery acceleration
const MASTERY_STREAK_THRESHOLD = 5;
const TAU_CAP = 0.5;

// Empirical a calibration
const A_CREDIBILITY_K = 30;
const A_MIN_OBSERVATIONS = 20;
const A_MIN_P_OBS = 0.1;
const A_MAX_P_OBS = 0.9;
const A_CLAMP_MIN = 0.3;
const A_CLAMP_MAX = 3.0;

// Gate definitions
const GATE_DEFINITIONS = [
  { gate: 1, pThreshold: 0.70, sigmaMax: 1.5, refBetaFraction: 0.0, label: 'Emerging' },
  { gate: 2, pThreshold: 0.75, sigmaMax: 1.2, refBetaFraction: 0.5, label: 'Developing' },
  { gate: 3, pThreshold: 0.80, sigmaMax: 1.0, refBetaFraction: 0.8, label: 'Proficient' },
  { gate: 4, pThreshold: 0.90, sigmaMax: 0.8, refBetaFraction: 1.0, label: 'Mastered' },
];

// ============================================================================
// IRT math
// ============================================================================

function pCorrect(theta: number, a: number, b: number, c: number = 0): number {
  const logit = Math.max(-20, Math.min(20, a * (theta - b)));
  return c + (1 - c) / (1 + Math.exp(-logit));
}

function itemInformation(theta: number, a: number, b: number, c: number = 0): number {
  const p = pCorrect(theta, a, b, c);
  const q = 1 - p;
  if (p <= c || q <= 0) return 0;
  return (a ** 2) * ((p - c) ** 2) * q / (p * ((1 - c) ** 2));
}

// ============================================================================
// Primitive registry
// ============================================================================

interface ModeConfig {
  evalMode: string;
  label: string;
  priorBeta: number;
  a: number;
  c: number;
}

const PRIMITIVE_REGISTRY: Record<string, { label: string; modes: ModeConfig[] }> = {
  'ten-frame': {
    label: 'Ten Frame',
    modes: [
      { evalMode: 'build', label: 'Build', priorBeta: 1.5, a: 1.8, c: 0 },
      { evalMode: 'subitize', label: 'Subitize', priorBeta: 2.5, a: 1.6, c: 0 },
      { evalMode: 'make_ten', label: 'Make Ten', priorBeta: 3.5, a: 1.4, c: 0 },
      { evalMode: 'operate', label: 'Operate', priorBeta: 5.0, a: 1.6, c: 0 },
    ],
  },
  'number-line': {
    label: 'Number Line',
    modes: [
      { evalMode: 'explore', label: 'Explore', priorBeta: 1.5, a: 1.4, c: 0 },
      { evalMode: 'plot', label: 'Plot', priorBeta: 2.0, a: 1.6, c: 0 },
      { evalMode: 'compare', label: 'Compare', priorBeta: 3.0, a: 1.4, c: 0 },
      { evalMode: 'jump', label: 'Jump', priorBeta: 3.5, a: 1.2, c: 0 },
    ],
  },
  'counting-board': {
    label: 'Counting Board',
    modes: [
      { evalMode: 'count', label: 'Count', priorBeta: 1.0, a: 1.8, c: 0 },
      { evalMode: 'subitize', label: 'Quick-count', priorBeta: 2.0, a: 1.6, c: 0 },
      { evalMode: 'group', label: 'Group', priorBeta: 2.0, a: 1.4, c: 0 },
      { evalMode: 'compare', label: 'Compare', priorBeta: 2.5, a: 1.4, c: 0 },
      { evalMode: 'count_on', label: 'Count on', priorBeta: 2.5, a: 1.6, c: 0 },
    ],
  },
  'function-machine': {
    label: 'Function Machine',
    modes: [
      { evalMode: 'observe', label: 'Observe', priorBeta: 2.5, a: 1.2, c: 0 },
      { evalMode: 'predict', label: 'Predict', priorBeta: 3.0, a: 1.6, c: 0 },
      { evalMode: 'discover', label: 'Discover', priorBeta: 3.5, a: 1.4, c: 0 },
      { evalMode: 'create', label: 'Create', priorBeta: 4.5, a: 1.0, c: 0 },
    ],
  },
  'pattern-builder': {
    label: 'Pattern Builder',
    modes: [
      { evalMode: 'identify', label: 'Identify', priorBeta: 2.5, a: 1.4, c: 0 },
      { evalMode: 'extend', label: 'Extend', priorBeta: 3.0, a: 1.6, c: 0 },
      { evalMode: 'create', label: 'Create', priorBeta: 3.5, a: 1.2, c: 0 },
      { evalMode: 'translate', label: 'Translate', priorBeta: 4.0, a: 1.0, c: 0 },
    ],
  },
  'knowledge-check': {
    label: 'Knowledge Check (MC)',
    modes: [
      { evalMode: 'recall', label: 'Recall (easy)', priorBeta: 1.5, a: 1.6, c: 0.25 },
      { evalMode: 'apply', label: 'Apply (medium)', priorBeta: 3.0, a: 1.4, c: 0.25 },
      { evalMode: 'analyze', label: 'Analyze (hard)', priorBeta: 4.5, a: 1.6, c: 0.20 },
      { evalMode: 'evaluate', label: 'Evaluate (expert)', priorBeta: 6.0, a: 1.8, c: 0.15 },
    ],
  },
  'true-false': {
    label: 'True / False',
    modes: [
      { evalMode: 'default', label: 'T/F', priorBeta: 2.0, a: 1.0, c: 0.5 },
    ],
  },
};

// ============================================================================
// State types
// ============================================================================

interface AbilityState {
  theta: number;
  sigma: number;
  totalItemsSeen: number;
}

interface ItemCalState {
  priorBeta: number;
  empiricalBeta: number | null;
  calibratedBeta: number;
  credibilityZ: number;
  priorA: number;
  currentA: number;
  aCredibility: number;
  c: number;
  totalObservations: number;
  totalCorrect: number;
  sumRespondentTheta: number;
  sumCorrectTheta: number;
  sumThetaSquared: number;
}

interface StepResult {
  index: number;
  evalMode: string;
  score: number;
  isCorrect: boolean;
  thetaBefore: number;
  thetaAfter: number;
  sigmaBefore: number;
  sigmaAfter: number;
  pCorrectBefore: number;
  information: number;
  itemBeta: number;
  itemA: number;
  mismatchDetected: boolean;
  streak: number;
  effectiveTau: number;
}

// ============================================================================
// Mismatch detection (uses stored per-item predictions)
// ============================================================================

function computeMismatch(history: StepResult[]): number {
  const recent = history.slice(-MISMATCH_WINDOW);
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

function consecutiveCorrectStreak(history: StepResult[]): number {
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].isCorrect) streak++;
    else break;
  }
  return streak;
}

// ============================================================================
// θ update (Bayesian grid EAP + proportional τ + streak acceleration + σ floor)
// ============================================================================

function updateTheta(
  ability: AbilityState,
  itemBeta: number,
  itemA: number,
  itemC: number,
  isCorrect: boolean,
  history: StepResult[],
): { ability: AbilityState; mismatchDetected: boolean; streak: number; effectiveTau: number } {
  const gridSize = Math.round((THETA_GRID_MAX - THETA_GRID_MIN) / THETA_GRID_STEP) + 1;
  const gridPoints: number[] = [];
  for (let i = 0; i < gridSize; i++) {
    gridPoints.push(Math.round((THETA_GRID_MIN + i * THETA_GRID_STEP) * 10) / 10);
  }

  // Mismatch detection using stored per-item predictions
  const mismatchValue = computeMismatch(history);
  const isMismatch = mismatchValue > MISMATCH_THRESHOLD;

  // Count consecutive correct streak (including current submission)
  const streak = consecutiveCorrectStreak(history) + (isCorrect ? 1 : 0);

  // Scaled process noise: τ proportional to mismatch magnitude
  // + mastery streak acceleration
  let effectiveTau = 0;
  if (isMismatch) {
    const mismatchScale = Math.min(3.0, mismatchValue / MISMATCH_THRESHOLD);
    effectiveTau = THETA_PROCESS_NOISE * mismatchScale;

    if (streak >= MASTERY_STREAK_THRESHOLD) {
      const streakBonus = 1 + (streak - MASTERY_STREAK_THRESHOLD) * 0.4;
      effectiveTau *= Math.min(3.0, streakBonus);
    }

    effectiveTau = Math.min(TAU_CAP, effectiveTau);
  }

  const priorSigma = Math.sqrt(ability.sigma ** 2 + effectiveTau ** 2);

  let prior = gridPoints.map((t) => {
    const z = (t - ability.theta) / priorSigma;
    return Math.exp(-0.5 * z * z);
  });
  const priorSum = prior.reduce((a, b) => a + b, 0);
  if (priorSum > 0) prior = prior.map((p) => p / priorSum);

  const likelihood = gridPoints.map((t) => {
    const p = pCorrect(t, itemA, itemBeta, itemC);
    return isCorrect ? p : 1 - p;
  });

  let posterior = prior.map((p, i) => p * likelihood[i]);
  const postSum = posterior.reduce((a, b) => a + b, 0);
  if (postSum > 0) posterior = posterior.map((p) => p / postSum);
  else posterior = prior;

  let newTheta = gridPoints.reduce((sum, t, i) => sum + t * posterior[i], 0);
  newTheta = Math.round(Math.max(0, Math.min(10, newTheta)) * 100) / 100;

  const variance = gridPoints.reduce(
    (sum, t, i) => sum + posterior[i] * (t - newTheta) ** 2, 0,
  );
  let newSigma = Math.round(Math.max(0.1, Math.min(5, Math.sqrt(variance))) * 1000) / 1000;

  // τ-induced σ correction: subtract process noise contribution from posterior σ
  if (effectiveTau > 0) {
    const corrected = Math.sqrt(Math.max(0.01, newSigma ** 2 - effectiveTau ** 2));
    newSigma = Math.round(Math.max(0.1, Math.min(5, corrected)) * 1000) / 1000;
  }

  // σ floor
  let mismatchDetected = false;
  if (mismatchValue > MISMATCH_THRESHOLD) {
    const floored = Math.max(newSigma, MISMATCH_SIGMA_FLOOR);
    if (floored > newSigma) mismatchDetected = true;
    newSigma = floored;
  }

  return {
    ability: { theta: newTheta, sigma: newSigma, totalItemsSeen: ability.totalItemsSeen + 1 },
    mismatchDetected,
    streak,
    effectiveTau,
  };
}

// ============================================================================
// Item calibration update (2PL β MLE + empirical a)
// ============================================================================

function updateItemCal(item: ItemCalState, studentTheta: number, isCorrect: boolean): ItemCalState {
  const u = { ...item };
  u.totalObservations += 1;
  if (isCorrect) {
    u.totalCorrect += 1;
    u.sumCorrectTheta += studentTheta;
  }
  u.sumRespondentTheta += studentTheta;
  u.sumThetaSquared += studentTheta ** 2;

  const n = u.totalObservations;
  const correct = u.totalCorrect;
  const incorrect = n - correct;
  const meanTheta = u.sumRespondentTheta / n;

  if (correct > 0 && incorrect > 0) {
    const a = Math.max(0.3, u.currentA);
    u.empiricalBeta = meanTheta - (1.0 / a) * Math.log(correct / incorrect);
  } else if (correct === 0) {
    u.empiricalBeta = meanTheta + 2.0;
  } else {
    u.empiricalBeta = meanTheta - 2.0;
  }
  u.empiricalBeta = Math.max(0, Math.min(10, u.empiricalBeta));

  u.credibilityZ = Math.min(1.0, Math.sqrt(n / ITEM_CREDIBILITY_STANDARD));
  const z = u.credibilityZ;
  u.calibratedBeta = Math.round((z * u.empiricalBeta + (1 - z) * u.priorBeta) * 1000) / 1000;
  u.calibratedBeta = Math.max(0, Math.min(10, u.calibratedBeta));

  // Empirical a
  if (n >= A_MIN_OBSERVATIONS) {
    const pObs = u.totalCorrect / n;
    if (pObs > A_MIN_P_OBS && pObs < A_MAX_P_OBS && incorrect > 0) {
      const meanCorrect = u.sumCorrectTheta / u.totalCorrect;
      const meanIncorrect = (u.sumRespondentTheta - u.sumCorrectTheta) / incorrect;
      const thetaVariance = (u.sumThetaSquared / n) - (u.sumRespondentTheta / n) ** 2;
      if (thetaVariance > 0.01) {
        let rPb = ((meanCorrect - meanIncorrect) / Math.sqrt(thetaVariance))
          * Math.sqrt(pObs * (1.0 - pObs));
        rPb = Math.max(-0.95, Math.min(0.95, rPb));
        if (rPb > 0) {
          let aEmp = rPb * 1.7 / Math.sqrt(1.0 - rPb ** 2);
          aEmp = Math.max(A_CLAMP_MIN, Math.min(A_CLAMP_MAX, aEmp));
          const zA = n / (n + A_CREDIBILITY_K);
          let aUp = zA * aEmp + (1.0 - zA) * u.priorA;
          aUp = Math.max(A_CLAMP_MIN, Math.min(A_CLAMP_MAX, Math.round(aUp * 1000) / 1000));
          u.currentA = aUp;
          u.aCredibility = Math.round(zA * 1000) / 1000;
        }
      }
    }
  }

  return u;
}

function makeItemCal(mode: ModeConfig): ItemCalState {
  return {
    priorBeta: mode.priorBeta, empiricalBeta: null, calibratedBeta: mode.priorBeta,
    credibilityZ: 0, priorA: mode.a, currentA: mode.a, aCredibility: 0, c: mode.c,
    totalObservations: 0, totalCorrect: 0, sumRespondentTheta: 0,
    sumCorrectTheta: 0, sumThetaSquared: 0,
  };
}

// ============================================================================
// Gate check
// ============================================================================

function checkGates(
  theta: number, sigma: number,
  minBeta: number, maxBeta: number, avgA: number,
) {
  return GATE_DEFINITIONS.map((g) => {
    const refBeta = minBeta + (maxBeta - minBeta) * g.refBetaFraction;
    const p = pCorrect(theta, avgA, refBeta);
    const pOk = p >= g.pThreshold;
    const sigmaOk = sigma <= g.sigmaMax;
    return { ...g, refBeta, p: Math.round(p * 1000) / 1000, pOk, sigmaOk, passed: pOk && sigmaOk };
  });
}

// ============================================================================
// Route handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { primitive, steps } = body as {
      primitive: string;
      steps: { evalMode: string; score: number }[];
    };

    const prim = PRIMITIVE_REGISTRY[primitive];
    if (!prim) {
      return NextResponse.json(
        { error: `Unknown primitive: ${primitive}. Available: ${Object.keys(PRIMITIVE_REGISTRY).join(', ')}` },
        { status: 400 },
      );
    }

    const modeMap = new Map(prim.modes.map((m) => [m.evalMode, m]));
    const minBeta = Math.min(...prim.modes.map((m) => m.priorBeta));

    // Init
    let ability: AbilityState = { theta: minBeta, sigma: DEFAULT_SIGMA, totalItemsSeen: 0 };
    const cals: Record<string, ItemCalState> = {};
    for (const m of prim.modes) cals[m.evalMode] = makeItemCal(m);
    const trajectory: StepResult[] = [];

    // Run steps
    for (const step of steps) {
      const mode = modeMap.get(step.evalMode);
      if (!mode) {
        return NextResponse.json(
          { error: `Unknown eval mode "${step.evalMode}" for ${primitive}. Available: ${prim.modes.map((m) => m.evalMode).join(', ')}` },
          { status: 400 },
        );
      }

      const cal = cals[mode.evalMode];
      const useA = cal.currentA;
      const useBeta = cal.calibratedBeta;
      const useC = cal.c;
      const isCorrect = step.score >= IRT_CORRECT_THRESHOLD;

      const pBefore = pCorrect(ability.theta, useA, useBeta, useC);
      const info = itemInformation(ability.theta, useA, useBeta, useC);

      const { ability: updated, mismatchDetected, streak, effectiveTau } = updateTheta(
        ability, useBeta, useA, useC, isCorrect, trajectory,
      );

      cals[mode.evalMode] = updateItemCal(cal, ability.theta, isCorrect);

      trajectory.push({
        index: ability.totalItemsSeen,
        evalMode: step.evalMode,
        score: step.score,
        isCorrect,
        thetaBefore: ability.theta,
        thetaAfter: updated.theta,
        sigmaBefore: ability.sigma,
        sigmaAfter: updated.sigma,
        pCorrectBefore: Math.round(pBefore * 1000) / 1000,
        information: Math.round(info * 1000) / 1000,
        itemBeta: Math.round(useBeta * 1000) / 1000,
        itemA: Math.round(useA * 1000) / 1000,
        mismatchDetected,
        streak,
        effectiveTau: Math.round(effectiveTau * 1000) / 1000,
      });

      ability = updated;
    }

    // Final gate check — use CALIBRATED betas for gate reference computation
    const avgA = prim.modes.reduce((s, m) => s + (cals[m.evalMode]?.currentA ?? m.a), 0) / prim.modes.length;
    const calibratedBetas = prim.modes.map((m) => cals[m.evalMode]?.calibratedBeta ?? m.priorBeta);
    const calMinBeta = Math.min(...calibratedBetas);
    const calMaxBeta = Math.max(...calibratedBetas);
    const gates = checkGates(ability.theta, ability.sigma, calMinBeta, calMaxBeta, avgA);
    const maxGate = gates.reduce((g, cur) => cur.passed ? cur.gate : g, 0);

    // Summary
    const mismatchCount = trajectory.filter((t) => t.mismatchDetected).length;
    const maxStreak = Math.max(0, ...trajectory.map((t) => t.streak));
    const calSummary: Record<string, { beta: number; priorBeta: number; a: number; priorA: number; n: number }> = {};
    for (const [mode, cal] of Object.entries(cals)) {
      if (cal.totalObservations > 0) {
        calSummary[mode] = {
          beta: cal.calibratedBeta, priorBeta: cal.priorBeta,
          a: cal.currentA, priorA: cal.priorA, n: cal.totalObservations,
        };
      }
    }

    return NextResponse.json({
      finalState: {
        theta: ability.theta,
        sigma: ability.sigma,
        totalItems: ability.totalItemsSeen,
      },
      gateReached: maxGate,
      gates,
      mismatchCount,
      maxStreak,
      calibratedBetaRange: { min: calMinBeta, max: calMaxBeta },
      itemCalibrations: calSummary,
      trajectory,
      // Compact summary for quick scanning
      summary: `θ=${ability.theta} σ=${ability.sigma} gate=${maxGate}/4 items=${ability.totalItemsSeen} mismatches=${mismatchCount} streak=${maxStreak}`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 },
    );
  }
}
