import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Public types (unchanged shape — callers and component must not break)
// ---------------------------------------------------------------------------

export interface DotPlotChallenge {
  id: string;
  evalMode:
    | 'whole_number_plot'
    | 'measure_and_plot'
    | 'read_frequency'
    | 'fractional_units'
    | 'compute_stats'
    | 'compare_datasets';
  instruction: string;
  hint?: string;
  narration?: string;
  /** For compute_stats: which statistic to compute. */
  targetStat?: 'median' | 'mode' | 'range';
  /** For compute_stats / read_frequency: the expected numeric answer. */
  targetAnswer?: number;
  /** For compare_datasets: short expected-answer string (for tutor reference). */
  comparisonAnswer?: string;
}

export interface DotPlotData {
  title: string;
  description: string;
  range: [number, number];
  dataPoints: number[];
  showStatistics: boolean;
  editable: boolean;
  parallel?: boolean;
  secondaryDataPoints?: number[];
  secondaryLabel?: string;
  primaryLabel?: string;
  stackStyle: 'dots' | 'x' | 'icons';
  iconEmoji?: string;
  challenges?: DotPlotChallenge[];
}

type EvalMode = DotPlotChallenge['evalMode'];

interface DotPlotConfig {
  range?: [number, number];
  dataPoints?: number[];
  showStatistics?: boolean;
  editable?: boolean;
  parallel?: boolean;
  stackStyle?: 'dots' | 'x' | 'icons';
  /** Target eval mode from the IRT calibration system. */
  targetEvalMode?: string;
}

// ---------------------------------------------------------------------------
// Challenge type docs — required by resolveEvalModeConstraint for lookup.
// Prompts live in each sub-generator; these are stubs for the resolver.
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  whole_number_plot: {
    promptDoc: `"whole_number_plot": plot a given whole-number dataset on a labeled line plot.`,
    schemaDescription: "'whole_number_plot' (plot a given whole-number dataset)",
  },
  measure_and_plot: {
    promptDoc: `"measure_and_plot": measure visual rulers / objects, then plot the measurements.`,
    schemaDescription: "'measure_and_plot' (measure rulers, then plot)",
  },
  read_frequency: {
    promptDoc: `"read_frequency": read an existing dot plot and identify the most / least frequent value.`,
    schemaDescription: "'read_frequency' (identify most/least frequent value)",
  },
  fractional_units: {
    promptDoc: `"fractional_units": plot fractional-value data on a halves / quarters number line.`,
    schemaDescription: "'fractional_units' (plot with halves/quarters)",
  },
  compute_stats: {
    promptDoc: `"compute_stats": compute median, mode, or range from an existing dot plot.`,
    schemaDescription: "'compute_stats' (compute median/mode/range)",
  },
  compare_datasets: {
    promptDoc: `"compare_datasets": compare two parallel dot plots by center, spread, or shape.`,
    schemaDescription: "'compare_datasets' (compare two parallel plots)",
  },
};

// ===========================================================================
// Shared helpers
// ===========================================================================

const MODEL = "gemini-flash-lite-latest";

function sanitizeLabel(input: unknown, fallback: string): string {
  if (typeof input !== 'string') return fallback;
  let s = input.trim();
  // Strip trailing non-alphanumeric garbage tails (e.g. ", 10, 10],, ")
  s = s.replace(/[\s,;:\-_\[\]{}()\\/|]+$/g, '');
  // Collapse internal whitespace
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length === 0) return fallback;
  if (s.length > 40) s = s.slice(0, 40).trim();
  return s;
}

function clampToRange(points: number[], min: number, max: number): number[] {
  return points.filter((p) => typeof p === 'number' && isFinite(p) && p >= min && p <= max);
}

function computeMode(nums: number[]): number | undefined {
  if (!nums.length) return undefined;
  const counts = new Map<number, number>();
  for (const n of nums) counts.set(n, (counts.get(n) ?? 0) + 1);
  let best = nums[0];
  let bestCount = -1;
  counts.forEach((count, value) => {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  });
  return best;
}

