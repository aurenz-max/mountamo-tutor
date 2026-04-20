/**
 * Bar Model Generator — IRT-aware K-5 categorical-data graph generator.
 *
 * Orchestrator pattern: each eval mode has a focused sub-generator with a
 * flat-slot schema where every rendered field is in `required`. This
 * eliminates the SP-14 class of bugs (flash-lite silently dropping nullable
 * fields). Answer-shaping fields (graphStyle, scale, targetBarIndex, options)
 * are derived deterministically in post-process — Gemini only supplies
 * content (labels, values, prompts, hints).
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type BarModelGraphStyle = 'bar' | 'scaled_bar' | 'picture';

export type BarModelEvalMode =
  | 'compare_bars'
  | 'read_scale'
  | 'picture_graph'
  | 'scaled_bar_graph'
  | 'graph_word_problem'
  | 'build_graph';

export interface BarValue {
  label: string;
  value: number;
  color?: string;
}

export interface BarModelScale {
  step: number;
  max: number;
  iconEmoji?: string;
  iconValue?: number;
}

export interface BarModelChallenge {
  id: string;
  evalMode: BarModelEvalMode;
  prompt: string;
  hint?: string;
  narration?: string;
  expectedValue?: number;
  options?: number[];
  targetBarIndex?: number;
  expectedDataset?: { label: string; value: number }[];
  expectedScaleStep?: number;
  availableScaleSteps?: number[];
}

export interface BarModelData {
  title: string;
  description: string;
  values: BarValue[];
  graphStyle?: BarModelGraphStyle;
  scale?: BarModelScale;
  challenge?: BarModelChallenge;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const PALETTE = ['blue', 'green', 'purple', 'orange', 'pink', 'yellow'];
const pickColor = (i: number) => PALETTE[i % PALETTE.length];

const MODEL = "gemini-flash-lite-latest";

/** Build N barK{Label,Value} slot properties + required list. */
function barSlots(n: number) {
  const props: Record<string, Schema> = {};
  const required: string[] = [];
  for (let i = 0; i < n; i++) {
    props[`bar${i}Label`] = { type: Type.STRING, description: `Bar ${i} short concrete label` };
    props[`bar${i}Value`] = { type: Type.NUMBER, description: `Bar ${i} numeric value (non-negative integer)` };
    required.push(`bar${i}Label`, `bar${i}Value`);
  }
  return { props, required };
}

/** Pull N bars out of a flat Gemini response into a BarValue[]. */
function extractBars(raw: Record<string, unknown>, n: number, defaultValue = 0): BarValue[] {
  const bars: BarValue[] = [];
  for (let i = 0; i < n; i++) {
    const label = String(raw[`bar${i}Label`] ?? `Item ${i + 1}`).trim() || `Item ${i + 1}`;
    const rawVal = raw[`bar${i}Value`];
    const num = typeof rawVal === 'number' ? rawVal : Number(rawVal ?? defaultValue);
    const value = Number.isFinite(num) ? Math.max(0, Math.round(num)) : defaultValue;
    bars.push({ label, value, color: pickColor(i) });
  }
  return bars;
}

/** Deduplicate bar labels by appending a suffix when collisions occur. */
function uniquifyLabels(bars: BarValue[]): BarValue[] {
  const seen = new Set<string>();
  return bars.map((b) => {
    let label = b.label;
    let suffix = 2;
    while (seen.has(label.toLowerCase())) {
      label = `${b.label} ${suffix}`;
      suffix++;
    }
    seen.add(label.toLowerCase());
    return { ...b, label };
  });
}

/** Ceil n to the next multiple of step (≥ step). */
function ceilToMultiple(n: number, step: number): number {
  if (step <= 0) return n;
  if (n <= step) return step;
  return n % step === 0 ? n : Math.ceil(n / step) * step;
}

