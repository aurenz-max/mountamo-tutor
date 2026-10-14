/**
 * Item space: add and subtract within 20 (grade 1).
 *
 * Code owns the problem. Every item in the strand is listed here (one step with the unknown in the
 * result, change or start slot; two steps a ± b ∓ c), each with its difficulty features and a
 * predicted beta. A caller asks for items in a beta band and gets varied structures inside it; the
 * LLM only writes the words. Wrong answers come from known mistakes, not from the LLM.
 *
 * Beta is in logits for a typical grade-1 learner taught the strand. The weights are priors shaped by
 * the early-arithmetic literature (bridging ten, unknown position, subtraction, ties, +1 facts) and
 * are meant to be refit from first-try results on real attempts.
 *
 * Revisions:
 *   - 2026-10-13: a hop of exactly ten is not a bridge (9 + ? = 19 sat in hard on the balance-scale probe).
 *   - 2026-10-13: crossing ten means passing a decade, not landing on one. 4 + 6 = 10 and 10 − 3 are
 *     bonds to ten, and 19 + 1, 20 − 1 are counting by one; all four were scored as bridges, which put
 *     make-ten and count-by-one items in medium. +1 and +2/+3 now count from the larger addend
 *     (1 + 19 is counting on 1, as 19 + 1 is). For a difference, size and the +1/+2 facts read the
 *     smaller of the subtrahend and the difference (18 − 17 is counted up by one, not bridged), and a
 *     sum and its turnaround are one fact for picking. Read off the 10-13 probe tables.
 *   - 2026-10-13: a one-step structure names its anchor (+1, +2/+3, double, 10 + n, none), so a band
 *     spreads across anchors instead of filling with the most numerous ("+1" within 10).
 */
import type { ItemSpace } from './types';

export type Unknown = 'result' | 'change' | 'start';
export interface Step { a: number; b: number; op: '+' | '-' }
export interface AddSub20Item {
  steps: Step[];
  unknown: Unknown;
  features: AddSub20Features;
  beta: number;
  structure: string;
}
export interface AddSub20Features {
  twoStep: number;
  bridges: number;
  subtraction: number;
  unknownChange: number;
  unknownStart: number;
  plusOne: number;
  countOnTwoThree: number;
  double: number;
  tenPlus: number;
  teen: number;
  size: number;
}
export interface SolvedItem {
  answer: number;
  /** The numbers the problem states, in the order a story tells them. */
  shown: number[];
  /** The computation, with `?` in the unknown slot. Never shown to the learner. */
  expr: string;
}

export const ADD_SUB_20_WEIGHTS: Record<keyof AddSub20Features | 'base', number> = {
  base: -1.6, twoStep: 1.1, bridges: 1.0, subtraction: 0.4, unknownChange: 0.8, unknownStart: 1.5,
  plusOne: -0.8, countOnTwoThree: -0.3, double: -0.5, tenPlus: -0.6, teen: 0.3, size: 0.8,
};

/**
 * The step passes a decade: 8 + 5 (past 10), 13 − 5 (below 10), 20 − 12. Landing on one does not.
 * `commute`: a sum with the result unknown is counted on from the larger addend (1 + 18 is 18 + 1).
 */
export const crossesTen = ({ a, b, op }: Step, commute = false): boolean => {
  const [from, by] = commute && op === '+' ? [Math.max(a, b), Math.min(a, b)] : [a, b];
  // A hop of one is counting; so is a difference of one (18 - 17 is counted up, not bridged).
  if (by < 2 || (op === '-' && from - by < 2)) return false;
  // Adding or taking a ten (9 + 10, 17 − 10) changes the tens digit only: a place-value step, not a bridge.
  if (by === 10) return false;
  return op === '+'
    ? Math.floor(from / 10) < Math.floor((from + by - 1) / 10)
    : Math.floor((from - 1) / 10) > Math.floor((from - by) / 10);
};
const result = ({ a, b, op }: Step): number => (op === '+' ? a + b : a - b);

