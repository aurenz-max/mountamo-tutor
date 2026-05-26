import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  NumberLineData,
  NumberLineOperation,
  NumberLineChallenge,
} from "../../primitives/visual-primitives/math/NumberLine";
import {
  resolveEvalModeConstraint,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";
import { createSubRangePool } from './numberPoolService';

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  plot_point: {
    promptDoc:
      `"plot_point": Student places a point at the correct value on the number line. `
      + `K-2: integers 0-20, warm language ("Can you find where 7 lives?"). `
      + `3-5: fractions, decimals, negatives. Concrete manipulative with full guidance.`,
    schemaDescription: "'plot_point' (place value on line)",
  },
  show_jump: {
    promptDoc:
      `"show_jump": Student shows an operation as movement on the number line. `
      + `K-2: simple +1/+2/+3 jumps within 0-20. 3-5: larger jumps, fractions, negatives.`,
    schemaDescription: "'show_jump' (operation as movement)",
  },
  order_values: {
    promptDoc:
      `"order_values": Student arranges 3-4 values in order on the number line. `
      + `K-2: integers only, typically 3 values within 0-20. `
      + `3-5: fractions, decimals, mixed numbers, negatives.`,
    schemaDescription: "'order_values' (sequence values)",
  },
  find_between: {
    promptDoc:
      `"find_between": Student estimates or finds a value between two given marks. `
      + `Primarily 3-5: fractions between benchmarks, decimals on a zoomed line.`,
    schemaDescription: "'find_between' (estimate between marks)",
  },
};

// ---------------------------------------------------------------------------
// Tuning — per-mode instance counts (see PRD_WITHIN_MODE_INSTANCE_DENSITY.md §5a)
// ---------------------------------------------------------------------------

type ChallengeType = 'plot_point' | 'show_jump' | 'order_values' | 'find_between';

const DEFAULT_INSTANCE_COUNT = 7; // tier fallback (T1)
const MAX_INSTANCE_COUNT = 8;

// NOTE: this primitive uses an orchestrator-per-challenge pattern — each
// sub-generator fans out N parallel single-challenge Gemini calls. Per the
// instance-count audit hook, orchestrator-per-challenge modes are capped at 5
// (not the T1 fallback of 7) to keep cost/latency in check. `plot_point` covers
// both the `plot` and `identify` eval modes; bumping it to 5 is the most we can
// safely do without converting the sub-generator to pool-service.
const COUNT_BY_MODE: Record<ChallengeType, number> = {
  plot_point: 5,
  show_jump: 4,
  order_values: 4,
  find_between: 4,
};

function resolveCount(type: ChallengeType): number {
  return Math.max(1, Math.min(MAX_INSTANCE_COUNT, COUNT_BY_MODE[type] ?? DEFAULT_INSTANCE_COUNT));
}

// ---------------------------------------------------------------------------
// Shared single-challenge text schema (used by every per-mode sub-generator)
// ---------------------------------------------------------------------------
//
// Every per-mode Gemini call now generates ONE challenge worth of text, given
// pre-selected numerics in the prompt. Schema is tiny (4 fields) so Flash Lite
// has zero field-drop risk (SP-14). Session-level metadata is taken from the
// first non-empty result (orchestrator-same-mode pattern, §6a #7).

function buildChallengeTextSchema(): Schema {
  return {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Engaging, age-appropriate session title" },
      description: { type: Type.STRING, description: "Brief explanation of the learning goal for this session" },
      instruction: { type: Type.STRING, description: "Warm, grade-appropriate instruction for THIS specific challenge" },
      hint: { type: Type.STRING, description: "Hint that guides without giving the answer" },
    },
    required: ["title", "description", "instruction", "hint"],
  };
}

interface ChallengeText {
  title: string;
  description: string;
  instruction: string;
  hint: string;
}

