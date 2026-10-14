/**
 * Item space: number bonds within 10 (K.OA.3-5, 1.OA.6 "make ten").
 *
 * The task is one part-part-whole bond: a whole up to 10 and its two parts, with one of the three
 * unknown. Either a part is unknown (the whole and one part are known: "7 is 3 and how many?") or
 * the whole is (both parts known: "3 and 4 make how many?"). Finding every split of a whole is a
 * different task (number-bond `decompose`) and is not in this space.
 *
 * Beta is in logits for a typical K-1 learner taught bonds. The weights are priors:
 *   - unknownPart: a missing part is harder than a missing whole (Carpenter & Moser's part-part-whole
 *     problems; Riley, Greeno & Heller 1983: part-unknown is solved later than whole-unknown).
 *   - size: the problem-size effect (Ashcraft 1992); within 10 it is the main magnitude effect.
 *   - partOne, double, fiveAnchor, tenBond: the anchors young learners use first (n and 1 is counting
 *     on one; doubles; five-frame structure; bonds to ten are drilled as a set; Baroody 2006, Fuson).
 *   - missingLarger: counting up from the known part takes as many counts as the missing part, so a
 *     missing part larger than the known one is the longer count (Fuson 1992, counting-on for missing
 *     addends).
 * Refit from first-try results when attempts exist.
 */
import type { ItemSpace } from './types';

export type BondUnknown = 'part' | 'whole';
export interface BondFeatures {
  unknownPart: number;
  size: number;
  partOne: number;
  double: number;
  fiveAnchor: number;
  tenBond: number;
  missingLarger: number;
}
export interface Bond10Item {
  whole: number;
  /** The part the problem states first. For a missing part it is the known part. */
  known: number;
  /** The other part: the answer when a part is unknown. */
  other: number;
  unknown: BondUnknown;
  features: BondFeatures;
  beta: number;
  structure: string;
}

export const BONDS_10_WEIGHTS: Record<keyof BondFeatures | 'base', number> = {
  base: -2.0, unknownPart: 0.9, size: 2.0, partOne: -0.9, double: -0.5, fiveAnchor: -0.4, tenBond: -0.3, missingLarger: 0.3,
};

export function bondFeatures(whole: number, known: number, unknown: BondUnknown): BondFeatures {
  const other = whole - known;
  return {
    unknownPart: unknown === 'part' ? 1 : 0,
    size: whole / 10,
    partOne: known === 1 || other === 1 ? 1 : 0,
    double: known === other ? 1 : 0,
    fiveAnchor: whole > 5 && (known === 5 || other === 5) ? 1 : 0,
    tenBond: whole === 10 ? 1 : 0,
    missingLarger: unknown === 'part' && other > known ? 1 : 0,
  };
}

const predictBeta = (f: BondFeatures): number =>
  Math.round((Object.keys(f) as (keyof BondFeatures)[]).reduce((s, k) => s + BONDS_10_WEIGHTS[k] * f[k], BONDS_10_WEIGHTS.base) * 100) / 100;

function structureOf(whole: number, f: BondFeatures, unknown: BondUnknown): string {
  const anchor = [f.partOne && 'one', f.double && 'double', f.fiveAnchor && 'five', f.tenBond && 'ten'].filter(Boolean).join('+') || 'none';
  return `${unknown}|${whole <= 5 ? 'to5' : 'to10'}|${anchor}${unknown === 'part' ? (f.missingLarger ? '|up-long' : '|up-short') : ''}`;
}

function build(): Bond10Item[] {
  const out: Bond10Item[] = [];
  for (let whole = 2; whole <= 10; whole++) {
    // Parts are 1..whole-1: a part of 0 tests the rule for zero, not the bond.
    for (let known = 1; known < whole; known++) {
      for (const unknown of ['part', 'whole'] as const) {
        const features = bondFeatures(whole, known, unknown);
        out.push({ whole, known, other: whole - known, unknown, features, beta: predictBeta(features), structure: structureOf(whole, features, unknown) });
      }
    }
  }
  return out;
}

let cache: Bond10Item[] | null = null;
/** Every bond item (90), built once. */
export const bonds10Items = (): Bond10Item[] => (cache ??= build());

/** One bond once per pick: 3 + 4 = 7 and 7 = 4 + ?, or 3 + 4 and 4 + 3, are the same three numbers. */
export const bondKey = (it: Bond10Item): string => `${it.whole}:${Math.min(it.known, it.other)}`;

