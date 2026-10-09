/**
 * build_hops: the number line's open build (`/add-eval-modes` references/build-mode.md).
 *
 * "Start at 0 and land on 12 in two hops. Now land on 12 a different way." The line opens with only the start
 * marked. The learner picks each hop's size from the hop buttons and the line draws the hop from where the last one
 * landed; they tap a landing to take that hop off. At "I'm done!" this module's code judges: the landing equals the
 * target (`jumpMiss`, the jump mode's own landing check), the hop count is the one asked, and on the second way the
 * hop sizes are not the first way's again. Many builds pass: every set of hop sizes that adds to the distance
 * (5+7, 6+6, 10+2, ...). Choosing the second hop is the arithmetic (what goes with 5 to make 12); the line only moves.
 *
 * Pure: the component, the workspace, the generator, the journey driver and the oracle read the same rules.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { NumberLineChallenge } from './NumberLine';
import { HOPS_LEVER, SIMPLER_LEVER, jumpMiss } from './numberLineLevers';

export const BUILD_HOPS = 'build_hops' as const;
/** The largest hop button. Two hops reach 20, the K-2 line. */
export const MAX_HOP = 10;
/** Help lever for a repeated way: a worked pair of ways on a small example that is never the item's. */
export const WAYS_LEVER = 'ways_model';

/**
 * What a wrong build shows (`TeachingAttempt.miss`):
 * - `one_short` / `one_past` / `off_by_more`: the hops land one before, one beyond, or further from the target
 *   (the jump mode's `jumpMiss` on the final landing);
 * - `other_hop_count`: the hops land on the target, but not in the number of hops asked;
 * - `same_way_again`: the second way uses the same hop sizes as the first (in any order).
 */
export type BuildHopsMiss = 'one_short' | 'one_past' | 'off_by_more' | 'other_hop_count' | 'same_way_again';
export const BUILD_HOPS_MISSES: readonly BuildHopsMiss[] = ['one_short', 'one_past', 'off_by_more', 'other_hop_count', 'same_way_again'];

export interface HopsTask { start: number; target: number; hopCount: number }

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five'];
export const countWord = (n: number) => NUMBER_WORDS[n] ?? String(n);

/** The task a build_hops challenge asks, or null for any other item. */
export function hopsTaskOf(ch: NumberLineChallenge | null | undefined): HopsTask | null {
  if (!ch || ch.type !== BUILD_HOPS) return null;
  const start = ch.startValue, target = ch.targetValues?.[0], hopCount = ch.hopCount ?? 2;
  if (typeof start !== 'number' || typeof target !== 'number' || !Number.isInteger(start) || !Number.isInteger(target)) return null;
  return { start, target, hopCount };
}

export const landingOf = (start: number, hops: readonly number[]) => hops.reduce((at, h) => at + h, start);
/** A way's identity: its hop sizes in any order (7 then 5 is the same way as 5 then 7). */
export const wayKey = (hops: readonly number[]) => [...hops].sort((a, b) => b - a).join('+');

/** Every way to cover `distance` in `count` hops of 1..MAX_HOP, each as hop sizes largest first. */
export function waysFor(distance: number, count: number, maxHop = MAX_HOP): number[][] {
  const out: number[][] = [];
  const walk = (left: number, slots: number, cap: number, acc: number[]) => {
    if (slots === 0) { if (left === 0) out.push(acc); return; }
    for (let h = Math.min(cap, left - (slots - 1)); h >= 1; h--) {
      if (h * slots < left) break;
      walk(left - h, slots - 1, h, [...acc, h]);
    }
  };
  if (distance >= count && count >= 1) walk(distance, count, maxHop, []);
  return out;
}

/** The smallest distance with at least two ways (so "a different way" exists): 4 in two hops, 6 in three. */
export const minDistance = (count: number) => (count <= 2 ? 4 : count === 3 ? 6 : 2 * count);
/** The largest distance the hop buttons can cover. */
export const maxDistance = (count: number) => Math.min(20, count * MAX_HOP);

/** The build's verdict at "I'm done!": undefined when right. `first` is the way already checked right on this item. */
export function buildHopsMiss(ch: NumberLineChallenge | null | undefined, hops: readonly number[],
  first?: readonly number[] | null): BuildHopsMiss | undefined {
  const task = hopsTaskOf(ch);
  if (!task) return undefined;
  const landing = landingOf(task.start, hops);
  if (landing !== task.target) {
    // The jump mode's landing check, on the one jump the hops add up to.
    const miss = jumpMiss({ id: '', type: 'show_jump', instruction: '', hint: '', targetValues: [task.target],
      operations: [{ type: 'add', startValue: task.start, changeValue: task.target - task.start, showJumpArc: false }] }, [landing]);
    return miss === 'one_short' || miss === 'one_past' ? miss : 'off_by_more';
  }
  if (hops.length !== task.hopCount) return 'other_hop_count';
  if (first && first.length && wayKey(first) === wayKey(hops)) return 'same_way_again';
  return undefined;
}

export function buildHopsInstruction(task: HopsTask): string {
  return `Start at ${task.start} and land on ${task.target} in ${countWord(task.hopCount)} hops.`;
}

