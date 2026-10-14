/**
 * Item space: the equal sign as "the same amount as", within 20 (grades 1-2, 1.OA.7, 1.OA.8).
 *
 * The task never changes: find the number that makes both sides of an equation the same amount. One
 * side is known (a computation, or one number); the other holds the box. Three forms:
 *   - standard: a ± b = ?        (the answer slot alone after the equal sign)
 *   - reversed: c = ? + k, c = k + ?, c = ? − k   (one number before the equal sign, the work after it)
 *   - both:     a ± b = ? + k, a ± b = k + ?, a ± b = ? − k   (an operation on both sides)
 * `k − ?` is left out: a missing subtrahend is a second demand on top of the equal sign.
 *
 * Difficulty features (research behind the priors):
 *   - form. Children who read "=" as "write the answer" solve the standard form and fail the others
 *     (Falkner, Levi & Carpenter 1999: 8 + 4 = ? + 5 answered 12 or 17 by most grade 1-6 children).
 *     Matthews, Rittle-Johnson, McEldoon & Taylor 2012 (equal-sign construct map, Rasch-scaled) put
 *     standard items lowest, the operation after the equal sign above them, and operations on both
 *     sides highest, roughly a logit and a half to two logits above standard for grade 2-3 learners.
 *   - box last (8 + 4 = 5 + ?): it invites "add every number" (17), slightly harder than the box first.
 *   - shared addend (7 + 5 = 7 + ?): a relational learner sees the answer without computing, the
 *     comparative-relational level of the same map; easier than other both-sides items.
 *   - subtraction and crossing ten in either computation, and the size of the known side, as in
 *     add-sub-20 (the computation still has to be done).
 *
 * Beta = base + Σ weight × feature, logits for a typical grade-1/2 learner taught the meaning of the
 * equal sign. The weights are priors to be refit from first-try results on real attempts.
 */
import { crossesTen } from './addSub20';
import type { ItemSpace, SpaceDistractor } from './types';

export type EqKind = 'standard' | 'reversed' | 'both';
export interface EqSide { a: number; op: '+' | '-'; b: number }
export interface Equivalence20Item {
  kind: EqKind;
  /** The side with no box: a computation, or one number (reversed). It is printed on the left. */
  known: EqSide | number;
  /** The side with the box: null when the box stands alone (standard). */
  boxed: { op: '+' | '-'; k: number; boxFirst: boolean } | null;
  answer: number;
  features: Equivalence20Features;
  beta: number;
  structure: string;
}
export interface Equivalence20Features {
  reversed: number;
  bothSides: number;
  boxLast: number;
  subtraction: number;
  bridges: number;
  shared: number;
  size: number;
}

export const EQUIVALENCE_20_WEIGHTS: Record<keyof Equivalence20Features | 'base', number> = {
  base: -1.6, reversed: 0.6, bothSides: 1.4, boxLast: 0.2, subtraction: 0.4, bridges: 0.5, shared: -0.8, size: 0.6,
};

const MAX = 20;
const valueOf = (s: EqSide | number): number => (typeof s === 'number' ? s : s.op === '+' ? s.a + s.b : s.a - s.b);

/** The two sides as printed, with `?` for the box. */
export function sidesOf(it: Equivalence20Item): { left: string; right: string } {
  const left = typeof it.known === 'number' ? String(it.known) : `${it.known.a} ${it.known.op} ${it.known.b}`;
  const right = !it.boxed ? '?' : it.boxed.boxFirst ? `? ${it.boxed.op} ${it.boxed.k}` : `${it.boxed.k} ${it.boxed.op} ?`;
  return { left, right };
}