function computeMedian(nums: number[]): number | undefined {
  if (!nums.length) return undefined;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function computeNumericRange(nums: number[]): number | undefined {
  if (!nums.length) return undefined;
  return Math.max(...nums) - Math.min(...nums);
}

function resolveRange(
  parsedMin: unknown,
  parsedMax: unknown,
  fallback: [number, number],
): [number, number] {
  const min = typeof parsedMin === 'number' && isFinite(parsedMin) ? parsedMin : fallback[0];
  const max = typeof parsedMax === 'number' && isFinite(parsedMax) ? parsedMax : fallback[1];
  return min < max ? [min, max] : fallback;
}

function applyConfigOverrides(data: DotPlotData, config?: DotPlotConfig): DotPlotData {
  if (!config) return data;
  if (config.range) data.range = config.range;
  if (config.dataPoints) data.dataPoints = config.dataPoints;
  if (config.showStatistics !== undefined) data.showStatistics = config.showStatistics;
  if (config.editable !== undefined) data.editable = config.editable;
  if (config.parallel !== undefined) data.parallel = config.parallel;
  if (config.stackStyle) data.stackStyle = config.stackStyle;
  return data;
}

async function runGemini<T = unknown>(schema: Schema, prompt: string): Promise<T | null> {
  const result = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });
  return result.text ? (JSON.parse(result.text) as T) : null;
}

// ===========================================================================
// whole_number_plot
// ===========================================================================

const wholeNumberPlotSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short title tied to the topic (e.g. 'Books Read This Week')" },
    description: { type: Type.STRING, description: "One-sentence educational description of the task" },
    rangeMin: { type: Type.NUMBER, description: "Minimum of the number line (usually 0)" },
    rangeMax: { type: Type.NUMBER, description: "Maximum of the number line (10 or 15)" },
    dataPoints: {
      type: Type.ARRAY,
      description: "8-12 whole-number values students will plot. Values may repeat.",
      items: { type: Type.NUMBER },
    },
    instruction: { type: Type.STRING, description: "Concrete student instruction that names the dataset. Never reveal the answer." },
    hint: { type: Type.STRING, description: "Guiding hint that does not reveal the answer." },
    narration: { type: Type.STRING, description: "Short tutor narration to introduce the task." },
  },
  required: ["title", "description", "rangeMin", "rangeMax", "dataPoints", "instruction", "hint", "narration"],
};

async function generateWholeNumberPlot(
  topic: string,
  gradeLevel: string,
  config?: DotPlotConfig,
): Promise<DotPlotData> {
  const prompt = `
Create a WHOLE NUMBER dot plot activity for "${topic}" at grade ${gradeLevel}.

TASK: Student plots a given whole-number dataset on a labeled line plot.
GRADE BAND: 2-3 (CCSS 3.MD.B.4).

CONSTRAINTS:
- Range must be [0, 10] or [0, 15]. Set rangeMin and rangeMax accordingly.
- dataPoints: 8-12 whole-number values inside the range, with repeats to show frequency.
- Title must tie to the topic (e.g. "Books Read", "Goals Scored"). NO numbers in the title.
- Instruction names the dataset explicitly: "Plot these values: 2, 3, 3, 4, 5, 5, 5, 6".
- Never reveal the answer as a single value — this is representation practice.
- Hint guides: "Add one dot for every value — repeated values stack on top of each other."
`;

  const parsed = await runGemini<{
    title: string;
    description: string;
    rangeMin: number;
    rangeMax: number;
    dataPoints: number[];
    instruction: string;
    hint: string;
    narration: string;
  }>(wholeNumberPlotSchema, prompt);

  const range = resolveRange(parsed?.rangeMin, parsed?.rangeMax, [0, 10]);
  const dataPoints = clampToRange(Array.isArray(parsed?.dataPoints) ? parsed!.dataPoints : [], range[0], range[1]);
  const safePoints = dataPoints.length ? dataPoints : [2, 3, 3, 4, 5, 5, 5, 6];

  const data: DotPlotData = {
    title: parsed?.title?.trim() || `${topic} — Plot the Data`,
    description: parsed?.description?.trim() || `Plot each value on the line.`,
    range,
    dataPoints: safePoints,
    showStatistics: false,
    editable: true,
    parallel: false,
    stackStyle: 'dots',
    challenges: [{
      id: 'dp-1',
      evalMode: 'whole_number_plot',
      instruction: parsed?.instruction?.trim() || `Plot each value from the dataset on the line.`,
      hint: parsed?.hint?.trim() || `Add one dot for each value — repeated values stack.`,
      narration: parsed?.narration?.trim() || `Let's plot this dataset together.`,
    }],
  };

  return applyConfigOverrides(data, config);
}

