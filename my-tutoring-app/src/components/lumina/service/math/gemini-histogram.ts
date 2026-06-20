import { Type, Schema } from "@google/genai";
import {
  HistogramData,
  HistogramChallenge,
  HistogramChallengeType,
  HistogramShapeKind,
} from "../../primitives/visual-primitives/math/Histogram";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Per-mode instance counts — see PRD_WITHIN_MODE_INSTANCE_DENSITY.md §5a
// ---------------------------------------------------------------------------
// All histogram modes are T2 (single-step visual read or estimate). B4 sweep
// bumps every mode 4 → 5. Pool-service generation is free, so the bump is
// no-cost. TOPIC_POOL has 6 entries, so a count of 5 cycles cleanly without
// repeats per session.

const DEFAULT_INSTANCE_COUNT = 5; // T2 fallback
const MAX_INSTANCE_COUNT = 6;
const MIN_INSTANCE_COUNT = 3;

const COUNT_BY_MODE: Record<HistogramChallengeType, number> = {
  identify_shape: 5,   // T2 — B4 bump 4 → 5
  find_modal_bin: 5,   // T2 — B4 bump 4 → 5
  read_frequency: 5,   // T2 — B4 bump 4 → 5
  estimate_center: 5,  // T2 — B4 bump 4 → 5
};

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  identify_shape: {
    promptDoc:
      `"identify_shape": Student looks at a histogram and picks its distribution `
      + `shape (symmetric, right-skewed, left-skewed, bimodal, uniform). `
      + `Visual recognition, no calculation. Grades 6-7.`,
    schemaDescription: "'identify_shape' (recognize distribution shape)",
  },
  find_modal_bin: {
    promptDoc:
      `"find_modal_bin": Student picks which bin (range) on the histogram has `
      + `the highest frequency. The peak is unambiguous (a single tallest bar). `
      + `Grades 6-7.`,
    schemaDescription: "'find_modal_bin' (locate the tallest bar)",
  },
  read_frequency: {
    promptDoc:
      `"read_frequency": Student reads the frequency (count) of a specific bin `
      + `from the histogram. Numeric entry. Grades 6-8.`,
    schemaDescription: "'read_frequency' (count values in a given bin)",
  },
  estimate_center: {
    promptDoc:
      `"estimate_center": Student estimates the mean or median of the data from `
      + `the histogram visual. Stat panel is hidden so the answer isn't given. `
      + `Numeric entry with tolerance. Grades 7-8.`,
    schemaDescription: "'estimate_center' (estimate mean/median from visual)",
  },
};

// ---------------------------------------------------------------------------
// Support tiers — within-mode scaffolding + structural problem difficulty.
//
// This is a POOL-SERVICE generator: Gemini emits only the session wrapper
// (title / description / mode flag); every challenge's data + answer key is
// built deterministically below. So BOTH tier axes are enforced 100% in code
// (there is no per-challenge LLM output to prompt-shape — no tierSection is
// injected). Tier NEVER changes magnitude — same data ranges, same bins, same
// instance counts. It changes (a) how much on-screen help the workspace gives
// and (b) how structurally clear/ambiguous each problem is.
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

/**
 * Scaffolding axis ("how much help?") — withdraws on-screen aids at harder
 * tiers without touching the numbers. All three fields are display-only (none
 * is read by the component's answer checker), so withdrawing them is always
 * answer-safe.
 */
interface SupportScaffold {
  /** Count labels above each bar. Only meaningful where they aren't the answer
   *  (identify_shape / estimate_center); ALWAYS off for find_modal_bin &
   *  read_frequency regardless of tier (they'd reveal the answer). */
  showFrequencyLabels: boolean;
  /** The Count / Min / Max / Range panel. Off for estimate_center at every tier
   *  (it prints the center); withdrawn at hard for the rest. */
  showStatistics: boolean;
  /** Whether to attach the hint text. Hard withdraws it → the component shows
   *  no hint button (zero component change). */
  includeHint: boolean;
}

function resolveSupportStructure(
  mode: HistogramChallengeType,
  tier: SupportTier,
): SupportScaffold {
  const labelsAreAnswer = mode === 'find_modal_bin' || mode === 'read_frequency';
  const statsRevealAnswer = mode === 'estimate_center';
  return {
    showFrequencyLabels: labelsAreAnswer ? false : tier !== 'hard',
    showStatistics: statsRevealAnswer ? false : tier !== 'hard',
    includeHint: tier !== 'hard',
  };
}

