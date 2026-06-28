import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import type { GenerationContext } from "../generation/generationContext";

// Import data types from component (single source of truth)
import type {
  RaceTrackLabData,
  RaceChallenge,
  RaceTrackChallengeType,
  Racer,
} from '../../primitives/visual-primitives/physics/RaceTrackLab';

import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// Re-export for convenience
export type {
  RaceTrackLabData,
  RaceChallenge,
  RaceTrackChallengeType,
  Racer,
};

// ============================================================================
// CHALLENGE TYPE DOCUMENTATION REGISTRY
// ============================================================================

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  observe: {
    promptDoc:
      `"observe": Watch the race and answer. Student sees 2-4 racers run, then answers `
      + `"Who won?" or "Who was fastest?". No time limit. Easiest difficulty. K-1.`,
    schemaDescription: "'observe' (watch the race, answer about the outcome)",
  },
  predict: {
    promptDoc:
      `"predict": Predict before the race. Given racer speeds (shown as labels like "fast", "slow"), `
      + `student predicts the winner or order BEFORE watching. Same math as observe but tests prediction. Grades 1-2.`,
    schemaDescription: "'predict' (predict outcome before watching the race)",
  },
  measure: {
    promptDoc:
      `"measure": Timed race, compare distances. Race runs for a fixed timeLimit (seconds). `
      + `Student compares how far each racer traveled (distance = speed * time). `
      + `MUST include timeLimit. Grades 2-3.`,
    schemaDescription: "'measure' (compare distances traveled in a fixed time)",
  },
  calculate: {
    promptDoc:
      `"calculate": Compute speed or distance. Student uses speed = distance / time or `
      + `distance = speed * time to answer. MUST include timeLimit. Grades 3-5.`,
    schemaDescription: "'calculate' (compute speed, distance, or time from given values)",
  },
  graph: {
    promptDoc:
      `"graph": Read a position-time graph. Student identifies which racer is fastest from `
      + `slope. Steeper slope = faster. MUST include timeLimit. Grades 4-5+.`,
    schemaDescription: "'graph' (interpret position-time graph to compare speeds)",
  },
};

// ============================================================================
// WITHIN-MODE SUPPORT TIER (config.difficulty) — scaffolding level, NOT numbers
// ============================================================================

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

// ----------------------------------------------------------------------------
// TIER_GUARDRAIL — the one rule both within-mode axes obey.
//   Axis 1 (scaffolding withdrawal, resolveSupportStructure): removes on-screen /
//   instructional help. Axis 2 (structural difficulty, resolveProblemShape):
//   changes the problem's SHAPE — the discriminating GAP between the top two
//   racers (a blowout vs. a photo-finish) and the # of racers to track —
//   while every speed stays inside the grade-band magnitude window.
//   Magnitude (the speed band, the track length) is owned by the eval mode +
//   grade scope; a tier NEVER pushes a speed past that band and NEVER reshapes
//   one eval mode into another. The fastest racer NAMED by the answer always
//   stays the fastest, so the stored answer string remains valid by construction.
const TIER_GUARDRAIL =
  'Structural difficulty changes problem SHAPE (gap between the top racers, # of '
  + 'racers to track), never magnitude (the per-grade speed band) and never the eval mode.';

// ----------------------------------------------------------------------------
// Bespoke scaffold — which on-screen / instructional helps are withdrawn per
// tier, per pinned mode. INVARIANT: a tier only removes scaffolding; it never
// touches a racer speed, a track length, a time limit, or the correctAnswer.
// The racer/speed assignment owns the numbers; the answer is a stored string.
//
// Levers (all display- or words-only — none answer-bearing):
//   showSpeedLegend  (#1 perception) — the per-racer "(speed sq/s)" readout. A
//                    self-check aid for observe/predict/measure (shown easy →
//                    withdrawn hard). For calculate/graph the readout LEAKS the
//                    value the student is meant to compute / read off slope, so
//                    it stays OFF at every tier once a tier is active (UI
//                    contract: a leaky display a mode must hide stays hidden).
//   nameStrategy     (#2 instruction-as-scaffold) — easy: the instruction names
//                    the approach ("compare the speeds" / "distance = speed ×
//                    time"); hard: neutral instruction, strategy NOT named. Words
//                    only — every racer/number byte-identical. Prompt-driven so
//                    the LLM authors a self-consistent narrative (story-primitive
//                    rule: constrain via prompt, don't code-reassemble prose).
//   hintLevel        (#2) — easy: explicit formula/rule in the hint; hard:
//                    conceptual nudge only, no formula. Prompt-driven.
// ----------------------------------------------------------------------------

interface RaceTrackSupportScaffold {
  /** Show the per-racer numeric speed readout legend. */
  showSpeedLegend: boolean;
  /** Name the solving strategy in the instruction (words-only scaffold). */
  nameStrategy: boolean;
  /** 'formula' = explicit rule in the hint; 'concept' = conceptual nudge only. */
  hintLevel: 'formula' | 'concept';
  promptLines: string[];
}

