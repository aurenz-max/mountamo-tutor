/**
 * ramp-lab -- code-owned challenge pool and force model.
 *
 * The arithmetic is the answer key, so Gemini only frames the session. Keeping
 * the pool beside the component lets the generator, UI, and contract tests all
 * consume the exact same model.
 */

export type RampChallengeMode =
  | 'compare_conditions'
  | 'find_threshold'
  | 'design_with_budget';

export type RampLoadType = 'box' | 'barrel' | 'wheel' | 'custom';
export type RampFrictionLevel = 'none' | 'low' | 'medium' | 'high';

export interface RampScenario {
  angle: number;
  loadWeight: number;
  loadType: RampLoadType;
  frictionLevel: RampFrictionLevel;
  label: string;
}

interface RampChallengeBase {
  id: string;
  title: string;
  mode: RampChallengeMode;
  brief: string;
  hint: string;
  explainOnSolve: string;
}

export interface CompareConditionsChallenge extends RampChallengeBase {
  mode: 'compare_conditions';
  scenarios: { a: RampScenario; b: RampScenario };
  changedVariable: 'angle' | 'surface' | 'load';
}

export interface FindThresholdChallenge extends RampChallengeBase {
  mode: 'find_threshold';
  scenario: RampScenario;
  forceStep: number;
}

export interface DesignWithBudgetChallenge extends RampChallengeBase {
  mode: 'design_with_budget';
  scenario: RampScenario;
  forceBudget: number;
  angleRange: { min: number; max: number };
  targetHeight: number;
}

export type RampChallenge =
  | CompareConditionsChallenge
  | FindThresholdChallenge
  | DesignWithBudgetChallenge;

export const RAMP_FRICTION_COEFFICIENTS: Record<RampFrictionLevel, number> = {
  none: 0,
  low: 0.1,
  medium: 0.3,
  high: 0.5,
};

const GRAVITY = 9.8;

export const requiredPushForce = (
  scenario: Pick<RampScenario, 'angle' | 'loadWeight' | 'frictionLevel'>,
): number => {
  const radians = (scenario.angle * Math.PI) / 180;
  const gravityDownRamp = scenario.loadWeight * GRAVITY * Math.sin(radians);
  const normalForce = scenario.loadWeight * GRAVITY * Math.cos(radians);
  return gravityDownRamp + RAMP_FRICTION_COEFFICIENTS[scenario.frictionLevel] * normalForce;
};

/** Smallest slider value that actually moves the load (the physics uses >). */
export const minimumPushSetting = (
  scenario: Pick<RampScenario, 'angle' | 'loadWeight' | 'frictionLevel'>,
  step = 0.5,
): number => {
  const threshold = requiredPushForce(scenario);
  const setting = (Math.floor((threshold + 1e-9) / step) + 1) * step;
  return Number(setting.toFixed(4));
};

export const easierComparisonChoice = (
  challenge: CompareConditionsChallenge,
): 'a' | 'b' | 'same' => {
  const a = requiredPushForce(challenge.scenarios.a);
  const b = requiredPushForce(challenge.scenarios.b);
  if (Math.abs(a - b) < 0.05) return 'same';
  return a < b ? 'a' : 'b';
};

export const maxWorkableAngle = (
  scenario: Pick<RampScenario, 'loadWeight' | 'loadType' | 'frictionLevel' | 'label'>,
  forceBudget: number,
  angleRange: { min: number; max: number },
): number => {
  let answer = angleRange.min;
  for (let angle = angleRange.min; angle <= angleRange.max; angle += 1) {
    if (forceBudget > requiredPushForce({ ...scenario, angle })) answer = angle;
  }
  return answer;
};

const scenario = (
  label: string,
  angle: number,
  loadWeight: number,
  loadType: RampLoadType,
  frictionLevel: RampFrictionLevel,
): RampScenario => ({ label, angle, loadWeight, loadType, frictionLevel });