// ===========================================================================
// measure_and_plot
// ===========================================================================

const measureAndPlotSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short measurement-themed title (e.g. 'Pencil Lengths', 'Crayon Lengths')" },
    description: { type: Type.STRING, description: "One-sentence description of the measuring context" },
    rangeMin: { type: Type.NUMBER, description: "Minimum length (usually 0)" },
    rangeMax: { type: Type.NUMBER, description: "Maximum length (usually 10 inches)" },
    dataPoints: {
      type: Type.ARRAY,
      description: "6-10 whole-inch measurements (the answer key the student will produce after measuring).",
      items: { type: Type.NUMBER },
    },
    instruction: { type: Type.STRING, description: "Tells students to measure each object and add a dot for its length." },
    hint: { type: Type.STRING, description: "Guides how to measure (ruler alignment, reading whole-inch marks)." },
    narration: { type: Type.STRING, description: "Short tutor narration to introduce the task." },
  },
  required: ["title", "description", "rangeMin", "rangeMax", "dataPoints", "instruction", "hint", "narration"],
};

async function generateMeasureAndPlot(
  topic: string,
  gradeLevel: string,
  config?: DotPlotConfig,
): Promise<DotPlotData> {
  const prompt = `
Create a MEASURE AND PLOT dot plot activity for "${topic}" at grade ${gradeLevel}.

TASK: Student measures visual rulers/objects, then plots the measurements.
GRADE: 3 (CCSS 3.MD.B.4).

CONSTRAINTS:
- Range: [0, 10] inches. Set rangeMin=0, rangeMax=10.
- dataPoints: 6-10 WHOLE-INCH measurements (the answer key). Repeats OK.
- Title must reference the measurement context ("Pencil Lengths", "Ribbon Lengths").
- Instruction: "Measure each <object> with the ruler, then plot the length."
- Hint: guide on ruler alignment.
`;

  const parsed = await runGemini<{
    title: string;
    description: string;
    rangeMin: number;
    rangeMax: number;
    dataPoints: number[];
    instruction: string;
    hint: string;
    narration: string;
  }>(measureAndPlotSchema, prompt);

  const range = resolveRange(parsed?.rangeMin, parsed?.rangeMax, [0, 10]);
  const dataPoints = clampToRange(Array.isArray(parsed?.dataPoints) ? parsed!.dataPoints : [], range[0], range[1]);
  const safePoints = dataPoints.length ? dataPoints : [2, 3, 4, 4, 5, 6, 7];

  const data: DotPlotData = {
    title: parsed?.title?.trim() || `${topic} — Measure and Plot`,
    description: parsed?.description?.trim() || `Measure each object, then plot its length.`,
    range,
    dataPoints: safePoints,
    showStatistics: false,
    editable: true,
    parallel: false,
    stackStyle: 'dots',
    challenges: [{
      id: 'dp-1',
      evalMode: 'measure_and_plot',
      instruction: parsed?.instruction?.trim() || `Measure each object, then plot its length.`,
      hint: parsed?.hint?.trim() || `Line the ruler up with one end — read the whole-inch mark at the other.`,
      narration: parsed?.narration?.trim() || `Use the rulers to measure. Then add a dot for each measurement.`,
    }],
  };

  return applyConfigOverrides(data, config);
}

