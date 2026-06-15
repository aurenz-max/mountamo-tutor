/**
 * Bar Model Generator — IRT-aware K-5 categorical-data graph generator.
 *
 * Multi-instance schema: a single session walks the student through 3-6 graph
 * challenges of the same eval mode, surfaced sequentially. Each challenge
 * carries its own graph (bars + graphStyle + scale) + question content.
 *
 * Generation strategy (orchestrator, per PRD §6a #1 — content-bearing per-
 * challenge data): the orchestrator fans out N parallel calls to the existing
 * per-mode sub-generator. Natural variance comes from independent Gemini
 * generations (structured-output convergence is per-call, not across
 * independent calls). Each sub-generator emits one BarModelChallenge under a
 * flat-slot schema where every rendered field is in `required` — answer-
 * shaping fields (graphStyle, scale, targetBarIndex, options) are derived
 * deterministically in post-process.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";
import { createNumberPool } from "./numberPoolService";

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

/**
 * One graph challenge. Owns its own graph data (bars + style + scale) so a
 * single session can walk the student through multiple distinct graphs.
 */
export interface BarModelChallenge {
  id: string;
  evalMode: BarModelEvalMode;
  values: BarValue[];
  graphStyle: BarModelGraphStyle;
  scale?: BarModelScale;
  prompt: string;
  hint?: string;
  narration?: string;
  expectedValue?: number;
  options?: number[];
  targetBarIndex?: number;
  expectedDataset?: { label: string; value: number }[];
  expectedScaleStep?: number;
  availableScaleSteps?: number[];
  /** Support-tier scaffolds (set in post-process when config.difficulty present). */
  showBarValues?: boolean;
  showTargetHighlight?: boolean;
  supportTier?: SupportTier;
}

export interface BarModelData {
  title: string;
  description: string;
  /** 3-6 challenges. Required. Walked sequentially by the component. */
  challenges: BarModelChallenge[];
}

/** Internal sub-generator return shape — wrapped before being merged. */
interface SubGenResult {
  title: string;
  description: string;
  challenge: BarModelChallenge;
}

// ---------------------------------------------------------------------------
// Per-mode instance counts — see PRD_WITHIN_MODE_INSTANCE_DENSITY.md §5a
// ---------------------------------------------------------------------------
// Bar-model modes split across tiers. Each challenge is an orchestrator-pattern
// Gemini call, so the count gates per-session token spend (see PRD §5a cost
// ceiling). The B4 sweep bumps only the named T2 mode (compare_bars); the T3
// hold (graph_word_problem) needs §10 cost-budget review before any bump.

const DEFAULT_INSTANCE_COUNT = 4; // T3 fallback for any mode not in COUNT_BY_MODE
const MAX_INSTANCE_COUNT = 6;

const COUNT_BY_MODE: Record<BarModelEvalMode, number> = {
  compare_bars: 5,         // T2 — B4 bump 4 → 5
  read_scale: 4,           // hold (not classified in §5a)
  picture_graph: 4,        // hold (not classified in §5a)
  scaled_bar_graph: 4,     // hold (not classified in §5a)
  graph_word_problem: 4,   // T3 hold (§10 cost budget gates any bump)
  build_graph: 4,          // hold (not classified in §5a)
};

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

// ---------------------------------------------------------------------------
// Within-mode support tier (config.difficulty) — second axis of the two-field
// contract: targetEvalMode = WHICH skill, difficulty = HOW MUCH on-screen
// scaffolding within it. A tier withdraws perception/tracking aids and dials
// hint explicitness — it NEVER changes the bar values, scale step, or dataset
// (those are owned by the eval mode + scope). See memory
// [[structural-difficulty-not-numeric]] / [[feedback_llm-window-code-builds-structure]].
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; current defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

interface SupportScaffold {
  /** Numeric value readout next to NON-answer bars (perception aid #1). The
   *  answer bar's value is hidden by the component at EVERY tier, so this can
   *  never reveal the answer. */
  showBarValues: boolean;
  /** Amber "read this one" cue on the bar the prompt names (tracking aid #1). */
  showTargetHighlight: boolean;
  /** Prompt lines describing the tier to the sub-generator (hint-tone only #2). */
  promptLines: string[];
}

