/**
 * ten-frame operate items from an item space (service/itemSpace, skill /add-item-space).
 *
 * The LLM chose the problems, and every tier and nearly every run gave the same session
 * (8 + 3, 7 + 6, 9 + 6, 12 − 6, 14 − 8; 10-13 probe). With a tier and an objective the resolver fits
 * to add-sub-20, code picks each problem at the tier's beta band. The instruction is already built in
 * code from the numbers (SP-17); the hint and narration are written here.
 *
 * Which items operate can draw (contract, item-space clause): one step with the result unknown (the
 * frame shows the start, the child says the result), every number within the lesson's maxNumber,
 * additions only when the lesson has no subtraction and the reverse. A subtraction leaves at least 1.
 *
 * Also here: the tier windows for the two whole-session choices (split and build_pair totals), which
 * are one ordered quantity, not an item space.
 */
import type { TenFrameChallenge } from '../../primitives/visual-primitives/math/TenFrame';
import type { AddSub20Item } from '../itemSpace/addSub20';
import { tierWindow } from '../itemSpace';

export type OperateItem =
  | { type: 'add'; addend1: number; addend2: number; targetCount: number }
  | { type: 'subtract'; startCount: number; targetCount: number };

export function itemAsOperate(
  it: AddSub20Item, maxNumber: number, ops: { add: boolean; subtract: boolean },
): OperateItem | null {
  if (it.steps.length !== 1 || it.unknown !== 'result') return null;
  const { a, b, op } = it.steps[0];
  if (op === '+') return ops.add && a + b <= maxNumber ? { type: 'add', addend1: a, addend2: b, targetCount: a + b } : null;
  return ops.subtract && a <= maxNumber && a - b >= 1 ? { type: 'subtract', startCount: a, targetCount: a - b } : null;
}

export interface SpaceOperate {
  op: OperateItem;
  itemSpace: { space: string; structure: string; beta: number };
}

/** `count` operate items in the band, or empty (the caller keeps its own path). */
export function pickOperate(opts: {
  pick: (n: number, lo: number, hi: number, rand?: () => number, accept?: (item: any) => boolean) => AddSub20Item[];
  band: [number, number];
  count: number;
  maxNumber: number;
  ops: { add: boolean; subtract: boolean };
}): SpaceOperate[] {
  const items = opts.pick(opts.count, opts.band[0], opts.band[1], undefined, (it) => itemAsOperate(it, opts.maxNumber, opts.ops) !== null);
  if (items.length < opts.count) return [];
  return items.map((it) => ({
    op: itemAsOperate(it, opts.maxNumber, opts.ops)!,
    itemSpace: { space: 'add-sub-20', structure: it.structure, beta: it.beta },
  }));
}

/** The challenge for a picked item. Hint and narration name the given numbers, never the result. */
export function operateChallenge(o: SpaceOperate, id: string): TenFrameChallenge {
  const { op } = o;
  return op.type === 'add'
    ? {
      id, type: 'add', instruction: '', targetCount: op.targetCount, addend1: op.addend1, addend2: op.addend2,
      hint: 'Put the first group on the frame, then add the second group. Fill a ten first.',
      narration: `Let's put ${op.addend1} and ${op.addend2} on the frame.`, itemSpace: o.itemSpace,
    }
    : {
      id, type: 'subtract', instruction: '', targetCount: op.targetCount, startCount: op.startCount,
      hint: 'Take the counters off one at a time, then count what is left.',
      narration: `There are ${op.startCount} counters. We will take ${op.startCount - op.targetCount} away.`, itemSpace: o.itemSpace,
    };
}

/**
 * The totals for a split or build_pair session: three totals each asked twice (a second, different
 * way). With a tier, the totals come from the tier's window of 3..ceiling: a larger total has more ways
 * to split, so the search is longer. Without a tier, from the whole range.
 */
export function pairTotals(
  count: number, ceiling: number, rand: () => number = Math.random, tier?: 'easy' | 'medium' | 'hard',
): number[] {
  const top = Math.max(3, Math.min(10, ceiling));
  const all = Array.from({ length: top - 2 }, (_, i) => i + 3);
  const want = Math.max(1, Math.ceil(count / 2));
  const pool = tier ? tierWindow(all, tier, want) : all;
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const distinct = pool.slice(0, want).sort((a, b) => a - b);
  const out: number[] = [];
  for (let i = 0; out.length < count; i++) out.push(distinct[Math.floor(i / 2) % distinct.length]);
  return out;
}
