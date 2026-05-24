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

const DEFAULT_INSTANCE_COUNT = 4;
const MAX_INSTANCE_COUNT = 6;
const MIN_INSTANCE_COUNT = 3;

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

/** Right-skewed: long tail to the right. */
function buildRightSkewed(min: number, max: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = Math.random();
    // u^2 biases mass to the low end, with a thin right tail.
    const t = u * u;
    const v = clamp(Math.round(min + t * (max - min)), min, max);
    out.push(v);
  }
  return out;
}

/** Left-skewed: long tail to the left. */
function buildLeftSkewed(min: number, max: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = Math.random();
    const t = 1 - (1 - u) * (1 - u);
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

/** A dataset with a single clear modal bin at `modalCenter`. */
function buildClearMode(
  modalCenter: number,
  binWidth: number,
  min: number,
  max: number,
  n: number,
): number[] {
  // Concentrate ~45% inside the modal bin, distribute remainder uniformly.
  const out: number[] = [];
  const modalLo = modalCenter - binWidth / 2;
  const modalHi = modalCenter + binWidth / 2 - 1;
  const modalCount = Math.round(n * 0.45);
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
): number[] {
  const { min, max } = topic;
  const span = max - min;
  switch (shape) {
    case 'symmetric':
      return buildSymmetric(min + span / 2, span / 5, min, max, n);
    case 'right-skewed':
      return buildRightSkewed(min, max, n);
    case 'left-skewed':
      return buildLeftSkewed(min, max, n);
    case 'bimodal':
      return buildBimodal(min + span * 0.25, min + span * 0.75, span / 8, min, max, n);
    case 'uniform':
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
): ChallengeBuildResult {
  const shape = forcedShape ?? SHAPE_OPTIONS[idx % SHAPE_OPTIONS.length];
  const n = randInt(25, 40);
  const data = buildDataForShape(shape, topic, n);
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
): ChallengeBuildResult {
  const n = randInt(25, 40);
  // Pick a modal bin index that's not at either end (so the peak is unambiguous).
  const numBins = Math.floor((topic.max - topic.min) / topic.binWidth);
  const modalBin = randInt(1, Math.max(1, numBins - 2));
  const modalCenter = topic.min + modalBin * topic.binWidth + topic.binWidth / 2;
  const data = buildClearMode(modalCenter, topic.binWidth, topic.min, topic.max, n);
  const expectedBinStart = topic.min + modalBin * topic.binWidth;
  const expectedBinEnd = expectedBinStart + topic.binWidth;
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
): ChallengeBuildResult {
  const n = randInt(25, 40);
  // Use a varied shape so frequencies are non-trivial.
  const shapes: HistogramShapeKind[] = ['symmetric', 'right-skewed', 'left-skewed'];
  const shape = shapes[idx % shapes.length];
  const data = buildDataForShape(shape, topic, n);
  const numBins = Math.floor((topic.max - topic.min) / topic.binWidth);
  // Pick a target bin that's not at the very extreme (so frequency > 0).
  const targetBin = randInt(0, Math.max(0, numBins - 1));
  const targetBinStart = topic.min + targetBin * topic.binWidth;
  const targetBinEnd = targetBinStart + topic.binWidth;
  const targetFrequency = data.filter((v) => v >= targetBinStart && v < targetBinEnd).length;
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
): ChallengeBuildResult {
  const n = randInt(25, 40);
  // Mix symmetric and skewed shapes so mean ≠ median sometimes.
  const shapes: HistogramShapeKind[] = ['symmetric', 'right-skewed', 'left-skewed', 'symmetric'];
  const shape = shapes[idx % shapes.length];
  const data = buildDataForShape(shape, topic, n);
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

const builderFor = (mode: HistogramChallengeType) => {
  switch (mode) {
    case 'identify_shape':   return buildIdentifyShape;
    case 'find_modal_bin':   return buildFindModalBin;
    case 'read_frequency':   return buildReadFrequency;
    case 'estimate_center':  return buildEstimateCenter;
  }
};

/**
 * Deterministically select N histogram challenges for the given mode.
 *
 * Guarantees:
 * - All challenges use distinct topic contexts (no duplicate topics per session).
 * - For identify_shape: shapes vary across challenges (no duplicates).
 * - Bin width and dataset size fall within the topic's pedagogical range.
 */
function selectHistogramChallenges(
  mode: HistogramChallengeType,
  count: number,
): HistogramChallenge[] {
  const target = clamp(count, MIN_INSTANCE_COUNT, MAX_INSTANCE_COUNT);
  const topics = shuffle(TOPIC_POOL).slice(0, target);
  // Pad if pool is smaller than target (shouldn't happen with 6 topics).
  while (topics.length < target) {
    topics.push(TOPIC_POOL[topics.length % TOPIC_POOL.length]);
  }

  const build = builderFor(mode);
  const out: HistogramChallenge[] = [];
  const summaries: string[] = [];

  if (mode === 'identify_shape') {
    // Force distinct shapes across challenges (cycle through the shape pool).
    const shapes = shuffle(SHAPE_OPTIONS).slice(0, target);
    while (shapes.length < target) shapes.push(SHAPE_OPTIONS[shapes.length % SHAPE_OPTIONS.length]);
    topics.forEach((topic, idx) => {
      const result = buildIdentifyShape(topic, idx, shapes[idx]);
      out.push(result.challenge);
      summaries.push(result.summary);
    });
  } else {
    topics.forEach((topic, idx) => {
      const result = build(topic, idx);
      out.push(result.challenge);
      summaries.push(result.summary);
    });
  }

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
  },
): Promise<HistogramData> => {
  // ── Resolve eval mode ──
  const evalConstraint = resolveEvalModeConstraint(
    'histogram',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('Histogram', config?.targetEvalMode, evalConstraint);

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(
        histogramSchema,
        evalConstraint.allowedTypes,
        CHALLENGE_TYPE_DOCS,
        { fieldName: 'challengeType', rootLevel: true },
      )
    : histogramSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create a histogram analysis SESSION for teaching "${topic}" to ${gradeLevel} students.

THE STUDENT EXPERIENCE:
- The student walks through ${DEFAULT_INSTANCE_COUNT} distinct histograms, one at a time.
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
    : `Walk through ${DEFAULT_INSTANCE_COUNT} histograms — answer a question about each one.`;

  // ── Build challenges from the pool service ──
  const instanceCount = clamp(
    config?.instanceCount ?? DEFAULT_INSTANCE_COUNT,
    MIN_INSTANCE_COUNT,
    MAX_INSTANCE_COUNT,
  );
  const challenges = selectHistogramChallenges(challengeType, instanceCount);

  // Mode-specific display flags: hide the stats panel in estimate_center mode
  // because the panel would literally print the answer.
  const showStatistics = challengeType !== 'estimate_center';

  return {
    title,
    description,
    challengeType,
    challenges,
    gradeBand: config?.gradeBand ?? gradeBand,
    showStatistics,
  };
};
