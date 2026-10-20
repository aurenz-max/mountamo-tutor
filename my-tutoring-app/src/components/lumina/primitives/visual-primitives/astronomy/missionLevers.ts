/**
 * The in-item levers on mission-planner, as one lever set (`bossLevers.ts`; `/add-support-tiers`, report
 * qa/eval-reports/mission-planner-levers-2026-10-16.md). No real-learner evidence: the misses are what `missionMiss`
 * observes. Every lever starts released; `config.difficulty` changes the items, not the levers.
 *
 * - `ask_arrow` (clue; farther_closer): an arrow from Earth with the asked end marked ("farthest from Earth" or
 *   "closest to Earth"), under the choices. It places no choice on it. farther_closer is a recall item: any card naming
 *   places in order states the key (replay 10-16: an order card read aloud named the Moon and Mars as the key on 19/80
 *   replies), so no lever orders the places; next_in_line and in_between go to `drop_one`.
 * - `distance_lines` (marks; pick_window): a dashed line from Earth to the target in EVERY month's picture, no length.
 * - `fuel_card` (clue; pick_window): the rule: least fuel when the planet is close to Earth, most on the far side.
 * - `home_leg` (marks; pack_days): draws the trip home as day squares too, so the whole trip is drawn, the stay once.
 * - `crew_rows` (clue; pack_days with a crew): each astronaut drawn with their own pack, "1 pack every day".
 * - `assist_card` (clue; assist_tradeoff): a flyby gives the ship a free push, so more flybys need less fuel.
 * - `limit_line` (marks; assist_tradeoff): the limit marked the same way on every route's row of years.
 * - `drop_one` (custom; user ruling 09-27: a removed choice is assisted work): greys out one wrong choice that is easy to
 *   rule out, while at least two untried ones remain. Not on two-choice items.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { MISSION_MISSES } from './missionPlanner.card';
import {
  keyOf, optionCount, optionLabel, optionMiss, packsNeeded, PLACE_AU, separation,
  type MissionItem, type MissionMiss, type MissionMode,
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

export const FUEL_CARD_LINES = [
  'Planets keep moving round the Sun, each at its own speed.',
  'A ship needs the least fuel when it launches while its planet is close to Earth, and the most when the planet is on the far side of the Sun.',
];
export const CREW_LINE = 'Each astronaut eats 1 pack every day.';
export const ASSIST_CARD_LINES = [
  'A flyby: the ship swings past a planet, and the planet\'s pull gives it a free push.',
  'More flybys: less fuel. But the path is longer, so the trip usually takes more time.',
];

/** The lesson's lever state for the item on screen. */
export interface MissionLeverContext { state: MissionLeverState }

const askedEnd = (item: MissionItem) => (item.mode === 'farther_closer' && item.ask === 'near' ? 'closest to Earth' : 'farthest from Earth');

