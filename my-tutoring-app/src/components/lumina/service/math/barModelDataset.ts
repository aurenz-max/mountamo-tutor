/**
 * barModelDataset.ts — the `bar-model.dataset` context axis (docs/CONTEXT_AXES.md pilot).
 *
 * bar-model's K graphs draw categories from code pools (K_SETTINGS, GRAPH_THEMES), give
 * every graph random counts, and label every two-graph pair "Morning" and "Afternoon".
 * Right for a K math survey; wrong for "compare weather patterns between different
 * locations and times" (science K review 2026-10-17: toys and snacks, Morning vs Afternoon,
 * snowy days winning in July).
 *
 * The axis reads three things from the lesson:
 * - categories: what the graph counts, only when that thing is the lesson's subject;
 * - contexts: the places or times the lesson compares;
 * - per context, the most-to-fewest order, only when the world fixes it.
 * The model supplies the domain fact (January has more snowy days than sunny ones).
 * Code makes counts that obey it and keeps owning every number and answer. No request
 * means the caller's pools run unchanged.
 */

import { Type, Schema } from "@google/genai";
import { resolveContextAxis, type AxisSpec } from "../contextAxis";
import type { PedagogicalScope } from "../scopeContext";

export interface DatasetCategory { label: string; emoji: string }
export interface DatasetContext {
  name: string;
  /** Category labels from most to fewest; empty when the world fixes no order. */
  order: string[];
}
export interface BarDataset {
  /** 2-4 categories, or empty when the lesson names no subject to graph. */
  categories: DatasetCategory[];
  /** 0 or 2-4 places or times. */
  contexts: DatasetContext[];
}

const MAX_CATEGORIES = 4;
const MAX_CONTEXTS = 4;

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    categories: {
      type: Type.ARRAY, maxItems: String(MAX_CATEGORIES),
      description: 'The kinds of thing the graph counts. Empty when the lesson names no subject to graph.',
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING, description: 'Short plural label a young child knows, e.g. "snowy days".' },
          emoji: { type: Type.STRING, description: 'ONE emoji picturing it. Emoji only.' },
        },
        required: ['label', 'emoji'],
      },
    },
    contexts: {
      type: Type.ARRAY, maxItems: String(MAX_CONTEXTS),
      description: 'The places or times the lesson compares. Empty when it compares none.',
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'One to three words, e.g. "January", "the beach".' },
          mostToFewest: {
            type: Type.ARRAY, maxItems: String(MAX_CATEGORIES),
            description: 'Category labels from most to fewest for this context, or empty.',
            items: { type: Type.STRING },
          },
        },
        required: ['name', 'mostToFewest'],
      },
    },
  },
  required: ['categories', 'contexts'],
};

/** Keep an emoji, drop a word. */
function cleanEmoji(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s || /[A-Za-z0-9]/.test(s)) return null;
  const cps = Array.from(s);
  return cps.length <= 3 ? s : cps[0];
}

export function validateDataset(parsed: any): BarDataset {
  const categories: DatasetCategory[] = [];
  const seenLabel = new Set<string>();
  const seenEmoji = new Set<string>();
  for (const c of Array.isArray(parsed?.categories) ? parsed.categories : []) {
    const label = typeof c?.label === 'string' ? c.label.trim() : '';
    const emoji = cleanEmoji(c?.emoji);
    if (!label || !emoji || seenLabel.has(label.toLowerCase()) || seenEmoji.has(emoji)) continue;
    seenLabel.add(label.toLowerCase());
    seenEmoji.add(emoji);
    categories.push({ label, emoji });
    if (categories.length >= MAX_CATEGORIES) break;
  }
  // One category is not a graph to compare; contexts without categories count nothing.
  if (categories.length < 2) return { categories: [], contexts: [] };

  const byLower = new Map(categories.map((c) => [c.label.toLowerCase(), c.label]));
  const contexts: DatasetContext[] = [];
  const seenCtx = new Set<string>();
  for (const x of Array.isArray(parsed?.contexts) ? parsed.contexts : []) {
    const trimmed = typeof x?.name === 'string' ? x.name.trim() : '';
    const name = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    if (!name || seenCtx.has(name.toLowerCase())) continue;
    seenCtx.add(name.toLowerCase());
    const raw = (Array.isArray(x?.mostToFewest) ? x.mostToFewest : [])
      .map((l: unknown) => byLower.get(String(l ?? '').trim().toLowerCase()));
    // An order counts only as a full ranking of exactly these categories.
    const order = raw.length === categories.length && new Set(raw).size === raw.length && raw.every(Boolean)
      ? raw as string[] : [];
    contexts.push({ name, order });
    if (contexts.length >= MAX_CONTEXTS) break;
  }
  return { categories, contexts: contexts.length >= 2 ? contexts : contexts.slice(0, 1) };
}

