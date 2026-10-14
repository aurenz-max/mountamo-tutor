/**
 * Item space: equivalent fractions with a missing numerator (3.NF.3b, 4.NF.1): a/b = ?/d.
 *
 * The task is one renaming: a fraction and a new denominator; the learner finds the numerator. What
 * makes it harder:
 *   - down: the new denominator is smaller (6/8 = ?/4), so the parts merge rather than split.
 *   - across: neither denominator divides the other (2/4 = ?/6, through 1/2), two steps.
 *   - bigFactor: the scale factor is 3 or more (1/4 = ?/12), not a doubling.
 *   - unit (a numerator of 1) and half (the fraction is 1/2) are the anchors learned first.
 * Which equal fraction it is (2/3 vs 3/4 at the same factor) is incidental.
 *
 * Beta is in logits for a typical grade-4 learner taught equivalence with area and bar models. Priors:
 * the additive error ("add the same to top and bottom") is the main equivalence misconception (Kerslake;
 * Hart's CSMS), merging parts is harder than splitting them (Behr et al., rational number project), and
 * a factor other than 2 removes the doubling anchor. Refit from first-try results when attempts exist.
 */
import type { ItemSpace } from './types';

export interface EquivalenceFeatures { down: number; across: number; bigFactor: number; unit: number; half: number }
export interface EquivalenceItem {
  a: number; b: number; d: number;
  features: EquivalenceFeatures;
  beta: number;
  structure: string;
}

export const EQUIVALENCE_WEIGHTS: Record<keyof EquivalenceFeatures | 'base', number> = {
  base: -0.7, down: 0.9, across: 1.3, bigFactor: 0.4, unit: -0.4, half: -0.4,
};

export function equivalenceFeatures(a: number, b: number, d: number): EquivalenceFeatures {
  const up = d % b === 0;
  const down = b % d === 0;
  const factor = up ? d / b : down ? b / d : 0;
  return {
    down: down ? 1 : 0,
    across: !up && !down ? 1 : 0,
    bigFactor: factor >= 3 ? 1 : 0,
    unit: a === 1 ? 1 : 0,
    half: 2 * a === b ? 1 : 0,
  };
}

const predictBeta = (f: EquivalenceFeatures): number => Math.round(
  (Object.keys(f) as (keyof EquivalenceFeatures)[]).reduce((s, k) => s + EQUIVALENCE_WEIGHTS[k] * f[k], EQUIVALENCE_WEIGHTS.base) * 100,
) / 100;

function build(): EquivalenceItem[] {
  const out: EquivalenceItem[] = [];
  for (let b = 2; b <= 12; b++) for (let a = 1; a < b; a++) for (let d = 2; d <= 12; d++) {
    if (d === b || (a * d) % b !== 0) continue;
    const features = equivalenceFeatures(a, b, d);
    const structure = `${features.across ? 'across' : features.down ? 'down' : 'up'}${features.across ? '' : features.bigFactor ? '|x3+' : '|x2'}`
      + `${features.half ? '|half' : features.unit ? '|unit' : ''}`;
    out.push({ a, b, d, features, beta: predictBeta(features), structure });
  }
  return out;
}

let cache: EquivalenceItem[] | null = null;
export const equivalenceItems = (): EquivalenceItem[] => (cache ??= build());
export const equivalenceAnswer = (it: EquivalenceItem): number => (it.a * it.d) / it.b;

export function pickEquivalence(
  n: number, lo: number, hi: number, rand: () => number = Math.random, accept?: (it: EquivalenceItem) => boolean,
): EquivalenceItem[] {
  const byStructure = new Map<string, EquivalenceItem[]>();
  for (const it of equivalenceItems()) {
    if (it.beta < lo || it.beta > hi || (accept && !accept(it))) continue;
    byStructure.set(it.structure, [...(byStructure.get(it.structure) ?? []), it]);
  }
  const structures = Array.from(byStructure.keys());
  if (!structures.length) return [];
  const used = new Map<string, number>();
  const seen = new Set<string>();
  const picks: EquivalenceItem[] = [];
  for (let guard = 0; picks.length < n && guard < n * 30; guard++) {
    const least = Math.min(...structures.map((s) => used.get(s) ?? 0));
    const open = structures.filter((s) => (used.get(s) ?? 0) === least);
    const key = open[Math.floor(rand() * open.length)];
    const pool = byStructure.get(key)!;
    const it = pool[Math.floor(rand() * pool.length)];
    used.set(key, (used.get(key) ?? 0) + 1);
    // One starting fraction once per session (1/2 = ?/4 and 1/2 = ?/8 are the same lesson twice).
    const id = `${it.a}/${it.b}`;
    if (seen.has(id)) continue;
    seen.add(id);
    picks.push(it);
  }
  return picks;
}

/**
 * Three wrong numerators in 0..d. Near: the additive error (a + (d − b)), the numerator kept (a), the
 * factor applied to the wrong part (d − answer, the other piece count). Far: off by three or more.
 */
export function equivalenceDistractors(it: EquivalenceItem, rand: () => number = Math.random): { value: number; distance: 'near' | 'far' }[] {
  const answer = equivalenceAnswer(it);
  const ok = (v: number) => Number.isInteger(v) && v >= 0 && v <= Math.max(it.d, 12) && v !== answer;
  const nearList = Array.from(new Set([it.a + (it.d - it.b), it.a, it.d - answer, answer + 1, answer - 1].filter(ok)))
    .sort(() => rand() - 0.5);
  const picked: { value: number; distance: 'near' | 'far' }[] = nearList
    .slice(0, it.beta < -0.6 ? 1 : 2).map((value) => ({ value, distance: 'near' }));
  const taken = new Set([answer, ...picked.map((p) => p.value)]);
  for (const k of [3, -3, 4, -4, 5, -5, 6, -6]) {
    if (picked.length === 3) break;
    if (ok(answer + k) && !taken.has(answer + k)) { picked.push({ value: answer + k, distance: 'far' }); taken.add(answer + k); }
  }
  for (let v = 0; picked.length < 3; v++) if (ok(v) && !taken.has(v)) { picked.push({ value: v, distance: 'far' }); taken.add(v); }
  return picked;
}

export const FRACTION_EQUIVALENCE: ItemSpace<EquivalenceItem> = {
  id: 'fraction-equivalence',
  describe: 'equivalent fractions: rename a fraction with a different denominator (find the missing numerator, '
    + 'e.g. 2/3 = ?/12); not comparing, ordering or adding fractions',
  grades: ['3', '4', '5'],
  criterion: 'Find an equivalent fraction',
  wordingGrade: 'grade 4',
  pick: pickEquivalence,
  items: equivalenceItems,
  solve: (it) => ({
    answer: String(equivalenceAnswer(it)),
    shown: [`${it.a}/${it.b}`, String(it.d)],
    spec: `${it.a}/${it.b} = ?/${it.d} (the same amount in ${it.d} equal parts; the answer is the number of parts)`,
  }),
  distractors: (it, rand) => equivalenceDistractors(it, rand).map((d) => ({ value: String(d.value), distance: d.distance })),
  plainQuestion: (it) => `What number makes this true: ${it.a}/${it.b} = ?/${it.d}?`,
};