/**
 * Structural axis ("how hard a problem?") — one in-mode lever per mode, all
 * about CLARITY / AMBIGUITY (the graph-data archetype lever), never magnitude:
 *  - identify_shape : how textbook-clean the shape reads (clear → subtle)
 *  - find_modal_bin : how dominant the peak is over the runner-up
 *  - read_frequency : whether the queried bin is a tall peak or a short tail
 *  - estimate_center: symmetric (mean≈median) → skewed (tail pulls the mean)
 * Every lever stays IN-MODE (same task identity); the answer key is recomputed
 * against the built data (see computeBinFreqs), so it can never desync.
 */
type ShapeClarity = 'clear' | 'moderate' | 'subtle';
type BinTargeting = 'peak' | 'mid' | 'tail' | 'any';

interface ProblemShape {
  shapeClarity: ShapeClarity;                 // identify_shape / read_frequency dataset
  modalFraction: number;                      // find_modal_bin — share of data in the peak bin
  modalMargin: number;                        // find_modal_bin — required strict-max margin (bars)
  binTargeting: BinTargeting;                 // read_frequency
  forceShape: 'symmetric' | 'skewed' | null;  // estimate_center
}

function resolveProblemShape(tier: SupportTier): ProblemShape {
  switch (tier) {
    case 'easy':
      return { shapeClarity: 'clear',    modalFraction: 0.52, modalMargin: 3, binTargeting: 'peak', forceShape: 'symmetric' };
    case 'medium':
      return { shapeClarity: 'moderate', modalFraction: 0.42, modalMargin: 2, binTargeting: 'mid',  forceShape: null };
    case 'hard':
      return { shapeClarity: 'subtle',   modalFraction: 0.32, modalMargin: 1, binTargeting: 'tail', forceShape: 'skewed' };
  }
}

/** No-tier path — reproduces the historical behavior so an un-tiered
 *  generation is unchanged (legacy 0.45 peak, random bin pick, mixed shapes). */
const DEFAULT_SHAPE: ProblemShape = {
  shapeClarity: 'moderate',
  modalFraction: 0.45,
  modalMargin: 1,
  binTargeting: 'any',
  forceShape: null,
};

/** A computed bin (start/end/count) — local mirror of the component's Bin. */
interface Bin {
  start: number;
  end: number;
  count: number;
}

/**
 * Mirror of the component's `computeBins` so the generator can recompute the
 * EXACT bars the student will see — used to (a) pin find_modal_bin's expected
 * bin to the actual tallest bar (answer can't desync, Gotcha #1) and (b) target
 * read_frequency bins by their real height.
 */
function computeBinFreqs(data: number[], binWidth: number, binStart: number): Bin[] {
  if (data.length === 0 || binWidth <= 0) return [];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const effectiveStart = binStart <= min ? binStart : Math.floor(min / binWidth) * binWidth;
  const effectiveEnd = Math.ceil((max - effectiveStart) / binWidth) * binWidth + effectiveStart;
  const numBins = Math.max(1, Math.ceil((effectiveEnd - effectiveStart) / binWidth));
  const out: Bin[] = [];
  for (let i = 0; i < numBins; i++) {
    const start = effectiveStart + i * binWidth;
    const end = start + binWidth;
    out.push({ start, end, count: data.filter((v) => v >= start && v < end).length });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const randInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const shuffle = <T,>(arr: readonly T[]): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

const round1 = (v: number): number => Math.round(v * 10) / 10;

/** Snap a value to the nearest binStart + k*binWidth. */
const snapToBin = (value: number, binStart: number, binWidth: number): number => {
  const offset = value - binStart;
  const snapped = Math.round(offset / binWidth) * binWidth + binStart;
  return snapped;
};

// ---------------------------------------------------------------------------
// Distribution builders — produce datasets with a clear shape signature.
//
// All builders are intentionally simple (rejection / inverse sampling against
// hand-tuned shapes) so the bin frequencies are visibly correct without needing
// a real PRNG seed for determinism.
// ---------------------------------------------------------------------------

/** Bell-shaped distribution clustered around `center`. */
function buildSymmetric(
  center: number,
  spread: number,
  min: number,
  max: number,
  n: number,
): number[] {
  const out: number[] = [];
  // Manual symmetric weight buckets: heavier near center.
  for (let i = 0; i < n; i++) {
    // Box–Muller-ish without the trig: average two uniforms ≈ triangular.
    const u1 = Math.random();
    const u2 = Math.random();
    const z = (u1 + u2 - 1) * 2; // approx range [-2, 2]
    const v = clamp(Math.round(center + z * spread), min, max);
    out.push(v);
  }
  return out;
}

/** Right-skewed: long tail to the right. `exp` tunes skew strength (structural
 *  clarity lever): higher = stronger/cleaner skew, lower = milder. 2 = legacy. */
function buildRightSkewed(min: number, max: number, n: number, exp = 2): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = Math.random();
    // u^exp biases mass to the low end, with a thin right tail.
    const t = Math.pow(u, exp);
    const v = clamp(Math.round(min + t * (max - min)), min, max);
    out.push(v);
  }
  return out;
}