/** Locate a bar by label (case-sensitive → case-insensitive), then by value, then fall back to 0. */
function findBarIndex(bars: BarValue[], targetLabel: string | undefined, expectedValue: number | undefined): number {
  if (targetLabel) {
    const exact = bars.findIndex((b) => b.label === targetLabel);
    if (exact >= 0) return exact;
    const ci = bars.findIndex((b) => b.label.toLowerCase() === targetLabel.toLowerCase());
    if (ci >= 0) return ci;
  }
  if (typeof expectedValue === 'number') {
    const byValue = bars.findIndex((b) => b.value === expectedValue);
    if (byValue >= 0) return byValue;
  }
  return 0;
}

/**
 * Synthesize 4 distinct non-negative MC options that include `expected`.
 * Distractor spacing uses `step` so options fall on plausible axis values.
 */
function deriveOptions(expected: number, step: number, count = 4): number[] {
  const opts = new Set<number>([Math.max(0, Math.round(expected))]);
  const delta = Math.max(1, Math.round(step));
  const candidates = [
    expected + delta, expected - delta,
    expected + delta * 2, expected - delta * 2,
    expected + 1, expected - 1,
    expected + delta * 3, expected - delta * 3,
    expected + 2, expected - 2,
  ];
  for (const raw of candidates) {
    if (opts.size >= count) break;
    const n = Math.max(0, Math.round(raw));
    if (!opts.has(n)) opts.add(n);
  }
  let fill = Math.max(0, Math.round(expected)) + 1;
  while (opts.size < count) {
    if (!opts.has(fill)) opts.add(fill);
    fill++;
  }
  return Array.from(opts).sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Challenge type docs (retained for resolveEvalModeConstraint compatibility)
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  compare_bars: { promptDoc: 'K-1 which-is-taller.', schemaDescription: "'compare_bars' (K-1)" },
  read_scale: { promptDoc: 'G2 axis reading.', schemaDescription: "'read_scale' (G2)" },
  picture_graph: { promptDoc: 'G2-3 icon = N items.', schemaDescription: "'picture_graph' (G2-3)" },
  scaled_bar_graph: { promptDoc: 'G3 step-2/5/10 reading.', schemaDescription: "'scaled_bar_graph' (G3)" },
  graph_word_problem: { promptDoc: 'G2-3 how-many-more / total.', schemaDescription: "'graph_word_problem' (G2-3)" },
  build_graph: { promptDoc: 'G3-5 construct + pick scale.', schemaDescription: "'build_graph' (G3-5)" },
};

// ===========================================================================
// Sub-generator: compare_bars
// ===========================================================================