// ===========================================================================
// read_frequency
// ===========================================================================

const readFrequencySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short title tied to the topic." },
    description: { type: Type.STRING, description: "One-sentence educational description." },
    rangeMin: { type: Type.NUMBER, description: "Minimum of the number line." },
    rangeMax: { type: Type.NUMBER, description: "Maximum of the number line." },
    dataPoints: {
      type: Type.ARRAY,
      description: "10-15 values forming a fully filled plot with ONE clear mode (tallest stack).",
      items: { type: Type.NUMBER },
    },
    askMostFrequent: {
      type: Type.BOOLEAN,
      description: "true if asking 'which value appears MOST often', false if asking LEAST often.",
    },
    instruction: { type: Type.STRING, description: "Frequency question (most/least). Do NOT state the answer." },
    hint: { type: Type.STRING, description: "Guides: 'look for the tallest/shortest stack'." },
    narration: { type: Type.STRING, description: "Short tutor narration." },
  },
  required: ["title", "description", "rangeMin", "rangeMax", "dataPoints", "askMostFrequent", "instruction", "hint", "narration"],
};

function computeLeastFrequent(nums: number[]): number | undefined {
  if (!nums.length) return undefined;
  const counts = new Map<number, number>();
  for (const n of nums) counts.set(n, (counts.get(n) ?? 0) + 1);
  let best = nums[0];
  let bestCount = Infinity;
  counts.forEach((count, value) => {
    if (count < bestCount) {
      best = value;
      bestCount = count;
    }
  });
  return best;
}

async function generateReadFrequency(
  topic: string,
  gradeLevel: string,
  config?: DotPlotConfig,
): Promise<DotPlotData> {
  const prompt = `
Create a READ FREQUENCY dot plot activity for "${topic}" at grade ${gradeLevel}.

TASK: Student reads an EXISTING dot plot and identifies the most or least frequent value.
GRADE: 3-4 (CCSS 3.MD.B.3).

CONSTRAINTS:
- Range [0, 10] or [0, 15].
- dataPoints: 10-15 values with ONE clearly-tallest (or clearly-shortest) stack.
- askMostFrequent: choose true or false — the question asks about MOST or LEAST frequent.
- Instruction: "Which number appears MOST often on the plot?" or "Which value has the FEWEST dots?"
- DO NOT state the answer. The student reads it from the plot.
`;

  const parsed = await runGemini<{
    title: string;
    description: string;
    rangeMin: number;
    rangeMax: number;
    dataPoints: number[];
    askMostFrequent: boolean;
    instruction: string;
    hint: string;
    narration: string;
  }>(readFrequencySchema, prompt);

  const range = resolveRange(parsed?.rangeMin, parsed?.rangeMax, [0, 10]);
  const dataPoints = clampToRange(Array.isArray(parsed?.dataPoints) ? parsed!.dataPoints : [], range[0], range[1]);
  const safePoints = dataPoints.length ? dataPoints : [3, 4, 4, 5, 5, 5, 6, 6, 7, 8];
  const askMost = parsed?.askMostFrequent ?? true;

  // Derive answer deterministically — never trust Gemini for the numeric answer.
  const targetAnswer = askMost ? computeMode(safePoints) : computeLeastFrequent(safePoints);

  const data: DotPlotData = {
    title: parsed?.title?.trim() || `${topic} — Read the Plot`,
    description: parsed?.description?.trim() || `Study the plot and answer the question.`,
    range,
    dataPoints: safePoints,
    showStatistics: false,
    editable: false,
    parallel: false,
    stackStyle: 'dots',
    challenges: [{
      id: 'dp-1',
      evalMode: 'read_frequency',
      instruction: parsed?.instruction?.trim()
        || (askMost ? `Which value appears most often on the plot?` : `Which value has the fewest dots?`),
      hint: parsed?.hint?.trim()
        || (askMost ? `Look for the tallest stack of dots.` : `Look for the shortest stack of dots.`),
      narration: parsed?.narration?.trim() || `Study the plot. Count the dots above each number.`,
      targetAnswer,
    }],
  };

  return applyConfigOverrides(data, config);
}

