/**
 * The in-item levers on orbit-mechanics-lab (`/add-support-tiers`; report
 * qa/eval-reports/orbit-mechanics-lab-levers-2026-10-16.md). No real-learner evidence: the misses are what `orbitMiss`
 * observes. Every lever starts released; `config.difficulty` changes the items, not the levers.
 *
 * - `throw_model` (help; pick_speed): a card with a ball thrown sideways from a tall hill three times, softly, harder and
 *   harder still, each landing farther away. A model outside the item: no throw goes around or flies away, and no arrow
 *   is one of the item's pushes.
 * - `pull_card` (help; orbit_speed): a card with Earth's pull drawn as arrows, longer close to Earth and shorter far
 *   out. Names no rocket and says nothing about speed or time.
 * - `same_size` (help; orbit_speed, sizes differ): every rocket drawn the same size.
 * - `speed_arrows` (help; predict_burn): the rocket's speed before the push and after it, as two arrows side by side.
 *   Never draws a path.
 * - `mark_points` (help; circularize): marks the loop's near point and far point.
 * - `burn_card` (help; circularize): a card with a different loop: a push forward at one point lifts the other side of
 *   the loop, a push backward lowers it. Names neither point of this loop.
 * - `drop_one` (simplify; on the item, user ruling 09-27: a removed choice is assisted work): greys out one wrong push,
 *   rocket or choice that is easy to rule out, while at least two untried ones remain.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import {
  BURN_OUTCOMES, biggestCraft, burnFactor, choiceKey, choiceLabel, choiceMiss, isTapItem, ORBIT_MISSES, PATHS,
  pushPath, tapCount, tapKey, tapLabel, tapMiss, type BurnOutcome, type OrbitItem, type OrbitMiss,
} from './orbitWorkspace';

export const THROW_LEVER = 'throw_model';
export const PULL_LEVER = 'pull_card';
export const SAME_SIZE_LEVER = 'same_size';
export const SPEED_ARROWS_LEVER = 'speed_arrows';
export const MARK_POINTS_LEVER = 'mark_points';
export const BURN_CARD_LEVER = 'burn_card';
export const DROP_LEVER = 'drop_one';

/** Per session item: the levers pulled, what is greyed out, and the wrong picks tried (push, rocket or choice indexes). */
export interface OrbitLeverState {
  pulled: readonly string[];
  dropped: readonly number[];
  picked: readonly number[];
  wrongs: number;
}
export const NO_LEVERS: OrbitLeverState = { pulled: [], dropped: [], picked: [], wrongs: 0 };

const keyIndexOf = (item: OrbitItem) => (isTapItem(item) ? tapKey(item) : (item.choices as string[]).indexOf(choiceKey(item)));
const optionCount = (item: OrbitItem) => (isTapItem(item) ? tapCount(item) : item.choices.length);

/**
 * The option `drop_one` greys out now, or null when fewer than two untried options would be left. pick_speed: the push
 * whose path is farthest from the asked one; orbit_speed: the rocket whose track is farthest from the key's;
 * predict_burn: the outcome farthest along the scale; circularize: a burn at the wrong point, the wrong way. On a tie,
 * the last one.
 */
export function dropTarget(item: OrbitItem, s: OrbitLeverState): number | null {
  const n = optionCount(item), key = keyIndexOf(item);
  const live = Array.from({ length: n }, (_, i) => i).filter(i => !s.dropped.includes(i));
  const tried = Math.max(s.wrongs, new Set(s.picked).size);
  if (live.length - 1 - tried < 2) return null;
  const foils = live.filter(i => i !== key && !s.picked.includes(i));
  if (!foils.length) return null;
  const distance = (i: number): number => {
    if (item.mode === 'pick_speed') return Math.abs(PATHS.indexOf(pushPath(item, item.pushes[i])) - PATHS.indexOf(item.ask));
    if (item.mode === 'orbit_speed') return Math.abs(Math.log(item.crafts[i].radius / item.crafts[key].radius));
    if (item.mode === 'predict_burn') return Math.abs(BURN_OUTCOMES.indexOf(item.choices[i]) - BURN_OUTCOMES.indexOf(choiceKey(item) as BurnOutcome));
    const m = choiceMiss(item, item.choices[i]);
    return m === 'wrong_place' ? 1 : m === 'wrong_way' ? 2 : 0;
  };
  return [...foils].sort((a, b) => distance(b) - distance(a) || b - a)[0];
}

const lever = (id: string, kind: WorkspaceLever['kind'], s: OrbitLeverState, answers: readonly OrbitMiss[], when: string, does: string): WorkspaceLever =>
  ({ id, kind, carrier: 'shown', pulled: s.pulled.includes(id), answers, when, does });

/** orbit_speed: the rockets are drawn at different sizes. */
const sizesDiffer = (item: OrbitItem) => item.mode === 'orbit_speed' && biggestCraft(item) >= 0;

