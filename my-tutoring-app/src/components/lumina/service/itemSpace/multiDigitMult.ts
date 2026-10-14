/**
 * Item space: multi-digit multiplication of whole numbers (grades 4-5; 4.NBT.5, 5.NBT.5).
 *
 * The task never changes: find the product. Shapes: a one-digit number times a two- or three-digit
 * number, two two-digit numbers, a three-digit times a two-digit number. The shape is part of the
 * objective's scope (4.NBT.5 stops at 2 × 2 digits and 4 × 1), so each consumer usually fixes it and
 * the difficulty inside a shape comes from the work:
 *   - partial products: one per pair of non-zero digits (place-value decomposition, Fuson 2003; the
 *     area model draws one cell each). More cells, more products to find and keep.
 *   - hard digit facts: digit pairs both in 6..9, the facts with the most errors (Campbell 1997).
 *   - carries in the sum of the partial products: the adding step after the decomposition, where a
 *     carry slip changes the product.
 *   - a zero inside a factor (305): the zero's place is skipped or misread (Fuson 2003).
 *   - anchor: a one-digit factor of 2 or 5, doubled or halved from tens.
 * Shape weights follow the standards' order (1 × 2 digits and 2 × 2 in grade 4, 3 × 2 in grade 5); their
 * sizes are unsourced priors, as are all the weights here, to be replaced by the refit.
 *
 * Beta = base + Σ weight × feature, logits for a typical grade-4/5 learner taught partial products.
 * The space is listed (about 93,000 items, built on first use). Weights are priors to be refit from
 * first-try results on real attempts.
 */
import type { ItemSpace, SpaceDistractor } from './types';

export type MultShape = '1x2' | '1x3' | '2x2' | '3x2';
export interface MultDigitItem {
  /** The longer factor first (the one-digit factor is b in a 1×n item). */
  a: number;
  b: number;
  shape: MultShape;
  features: MultDigitFeatures;
  beta: number;
  structure: string;
}
export interface MultDigitFeatures {
  cells: number;
  hardFacts: number;
  carries: number;
  innerZero: number;
  anchor: number;
  shape2x2: number;
  shape1x3: number;
  shape3x2: number;
}

export const MULT_DIGIT_WEIGHTS: Record<keyof MultDigitFeatures | 'base', number> = {
  base: -2.0, cells: 0.2, hardFacts: 0.3, carries: 0.3, innerZero: 0.5, anchor: -0.4, shape2x2: 0.8, shape1x3: 0.5, shape3x2: 1.6,
};

/** The non-zero place parts of n, largest first: 305 → [300, 5]. */
export const placeParts = (n: number): number[] => {
  const out: number[] = [];
  for (let p = 10 ** (String(n).length - 1); p >= 1; p /= 10) {
    const d = Math.floor(n / p) % 10;
    if (d) out.push(d * p);
  }
  return out;
};

/** Every partial product, one per pair of place parts. */
export const partialProducts = (a: number, b: number): number[] =>
  placeParts(a).flatMap((x) => placeParts(b).map((y) => x * y));

/** Column carries when the partial products are added. */
function sumCarries(parts: number[]): number {
  let carries = 0, carry = 0;
  const width = Math.max(...parts.map((p) => String(p).length));
  for (let place = 0; place < width; place++) {
    const col = parts.reduce((s, p) => s + (Math.floor(p / 10 ** place) % 10), carry);
    carry = Math.floor(col / 10);
    if (carry) carries++;
  }
  return carries;
}

const shapeOf = (a: number, b: number): MultShape | null => {
  const key = `${String(a).length}x${String(b).length}`;
  return key === '2x1' ? '1x2' : key === '3x1' ? '1x3' : key === '2x2' || key === '3x2' ? key : null;
};