// ===========================================================================
// fractional_units
// ===========================================================================

const fractionalUnitsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Measurement-themed title (e.g. 'Ribbon Lengths in Inches')." },
    description: { type: Type.STRING, description: "Educational description referencing fractional measurement." },
    rangeMin: { type: Type.NUMBER, description: "Minimum of the line (usually 0)." },
    rangeMax: { type: Type.NUMBER, description: "Maximum of the line (5, 6, or 10)." },
    dataPoints: {
      type: Type.ARRAY,
      description: "8-12 fractional values using halves or quarters (e.g. 1.5, 2, 2.25, 2.5, 2.75, 3).",
      items: { type: Type.NUMBER },
    },
    instruction: { type: Type.STRING, description: "Names the dataset using fraction words. Never leak the answer." },
    hint: { type: Type.STRING, description: "Guides the student on using half/quarter-inch marks." },
    narration: { type: Type.STRING, description: "Short tutor narration." },
  },
  required: ["title", "description", "rangeMin", "rangeMax", "dataPoints", "instruction", "hint", "narration"],
};

async function generateFractionalUnits(
  topic: string,
  gradeLevel: string,
  config?: DotPlotConfig,
): Promise<DotPlotData> {
  const prompt = `
Create a FRACTIONAL UNITS dot plot activity for "${topic}" at grade ${gradeLevel}.

TASK: Student plots data with halves / quarters / eighths on a fractional number line.
GRADE: 3-5 (CCSS 3.MD.B.4, 5.MD.B.2).

CONSTRAINTS:
- Range such as [0, 5] or [0, 6]. Set rangeMin and rangeMax.
- dataPoints: 8-12 values using halves (x.5) or quarters (x.25, x.5, x.75).
- Title references measuring with a ruler ("Ribbon Lengths", "Pencil Lengths").
- Instruction names the dataset clearly using fraction words:
  "Plot these lengths: 1 1/2, 2, 2 1/4, 2 1/2, 2 3/4, 3, 3 1/2, 4"
- Hint guides on using the half/quarter-inch marks between whole numbers.
`;

  const parsed = await runGemini<{
    title: string;
    description: string;
    rangeMin: number;
    rangeMax: number;
    dataPoints: number[];
    instruction: string;
    hint: string;
    narration: string;
  }>(fractionalUnitsSchema, prompt);

  const range = resolveRange(parsed?.rangeMin, parsed?.rangeMax, [0, 5]);
  const dataPoints = clampToRange(Array.isArray(parsed?.dataPoints) ? parsed!.dataPoints : [], range[0], range[1]);
  const safePoints = dataPoints.length ? dataPoints : [1.5, 2, 2.25, 2.5, 2.5, 2.75, 3, 3.5];

  const data: DotPlotData = {
    title: parsed?.title?.trim() || `${topic} — Fractional Lengths`,
    description: parsed?.description?.trim() || `Plot each measurement using the fractional marks.`,
    range,
    dataPoints: safePoints,
    showStatistics: false,
    editable: true,
    parallel: false,
    stackStyle: 'dots',
    challenges: [{
      id: 'dp-1',
      evalMode: 'fractional_units',
      instruction: parsed?.instruction?.trim() || `Plot each length on the line using the half- and quarter-inch marks.`,
      hint: parsed?.hint?.trim() || `Each half-inch is halfway between the whole numbers.`,
      narration: parsed?.narration?.trim() || `Plot these measurements using the fractional marks on the line.`,
    }],
  };

  return applyConfigOverrides(data, config);
}

// ===========================================================================
// compute_stats
// ===========================================================================

const computeStatsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short title tied to the topic." },
    description: { type: Type.STRING, description: "One-sentence educational description." },
    rangeMin: { type: Type.NUMBER, description: "Minimum of the number line." },
    rangeMax: { type: Type.NUMBER, description: "Maximum of the number line." },
    dataPoints: {
      type: Type.ARRAY,
      description: "10-15 values forming a complete plot. Must yield a single unambiguous answer for the target stat.",
      items: { type: Type.NUMBER },
    },
    targetStat: {
      type: Type.STRING,
      description: "Which statistic the student must compute.",
      enum: ["median", "mode", "range"],
    },
    instruction: { type: Type.STRING, description: "Asks for the specific statistic. Never reveal the answer." },
    hint: { type: Type.STRING, description: "Guides how to compute the target stat." },
    narration: { type: Type.STRING, description: "Short tutor narration." },
  },
  required: ["title", "description", "rangeMin", "rangeMax", "dataPoints", "targetStat", "instruction", "hint", "narration"],
};

async function generateComputeStats(
  topic: string,
  gradeLevel: string,
  config?: DotPlotConfig,
): Promise<DotPlotData> {
  const prompt = `
Create a COMPUTE STATS dot plot activity for "${topic}" at grade ${gradeLevel}.

TASK: Student computes median, mode, OR range from a complete dot plot.
GRADE: 5-6 (CCSS 6.SP.B).

CONSTRAINTS:
- Range fits the data (e.g. [0, 10] or similar realistic spread).
- dataPoints: 10-15 values.
- Pick targetStat: one of 'median', 'mode', 'range'.
- Design the dataset so the answer is UNAMBIGUOUS:
  - median: odd count preferred, or even count with identical middle pair
  - mode: exactly one value has the tallest stack
  - range: clearly-defined min and max
- Instruction asks for that specific stat: "What is the MEDIAN of this data set?"
- Never reveal the numeric answer.
`;

  const parsed = await runGemini<{
    title: string;
    description: string;
    rangeMin: number;
    rangeMax: number;
    dataPoints: number[];
    targetStat: 'median' | 'mode' | 'range';
    instruction: string;
    hint: string;
    narration: string;
  }>(computeStatsSchema, prompt);

  const range = resolveRange(parsed?.rangeMin, parsed?.rangeMax, [0, 10]);
  const dataPoints = clampToRange(Array.isArray(parsed?.dataPoints) ? parsed!.dataPoints : [], range[0], range[1]);
  const safePoints = dataPoints.length ? dataPoints : [2, 3, 4, 4, 5, 5, 5, 6, 7, 8];
  const targetStat = (parsed?.targetStat === 'mode' || parsed?.targetStat === 'range') ? parsed.targetStat : 'median';

  // Derive answer from the plot — correct by construction.
  const targetAnswer =
    targetStat === 'median' ? computeMedian(safePoints)
    : targetStat === 'mode' ? computeMode(safePoints)
    : computeNumericRange(safePoints);

  const instructionDefault =
    targetStat === 'median' ? `What is the MEDIAN of this data set?`
    : targetStat === 'mode' ? `What is the MODE of this data set?`
    : `What is the RANGE of this data set?`;

  const hintDefault =
    targetStat === 'median' ? `Order all values and find the middle one.`
    : targetStat === 'mode' ? `Look for the value that appears most often.`
    : `Subtract the smallest value from the largest value.`;

  const data: DotPlotData = {
    title: parsed?.title?.trim() || `${topic} — Summary Statistic`,
    description: parsed?.description?.trim() || `Compute a summary statistic from the plot.`,
    range,
    dataPoints: safePoints,
    showStatistics: true,
    editable: false,
    parallel: false,
    stackStyle: 'dots',
    challenges: [{
      id: 'dp-1',
      evalMode: 'compute_stats',
      instruction: parsed?.instruction?.trim() || instructionDefault,
      hint: parsed?.hint?.trim() || hintDefault,
      narration: parsed?.narration?.trim() || `Time to summarize this data. Find the statistic the question asks for.`,
      targetStat,
      targetAnswer,
    }],
  };

  return applyConfigOverrides(data, config);
}

