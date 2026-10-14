/**
 * number-bond bonds from an item space (service/itemSpace, skill /add-item-space).
 *
 * The LLM chose the bonds, and every tier and every run gave nearly the same set (missing_part
 * 4/1 6/2 7/3 8/4 10/4 in 9 of 12 runs; 10-13 probe): the tier moved scaffolds and the unknown side,
 * never the bond. With a tier and an objective the resolver fits to bonds-10, code picks each bond at
 * the tier's beta band; the LLM writes only the instruction.
 *
 * Which items each mode can draw (contract, item-space clause):
 *   - missing_part, related_fact, fact_family, build_equation: bonds with a part unknown (every mode
 *     asks for a part: the covered part, the "how many more" turn, the subtraction forms). The known
 *     part is `part1`; the other is the missing part.
 *   - every whole is 2..maxNumber (K 5, Grade 1 10); related_fact needs unequal parts (R8).
 *   - decompose (every split of a whole) and ten_and_ones (a teen whole) are not this space's task.
 *     `decomposeWholes` sets decompose's wholes by tier in code instead.
 */
import { bondKey, bonds10Items, type Bond10Item } from '../itemSpace/bonds10';
import { tierWindow } from '../itemSpace';

export type BondType = 'missing-part' | 'related-fact' | 'fact-family' | 'build-equation';
export const SPACE_BOND_TYPES: readonly string[] = ['missing-part', 'related-fact', 'fact-family', 'build-equation'];

export interface SpaceBond {
  whole: number;
  part1: number;
  part2: number;
  itemSpace: { space: string; structure: string; beta: number };
}

/** The bond a mode draws from an item, or null when the mode cannot use it. */
export function itemAsBond(item: Bond10Item, type: BondType, maxNumber: number): { whole: number; part1: number; part2: number } | null {
  if (item.unknown !== 'part' || item.whole > maxNumber) return null;
  if (type === 'related-fact' && item.known === item.other) return null;
  return { whole: item.whole, part1: item.known, part2: item.other };
}

/** How many different bonds the mode can draw within maxNumber (a bond and its turnaround are one). */
export function scopeBondCount(type: BondType, maxNumber: number): number {
  return new Set(bonds10Items().filter((it) => itemAsBond(it, type, maxNumber)).map(bondKey)).size;
}

/** `count` bonds in the band the mode can draw, or empty (the caller keeps its own path). */
export function pickBonds(opts: {
  pick: (n: number, lo: number, hi: number, rand?: () => number, accept?: (item: any) => boolean) => Bond10Item[];
  band: [number, number];
  count: number;
  type: BondType;
  maxNumber: number;
}): SpaceBond[] {
  const items = opts.pick(opts.count, opts.band[0], opts.band[1], undefined, (it) => itemAsBond(it, opts.type, opts.maxNumber) !== null);
  if (items.length < opts.count) return [];
  return items
    .map((it) => ({ ...itemAsBond(it, opts.type, opts.maxNumber)!, itemSpace: { space: 'bonds-10', structure: it.structure, beta: it.beta } }))
    // Smaller wholes first, as the mode's own sessions open.
    .sort((a, b) => a.whole - b.whole || a.part1 - b.part1);
}

/**
 * decompose's wholes by tier. Finding every split is the task, so the load is how many splits there
 * are (a whole w has floor(w/2)+1): easy draws from the lower wholes of the window, hard from the upper,
 * medium from the middle. When the window is too narrow to separate (K, 2..5) the tiers share it.
 */
export function decomposeWholes(
  tier: 'easy' | 'medium' | 'hard', maxNumber: number, count: number, rand: () => number = Math.random,
): number[] {
  // 2..maxNumber; from 3 when the window reaches 8 (a whole of 2 has one split besides 0 + 2).
  const lo = maxNumber >= 8 ? 3 : 2;
  const all = Array.from({ length: Math.max(0, maxNumber - lo + 1) }, (_, i) => i + lo);
  const window = tierWindow(all, tier, count);
  const picks = [...window].sort(() => rand() - 0.5).slice(0, count);
  // A window smaller than the session repeats round-robin rather than collapsing onto one whole.
  while (picks.length < count && window.length) picks.push(window[picks.length % window.length]);
  return picks.sort((a, b) => a - b);
}

/**
 * Whether the written instruction can stand: it names the whole, names the known part on a
 * missing-part item, and never states the missing part (unless that number is also a stated one, as
 * in 3 and 3 make 6).
 */
export function bondInstructionFits(instruction: string | undefined, type: string, b: { whole: number; part1: number; part2: number }): boolean {
  if (!instruction) return false;
  const nums = (instruction.match(/\d+/g) ?? []).map(Number);
  if (!nums.includes(b.whole)) return false;
  if (type === 'missing-part') {
    if (!nums.includes(b.part1)) return false;
    if (b.part2 !== b.part1 && b.part2 !== b.whole && nums.includes(b.part2)) return false;
  }
  if (type === 'related-fact' && nums.some((n) => n !== b.whole)) return false;
  return true;
}
