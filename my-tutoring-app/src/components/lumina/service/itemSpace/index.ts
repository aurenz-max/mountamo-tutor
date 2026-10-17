/**
 * Item spaces: strands where code lists every problem, knows each one's difficulty, and picks by it.
 *
 * A generator asks `resolveItemSpace(objective)` whether the lesson objective is a strand code owns
 * (one flash-lite enum call: the LLM fits the objective to a strand, code picks the problems). If it
 * is, the generator takes its problems from the strand at the requested difficulty and lets the LLM
 * write only the words. Difficulty arrives one way, as `config.difficulty` (easy / medium / hard):
 * lessons set it, and Pulse sets it in code from its target beta (practice-manifest.ts). Pulse's beta
 * is on its own 0-10 mode scale, not this one, so it is never passed here raw.
 */
import { Type } from '@google/genai';
import { ai } from '../geminiClient';
import { ADD_SUB_20 } from './addSub20';
import { BONDS_10 } from './bonds10';
import { COMPARE_20, COMPARE_100 } from './compareStories';
import { COMPARE_NUMBERS } from './compareNumbers';
import { RATIO_MISSING_VALUE } from './ratioMissingValue';
import { PERCENT_OF } from './percentOf';
import { EQUIVALENCE_20 } from './equivalence20';
import { FRACTION_ADD_SUB } from './fractionAddSub';
import { FRACTION_EQUIVALENCE } from './fractionEquivalence';
import { FRACTION_COMPARE } from './fractionCompare';
import { SKIP_COUNT } from './skipCount';
import { DIV_MULTI_DIGIT, DIV_MULTI_DIGIT_5 } from './divisionMultiDigit';
import { ADD_SUB_100, ADD_SUB_1000 } from './multiDigit';
import { ROUNDING } from './rounding';
import { MULT_DIV_FACTS } from './multDivFacts';
import { MULT_MULTI_DIGIT, MULT_MULTI_DIGIT_5 } from './multiDigitMult';
import { TWO_STEP_EQUATIONS } from './twoStepEquations';
import { CLOCK_TIME, ELAPSED_TIME } from './time';
import { COIN_SETS, MAKE_CHANGE } from './money';
import type { ItemSpace } from './types';

export type { ItemSpace } from './types';

/** Every item space. Add a strand here and the resolver offers it; consumers need no change. */
const SPACES = {
  'add-sub-20': ADD_SUB_20, 'bonds-10': BONDS_10, 'equivalence-20': EQUIVALENCE_20, 'mult-div-facts': MULT_DIV_FACTS,
  'add-sub-100': ADD_SUB_100, 'add-sub-1000': ADD_SUB_1000, 'fraction-add-sub': FRACTION_ADD_SUB, 'fraction-equivalence': FRACTION_EQUIVALENCE, 'round-10-100': ROUNDING,
  'two-step-equations': TWO_STEP_EQUATIONS, 'mult-multi-digit': MULT_MULTI_DIGIT,
  'mult-multi-digit-5': MULT_MULTI_DIGIT_5,
  'compare-20': COMPARE_20, 'compare-100': COMPARE_100, 'compare-numbers': COMPARE_NUMBERS,
  'ratio-missing-value': RATIO_MISSING_VALUE, 'percent-of': PERCENT_OF,
  'fraction-compare': FRACTION_COMPARE, 'skip-count': SKIP_COUNT,
  'div-multi-digit': DIV_MULTI_DIGIT, 'div-multi-digit-5': DIV_MULTI_DIGIT_5,
  'clock-time': CLOCK_TIME, 'elapsed-time': ELAPSED_TIME, 'coin-sets': COIN_SETS, 'make-change': MAKE_CHANGE,
} satisfies Record<string, ItemSpace<any>>;
export type ItemSpaceId = keyof typeof SPACES;
export const getItemSpace = (id: ItemSpaceId): ItemSpace<any> => SPACES[id];

/** Beta bands (logits for a typical learner at the strand's grade) per lesson tier. */
export const TIER_BANDS: Record<'easy' | 'medium' | 'hard', [number, number]> = {
  easy: [-2.5, -0.6],
  medium: [-0.6, 0.6],
  hard: [0.6, 3.5],
};

/** The beta band for a tier, or null when no tier is set. */
export function difficultyBand(difficulty?: string): [number, number] | null {
  const tier = difficulty?.toLowerCase().trim();
  return tier === 'easy' || tier === 'medium' || tier === 'hard' ? TIER_BANDS[tier] : null;
}

type PickFn = (n: number, lo: number, hi: number, rand?: () => number, accept?: (item: any) => boolean) => any[];

/**
 * The space's `pick`, with one fallback for a narrow scope. When any tier's band holds too few items
 * the consumer can draw (within 10, a one-step sum with the result unknown is never "hard" for a
 * grade-1 learner), every tier picks from its third of the drawable items ranked by beta instead, so
 * easy < medium < hard still holds inside the lesson's scope. Mixing the two (medium from its band,
 * hard from the top third) put hard below medium. The absolute band is not kept on this path, and the
 * log says so. A sampled space (no `items`) has no fallback.
 *
 * `scope` is what the lesson's scope can draw, independent of the tier. A consumer whose `accept`
 * changes with the tier (build-equation's part-whole tier takes additions only) passes it, so the
 * decision and the thirds are the same for every tier; without it, `accept` is the scope.
 */
