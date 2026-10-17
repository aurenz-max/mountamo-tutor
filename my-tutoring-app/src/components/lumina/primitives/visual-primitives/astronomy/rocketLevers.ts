/**
 * The in-item levers on rocket-builder (`/add-support-tiers`; report qa/eval-reports/rocket-builder-levers-2026-10-16.md).
 * No real-learner evidence: the misses are what `rocketMiss` observes. Every lever starts released; `config.difficulty`
 * changes the items, not the levers.
 *
 * - `count_marks` (help; every mode): writes each part's own number beside its weight blocks, push arrows and coins.
 *   Never a total, never push and weight side by side.
 * - `lift_card` (help; can_it_lift, add_to_lift, on_budget): a card with two boxes outside the item, one whose push is
 *   more than its weight (it rises) and one whose push equals its weight (it stays), and the rule in one line.
 * - `own_weight` (help; add_to_lift): outlines the weight blocks of every part that could be added, with the note that
 *   each part adds its own weight. Marks every option the same way.
 * - `fuel_card` (help; reach_target): a card with the rules about fuel, weight and dropping empty tanks. Names no rocket.
 * - `drop_one` (simplify; on the item, user ruling 09-27: a removed choice is assisted work): greys out one wrong part
 *   or rocket that is easy to rule out, while at least two untried ones remain. Not on can_it_lift (two choices).
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import {
  costOf, flightOf, keyOf, optionCount, optionLabel, optionMiss, ROCKET_MISSES, type RocketItem, type RocketMiss,
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

const lever = (id: string, kind: WorkspaceLever['kind'], s: RocketLeverState, answers: readonly RocketMiss[], when: string, does: string): WorkspaceLever =>
  ({ id, kind, carrier: 'shown', pulled: s.pulled.includes(id), answers, when, does });

/** The levers this item declares, with their state. One that cannot be pulled now and was not pulled is left out. */
export function rocketLevers(item: RocketItem | undefined, s: RocketLeverState): WorkspaceLever[] {
  if (!item) return [];
  const on = (id: string) => s.pulled.includes(id);
  const all = ROCKET_MISSES[item.mode];
  const out: WorkspaceLever[] = [];
  const countAnswers: Record<RocketItem['mode'], readonly RocketMiss[]> = {
    can_it_lift: ['said_lifts', 'said_stays'], add_to_lift: ['too_weak'], on_budget: ['over_budget', 'fails_both'], reach_target: [],
  };
  out.push(lever(COUNT_LEVER, 'help', s, countAnswers[item.mode],
    'The learner loses count of the blocks, arrows or coins.',
    `Writes each part's own number beside its weight blocks and push arrows${item.mode === 'on_budget' ? ' and coins' : ''}. No total is shown.`));
  if (item.mode === 'add_to_lift') {
    out.push(lever(OWN_WEIGHT_LEVER, 'help', s, ['heavy_engine', 'added_no_push'],
      'The learner forgets that a new part adds its own weight, or picks the biggest push or a part with no engine.',
      'Outlines the weight blocks of every part that could be added, the same way on each, with the note "Every part adds its own weight too."'));
  }
  if (item.mode !== 'reach_target') {
    out.push(lever(LIFT_CARD_LEVER, 'help', s, item.mode === 'on_budget' ? ['no_lift', 'fails_both'] : all,
      'The learner does not use the rule for lifting off: push must be more than weight.',
      'Shows a card with two boxes that are not rockets on this screen: one with more push than weight rises, one with push equal to its weight stays down, and the rule in one line.'));
  } else {
    out.push(lever(FUEL_CARD_LEVER, 'help', s, all,
      'The learner thinks more fuel or a bigger rocket always flies higher, or ignores weight and empty tanks.',
      'Shows a card with the rules: more fuel lets the engine push for longer, fuel is heavy, a rocket too heavy for its engine never lifts off, and dropping empty tanks makes a rocket lighter. It names no rocket.'));
  }
  if (item.mode !== 'can_it_lift' && (on(DROP_LEVER) || dropTarget(item, s) !== null)) out.push(lever(DROP_LEVER, 'simplify', s, all,
    'The learner still picks wrong after help, or is stuck with too many to choose from.',
    `Greys out one ${item.mode === 'add_to_lift' ? 'part' : 'rocket'} that is easy to rule out, so fewer remain. The next answer counts as helped.`));
  return out;
}

export const LIFT_CARD_LINE = 'A rocket lifts off only when its push is more than its weight.';
export const FUEL_CARD_LINES = [
  'More fuel lets the engine push for longer.',
  'But fuel is heavy: a rocket too heavy for its engine never lifts off.',
  'A lighter rocket, or a stronger engine, climbs faster.',
  'Dropping empty fuel tanks makes a rocket lighter as it climbs.',
];
export const OWN_WEIGHT_LINE = 'Every part adds its own weight too.';

/** What the pulled levers put on screen, for the tutor and JEV. Never the key. */
export function leverFacts(item: RocketItem, s: RocketLeverState): string | null {
  const parts: string[] = [];
  const on = (id: string) => s.pulled.includes(id);
  if (on(COUNT_LEVER)) parts.push(`each part now shows its own number of weight blocks and push arrows${item.mode === 'on_budget' ? ' and coins' : ''}; no total is shown`);
  if (on(OWN_WEIGHT_LEVER)) parts.push(`the weight blocks of every part that could be added are outlined, with the note "${OWN_WEIGHT_LINE}"`);
  if (on(LIFT_CARD_LEVER)) parts.push(`a card shows a box with 5 push arrows and 3 weight blocks rising and a box with 4 push arrows and 4 weight blocks staying down: "${LIFT_CARD_LINE}"`);
  if (on(FUEL_CARD_LEVER)) parts.push(`a card says: "${FUEL_CARD_LINES.join(' ')}"`);
  for (const i of s.dropped) if (i < optionCount(item)) parts.push(`the ${optionLabel(item, i).toLowerCase()} is greyed out and is not the answer`);
  return parts.length ? parts.join('; ') : null;
}

/** For tests: every miss an item's wrong answers can show. */
export function possibleMisses(item: RocketItem): RocketMiss[] {
  const out = new Set<RocketMiss>();
  for (let i = 0; i < optionCount(item); i++) { const m = optionMiss(item, i); if (m) out.add(m); }
  return Array.from(out);
}