// ===========================================================================
// compare_datasets
// ===========================================================================

const compareDatasetsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short comparison-themed title (e.g. 'Class A vs Class B Scores')." },
    description: { type: Type.STRING, description: "Educational description of the two-group comparison." },
    rangeMin: { type: Type.NUMBER, description: "Shared minimum of both number lines." },
    rangeMax: { type: Type.NUMBER, description: "Shared maximum of both number lines." },
    primaryLabel: {
      type: Type.STRING,
      description: "Short group name for the primary dataset (≤ 25 chars, no numbers, no narration). E.g. 'Class A'.",
    },
    secondaryLabel: {
      type: Type.STRING,
      description: "Short group name for the secondary dataset (≤ 25 chars, no numbers, no narration). E.g. 'Class B'.",
    },
    primaryDataPoints: {
      type: Type.ARRAY,
      description: "10-15 values for the primary dataset.",
      items: { type: Type.NUMBER },
    },
    secondaryDataPoints: {
      type: Type.ARRAY,
      description: "10-15 values for the secondary dataset.",
      items: { type: Type.NUMBER },
    },
    comparisonDimension: {
      type: Type.STRING,
      description: "The dimension the student compares.",
      enum: ["higher_median", "lower_median", "more_spread", "less_spread"],
    },
    instruction: { type: Type.STRING, description: "Comparison question referencing the two labels." },
    hint: { type: Type.STRING, description: "Guides how to compare (e.g. 'order each set and find the middle')." },
    narration: { type: Type.STRING, description: "Short tutor narration." },
  },
  required: [
    "title", "description", "rangeMin", "rangeMax",
    "primaryLabel", "secondaryLabel",
    "primaryDataPoints", "secondaryDataPoints",
    "comparisonDimension", "instruction", "hint", "narration",
  ],
};

function deriveComparisonAnswer(
  primary: number[],
  secondary: number[],
  primaryLabel: string,
  secondaryLabel: string,
  dimension: 'higher_median' | 'lower_median' | 'more_spread' | 'less_spread',
): string {
  const primaryMedian = computeMedian(primary) ?? 0;
  const secondaryMedian = computeMedian(secondary) ?? 0;
  const primarySpread = computeNumericRange(primary) ?? 0;
  const secondarySpread = computeNumericRange(secondary) ?? 0;

  switch (dimension) {
    case 'higher_median':
      return primaryMedian >= secondaryMedian ? primaryLabel : secondaryLabel;
    case 'lower_median':
      return primaryMedian <= secondaryMedian ? primaryLabel : secondaryLabel;
    case 'more_spread':
      return primarySpread >= secondarySpread ? primaryLabel : secondaryLabel;
    case 'less_spread':
      return primarySpread <= secondarySpread ? primaryLabel : secondaryLabel;
  }
}