async function generateChallengeText(prompt: string): Promise<ChallengeText | null> {
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        temperature: 0.9,
        topP: 0.95,
        responseMimeType: 'application/json',
        responseSchema: buildChallengeTextSchema(),
      },
    });
    if (!result.text) return null;
    const parsed = JSON.parse(result.text);
    if (!parsed?.instruction || !parsed?.hint) return null;
    return {
      title: parsed.title || '',
      description: parsed.description || '',
      instruction: parsed.instruction,
      hint: parsed.hint,
    };
  } catch (e) {
    console.warn('[NumberLine] challenge text generation failed:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Per-mode numeric pickers (pool service — §6a #1, §6a #2)
// ---------------------------------------------------------------------------
//
// Gemini Flash Lite's structured-output mode is convergent for numeric values
// regardless of temperature. To avoid getting the same target/start/etc on
// every parallel call, pre-select the numerics in code.

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function uniqueIntegerPool(min: number, max: number): number[] {
  const result: number[] = [];
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  for (let v = lo; v <= hi; v++) result.push(v);
  return result;
}

interface ResolvedRange {
  min: number;
  max: number;
  numberType: 'integer' | 'fraction' | 'decimal' | 'mixed';
}

function resolvedPoolNumbers(
  config: { numberRange?: { min: number; max: number } } | undefined,
  fallback: { min: number; max: number },
): number[] {
  const pool = createSubRangePool(config?.numberRange, { sorted: true, unique: true, maxSpan: 25 });
  if (pool?.numbers && pool.numbers.length > 0) return [...pool.numbers];
  return uniqueIntegerPool(fallback.min, fallback.max);
}

function selectPlotPointTargets(pool: number[], count: number): number[] {
  const filtered = pool.filter(v => Number.isFinite(v));
  const shuffled = shuffleInPlace(Array.from(new Set(filtered)));
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

interface ShowJumpTuple {
  startValue: number;
  opType: 'add' | 'subtract';
  change: number;
  targetValue: number;
}

function selectShowJumpTuples(
  range: { min: number; max: number },
  gradeBand: 'K-2' | '3-5',
  count: number,
): ShowJumpTuple[] {
  const jumpChoices = gradeBand === 'K-2' ? [1, 2, 3, 4, 5] : [2, 3, 5, 7, 10];
  const tuples: ShowJumpTuple[] = [];
  const seen = new Set<string>();

  // Try every viable combination, then sample.
  const candidates: ShowJumpTuple[] = [];
  for (let start = Math.ceil(range.min); start <= Math.floor(range.max); start++) {
    for (const change of jumpChoices) {
      for (const opType of ['add', 'subtract'] as const) {
        const target = opType === 'add' ? start + change : start - change;
        if (target < range.min || target > range.max) continue;
        candidates.push({ startValue: start, opType, change, targetValue: target });
      }
    }
  }
  shuffleInPlace(candidates);

  for (const c of candidates) {
    const key = `${c.startValue}|${c.opType}|${c.change}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tuples.push(c);
    if (tuples.length >= count) break;
  }
  return tuples;
}

function selectOrderValueSets(
  pool: number[],
  count: number,
  perSet: number,
): number[][] {
  const sets: number[][] = [];
  const seen = new Set<string>();

  for (let attempt = 0; attempt < count * 12 && sets.length < count; attempt++) {
    if (pool.length < perSet) break;
    const shuffled = shuffleInPlace([...pool]).slice(0, perSet);
    const key = [...shuffled].sort((a, b) => a - b).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    sets.push(shuffled);
  }
  return sets;
}

function selectFindBetweenPairs(
  pool: number[],
  count: number,
): Array<[number, number]> {
  if (pool.length < 2) return [];
  const sorted = Array.from(new Set(pool)).sort((a, b) => a - b);
  const pairs: Array<[number, number]> = [];
  const seen = new Set<string>();

  // Build all gapped pairs (gap >= 2 ticks where possible), then sample.
  const candidates: Array<[number, number]> = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 2; j < sorted.length; j++) {
      candidates.push([sorted[i], sorted[j]]);
    }
  }
  if (candidates.length === 0) {
    // Fall back to adjacent pairs.
    for (let i = 0; i < sorted.length - 1; i++) candidates.push([sorted[i], sorted[i + 1]]);
  }
  shuffleInPlace(candidates);

  for (const [a, b] of candidates) {
    const key = `${a}|${b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push([a, b]);
    if (pairs.length >= count) break;
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// Per-mode result container
// ---------------------------------------------------------------------------

type SubResult = {
  title: string;
  description: string;
  range: { min: number; max: number };
  gradeBand: 'K-2' | '3-5';
  numberType: 'integer' | 'fraction' | 'decimal' | 'mixed';
  interactionMode: 'plot' | 'jump' | 'compare' | 'order';
  challenges: NumberLineChallenge[];
  highlights: { label: string; value: number }[];
  operations: NumberLineOperation[];
};

function emptySubResult(interactionMode: SubResult['interactionMode']): SubResult {
  return {
    title: '', description: '',
    range: { min: 0, max: 10 },
    gradeBand: 'K-2', numberType: 'integer',
    interactionMode,
    challenges: [], highlights: [], operations: [],
  };
}

function resolveGradeBand(gradeLevel: string): 'K-2' | '3-5' {
  const lower = gradeLevel.toLowerCase();
  return lower.includes('k') || lower.includes('1') || lower.includes('2') ? 'K-2' : '3-5';
}

// ---------------------------------------------------------------------------
// Per-mode sub-generators (orchestrator-same-mode, §6a #7)
// ---------------------------------------------------------------------------

async function generatePlotPointChallenges(
  topic: string,
  gradeLevel: string,
  config?: { targetEvalMode?: string; numberRange?: { min: number; max: number }; difficulty?: string },
): Promise<SubResult> {
  const isIdentify = config?.targetEvalMode === 'identify';
  const gradeBand: 'K-2' | '3-5' = isIdentify ? 'K-2' : resolveGradeBand(gradeLevel);
  const numberType: ResolvedRange['numberType'] = isIdentify
    ? 'integer'
    : (gradeBand === 'K-2' ? 'integer' : 'decimal');
  const range = isIdentify
    ? { min: 0, max: 10 }
    : (config?.numberRange ?? { min: 0, max: 20 });

  const poolNumbers = isIdentify
    ? uniqueIntegerPool(0, 10)
    : resolvedPoolNumbers(config, range);
  const targets = selectPlotPointTargets(poolNumbers, resolveCount('plot_point'));
  if (targets.length === 0) return emptySubResult('plot');

  const modeBanner = isIdentify
    ? 'IDENTIFY MODE (Kindergarten): use very warm, simple language. Every tick is labeled; this is pure number recognition.'
    : `GRADE BAND: ${gradeBand}. ${gradeBand === 'K-2' ? 'Use counting language, warm tone.' : 'Concise, neutral tone.'}`;

  const promptFor = (target: number, index: number) => `Create text for ONE Number Line PLOT challenge for "${topic}" (Grade ${gradeLevel}).

${modeBanner}

This is challenge ${index + 1} of ${targets.length} in a session that asks the student to plot a target value on a number line ranging from ${range.min} to ${range.max}.

For THIS challenge the target value is: ${target}

Return ONLY:
- title: an engaging session title (will be shared across all challenges in this session)
- description: a brief session-level learning goal
- instruction: a warm, grade-appropriate instruction that asks the student to plot ${target} on the number line (you may vary phrasing across calls — "Can you find...", "Show me where...", "Place a point at...", etc.)
- hint: a hint that guides the student to ${target} WITHOUT naming the number directly (e.g. reference neighboring tick marks or counting from a benchmark)`;

  const texts = await Promise.all(targets.map((t, i) => generateChallengeText(promptFor(t, i))));

  const wrapperSource = texts.find(t => t && t.title) ?? texts.find(t => !!t) ?? null;
  const challenges: NumberLineChallenge[] = targets.map((target, i) => {
    const text = texts[i];
    const instruction = text?.instruction ?? `Can you find ${target} on the number line?`;
    const hint = text?.hint ?? 'Count the tick marks from the start.';
    return {
      id: `plot_point-${i}`,
      type: 'plot_point',
      instruction,
      targetValues: [target],
      hint,
    };
  });

  return {
    title: wrapperSource?.title || `Number Line: ${topic}`,
    description: wrapperSource?.description || '',
    range,
    gradeBand,
    numberType,
    interactionMode: 'plot',
    challenges,
    highlights: [],
    operations: [],
  };
}

async function generateShowJumpChallenges(
  topic: string,
  gradeLevel: string,
  config?: { numberRange?: { min: number; max: number }; difficulty?: string },
): Promise<SubResult> {
  const gradeBand = resolveGradeBand(gradeLevel);
  const range = config?.numberRange ?? { min: 0, max: gradeBand === 'K-2' ? 20 : 30 };
  const tuples = selectShowJumpTuples(range, gradeBand, resolveCount('show_jump'));
  if (tuples.length === 0) return emptySubResult('jump');

  const promptFor = (t: ShowJumpTuple, index: number) => `Create text for ONE Number Line JUMP challenge for "${topic}" (Grade ${gradeLevel}).

GRADE BAND: ${gradeBand}. ${gradeBand === 'K-2' ? 'Use counting language, warm tone.' : 'Concise, neutral tone.'}

This is challenge ${index + 1} of ${tuples.length} in a session on a number line ranging from ${range.min} to ${range.max}.

For THIS challenge:
- Start position: ${t.startValue}
- Operation: ${t.opType === 'add' ? `add ${t.change} (jump right)` : `subtract ${t.change} (jump left)`}
- Landing value: ${t.targetValue}

Return ONLY:
- title: an engaging session title (shared across all challenges)
- description: a brief session-level learning goal
- instruction: a warm, grade-appropriate instruction telling the student to start at ${t.startValue} and ${t.opType === 'add' ? 'jump forward' : 'jump back'} ${t.change} (you may vary phrasing — "Start at X and hop forward Y", "Begin at X. Take Y jumps to the right", etc.)
- hint: a hint that guides counting the hops WITHOUT giving the landing number directly`;

  const texts = await Promise.all(tuples.map((t, i) => generateChallengeText(promptFor(t, i))));

  const wrapperSource = texts.find(t => t && t.title) ?? texts.find(t => !!t) ?? null;
  const challenges: NumberLineChallenge[] = tuples.map((t, i) => {
    const text = texts[i];
    const instruction = text?.instruction
      ?? `Start at ${t.startValue} and jump ${t.opType === 'add' ? 'forward' : 'back'} ${t.change}. Where do you land?`;
    const hint = text?.hint ?? `Count ${t.change} hops to the ${t.opType === 'add' ? 'right' : 'left'} from ${t.startValue}.`;
    return {
      id: `show_jump-${i}`,
      type: 'show_jump',
      instruction,
      targetValues: [t.targetValue],
      hint,
      startValue: t.startValue,
      operations: [{
        type: t.opType,
        startValue: t.startValue,
        changeValue: t.change,
        showJumpArc: false,
      }],
    };
  });

  // Backward-compat global operations.
  const globalOps = challenges[0]?.operations ?? [];

  return {
    title: wrapperSource?.title || `Number Line Jumps: ${topic}`,
    description: wrapperSource?.description || '',
    range,
    gradeBand,
    numberType: 'integer',
    interactionMode: 'jump',
    challenges,
    highlights: [],
    operations: globalOps,
  };
}

async function generateOrderValuesChallenges(
  topic: string,
  gradeLevel: string,
  config?: { numberRange?: { min: number; max: number }; difficulty?: string },
): Promise<SubResult> {
  const gradeBand = resolveGradeBand(gradeLevel);
  const range = config?.numberRange ?? { min: 0, max: gradeBand === 'K-2' ? 20 : 30 };
  const perSet = gradeBand === 'K-2' ? 3 : 4;
  const poolNumbers = resolvedPoolNumbers(config, range);
  const sets = selectOrderValueSets(poolNumbers, resolveCount('order_values'), perSet);
  if (sets.length === 0) return emptySubResult('order');

  const promptFor = (values: number[], index: number) => `Create text for ONE Number Line ORDER challenge for "${topic}" (Grade ${gradeLevel}).

GRADE BAND: ${gradeBand}.

This is challenge ${index + 1} of ${sets.length} in a session on a number line ranging from ${range.min} to ${range.max}.

For THIS challenge the student must arrange these values in order: ${values.join(', ')}.

Return ONLY:
- title: an engaging session title (shared across all challenges)
- description: a brief session-level learning goal
- instruction: a warm, grade-appropriate instruction asking the student to put the values in order from smallest to largest
- hint: a hint that guides comparison WITHOUT giving the answer (e.g. "Find each number on the line first" or "Compare two at a time")`;

  const texts = await Promise.all(sets.map((s, i) => generateChallengeText(promptFor(s, i))));

  const wrapperSource = texts.find(t => t && t.title) ?? texts.find(t => !!t) ?? null;
  const challenges: NumberLineChallenge[] = sets.map((values, i) => {
    const text = texts[i];
    const instruction = text?.instruction ?? 'Put these numbers in order from smallest to largest.';
    const hint = text?.hint ?? 'Find each number on the line. Which is furthest left?';
    return {
      id: `order_values-${i}`,
      type: 'order_values',
      instruction,
      targetValues: values,
      hint,
    };
  });

  return {
    title: wrapperSource?.title || `Number Line Order: ${topic}`,
    description: wrapperSource?.description || '',
    range,
    gradeBand,
    numberType: gradeBand === 'K-2' ? 'integer' : 'decimal',
    interactionMode: 'order',
    challenges,
    highlights: [],
    operations: [],
  };
}

async function generateFindBetweenChallenges(
  topic: string,
  gradeLevel: string,
  config?: { numberRange?: { min: number; max: number }; difficulty?: string },
): Promise<SubResult> {
  const gradeBand = resolveGradeBand(gradeLevel);
  const range = config?.numberRange ?? { min: 0, max: 10 };
  const poolNumbers = resolvedPoolNumbers(config, range);
  const pairs = selectFindBetweenPairs(poolNumbers, resolveCount('find_between'));
  if (pairs.length === 0) return emptySubResult('compare');

  const promptFor = ([b0, b1]: [number, number], index: number) => `Create text for ONE Number Line FIND-BETWEEN challenge for "${topic}" (Grade ${gradeLevel}).

GRADE BAND: ${gradeBand}.

This is challenge ${index + 1} of ${pairs.length} in a session on a number line ranging from ${range.min} to ${range.max}.

For THIS challenge the student must find a value strictly between ${b0} and ${b1}.

Return ONLY:
- title: an engaging session title (shared across all challenges)
- description: a brief session-level learning goal
- instruction: a warm, grade-appropriate instruction asking the student to find a number between ${b0} and ${b1}
- hint: a hint that guides reasoning between the two boundaries WITHOUT naming a specific answer`;

  const texts = await Promise.all(pairs.map((p, i) => generateChallengeText(promptFor(p, i))));

  const wrapperSource = texts.find(t => t && t.title) ?? texts.find(t => !!t) ?? null;
  const challenges: NumberLineChallenge[] = pairs.map(([b0, b1], i) => {
    const text = texts[i];
    const instruction = text?.instruction ?? `Find a number between ${b0} and ${b1}.`;
    const hint = text?.hint ?? 'Look at the tick marks between the two values.';
    return {
      id: `find_between-${i}`,
      type: 'find_between',
      instruction,
      targetValues: [b0, b1],
      hint,
    };
  });

  return {
    title: wrapperSource?.title || `Number Line: Find Between — ${topic}`,
    description: wrapperSource?.description || '',
    range,
    gradeBand,
    numberType: gradeBand === 'K-2' ? 'integer' : 'decimal',
    interactionMode: 'compare',
    challenges,
    highlights: [],
    operations: [],
  };
}

// ---------------------------------------------------------------------------
// Fallback challenges
// ---------------------------------------------------------------------------

function buildFallbackChallenge(type: string, range: { min: number; max: number }): NumberLineChallenge {
  const mid = Math.round((range.min + range.max) / 2);

  const fallbacks: Record<string, NumberLineChallenge> = {
    plot_point: {
      id: 'fallback-0', type: 'plot_point',
      instruction: `Can you find ${mid} on the number line?`,
      targetValues: [mid],
      hint: 'Count the tick marks from the start.',
    },
    show_jump: {
      id: 'fallback-0', type: 'show_jump',
      instruction: `Start at ${range.min} and jump forward 3. Where do you land?`,
      targetValues: [range.min + 3],
      hint: 'Count 3 hops to the right from the start.',
      startValue: range.min,
      operations: [{ type: 'add', startValue: range.min, changeValue: 3, showJumpArc: false }],
    },
    order_values: {
      id: 'fallback-0', type: 'order_values',
      instruction: 'Put these numbers in order from smallest to largest.',
      targetValues: [range.min + 1, mid, range.max - 1],
      hint: 'Find each number on the line. Which is furthest left?',
    },
    find_between: {
      id: 'fallback-0', type: 'find_between',
      instruction: `Find a number between ${range.min + 1} and ${mid}.`,
      targetValues: [range.min + 1, mid],
      hint: 'Look at the tick marks between the two values.',
    },
  };

  return fallbacks[type] ?? fallbacks.plot_point;
}

// ---------------------------------------------------------------------------
// Top-level orchestrator
// ---------------------------------------------------------------------------

/**
 * Generate interactive Number Line content.
 *
 * Two-layer orchestration:
 *   1. Top level dispatches per allowed eval-mode challenge type.
 *   2. Each per-mode sub-generator pre-selects N=4 numeric challenge tuples
 *      via a local pool service (avoids §6a #2 Gemini convergence on numbers),
 *      then fans out N parallel single-challenge Gemini calls for instruction
 *      and hint text. Session-level title/description are taken from the first
 *      non-empty result.
 *
 * Per-call schema is 4 fields — no SP-14 field-drop risk.
 */
export const generateNumberLine = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{
    intent: string;
    targetEvalMode: string;
    numberRange: { min: number; max: number };
    difficulty: string;
  }>
): Promise<NumberLineData> => {
  // Resolve eval mode from the catalog (single source of truth).
  const evalConstraint = resolveEvalModeConstraint(
    'number-line',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('NumberLine', config?.targetEvalMode, evalConstraint);

  const allowedTypes = evalConstraint
    ? evalConstraint.allowedTypes
    : ['plot_point', 'show_jump', 'order_values', 'find_between'];

  const pool = createSubRangePool(config?.numberRange, { sorted: true, unique: true, maxSpan: 25 });
  console.log(`[NumberLine] display:`, pool?.displayRange ?? 'none', `pool:`, pool?.numbers ?? 'none', `difficulty:`, config?.difficulty ?? 'none');

  const subConfig = {
    targetEvalMode: config?.targetEvalMode,
    numberRange: config?.numberRange,
    difficulty: config?.difficulty,
  };

  // Dispatch per-mode sub-generators in parallel.
  const generators: Promise<SubResult>[] = [];

  if (allowedTypes.includes('plot_point')) {
    generators.push(generatePlotPointChallenges(topic, gradeLevel, subConfig));
  }
  if (allowedTypes.includes('show_jump')) {
    generators.push(generateShowJumpChallenges(topic, gradeLevel, subConfig));
  }
  if (allowedTypes.includes('order_values')) {
    generators.push(generateOrderValuesChallenges(topic, gradeLevel, subConfig));
  }
  if (allowedTypes.includes('find_between')) {
    generators.push(generateFindBetweenChallenges(topic, gradeLevel, subConfig));
  }

  const subResults = await Promise.all(generators);

  const allChallenges = subResults.flatMap(r => r.challenges);
  const primary = subResults.find(r => r.challenges.length > 0) ?? subResults[0] ?? emptySubResult('plot');

  const data: NumberLineData = {
    title: primary.title || `Number Line: ${topic}`,
    description: primary.description || undefined,
    range: primary.range,
    gradeBand: primary.gradeBand,
    numberType: primary.numberType,
    interactionMode: primary.interactionMode,
    challenges: allChallenges,
    highlights: primary.highlights,
    operations: primary.operations,
  };

  // ---------------------------------------------------------------------------
  // Validation & Defaults
  // ---------------------------------------------------------------------------

  if (data.gradeBand !== 'K-2' && data.gradeBand !== '3-5') {
    data.gradeBand = resolveGradeBand(gradeLevel);
  }

  const validNumberTypes = ['integer', 'fraction', 'decimal', 'mixed'];
  if (!data.numberType || !validNumberTypes.includes(data.numberType)) {
    data.numberType = data.gradeBand === 'K-2' ? 'integer' : 'decimal';
  }

  const validModes = ['plot', 'jump', 'compare', 'order'];
  if (!data.interactionMode || !validModes.includes(data.interactionMode)) {
    data.interactionMode = 'plot';
  }

  if (!data.range || typeof data.range.min !== 'number' || typeof data.range.max !== 'number') {
    data.range = { min: 0, max: 10 };
  }
  if (data.range.min >= data.range.max) {
    data.range = { min: 0, max: data.gradeBand === 'K-2' ? 20 : 10 };
  }

  if (data.gradeBand === 'K-2') {
    data.numberType = 'integer';
    data.range.min = Math.max(-1, Math.round(data.range.min));
    data.range.max = Math.min(30, Math.round(data.range.max));
  }

  if (!data.challenges || data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'plot_point';
    console.log(`[NumberLine] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [buildFallbackChallenge(fallbackType, data.range)];
  }

  if (!Array.isArray(data.highlights)) {
    data.highlights = [];
  }
  if (!Array.isArray(data.operations)) {
    data.operations = [];
  }

  const typeBreakdown = data.challenges.map(c => c.type).join(', ');
  console.log(`[NumberLine] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  console.log('Number Line Generated:', {
    topic,
    gradeBand: data.gradeBand,
    mode: data.interactionMode,
    numberType: data.numberType,
    range: `${data.range.min}-${data.range.max}`,
    challengeCount: data.challenges.length,
    operationCount: data.operations?.length || 0,
  });

  return data;
};