function resolveSupportStructure(
  pinnedType: RaceTrackChallengeType,
  tier: SupportTier,
): RaceTrackSupportScaffold {
  const lead =
    'This tier changes only how much on-screen / instructional help the student gets. '
    + 'It NEVER changes the racer speeds, the track length, the time limit, or the answer.';

  // calculate / graph: the numeric speed readout would hand over the value the
  // student must compute (calculate) or read from slope (graph). Keep it OFF at
  // every tier when a tier is active — this is a UI contract, not a lever.
  const speedReadoutIsLeaky = pinnedType === 'calculate' || pinnedType === 'graph';
  const showSpeedLegend = speedReadoutIsLeaky ? false : tier !== 'hard';
  const nameStrategy = tier !== 'hard';
  const hintLevel: 'formula' | 'concept' = tier === 'easy' ? 'formula' : 'concept';

  const promptLines: string[] = [lead];

  if (speedReadoutIsLeaky) {
    promptLines.push(
      'The per-racer numeric speed readout is hidden in this mode (it would reveal the value the student computes or reads from the graph) — do not state any racer\'s speed in the instruction or question.',
    );
  } else {
    promptLines.push(
      showSpeedLegend
        ? 'The per-racer speed readout is shown beside the track to help the student compare — you may write the instruction assuming the speeds are visible.'
        : 'The per-racer speed readout is withdrawn — the student must judge relative speed from the race itself; do NOT name any racer\'s speed in the instruction or question.',
    );
  }

  promptLines.push(
    nameStrategy
      ? 'INSTRUCTION: name the approach in plain words (e.g. "compare how fast each racer moves" or "use distance = speed × time") — but never state which racer wins or the numeric answer.'
      : 'INSTRUCTION: stay neutral — pose the task WITHOUT naming the strategy or the rule; the student must decide how to reason about the race themselves.',
  );

  promptLines.push(
    hintLevel === 'formula'
      ? 'HINT: give the explicit rule or formula (e.g. "the faster racer covers more squares each second" or "distance = speed × time").'
      : 'HINT: a conceptual nudge only — point the student back to what they saw on the track, with NO formula and without revealing the answer.',
  );

  promptLines.push(
    'Keep the title and description neutral — never state the support level, name a winning racer, or reveal the answer.',
  );

  return { showSpeedLegend, nameStrategy, hintLevel, promptLines };
}

// ============================================================================
// STRUCTURAL DIFFICULTY (config.difficulty) — axis 2: problem SHAPE, NOT size
// ============================================================================
// The in-mode structural lever for every race mode is the SAME family of
// graph/data lever: GAP SUBTLETY between the two discriminating quantities.
//   observe / predict — gap = (fastest speed − 2nd-fastest speed). Big gap is a
//                        blowout (easy to call); a 1-unit gap is a photo-finish.
//   measure           — gap is read as a DISTANCE gap (speed × time), but since
//                        time is shared the speed gap drives it; same lever.
//   calculate         — gap = step depth + discriminating speed gap; the soft
//                        step-depth nudge (single divide → compute-then-compare)
//                        is PROMPT-shaped, the speed gap is code-enforced.
//   graph             — gap = slope gap (steeper line); again the speed gap.
// Reinforced by RACER COUNT (parts to coordinate), clamped to the grade band.
//
// FLOOR (mode identity, never dropped): ≥ 2 racers with DISTINCT speeds and a
// gap ≥ 1 — there must always be a determinate winner (gap 0 = a tie = unsolvable).
// CAP (magnitude ceiling, never exceeded): speeds stay within [minSpeed,maxSpeed]
// for the grade, and racerCount stays ≤ the grade's per-challenge band.
//
// SATURATION: a 2-racer-only grade (K) saturates racerCount at 2; a narrow
// speed band saturates the gap at its widest fit — that is correct, not a bug.

interface RaceTrackProblemShape {
  /** Target gap (in speed units) between the fastest and 2nd-fastest racer. */
  targetGap: number;
  /** Bias the racer count toward this many (clamped to the grade band per challenge). */
  racerCountBias: 'min' | 'mid' | 'max';
  /** calculate-only soft lever: 'single' = one operation, 'chained' = compute-then-compare. */
  stepDepth: 'single' | 'chained';
  promptLines: string[];
}

function resolveProblemShape(
  pinnedType: RaceTrackChallengeType,
  tier: SupportTier,
  speedBand: { min: number; max: number },
): RaceTrackProblemShape {
  const bandSpan = Math.max(1, speedBand.max - speedBand.min);

  // Gap targets per tier, expressed as a fraction of the band span, then clamped
  // to [1, bandSpan]. Easy = a wide, obvious gap; hard = the tightest distinct gap.
  const easyGap = Math.max(2, Math.round(bandSpan * 0.6));
  const medGap = Math.max(1, Math.round(bandSpan * 0.35));
  const hardGap = 1; // tightest distinct gap — a photo-finish, still solvable

  const clampGap = (g: number) => Math.max(1, Math.min(bandSpan, g));

  let targetGap: number;
  let racerCountBias: 'min' | 'mid' | 'max';
  let stepDepth: 'single' | 'chained';
  let shapeWord: string;

  if (tier === 'easy') {
    targetGap = clampGap(easyGap);
    racerCountBias = 'min';
    stepDepth = 'single';
    shapeWord = 'a wide, obvious gap between the leader and the rest, and the fewest racers to track';
  } else if (tier === 'medium') {
    targetGap = clampGap(medGap);
    racerCountBias = 'mid';
    stepDepth = 'single';
    shapeWord = 'a moderate gap between the top racers, and a middling number of racers';
  } else {
    targetGap = clampGap(hardGap);
    racerCountBias = 'max';
    stepDepth = 'chained';
    shapeWord = 'a TIGHT, near-tie gap between the top racers, and the most racers to track';
  }

  const promptLines: string[] = [
    TIER_GUARDRAIL,
    `STRUCTURE for this tier: ${shapeWord}. The speeds are pre-assigned below — write the `
      + `question and answer around exactly those speeds; do not invent new numbers.`,
  ];

  // calculate-only step-depth soft lever (prompt-shaped — there is no clean
  // numeric handle that does not bleed into magnitude, so it stays advisory).
  if (pinnedType === 'calculate') {
    promptLines.push(
      stepDepth === 'chained'
        ? 'STEP DEPTH (hard): require the student to combine two ideas — compute each racer\'s distance with distance = speed × time, THEN compare to answer; do NOT hand them a one-step lookup.'
        : 'STEP DEPTH (easy/medium): a single computation is enough — e.g. given distance and time, find one racer\'s speed with speed = distance ÷ time.',
    );
  }

  return { targetGap, racerCountBias, stepDepth, promptLines };
}

