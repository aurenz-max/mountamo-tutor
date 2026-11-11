/**
 * bar-model predict_then_collect (MEAS001-03-F): the learner says which choice will be most popular, then records the
 * answers as they come in, one at a time, and says whether the guess held.
 *
 * Code owns every count, the order the answers arrive in and the key. The guess is captured before any answer is shown
 * and is never graded. What is checked is the record (each row holds the answers that came in for it) and the verdict
 * (yes when the guessed row holds the most, no otherwise), read from the learner's own chart. The tier sets how many
 * rows there are and how far the most popular row is ahead of the next: easy 2 rows, ahead by 3; medium 3, by 2;
 * hard 3, by 1. Counts stay 1-6, so a whole survey is at most a dozen taps.
 *
 * Pure: the generator, the component, the boss and the tests read the same rules.
 */
import type { BarModelChallenge } from './BarModel';

type Tier = 'easy' | 'medium' | 'hard';

const SHAPE: Record<Tier, { rows: number; lead: number }> = {
  easy: { rows: 2, lead: 3 }, medium: { rows: 3, lead: 2 }, hard: { rows: 3, lead: 1 },
};

/** The row with the most, or -1 when the most is shared (a survey with no single winner has no verdict). */
export function mostRow(counts: readonly number[]): number {
  const top = Math.max(...counts);
  return counts.filter(n => n === top).length === 1 ? counts.indexOf(top) : -1;
}

/**
 * The counts for one survey: a single most popular row, `lead` ahead of the next, every row at least one. Which row
 * wins is drawn, so the first row is not the winner more often than the others.
 */
export function collectCounts(tier: Tier | null, rand: () => number = Math.random): number[] {
  const { rows, lead } = SHAPE[tier ?? 'medium'];
  const pick = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const second = pick(1, 6 - lead);
  const top = second + lead;
  const rest = Array.from({ length: rows - 2 }, () => pick(1, second));
  const others = [second, ...rest];
  const win = Math.floor(rand() * rows);
  const counts: number[] = [];
  for (let i = 0, k = 0; i < rows; i++) counts.push(i === win ? top : others[k++]);
  return counts;
}

/** The order the answers come in: every answer once, shuffled, so the winner cannot be read from the first few. */
export function collectArrivals(counts: readonly number[], rand: () => number = Math.random): number[] {
  const all = counts.flatMap((n, i) => Array.from({ length: n }, () => i));
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
}

/** The verdict the learner's own chart supports for a guess: yes when the guessed row alone holds the most. */
export function collectVerdict(built: readonly number[], prediction: number | null): 'yes' | 'no' | null {
  if (prediction == null) return null;
  return mostRow(built) === prediction ? 'yes' : 'no';
}

/** The activity's check: the chart holds every answer in its own row, and the verdict matches that chart. */
export function collectCorrect(c: BarModelChallenge, built: readonly number[], prediction: number | null,
  verdict: 'yes' | 'no' | null): boolean {
  const want = c.expectedCounts ?? [];
  return prediction != null && verdict != null && want.length === built.length && want.every((n, i) => built[i] === n)
    && verdict === collectVerdict(built, prediction);
}

/** How many answers have been recorded so far: the next answer to show is `sourceItems[recorded]`. */
export const recordedCount = (built: readonly { value: number }[]) => built.reduce((s, r) => s + r.value, 0);