/** Left-skewed: long tail to the left. `exp` tunes skew strength (2 = legacy). */
function buildLeftSkewed(min: number, max: number, n: number, exp = 2): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = Math.random();
    const t = 1 - Math.pow(1 - u, exp);
    const v = clamp(Math.round(min + t * (max - min)), min, max);
    out.push(v);
  }
  return out;
}

/** Bimodal: two peaks separated by a visible valley. */
function buildBimodal(
  peak1: number,
  peak2: number,
  spread: number,
  min: number,
  max: number,
  n: number,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const center = Math.random() < 0.5 ? peak1 : peak2;
    const u1 = Math.random();
    const u2 = Math.random();
    const z = (u1 + u2 - 1) * 2;
    const v = clamp(Math.round(center + z * spread), min, max);
    out.push(v);
  }
  return out;
}

/** Uniform: roughly equal frequency across bins. */
function buildUniform(min: number, max: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(randInt(min, max));
  }
  return out;
}

/** A dataset with a single clear modal bin at `modalCenter`. `modalFraction`
 *  controls peak dominance (structural lever): higher = more towering peak. */
function buildClearMode(
  modalCenter: number,
  binWidth: number,
  min: number,
  max: number,
  n: number,
  modalFraction = 0.45,
): number[] {
  // Concentrate `modalFraction` of the data inside the modal bin, distribute
  // the remainder uniformly with a slight bias away from the mode.
  const out: number[] = [];
  const modalLo = modalCenter - binWidth / 2;
  const modalHi = modalCenter + binWidth / 2 - 1;
  const modalCount = Math.round(n * modalFraction);
  for (let i = 0; i < modalCount; i++) {
    out.push(clamp(randInt(Math.ceil(modalLo), Math.floor(modalHi)), min, max));
  }
  // Spread the rest with a slight bias away from the mode so the peak stands out.
  for (let i = 0; i < n - modalCount; i++) {
    let v = randInt(min, max);
    if (v >= modalLo && v <= modalHi) {
      v = Math.random() < 0.5 ? Math.max(min, v - binWidth) : Math.min(max, v + binWidth);
    }
    out.push(v);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Topic pool — surface-detail variance (each session picks distinct topics)
// ---------------------------------------------------------------------------

interface TopicTemplate {
  context: string;          // e.g. "Math quiz scores"
  xAxisLabel: string;       // axis label
  unit: string;             // singular unit name for prompts (e.g. "score")
  min: number;
  max: number;
  binWidth: number;
}

const TOPIC_POOL: readonly TopicTemplate[] = [
  { context: 'Math quiz scores',         xAxisLabel: 'Score',                 unit: 'score',       min: 0,   max: 100, binWidth: 10 },
  { context: 'Heights of seventh graders', xAxisLabel: 'Height (cm)',         unit: 'cm',          min: 130, max: 180, binWidth: 5  },
  { context: 'Daily high temperatures',  xAxisLabel: 'Temperature (°F)',     unit: 'degree',      min: 40,  max: 100, binWidth: 10 },
  { context: 'Minutes spent on homework',xAxisLabel: 'Minutes',              unit: 'minute',      min: 0,   max: 90,  binWidth: 10 },
  { context: 'Reaction times',           xAxisLabel: 'Time (tenths of sec)', unit: 'tenth-second',min: 1,   max: 20,  binWidth: 2  },
  { context: 'Books read this year',     xAxisLabel: 'Books',                unit: 'book',        min: 0,   max: 30,  binWidth: 5  },
];

// ---------------------------------------------------------------------------
// Pool service — per-mode challenge construction
// ---------------------------------------------------------------------------

const SHAPE_OPTIONS: readonly HistogramShapeKind[] = [
  'symmetric',
  'right-skewed',
  'left-skewed',
  'bimodal',
  'uniform',
];

function buildDataForShape(
  shape: HistogramShapeKind,
  topic: TopicTemplate,
  n: number,
  clarity: ShapeClarity = 'moderate',
): number[] {
  const { min, max } = topic;
  const span = max - min;
  switch (shape) {
    case 'symmetric': {
      // clear = tight bell; subtle = broad (closer to flat) but still peaked.
      const spread = clarity === 'clear' ? span / 6 : clarity === 'subtle' ? span / 4 : span / 5;
      return buildSymmetric(min + span / 2, spread, min, max, n);
    }
    case 'right-skewed': {
      const exp = clarity === 'clear' ? 2.4 : clarity === 'subtle' ? 1.6 : 2.0;
      return buildRightSkewed(min, max, n, exp);
    }
    case 'left-skewed': {
      const exp = clarity === 'clear' ? 2.4 : clarity === 'subtle' ? 1.6 : 2.0;
      return buildLeftSkewed(min, max, n, exp);
    }
    case 'bimodal': {
      // clear = peaks far apart with a deep valley; subtle = closer, shallower.
      const lo = clarity === 'clear' ? 0.2 : clarity === 'subtle' ? 0.3 : 0.25;
      const spread = clarity === 'clear' ? span / 10 : clarity === 'subtle' ? span / 7 : span / 8;
      return buildBimodal(min + span * lo, min + span * (1 - lo), spread, min, max, n);
    }
    case 'uniform':
      // Kept clean at every tier — a "subtle" uniform reads as symmetric, which
      // would make the labeled answer genuinely ambiguous (shape IS the answer).
      return buildUniform(min, max, n);
  }
}

interface ChallengeBuildResult {
  challenge: HistogramChallenge;
  /** Logged for debugging — concise per-challenge summary. */
  summary: string;
}

function buildIdentifyShape(
  topic: TopicTemplate,
  idx: number,
  forcedShape?: HistogramShapeKind,
  clarity: ShapeClarity = 'moderate',
): ChallengeBuildResult {
  const shape = forcedShape ?? SHAPE_OPTIONS[idx % SHAPE_OPTIONS.length];
  const n = randInt(25, 40);
  const data = buildDataForShape(shape, topic, n, clarity);
  return {
    challenge: {
      id: `hg-${idx + 1}`,
      challengeType: 'identify_shape',
      data,
      binWidth: topic.binWidth,
      binStart: topic.min,
      contextTitle: topic.context,
      xAxisLabel: topic.xAxisLabel,
      yAxisLabel: 'Frequency',
      prompt: `Which best describes the shape of this distribution?`,
      shapeOptions: [...SHAPE_OPTIONS],
      expectedShape: shape,
      hint: `Look at where the bars are tallest and where the tails fall off. ` +
            `A single peak in the middle is symmetric; two peaks is bimodal; ` +
            `a long tail to one side is skewed in that direction.`,
    },
    summary: `[identify_shape] ${topic.context} → ${shape} (n=${n})`,
  };
}

function buildFindModalBin(
  topic: TopicTemplate,
  idx: number,
  shape: ProblemShape = DEFAULT_SHAPE,
): ChallengeBuildResult {
  const n = randInt(25, 40);
  // Pick a modal bin index that's not at either end (so the peak is unambiguous).
  const numBins = Math.floor((topic.max - topic.min) / topic.binWidth);

  // Build until the peak is the STRICT tallest bar by the tier's margin, then
  // pin the answer key to the ACTUAL tallest bar the student will see — the
  // recompute guarantees the labeled bin can't desync from the rendered bars
  // even as the peak gets subtler at harder tiers (Gotcha #1, answer-bearing).
  let data: number[] = [];
  let bins: Bin[] = [];
  let modalIdx = 0;
  for (let attempt = 0; attempt < 8; attempt++) {
    const modalBin = randInt(1, Math.max(1, numBins - 2));
    const modalCenter = topic.min + modalBin * topic.binWidth + topic.binWidth / 2;
    data = buildClearMode(modalCenter, topic.binWidth, topic.min, topic.max, n, shape.modalFraction);
    bins = computeBinFreqs(data, topic.binWidth, topic.min);
    const counts = bins.map((b) => b.count).sort((a, b) => b - a);
    const bestCount = counts[0] ?? 0;
    const second = counts[1] ?? 0;
    modalIdx = bins.findIndex((b) => b.count === bestCount);
    if (bestCount - second >= shape.modalMargin) break; // strict peak by margin
  }
  const modalBinObj = bins[modalIdx] ?? { start: topic.min, end: topic.min + topic.binWidth, count: 0 };
  const expectedBinStart = modalBinObj.start;
  const expectedBinEnd = modalBinObj.end;
  return {
    challenge: {
      id: `hg-${idx + 1}`,
      challengeType: 'find_modal_bin',
      data,
      binWidth: topic.binWidth,
      binStart: topic.min,
      contextTitle: topic.context,
      xAxisLabel: topic.xAxisLabel,
      yAxisLabel: 'Frequency',
      prompt: `Which bin contains the most ${topic.unit} values?`,
      expectedBinStart,
      expectedBinEnd,
      hint: `Find the tallest bar. Its left edge is where that bin starts; ` +
            `the right edge is where it ends.`,
    },
    summary: `[find_modal_bin] ${topic.context} → [${expectedBinStart}, ${expectedBinEnd}) (n=${n})`,
  };
}

function buildReadFrequency(
  topic: TopicTemplate,
  idx: number,
  shape: ProblemShape = DEFAULT_SHAPE,
): ChallengeBuildResult {
  const n = randInt(25, 40);
  // Use a varied shape so frequencies are non-trivial.
  const shapes: HistogramShapeKind[] = ['symmetric', 'right-skewed', 'left-skewed'];
  const shapeKind = shapes[idx % shapes.length];
  const data = buildDataForShape(shapeKind, topic, n, shape.shapeClarity);
  const bins = computeBinFreqs(data, topic.binWidth, topic.min);

  // Structural lever: WHICH bin we query. easy = a tall peak bin (easy height
  // read); hard = a short tail bin (subtle read). 'any' = legacy random pick.
  // Either way the frequency is recomputed from the actual bar, so the answer
  // is always correct.
  let target: Bin;
  if (shape.binTargeting === 'any') {
    const numBins = Math.floor((topic.max - topic.min) / topic.binWidth);
    const ti = randInt(0, Math.max(0, numBins - 1));
    const start = topic.min + ti * topic.binWidth;
    target = bins.find((b) => b.start === start)
      ?? { start, end: start + topic.binWidth, count: data.filter((v) => v >= start && v < start + topic.binWidth).length };
  } else {
    const nonEmpty = bins.filter((b) => b.count > 0);
    const pool = nonEmpty.length > 0 ? nonEmpty : bins;
    const byHeightDesc = [...pool].sort((a, b) => b.count - a.count);
    target =
      shape.binTargeting === 'peak'
        ? byHeightDesc[0]
        : shape.binTargeting === 'tail'
          ? byHeightDesc[byHeightDesc.length - 1]
          : byHeightDesc[Math.floor(byHeightDesc.length / 2)];
  }
  const targetBinStart = target.start;
  const targetBinEnd = target.end;
  const targetFrequency = target.count;
  return {
    challenge: {
      id: `hg-${idx + 1}`,
      challengeType: 'read_frequency',
      data,
      binWidth: topic.binWidth,
      binStart: topic.min,
      contextTitle: topic.context,
      xAxisLabel: topic.xAxisLabel,
      yAxisLabel: 'Frequency',
      prompt: `How many values fall in the bin [${targetBinStart}, ${targetBinEnd})?`,
      targetBinStart,
      targetBinEnd,
      targetFrequency,
      hint: `Find the bar covering ${targetBinStart} to ${targetBinEnd}. ` +
            `Its height is the frequency you're looking for.`,
    },
    summary: `[read_frequency] ${topic.context} → bin [${targetBinStart},${targetBinEnd}) = ${targetFrequency} (n=${n})`,
  };
}

function buildEstimateCenter(
  topic: TopicTemplate,
  idx: number,
  shape: ProblemShape = DEFAULT_SHAPE,
): ChallengeBuildResult {
  const n = randInt(25, 40);
  // Structural lever: easy = symmetric (mean ≈ median ≈ visual center, an easy
  // balance-point read); hard = skewed (the tail pulls the mean off the peak, so
  // the student must reason about it). 'null' = legacy mix.
  let shapeKind: HistogramShapeKind;
  if (shape.forceShape === 'symmetric') {
    shapeKind = 'symmetric';
  } else if (shape.forceShape === 'skewed') {
    shapeKind = idx % 2 === 0 ? 'right-skewed' : 'left-skewed';
  } else {
    const shapes: HistogramShapeKind[] = ['symmetric', 'right-skewed', 'left-skewed', 'symmetric'];
    shapeKind = shapes[idx % shapes.length];
  }
  const data = buildDataForShape(shapeKind, topic, n, shape.shapeClarity);
  // Use mean (rounded) as the target. Snap to the nearest bin tick for cleaner UX.
  const rawMean = data.reduce((a, b) => a + b, 0) / data.length;
  const snappedMean = snapToBin(rawMean, topic.min, topic.binWidth);
  const targetStatistic: 'mean' | 'median' = idx % 2 === 0 ? 'mean' : 'median';
  let targetAnswer: number;
  if (targetStatistic === 'mean') {
    targetAnswer = snappedMean;
  } else {
    const sorted = [...data].sort((a, b) => a - b);
    const mid = sorted.length / 2;
    targetAnswer = sorted.length % 2 === 0
      ? snapToBin((sorted[mid - 1] + sorted[mid]) / 2, topic.min, topic.binWidth)
      : sorted[Math.floor(mid)];
  }
  // Tolerance: one bin width on either side.
  const tolerance = topic.binWidth;
  return {
    challenge: {
      id: `hg-${idx + 1}`,
      challengeType: 'estimate_center',
      data,
      binWidth: topic.binWidth,
      binStart: topic.min,
      contextTitle: topic.context,
      xAxisLabel: topic.xAxisLabel,
      yAxisLabel: 'Frequency',
      prompt: `Estimate the ${targetStatistic} (in ${topic.xAxisLabel.toLowerCase()}) of this data.`,
      targetStatistic,
      targetAnswer: round1(targetAnswer),
      tolerance,
      hint: targetStatistic === 'mean'
        ? `The mean is roughly the "balance point" of the histogram. ` +
          `Where would the bars balance if they were stacked on a seesaw?`
        : `The median splits the data in half. ` +
          `Find the value where half the bars are to the left and half to the right.`,
    },
    summary: `[estimate_center:${targetStatistic}] ${topic.context} → ${round1(targetAnswer)} ± ${tolerance} (n=${n})`,
  };
}

/**
 * Deterministically select N histogram challenges for the given mode.
 *
 * Guarantees:
 * - All challenges use distinct topic contexts (no duplicate topics per session).
 * - For identify_shape: shapes vary across challenges (no duplicates).
 * - Bin width and dataset size fall within the topic's pedagogical range.
 *
 * `tier` (when present) drives the STRUCTURAL difficulty axis — each builder
 * uses it to shape clarity / peak dominance / queried bin / center shape.
 * Null reproduces the historical (un-tiered) behavior.
 */
function selectHistogramChallenges(
  mode: HistogramChallengeType,
  count: number,
  tier: SupportTier | null,
): HistogramChallenge[] {
  const target = clamp(count, MIN_INSTANCE_COUNT, MAX_INSTANCE_COUNT);
  const topics = shuffle(TOPIC_POOL).slice(0, target);
  // Pad if pool is smaller than target (shouldn't happen with 6 topics).
  while (topics.length < target) {
    topics.push(TOPIC_POOL[topics.length % TOPIC_POOL.length]);
  }

  const shapeParams = tier ? resolveProblemShape(tier) : DEFAULT_SHAPE;
  const out: HistogramChallenge[] = [];
  const summaries: string[] = [];

  // For identify_shape, force distinct shapes across challenges (computed once).
  const distinctShapes = shuffle(SHAPE_OPTIONS).slice(0, target);
  while (distinctShapes.length < target) {
    distinctShapes.push(SHAPE_OPTIONS[distinctShapes.length % SHAPE_OPTIONS.length]);
  }

  topics.forEach((topic, idx) => {
    let result: ChallengeBuildResult;
    switch (mode) {
      case 'identify_shape':
        result = buildIdentifyShape(topic, idx, distinctShapes[idx], shapeParams.shapeClarity);
        break;
      case 'find_modal_bin':
        result = buildFindModalBin(topic, idx, shapeParams);
        break;
      case 'read_frequency':
        result = buildReadFrequency(topic, idx, shapeParams);
        break;
      case 'estimate_center':
        result = buildEstimateCenter(topic, idx, shapeParams);
        break;
    }
    out.push(result.challenge);
    summaries.push(result.summary);
  });

  console.log(`[Histogram] ${mode} session: ${out.length} challenges → ${summaries.join(' | ')}`);
  return out;
}

// ---------------------------------------------------------------------------
// Gemini wrapper schema — title + description + session-level mode flag only.
// Per-challenge data is built locally from the pool service.
// ---------------------------------------------------------------------------

const histogramSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    challengeType: {
      type: Type.STRING,
      description:
        "Challenge type: 'identify_shape', 'find_modal_bin', 'read_frequency', or 'estimate_center'.",
      enum: ['identify_shape', 'find_modal_bin', 'read_frequency', 'estimate_center'],
    },
    title: {
      type: Type.STRING,
      description: "Short session title, e.g. 'Reading Histograms'.",
    },
    description: {
      type: Type.STRING,
      description: "One-sentence student-facing description of what the session covers.",
    },
    gradeBand: {
      type: Type.STRING,
      description: "One of: '6-7', '7-8'.",
    },
  },
  required: ['challengeType', 'title', 'description', 'gradeBand'],
};