/** What "I'm done!" says back. Never where a wrong build landed or a hop size to use. */
export function buildHopsFeedback(task: HopsTask, hops: readonly number[], miss: BuildHopsMiss | undefined,
  first: readonly number[] | null): string {
  const sum = `${hops.join(' + ')} = ${task.target - task.start}`;
  if (!miss) return first ? `Two ways to land on ${task.target}: ${first.join(' + ')} and ${hops.join(' + ')}!`
    : `Yes! ${sum}. Now land on ${task.target} a different way.`;
  if (miss === 'other_hop_count') return `Your hops land on ${task.target}. Make it in ${countWord(task.hopCount)} hops.`;
  if (miss === 'same_way_again') return `Your hops land on ${task.target}, but they are the same hops as your first way. Try different hops.`;
  return `Your hops do not land on ${task.target} yet. Look at where they land.`;
}

/** The learner's build in words: hop sizes as made, never the key (there is no single key). */
export function describeHops(task: HopsTask, hops: readonly number[], first: readonly number[] | null): string {
  const made = hops.length ? `Made hops of ${hops.join(', ')} from ${task.start}` : `No hops yet from ${task.start}`;
  return first ? `${made} (second way; first way was ${first.join(', ')})` : made;
}

/** The easier practice build: the same start and hop count, about half the distance. Null when none has two ways. */
export function simplerHops(ch: NumberLineChallenge, range: { min: number; max: number }): NumberLineChallenge | null {
  const task = hopsTaskOf(ch);
  if (!task) return null;
  const distance = Math.ceil((task.target - task.start) / 2);
  if (distance < minDistance(task.hopCount) || distance >= task.target - task.start) return null;
  const target = task.start + distance;
  if (target < range.min || target > range.max) return null;
  const easier = { ...task, target };
  return { id: `${ch.id}~simpler`, type: BUILD_HOPS, instruction: buildHopsInstruction(easier),
    hint: 'Pick a hop, look where it lands, then pick the next hop.', startValue: task.start, targetValues: [target],
    hopCount: task.hopCount };
}

/** The worked example the ways lever draws: two ways to a small number that is never the item's own. */
export function waysModel(task: HopsTask): { target: number; ways: [number[], number[]] } {
  const target = [5, 4, 6].find(t => t !== task.target - task.start && t !== task.target) ?? 5;
  const ways = waysFor(target, 2);
  return { target, ways: [ways[0], ways[ways.length - 1]] };
}

/**
 * The levers on a build_hops item, all bare at the start (keeping track of the hops is the task):
 * - `numbered_hops` (help): numbers the unit spaces inside each of the learner's own hops. Declared once a hop is on.
 * - `ways_model` (help): beside the line, two ways to a small other number. It answers a repeated way, and before
 *   the first way it shows what "in two hops" means without touching the learner's number.
 * - `simpler_jump` (simplify): an ungraded practice build to about half the distance first.
 */
export function buildHopsLevers(ch: NumberLineChallenge | null, pulled: readonly string[], range: { min: number; max: number },
  hops: readonly number[], first: readonly number[] | null): WorkspaceLever[] {
  const task = hopsTaskOf(ch);
  if (!ch || !task) return [];
  const levers: WorkspaceLever[] = [];
  if (hops.length || pulled.includes(HOPS_LEVER)) levers.push({
    id: HOPS_LEVER, kind: 'help', carrier: 'both', pulled: pulled.includes(HOPS_LEVER),
    answers: ['one_short', 'one_past', 'off_by_more'],
    when: 'The learner\'s hops land one off or further from the number, or they lose count of how far a hop goes.',
    does: "Numbers the spaces inside each hop the learner puts on the line (1, 2, 3...), so they can count how far each of their hops goes.",
  });
  levers.push({
    id: WAYS_LEVER, kind: 'help', carrier: 'both', pulled: pulled.includes(WAYS_LEVER),
    answers: ['same_way_again'],
    when: 'The learner makes the same hops again and cannot find a different way, or does not know how to start.',
    does: 'Beside the line, shows two different ways to land on a small other number (a longer first hop and a shorter second hop). Never the learner\'s number.',
  });
  if (simplerHops(ch, range)) levers.push({
    id: SIMPLER_LEVER, kind: 'simplify', carrier: 'shown', pulled: pulled.includes(SIMPLER_LEVER),
    answers: ['off_by_more'],
    when: 'The learner\'s hops land far from the number, again and again.',
    does: 'Opens an easier practice build first: the same number of hops to a smaller number. It is not graded; the full item comes back after it.',
  });
  return levers;
}

/** Driver and test help: a right first way, a right different second way, and a wrong build one short (`one_short`). */
export function hopsHarnessBuilds(task: HopsTask): { first: number[]; second: number[]; wrong: number[] } {
  const ways = waysFor(task.target - task.start, task.hopCount);
  if (ways.length < 2) throw new Error(`build_hops ${task.start}->${task.target} in ${task.hopCount}: fewer than two ways`);
  // ways[0] has the longest first hop, at least half the distance, so one off it is still a hop.
  const first = ways[0], second = ways[ways.length - 1];
  return { first, second, wrong: [first[0] - 1, ...first.slice(1)] };
}
