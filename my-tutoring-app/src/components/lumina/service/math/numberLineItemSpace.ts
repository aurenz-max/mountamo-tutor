/**
 * number-line `jump` problems from an item space (service/itemSpace, skill /add-item-space).
 *
 * The jump task is add or subtract by moving along the line: start, hop, land. When a lesson asks for a
 * tier (`config.difficulty`) and the objective is a strand code owns, the space picks the
 * problems and code turns each into hops; the LLM writes only the instruction and hint.
 *
 * Which items a number line can draw (contract R4):
 *   - result unknown only: the learner places the landing. A missing change or start has no landing
 *     to place, so those structures are filtered out of the pick.
 *   - every hop from the band's table (K-2: 1..5), so the hop counting, levers and arcs stay as built.
 *   - every start, intermediate landing and final landing on the line (and inside the lesson's focus
 *     window when the window can hold a session).
 *   - one direction when the lesson asks for one (jumpOperation add / subtract).
 *   - no second jump that undoes the first: it lands on the start, and the text may name the start.
 */
import type { NumberLineOperation } from '../../primitives/visual-primitives/math/NumberLine';
import type { AddSub20Item } from '../itemSpace/addSub20';
import type { ItemSpaceId } from '../itemSpace';

export const K2_HOPS = [1, 2, 3, 4, 5];

/** Each space a jump can be built from, and how one of its items becomes hops (null: not drawable). */
const TO_HOPS: Partial<Record<ItemSpaceId, (item: any) => NumberLineOperation[] | null>> = {
  // A second jump that undoes the first (20 - 3 + 3) lands back on the start, which the text names.
  'add-sub-20': (it: AddSub20Item) => (it.unknown !== 'result' || (it.steps[1] && it.steps[1].b === it.steps[0].b)
    ? null : it.steps.map((s) => ({
    type: s.op === '+' ? 'add' as const : 'subtract' as const,
    startValue: s.a,
    changeValue: s.b,
    showJumpArc: false,
  }))),
};

export const jumpSpaceSupported = (space: ItemSpaceId): boolean => !!TO_HOPS[space];

const land = (op: NumberLineOperation) => (op.type === 'add' ? op.startValue + op.changeValue : op.startValue - op.changeValue);

/** The item as hops when a number line in `window` can draw it, else null. */
export function itemAsJumps(
  space: ItemSpaceId,
  item: unknown,
  window: { min: number; max: number },
  operation: 'add' | 'subtract' | 'both' = 'both',
  hops: readonly number[] = K2_HOPS,
): NumberLineOperation[] | null {
  const ops = TO_HOPS[space]?.(item);
  if (!ops?.length) return null;
  const onLine = (v: number) => v >= window.min && v <= window.max;
  for (const op of ops) {
    if (!hops.includes(op.changeValue)) return null;
    if (operation !== 'both' && op.type !== operation) return null;
    if (!onLine(op.startValue) || !onLine(land(op))) return null;
  }
  return ops;
}

export interface SpaceJump {
  ops: NumberLineOperation[];
  /** Landings in order: one per hop; the learner places each. */
  landings: number[];
  itemSpace: { space: string; structure: string; beta: number };
}

/**
 * `count` jumps in the beta band, from the focus window when it holds a full session, else the line.
 * Empty when neither holds `count` (the caller keeps its own path).
 */
export function pickSpaceJumps(opts: {
  space: ItemSpaceId;
  pick: (n: number, lo: number, hi: number, rand?: () => number, accept?: (item: any) => boolean) => { beta: number; structure: string }[];
  band: [number, number];
  count: number;
  range: { min: number; max: number };
  focusRange?: { min: number; max: number };
  operation?: 'add' | 'subtract' | 'both';
  rand?: () => number;
}): SpaceJump[] {
  for (const window of [opts.focusRange, opts.range]) {
    if (!window) continue;
    const accept = (it: unknown) => itemAsJumps(opts.space, it, window, opts.operation) !== null;
    const items = opts.pick(opts.count, opts.band[0], opts.band[1], opts.rand, accept);
    if (items.length < opts.count) continue;
    return items.map((it) => {
      const ops = itemAsJumps(opts.space, it, window, opts.operation)!;
      return {
        ops,
        landings: ops.map(land),
        itemSpace: { space: opts.space, structure: it.structure, beta: Number(it.beta.toFixed(2)) },
      };
    });
  }
  return [];
}
