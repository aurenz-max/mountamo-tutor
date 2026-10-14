/**
 * Item space: rounding whole numbers to the nearest 10 or 100 (3.NBT.1; 4.NBT.3 extends it past 1000).
 *
 * The task is one rounding: a number up to 999 and a place (ten or hundred). Place value has several
 * tasks (compose, decompose, compare, round); this space is only rounding. What makes it harder:
 *   - toHundred: rounding to the hundred means ignoring the ones and reading the tens.
 *   - five: the deciding digit is 5 (the round-half-up rule has to be known, not felt).
 *   - carry: rounding up changes the next place too (96 to 100, 951 to 1000, 397 to 400).
 *   - zero: a zero in the number (305, 1 0 7) is read as nothing or the place is misjudged.
 *   - exact: the number is already a multiple of the place (rounds to itself; easiest when spotted).
 * Which ten or hundred it is (43 vs 73) is incidental.
 *
 * Beta is in logits for a typical grade-3 learner taught rounding with a number line. Priors from the
 * rounding error literature (rounding the wrong place, rounding down at 5, losing the carry: e.g.
 * Ashlock's error patterns). Refit from first-try results when attempts exist.
 */
import type { ItemSpace } from './types';

export interface RoundingFeatures { toHundred: number; five: number; carry: number; zero: number; exact: number; threeDigit: number }
export interface RoundingItem {
  n: number;
  place: 10 | 100;
  features: RoundingFeatures;
  beta: number;
  structure: string;
}

export const ROUNDING_WEIGHTS: Record<keyof RoundingFeatures | 'base', number> = {
  base: -1.3, toHundred: 0.8, five: 0.8, carry: 0.7, zero: 0.4, exact: -0.6, threeDigit: 0.4,
};

export const roundTo = (n: number, place: number): number => Math.floor((n + place / 2) / place) * place;

export function roundingFeatures(n: number, place: 10 | 100): RoundingFeatures {
  const deciding = Math.floor(n / (place / 10)) % 10;
  const rounded = roundTo(n, place);
  const above = Math.floor(n / (place * 10)); // the digit(s) left of the rounding place
  return {
    toHundred: place === 100 ? 1 : 0,
    five: deciding === 5 ? 1 : 0,
    // Rounding up changed the place to the left as well (96 -> 100, 397 -> 400 when rounding to ten).
    carry: rounded > n && Math.floor(rounded / (place * 10)) !== above ? 1 : 0,
    zero: n >= 100 && String(n).slice(0, -1).includes('0') ? 1 : 0,
    exact: n % place === 0 ? 1 : 0,
    threeDigit: n >= 100 ? 1 : 0,
  };
}

const predictBeta = (f: RoundingFeatures): number => Math.round(
  (Object.keys(f) as (keyof RoundingFeatures)[]).reduce((s, k) => s + ROUNDING_WEIGHTS[k] * f[k], ROUNDING_WEIGHTS.base) * 100,
) / 100;

function build(): RoundingItem[] {
  const out: RoundingItem[] = [];
  for (let n = 11; n <= 999; n++) {
    for (const place of [10, 100] as const) {
      if (place === 100 && n < 100) continue;
      // A multiple of the place rounds to itself: keep a few multiples of 30 as exact items when
      // rounding to ten, none when rounding to a hundred (300 to 300 is not a rounding).
      if (n % place === 0 && (place === 100 || n % 30 !== 0)) continue;
      const features = roundingFeatures(n, place);
      const structure = `to${place}|${features.threeDigit ? '3d' : '2d'}${features.five ? '|five' : ''}`
        + `${features.carry ? '|carry' : ''}${features.zero ? '|zero' : ''}${features.exact ? '|exact' : ''}`;
      out.push({ n, place, features, beta: predictBeta(features), structure });
    }
  }
  return out;
}

let cache: RoundingItem[] | null = null;
export const roundingItems = (): RoundingItem[] => (cache ??= build());

export function pickRounding(
  n: number, lo: number, hi: number, rand: () => number = Math.random, accept?: (it: RoundingItem) => boolean,
): RoundingItem[] {
  const byStructure = new Map<string, RoundingItem[]>();
  for (const it of roundingItems()) {
    if (it.beta < lo || it.beta > hi || (accept && !accept(it))) continue;
    byStructure.set(it.structure, [...(byStructure.get(it.structure) ?? []), it]);
  }
  const structures = Array.from(byStructure.keys());
  if (!structures.length) return [];
  const used = new Map<string, number>();
  const seen = new Set<number>();
  const picks: RoundingItem[] = [];
  for (let guard = 0; picks.length < n && guard < n * 30; guard++) {
    const least = Math.min(...structures.map((s) => used.get(s) ?? 0));
    const open = structures.filter((s) => (used.get(s) ?? 0) === least);
    const key = open[Math.floor(rand() * open.length)];
    const pool = byStructure.get(key)!;
    const it = pool[Math.floor(rand() * pool.length)];
    used.set(key, (used.get(key) ?? 0) + 1);
    // One number once per session, whichever place it is rounded to.
    if (seen.has(it.n)) continue;
    seen.add(it.n);
    picks.push(it);
  }
  return picks;
}

/**
 * Three wrong answers. Near: rounded the other way (down instead of up, or up instead of down),
 * rounded to the other place, truncated (dropped the digits, the carry lost: 96 -> 90). Far: two
 * places of the rounding unit away.
 */
export function roundingDistractors(it: RoundingItem, rand: () => number = Math.random): { value: number; distance: 'near' | 'far' }[] {
  const answer = roundTo(it.n, it.place);
  const ok = (v: number) => v >= 0 && v <= 1000 && v !== answer;
  const otherWay = answer > it.n || answer === it.n ? answer - it.place : answer + it.place;
  const otherPlace = roundTo(it.n, it.place === 10 ? 100 : 10);
  const truncated = Math.floor(it.n / it.place) * it.place;
  // Never the number itself: it is not a multiple of the place, so it gives itself away.
  const nearList = Array.from(new Set([otherWay, otherPlace, truncated].filter(ok))).sort(() => rand() - 0.5);
  const picked: { value: number; distance: 'near' | 'far' }[] = nearList
    .slice(0, it.beta < -0.6 ? 1 : 2).map((value) => ({ value, distance: 'near' }));
  const taken = new Set([answer, ...picked.map((p) => p.value)]);
  for (const d of [2, -2, 3, -3, 4, -4]) {
    if (picked.length === 3) break;
    const v = answer + d * it.place;
    if (ok(v) && !taken.has(v)) { picked.push({ value: v, distance: 'far' }); taken.add(v); }
  }
  return picked;
}

export const ROUNDING: ItemSpace<RoundingItem> = {
  id: 'round-10-100',
  describe: 'rounding whole numbers to the nearest ten or the nearest hundred (place value: rounding)',
  grades: ['3', '4'],
  criterion: 'Round whole numbers to the nearest 10 or 100',
  wordingGrade: 'grade 3',
  pick: pickRounding,
  items: roundingItems,
  solve: (it) => ({
    answer: String(roundTo(it.n, it.place)),
    shown: [String(it.n), String(it.place)],
    spec: `round ${it.n} to the nearest ${it.place} (the question says "to the nearest ${it.place}" once and names no other number)`,
  }),
  distractors: (it, rand) => roundingDistractors(it, rand).map((d) => ({ value: String(d.value), distance: d.distance })),
  plainQuestion: (it) => `What is ${it.n} rounded to the nearest ${it.place}?`,
};