export function addSub20Features(steps: Step[], unknown: Unknown): AddSub20Features {
  const s0 = steps[0];
  const one = steps.length === 1;
  // The smaller of the two quantities a learner counts by: an addend, or for a difference the
  // subtrahend or the difference, whichever is less (18 - 17 is counted up by 1).
  const small = s0.op === '+' ? Math.min(s0.a, s0.b) : Math.min(s0.b, s0.a - s0.b);
  return {
    twoStep: one ? 0 : 1,
    bridges: steps.filter((s) => crossesTen(s, one && unknown === 'result')).length,
    subtraction: steps.some((s) => s.op === '-') ? 1 : 0,
    unknownChange: unknown === 'change' ? 1 : 0,
    unknownStart: unknown === 'start' ? 1 : 0,
    plusOne: one && small === 1 ? 1 : 0,
    countOnTwoThree: one && [2, 3].includes(small) ? 1 : 0,
    double: one && s0.op === '+' && s0.a === s0.b ? 1 : 0,
    tenPlus: one && (s0.a === 10 || (s0.op === '+' && s0.b === 10) || (s0.op === '-' && s0.b === 10)) ? 1 : 0,
    teen: steps.some((s) => Math.max(s.a, result(s)) > 10) ? 1 : 0,
    size: small / 10,
  };
}

export function predictBeta(f: AddSub20Features): number {
  const w = ADD_SUB_20_WEIGHTS;
  return (Object.keys(f) as (keyof AddSub20Features)[]).reduce((s, k) => s + w[k] * f[k], w.base);
}

function build(): AddSub20Item[] {
  const out: AddSub20Item[] = [];
  const push = (steps: Step[], unknown: Unknown) => {
    const features = addSub20Features(steps, unknown);
    // A one-step item's anchor (+1, +2/+3, a double, 10 + n) is structure-bearing: without it every
    // sum within 10 was one structure, and an easy third came back all "+1" (ten-frame probe, 10-13).
    const anchor = steps.length === 2 ? '' : features.plusOne ? '|one' : features.double ? '|dbl'
      : features.tenPlus ? '|ten' : features.countOnTwoThree ? '|two3' : '|none';
    const structure = `${steps.map((x) => x.op).join('')}|${unknown}|b${features.bridges}|t${features.teen}${anchor}`;
    out.push({ steps, unknown, features, beta: predictBeta(features), structure });
  };
  // One step. No zeros: "+ 0" and "? + 0" items test the rule for zero, not this strand.
  for (let a = 1; a <= 20; a++) for (let b = 1; b <= 19; b++) {
    for (const op of ['+', '-'] as const) {
      const s = { a, b, op };
      const r = result(s);
      if (r < 1 || r > 20) continue;
      for (const unknown of ['result', 'change', 'start'] as const) {
        // A missing 1 is a counting check, not this strand's missing-number task.
        if ((unknown === 'change' && b < 2) || (unknown === 'start' && a < 2)) continue;
        push([s], unknown);
      }
    }
  }
  // Two steps, result unknown. Intermediate and final results stay in 1..20.
  for (let a = 1; a <= 20; a++) for (let b = 1; b <= 19; b++) for (let c = 1; c <= 19; c++) {
    for (const [op1, op2] of [['+', '-'], ['-', '+']] as const) {
      const s1 = { a, b, op: op1 };
      const m = result(s1);
      if (m < 1 || m > 20) continue;
      const s2 = { a: m, b: c, op: op2 };
      const r = result(s2);
      if (r < 1 || r > 20) continue;
      push([s1, s2], 'result');
    }
  }
  return out;
}

let cache: AddSub20Item[] | null = null;
/** Every item in the strand (about 6,000), built once. */
export const addSub20Items = (): AddSub20Item[] => (cache ??= build());

