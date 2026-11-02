/**
 * Volcano Island's kitchen volcano, pure: how high the foam rises from a mix of baking soda and vinegar, the items code
 * builds, and the check. The 3D table (`volcano3d.ts`) raises each volcano's foam to the height this file computes, so
 * what the learner sees is what this file decides.
 *
 * Baking soda and vinegar fizz together: one spoon of soda uses up one cup of vinegar, and each spoon-and-cup that
 * fizzes pushes the foam one mark higher. So the foam rises as high as the smaller amount allows: more vinegar on top
 * of too little soda does nothing, and the other way round. A fair test changes one amount and keeps the other the
 * same, and the learner compares what the two volcanoes did, not what they guessed.
 */

import type { MagmaChallenge } from './magmaModel';
import type { LayersChallenge } from './layersModel';
import type { VillageChallenge } from './villageModel';
import type { RockChallenge } from './rockModel';

export type Ingredient = 'soda' | 'vinegar';
export interface Mix { soda: number; vinegar: number }
export type Tier = 'easy' | 'medium' | 'hard';
export type Rng = () => number;

/** The most the jar and the jug hold, and the least you can use. */
export const MAX_AMOUNT = 4;
export const MIN_AMOUNT = 1;
/** The foam marks it rises to: one per spoon-and-cup that fizzes. */
export const foamHeight = (m: Mix): number => Math.min(m.soda, m.vinegar);

export const VOLCANO_TASKS = ['kitchen_volcano', 'runny_or_sticky', 'layers_over_time', 'save_the_village', 'cool_the_rock'] as const;
export type VolcanoTask = typeof VOLCANO_TASKS[number];
export type Which = 'a' | 'b' | 'same';

export interface KitchenChallenge {
  id: string;
  type: 'kitchen_volcano';
  instruction: string;
  /** Volcano A, mixed for the learner. */
  a: Mix;
  /** The one amount the learner changes for volcano B. */
  change: Ingredient;
  /** Easy: the other amount is locked to A's. Above easy the learner keeps it the same. */
  lockOther: boolean;
  supportTier?: Tier;
  startLevers?: string[];
}
export type VolcanoChallenge = KitchenChallenge | MagmaChallenge | LayersChallenge | VillageChallenge | RockChallenge;

export const INGREDIENT_WORD: Record<Ingredient, string> = { soda: 'baking soda', vinegar: 'vinegar' };
export const amountWords = (i: Ingredient, n: number) =>
  i === 'soda' ? `${n} ${n === 1 ? 'spoon' : 'spoons'} of baking soda` : `${n} ${n === 1 ? 'cup' : 'cups'} of vinegar`;
export const mixWords = (m: Mix) => `${amountWords('soda', m.soda)} and ${amountWords('vinegar', m.vinegar)}`;

export function kitchenInstruction(a: Mix, change: Ingredient): string {
  return `Volcano A has ${mixWords(a)}. Make volcano B with a different amount of ${INGREDIENT_WORD[change]}, and keep `
    + `the ${INGREDIENT_WORD[change === 'soda' ? 'vinegar' : 'soda']} the same. Which erupts higher?`;
}

export function makeKitchen(id: string, a: Mix, change: Ingredient, lockOther: boolean): KitchenChallenge {
  return { id, type: 'kitchen_volcano', instruction: kitchenInstruction(a, change), a, change, lockOther };
}

/** Whether changing this amount can change the foam at all: it is the amount that runs out first, or equal. */
export const changeMatters = (a: Mix, change: Ingredient) => a[change] <= a[change === 'soda' ? 'vinegar' : 'soda'];

/**
 * Every item a tier allows. Easy: the amount to change is the one that runs out first, with room to add more, and the
 * other is locked. Medium: the same, but the learner must keep the other amount themselves. Hard: the amount to change
 * is already more than enough, so adding more does nothing (the foam stays the same height).
 */