export const MISSION_LEVERS = leverSet<MissionItem, MissionLeverContext>({
  modeOf: item => item.mode,
  missesOf: mode => MISSION_MISSES[mode as MissionMode] ?? [],
  // A card's words never name the right choice: its label, or the number of packs.
  answersOf: item => {
    const at = keyOf(item);
    return [optionLabel(item, at), ...(item.mode === 'pack_days' ? [String(item.options[at])] : [])];
  },
  specs: [
    { id: ASK_ARROW_LEVER, type: 'clue', carrier: 'shown', modes: ['farther_closer'], answers: ['other_end'],
      when: 'The learner answers the opposite of the question (the closest when asked for the farthest, or the other way round).',
      does: item => `Draws an arrow going out from Earth under the choices, with its ${item.mode === 'farther_closer' && item.ask === 'near' ? 'near' : 'far'} end `
        + `marked "${askedEnd(item)}". No place is put on the arrow.`,
      fact: (_c: unknown, item) => `An arrow goes out from Earth under the choices, its ${item.mode === 'farther_closer' && item.ask === 'near' ? 'near' : 'far'} `
        + `end marked "${askedEnd(item)}"; no place is on the arrow.` },
    { id: DISTANCE_LINES_LEVER, type: 'marks', modes: ['pick_window'], answers: ['in_between_window'],
      when: 'The learner cannot tell in which month the two planets are nearer each other.',
      does: 'Draws a dashed line from Earth to the planet in every month\'s picture, the same way in each. No length is written.',
      fact: 'Every month\'s picture now has a dashed line from Earth to the planet; no length is written.' },
    { id: FUEL_CARD_LEVER, type: 'clue', carrier: 'shown', modes: ['pick_window'], answers: ['far_apart', 'close_together'],
      when: 'The learner does not connect where the planets are with how much fuel the trip needs.',
      does: 'Shows a card with the rule: planets keep moving; a ship needs the least fuel when its planet is close to Earth, '
        + 'and the most when the planet is on the far side of the Sun. It names no month.',
      fact: `A card says: "${FUEL_CARD_LINES.join(' ')}"` },
    { id: HOME_LEG_LEVER, type: 'marks', modes: ['pack_days'], answers: ['forgot_home', 'stay_twice', 'forgot_stay'],
      when: 'The learner leaves out the trip home, or counts the stay wrong.',
      does: 'Draws the trip home with its own day squares, the same as the trip there, so the whole trip is drawn and the '
        + 'stay appears once. No total is written.',
      fact: 'The trip home is now drawn with its own day squares, the same as the trip there; no total is written.' },
    { id: CREW_ROWS_LEVER, type: 'clue', carrier: 'shown', modes: ['pack_days'], answers: ['forgot_crew', 'added_crew'],
      offer: item => item.mode === 'pack_days' && item.crew > 1,
      when: 'The learner packs for one astronaut, or adds the crew instead of feeding each one.',
      does: `Draws each astronaut with their own food pack and the line "${CREW_LINE}" No total is written.`,
      fact: `Each astronaut is drawn with their own food pack and the line "${CREW_LINE}"; no total is written.` },
    { id: ASSIST_CARD_LEVER, type: 'clue', carrier: 'shown', modes: ['assist_tradeoff'], answers: ['picked_direct', 'fewer_flybys'],
      when: 'The learner does not use flybys to judge fuel.',
      does: 'Shows a card: when the ship swings past a planet, the planet\'s pull gives it a free push, so it needs less fuel; '
        + 'more flybys, less fuel, but usually a longer trip. It names no route.',
      fact: `A card says: "${ASSIST_CARD_LINES.join(' ')}"` },
    { id: LIMIT_LINE_LEVER, type: 'marks', modes: ['assist_tradeoff'], answers: ['too_slow'],
      when: 'The learner picks a route that takes longer than the limit.',
      does: 'Marks the year limit with the same red line on every route\'s row of years. It names no route.',
      fact: (_c: unknown, item) => `Every route's row of years has a red line at ${item.mode === 'assist_tradeoff' ? item.limit : 0} years, the limit.` },
    { id: DROP_LEVER, type: 'custom', answers: 'all', carrier: 'shown',
      why: 'It narrows this item in place (one wrong choice greyed out) rather than opening a practice item.',
      when: 'The learner still picks wrong after help, or is stuck with too many to choose from.',
      does: 'Greys out one choice that is easy to rule out, so fewer remain. The next answer counts as helped.',
      // Offered while one more can be greyed out; once pulled, its fact names every greyed-out choice.
      content: (item, { state }) => (state.pulled.includes(DROP_LEVER) || dropTarget(item, state) !== null ? state.dropped : null),
      fact: (dropped: readonly number[], item) => dropped.filter(i => i < optionCount(item))
        .map(i => `${optionLabel(item, i)} is greyed out and is not the answer.`).join(' ') },
  ],
});

/** For tests: every miss an item's wrong answers can show. */
export function possibleMisses(item: MissionItem): MissionMiss[] {
  const out = new Set<MissionMiss>();
  for (let i = 0; i < optionCount(item); i++) { const m = optionMiss(item, i); if (m) out.add(m); }
  return Array.from(out);
}
