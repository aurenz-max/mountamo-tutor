/**
 * The in-item levers on rocket-builder, as one lever set (`bossLevers.ts`; `/add-support-tiers`, report
 * qa/eval-reports/rocket-builder-levers-2026-10-16.md). No real-learner evidence: the misses are what `optionMiss`
 * observes. Every lever starts released; `config.difficulty` changes the items, not the levers.
 *
 * - `count_marks` (marks; every mode): writes each part's own number beside its weight blocks, push arrows and coins.
 *   Never a total, never push and weight side by side.
 * - `lift_card` (clue; can_it_lift, add_to_lift, on_budget): a card with two boxes outside the item, one whose push is
 *   more than its weight (it rises) and one whose push equals its weight (it stays), and the rule in one line.
 * - `own_weight` (marks; add_to_lift): outlines the weight blocks of every part that could be added, with the note that
 *   each part adds its own weight. Marks every option the same way.
 * - `fuel_card` (clue; reach_target): a card with the rules about fuel, weight and dropping empty tanks. Names no rocket.
 * - `drop_one` (custom; not can_it_lift, user ruling 09-27: a removed choice is assisted work): greys out one wrong part
 *   or rocket that is easy to rule out, while at least two untried ones remain.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { ROCKET_MISSES } from './rocketBuilder.card';
import {
  costOf, flightOf, keyOf, optionCount, optionLabel, optionMiss, type RocketItem, type RocketMiss,
} from './rocketWorkspace';

export const COUNT_LEVER = 'count_marks';
export const LIFT_CARD_LEVER = 'lift_card';
export const OWN_WEIGHT_LEVER = 'own_weight';
export const FUEL_CARD_LEVER = 'fuel_card';
export const DROP_LEVER = 'drop_one';

/** Per session item: the levers pulled, what is greyed out, and the wrong picks tried (option indexes). */
export interface RocketLeverState {
  pulled: readonly string[];
  dropped: readonly number[];
  picked: readonly number[];
  wrongs: number;
}
export const NO_LEVERS: RocketLeverState = { pulled: [], dropped: [], picked: [], wrongs: 0 };

/**
 * The option `drop_one` greys out now, or null when fewer than two untried options would be left. add_to_lift: a part
 * with no engine first; on_budget: a rocket that breaks both rules, then one that breaks one; reach_target: the rocket
 * whose flight is farthest from the key's. On a tie, the last one.
 */
export function dropTarget(item: RocketItem, s: RocketLeverState): number | null {
  if (item.mode === 'can_it_lift') return null;
  const n = optionCount(item), key = keyOf(item);
  const live = Array.from({ length: n }, (_, i) => i).filter(i => !s.dropped.includes(i));
  const tried = Math.max(s.wrongs, new Set(s.picked).size);
  if (live.length - 1 - tried < 2) return null;
  const foils = live.filter(i => i !== key && !s.picked.includes(i));
  if (!foils.length) return null;
  const distance = (i: number): number => {
    if (item.mode === 'add_to_lift') return optionMiss(item, i) === 'added_no_push' ? 2 : optionMiss(item, i) === 'too_weak' ? 1 : 0;
    if (item.mode === 'on_budget') return optionMiss(item, i) === 'fails_both' ? 2 + costOf(item.rockets[i]) / 100 : 1;
    return Math.abs(flightOf(item.rockets[i]) - flightOf(item.rockets[key]));
  };
  return [...foils].sort((a, b) => distance(b) - distance(a) || b - a)[0];
}

export const LIFT_CARD_LINE = 'A rocket lifts off only when its push is more than its weight.';
export const FUEL_CARD_LINES = [
  'More fuel lets the engine push for longer.',
  'But fuel is heavy: a rocket too heavy for its engine never lifts off.',
  'A lighter rocket, or a stronger engine, climbs faster.',
  'Dropping empty fuel tanks makes a rocket lighter as it climbs.',
];
export const OWN_WEIGHT_LINE = 'Every part adds its own weight too.';

/** The misses counting answers, by mode: a lost count of blocks, arrows or coins. */
const COUNT_ANSWERS: Record<RocketItem['mode'], readonly RocketMiss[]> = {
  can_it_lift: ['said_lifts', 'said_stays'], add_to_lift: ['too_weak'], on_budget: ['over_budget', 'fails_both'], reach_target: [],
};
const withCoins = (item: RocketItem) => (item.mode === 'on_budget' ? ' and coins' : '');