/**
 * Constructive speed builder — re-selects `count` DISTINCT integer speeds inside
 * [band.min, band.max] such that the gap between the TOP TWO equals `targetGap`
 * exactly (clamped to the band). Preserves the solvability invariants:
 *   - all speeds distinct (no accidental tie),
 *   - exactly one strict maximum (a determinate winner),
 *   - every speed within the band,
 *   - top-two gap == clamped(targetGap).
 * Returns speeds with the fastest at index 0 (caller shuffles for display).
 */
function buildSpeedsWithGap(
  count: number,
  targetGap: number,
  band: { min: number; max: number },
): number[] {
  const span = band.max - band.min;
  const gap = Math.max(1, Math.min(span, targetGap));

  // Place the leader and the runner-up exactly `gap` apart, as high in the band
  // as fits. leader = max, runnerUp = max - gap.
  const leader = band.max;
  const runnerUp = leader - gap; // >= band.min since gap <= span

  const speeds = [leader, runnerUp];

  // Fill remaining racers with DISTINCT speeds strictly below the runner-up when
  // possible (so the top-two gap stays the discriminating one), else below the
  // leader but never equal to leader/runnerUp and never creating a second value
  // that ties the runner-up's distance from the leader's perspective.
  const used = new Set<number>(speeds);
  let fillCursor = runnerUp - 1;
  while (speeds.length < count) {
    // Walk down from just under the runner-up; wrap to fill any band gaps below.
    while (fillCursor >= band.min && used.has(fillCursor)) fillCursor--;
    if (fillCursor >= band.min) {
      speeds.push(fillCursor);
      used.add(fillCursor);
      fillCursor--;
      continue;
    }
    // Band exhausted below runner-up — pull DISTINCT values from anywhere in the
    // band that are not the leader and keep the leader's strict-max invariant.
    let found = -1;
    for (let v = band.max - 1; v >= band.min; v--) {
      if (!used.has(v)) { found = v; break; }
    }
    if (found < 0) break; // band fully exhausted (count exceeds distinct slots)
    speeds.push(found);
    used.add(found);
  }

  return speeds; // index 0 = leader, index 1 = runner-up
}

// ============================================================================
// DETERMINISTIC RACER LIBRARY
// ============================================================================

interface RacerTemplate {
  name: string;
  emoji: string;
  color: string;
}

const RACER_LIBRARY: RacerTemplate[] = [
  { name: 'Rocket Rabbit', emoji: '🐇', color: '#60A5FA' },
  { name: 'Turbo Turtle', emoji: '🐢', color: '#34D399' },
  { name: 'Speedy Snail', emoji: '🐌', color: '#F97316' },
  { name: 'Cheetah', emoji: '🐆', color: '#FBBF24' },
  { name: 'Racing Car', emoji: '🏎️', color: '#EF4444' },
  { name: 'Bicycle', emoji: '🚲', color: '#A78BFA' },
  { name: 'Skateboard', emoji: '🛹', color: '#F472B6' },
  { name: 'Rocket', emoji: '🚀', color: '#38BDF8' },
  { name: 'Horse', emoji: '🐴', color: '#A3E635' },
  { name: 'Train', emoji: '🚂', color: '#FB923C' },
  { name: 'Airplane', emoji: '✈️', color: '#818CF8' },
  { name: 'Penguin', emoji: '🐧', color: '#22D3EE' },
];

/** Fisher-Yates shuffle a copy */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick n unique racers from the library */
function pickRacers(n: number): RacerTemplate[] {
  return shuffle(RACER_LIBRARY).slice(0, Math.min(n, RACER_LIBRARY.length));
}

/** The grade-band speed window (magnitude ceiling — owned by grade scope, NOT
 *  by the tier). Single source of truth for both assignSpeeds and the structural
 *  axis so the gap lever can never push a speed past the band. */
function resolveSpeedBand(grade: string): { min: number; max: number } {
  // K-1: 1-4 (very visible differences)
  // 2-3: 1-6 (moderate range)
  // 4-5+: 1-8 (tighter differences for harder challenges)
  const gradeNum = grade === 'K' ? 0 : parseInt(grade, 10) || 1;
  if (gradeNum <= 1) return { min: 1, max: 4 };
  if (gradeNum <= 3) return { min: 1, max: 6 };
  return { min: 1, max: 8 };
}

/** Assign distinct speeds appropriate for grade level.
 *  Returns speeds in grid-squares-per-second. */