/** The structure an item has, without its digits: two items with one signature differ only in numbers. */
export const structureOf = (it: AddSub20Item): string => it.structure;

/**
 * `n` items whose predicted beta lies in [lo, hi], spread across structures: each pick first draws a
 * structure the band holds (least used first), then an item of it, so a band is not filled by its
 * most numerous structure (two-step items are 90% of the space).
 */
export function pickAddSub20(
  n: number, lo: number, hi: number, rand: () => number = Math.random, accept?: (item: AddSub20Item) => boolean,
): AddSub20Item[] {
  const byStructure = new Map<string, AddSub20Item[]>();
  for (const it of addSub20Items()) {
    if (it.beta < lo || it.beta > hi || (accept && !accept(it))) continue;
    const key = structureOf(it);
    byStructure.set(key, [...(byStructure.get(key) ?? []), it]);
  }
  const structures = Array.from(byStructure.keys());
  if (!structures.length) return [];
  const used = new Map<string, number>();
  const seen = new Set<string>();
  const picks: AddSub20Item[] = [];
  for (let guard = 0; picks.length < n && guard < n * 20; guard++) {
    const least = Math.min(...structures.map((s) => used.get(s) ?? 0));
    const open = structures.filter((s) => (used.get(s) ?? 0) === least);
    const key = open[Math.floor(rand() * open.length)];
    const pool = byStructure.get(key)!;
    const it = pool[Math.floor(rand() * pool.length)];
    // One fact once: a sum and its turnaround (6 + 8, 8 + 6), or one fact with a different slot
    // hidden (4 + ? = 9, ? + 5 = 9), are the same fact.
    const s0 = it.steps[0];
    const id = it.steps.length === 2 ? solveAddSub20(it).expr
      : s0.op === '+' ? `${Math.min(s0.a, s0.b)}+${Math.max(s0.a, s0.b)}` : `${s0.a}-${s0.b}`;
    used.set(key, (used.get(key) ?? 0) + 1);
    if (seen.has(id)) continue;
    seen.add(id);
    picks.push(it);
  }
  return picks;
}

export function solveAddSub20(it: AddSub20Item): SolvedItem {
  const [s1, s2] = it.steps;
  if (s2) {
    return { answer: result(s2), shown: [s1.a, s1.b, s2.b], expr: `${s1.a} ${s1.op} ${s1.b} ${s2.op} ${s2.b} = ?` };
  }
  const r = result(s1);
  if (it.unknown === 'result') return { answer: r, shown: [s1.a, s1.b], expr: `${s1.a} ${s1.op} ${s1.b} = ?` };
  if (it.unknown === 'change') return { answer: s1.b, shown: [s1.a, r], expr: `${s1.a} ${s1.op} ? = ${r}` };
  return { answer: s1.a, shown: [s1.b, r], expr: `? ${s1.op} ${s1.b} = ${r}` };
}

/**
 * Three wrong answers. `near` ones are what a learner who made a known mistake would get: the wrong
 * operation, one of the numbers shown, smaller-from-larger in the ones, a counting slip of one, the
 * first step only. `far` ones a learner who half-understood rules out. Easier items carry more far
 * options; every set keeps at least one far option (the drop_far_choice lever needs it).
 */