async function generateCompareBars(topic: string, gradeContext: string, intent: string): Promise<BarModelData> {
  const slots = barSlots(2);
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Engaging K-1 title (e.g., 'Pet Parade')" },
      description: { type: Type.STRING, description: "One-line description tying to topic" },
      prompt: { type: Type.STRING, description: "Student question. E.g. 'Which bar is taller?'. Must NOT name the answer." },
      hint: { type: Type.STRING, description: "Encouraging K-1 hint. Never names the answer." },
      ...slots.props,
      tallerBarLabel: { type: Type.STRING, description: "Exact label of the taller bar — MUST equal bar0Label or bar1Label" },
    },
    required: ["title", "description", "prompt", "hint", ...slots.required, "tallerBarLabel"],
  };

  const prompt = `Generate a K-1 "which is taller" bar comparison activity.

TOPIC: ${topic}
AUDIENCE: ${gradeContext}
INTENT: ${intent}

RULES:
- EXACTLY 2 bars with integer values 1-10.
- |bar0Value - bar1Value| MUST be ≥ 2 (visible difference).
- Concrete labels from friendly K-1 contexts: pets, fruits, toys, classroom items.
- prompt: ask comparison ("Which bar is taller?" / "Which group has MORE?"). Do NOT name the answer.
- hint: guide student to compare bar heights, never name answer.
- tallerBarLabel MUST exactly match bar0Label OR bar1Label.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: schema },
  });
  if (!response.text) throw new Error("No content generated (compare_bars)");
  const raw = JSON.parse(response.text) as Record<string, unknown>;

  const bars = uniquifyLabels(extractBars(raw, 2, 3).map((b) => ({
    ...b,
    value: Math.max(1, Math.min(10, b.value)),
  })));

  // Enforce ≥ 2 difference
  if (Math.abs(bars[0].value - bars[1].value) < 2) {
    if (bars[0].value >= bars[1].value) {
      bars[0].value = Math.min(10, bars[0].value + 2);
    } else {
      bars[1].value = Math.min(10, bars[1].value + 2);
    }
  }

  const actualTallerIndex = bars[0].value >= bars[1].value ? 0 : 1;
  const geminiTallerLabel = String(raw.tallerBarLabel ?? '');
  const geminiIdx = findBarIndex(bars, geminiTallerLabel, undefined);
  // Trust Gemini's label only if it matches the actual taller bar; otherwise use computed.
  const targetBarIndex = geminiIdx === actualTallerIndex ? geminiIdx : actualTallerIndex;

  return {
    title: String(raw.title ?? 'Compare Bars'),
    description: String(raw.description ?? 'Compare the two bars.'),
    values: bars,
    graphStyle: 'bar',
    challenge: {
      id: 'bm-1',
      evalMode: 'compare_bars',
      prompt: String(raw.prompt ?? 'Which bar is taller?'),
      hint: String(raw.hint ?? 'Look carefully at the bar heights.'),
      targetBarIndex,
    },
  };
}

// ===========================================================================
// Sub-generator: read_scale
// ===========================================================================

async function generateReadScale(topic: string, gradeContext: string, intent: string): Promise<BarModelData> {
  const slots = barSlots(4);
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Engaging title (e.g., 'Books Read This Week')" },
      description: { type: Type.STRING, description: "One-line description tying to topic" },
      prompt: { type: Type.STRING, description: "Question naming the target bar by label (e.g., 'How many books did Mia read?'). Must NOT say the number." },
      hint: { type: Type.STRING, description: "Hint guiding student to read the axis. Never names answer." },
      ...slots.props,
      targetBarLabel: { type: Type.STRING, description: "Exact label of the bar to read — MUST match one of bar0Label..bar3Label" },
      expectedValue: { type: Type.NUMBER, description: "The value of the targeted bar (must equal its barNValue)" },
    },
    required: ["title", "description", "prompt", "hint", ...slots.required, "targetBarLabel", "expectedValue"],
  };

  const prompt = `Generate a Grade 2 axis-reading activity (2.MD.D.10).

TOPIC: ${topic}
AUDIENCE: ${gradeContext}
INTENT: ${intent}

RULES:
- EXACTLY 4 bars. Integer values 0-20.
- Bar values should be varied (don't cluster too close).
- prompt: ask "How many [items] did [label]..." — name the target bar by its label ONLY. NEVER include the number.
- hint: guide student to look at the axis and count tick marks. Never names the answer.
- targetBarLabel MUST exactly match one of bar0Label..bar3Label.
- expectedValue MUST equal that bar's value.
- Concrete, child-friendly labels.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: schema },
  });
  if (!response.text) throw new Error("No content generated (read_scale)");
  const raw = JSON.parse(response.text) as Record<string, unknown>;

  const bars = uniquifyLabels(extractBars(raw, 4, 5).map((b) => ({
    ...b,
    value: Math.max(0, Math.min(20, b.value)),
  })));

  const targetLabel = String(raw.targetBarLabel ?? bars[0].label);
  const targetIdx = findBarIndex(bars, targetLabel, Number(raw.expectedValue));
  const expectedValue = bars[targetIdx].value;

  const step = expectedValue > 10 ? 2 : 1;
  const max = ceilToMultiple(Math.max(...bars.map((b) => b.value), 1), step);

  return {
    title: String(raw.title ?? 'Read the Graph'),
    description: String(raw.description ?? 'Read each bar on the scaled axis.'),
    values: bars,
    graphStyle: 'scaled_bar',
    scale: { step, max },
    challenge: {
      id: 'bm-1',
      evalMode: 'read_scale',
      prompt: String(raw.prompt ?? `How many does ${bars[targetIdx].label} have?`),
      hint: String(raw.hint ?? 'Follow the top of the bar to the number on the axis.'),
      expectedValue,
      options: deriveOptions(expectedValue, step),
      targetBarIndex: targetIdx,
    },
  };
}

