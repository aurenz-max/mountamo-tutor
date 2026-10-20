/**
 * The in-item levers on orbit-mechanics-lab, as one lever set (`bossLevers.ts`; `/add-support-tiers`, report
 * qa/eval-reports/orbit-mechanics-lab-levers-2026-10-16.md). No real-learner evidence: the misses are what `orbitMiss`
 * observes. Every lever starts released; `config.difficulty` changes the items, not the levers.
 *
 * - `throw_model` (clue; pick_speed): a card with a ball thrown sideways from a tall hill three times, softly, harder and
 *   harder still, each landing farther away. Outside the item: no throw goes around or flies away, and no arrow is one
 *   of the item's pushes.
 * - `same_size` (layout; orbit_speed, sizes differ): every rocket drawn the same size.
 * - `pull_card` (clue; orbit_speed): a card with Earth's pull drawn as arrows, longer close to Earth and shorter far
 *   out. Names no rocket and says nothing about speed or time.
 * - `speed_arrows` (clue; predict_burn): the rocket's speed before the push and after it, as two arrows side by side.
 *   Never draws a path.
 * - `mark_points` (marks; circularize): marks the loop's near point and far point.
 * - `burn_card` (clue; circularize): a card with a different loop: a push forward at one point lifts the other side of
 *   the loop, a push backward lowers it. Names neither point of this loop.
 * - `drop_one` (custom; user ruling 09-27: a removed choice is assisted work): greys out one wrong push, rocket or
 *   choice that is easy to rule out, while at least two untried ones remain.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { ORBIT_MISSES } from './orbitMechanicsLab.card';
import {
  BURN_OUTCOMES, biggestCraft, burnFactor, choiceKey, choiceMiss, isTapItem, optionLabel, PATHS,
  pushPath, tapCount, tapKey, tapMiss, type BurnOutcome, type OrbitItem, type OrbitMiss, type OrbitMode,
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

/** orbit_speed: the rockets are drawn at different sizes. */
const sizesDiffer = (item: OrbitItem) => item.mode === 'orbit_speed' && biggestCraft(item) >= 0;

/** speed_arrows: the arrow lengths before and after the push, as fractions of the circle speed. */
export const speedArrows = (item: OrbitItem): { before: number; after: number } | null =>
  item.mode === 'predict_burn' ? { before: 1, after: burnFactor(item) } : null;

export const BURN_CARD_LINES = [
  'A push forward at one point of a loop lifts the other side of the loop higher.',
  'A push backward at one point of a loop lowers the other side of the loop.',
];
export const THROW_CARD_LINE = 'The harder the ball is thrown sideways, the farther it goes before it lands.';
export const PULL_CARD_LINE = "Earth's pull is strongest close to Earth and gets weaker farther out.";

/** The lesson's lever state for the item on screen. */
export interface OrbitLeverContext { state: OrbitLeverState }

const what = (item: OrbitItem) => (item.mode === 'pick_speed' ? 'push' : item.mode === 'orbit_speed' ? 'rocket' : 'choice');

export const ORBIT_LEVERS = leverSet<OrbitItem, OrbitLeverContext>({
  modeOf: item => item.mode,
  missesOf: mode => ORBIT_MISSES[mode as OrbitMode] ?? [],
  // A card's words never name a choice: the key's label, or the colour that names its rocket.
  answersOf: item => {
    const at = keyIndexOf(item);
    return [optionLabel(item, at), ...(item.mode === 'orbit_speed' ? [item.crafts[at].color] : [])];
  },
  specs: [
    { id: THROW_LEVER, type: 'clue', modes: ['pick_speed'], answers: 'all',
      when: 'The learner does not connect how fast the rocket goes sideways with where gravity pulls it.',
      does: 'Shows a card: a ball thrown sideways from a tall hill three times, each throw harder, each landing farther away. '
        + 'No throw goes around or flies away, and none is one of the pushes.',
      fact: `A card shows a ball thrown sideways from a tall hill three times, each throw harder and landing farther away: "${THROW_CARD_LINE}"` },
    { id: SAME_SIZE_LEVER, type: 'layout', modes: ['orbit_speed'], answers: ['picked_biggest'],
      offer: item => sizesDiffer(item),
      when: 'The learner picks the biggest rocket, or judges by size.',
      does: 'Draws every rocket at the same size.',
      fact: 'Every rocket is now drawn the same size.' },
    { id: PULL_LEVER, type: 'clue', modes: ['orbit_speed'], answers: 'all',
      when: 'The learner does not connect how far out a rocket is with how it moves.',
      does: "Shows a card with Earth's pull drawn as arrows: long close to Earth, shorter farther out. It names no rocket and "
        + 'says nothing about speed or time.',
      fact: `A card shows Earth's pull as arrows, long close to Earth and shorter farther out: "${PULL_CARD_LINE}"` },
    { id: SPEED_ARROWS_LEVER, type: 'clue', modes: ['predict_burn'], answers: 'all',
      when: 'The learner mixes up a push forward and a push backward, or how big the push is.',
      does: "Shows the rocket's speed before the push and right after it as two arrows side by side. It draws no path.",
      content: item => speedArrows(item),
      fact: (a: { before: number; after: number }) => "Two arrows show the rocket's speed before the push and right after it; "
        + `the after arrow is ${a.after > a.before ? 'longer' : 'shorter'}.` },
    { id: MARK_POINTS_LEVER, type: 'marks', modes: ['circularize'], answers: ['other_circle', 'wrong_place'],
      when: 'The learner cannot tell where the near point and the far point of the loop are.',
      does: "Marks the loop's near point and far point with a dot and a word each.",
      fact: "The loop's near point and far point are marked with a dot and a word." },
    { id: BURN_CARD_LEVER, type: 'clue', modes: ['circularize'], answers: 'all',
      when: 'The learner does not know what a push forward or backward does to the other side of a loop.',
      does: 'Shows a card with a different loop: a push forward at one point lifts the other side of the loop; a push '
        + 'backward lowers it.',
      fact: `A card with a different loop says: "${BURN_CARD_LINES.join(' ')}"` },
    { id: DROP_LEVER, type: 'custom', answers: 'all', carrier: 'shown',
      why: 'It narrows this item in place (one wrong choice greyed out) rather than opening a practice item.',
      when: 'The learner still picks wrong after help, or is stuck with too many to choose from.',
      does: item => `Greys out one ${what(item)} that is easy to rule out, so fewer remain. The next answer counts as helped.`,
      // Offered while one more can be greyed out; once pulled, its fact names every greyed-out choice.
      content: (item, { state }) => (state.pulled.includes(DROP_LEVER) || dropTarget(item, state) !== null ? state.dropped : null),
      fact: (dropped: readonly number[], item) => dropped.filter(i => i < optionCount(item)).map(i => (isTapItem(item)
        ? `The ${optionLabel(item, i).toLowerCase()} is greyed out and is not the answer.`
        : `The choice "${optionLabel(item, i)}" is greyed out and is not the answer.`)).join(' ') },
  ],
});

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
