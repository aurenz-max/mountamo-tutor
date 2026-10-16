/**
 * comparison-builder numbers chosen in code (skill /add-item-space, "a mode whose difficulty is one
 * ordered quantity").
 *
 * one-more-one-less: the LLM gave the same targets every run and at every tier (5, 8, 12, 15, 18; 10-14
 * probe), so the tier changed only which question was asked. What makes a target hard is crossing a
 * decade in the asked direction (one more than 19 is 20; one less than 10 is 9: the tens digit changes
 * and the ones digit wraps), then a teen target. Targets rank by that and each tier takes its
 * `tierWindow`; hard always holds a crossing when the window has one.
 *
 * `fallbackSession`: when both generation attempts fail, the session is still `count` cards built from
 * code (the old fallback shipped a single card, 4 of 6 one-more-one-less medium/hard runs on 10-14).
 */
import type { ComparisonBuilderChallenge } from '../../primitives/visual-primitives/math/ComparisonBuilder';
import { tierWindow } from '../itemSpace';
import { COMPARE_NUMBERS, symbolOf } from '../itemSpace/compareNumbers';

type Tier = 'easy' | 'medium' | 'hard';
type AskFor = NonNullable<ComparisonBuilderChallenge['askFor']>;

const shuffle = <T,>(xs: T[], rand: () => number): T[] => {
  const out = xs.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** The asked answer crosses a decade: one more than 9 or 19, one less than 10 or 20. */
export function crossesDecade(target: number, askFor: AskFor): boolean {
  const more = askFor !== 'one-less' && target % 10 === 9;
  const less = askFor !== 'one-more' && target % 10 === 0 && target >= 10;
  return more || less;
}

/** Targets the card can ask about: one more stays within max, one less stays at 1 or above. */
export function validTargets(max: number, askFor: AskFor): number[] {
  const lo = askFor === 'one-more' ? 1 : 2;
  const hi = askFor === 'one-less' ? max : max - 1;
  return Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);
}

export function oneMoreLessTargets(max: number, askFor: AskFor, tier: Tier, count: number, rand: () => number = Math.random): number[] {
  const score = (t: number) => (crossesDecade(t, askFor) ? 2 : 0) + (t > 10 ? 1 : 0) + t / 100;
  const ranked = validTargets(max, askFor).sort((a, b) => score(a) - score(b));
  const window = tierWindow(ranked, tier, count);
  const picks = shuffle(window, rand).slice(0, count);
  const crossing = window.filter((t) => crossesDecade(t, askFor));
  if (tier === 'hard' && crossing.length && !picks.some((t) => crossesDecade(t, askFor))) {
    picks[0] = crossing[Math.floor(rand() * crossing.length)];
  }
  return picks;
}

const INSTRUCTION: Record<AskFor, string> = {
  'one-more': 'What number is one more?',
  'one-less': 'What number is one less?',
  both: 'What number is one more? What number is one less?',
};
export const oneMoreLessInstruction = (askFor: AskFor) => INSTRUCTION[askFor];

/** A full session of `count` cards for one mode, built in code. */
export function fallbackSession(
  mode: ComparisonBuilderChallenge['type'], count: number,
  opts: { numeralMax: number; numeralMin: number; groupPairs: { left: number; right: number }[]; rand?: () => number },
): ComparisonBuilderChallenge[] {
  const rand = opts.rand ?? Math.random;
  const id = (i: number) => `c${i + 1}`;
  if (mode === 'compare-numbers') {
    const inWindow = (it: { left: number; right: number }) => Math.min(it.left, it.right) >= opts.numeralMin && Math.max(it.left, it.right) <= opts.numeralMax;
    return COMPARE_NUMBERS.pick(count, -10, 10, rand, inWindow).map((it, i) => ({
      id: id(i), type: 'compare-numbers', instruction: 'Choose the symbol that makes this true.',
      leftNumber: it.left, rightNumber: it.right, correctSymbol: symbolOf(it.left, it.right),
    }));
  }
  if (mode === 'one-more-one-less') {
    return oneMoreLessTargets(opts.numeralMax, 'both', 'medium', count, rand).map((t, i) => ({
      id: id(i), type: 'one-more-one-less', instruction: oneMoreLessInstruction('both'), targetNumber: t, askFor: 'both',
    }));
  }
  if (mode === 'order') {
    const pool = Array.from({ length: opts.numeralMax }, (_, i) => i + 1);
    return Array.from({ length: count }, (_, i) => ({
      id: id(i), type: 'order', instruction: 'Put these numbers in order from least to greatest.',
      numbers: shuffle(pool, rand).slice(0, Math.min(3 + (i % 3), pool.length)), direction: 'ascending',
    }));
  }
  const objects = ['bears', 'apples', 'stars', 'fish', 'blocks'];
  return Array.from({ length: count }, (_, i) => {
    const p = opts.groupPairs[i % Math.max(1, opts.groupPairs.length)] ?? { left: 3, right: 5 };
    const objectType = objects[i % objects.length];
    return {
      id: id(i), type: 'compare-groups', instruction: `Which group has more ${objectType}?`,
      leftGroup: { count: p.left, objectType }, rightGroup: { count: p.right, objectType },
      correctAnswer: p.left > p.right ? 'more' : p.left < p.right ? 'less' : 'equal',
    };
  });
}

/**
 * order: the sets to sort, chosen in code. The LLM gave the same sets every run, and the tier changed only
 * the sort direction (8.1b, 10-14 probe). What makes a set hard to order is how close its numbers are: two
 * neighbours (14, 15) or two in the same ten must be told apart by the ones digit. Easy keeps every
 * neighbouring pair at least `wide` apart, medium 2 or more but not that wide, hard holds a pair 1 apart
 * (and, above 10, two numbers in one ten). Set size stays `size` at every tier (contract: not item count).
 * Each set is shown shuffled, never already in order.
 */
export function orderSets(
  window: { min: number; max: number }, size: number, tier: Tier | null, count: number, rand: () => number = Math.random,
): number[][] {
  const span = window.max - window.min + 1;
  if (span < size) return [];
  const wide = Math.max(3, Math.floor(span / (size + 1)));
  const minGap = (s: number[]) => Math.min(...s.slice(1).map((v, i) => v - s[i]));
  const sameTen = (s: number[]) => new Set(s.map((v) => Math.floor(v / 10))).size < s.length;
  const fits = (s: number[]) => {
    const g = minGap(s);
    if (tier === 'easy') return g >= wide;
    if (tier === 'medium') return g >= 2 && g < wide;
    if (tier === 'hard') return g === 1 && (window.max <= 10 || sameTen(s));
    return true;
  };
  const roll = () => {
    const pool = shuffle(Array.from({ length: span }, (_, i) => window.min + i), rand);
    return pool.slice(0, size).sort((a, b) => a - b);
  };
  const out: number[][] = [];
  const seen = new Set<string>();
  // A narrow window may hold no set of the tier's shape: take any set rather than none.
  for (const strict of [true, false]) {
    for (let guard = 0; out.length < count && guard < 4000; guard++) {
      const s = roll();
      const key = s.join(',');
      if (seen.has(key) || (strict && !fits(s))) continue;
      seen.add(key);
      let shown = shuffle(s, rand);
      for (let t = 0; t < 6 && (shown.join() === s.join() || shown.join() === [...s].reverse().join()); t++) shown = shuffle(s, rand);
      out.push(shown);
    }
  }
  return out;
}