export function equivalence20Features(it: Pick<Equivalence20Item, 'kind' | 'known' | 'boxed'>): Equivalence20Features {
  const L = valueOf(it.known);
  const side = typeof it.known === 'number' ? null : it.known;
  const box = it.boxed;
  // The work the box needs: L − k for "? + k", L + k for "? − k".
  const boxWork = box ? (box.op === '+' ? { a: L, b: box.k, op: '-' as const } : { a: L, b: box.k, op: '+' as const }) : null;
  const shared = it.kind === 'both' && !!side && !!box
    && ((side.op === '+' && box.op === '+' && (box.k === side.a || box.k === side.b))
      || (side.op === '-' && box.op === '-' && box.k === side.b));
  return {
    reversed: it.kind === 'reversed' ? 1 : 0,
    bothSides: it.kind === 'both' ? 1 : 0,
    boxLast: box && !box.boxFirst ? 1 : 0,
    subtraction: (side?.op === '-' ? 1 : 0) + (box?.op === '-' ? 1 : 0),
    // A shared addend is seen, not computed (8 + 9 = 8 + ?): its box work is no bridge.
    bridges: (side && crossesTen(side, side.op === '+') ? 1 : 0) + (!shared && boxWork && crossesTen(boxWork, boxWork.op === '+') ? 1 : 0),
    shared: shared ? 1 : 0,
    // The larger of the known total and the box (1 + 1 = ? − 10 works with 12).
    size: Math.max(L, boxWork ? (boxWork.op === '+' ? L + boxWork.b : L - boxWork.b) : L) / MAX,
  };
}

function predictBeta(f: Equivalence20Features): number {
  const w = EQUIVALENCE_20_WEIGHTS;
  return (Object.keys(f) as (keyof Equivalence20Features)[]).reduce((s, k) => s + w[k] * f[k], w.base);
}

function build(): Equivalence20Item[] {
  const out: Equivalence20Item[] = [];
  const push = (kind: EqKind, known: EqSide | number, boxed: Equivalence20Item['boxed']) => {
    const L = valueOf(known);
    const answer = !boxed ? L : boxed.op === '+' ? L - boxed.k : L + boxed.k;
    // No zero anywhere: "? + 7 = 7" tests the rule for zero, not the equal sign.
    if (answer < 1 || answer > MAX) return;
    // 1 + 1 = 1 + ? and 2 = ? + 1 can be read off without the equal sign meaning anything.
    if (kind !== 'standard' && L < 3) return;
    const features = equivalence20Features({ kind, known, boxed });
    const ops = `${typeof known === 'number' ? 'n' : known.op}${boxed ? boxed.op : ''}`;
    const structure = `${kind}|${ops}|${boxed ? (boxed.boxFirst ? 'first' : 'last') : 'alone'}|b${features.bridges}|s${features.shared}`;
    out.push({ kind, known, boxed, answer, features, beta: Number(predictBeta(features).toFixed(2)), structure });
  };
  const sides: EqSide[] = [];
  for (let a = 1; a <= MAX; a++) for (let b = 1; b < MAX; b++) {
    if (a + b <= MAX) sides.push({ a, op: '+', b });
    if (a - b >= 1) sides.push({ a, op: '-', b });
  }
  for (const s of sides) push('standard', s, null);
  for (let c = 2; c <= MAX; c++) for (let k = 1; k < MAX; k++) {
    push('reversed', c, { op: '+', k, boxFirst: true });
    push('reversed', c, { op: '+', k, boxFirst: false });
    push('reversed', c, { op: '-', k, boxFirst: true });
  }
  for (const s of sides) for (let k = 1; k < MAX; k++) {
    push('both', s, { op: '+', k, boxFirst: true });
    push('both', s, { op: '+', k, boxFirst: false });
    push('both', s, { op: '-', k, boxFirst: true });
  }
  return out;
}

let cache: Equivalence20Item[] | null = null;
/** Every item in the strand (about 11,000), built once. */
export const equivalence20Items = (): Equivalence20Item[] => (cache ??= build());

/** One equation once: 4 + 3 = ? + 5 and 3 + 4 = ? + 5 are the same item. */
const itemKey = (it: Equivalence20Item): string => {
  const k = it.known;
  const left = typeof k === 'number' ? String(k) : k.op === '+' ? `${Math.min(k.a, k.b)}+${Math.max(k.a, k.b)}` : `${k.a}-${k.b}`;
  return `${left}=${sidesOf(it).right.replace(/\s+/g, '')}`;
};

/** `n` items in [lo, hi], spread across structures (least used first), no equation twice. */
export function pickEquivalence20(
  n: number, lo: number, hi: number, rand: () => number = Math.random, accept?: (item: Equivalence20Item) => boolean,
): Equivalence20Item[] {
  const byStructure = new Map<string, Equivalence20Item[]>();
  for (const it of equivalence20Items()) {
    if (it.beta < lo || it.beta > hi || (accept && !accept(it))) continue;
    byStructure.set(it.structure, [...(byStructure.get(it.structure) ?? []), it]);
  }
  const structures = Array.from(byStructure.keys());
  if (!structures.length) return [];
  const used = new Map<string, number>();
  const seen = new Set<string>();
  const picks: Equivalence20Item[] = [];
  for (let guard = 0; picks.length < n && guard < n * 30; guard++) {
    const least = Math.min(...structures.map((s) => used.get(s) ?? 0));
    const open = structures.filter((s) => (used.get(s) ?? 0) === least);
    const key = open[Math.floor(rand() * open.length)];
    const pool = byStructure.get(key)!;
    const it = pool[Math.floor(rand() * pool.length)];
    used.set(key, (used.get(key) ?? 0) + 1);
    if (seen.has(itemKey(it))) continue;
    seen.add(itemKey(it));
    picks.push(it);
  }
  return picks;
}

