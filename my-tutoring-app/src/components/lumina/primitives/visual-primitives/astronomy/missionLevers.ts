/**
 * The in-item levers on mission-planner (`/add-support-tiers`; report qa/eval-reports/mission-planner-levers-2026-10-16.md).
 * No real-learner evidence: the misses are what `missionMiss` observes. Every lever starts released; `config.difficulty`
 * changes the items, not the levers.
 *
 * - `ask_arrow` (help; farther_closer): an arrow from Earth with the asked end marked ("farthest from Earth" or
 *   "closest to Earth"), under the choices. It places no choice on it. farther_closer is a recall item: any card naming
 *   places in order states the key (replay 10-16: an order card read aloud named the Moon and Mars as the key on 19/80
 *   replies), so no help lever orders the places; next_in_line and in_between go to `drop_one`.
 * - `distance_lines` (help; pick_window): a dashed line from Earth to the target in EVERY month's picture, no length.
 * - `fuel_card` (help; pick_window): the rule: least fuel when the planet is close to Earth, most on the far side.
 * - `home_leg` (help; pack_days): draws the trip home as day squares too, so the whole trip is drawn, the stay once.
 * - `crew_rows` (help; pack_days with a crew): each astronaut drawn with their own pack, "1 pack each day".
 * - `assist_card` (help; assist_tradeoff): a flyby gives the ship a free push, so more flybys need less fuel.
 * - `limit_line` (help; assist_tradeoff): the limit marked the same way on every route's row of years.
 * - `drop_one` (simplify, on the item, user ruling 09-27: a removed choice is assisted work): greys out one wrong choice
 *   that is easy to rule out, while at least two untried ones remain. Not on two-choice items.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import {
  keyOf, MISSION_MISSES, optionCount, optionLabel, optionMiss, packsNeeded, PLACE_AU, separation,
  type MissionItem, type MissionMiss,
} from './missionWorkspace';

export const ASK_ARROW_LEVER = 'ask_arrow';
export const DISTANCE_LINES_LEVER = 'distance_lines';
export const FUEL_CARD_LEVER = 'fuel_card';
export const HOME_LEG_LEVER = 'home_leg';
export const CREW_ROWS_LEVER = 'crew_rows';
export const ASSIST_CARD_LEVER = 'assist_card';
export const LIMIT_LINE_LEVER = 'limit_line';
export const DROP_LEVER = 'drop_one';

/** Per session item: the levers pulled, what is greyed out, and the wrong picks tried (option indexes). */
export interface MissionLeverState {
  pulled: readonly string[];
  dropped: readonly number[];
  picked: readonly number[];
  wrongs: number;
}
export const NO_LEVERS: MissionLeverState = { pulled: [], dropped: [], picked: [], wrongs: 0 };

/** How easy a wrong option is to rule out (bigger = easier); `drop_one` greys out the easiest. */
function ruleOutEase(item: MissionItem, i: number): number {
  const key = keyOf(item);
  if (item.mode === 'farther_closer') return Math.abs(Math.log(PLACE_AU[item.places[i]]) - Math.log(PLACE_AU[item.places[key]]));
  if (item.mode === 'pick_window') return Math.abs(separation(item.windows[i]) - separation(item.windows[key]));
  if (item.mode === 'pack_days') return Math.abs(item.options[i] - packsNeeded(item));
  const r = item.routes[i];
  return r.years > item.limit ? 10 + r.years - item.limit : optionMiss(item, i) === 'picked_direct' ? 5 : 1;
}

/** The option `drop_one` greys out now, or null when fewer than two untried options would be left. On a tie, the last. */
export function dropTarget(item: MissionItem, s: MissionLeverState): number | null {
  const n = optionCount(item), key = keyOf(item);
  if (n <= 2) return null;
  const live = Array.from({ length: n }, (_, i) => i).filter(i => !s.dropped.includes(i));
  const tried = Math.max(s.wrongs, new Set(s.picked).size);
  if (live.length - 1 - tried < 2) return null;
  const foils = live.filter(i => i !== key && !s.picked.includes(i));
  if (!foils.length) return null;
  return [...foils].sort((a, b) => ruleOutEase(item, b) - ruleOutEase(item, a) || b - a)[0];
}

const lever = (id: string, kind: WorkspaceLever['kind'], s: MissionLeverState, answers: readonly MissionMiss[], when: string, does: string): WorkspaceLever =>
  ({ id, kind, carrier: 'shown', pulled: s.pulled.includes(id), answers, when, does });