export function kitchenCandidates(tier: Tier): Array<{ a: Mix; change: Ingredient }> {
  const out: Array<{ a: Mix; change: Ingredient }> = [];
  for (let soda = MIN_AMOUNT; soda <= MAX_AMOUNT; soda++) for (let vinegar = MIN_AMOUNT; vinegar <= MAX_AMOUNT; vinegar++) {
    for (const change of ['soda', 'vinegar'] as const) {
      const a = { soda, vinegar };
      const other = change === 'soda' ? vinegar : soda;
      const room = a[change] < MAX_AMOUNT;
      if (tier !== 'hard' && a[change] < other && room && a[change] <= 2) out.push({ a, change });
      if (tier === 'hard' && a[change] > other && room && other <= 2) out.push({ a, change });
    }
  }
  return out;
}

export function pickKitchens(n: number, tier: Tier, rng: Rng, idPrefix = 'kitchen'): KitchenChallenge[] {
  const pool = [...kitchenCandidates(tier)];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return Array.from({ length: n }, (_, i) => makeKitchen(`${idPrefix}-${i + 1}`, pool[i % pool.length].a, pool[i % pool.length].change, tier === 'easy'));
}

// ============================================================================
// The check
// ============================================================================

export interface KitchenAnswer { b: Mix; prediction: Which | null; claim: Which | null }
export type KitchenMiss = 'changed_both' | 'no_change' | 'kept_prediction' | 'misread_result';

export const higher = (a: Mix, b: Mix): Which => (foamHeight(a) > foamHeight(b) ? 'a' : foamHeight(b) > foamHeight(a) ? 'b' : 'same');
const other = (c: KitchenChallenge): Ingredient => (c.change === 'soda' ? 'vinegar' : 'soda');
export const fairB = (c: KitchenChallenge, b: Mix) => b[c.change] !== c.a[c.change] && b[other(c)] === c.a[other(c)];

export const kitchenMatches = (c: KitchenChallenge, x: KitchenAnswer) => fairB(c, x.b) && x.claim === higher(c.a, x.b);

/** The named miss: B changes the other amount too, or nothing; the claim is the guess the eruptions did not show; or
 *  another claim they did not show. */
export function kitchenMiss(c: KitchenChallenge, x: KitchenAnswer): KitchenMiss | undefined {
  if (kitchenMatches(c, x)) return undefined;
  if (x.b[other(c)] !== c.a[other(c)]) return 'changed_both';
  if (x.b[c.change] === c.a[c.change]) return 'no_change';
  return x.claim === x.prediction ? 'kept_prediction' : 'misread_result';
}

export const WHICH_WORDS: Record<Which, string> = { a: 'volcano A', b: 'volcano B', same: 'both the same height' };

/** The learner's test in words, never which one went higher. */
export const describeKitchen = (c: KitchenChallenge, x: KitchenAnswer) =>
  `made volcano B with ${mixWords(x.b)}; guessed ${x.prediction ? WHICH_WORDS[x.prediction] : 'nothing'}; said ${x.claim ? WHICH_WORDS[x.claim] : 'nothing yet'} erupted higher`;

export function kitchenFeedback(c: KitchenChallenge, x: KitchenAnswer): string {
  const miss = kitchenMiss(c, x);
  if (!miss) {
    return higher(c.a, x.b) === 'same'
      ? `Same height! There was already more ${INGREDIENT_WORD[c.change]} than the ${INGREDIENT_WORD[other(c)]} could fizz with, so adding more did nothing.`
      : `Yes! More of the ${INGREDIENT_WORD[c.change]} made more fizz, so the foam rose higher. You changed one thing, so you know it was that.`;
  }
  if (miss === 'changed_both') return `You changed the ${INGREDIENT_WORD[other(c)]} too, so we cannot tell what made the difference. Change just one thing.`;
  if (miss === 'no_change') return `Volcano B is the same as volcano A. Change the amount of ${INGREDIENT_WORD[c.change]}.`;
  if (miss === 'kept_prediction') return 'That was your guess. Look at the two volcanoes: which foam went higher?';
  return 'Look again at the two volcanoes: which foam went higher, or were they the same?';
}