/** The numbers the equation prints, left to right. */
const shownOf = (it: Equivalence20Item): number[] => [
  ...(typeof it.known === 'number' ? [it.known] : [it.known.a, it.known.b]), ...(it.boxed ? [it.boxed.k] : []),
];

/**
 * Three wrong answers. Near: the known side's total written in the box (reading "=" as "the answer
 * comes next", the most common error in the research), every number added, the other number on the
 * box's side, the wrong operation, a counting slip of one. Far: ruled out by knowing roughly how big
 * the box must be. Easy items carry one near option, the rest two; every set keeps a far one. All
 * options stay in 1..20.
 */
export function equivalence20Distractors(it: Equivalence20Item, rand: () => number = Math.random): SpaceDistractor[] {
  const { answer } = it;
  const L = valueOf(it.known);
  const near: number[] = [];
  const side = typeof it.known === 'number' ? null : it.known;
  if (!it.boxed) {
    if (side) near.push(side.op === '+' ? Math.abs(side.a - side.b) : side.a + side.b); // wrong operation
  } else {
    near.push(L); // the known side's total in the box
    near.push(it.boxed.op === '+' ? L + it.boxed.k : L - it.boxed.k); // added every number / wrong operation
    near.push(it.boxed.k); // the number shown beside the box
  }
  near.push(answer + 1, answer - 1);
  const ok = (v: number) => Number.isInteger(v) && v >= 1 && v <= MAX && v !== answer;
  const nearList = Array.from(new Set(near.filter(ok))).sort(() => rand() - 0.5);
  // The "answer comes next" error leads whenever there is one: it is the strand's misconception.
  if (it.boxed && ok(L)) nearList.sort((x, y) => (x === L ? -1 : y === L ? 1 : 0));
  const picked: SpaceDistractor[] = nearList.slice(0, it.beta < -0.6 ? 1 : 2).map((v) => ({ value: String(v), distance: 'near' }));
  const taken = new Set([answer, ...picked.map((p) => Number(p.value))]);
  for (const v of [answer + 5, answer - 5, answer + 7, answer - 7, answer + 10, answer - 10, answer + 3, answer - 3, answer + 9]) {
    if (picked.length === 3) break;
    if (ok(v) && !taken.has(v)) { picked.push({ value: String(v), distance: 'far' }); taken.add(v); }
  }
  for (let v = 1; picked.length < 3 && v <= MAX; v++) if (!taken.has(v)) { picked.push({ value: String(v), distance: 'far' }); taken.add(v); }
  return picked;
}

const equationOf = (it: Equivalence20Item): string => {
  const { left, right } = sidesOf(it);
  return `${left} = ${right.replace('?', '□')}`;
};

export const EQUIVALENCE_20: ItemSpace<Equivalence20Item> = {
  id: 'equivalence-20',
  describe: 'the meaning of the equal sign as "the same amount as" within 20: find the missing number that makes both '
    + 'sides of an equation equal, with an operation on both sides (8 + 4 = ? + 5) or the work after the equal sign (12 = 5 + ?). '
    + 'The learner finds a number; judging whether a given equation is true or false is a different task',
  grades: ['1', '2'],
  criterion: 'Understand the equal sign as the same amount on both sides',
  wordingGrade: 'grade 1',
  pick: pickEquivalence20,
  items: equivalence20Items,
  solve: (it) => ({
    answer: String(it.answer),
    shown: shownOf(it).map(String),
    spec: `${sidesOf(it).left} = ${sidesOf(it).right} (both sides are the same amount; the ? is unknown)`,
    equation: equationOf(it),
  }),
  distractors: equivalence20Distractors,
  plainQuestion: (it) => `${equationOf(it)}. What number goes in the box so both sides are the same amount?`,
};
