/**
 * Item space: two-step equations px + q = r with whole numbers (grades 3-7; 6.EE.7, 7.EE.4a in
 * symbols, the "unpack and share" balance before that).
 *
 * The task never changes: undo the added number, then share what is left among the p equal groups.
 * p is 2..6 (a balance draws at most six identical parcels), x is 2..9, q is 1..20. ×1 and ×10 are
 * left out: x = 1 makes the sharing step disappear, and ×10 is a place-value rule.
 *
 * Difficulty features (research behind the priors):
 *   - the division fact. The second step is a basic fact r − q = p·x; its family carries the fact
 *     strand's effects (anchors 2 and 5 easy, factors 6-9 hard; Campbell & Graham 1985, LeFevre et
 *     al. 1996; the same features as mult-div-facts).
 *   - the subtraction step regroups (r − q needs a borrow in the ones, 23 − 7). Children's errors on
 *     the first step of a two-step equation are mostly arithmetic slips, not the order of steps
 *     (Koedinger & Nathan 2004, symbolic two-step items).
 *   - more groups (p of 4 or more): more parcels to share among and hold apart.
 *   - size: r over 60, the problem-size effect on both steps.
 *
 * Beta = base + Σ weight × feature, logits for a typical learner at the strand's grade who was taught
 * to undo the steps. The weights are priors to be refit from first-try results on real attempts.
 */
import type { ItemSpace, SpaceDistractor } from './types';

export interface TwoStepItem {
  /** Number of equal groups (the coefficient). */
  p: number;
  /** The unknown. */
  x: number;
  /** The added number. */
  q: number;
  features: TwoStepFeatures;
  beta: number;
  structure: string;
}
export interface TwoStepFeatures {
  anchor: number;
  hardFactors: number;
  borrow: number;
  manyGroups: number;
  size: number;
}

export const TWO_STEP_WEIGHTS: Record<keyof TwoStepFeatures | 'base', number> = {
  base: -1.3, anchor: -0.6, hardFactors: 0.5, borrow: 0.6, manyGroups: 0.4, size: 1.2,
};

const HARD = new Set([6, 7, 8, 9]);
export const twoStepTotal = (it: Pick<TwoStepItem, 'p' | 'x' | 'q'>): number => it.p * it.x + it.q;

export function twoStepFeatures(p: number, x: number, q: number): TwoStepFeatures {
  const r = p * x + q;
  return {
    anchor: p === 2 || p === 5 || x === 2 || x === 5 ? 1 : 0,
    hardFactors: (HARD.has(p) ? 1 : 0) + (HARD.has(x) ? 1 : 0),
    borrow: r % 10 < q % 10 ? 1 : 0,
    manyGroups: p >= 4 ? 1 : 0,
    size: r / 60,
  };
}

function predictBeta(f: TwoStepFeatures): number {
  const w = TWO_STEP_WEIGHTS;
  return Number((Object.keys(f) as (keyof TwoStepFeatures)[]).reduce((s, k) => s + w[k] * f[k], w.base).toFixed(2));
}

function build(): TwoStepItem[] {
  const out: TwoStepItem[] = [];
  for (let p = 2; p <= 6; p++) for (let x = 2; x <= 9; x++) for (let q = 1; q <= 20; q++) {
    const features = twoStepFeatures(p, x, q);
    const structure = `p${features.manyGroups ? '4+' : '<4'}|a${features.anchor}|h${features.hardFactors}|r${features.borrow}`;
    out.push({ p, x, q, features, beta: predictBeta(features), structure });
  }
  return out;
}

let cache: TwoStepItem[] | null = null;
/** Every item in the strand (800), built once. */
export const twoStepItems = (): TwoStepItem[] => (cache ??= build());