function assignSpeeds(count: number, grade: string, challengeType: RaceTrackChallengeType): number[] {
  const { min: minSpeed, max: maxSpeed } = resolveSpeedBand(grade);

  // For calculate/graph, ensure speeds produce nice integer distances
  if (challengeType === 'calculate' || challengeType === 'graph') {
    // Use integer speeds only
    const pool: number[] = [];
    for (let s = minSpeed; s <= maxSpeed; s++) pool.push(s);
    const picked = shuffle(pool).slice(0, count);
    // Ensure at least two speeds are different
    if (picked.length >= 2 && new Set(picked).size === 1) {
      picked[0] = Math.max(minSpeed, picked[0] - 1) || minSpeed + 1;
    }
    return picked;
  }

  // For observe/predict/measure: wider spread so differences are visually clear
  const speeds: number[] = [];
  const step = (maxSpeed - minSpeed) / Math.max(count - 1, 1);
  for (let i = 0; i < count; i++) {
    // Spread evenly with small random jitter
    const base = minSpeed + step * i;
    const jitter = (Math.random() - 0.5) * step * 0.3;
    speeds.push(Math.round((base + jitter) * 10) / 10);
  }
  return shuffle(speeds); // Randomize which racer is fastest
}

// ============================================================================
// GEMINI SCHEMA — flat per-challenge, racers handled deterministically
// ============================================================================

const raceTrackChallengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: 'Clear instruction for the student. Do NOT reveal the answer or which racer wins.',
    },
    question: {
      type: Type.STRING,
      description: 'The multiple-choice question about the race. Reference racer names.',
    },
    correctAnswer: {
      type: Type.STRING,
      description: 'The correct answer. Must be derivable from racer speeds and track data.',
    },
    distractor0: {
      type: Type.STRING,
      description: 'First wrong answer — plausible but incorrect.',
    },
    distractor1: {
      type: Type.STRING,
      description: 'Second wrong answer — plausible but incorrect.',
    },
    distractor2: {
      type: Type.STRING,
      description: 'Optional third wrong answer for 4-choice questions. Use empty string if not needed.',
    },
    hint: {
      type: Type.STRING,
      description: 'Pedagogical hint that guides reasoning without revealing the answer.',
    },
  },
  required: ['instruction', 'question', 'correctAnswer', 'distractor0', 'distractor1', 'hint'],
};

const batchSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Engaging, age-appropriate title for the race track activity.',
    },
    description: {
      type: Type.STRING,
      description: 'What students will learn about speed, distance, and time.',
    },
    challenges: {
      type: Type.ARRAY,
      items: raceTrackChallengeSchema,
      description: 'Array of challenge question/answer sets (one per challenge).',
    },
  },
  required: ['title', 'description', 'challenges'],
};

// ============================================================================
// GRADE CONFIGURATION
// ============================================================================

const GRADE_CONFIGS: Record<string, { numChallenges: number; racerCounts: number[]; trackLength: number; guidance: string }> = {
  K: {
    numChallenges: 3,
    racerCounts: [2, 2, 2],
    trackLength: 10,
    guidance: 'Focus on observe. "Who won the race?" Very simple language. 2 racers only.',
  },
  '1': {
    numChallenges: 4,
    racerCounts: [2, 2, 3, 2],
    trackLength: 10,
    guidance: 'Observe + simple predict. "Which one do you think will win?" 2-3 racers.',
  },
  '2': {
    numChallenges: 4,
    racerCounts: [2, 3, 2, 3],
    trackLength: 12,
    guidance: 'Predict + measure. Introduce distance = speed * time. 2-3 racers.',
  },
  '3': {
    numChallenges: 5,
    racerCounts: [2, 3, 3, 2, 3],
    trackLength: 15,
    guidance: 'Measure + calculate. speed = distance / time with simple whole numbers. 2-3 racers.',
  },
  '4': {
    numChallenges: 5,
    racerCounts: [3, 3, 4, 3, 4],
    trackLength: 16,
    guidance: 'Calculate + graph. Position-time graphs with slope interpretation. 3-4 racers.',
  },
  '5': {
    numChallenges: 6,
    racerCounts: [3, 4, 3, 4, 3, 4],
    trackLength: 20,
    guidance: 'Full range including graph. Steeper slope = faster racer. 3-4 racers.',
  },
};

const ALL_CHALLENGE_TYPES: RaceTrackChallengeType[] = ['observe', 'predict', 'measure', 'calculate', 'graph'];

// ============================================================================
// POST-VALIDATION
// ============================================================================

interface ChallengeCandidate {
  type: RaceTrackChallengeType;
  racers: Racer[];
  trackLength: number;
  timeLimit: number | null;
  instruction: string;
  question: string;
  correctAnswer: string;
  distractor0: string;
  distractor1: string;
  distractor2?: string;
  hint: string;
}

/**
 * Validate that the correctAnswer is mathematically consistent with racer data.
 * Returns true if valid, false if the answer contradicts the physics.
 */