/**
 * `n` items with beta in [lo, hi], spread across structures (least used first), no bond twice.
 */
export function pickBonds10(
  n: number, lo: number, hi: number, rand: () => number = Math.random, accept?: (item: Bond10Item) => boolean,
): Bond10Item[] {
  const byStructure = new Map<string, Bond10Item[]>();
  for (const it of bonds10Items()) {
    if (it.beta < lo || it.beta > hi || (accept && !accept(it))) continue;
    byStructure.set(it.structure, [...(byStructure.get(it.structure) ?? []), it]);
  }
  const structures = Array.from(byStructure.keys());
  if (!structures.length) return [];
  const used = new Map<string, number>();
  const seen = new Set<string>();
  const picks: Bond10Item[] = [];
  for (let guard = 0; picks.length < n && guard < n * 30; guard++) {
    const least = Math.min(...structures.map((s) => used.get(s) ?? 0));
    const open = structures.filter((s) => (used.get(s) ?? 0) === least);
    const key = open[Math.floor(rand() * open.length)];
    const pool = byStructure.get(key)!;
    const it = pool[Math.floor(rand() * pool.length)];
    used.set(key, (used.get(key) ?? 0) + 1);
    if (seen.has(bondKey(it))) continue;
    seen.add(bondKey(it));
    picks.push(it);
  }
  return picks;
}

const answerOf = (it: Bond10Item): number => (it.unknown === 'part' ? it.other : it.whole);

/**
 * Three wrong answers inside 0..10. Near: the number shown (the whole, the known part), the two
 * numbers combined the wrong way (added for a missing part, subtracted for a missing whole), a
 * counting slip of one. Far: three or more away. Every set keeps at least one far option.
 */
export function bonds10Distractors(it: Bond10Item, rand: () => number = Math.random): { value: number; distance: 'near' | 'far' }[] {
  const answer = answerOf(it);
  const ok = (v: number) => Number.isInteger(v) && v >= 0 && v <= 10 && v !== answer;
  const near = it.unknown === 'part'
    ? [it.whole, it.known, it.whole + it.known, answer + 1, answer - 1]
    : [Math.abs(it.known - it.other), it.known, it.other, answer + 1, answer - 1];
  const nearList = Array.from(new Set(near.filter(ok))).sort(() => rand() - 0.5);
  const picked: { value: number; distance: 'near' | 'far' }[] = nearList
    .slice(0, it.beta < -0.6 ? 1 : 2).map((value) => ({ value, distance: 'near' }));
  const taken = new Set([answer, ...picked.map((p) => p.value)]);
  for (const v of [answer + 4, answer - 4, answer + 3, answer - 3, answer + 5, answer - 5, answer + 6, answer - 6]) {
    if (picked.length === 3) break;
    if (ok(v) && !taken.has(v)) { picked.push({ value: v, distance: 'far' }); taken.add(v); }
  }
  for (let v = 0; picked.length < 3 && v <= 10; v++) if (!taken.has(v)) { picked.push({ value: v, distance: 'far' }); taken.add(v); }
  return picked;
}

const plainQuestion = (it: Bond10Item): string => (it.unknown === 'part'
  ? `The whole is ${it.whole}. One part is ${it.known}. What is the other part?`
  : `One part is ${it.known}. The other part is ${it.other}. What is the whole?`);

export const BONDS_10: ItemSpace<Bond10Item> = {
  id: 'bonds-10',
  describe: 'number bonds: a whole up to 10 split into two parts (part-part-whole), decomposing a number into pairs, '
    + 'the missing part of a whole, the partner that makes ten; framed as parts and a whole, not as addition and subtraction facts',
  grades: ['K', '1'],
  criterion: 'Find the missing part or the whole of a number bond within 10',
  wordingGrade: 'kindergarten or grade 1',
  pick: pickBonds10,
  items: bonds10Items,
  solve: (it) => ({
    answer: String(answerOf(it)),
    shown: it.unknown === 'part' ? [String(it.whole), String(it.known)] : [String(it.known), String(it.other)],
    spec: it.unknown === 'part'
      ? `${it.known} + ? = ${it.whole} (a number bond: the whole and one part are known, the other part is unknown)`
      : `${it.known} + ${it.other} = ? (a number bond: both parts are known, the whole is unknown)`,
  }),
  distractors: (it, rand) => bonds10Distractors(it, rand).map((d) => ({ value: String(d.value), distance: d.distance })),
  plainQuestion,
};