export function addSub20Distractors(it: AddSub20Item, rand: () => number = Math.random): { value: number; distance: 'near' | 'far' }[] {
  const { answer, shown } = solveAddSub20(it);
  const near = new Set<number>();
  // Inside the strand's range: an option above 20 is one no learner working within 20 would pick.
  const ok = (v: number) => Number.isInteger(v) && v >= 0 && v <= 20 && v !== answer;
  const s1 = it.steps[0];
  if (it.steps.length === 2) {
    near.add(result(s1)); // stopped after the first step
    near.add(it.steps[1].op === '+' ? result(s1) - it.steps[1].b : result(s1) + it.steps[1].b); // wrong second operation
  } else if (it.unknown === 'result') {
    near.add(s1.op === '+' ? Math.abs(s1.a - s1.b) : s1.a + s1.b); // wrong operation
    if (s1.op === '-' && crossesTen(s1)) near.add(10 * Math.floor(s1.a / 10) + Math.abs((s1.a % 10) - s1.b)); // smaller from larger
  } else {
    near.add(shown[0] + shown[1]); // added the two numbers shown
    near.add(shown[1]); // the number shown in the problem
  }
  near.add(answer + 1);
  near.add(answer - 1);
  const nearList = Array.from(near).filter(ok).sort(() => rand() - 0.5);
  const nearCount = it.beta < -0.6 ? 1 : 2;
  const picked: { value: number; distance: 'near' | 'far' }[] = nearList.slice(0, nearCount).map((value) => ({ value, distance: 'near' }));
  const taken = new Set([answer, ...picked.map((p) => p.value)]);
  const farCandidates = [answer + 5, answer - 5, answer + 7, answer - 7, answer + 10, answer - 10, answer + 3, answer - 3, answer + 9]
    .filter((v) => ok(v) && !taken.has(v));
  for (const v of farCandidates) {
    if (picked.length === 3) break;
    picked.push({ value: v, distance: 'far' });
    taken.add(v);
  }
  for (let v = 0; picked.length < 3 && v <= 20; v++) if (!taken.has(v)) { picked.push({ value: v, distance: 'far' }); taken.add(v); }
  return picked;
}

const UNKNOWN_WORDS: Record<Unknown, string> = {
  result: 'how many there are in the end is unknown',
  change: 'how many were added or taken away is unknown',
  start: 'how many there were at the start is unknown',
};

function plainQuestion(it: AddSub20Item): string {
  const [s1, s2] = it.steps;
  const verb = (s: Step, n: number) => (s.op === '+' ? `gets ${n} more` : `gives away ${n}`);
  if (s2) return `Sam has ${s1.a} stickers. Sam ${verb(s1, s1.b)}. Then Sam ${verb(s2, s2.b)}. How many stickers does Sam have now?`;
  const r = result(s1);
  if (it.unknown === 'result') return `Sam has ${s1.a} stickers and ${verb(s1, s1.b)}. How many stickers does Sam have now?`;
  if (it.unknown === 'change') return `Sam has ${s1.a} stickers. Sam ${s1.op === '+' ? 'gets some more' : 'gives some away'} and now has ${r}. How many did Sam ${s1.op === '+' ? 'get' : 'give away'}?`;
  return `Sam had some stickers. Sam ${verb(s1, s1.b)} and now has ${r}. How many stickers did Sam have at the start?`;
}

export const ADD_SUB_20: ItemSpace<AddSub20Item> = {
  id: 'add-sub-20',
  describe: 'adding and subtracting whole numbers within 20 (or a smaller range such as within 10): addition and subtraction facts, sums, differences, missing numbers, one- and two-step word problems',
  grades: ['K', '1', '2'],
  criterion: 'Add and subtract within 20',
  wordingGrade: 'grade 1',
  pick: pickAddSub20,
  items: addSub20Items,
  solve: (it) => {
    const sol = solveAddSub20(it);
    const how = it.steps.length === 2 ? 'two steps, told in this order; the question asks how many at the end' : UNKNOWN_WORDS[it.unknown];
    // One operation only for a one-step item with the result unknown; a missing change or start, or two
    // steps, can be told either way round.
    const operation = it.steps.length === 1 && it.unknown === 'result' ? it.steps[0].op : undefined;
    return { answer: String(sol.answer), shown: sol.shown.map(String), spec: `${sol.expr.replace(' = ?', '')} (${how})`, operation };
  },
  distractors: (it, rand) => addSub20Distractors(it, rand).map((d) => ({ value: String(d.value), distance: d.distance })),
  plainQuestion,
};