export function multDigitFeatures(a: number, b: number): MultDigitFeatures {
  const shape = shapeOf(a, b)!;
  const digits = (n: number) => placeParts(n).map((p) => Number(String(p)[0]));
  const hard = digits(a).flatMap((x) => digits(b).map((y) => x >= 6 && y >= 6)).filter(Boolean).length;
  const inner = (n: number) => String(n).length === 3 && String(n)[1] === '0' && String(n)[2] !== '0';
  return {
    cells: partialProducts(a, b).length,
    hardFacts: hard,
    carries: sumCarries(partialProducts(a, b)),
    innerZero: inner(a) || inner(b) ? 1 : 0,
    anchor: String(b).length === 1 && (b === 2 || b === 5) ? 1 : 0,
    shape2x2: shape === '2x2' ? 1 : 0,
    shape1x3: shape === '1x3' ? 1 : 0,
    shape3x2: shape === '3x2' ? 1 : 0,
  };
}

function predictBeta(f: MultDigitFeatures): number {
  const w = MULT_DIGIT_WEIGHTS;
  return Number((Object.keys(f) as (keyof MultDigitFeatures)[]).reduce((s, k) => s + w[k] * f[k], w.base).toFixed(2));
}

function build(): MultDigitItem[] {
  const out: MultDigitItem[] = [];
  const push = (a: number, b: number) => {
    const shape = shapeOf(a, b);
    if (!shape) return;
    const features = multDigitFeatures(a, b);
    const structure = `${shape}|c${features.cells}|h${features.hardFacts}|r${features.carries}|z${features.innerZero}`;
    out.push({ a, b, shape, features, beta: predictBeta(features), structure });
  };
  // ×1, ×10 and ×100 are the rule for one and for a power of ten, not this strand.
  const pow10 = (n: number) => n === 10 || n === 100;
  for (let b = 2; b <= 9; b++) for (let a = 11; a <= 999; a++) if (!pow10(a)) push(a, b);
  for (let a = 11; a <= 99; a++) for (let b = 11; b <= a; b++) if (!pow10(b)) push(a, b);
  for (let a = 101; a <= 999; a++) if (a % 100 !== 0) for (let b = 11; b <= 99; b++) push(a, b);
  return out;
}

let cache: MultDigitItem[] | null = null;
/** Every item in the strand, built on first use. */
export const multDigitItems = (): MultDigitItem[] => (cache ??= build());

/** `n` items of `items` in [lo, hi], spread across structures (least used first), no product twice. */
export function pickMultDigit(
  items: MultDigitItem[], n: number, lo: number, hi: number, rand: () => number = Math.random,
  accept?: (item: MultDigitItem) => boolean,
): MultDigitItem[] {
  const byStructure = new Map<string, MultDigitItem[]>();
  for (const it of items) {
    if (it.beta < lo || it.beta > hi || (accept && !accept(it))) continue;
    const list = byStructure.get(it.structure);
    if (list) list.push(it); else byStructure.set(it.structure, [it]);
  }
  const structures = Array.from(byStructure.keys());
  if (!structures.length) return [];
  const used = new Map<string, number>();
  const seen = new Set<string>();
  const picks: MultDigitItem[] = [];
  for (let guard = 0; picks.length < n && guard < n * 30; guard++) {
    const least = Math.min(...structures.map((s) => used.get(s) ?? 0));
    const open = structures.filter((s) => (used.get(s) ?? 0) === least);
    const key = open[Math.floor(rand() * open.length)];
    const pool = byStructure.get(key)!;
    const it = pool[Math.floor(rand() * pool.length)];
    used.set(key, (used.get(key) ?? 0) + 1);
    if (seen.has(`${it.a}x${it.b}`)) continue;
    seen.add(`${it.a}x${it.b}`);
    picks.push(it);
  }
  return picks;
}