const TIER_GUARDRAIL =
  'Keep every number within this lesson/grade-band scope. This tier changes ' +
  'problem STRUCTURE (height gaps, axis steps, multipliers, steps-to-solve) and ' +
  'on-screen help — NOT raw magnitude. Never just "make the numbers bigger".';

/** easy → hard support gradient, per pinned eval mode. */
function resolveSupportStructure(mode: BarModelEvalMode, tier: SupportTier): SupportScaffold {
  switch (mode) {
    case 'read_scale':
    case 'scaled_bar_graph':
      return {
        showBarValues: tier === 'easy',       // neighbour bars model the axis-read
        showTargetHighlight: tier !== 'hard', // hard = locate the named bar yourself
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'easy'
            ? 'EASY: the target bar is highlighted and the OTHER bars show their numbers as worked references. Hint may name the axis step.'
            : tier === 'medium'
              ? 'MEDIUM: the target bar is highlighted, but no bar shows its number — the student reads the axis unaided.'
              : 'HARD: no bar is highlighted and no numbers are shown — the student locates the named bar AND reads the axis alone. Hint asks what the bar lines up with; never names the step or value.',
        ],
      };
    case 'picture_graph':
      return {
        showBarValues: false,                 // picture rows never show a number
        showTargetHighlight: tier !== 'hard',
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'hard'
            ? 'HARD: no row is highlighted — the student finds the named row, counts icons, and multiplies unaided.'
            : 'EASY/MEDIUM: the target row is highlighted so the student knows which row to count.',
        ],
      };
    case 'graph_word_problem':
      return {
        showBarValues: tier !== 'hard',
        showTargetHighlight: false,           // integration across bars — no single target
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'easy'
            ? 'EASY: every bar shows its number, so the student focuses on the arithmetic. The hint may NAME the operation ("subtract", "add").'
            : tier === 'medium'
              ? 'MEDIUM: bars still show their numbers, but the hint nudges the operation without naming it.'
              : 'HARD: bars show NO numbers — the student reads both values off the axis first, then computes. Hint must NOT name the operation; ask what the question is really asking.',
        ],
      };
    case 'build_graph':
      // No clean perception lever (the student is constructing); the built-value
      // readout stays on as essential feedback. The tier dials hint explicitness.
      return {
        showBarValues: true,
        showTargetHighlight: false,
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'easy'
            ? 'EASY: hint may walk the scale choice — "look at your largest value; a step of 1 needs many marks, a bigger step needs fewer."'
            : tier === 'medium'
              ? 'MEDIUM: hint nudges toward checking the largest value, without describing how to pick the step.'
              : 'HARD: hint only says "set each bar, then choose a scale that fits" — the student reasons out the step alone.',
        ],
      };
    case 'compare_bars':
    default:
      return {
        showBarValues: tier !== 'hard',       // hard = compare heights by eye
        showTargetHighlight: false,           // no target cue in compare mode
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'hard'
            ? 'HARD: the bars show NO numbers — the student compares heights by eye. Hint coaches visual comparison, never reads off a value.'
            : 'EASY/MEDIUM: each bar shows its number, so the student can connect height to quantity.',
        ],
      };
  }
}

// ---------------------------------------------------------------------------
// Structural PROBLEM difficulty (the second thing config.difficulty drives).
//
// Distinct from the scaffolding above: this makes the generated PROBLEM itself
// genuinely harder per tier — but STRUCTURALLY, never by inflating magnitude
// beyond scope and never by crossing into another eval mode (the eval mode is
// the task identity; see memory [[structural-difficulty-not-numeric]]). Each
// mode exposes ONE in-mode structural lever:
//   compare_bars      → height gap |a-b| (4 obvious → 1 subtle)
//   read_scale        → axis step 1 → 2 (count the axis by 2s, still on-tick)
//   scaled_bar_graph  → axis step 2 → 5 → 10 (coarser ticks = harder interpolation)
//   picture_graph     → icon multiplier 2 → 5 (skip-count by 5s)
//   graph_word_problem→ operation depth (one difference → total → two-step)
//   build_graph       → scale-choice ambiguity (obvious → genuinely ambiguous)
// Numeric levers (compareGap / forcedStep / iconValue) are enforced in each
// sub-generator's post-process; the rest are prompt-shaped + LLM-validated.
// ---------------------------------------------------------------------------