function validateChallenge(c: ChallengeCandidate): boolean {
  const racers = c.racers;
  if (!racers || racers.length < 2) return false;

  const answer = c.correctAnswer.toLowerCase();
  const fastest = racers.reduce((a, b) => (b.speed > a.speed ? b : a));
  const slowest = racers.reduce((a, b) => (b.speed < a.speed ? b : a));

  switch (c.type) {
    case 'observe':
    case 'predict': {
      // If the question is about who wins/is fastest, the answer must mention the fastest racer
      const winKeywords = ['win', 'first', 'fastest', 'quickest', 'ahead'];
      const loseKeywords = ['last', 'slowest', 'behind', 'lose'];
      const mentionsWin = winKeywords.some(k => c.question.toLowerCase().includes(k));
      const mentionsLose = loseKeywords.some(k => c.question.toLowerCase().includes(k));

      if (mentionsWin && !answer.toLowerCase().includes(fastest.name.toLowerCase())) {
        console.warn(`[RaceTrackLab] Validation fail: answer "${c.correctAnswer}" doesn't name fastest racer "${fastest.name}" for win question`);
        return false;
      }
      if (mentionsLose && !answer.toLowerCase().includes(slowest.name.toLowerCase())) {
        console.warn(`[RaceTrackLab] Validation fail: answer "${c.correctAnswer}" doesn't name slowest racer "${slowest.name}" for lose question`);
        return false;
      }
      return true;
    }
    case 'measure': {
      // distance = speed * timeLimit — validate that the answer is consistent
      if (!c.timeLimit) return true; // Can't validate without timeLimit
      // Just check that the answer references the correct racer for "who went farthest"
      const farthestKeywords = ['farthest', 'most', 'farther', 'longest', 'greatest'];
      if (farthestKeywords.some(k => c.question.toLowerCase().includes(k))) {
        if (!answer.toLowerCase().includes(fastest.name.toLowerCase())) {
          console.warn(`[RaceTrackLab] Validation fail: measure answer doesn't name fastest racer for distance question`);
          return false;
        }
      }
      return true;
    }
    case 'calculate': {
      // Validate numeric answers if present
      if (!c.timeLimit) return true;
      // Check if answer contains a number — try to verify it
      const numMatch = c.correctAnswer.match(/(\d+(\.\d+)?)/);
      if (numMatch) {
        const answerNum = parseFloat(numMatch[1]);
        // Check if this number matches any racer's speed, distance, or time
        const validNumbers = racers.flatMap(r => [
          r.speed,
          r.speed * c.timeLimit!,
          c.trackLength / r.speed,
        ]);
        const tolerance = 0.5;
        const matchesAny = validNumbers.some(v => Math.abs(v - answerNum) <= tolerance);
        if (!matchesAny) {
          console.warn(`[RaceTrackLab] Validation fail: calculate answer number ${answerNum} doesn't match any derived value`);
          return false;
        }
      }
      return true;
    }
    case 'graph': {
      // Graph questions about slope — steeper = faster
      const steepKeywords = ['steep', 'slope', 'fastest', 'quickest'];
      if (steepKeywords.some(k => c.question.toLowerCase().includes(k))) {
        if (!answer.toLowerCase().includes(fastest.name.toLowerCase())) {
          console.warn(`[RaceTrackLab] Validation fail: graph answer doesn't name fastest racer for slope question`);
          return false;
        }
      }
      return true;
    }
    default:
      return true;
  }
}

// ============================================================================
// CHALLENGE TYPE DISTRIBUTION
// ============================================================================

function getTypeDistribution(
  grade: string,
  numChallenges: number,
  allowedTypes?: string[],
): RaceTrackChallengeType[] {
  const gradeNum = grade === 'K' ? 0 : parseInt(grade, 10) || 1;

  // Default distribution by grade
  let types: RaceTrackChallengeType[];
  if (gradeNum <= 0) {
    types = Array(numChallenges).fill('observe');
  } else if (gradeNum === 1) {
    types = (['observe', 'observe', 'predict', 'predict'] as RaceTrackChallengeType[]).slice(0, numChallenges);
  } else if (gradeNum === 2) {
    types = (['predict', 'predict', 'measure', 'measure'] as RaceTrackChallengeType[]).slice(0, numChallenges);
  } else if (gradeNum === 3) {
    types = (['measure', 'measure', 'calculate', 'calculate', 'measure'] as RaceTrackChallengeType[]).slice(0, numChallenges);
  } else if (gradeNum === 4) {
    types = (['calculate', 'calculate', 'graph', 'calculate', 'graph'] as RaceTrackChallengeType[]).slice(0, numChallenges);
  } else {
    types = (['predict', 'measure', 'calculate', 'graph', 'calculate', 'graph'] as RaceTrackChallengeType[]).slice(0, numChallenges);
  }

  // If eval mode constrains types, override
  if (allowedTypes && allowedTypes.length > 0) {
    const validTypes = allowedTypes.filter(t =>
      ALL_CHALLENGE_TYPES.includes(t as RaceTrackChallengeType),
    ) as RaceTrackChallengeType[];
    if (validTypes.length > 0) {
      types = types.map(() => validTypes[Math.floor(Math.random() * validTypes.length)]);
    }
  }

  return types;
}

// ============================================================================
// GENERATOR FUNCTION
// ============================================================================

type RaceTrackLabConfig = Partial<{
    targetEvalMode?: string;
    /** Per-component support tier from the manifest ('easy'|'medium'|'hard').
     *  Second axis: difficulty = how much scaffolding within the mode. NEVER changes numbers. */
    difficulty?: string;
  }>;