/** The levers this item declares, with their state. One that cannot be pulled now and was not pulled is left out. */
export function missionLevers(item: MissionItem | undefined, s: MissionLeverState): WorkspaceLever[] {
  if (!item) return [];
  const out: WorkspaceLever[] = [];
  if (item.mode === 'farther_closer') {
    out.push(lever(ASK_ARROW_LEVER, 'help', s, ['other_end'],
      'The learner answers the opposite of the question (the closest when asked for the farthest, or the other way round).',
      `Draws an arrow going out from Earth under the choices, with its ${item.ask === 'far' ? 'far' : 'near'} end marked "${item.ask === 'far' ? 'farthest from Earth' : 'closest to Earth'}". No place is put on the arrow.`));
  } else if (item.mode === 'pick_window') {
    out.push(lever(DISTANCE_LINES_LEVER, 'help', s, ['in_between_window'],
      'The learner cannot tell in which month the two planets are nearer each other.',
      'Draws a dashed line from Earth to the planet in every month\'s picture, the same way in each. No length is written.'));
    out.push(lever(FUEL_CARD_LEVER, 'help', s, ['far_apart', 'close_together'],
      'The learner does not connect where the planets are with how much fuel the trip needs.',
      'Shows a card with the rule: planets keep moving; a ship needs the least fuel when its planet is close to Earth, and the most when the planet is on the far side of the Sun. It names no month.'));
  } else if (item.mode === 'pack_days') {
    out.push(lever(HOME_LEG_LEVER, 'help', s, ['forgot_home', 'stay_twice', 'forgot_stay'],
      'The learner leaves out the trip home, or counts the stay wrong.',
      'Draws the trip home with its own day squares, the same as the trip there, so the whole trip is drawn and the stay appears once. No total is written.'));
    if (item.crew > 1) out.push(lever(CREW_ROWS_LEVER, 'help', s, ['forgot_crew', 'added_crew'],
      'The learner packs for one astronaut, or adds the crew instead of feeding each one.',
      'Draws each astronaut with their own food pack and the line "Each astronaut eats 1 pack every day." No total is written.'));
  } else {
    out.push(lever(ASSIST_CARD_LEVER, 'help', s, ['picked_direct', 'fewer_flybys'],
      'The learner does not use flybys to judge fuel.',
      'Shows a card: when the ship swings past a planet, the planet\'s pull gives it a free push, so it needs less fuel; more flybys, less fuel, but usually a longer trip. It names no route.'));
    out.push(lever(LIMIT_LINE_LEVER, 'help', s, ['too_slow'],
      'The learner picks a route that takes longer than the limit.',
      'Marks the year limit with the same red line on every route\'s row of years. It names no route.'));
  }
  const on = s.pulled.includes(DROP_LEVER);
  if (optionCount(item) > 2 && (on || dropTarget(item, s) !== null)) out.push(lever(DROP_LEVER, 'simplify', s, MISSION_MISSES[item.mode],
    'The learner still picks wrong after help, or is stuck with too many to choose from.',
    'Greys out one choice that is easy to rule out, so fewer remain. The next answer counts as helped.'));
  return out;
}

export const FUEL_CARD_LINES = [
  'Planets keep moving round the Sun, each at its own speed.',
  'A ship needs the least fuel when it launches while its planet is close to Earth, and the most when the planet is on the far side of the Sun.',
];
export const CREW_LINE = 'Each astronaut eats 1 pack every day.';
export const ASSIST_CARD_LINES = [
  'A flyby: the ship swings past a planet, and the planet\'s pull gives it a free push.',
  'More flybys: less fuel. But the path is longer, so the trip usually takes more time.',
];

/** What the pulled levers put on screen, for the tutor and JEV. Never the key. */
export function leverFacts(item: MissionItem, s: MissionLeverState): string | null {
  const parts: string[] = [];
  const on = (id: string) => s.pulled.includes(id);
  if (on(ASK_ARROW_LEVER) && item.mode === 'farther_closer') parts.push(`an arrow goes out from Earth under the choices, its ${item.ask === 'far' ? 'far' : 'near'} end marked "${item.ask === 'far' ? 'farthest from Earth' : 'closest to Earth'}"; no place is on the arrow`);
  if (on(DISTANCE_LINES_LEVER)) parts.push('every month\'s picture now has a dashed line from Earth to the planet; no length is written');
  if (on(FUEL_CARD_LEVER)) parts.push(`a card says: "${FUEL_CARD_LINES.join(' ')}"`);
  if (on(HOME_LEG_LEVER)) parts.push('the trip home is now drawn with its own day squares, the same as the trip there; no total is written');
  if (on(CREW_ROWS_LEVER)) parts.push(`each astronaut is drawn with their own food pack and the line "${CREW_LINE}"`);
  if (on(ASSIST_CARD_LEVER)) parts.push(`a card says: "${ASSIST_CARD_LINES.join(' ')}"`);
  if (on(LIMIT_LINE_LEVER) && item.mode === 'assist_tradeoff') parts.push(`every route's row of years has a red line at ${item.limit} years, the limit`);
  for (const i of s.dropped) if (i < optionCount(item)) parts.push(`${optionLabel(item, i)} is greyed out and is not the answer`);
  return parts.length ? parts.join('; ') : null;
}

/** For tests: every miss an item's wrong answers can show. */
export function possibleMisses(item: MissionItem): MissionMiss[] {
  const out = new Set<MissionMiss>();
  for (let i = 0; i < optionCount(item); i++) { const m = optionMiss(item, i); if (m) out.add(m); }
  return Array.from(out);
}