interface ProblemShape {
  promptLines: string[];
  /** compare_bars: exact height gap |a-b| to enforce. */
  compareGap?: number;
  /** read_scale / scaled_bar_graph: forced axis step. */
  forcedStep?: number;
  /** picture_graph: forced icon multiplier. */
  iconValue?: 2 | 5;
}

function resolveProblemShape(mode: BarModelEvalMode, tier: SupportTier): ProblemShape {
  switch (mode) {
    case 'read_scale':
      return {
        forcedStep: tier === 'easy' ? 1 : 2,
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM: axis counts by 1 (every value on a tick), values 0-10 — a direct read.'
            : 'PROBLEM: axis counts by 2, values 0-20 and all even (still on a tick) — the student skip-counts the axis by 2s.',
        ],
      };
    case 'scaled_bar_graph':
      return {
        forcedStep: tier === 'easy' ? 2 : tier === 'medium' ? 5 : 10,
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM: axis step 2 — fine ticks, the target sits just past a mark.'
            : tier === 'medium'
              ? 'PROBLEM: axis step 5 — coarser ticks; the target bar lands between marks.'
              : 'PROBLEM: axis step 10 — very coarse ticks; the target lands clearly BETWEEN marks, so interpolation is harder.',
        ],
      };
    case 'picture_graph':
      return {
        iconValue: tier === 'easy' ? 2 : 5,
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM: each icon stands for 2 — small, easy multiples.'
            : 'PROBLEM: each icon stands for 5 — the student skip-counts by 5s.',
        ],
      };
    case 'graph_word_problem':
      return {
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM: a ONE-STEP difference question ("How many more X than Y?") between two easy-to-read bars.'
            : tier === 'medium'
              ? 'PROBLEM: a TOTAL question ("What is the total of X and Y?").'
              : 'PROBLEM: a TWO-STEP question (e.g. add two bars, then compare the total to a third) — more than one operation.',
        ],
      };
    case 'build_graph':
      return {
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM: pick a dataset whose best scale step is obvious (the largest value clearly suits one step).'
            : tier === 'medium'
              ? 'PROBLEM: pick a dataset where the scale step takes a little thought.'
              : 'PROBLEM: pick a dataset where the right step is genuinely ambiguous — the largest value sits just over a step boundary, so a too-small step needs many marks and a too-large step wastes space.',
        ],
      };
    case 'compare_bars':
    default:
      return {
        compareGap: tier === 'easy' ? 4 : tier === 'medium' ? 2 : 1,
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM: make the two bars CLEARLY different — a large, obvious height gap.'
            : tier === 'medium'
              ? 'PROBLEM: make the two bars only a little different in height.'
              : 'PROBLEM: make the two bars VERY close — the difference should be just 1, so the student must look carefully.',
        ],
      };
  }
}

/**
 * Combined tier prompt block: scaffolding tone (resolveSupportStructure) PLUS
 * structural problem difficulty (resolveProblemShape). One section so the LLM
 * sees both axes of config.difficulty together.
 */
function buildTierPromptSection(mode: BarModelEvalMode, tier: SupportTier): string {
  const lines = [
    ...resolveSupportStructure(mode, tier).promptLines,
    ...resolveProblemShape(mode, tier).promptLines,
  ];
  return `\n\n## SUPPORT TIER "${tier}" (scaffolding + structural problem difficulty — NOT bigger numbers)\n${lines.map((l) => `- ${l}`).join('\n')}`;
}

// ===========================================================================
// Sub-generator: compare_bars
// ===========================================================================