export function tierPick(space: ItemSpace<any>, log?: (msg: string) => void, scope?: (item: any) => boolean): PickFn {
  return (n, lo, hi, rand, accept) => {
    const tiers = Object.values(TIER_BANDS);
    const tier = tiers.findIndex(([tlo, thi]) => tlo === lo && thi === hi);
    if (tier < 0 || !space.items) return space.pick(n, lo, hi, rand, accept);
    const inScope = scope ?? accept;
    const betas = space.items().filter((it) => !inScope || inScope(it)).map((it) => it.beta).sort((a, b) => a - b);
    const inBand = ([blo, bhi]: [number, number]) => betas.filter((b) => b >= blo && b <= bhi).length;
    if (tiers.every((b) => inBand(b) >= n)) return space.pick(n, lo, hi, rand, accept);
    // Too few items for three tiers of n (addition within 5 holds ten): no tier takes the space, so
    // easy and hard never come from two different paths (easy filled from its band, the rest fell back).
    if (betas.length < 3 * n) {
      log?.(`this scope holds ${betas.length} drawable items, too few for three tiers of ${n}; no tier uses the space`);
      return [];
    }
    const at = (q: number) => betas[Math.min(betas.length - 1, Math.floor(q * betas.length))];
    const rlo = tier === 0 ? betas[0] : at(tier / 3);
    const rhi = tier === 2 ? betas[betas.length - 1] : at((tier + 1) / 3);
    const relative = space.pick(n, rlo, rhi, rand, accept);
    log?.(`this scope cannot fill every tier's band (${tiers.map((b) => inBand(b)).join('/')} drawable); `
      + `tier third [${rlo.toFixed(2)}, ${rhi.toFixed(2)}] gave ${relative.length}`);
    return relative.length >= n ? relative : space.pick(n, lo, hi, rand, accept);
  };
}

/**
 * The tier's window of an ordered list of whole-session choices (wholes to decompose, totals to split),
 * for a mode whose difficulty is one ordered quantity rather than an item space: easy takes the low
 * end, hard the high end, medium the middle. The window holds at least `count` + 1 values, so runs
 * vary; a list too short to give three tiers two different windows is returned whole.
 */
export function tierWindow<T>(sorted: readonly T[], tier: 'easy' | 'medium' | 'hard', count: number): T[] {
  const size = sorted.length >= 2 * count ? Math.max(count + 1, Math.ceil(sorted.length / 2)) : sorted.length;
  const start = tier === 'easy' ? 0 : tier === 'hard' ? sorted.length - size : Math.floor((sorted.length - size) / 2);
  return sorted.slice(start, start + size);
}

const resolved = new Map<string, ItemSpaceId | null>();

/**
 * Which item space, if any, an objective is. Null when none fits or the call fails. `only` limits the
 * choice to the spaces a consumer can draw, so adding a space never takes an objective away from a
 * consumer that cannot use it (a within-10 fact drill must not resolve to bonds-10).
 */
export async function resolveItemSpace(objective: string, grade?: string, only?: readonly ItemSpaceId[]): Promise<ItemSpaceId | null> {
  const key = `${grade ?? ''}|${only?.join(',') ?? '*'}|${objective.trim().toLowerCase()}`;
  if (resolved.has(key)) return resolved.get(key)!;
  // A space whose task needs a picture (a clock to read) goes only to a consumer that names it.
  const ids = (Object.keys(SPACES) as ItemSpaceId[])
    .filter((id) => (only ? only.includes(id) : !(SPACES[id] as ItemSpace<any>).needsPicture));
  const candidates = ids.filter((id) => !grade || SPACES[id].grades.includes(grade));
  if (!candidates.length || !objective.trim()) return null;
  // The topics no space covers. Money and time are among them unless a money or time space is offered.
  const elsewhere = ['counting', 'place value', 'comparing', 'measuring', 'money', 'time', 'shapes']
    .filter((w) => !candidates.some((id) => SPACES[id].describe.startsWith(`${w}:`) || SPACES[id].describe.includes(` ${w}:`)));
  let pick: ItemSpaceId | null = null;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: `A lesson objective: "${objective}".\n\nDoes this objective ask the learner to do exactly one of these, `
        + `and nothing broader or different? Answer "none" if it is about something else (${elsewhere.join(', ')}, `
        + `or a wider range of numbers). When more than one fits, `
        + `answer the one that fits most closely.\n\n`
        + candidates.map((id) => `- ${id}: ${SPACES[id].describe}`).join('\n'),
      config: {
        responseMimeType: 'application/json',
        responseSchema: { type: Type.OBJECT, properties: { space: { type: Type.STRING, enum: [...candidates, 'none'] } }, required: ['space'] },
      },
    });
    const space = JSON.parse(response.text ?? '{}').space;
    pick = candidates.includes(space) ? space : null;
  } catch (err) {
    console.warn('[ItemSpace] resolve failed; generator keeps its own path:', err);
  }
  resolved.set(key, pick);
  return pick;
}