// ===========================================================================
// Sub-generator: picture_graph
// ===========================================================================

async function generatePictureGraph(topic: string, gradeContext: string, intent: string): Promise<BarModelData> {
  const slots = barSlots(4);
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Engaging title (e.g., 'Favorite Pets')" },
      description: { type: Type.STRING, description: "One-line description" },
      prompt: { type: Type.STRING, description: "Question naming target bar by label. Must NOT state the number. Must explicitly mention 'Each {icon} stands for {N}'." },
      hint: { type: Type.STRING, description: "Hint: count icons, then multiply by iconValue. Never names answer." },
      iconEmoji: { type: Type.STRING, description: "Single emoji matching the topic (e.g., 🐶, 🍎, ⭐)" },
      iconValue: { type: Type.NUMBER, description: "Items per icon. MUST be 2 or 5. NEVER 1." },
      ...slots.props,
      targetBarLabel: { type: Type.STRING, description: "Exact label of the bar to read" },
      expectedValue: { type: Type.NUMBER, description: "Value of targeted bar (must be a multiple of iconValue)" },
    },
    required: ["title", "description", "prompt", "hint", "iconEmoji", "iconValue", ...slots.required, "targetBarLabel", "expectedValue"],
  };

  const prompt = `Generate a Grade 2-3 picture graph activity (1 icon = N items).

TOPIC: ${topic}
AUDIENCE: ${gradeContext}
INTENT: ${intent}

RULES:
- iconValue MUST be 2 or 5 (NEVER 1 — that defeats the purpose).
- Pick a sensible iconEmoji that matches the topic (🐶 for dogs, 🍎 for fruit, ⭐ for stars, 📚 for books).
- EXACTLY 4 bars. Each bar's value MUST be a non-zero whole-number multiple of iconValue.
  Examples: iconValue=2 → values from {2,4,6,8,10,12}. iconValue=5 → values from {5,10,15,20,25,30}.
- prompt: name the target bar by label. State "Each [icon] stands for [N]". Ask "How many [items]..." — do NOT reveal the number.
- hint: guide student to count icons and multiply.
- targetBarLabel MUST match one of the bar labels; expectedValue MUST equal that bar's value.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: schema },
  });
  if (!response.text) throw new Error("No content generated (picture_graph)");
  const raw = JSON.parse(response.text) as Record<string, unknown>;

  let iconValue = Number(raw.iconValue ?? 2);
  if (iconValue !== 2 && iconValue !== 5) iconValue = 2;
  const iconEmoji = String(raw.iconEmoji ?? '⭐').slice(0, 4) || '⭐';

  // Snap each bar value to a non-zero multiple of iconValue
  const bars = uniquifyLabels(extractBars(raw, 4, iconValue * 2).map((b) => {
    const rounded = Math.max(iconValue, Math.round(b.value / iconValue) * iconValue);
    return { ...b, value: Math.min(iconValue * 8, rounded) };
  }));

  const targetLabel = String(raw.targetBarLabel ?? bars[0].label);
  const targetIdx = findBarIndex(bars, targetLabel, Number(raw.expectedValue));
  const expectedValue = bars[targetIdx].value;

  const max = ceilToMultiple(Math.max(...bars.map((b) => b.value), iconValue), iconValue);

  return {
    title: String(raw.title ?? 'Picture Graph'),
    description: String(raw.description ?? 'Read the picture graph.'),
    values: bars,
    graphStyle: 'picture',
    scale: { step: iconValue, max, iconEmoji, iconValue },
    challenge: {
      id: 'bm-1',
      evalMode: 'picture_graph',
      prompt: String(raw.prompt ?? `Each ${iconEmoji} stands for ${iconValue}. How many for ${bars[targetIdx].label}?`),
      hint: String(raw.hint ?? `Count the icons, then multiply by ${iconValue}.`),
      expectedValue,
      options: deriveOptions(expectedValue, iconValue),
      targetBarIndex: targetIdx,
    },
  };
}

// ===========================================================================
// Sub-generator: scaled_bar_graph
// ===========================================================================

async function generateScaledBarGraph(topic: string, gradeContext: string, intent: string): Promise<BarModelData> {
  const slots = barSlots(5);
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Engaging title" },
      description: { type: Type.STRING, description: "One-line description" },
      prompt: { type: Type.STRING, description: "Question naming the target bar by label. Must NOT state the number." },
      hint: { type: Type.STRING, description: "Hint: look at tick marks and estimate. Never names answer." },
      scaleStep: { type: Type.NUMBER, description: "Axis step. MUST be 2, 5, or 10." },
      ...slots.props,
      targetBarLabel: { type: Type.STRING, description: "Exact label of the bar to read" },
      expectedValue: { type: Type.NUMBER, description: "Value of targeted bar" },
    },
    required: ["title", "description", "prompt", "hint", "scaleStep", ...slots.required, "targetBarLabel", "expectedValue"],
  };

  const prompt = `Generate a Grade 3 scaled-axis bar reading activity (3.MD.B.3).