async function generateCompareBars(topic: string, gradeContext: string, intent: string, tier: SupportTier | null = null): Promise<SubGenResult> {
  const shape = tier ? resolveProblemShape('compare_bars', tier) : null;
  const tierSection = tier ? buildTierPromptSection('compare_bars', tier) : '';
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
- tallerBarLabel MUST exactly match bar0Label OR bar1Label.${tierSection}`;

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

  if (shape?.compareGap != null) {
    // Structural difficulty: enforce the EXACT height gap for this tier (4/2/1),
    // keeping both bars in 1-10. Taller bar wins; never inflates magnitude.
    const gap = shape.compareGap;
    const hiIdx = bars[0].value >= bars[1].value ? 0 : 1;
    const hi = Math.min(10, Math.max(gap + 1, Math.max(bars[0].value, bars[1].value)));
    bars[hiIdx].value = hi;
    bars[1 - hiIdx].value = Math.max(1, hi - gap);
  } else if (Math.abs(bars[0].value - bars[1].value) < 2) {
    // Default (no tier): just guarantee a ≥ 2 visible difference.
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
    challenge: {
      id: 'bm-pending',
      evalMode: 'compare_bars',
      values: bars,
      graphStyle: 'bar',
      prompt: String(raw.prompt ?? 'Which bar is taller?'),
      hint: String(raw.hint ?? 'Look carefully at the bar heights.'),
      targetBarIndex,
    },
  };
}

// ===========================================================================
// Sub-generator: read_scale
// ===========================================================================

async function generateReadScale(topic: string, gradeContext: string, intent: string, tier: SupportTier | null = null): Promise<SubGenResult> {
  const shape = tier ? resolveProblemShape('read_scale', tier) : null;
  const tierSection = tier ? buildTierPromptSection('read_scale', tier) : '';
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
- Concrete, child-friendly labels.${tierSection}`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: schema },
  });
  if (!response.text) throw new Error("No content generated (read_scale)");
  const raw = JSON.parse(response.text) as Record<string, unknown>;

  // Structural difficulty: easy → step 1 (values 0-10, direct read); else step 2
  // (values 0-20, snapped to even so they stay ON a tick — read_scale never
  // becomes interpolation, which is the distinct scaled_bar_graph mode).
  const forcedStep = shape?.forcedStep ?? null;
  const cap = forcedStep === 1 ? 10 : 20;
  const bars = uniquifyLabels(extractBars(raw, 4, 5).map((b) => {
    let value = Math.max(0, Math.min(cap, b.value));
    if (forcedStep === 2) value = Math.min(cap, Math.round(value / 2) * 2);
    return { ...b, value };
  }));

  const targetLabel = String(raw.targetBarLabel ?? bars[0].label);
  const targetIdx = findBarIndex(bars, targetLabel, Number(raw.expectedValue));
  const expectedValue = bars[targetIdx].value;

  const step = forcedStep ?? (expectedValue > 10 ? 2 : 1);
  const max = ceilToMultiple(Math.max(...bars.map((b) => b.value), 1), step);

  return {
    title: String(raw.title ?? 'Read the Graph'),
    description: String(raw.description ?? 'Read each bar on the scaled axis.'),
    challenge: {
      id: 'bm-pending',
      evalMode: 'read_scale',
      values: bars,
      graphStyle: 'scaled_bar',
      scale: { step, max },
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

async function generatePictureGraph(topic: string, gradeContext: string, intent: string, tier: SupportTier | null = null): Promise<SubGenResult> {
  const shape = tier ? resolveProblemShape('picture_graph', tier) : null;
  const tierSection = tier ? buildTierPromptSection('picture_graph', tier) : '';
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
- targetBarLabel MUST match one of the bar labels; expectedValue MUST equal that bar's value.${tierSection}`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: schema },
  });
  if (!response.text) throw new Error("No content generated (picture_graph)");
  const raw = JSON.parse(response.text) as Record<string, unknown>;

  // Structural difficulty: the tier forces the icon multiplier (easy 2 → hard 5).
  let iconValue = shape?.iconValue ?? Number(raw.iconValue ?? 2);
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
    challenge: {
      id: 'bm-pending',
      evalMode: 'picture_graph',
      values: bars,
      graphStyle: 'picture',
      scale: { step: iconValue, max, iconEmoji, iconValue },
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

async function generateScaledBarGraph(topic: string, gradeContext: string, intent: string, tier: SupportTier | null = null): Promise<SubGenResult> {
  const shape = tier ? resolveProblemShape('scaled_bar_graph', tier) : null;
  const tierSection = tier ? buildTierPromptSection('scaled_bar_graph', tier) : '';
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
- targetBarLabel MUST match one of bar0Label..bar4Label; expectedValue MUST equal that bar's value.${tierSection}`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: schema },
  });
  if (!response.text) throw new Error("No content generated (scaled_bar_graph)");
  const raw = JSON.parse(response.text) as Record<string, unknown>;

  // Structural difficulty: the tier forces step coarseness (2 → 5 → 10); a
  // coarser step makes the off-tick interpolation genuinely harder.
  let step = shape?.forcedStep ?? Number(raw.scaleStep ?? 5);
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
    challenge: {
      id: 'bm-pending',
      evalMode: 'scaled_bar_graph',
      values: bars,
      graphStyle: 'scaled_bar',
      scale: { step, max },
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

async function generateGraphWordProblem(topic: string, gradeContext: string, intent: string, tier: SupportTier | null = null): Promise<SubGenResult> {
  const tierSection = tier ? buildTierPromptSection('graph_word_problem', tier) : '';
  // Number pool service (per PRD §6a #2): Gemini structured output is convergent
  // for numeric values, so left to itself every parallel call picks bars that
  // back-solve to the same clean answer (the "all hard answers = 5" cluster).
  // We OWN the randomness — inject a fresh random pool of candidate bar values
  // per call so the four independent challenges diverge. SAFE here (unlike the
  // counting-to-N primitives the pool once broke) because these magnitudes are
  // incidental graph data, NOT the learning target — the pedagogy is the
  // operation, so the pool draws freely from the mode's 2-40 display band. The
  // tier owns operation DEPTH (structural), never the magnitude → pool range is
  // tier-independent. See [[feedback_llm-window-code-builds-structure]].
  const pool = createNumberPool({ min: 2, max: 40 }, { count: 8, integers: true });
  const poolSection = pool
    ? '\n\n' + pool.toPromptSection({
        label: 'BAR VALUE POOL',
        usePrimaryInstruction: false,
        extraInstructions:
          '- Assign FOUR DIFFERENT numbers from this pool to bar0Value..bar3Value.\n' +
          '- Build your question around the bars you assigned, then set expectedValue to the EXACT arithmetic result on those values.\n' +
          '- Do NOT reshape the pool to hit a round answer — the answer is whatever your chosen bars produce.',
      })
    : '';
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
- EXACTLY 4 bars. Use FOUR DIFFERENT values from the BAR VALUE POOL below — do NOT invent your own.
- scaleStep MUST be 2, 5, or 10.
- prompt asks ONE of: "How many more X than Y?" / "How many fewer X than Y?" / "What's the total of X and Y?"
  Name two specific bar labels in the question. Sums ≤ 40, differences ≤ 20.
- expectedValue MUST be the correct arithmetic result from the bars you assigned.
- hint: guide the operation ("subtract", "add") without naming the answer.
- Do NOT hint at or name a single bar as the "target" — this is integration across bars.${poolSection}${tierSection}`;

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
    challenge: {
      id: 'bm-pending',
      evalMode: 'graph_word_problem',
      values: bars,
      graphStyle: 'scaled_bar',
      scale: { step, max },
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

async function generateBuildGraph(topic: string, gradeContext: string, intent: string, tier: SupportTier | null = null): Promise<SubGenResult> {
  const tierSection = tier ? buildTierPromptSection('build_graph', tier) : '';
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
- hint: guide scale choice without naming the step.${tierSection}`;

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
    challenge: {
      id: 'bm-pending',
      evalMode: 'build_graph',
      values: zeroedBars,
      graphStyle: 'scaled_bar',
      scale: { step: expectedStep, max },
      prompt: String(raw.prompt ?? `Build the graph: ${answerBars.map((b) => `${b.label}=${b.value}`).join(', ')}. Choose the best scale.`),
      hint: String(raw.hint ?? 'Look at your largest value — which step lets it fit without lots of empty space?'),
      expectedDataset: answerBars.map((b) => ({ label: b.label, value: b.value })),
      expectedScaleStep: expectedStep,
      availableScaleSteps: [1, 2, 5, 10],
    },
  };
}

// ===========================================================================
// Orchestrator: fan out N parallel sub-generator calls for one eval mode
// ===========================================================================

function subGeneratorFor(mode: BarModelEvalMode): (topic: string, gradeContext: string, intent: string, tier?: SupportTier | null) => Promise<SubGenResult> {
  switch (mode) {
    case 'read_scale':         return generateReadScale;
    case 'picture_graph':      return generatePictureGraph;
    case 'scaled_bar_graph':   return generateScaledBarGraph;
    case 'graph_word_problem': return generateGraphWordProblem;
    case 'build_graph':        return generateBuildGraph;
    case 'compare_bars':
    default:                   return generateCompareBars;
  }
}

export const generateBarModel = async (
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
    /** How many challenges in this session. Defaults from COUNT_BY_MODE (5 for T2 compare_bars, 4 for T3/unclassified). */
    instanceCount?: number;
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which skill,
     * difficulty = how much on-screen scaffolding within it. NEVER changes numbers.
     */
    difficulty?: string;
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
  const modeCount = COUNT_BY_MODE[mode];
  const instanceCount = Math.max(
    1,
    Math.min(
      MAX_INSTANCE_COUNT,
      config?.instanceCount ?? modeCount ?? DEFAULT_INSTANCE_COUNT,
    ),
  );

  // Support tier (config.difficulty) drives BOTH axes: scaffolding withdrawal
  // (applied to the rendered challenge below) AND structural problem difficulty
  // (threaded into each sub-generator's prompt + post-process). bar-model is
  // single-mode per session, so the tier resolves once for `mode`.
  const supportTier = normalizeSupportTier(config?.difficulty);

  // Fan out N parallel calls of the same per-mode sub-generator. Variance
  // comes from independent generations (per PRD §6a #2 — structured output
  // converges per-call, not across independent calls).
  const runOne = subGeneratorFor(mode);
  const subResults = await Promise.all(
    Array.from({ length: instanceCount }, () => runOne(topic, gradeContext, intent, supportTier)),
  );

  // First sub-result provides session-level title/description; both are
  // topic-anchored across all calls so any of them works as the umbrella.
  const head = subResults[0];
  const challenges: BarModelChallenge[] = subResults.map((r, idx) => ({
    ...r.challenge,
    id: `bm-${idx + 1}`,
  }));

  // Apply the support tier deterministically AFTER structural assembly. Resolve
  // each challenge's scaffold from its OWN mode (so a future blended session
  // still gets difficulty); single-mode just gives every challenge the same one.
  // Code owns the support STRUCTURE; the LLM only chose the numbers (unchanged).
  if (supportTier) {
    for (const ch of challenges) {
      const sc = resolveSupportStructure(ch.evalMode, supportTier);
      ch.showBarValues = sc.showBarValues;
      ch.showTargetHighlight = sc.showTargetHighlight;
      ch.supportTier = supportTier;
    }
    console.log(`[BarModel] Support tier "${supportTier}" applied per-challenge (single-mode ${mode})`);
  }

  console.log('📊 Bar Model generated:', {
    topic,
    mode,
    instanceCount: challenges.length,
    barsPerChallenge: challenges.map((c) => c.values.length),
    graphStyle: challenges[0]?.graphStyle,
  });

  return {
    title: head.title,
    description: head.description,
    challenges,
  };
};