/** The levers this item declares, with their state. One that cannot be pulled now and was not pulled is left out. */
export function orbitLevers(item: OrbitItem | undefined, s: OrbitLeverState): WorkspaceLever[] {
  if (!item) return [];
  const on = (id: string) => s.pulled.includes(id);
  const all = ORBIT_MISSES[item.mode];
  const out: WorkspaceLever[] = [];
  if (item.mode === 'pick_speed') {
    out.push(lever(THROW_LEVER, 'help', s, all,
      'The learner does not connect how fast the rocket goes sideways with where gravity pulls it.',
      'Shows a card: a ball thrown sideways from a tall hill three times, each throw harder, each landing farther away. No throw goes around or flies away, and none is one of the pushes.'));
  } else if (item.mode === 'orbit_speed') {
    if (on(SAME_SIZE_LEVER) || sizesDiffer(item)) out.push(lever(SAME_SIZE_LEVER, 'help', s, ['picked_biggest'],
      'The learner picks the biggest rocket, or judges by size.',
      'Draws every rocket at the same size.'));
    out.push(lever(PULL_LEVER, 'help', s, all,
      'The learner does not connect how far out a rocket is with how it moves.',
      "Shows a card with Earth's pull drawn as arrows: long close to Earth, shorter farther out. It names no rocket and says nothing about speed or time."));
  } else if (item.mode === 'predict_burn') {
    out.push(lever(SPEED_ARROWS_LEVER, 'help', s, all,
      'The learner mixes up a push forward and a push backward, or how big the push is.',
      "Shows the rocket's speed before the push and right after it as two arrows side by side. It draws no path."));
  } else {
    out.push(lever(MARK_POINTS_LEVER, 'help', s, ['other_circle', 'wrong_place'],
      'The learner cannot tell where the near point and the far point of the loop are.',
      "Marks the loop's near point and far point with a dot and a word each."));
    out.push(lever(BURN_CARD_LEVER, 'help', s, all,
      'The learner does not know what a push forward or backward does to the other side of a loop.',
      'Shows a card with a different loop: a push forward at one point lifts the other side of the loop; a push backward lowers it.'));
  }
  if (on(DROP_LEVER) || dropTarget(item, s) !== null) out.push(lever(DROP_LEVER, 'simplify', s, all,
    'The learner still picks wrong after help, or is stuck with too many to choose from.',
    `Greys out one ${item.mode === 'pick_speed' ? 'push' : item.mode === 'orbit_speed' ? 'rocket' : 'choice'} that is easy to rule out, so fewer remain. The next answer counts as helped.`));
  return out;
}

/** speed_arrows: the arrow lengths before and after the push, as fractions of the circle speed. */
export const speedArrows = (item: OrbitItem): { before: number; after: number } | null =>
  item.mode === 'predict_burn' ? { before: 1, after: burnFactor(item) } : null;

export const BURN_CARD_LINES = [
  'A push forward at one point of a loop lifts the other side of the loop higher.',
  'A push backward at one point of a loop lowers the other side of the loop.',
];
export const THROW_CARD_LINE = 'The harder the ball is thrown sideways, the farther it goes before it lands.';
export const PULL_CARD_LINE = "Earth's pull is strongest close to Earth and gets weaker farther out.";

/** What the pulled levers put on screen, for the tutor and JEV. Never the key. */
export function leverFacts(item: OrbitItem, s: OrbitLeverState): string | null {
  const parts: string[] = [];
  const on = (id: string) => s.pulled.includes(id);
  if (on(THROW_LEVER)) parts.push(`a card shows a ball thrown sideways from a tall hill three times, each throw harder and landing farther away: "${THROW_CARD_LINE}"`);
  if (on(SAME_SIZE_LEVER)) parts.push('every rocket is now drawn the same size');
  if (on(PULL_LEVER)) parts.push(`a card shows Earth's pull as arrows, long close to Earth and shorter farther out: "${PULL_CARD_LINE}"`);
  if (on(SPEED_ARROWS_LEVER)) {
    const a = speedArrows(item);
    if (a) parts.push(`two arrows show the rocket's speed before the push and right after it; the after arrow is ${a.after > a.before ? 'longer' : 'shorter'}`);
  }
  if (on(MARK_POINTS_LEVER)) parts.push('the loop\'s near point and far point are marked with a dot and a word');
  if (on(BURN_CARD_LEVER)) parts.push(`a card with a different loop says: "${BURN_CARD_LINES.join(' ')}"`);
  for (const i of s.dropped) {
    if (isTapItem(item)) parts.push(`the ${tapLabel(item, i).toLowerCase()} is greyed out and is not the answer`);
    else if (item.choices[i] !== undefined) parts.push(`the choice "${choiceLabel(item, item.choices[i])}" is greyed out and is not the answer`);
  }
  return parts.length ? parts.join('; ') : null;
}

/** For tests: every miss an item's wrong answers can show. */
export function possibleMisses(item: OrbitItem): OrbitMiss[] {
  const out = new Set<OrbitMiss>();
  if (isTapItem(item)) {
    for (let i = 0; i < tapCount(item); i++) { const m = tapMiss(item, i); if (m) out.add(m); }
  } else {
    for (const c of item.choices as string[]) { const m = choiceMiss(item, c); if (m) out.add(m); }
  }
  return Array.from(out);
}