export const generateRaceTrackLab = async (
  ctx: GenerationContext,
): Promise<RaceTrackLabData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as RaceTrackLabConfig;
  // Parse grade
  const gradeMatch = gradeLevel.match(/grade\s*(\d|K)/i)?.[1]?.toUpperCase() || '1';
  const validGrades = ['K', '1', '2', '3', '4', '5'];
  const finalGrade = validGrades.includes(gradeMatch) ? gradeMatch : '1';
  const gradeConfig = GRADE_CONFIGS[finalGrade] || GRADE_CONFIGS['1'];

  // Resolve eval mode constraint
  const evalConstraint = resolveEvalModeConstraint(
    'race-track-lab',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  const allowedTypes = evalConstraint?.allowedTypes;

  // ── Within-mode support tier (config.difficulty): scaffolding level, NOT numbers.
  //    pinnedType drives prompt TONE only when exactly one eval mode is pinned;
  //    the actual withdrawal is applied per-challenge at the end (so blended/auto
  //    sessions get difficulty too — the tier is a student property). ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType: RaceTrackChallengeType | undefined =
    evalConstraint && evalConstraint.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as RaceTrackChallengeType)
      : undefined;
  const tierScaffold = pinnedType && supportTier
    ? resolveSupportStructure(pinnedType, supportTier)
    : null;
  // Axis 2 (structural difficulty) prompt lines — merged with axis 1's into ONE
  // coherent "what 'hard' means here" block, both driven by the SAME tier enum.
  const speedBand = resolveSpeedBand(finalGrade);
  const tierShape = pinnedType && supportTier
    ? resolveProblemShape(pinnedType, supportTier, speedBand)
    : null;
  const tierPromptLines = [
    ...(tierScaffold ? tierScaffold.promptLines : []),
    ...(tierShape ? tierShape.promptLines : []),
  ];
  const tierSection = tierPromptLines.length
    ? `\n## WITHIN-MODE DIFFICULTY TIER (scaffolding + problem shape — NOT number size)\n${tierPromptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  // Determine challenge types and pre-build racer assignments
  const typeDistribution = getTypeDistribution(finalGrade, gradeConfig.numChallenges, allowedTypes);

  // Pre-build deterministic racer/speed assignments for each challenge.
  // STRUCTURAL DIFFICULTY (axis 2): when a tier is active we re-select speeds so
  // the top-two GAP hits the tier's target and bias the racer count, per the
  // challenge's OWN type (so blended/auto sessions are shaped too). Gated on
  // supportTier → the no-tier path is BYTE-IDENTICAL to before this skill ran.
  const challengeSetups = typeDistribution.map((type, i) => {
    const bandRacerCount = gradeConfig.racerCounts[i] || 2;

    // Resolve the effective racer count: no-tier keeps the band value exactly.
    let racerCount = bandRacerCount;
    let speeds: number[];
    if (supportTier) {
      const shape = resolveProblemShape(type, supportTier, speedBand);
      // Bias the count within the grade band [2, bandRacerCount] (floor 2 = a
      // determinate winner; cap = the grade's per-challenge band, never above).
      racerCount =
        shape.racerCountBias === 'min'
          ? 2
          : shape.racerCountBias === 'max'
            ? bandRacerCount
            : Math.max(2, Math.min(bandRacerCount, Math.round((2 + bandRacerCount) / 2)));
      // Distinct integer speeds with the EXACT top-two gap, all in band.
      speeds = shuffle(buildSpeedsWithGap(racerCount, shape.targetGap, speedBand));
    } else {
      speeds = assignSpeeds(racerCount, finalGrade, type);
    }

    const templates = pickRacers(racerCount);
    const racers: Racer[] = templates.map((t, j) => ({
      name: t.name,
      emoji: t.emoji,
      speed: speeds[j],
      color: t.color,
    }));

    // Determine timeLimit for types that need it
    let timeLimit: number | null = null;
    if (type === 'measure' || type === 'calculate' || type === 'graph') {
      // Pick a timeLimit that produces clean numbers
      const maxSpeed = Math.max(...speeds);
      // Time for fastest racer to cover ~75% of track
      const idealTime = Math.round((gradeConfig.trackLength * 0.75) / maxSpeed);
      timeLimit = Math.max(2, Math.min(10, idealTime));
    }

    return { type, racers, trackLength: gradeConfig.trackLength, timeLimit };
  });

  // Build the prompt with racer context so Gemini writes questions referencing correct names
  const challengeDescriptions = challengeSetups.map((setup, i) => {
    const racerList = setup.racers
      .map(r => `${r.name} ${r.emoji} (speed: ${r.speed} sq/s)`)
      .join(', ');
    const fastest = setup.racers.reduce((a, b) => (b.speed > a.speed ? b : a));
    const slowest = setup.racers.reduce((a, b) => (b.speed < a.speed ? b : a));

    let typeHint = '';
    if (setup.type === 'observe') {
      typeHint = `The winner is ${fastest.name}. Ask about who won or was fastest.`;
    } else if (setup.type === 'predict') {
      typeHint = `The winner will be ${fastest.name}. Ask student to predict the winner before the race.`;
    } else if (setup.type === 'measure') {
      const distances = setup.racers.map(r => `${r.name}: ${r.speed * setup.timeLimit!} squares`).join(', ');
      typeHint = `Race runs for ${setup.timeLimit}s. Distances: ${distances}. Ask who traveled farthest or compare distances.`;
    } else if (setup.type === 'calculate') {
      const distances = setup.racers.map(r => `${r.name}: ${r.speed * setup.timeLimit!} squares in ${setup.timeLimit}s`).join(', ');
      typeHint = `Track: ${setup.trackLength} squares. Time: ${setup.timeLimit}s. Data: ${distances}. Ask student to compute speed = distance/time or distance = speed*time.`;
    } else if (setup.type === 'graph') {
      typeHint = `Positions over ${setup.timeLimit}s shown as graph. ${fastest.name} has steepest slope. ${slowest.name} has shallowest. Ask about slope interpretation.`;
    }

    return `Challenge ${i + 1} (type: "${setup.type}"):\n  Racers: ${racerList}\n  Track: ${setup.trackLength} squares${setup.timeLimit ? `, Time limit: ${setup.timeLimit}s` : ''}\n  ${typeHint}`;
  }).join('\n\n');

  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create a Race Track Lab activity for Grade ${finalGrade} students about speed, distance, and time.

Topic: ${topic}
Grade Guidance: ${gradeConfig.guidance}

${challengeTypeSection}
${tierSection}
I have pre-assigned racers and speeds for each challenge. Write the instruction, question, correctAnswer, distractors, and hint for EACH challenge. The correctAnswer MUST be mathematically correct based on the racer data below.

${challengeDescriptions}

RULES:
- NEVER reveal the answer in the instruction text.
- The correctAnswer must reference the correct racer name.
- Distractors must be plausible but wrong (e.g., name a different racer, give a wrong number).
- Use warm, age-appropriate language for Grade ${finalGrade}.
- For calculate type: include the actual number in the correctAnswer (e.g., "6 squares per second").
- For graph type: reference slope in the hint.
- Generate EXACTLY ${gradeConfig.numChallenges} challenges in the challenges array.
`;

  logEvalModeResolution('RaceTrackLab', config?.targetEvalMode, evalConstraint);

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: batchSchema,
      },
    });

    const raw = JSON.parse(result.text || '{}');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawChallenges: any[] = raw.challenges || [];

    // Merge Gemini's text with our deterministic racer data
    let rejectedCount = 0;
    const challenges: (RaceChallenge | null)[] = challengeSetups.map((setup, i) => {
      const gemini = rawChallenges[i];
      if (!gemini) {
        console.warn(`[RaceTrackLab] No Gemini output for challenge ${i}`);
        rejectedCount++;
        return null;
      }

      // Validate required text fields from Gemini
      if (!gemini.instruction || !gemini.question || !gemini.correctAnswer || !gemini.distractor0 || !gemini.distractor1) {
        console.warn(`[RaceTrackLab] Rejecting challenge ${i}: missing required text fields`);
        rejectedCount++;
        return null;
      }

      const candidate: ChallengeCandidate = {
        type: setup.type,
        racers: setup.racers,
        trackLength: setup.trackLength,
        timeLimit: setup.timeLimit,
        instruction: gemini.instruction,
        question: gemini.question,
        correctAnswer: gemini.correctAnswer,
        distractor0: gemini.distractor0,
        distractor1: gemini.distractor1,
        distractor2: gemini.distractor2 && gemini.distractor2.trim() !== '' ? gemini.distractor2 : undefined,
        hint: gemini.hint || 'Think about speed, distance, and time!',
      };

      // Post-validate mathematical correctness
      if (!validateChallenge(candidate)) {
        console.warn(`[RaceTrackLab] Rejecting challenge ${i}: failed math validation`);
        rejectedCount++;
        return null;
      }

      const challenge: RaceChallenge = {
        id: `c${i + 1}`,
        type: setup.type,
        instruction: candidate.instruction,
        racers: setup.racers,
        trackLength: setup.trackLength,
        question: candidate.question,
        correctAnswer: candidate.correctAnswer,
        distractor0: candidate.distractor0,
        distractor1: candidate.distractor1,
        hint: candidate.hint,
      };

      if (candidate.distractor2) {
        challenge.distractor2 = candidate.distractor2;
      }
      if (setup.timeLimit != null) {
        challenge.timeLimit = setup.timeLimit;
      }

      return challenge;
    });

    const validChallenges = challenges.filter((c): c is RaceChallenge => c !== null);

    if (rejectedCount > 0) {
      console.warn(`[RaceTrackLab] Rejected ${rejectedCount}/${challenges.length} challenges`);
    }

    if (validChallenges.length === 0) {
      console.error('[RaceTrackLab] All challenges rejected — using fallback');
      return buildFallback(finalGrade, config?.targetEvalMode, supportTier);
    }

    // ── Within-mode support tier: withdraw the display lever (speed readout)
    //    deterministically per challenge, from each challenge's OWN type, so a
    //    blended/auto session gets difficulty too. Gated ONLY on supportTier —
    //    NEVER on pinnedType. Runs last; it can only remove on-screen help and
    //    never touches a speed, a track, a time limit, or the answer. ──
    if (supportTier) {
      for (const ch of validChallenges) {
        const sc = resolveSupportStructure(ch.type, supportTier);
        ch.showSpeedLegend = sc.showSpeedLegend;
        // Structural axis was applied upstream (speeds re-selected before the
        // Gemini call so the answer is self-consistent). Log target vs actual.
        const sorted = [...ch.racers].map(r => r.speed).sort((a, b) => b - a);
        const actualGap = sorted.length >= 2 ? sorted[0] - sorted[1] : 0;
        const wantGap = resolveProblemShape(ch.type, supportTier, speedBand).targetGap;
        console.log(`[race-track-lab] ${ch.type} tier=${supportTier} racers=${ch.racers.length} gap target=${wantGap} actual=${actualGap}`);
      }
      console.log(`[race-track-lab] Difficulty tier "${supportTier}" applied per-challenge (${pinnedType ? 'single-mode ' + pinnedType : 'blended'})`);
    }

    return {
      title: raw.title || 'Race Track Lab',
      description: raw.description || 'Explore speed, distance, and time with exciting races!',
      ...(supportTier ? { supportTier } : {}),
      challenges: validChallenges,
    };
  } catch (error) {
    console.error('Error generating RaceTrackLab content:', error);
    return buildFallback(finalGrade, config?.targetEvalMode, supportTier);
  }
};