const designChallenge = (
  id: string,
  title: string,
  loadWeight: number,
  loadType: RampLoadType,
  frictionLevel: RampFrictionLevel,
  answerAngle: number,
  targetHeight: number,
  brief: string,
  hint: string,
  explainOnSolve: string,
): DesignWithBudgetChallenge => {
  const base = scenario('Your design', Math.min(answerAngle + 9, 50), loadWeight, loadType, frictionLevel);
  // A midpoint between adjacent thresholds makes answerAngle the unique steepest
  // whole-degree solution, without hand-authored answer arithmetic.
  const atAnswer = requiredPushForce({ ...base, angle: answerAngle });
  const atNext = requiredPushForce({ ...base, angle: answerAngle + 1 });
  const forceBudget = Number(((atAnswer + atNext) / 2).toFixed(2));
  return {
    id,
    title,
    mode: 'design_with_budget',
    scenario: base,
    forceBudget,
    angleRange: { min: 10, max: 50 },
    targetHeight,
    brief,
    hint,
    explainOnSolve,
  };
};

const CHALLENGE_POOL: RampChallenge[] = [
  // compare_conditions: matched pairs change exactly one causal variable.
  {
    id: 'compare-wheel-box',
    title: 'Wheel or Box?',
    mode: 'compare_conditions',
    changedVariable: 'load',
    scenarios: {
      a: scenario('Wheel on a smooth ramp', 25, 4, 'wheel', 'low'),
      b: scenario('Box on the same ramp', 25, 4, 'box', 'medium'),
    },
    brief: 'The loads have the same weight and climb the same ramp. Which setup needs less push?',
    hint: 'Rolling contact usually resists motion less than a sliding surface.',
    explainOnSolve: 'The wheel has less resistance, so less of the push is spent overcoming friction.',
  },
  {
    id: 'compare-steep-gentle',
    title: 'Steep or Gentle?',
    mode: 'compare_conditions',
    changedVariable: 'angle',
    scenarios: {
      a: scenario('Steep ramp', 42, 5, 'box', 'medium'),
      b: scenario('Gentle ramp', 20, 5, 'box', 'medium'),
    },
    brief: 'Everything is identical except the ramp angle. Which setup needs less push?',
    hint: 'Ask how much gravity points back down each ramp.',
    explainOnSolve: 'On the gentler ramp, a smaller part of gravity pulls the load downhill, so the required push is lower.',
  },
  {
    id: 'compare-rough-smooth',
    title: 'Rough or Smooth?',
    mode: 'compare_conditions',
    changedVariable: 'surface',
    scenarios: {
      a: scenario('Rough surface', 30, 4, 'box', 'high'),
      b: scenario('Smooth surface', 30, 4, 'box', 'low'),
    },
    brief: 'The box, weight, and angle stay fixed. Which surface needs less push?',
    hint: 'Friction pushes against sliding motion.',
    explainOnSolve: 'The smooth surface produces less friction, leaving more of the applied force available to move the box.',
  },
  {
    id: 'compare-angle-reversed',
    title: 'Choose the Easier Route',
    mode: 'compare_conditions',
    changedVariable: 'angle',
    scenarios: {
      a: scenario('Gentle route', 18, 6, 'barrel', 'low'),
      b: scenario('Steep route', 38, 6, 'barrel', 'low'),
    },
    brief: 'The barrel and surface are unchanged. Which route needs less push?',
    hint: 'Compare the slopes, not the drawing labels or positions.',
    explainOnSolve: 'The gentler route reduces the downhill component of gravity, so it needs less input force.',
  },

  // find_threshold: measurement by controlled iteration, never max-the-slider.
  {
    id: 'threshold-wheel-gentle',
    title: 'Find the First Moving Force',
    mode: 'find_threshold',
    scenario: scenario('Light wheel', 18, 3, 'wheel', 'low'),
    forceStep: 0.5,
    brief: 'Find the smallest push setting that makes the wheel climb. Test carefully -- a larger force works, but is not the answer.',
    hint: 'Start low, then narrow the gap between a force that fails and one that works.',
    explainOnSolve: 'You found the threshold: the first slider step where push becomes greater than gravity plus friction.',
  },
  {
    id: 'threshold-box-medium',
    title: 'Measure the Threshold',
    mode: 'find_threshold',
    scenario: scenario('Crate on a ramp', 30, 5, 'box', 'medium'),
    forceStep: 0.5,
    brief: 'Find the least push that starts this crate moving uphill.',
    hint: 'Use failed tests as evidence. Increase by smaller amounts when you get close.',
    explainOnSolve: 'At the threshold, your push just exceeds the two forces opposing motion: downhill gravity and friction.',
  },
  {
    id: 'threshold-barrel-steep',
    title: 'Test a Steeper Ramp',
    mode: 'find_threshold',
    scenario: scenario('Barrel on a steep ramp', 40, 4, 'barrel', 'low'),
    forceStep: 0.5,
    brief: 'Measure the smallest push that will move the barrel up this steeper ramp.',
    hint: 'A steep ramp sends more of gravity down the ramp, even when friction is low.',
    explainOnSolve: 'The steeper angle raised the threshold because more of the barrel\'s weight acted downhill.',
  },
  {
    id: 'threshold-rough-crate',
    title: 'Test a Rough Surface',
    mode: 'find_threshold',
    scenario: scenario('Crate on a rough ramp', 24, 4, 'box', 'high'),
    forceStep: 0.5,
    brief: 'Find the minimum push for this rough-surface setup.',
    hint: 'Both the slope and the rough surface oppose your push.',
    explainOnSolve: 'This threshold includes both downhill gravity and the larger friction force from the rough surface.',
  },

  // design_with_budget: fixed dock height; shallower means a longer ramp.
  designChallenge(
    'design-loading-dock',
    'Loading Dock Limit',
    5,
    'box',
    'medium',
    24,
    3,
    'Build the steepest whole-degree ramp this push budget can handle. The dock height must stay fixed.',
    'If the load cannot climb, make the ramp gentler. If it can, see whether one more degree still works.',
    'You found the boundary design: any steeper would exceed the force budget, while any gentler would use more ramp length than necessary.',
  ),
  designChallenge(
    'design-wheelchair-ramp',
    'Smooth Access Ramp',
    4,
    'wheel',
    'low',
    30,
    3,
    'Use the available push to make the steepest workable ramp to the fixed platform.',
    'Search for the boundary between works and does not work, then choose the steepest working angle.',
    'The design balances two constraints: enough push to climb and no extra ramp length beyond what the budget requires.',
  ),
  designChallenge(
    'design-rough-site',
    'Rough-Site Ramp',
    6,
    'box',
    'high',
    19,
    3.5,
    'The site surface is rough. Find the steepest ramp that still reaches the platform within the force budget.',
    'Roughness uses part of the force budget before the load even fights the slope.',
    'Because friction consumed more of the budget, this design needed a gentler, longer ramp.',
  ),
  designChallenge(
    'design-barrel-route',
    'Barrel Delivery Route',
    5,
    'barrel',
    'low',
    36,
    4,
    'Choose the steepest whole-degree route the crew can use without exceeding its push limit.',
    'Try a working angle, then increase one degree at a time until the next step fails.',
    'The last working angle is the efficient boundary: it reaches the same height with the shortest feasible ramp.',
  ),
];

export const selectRampChallenges = (
  modes: readonly string[],
  count = 4,
): RampChallenge[] => {
  const wanted = new Set(modes);
  const selected = CHALLENGE_POOL.filter((challenge) => wanted.has(challenge.mode));
  return (selected.length > 0 ? selected : CHALLENGE_POOL).slice(0, count);
};

/** Mixed sessions rotate task identities before repeating any one mode. */
export const selectMixedRampChallenges = (count = 6): RampChallenge[] => {
  const order: RampChallengeMode[] = [
    'compare_conditions',
    'find_threshold',
    'design_with_budget',
  ];
  const buckets = order.map((mode) => CHALLENGE_POOL.filter((challenge) => challenge.mode === mode));
  const selected: RampChallenge[] = [];
  for (let round = 0; selected.length < count; round += 1) {
    let added = false;
    for (const bucket of buckets) {
      if (round < bucket.length && selected.length < count) {
        selected.push(bucket[round]);
        added = true;
      }
    }
    if (!added) break;
  }
  return selected;
};

export const DEFAULT_RAMP_CHALLENGES = selectMixedRampChallenges(6);