TOPIC: ${topic}
AUDIENCE: ${gradeContext}
INTENT: ${intent}

RULES:
- EXACTLY 5 bars. Integer values 2-60.
- scaleStep MUST be 2, 5, or 10 (NEVER 1 — this is the Grade 3 skill).
- At LEAST one bar value should NOT land on a tick mark (e.g. 14 with step=5 → "between 10 and 15").
  This forces the student to reason, not just read labels.
- prompt: name target bar by label. Ask for its value. NEVER state the number.
- hint: guide student to interpolate between tick marks.
- targetBarLabel MUST match one of bar0Label..bar4Label; expectedValue MUST equal that bar's value.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: schema },
  });
  if (!response.text) throw new Error("No content generated (scaled_bar_graph)");
  const raw = JSON.parse(response.text) as Record<string, unknown>;

  let step = Number(raw.scaleStep ?? 5);
  if (![2, 5, 10].includes(step)) step = 5;

  const bars = uniquifyLabels(extractBars(raw, 5, step * 2).map((b) => ({
    ...b,
    value: Math.max(0, Math.min(60, b.value)),
  })));

  const targetLabel = String(raw.targetBarLabel ?? bars[0].label);
  const targetIdx = findBarIndex(bars, targetLabel, Number(raw.expectedValue));
  const expectedValue = bars[targetIdx].value;

  const max = ceilToMultiple(Math.max(...bars.map((b) => b.value), step), step);

  return {
    title: String(raw.title ?? 'Scaled Bar Graph'),
    description: String(raw.description ?? 'Read a bar between tick marks.'),
    values: bars,
    graphStyle: 'scaled_bar',
    scale: { step, max },
    challenge: {
      id: 'bm-1',
      evalMode: 'scaled_bar_graph',
      prompt: String(raw.prompt ?? `What value does ${bars[targetIdx].label} show?`),
      hint: String(raw.hint ?? `Look at the tick marks around the top of the bar.`),
      expectedValue,
      options: deriveOptions(expectedValue, step),
      targetBarIndex: targetIdx,
    },
  };
}

// ===========================================================================
// Sub-generator: graph_word_problem
// ===========================================================================