const datasetAxis: AxisSpec<BarDataset> = {
  id: 'bar-model.dataset',
  activity: 'A picture graph',
  instructions: `Report what the lesson asks the graph to show. Do not fill in a default: the app has its own graph topics for lessons about graphing in general.

- categories: ONLY when the thing being counted is itself the lesson's subject (kinds of weather day, animals in a habitat, foods at a festival): the 2-4 kinds of thing the graph counts, as short plural labels a young child knows, each with ONE emoji. If the lesson is about graphing, counting or sorting in general and names no subject to graph, return an empty array.
- contexts: ONLY when the lesson compares places or times (two months, two seasons, two towns): 2-4 concrete ones a young child knows. If the lesson says only "different places" or "different times", choose concrete examples that differ clearly. Otherwise an empty array.
- mostToFewest, for each context: the category labels ordered from most to fewest, ONLY when the real world fixes that order for that context (a cold town in January has more snowy days than sunny days). Use the category labels exactly. Empty array when the order is not a fact about the world.`,
  schema,
  validate: validateDataset,
};

export async function resolveBarDataset(scope: PedagogicalScope, gradeLevel: string): Promise<BarDataset | null> {
  const out = await resolveContextAxis(datasetAxis, scope, gradeLevel);
  return out && out.categories.length ? out : null;
}

// ---------------------------------------------------------------------------
// Counts — code owns every number
// ---------------------------------------------------------------------------

function shuffle<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * One distinct count per category in [min, max]. Without an order they are random, as the
 * pools are today. With one, the range is cut into one band per rank, high to low, and
 * each rank draws from its own band: the order holds and the gap is visible (a summer
 * graph cannot show six snowy days because sunny days drew nine).
 */
export function countsFor(labels: string[], order: string[], min: number, max: number,
  rand: () => number = Math.random): number[] {
  const n = labels.length;
  if (!order.length) {
    const pool: number[] = [];
    for (let v = min; v <= max; v++) pool.push(v);
    return shuffle(pool, rand).slice(0, n);
  }
  const width = (max - min + 1) / n;
  const byRank = Array.from({ length: n }, (_, r) => {
    const hi = Math.floor(max - r * width);
    const lo = Math.max(min, Math.ceil(max - (r + 1) * width + 1));
    return lo + Math.floor(rand() * (hi - lo + 1));
  });
  return labels.map((l) => byRank[order.indexOf(l)]);
}

/** Does `counts` rank strictly as `order` says? An empty order holds for anything. */
export function obeysOrder(labels: string[], counts: number[], order: string[]): boolean {
  for (let k = 1; k < order.length; k++) {
    if (!(counts[labels.indexOf(order[k - 1])] > counts[labels.indexOf(order[k])])) return false;
  }
  return true;
}

/**
 * Index of a row that can hold the same count in both graphs without breaking either
 * order, after setting it; null when no row can. Mutates `second` on success.
 */
export function makeOneRowSame(labels: string[], first: number[], second: number[], orderB: string[],
  preferred: number): number | null {
  for (let k = 0; k < labels.length; k++) {
    const i = (preferred + k) % labels.length;
    const trial = [...second];
    trial[i] = first[i];
    if (new Set(trial).size === trial.length && obeysOrder(labels, trial, orderB)) {
      second.splice(0, second.length, ...trial);
      return i;
    }
  }
  return null;
}