// ============================================================================
// FALLBACK — deterministic challenges when Gemini fails
// ============================================================================

function buildFallback(grade: string, targetEvalMode?: string, supportTier?: SupportTier | null): RaceTrackLabData {
  const mode = (targetEvalMode || 'observe') as RaceTrackChallengeType;
  const fallbackChallenges: RaceChallenge[] = [];

  if (mode === 'observe' || !targetEvalMode) {
    fallbackChallenges.push({
      id: 'f1',
      type: 'observe',
      instruction: 'Watch the race! Pay attention to who reaches the finish line first.',
      racers: [
        { name: 'Rocket Rabbit', emoji: '🐇', speed: 4, color: '#60A5FA' },
        { name: 'Turbo Turtle', emoji: '🐢', speed: 2, color: '#34D399' },
      ],
      trackLength: 10,
      question: 'Who won the race?',
      correctAnswer: 'Rocket Rabbit',
      distractor0: 'Turbo Turtle',
      distractor1: 'They tied',
      hint: 'The faster racer finishes first!',
    });
    fallbackChallenges.push({
      id: 'f2',
      type: 'observe',
      instruction: 'Three racers this time! Watch carefully and see who finishes first.',
      racers: [
        { name: 'Cheetah', emoji: '🐆', speed: 5, color: '#FBBF24' },
        { name: 'Bicycle', emoji: '🚲', speed: 3, color: '#A78BFA' },
        { name: 'Speedy Snail', emoji: '🐌', speed: 1, color: '#F97316' },
      ],
      trackLength: 10,
      question: 'Who was the fastest?',
      correctAnswer: 'Cheetah',
      distractor0: 'Bicycle',
      distractor1: 'Speedy Snail',
      hint: 'The fastest racer covers the most ground in the same time!',
    });
  }

  if (mode === 'predict') {
    fallbackChallenges.push({
      id: 'f1',
      type: 'predict',
      instruction: 'Rocket Rabbit moves at 4 squares per second. Turbo Turtle moves at 2 squares per second. Who do you think will win?',
      racers: [
        { name: 'Rocket Rabbit', emoji: '🐇', speed: 4, color: '#60A5FA' },
        { name: 'Turbo Turtle', emoji: '🐢', speed: 2, color: '#34D399' },
      ],
      trackLength: 10,
      question: 'Who will win the race?',
      correctAnswer: 'Rocket Rabbit',
      distractor0: 'Turbo Turtle',
      distractor1: 'They will tie',
      hint: 'A higher speed means covering more distance each second!',
    });
  }

  if (mode === 'measure') {
    fallbackChallenges.push({
      id: 'f1',
      type: 'measure',
      instruction: 'The race lasts 3 seconds. Watch how far each racer goes!',
      racers: [
        { name: 'Racing Car', emoji: '🏎️', speed: 4, color: '#EF4444' },
        { name: 'Skateboard', emoji: '🛹', speed: 2, color: '#F472B6' },
      ],
      trackLength: 15,
      timeLimit: 3,
      question: 'Who traveled the farthest in 3 seconds?',
      correctAnswer: 'Racing Car — it traveled 12 squares',
      distractor0: 'Skateboard — it traveled 6 squares',
      distractor1: 'They traveled the same distance',
      hint: 'Distance = speed times time. Multiply each speed by 3!',
    });
  }

  if (mode === 'calculate') {
    fallbackChallenges.push({
      id: 'f1',
      type: 'calculate',
      instruction: 'Horse traveled 15 squares in 3 seconds. What is Horse\'s speed?',
      racers: [
        { name: 'Horse', emoji: '🐴', speed: 5, color: '#A3E635' },
        { name: 'Penguin', emoji: '🐧', speed: 3, color: '#22D3EE' },
      ],
      trackLength: 15,
      timeLimit: 3,
      question: 'What is Horse\'s speed in squares per second?',
      correctAnswer: '5 squares per second',
      distractor0: '3 squares per second',
      distractor1: '15 squares per second',
      hint: 'Speed = distance divided by time. Divide 15 by 3!',
    });
  }

  if (mode === 'graph') {
    fallbackChallenges.push({
      id: 'f1',
      type: 'graph',
      instruction: 'Look at the position-time graph. Each line shows how far a racer traveled over time.',
      racers: [
        { name: 'Rocket', emoji: '🚀', speed: 6, color: '#38BDF8' },
        { name: 'Train', emoji: '🚂', speed: 3, color: '#FB923C' },
        { name: 'Bicycle', emoji: '🚲', speed: 4, color: '#A78BFA' },
      ],
      trackLength: 20,
      timeLimit: 4,
      question: 'Which racer has the steepest line on the graph?',
      correctAnswer: 'Rocket — steeper slope means faster speed',
      distractor0: 'Train — it has the flattest line',
      distractor1: 'Bicycle — it is in the middle',
      hint: 'On a position-time graph, a steeper slope means the racer is going faster!',
    });
  }

  // Ensure we always have at least one challenge
  if (fallbackChallenges.length === 0) {
    fallbackChallenges.push({
      id: 'f0',
      type: 'observe',
      instruction: 'Watch the race and see who wins!',
      racers: [
        { name: 'Rocket Rabbit', emoji: '🐇', speed: 3, color: '#60A5FA' },
        { name: 'Turbo Turtle', emoji: '🐢', speed: 1, color: '#34D399' },
      ],
      trackLength: 10,
      question: 'Who won the race?',
      correctAnswer: 'Rocket Rabbit',
      distractor0: 'Turbo Turtle',
      distractor1: 'They tied',
      hint: 'The faster racer reaches the end first!',
    });
  }

  // Apply the support-tier display lever per challenge (gated only on the tier).
  if (supportTier) {
    for (const ch of fallbackChallenges) {
      ch.showSpeedLegend = resolveSupportStructure(ch.type, supportTier).showSpeedLegend;
    }
  }

  return {
    title: 'Race Track Lab',
    description: 'Explore speed, distance, and time with exciting races!',
    ...(supportTier ? { supportTier } : {}),
    challenges: fallbackChallenges,
  };
}