async function generateGraphWordProblem(topic: string, gradeContext: string, intent: string): Promise<BarModelData> {
  const slots = barSlots(4);
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Engaging title" },
      description: { type: Type.STRING, description: "One-line description" },
      prompt: { type: Type.STRING, description: "Multi-bar question: 'how many more X than Y?', 'how many fewer?', or 'total of X and Y?'. Must NOT state the numerical answer." },
      hint: { type: Type.STRING, description: "Hint about the operation needed. Never states the answer." },
      scaleStep: { type: Type.NUMBER, description: "Axis step. MUST be 2, 5, or 10." },
      ...slots.props,
      expectedValue: { type: Type.NUMBER, description: "Numerical answer (difference or sum). MUST match the arithmetic on the bars." },
    },
    required: ["title", "description", "prompt", "hint", "scaleStep", ...slots.required, "expectedValue"],
  };

  const prompt = `Generate a Grade 2-3 multi-step graph word problem.

TOPIC: ${topic}
AUDIENCE: ${gradeContext}
INTENT: ${intent}

RULES:
- EXACTLY 4 bars. Integer values 2-40.
- scaleStep MUST be 2, 5, or 10.
- prompt asks ONE of: "How many more X than Y?" / "How many fewer X than Y?" / "What's the total of X and Y?"
  Name two specific bar labels in the question. Sums ≤ 40, differences ≤ 20.
- expectedValue MUST be the correct arithmetic result from the bars you generated.
- hint: guide the operation ("subtract", "add") without naming the answer.
- Do NOT hint at or name a single bar as the "target" — this is integration across bars.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: schema },
  });
  if (!response.text) throw new Error("No content generated (graph_word_problem)");
  const raw = JSON.parse(response.text) as Record<string, unknown>;

  let step = Number(raw.scaleStep ?? 5);
  if (![2, 5, 10].includes(step)) step = 5;

  const bars = uniquifyLabels(extractBars(raw, 4, step * 2).map((b) => ({
    ...b,
    value: Math.max(0, Math.min(40, b.value)),
  })));

  const expectedValue = Math.max(0, Math.round(Number(raw.expectedValue ?? 0)));
  const max = ceilToMultiple(Math.max(...bars.map((b) => b.value), step), step);

  return {
    title: String(raw.title ?? 'Graph Word Problem'),
    description: String(raw.description ?? 'Read the graph, then solve.'),
    values: bars,
    graphStyle: 'scaled_bar',
    scale: { step, max },
    challenge: {
      id: 'bm-1',
      evalMode: 'graph_word_problem',
      prompt: String(raw.prompt ?? 'How many more does the tallest bar have than the shortest?'),
      hint: String(raw.hint ?? 'Read both bars carefully, then subtract or add.'),
      expectedValue,
      options: deriveOptions(expectedValue, step),
    },
  };
}

// ===========================================================================
// Sub-generator: build_graph
// ===========================================================================

async function generateBuildGraph(topic: string, gradeContext: string, intent: string): Promise<BarModelData> {
  const slots = barSlots(4);
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Engaging title" },
      description: { type: Type.STRING, description: "One-line description" },
      prompt: { type: Type.STRING, description: "Dataset presented in words. E.g., 'Build a graph: Cats=12, Dogs=8, Birds=4, Fish=6. Choose the best scale.'" },
      hint: { type: Type.STRING, description: "Hint on scale choice. 'Look at your largest value — which step lets it fit without lots of empty space?'" },
      expectedScaleStep: { type: Type.NUMBER, description: "Correct scale step (MUST be 1, 2, 5, or 10; pick based on max value — prefer ≥ 2)." },
      ...slots.props,
    },
    required: ["title", "description", "prompt", "hint", "expectedScaleStep", ...slots.required],
  };

  const prompt = `Generate a Grade 3-5 graph-construction activity (3.MD.B.3).

