/**
 * double-number-line find_missing from the ratio-missing-value item space (skill /add-item-space).
 *
 * A session shares one given pair and one rate, and the LLM chose them: every tier and run drew a given
 * of 2 with asks 3, 4, 5, 6 in order (10-14 probe), so each answer was the last one plus the rate. With a
 * tier, code chooses the session's base ratio a : b (the given pair) and its asks (`pickDnlSession`), in
 * the order the spread draws them.
 *
 * Drawable: items with the second quantity unknown, not unit-rate items, the ask within the line's top
 * (20), the base ratio's own pair excluded (it is the given point).
 */
import { TIER_BANDS, tierPick, tierWindow, type ItemSpace } from '../itemSpace';
import type { RatioItem } from '../itemSpace/ratioMissingValue';

export const DNL_MAX_INPUT = 20;

export const dnlDrawable = (it: RatioItem): boolean =>
  it.hidden === 'second' && !it.features.unitRate && it.k <= DNL_MAX_INPUT && it.k !== it.a;

export interface DnlSessionPick { a: number; b: number; asks: RatioItem[] }

/**
 * The session's base ratio is the main lever (a whole rate like 3 : 12 makes every ask "times 4"; 4 : 6
 * needs 1.5 per one), so bases rank by the mean beta of their asks and each tier takes its `tierWindow` of
 * bases (picking only by item count chose whole-rate bases every time, 10-14 probe). Within the chosen
 * base, a base that holds three tiers' worth of asks gives its tier third; a smaller one spreads across
 * its structures.
 */
export function pickDnlSession(
  space: ItemSpace<RatioItem>, tier: 'easy' | 'medium' | 'hard', count: number,
  rand: () => number = Math.random, log?: (m: string) => void,
): DnlSessionPick | null {
  const byBase = new Map<string, RatioItem[]>();
  for (const it of space.items!().filter(dnlDrawable)) {
    byBase.set(`${it.a}:${it.b}`, [...(byBase.get(`${it.a}:${it.b}`) ?? []), it]);
  }
  const mean = (xs: RatioItem[]) => xs.reduce((t, x) => t + x.beta, 0) / xs.length;
  const ranked = Array.from(byBase.entries()).filter(([, xs]) => xs.length >= count + 1)
    .sort((x, y) => mean(x[1]) - mean(y[1]));
  const window = tierWindow(ranked, tier, 3);
  if (!window.length) return null;
  const [key, xs] = window[Math.floor(rand() * window.length)];
  const [a, b] = key.split(':').map(Number);
  const sameBase = (it: RatioItem) => dnlDrawable(it) && it.a === a && it.b === b;
  const [lo, hi] = TIER_BANDS[tier];
  const asks = (xs.length >= 3 * count
    ? tierPick(space, log, sameBase)(count, lo, hi, rand, sameBase)
    : space.pick(count, -10, 10, rand, sameBase)) as RatioItem[];
  return asks.length === count ? { a, b, asks } : null;
}