/** The lesson's lever state for the item on screen. */
export interface RocketLeverContext { state: RocketLeverState }

export const ROCKET_LEVERS = leverSet<RocketItem, RocketLeverContext>({
  modeOf: item => item.mode,
  missesOf: mode => ROCKET_MISSES[mode as RocketItem['mode']] ?? [],
  // A card's words never name a choice: the key's label, or the colour that names it.
  answersOf: item => {
    const label = optionLabel(item, keyOf(item));
    return [label, ...(/ (rocket|engine)$/.test(label) ? [label.split(' ')[0]] : [])];
  },
  specs: [
    { id: COUNT_LEVER, type: 'marks', answers: Array.from(new Set(Object.values(COUNT_ANSWERS).flat())),
      answersOn: item => COUNT_ANSWERS[item.mode],
      when: 'The learner loses count of the blocks, arrows or coins.',
      does: item => `Writes each part's own number beside its weight blocks and push arrows${withCoins(item)}. No total is shown.`,
      fact: (_on: unknown, item) => `Each part now shows its own number of weight blocks and push arrows${withCoins(item)}; no total is shown.` },
    { id: OWN_WEIGHT_LEVER, type: 'marks', modes: ['add_to_lift'], answers: ['heavy_engine', 'added_no_push'],
      when: 'The learner forgets that a new part adds its own weight, or picks the biggest push or a part with no engine.',
      does: `Outlines the weight blocks of every part that could be added, the same way on each, with the note "${OWN_WEIGHT_LINE}"`,
      fact: `The weight blocks of every part that could be added are outlined, with the note "${OWN_WEIGHT_LINE}"` },
    { id: LIFT_CARD_LEVER, type: 'clue', modes: ['can_it_lift', 'add_to_lift', 'on_budget'], answers: 'all',
      answersOn: item => (item.mode === 'on_budget' ? ['no_lift', 'fails_both'] : ROCKET_MISSES[item.mode]),
      when: 'The learner does not use the rule for lifting off: push must be more than weight.',
      does: 'Shows a card with two boxes that are not rockets on this screen: one with more push than weight rises, one with '
        + 'push equal to its weight stays down, and the rule in one line.',
      fact: 'A card shows a box with 5 push arrows and 3 weight blocks rising and a box with 4 push arrows and 4 weight blocks '
        + `staying down: "${LIFT_CARD_LINE}"` },
    { id: FUEL_CARD_LEVER, type: 'clue', modes: ['reach_target'], answers: 'all',
      when: 'The learner thinks more fuel or a bigger rocket always flies higher, or ignores weight and empty tanks.',
      does: 'Shows a card with the rules: more fuel lets the engine push for longer, fuel is heavy, a rocket too heavy for its '
        + 'engine never lifts off, and dropping empty tanks makes a rocket lighter. It names no rocket.',
      fact: `A card says: "${FUEL_CARD_LINES.join(' ')}"` },
    { id: DROP_LEVER, type: 'custom', modes: ['add_to_lift', 'on_budget', 'reach_target'], answers: 'all', carrier: 'shown',
      why: 'It narrows this item in place (one wrong choice greyed out) rather than opening a practice item.',
      when: 'The learner still picks wrong after help, or is stuck with too many to choose from.',
      does: item => `Greys out one ${item.mode === 'add_to_lift' ? 'part' : 'rocket'} that is easy to rule out, so fewer remain. `
        + 'The next answer counts as helped.',
      // Offered while one more can be greyed out; once pulled, its fact names every greyed-out choice.
      content: (item, { state }) => (state.pulled.includes(DROP_LEVER) || dropTarget(item, state) !== null ? state.dropped : null),
      fact: (dropped: readonly number[], item) => dropped.filter(i => i < optionCount(item))
        .map(i => `The ${optionLabel(item, i).toLowerCase()} is greyed out and is not the answer.`).join(' ') },
  ],
});

/** For tests: every miss an item's wrong answers can show. */
export function possibleMisses(item: RocketItem): RocketMiss[] {
  const out = new Set<RocketMiss>();
  for (let i = 0; i < optionCount(item); i++) { const m = optionMiss(item, i); if (m) out.add(m); }
  return Array.from(out);
}