async function generateCompareDatasets(
  topic: string,
  gradeLevel: string,
  config?: DotPlotConfig,
): Promise<DotPlotData> {
  const prompt = `
Create a COMPARE DATASETS dot plot activity for "${topic}" at grade ${gradeLevel}.

TASK: Student compares two parallel dot plots by center or spread.
GRADE: 6-7 (CCSS 7.SP.B).

CONSTRAINTS:
- Shared range for both datasets. Set rangeMin and rangeMax.
- Each dataset: 10-15 values within the shared range.
- Design the two datasets to differ VISIBLY on ONE dimension:
  - higher/lower median: clearly different centers
  - more/less spread: clearly different spreads
- primaryLabel and secondaryLabel: SHORT group names only. Examples: "Class A", "Morning", "Team Red".
  - Max 25 characters. NO numbers. NO narration. NO brackets. NO data values.
- Instruction is the comparison question: "Which class has the higher median?" or "Which dataset is more spread out?"
- Never reveal which label wins — the student reads it from the plots.
`;

  const parsed = await runGemini<{
    title: string;
    description: string;
    rangeMin: number;
    rangeMax: number;
    primaryLabel: string;
    secondaryLabel: string;
    primaryDataPoints: number[];
    secondaryDataPoints: number[];
    comparisonDimension: 'higher_median' | 'lower_median' | 'more_spread' | 'less_spread';
    instruction: string;
    hint: string;
    narration: string;
  }>(compareDatasetsSchema, prompt);

  const range = resolveRange(parsed?.rangeMin, parsed?.rangeMax, [0, 10]);
  const primaryPoints = clampToRange(
    Array.isArray(parsed?.primaryDataPoints) ? parsed!.primaryDataPoints : [],
    range[0], range[1],
  );
  const secondaryPoints = clampToRange(
    Array.isArray(parsed?.secondaryDataPoints) ? parsed!.secondaryDataPoints : [],
    range[0], range[1],
  );
  const safePrimary = primaryPoints.length ? primaryPoints : [2, 3, 4, 5, 5, 6, 6, 7, 8, 9];
  const safeSecondary = secondaryPoints.length ? secondaryPoints : [1, 2, 2, 3, 5, 7, 8, 8, 9, 10];

  const primaryLabel = sanitizeLabel(parsed?.primaryLabel, 'Group A');
  const secondaryLabel = sanitizeLabel(parsed?.secondaryLabel, 'Group B');
  const dimension = parsed?.comparisonDimension ?? 'higher_median';

  const comparisonAnswer = deriveComparisonAnswer(
    safePrimary, safeSecondary, primaryLabel, secondaryLabel, dimension,
  );

  const instructionDefault =
    dimension === 'higher_median' ? `Which dataset has the higher median?`
    : dimension === 'lower_median' ? `Which dataset has the lower median?`
    : dimension === 'more_spread' ? `Which dataset is more spread out?`
    : `Which dataset is less spread out?`;

  const data: DotPlotData = {
    title: parsed?.title?.trim() || `${primaryLabel} vs ${secondaryLabel}`,
    description: parsed?.description?.trim() || `Compare the two dot plots side by side.`,
    range,
    dataPoints: safePrimary,
    secondaryDataPoints: safeSecondary,
    primaryLabel,
    secondaryLabel,
    showStatistics: true,
    editable: false,
    parallel: true,
    stackStyle: 'dots',
    challenges: [{
      id: 'dp-1',
      evalMode: 'compare_datasets',
      instruction: parsed?.instruction?.trim() || instructionDefault,
      hint: parsed?.hint?.trim() || `Order each dataset and find the middle value, or compare their highest and lowest points.`,
      narration: parsed?.narration?.trim() || `Look at both plots. Compare their centers and spread.`,
      comparisonAnswer,
    }],
  };

  return applyConfigOverrides(data, config);
}

// ===========================================================================
// Orchestrator
// ===========================================================================

/**
 * Generate dot plot data for visualization.
 *
 * Dispatches to a per-mode sub-generator. Each sub-generator uses a focused,
 * fully-required schema — eliminating SP-14 (flash-lite dropping nullable
 * fields) and SP-3 (cross-contamination) by construction.
 */
export const generateDotPlot = async (
  topic: string,
  gradeLevel: string,
  config?: DotPlotConfig,
): Promise<DotPlotData> => {
  const evalConstraint = resolveEvalModeConstraint(
    'dot-plot',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('DotPlot', config?.targetEvalMode, evalConstraint);

  const mode = (evalConstraint?.allowedTypes[0] ?? 'whole_number_plot') as EvalMode;

  switch (mode) {
    case 'measure_and_plot':
      return generateMeasureAndPlot(topic, gradeLevel, config);
    case 'read_frequency':
      return generateReadFrequency(topic, gradeLevel, config);
    case 'fractional_units':
      return generateFractionalUnits(topic, gradeLevel, config);
    case 'compute_stats':
      return generateComputeStats(topic, gradeLevel, config);
    case 'compare_datasets':
      return generateCompareDatasets(topic, gradeLevel, config);
    case 'whole_number_plot':
    default:
      return generateWholeNumberPlot(topic, gradeLevel, config);
  }
};