// ---------------------------------------------------------------------------
// Public generator
// ---------------------------------------------------------------------------

/**
 * Generate histogram data for an interactive distribution-analysis SESSION
 * (3-6 distinct histograms, walked sequentially).
 *
 * Pool-service multi-instance pattern per PRD_WITHIN_MODE_INSTANCE_DENSITY §6a #1:
 * - Gemini emits only the wrapper (title, description, mode flag).
 * - `selectHistogramChallenges` deterministically picks N distinct challenges.
 * - Per-mode dataset builders enforce pedagogical clarity (clear shape, clean
 *   modal bin, non-trivial target frequency, snapped target center).
 */
export const generateHistogram = async (
  topic: string,
  gradeLevel: string,
  config?: {
    targetEvalMode?: string;
    instanceCount?: number;
    gradeBand?: '6-7' | '7-8';
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which skill,
     * difficulty = how much on-screen scaffolding + how structurally clear the
     * problem is within it. NEVER changes numbers/magnitude.
     */
    difficulty?: string;
  },
): Promise<HistogramData> => {
  // ── Resolve eval mode ──
  const evalConstraint = resolveEvalModeConstraint(
    'histogram',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('Histogram', config?.targetEvalMode, evalConstraint);

  // ── Resolve the support tier (drives BOTH axes; null = grade-band defaults) ──
  const supportTier = normalizeSupportTier(config?.difficulty);

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(
        histogramSchema,
        evalConstraint.allowedTypes,
        CHALLENGE_TYPE_DOCS,
        { fieldName: 'challengeType', rootLevel: true },
      )
    : histogramSchema;

  // ── Resolve session instance count up-front so the prompt + description ──
  // ── stay consistent with what the pool service ultimately builds. ──
  const presumedChallengeType =
    (evalConstraint?.allowedTypes[0] as HistogramChallengeType | undefined) ?? 'identify_shape';
  const presumedModeCount = COUNT_BY_MODE[presumedChallengeType];
  const instanceCount = clamp(
    config?.instanceCount ?? presumedModeCount ?? DEFAULT_INSTANCE_COUNT,
    MIN_INSTANCE_COUNT,
    MAX_INSTANCE_COUNT,
  );

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create a histogram analysis SESSION for teaching "${topic}" to ${gradeLevel} students.

THE STUDENT EXPERIENCE:
- The student walks through ${instanceCount} distinct histograms, one at a time.
- Each histogram has its own dataset and context.
- For each histogram the student answers a single prompt (multiple-choice or
  numeric entry depending on mode), then advances to the next.

${challengeTypeSection}

YOUR JOB:
- Pick the session's mode flag ONLY (challengeType, gradeBand) and write a short
  title + one-sentence description.
- The component supplies the individual datasets, bin widths, contexts, and
  answer keys from a deterministic pool service. DO NOT invent dataset values,
  bin widths, contexts, or answer keys here.

GRADE GUIDELINES:
- Grades 6-7 (gradeBand "6-7"): identify_shape and find_modal_bin work well.
- Grades 7-8 (gradeBand "7-8"): read_frequency and estimate_center add numeric
  reading and rough quantitative reasoning.

Return only the session wrapper.
`;

  const result = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: activeSchema,
    },
  });

  const wrapper = result.text ? JSON.parse(result.text) : null;
  if (!wrapper) {
    throw new Error('No valid histogram wrapper returned from Gemini API');
  }

  // ── Sanitize wrapper ──
  const validChallengeTypes: HistogramChallengeType[] = [
    'identify_shape',
    'find_modal_bin',
    'read_frequency',
    'estimate_center',
  ];
  const challengeType: HistogramChallengeType =
    validChallengeTypes.includes(wrapper.challengeType)
      ? wrapper.challengeType
      : ((evalConstraint?.allowedTypes[0] as HistogramChallengeType | undefined) ?? 'identify_shape');

  const gradeBand: '6-7' | '7-8' = wrapper.gradeBand === '7-8' ? '7-8' : '6-7';

  const title = typeof wrapper.title === 'string' && wrapper.title.trim().length > 0
    ? wrapper.title
    : 'Reading Histograms';
  const description = typeof wrapper.description === 'string' && wrapper.description.trim().length > 0
    ? wrapper.description
    : `Walk through ${instanceCount} histograms — answer a question about each one.`;

  // ── Build challenges from the pool service ──
  // Recompute the count in case the wrapper produced a different challengeType
  // than the presumed one — keeps the count consistent with the actual mode.
  const resolvedCount =
    challengeType === presumedChallengeType
      ? instanceCount
      : clamp(
          config?.instanceCount ?? COUNT_BY_MODE[challengeType] ?? DEFAULT_INSTANCE_COUNT,
          MIN_INSTANCE_COUNT,
          MAX_INSTANCE_COUNT,
        );
  const challenges = selectHistogramChallenges(challengeType, resolvedCount, supportTier);

  // ── Apply the SCAFFOLDING axis (display-only, answer-safe) ──
  // Gated only on a tier being present — difficulty is a STUDENT property, so
  // every session (single-mode here) must honor it. Histogram sessions are
  // always single-mode (the pool service builds one challengeType), so resolving
  // the scaffold from the session mode applies it uniformly per challenge.
  const scaffold = supportTier ? resolveSupportStructure(challengeType, supportTier) : null;

  // Mode-specific display flags. Fallback (no tier) preserves historical
  // behavior: stats hidden only in estimate_center; freq labels shown for
  // identify_shape & estimate_center.
  const showStatistics = scaffold
    ? scaffold.showStatistics
    : challengeType !== 'estimate_center';
  const showFrequencyLabels = scaffold
    ? scaffold.showFrequencyLabels
    : challengeType === 'identify_shape' || challengeType === 'estimate_center';

  // Hard tier withdraws the hint → the component shows no hint button.
  if (scaffold && !scaffold.includeHint) {
    for (const ch of challenges) delete ch.hint;
  }

  if (supportTier) {
    console.log(
      `[Histogram] Support tier "${supportTier}" applied (mode ${challengeType}): ` +
        `stats=${showStatistics}, freqLabels=${showFrequencyLabels}, hint=${scaffold?.includeHint}, ` +
        `shape=${JSON.stringify(resolveProblemShape(supportTier))}`,
    );
  }

  return {
    title,
    description,
    challengeType,
    challenges,
    gradeBand: config?.gradeBand ?? gradeBand,
    showStatistics,
    showFrequencyLabels,
    supportTier: supportTier ?? undefined,
  };
};