TOPIC: ${topic}
AUDIENCE: ${gradeContext}
INTENT: ${intent}

The STUDENT constructs the graph AND picks the scale. Your job is to supply the dataset + answer key.

RULES:
- EXACTLY 4 bars. Integer values from the MEANINGFUL ranges below (NOT zeros — you give the answer key dataset):
  * If expectedScaleStep=2: values 4-20
  * If expectedScaleStep=5: values 10-50
  * If expectedScaleStep=10: values 20-100
- expectedScaleStep MUST be 2, 5, or 10 (avoid 1 — that's not pedagogically interesting here).
- Pick expectedScaleStep so the largest bar fits in ≤ 10 tick marks.
- prompt: present the dataset in a single sentence with all 4 label=value pairs. Ask the student to "Build the graph and choose the best scale."
- hint: guide scale choice without naming the step.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: schema },
  });
  if (!response.text) throw new Error("No content generated (build_graph)");
  const raw = JSON.parse(response.text) as Record<string, unknown>;

  let expectedStep = Number(raw.expectedScaleStep ?? 5);
  if (![2, 5, 10].includes(expectedStep)) expectedStep = 5;

  const answerBars = uniquifyLabels(extractBars(raw, 4, expectedStep * 2).map((b) => ({
    ...b,
    value: Math.max(1, Math.min(100, b.value)),
  })));

  const max = ceilToMultiple(Math.max(...answerBars.map((b) => b.value), expectedStep), expectedStep);
  const zeroedBars = answerBars.map((b) => ({ ...b, value: 0 }));

  return {
    title: String(raw.title ?? 'Build the Graph'),
    description: String(raw.description ?? 'Construct the graph from the dataset.'),
    values: zeroedBars,
    graphStyle: 'scaled_bar',
    scale: { step: expectedStep, max },
    challenge: {
      id: 'bm-1',
      evalMode: 'build_graph',
      prompt: String(raw.prompt ?? `Build the graph: ${answerBars.map((b) => `${b.label}=${b.value}`).join(', ')}. Choose the best scale.`),
      hint: String(raw.hint ?? 'Look at your largest value — which step lets it fit without lots of empty space?'),
      expectedDataset: answerBars.map((b) => ({ label: b.label, value: b.value })),
      expectedScaleStep: expectedStep,
      availableScaleSteps: [1, 2, 5, 10],
    },
  };
}

// ===========================================================================
// Main generator — dispatches to per-mode sub-generator
// ===========================================================================

export const generateBarModel = async (
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode?: string;
  },
): Promise<BarModelData> => {
  const evalConstraint = resolveEvalModeConstraint(
    'bar-model',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('BarModel', config?.targetEvalMode, evalConstraint);

  const mode = (evalConstraint?.allowedTypes[0] ?? 'compare_bars') as BarModelEvalMode;
  const intent = config?.intent || topic;

  let data: BarModelData;
  switch (mode) {
    case 'read_scale':
      data = await generateReadScale(topic, gradeContext, intent);
      break;
    case 'picture_graph':
      data = await generatePictureGraph(topic, gradeContext, intent);
      break;
    case 'scaled_bar_graph':
      data = await generateScaledBarGraph(topic, gradeContext, intent);
      break;
    case 'graph_word_problem':
      data = await generateGraphWordProblem(topic, gradeContext, intent);
      break;
    case 'build_graph':
      data = await generateBuildGraph(topic, gradeContext, intent);
      break;
    case 'compare_bars':
    default:
      data = await generateCompareBars(topic, gradeContext, intent);
      break;
  }

  console.log('📊 Bar Model generated:', {
    topic,
    mode,
    barCount: data.values.length,
    graphStyle: data.graphStyle,
    expectedValue: data.challenge?.expectedValue,
    optionsCount: data.challenge?.options?.length ?? 0,
    targetBarIndex: data.challenge?.targetBarIndex,
  });

  return data;
};