/**
 * Three wrong answers. Near: a partial product left out of the sum (the largest one when there is a
 * choice), tens times tens and ones times ones only (36 × 47 → 1,242: the cross products dropped), a
 * zero dropped from the largest partial product. Far: off by a hundred or a
 * thousand in the leading place. Easy items carry one near option, the rest two; every set keeps a far one.
 */
export function multDigitDistractors(it: MultDigitItem, rand: () => number = Math.random): SpaceDistractor[] {
  const answer = it.a * it.b;
  const parts = partialProducts(it.a, it.b);
  const near: number[] = parts.length > 1 ? parts.map((p) => answer - p) : [];
  const pa = placeParts(it.a), pb = placeParts(it.b);
  if (pa.length === pb.length && pa.length > 1) near.push(pa.reduce((s, x, i) => s + x * pb[i], 0));
  // A zero dropped from the largest partial product (7 × 80 written as 56).
  const big = Math.max(...parts);
  if (big >= 100) near.push(answer - big + big / 10);
  const ok = (v: number) => Number.isInteger(v) && v > 0 && v !== answer;
  const nearList = Array.from(new Set(near.filter(ok))).sort(() => rand() - 0.5);
  const picked: SpaceDistractor[] = nearList.slice(0, it.beta < -0.6 ? 1 : 2).map((v) => ({ value: String(v), distance: 'near' }));
  const taken = new Set([answer, ...picked.map((p) => Number(p.value))]);
  const lead = 10 ** (String(answer).length - 1);
  for (const v of [answer + lead, answer - lead, answer + 2 * lead, answer + lead / 10 * 3, answer - lead / 10 * 3]) {
    if (picked.length === 3) break;
    if (ok(v) && !taken.has(v)) { picked.push({ value: String(v), distance: 'far' }); taken.add(v); }
  }
  return picked;
}

const GRADE_4_SHAPES: readonly MultShape[] = ['1x2', '1x3', '2x2'];
let grade4: MultDigitItem[] | null = null;
const grade4Items = (): MultDigitItem[] => (grade4 ??= multDigitItems().filter((it) => GRADE_4_SHAPES.includes(it.shape)));

const shared = {
  criterion: 'Multiply multi-digit whole numbers',
  distractors: multDigitDistractors,
  solve: (it: MultDigitItem) => ({ answer: String(it.a * it.b), shown: [String(it.a), String(it.b)], spec: `${it.a} × ${it.b} (the product is unknown)` }),
  plainQuestion: (it: MultDigitItem) => `What is ${it.a} × ${it.b}?`,
};

/**
 * Two scopes of one strand, as add-sub-100 and add-sub-1000 are: grade 4 (4.NBT.5) stops at one digit
 * times three and two digits times two; grade 5 (5.NBT.5) adds three digits times two. A grade-4
 * objective drew 337 × 20 at medium when both lived in one space (10-13 knowledge-check probe).
 */
export const MULT_MULTI_DIGIT: ItemSpace<MultDigitItem> = {
  id: 'mult-multi-digit',
  describe: 'multiplying a one-digit number by a two- or three-digit number, or two two-digit numbers (grade 4), by '
    + 'partial products or an area model; not the basic facts within 100, and not a three-digit by a two-digit number',
  grades: ['4', '5'],
  wordingGrade: 'grade 4',
  pick: (n, lo, hi, rand, accept) => pickMultDigit(grade4Items(), n, lo, hi, rand, accept),
  items: grade4Items,
  ...shared,
};

export const MULT_MULTI_DIGIT_5: ItemSpace<MultDigitItem> = {
  id: 'mult-multi-digit-5',
  describe: 'multiplying multi-digit whole numbers up to a three-digit number by a two-digit number (grade 5 and up), by '
    + 'partial products, an area model or the standard algorithm',
  grades: ['5', '6'],
  wordingGrade: 'grade 5',
  pick: (n, lo, hi, rand, accept) => pickMultDigit(multDigitItems(), n, lo, hi, rand, accept),
  items: multDigitItems,
  ...shared,
};