/** `n` items in [lo, hi], spread across structures (least used first); no division fact twice. */
export function pickTwoStep(
  n: number, lo: number, hi: number, rand: () => number = Math.random, accept?: (item: TwoStepItem) => boolean,
): TwoStepItem[] {
  const byStructure = new Map<string, TwoStepItem[]>();
  for (const it of twoStepItems()) {
    if (it.beta < lo || it.beta > hi || (accept && !accept(it))) continue;
    byStructure.set(it.structure, [...(byStructure.get(it.structure) ?? []), it]);
  }
  const structures = Array.from(byStructure.keys());
  if (!structures.length) return [];
  const used = new Map<string, number>();
  const seen = new Set<string>();
  const picks: TwoStepItem[] = [];
  // One sharing fact once (3x + 4 = 19 and 3x + 9 = 24 are the same 15 ÷ 3). A total once where the
  // band allows it: a capped scope crowds its hard items at the cap (3x + 13 = 40, 3x + 19 = 40), so the
  // first pass skips a repeated total and the second lets one through.
  for (const distinctTotals of [true, false]) {
    for (let guard = 0; picks.length < n && guard < n * 30; guard++) {
      const least = Math.min(...structures.map((s) => used.get(s) ?? 0));
      const open = structures.filter((s) => (used.get(s) ?? 0) === least);
      const key = open[Math.floor(rand() * open.length)];
      const pool = byStructure.get(key)!;
      const it = pool[Math.floor(rand() * pool.length)];
      used.set(key, (used.get(key) ?? 0) + 1);
      const fact = `${it.p}x${it.x}`, total = `r${twoStepTotal(it)}`;
      if (seen.has(fact) || (distinctTotals && seen.has(total))) continue;
      seen.add(fact); seen.add(total);
      picks.push(it);
    }
  }
  return picks;
}

/**
 * Three wrong answers. Near: the wrong inverse first ((r + q) ÷ p when it divides), stopped after one
 * step (r − q), divided before subtracting (r ÷ p − q when it divides), one off. Far: ruled out by
 * checking the size. Easy items carry one near option, the rest two; every set keeps a far one. All
 * options stay in 1..60.
 */
export function twoStepDistractors(it: TwoStepItem, rand: () => number = Math.random): SpaceDistractor[] {
  const r = twoStepTotal(it);
  const near: number[] = [r - it.q, it.x + 1, it.x - 1];
  if ((r + it.q) % it.p === 0) near.push((r + it.q) / it.p);
  if (r % it.p === 0) near.push(r / it.p - it.q);
  const ok = (v: number) => Number.isInteger(v) && v >= 1 && v <= 60 && v !== it.x;
  const nearList = Array.from(new Set(near.filter(ok))).sort(() => rand() - 0.5);
  const picked: SpaceDistractor[] = nearList.slice(0, it.beta < -0.6 ? 1 : 2).map((v) => ({ value: String(v), distance: 'near' }));
  const taken = new Set([it.x, ...picked.map((p) => Number(p.value))]);
  for (const v of [it.x + 5, it.x + 7, it.x - 5, it.x + 10, it.x + 4, it.x - 4, it.x + 12]) {
    if (picked.length === 3) break;
    if (ok(v) && !taken.has(v)) { picked.push({ value: String(v), distance: 'far' }); taken.add(v); }
  }
  return picked;
}

const equationOf = (it: TwoStepItem): string => `${it.p}x + ${it.q} = ${twoStepTotal(it)}`;

export const TWO_STEP_EQUATIONS: ItemSpace<TwoStepItem> = {
  id: 'two-step-equations',
  describe: 'two-step equations px + q = r with whole numbers (3x + 4 = 19): undo the added number, then share or divide '
    + 'among the equal groups to find the unknown; also equal parcels and loose weight balancing a known weight',
  grades: ['3', '4', '5', '6', '7'],
  criterion: 'Solve a two-step equation px + q = r',
  wordingGrade: 'grade 5',
  pick: pickTwoStep,
  items: twoStepItems,
  solve: (it) => ({
    answer: String(it.x),
    shown: [String(it.p), String(it.q), String(twoStepTotal(it))],
    spec: `${equationOf(it)} (x is unknown; subtract ${it.q}, then divide by ${it.p})`,
    equation: equationOf(it),
  }),
  distractors: twoStepDistractors,
  plainQuestion: (it) => `${equationOf(it)}. What is x?`,
};
