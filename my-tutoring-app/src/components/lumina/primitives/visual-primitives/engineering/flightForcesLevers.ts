/**
 * The in-item levers on flight-forces-explorer, as one lever set (`bossLevers.ts`; `/add-support-tiers`, report
 * qa/eval-reports/flight-forces-explorer-levers-2026-10-15.md). No real-learner evidence: the misses are what
 * `flightMiss` observes; the failures behind them are documented (the catalog's commonStruggles: the particle-to-lift
 * link, fear of a steep angle, cargo not compensated) or inferred (a pilot action not mapped to its force, a balanced
 * pair read as motion, the nose read as the direction of travel, the drag that a steeper nose adds). Every lever starts
 * released; `config.difficulty` changes the items, not the levers.
 *
 * - `force_link` (clue; predict, an item whose ask does not name the force): a card naming which force the action
 *   changes and which way. It names no motion.
 * - `show_arrows` (marks; predict): draws the four arrows as they are right after the change, without moving the plane.
 * - `pair_up` (layout; observe): lines the arrows up in their pairs on one unit grid (lift beside weight, thrust beside
 *   drag), so their lengths compare directly.
 * - `count_units` (marks; observe): writes each arrow's length in units beside it.
 * - `target_marks` (marks; adjust): a dashed mark on the lift track at the weight's length and on the thrust track at
 *   the drag's length.
 * - `stall_mark` (marks; adjust, stall items): marks the nose angle past which the wing stalls.
 * - `one_step` (easier; predict hard): the same change asked one step simpler (the speed before the height, the
 *   nose tilted a little before steeply, one change before two), ungraded, then the full item back.
 * - `one_axis` (easier; observe, both directions asked): the same diagram asking the height only, then the full item.
 * - `one_control` (easier; adjust, two controls): the same goal with the thrust held as big as the drag, so only the
 *   nose angle is set, then the full item.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { keyAnswers } from '../../../components/live-activity/spokenKey';
import { FLIGHT_MISSES } from './flightForcesExplorer.card';
import {
  AIRCRAFT, askedAxes, choicesFor, emptyWork, flightKey, flightMiss, forcesAfter, forcesAt, goalMet, keyLabel, keyOf,
  NOSE_ANGLES, settings, solution,
  type AdjustItem, type FlightItem, type FlightMiss, type FlightMode, type Forces, type ObserveItem, type PredictItem,
  type Setting,
} from './flightForcesWorkspace';

export const FORCE_LINK_LEVER = 'force_link';
export const SHOW_ARROWS_LEVER = 'show_arrows';
export const PAIR_UP_LEVER = 'pair_up';
export const COUNT_UNITS_LEVER = 'count_units';
export const TARGET_MARKS_LEVER = 'target_marks';
export const STALL_MARK_LEVER = 'stall_mark';
export const ONE_STEP_LEVER = 'one_step';
export const ONE_AXIS_LEVER = 'one_axis';
export const ONE_CONTROL_LEVER = 'one_control';

/** force_link: which force the action changes, and which way. Never a motion. */
export function forceLinkLines(item: PredictItem): string[] {
  switch (item.change) {
    case 'load_water': return ['A load of water makes the plane heavier: its weight arrow grows.'];
    case 'drop_crate': return ['Dropping the crate makes the plane lighter: its weight arrow shrinks.'];
    case 'throttle_up': return ['The throttle sets how hard the engine pushes: forward means more thrust.'];
    case 'throttle_back': return ['The throttle sets how hard the engine pushes: back means less thrust.'];
    case 'gear_down': return ['Wheels hanging under the plane catch the air: more drag.'];
    case 'gear_up': return ['Wheels folded away stop catching the air: less drag.'];
    case 'nose_up': return [`Tilting the nose up a little, below the stall angle (${AIRCRAFT[item.aircraft].stallAngle}°), makes the wings push more air down: more lift.`];
    case 'nose_down': return ['Tilting the nose down makes the wings push less air down: less lift.'];
    case 'stall': return [`Past the stall angle (${AIRCRAFT[item.aircraft].stallAngle}°), the air stops flowing smoothly over the top of the wing and swirls: the lift arrow becomes very short.`];
    default: return [];
  }
}

/** The arrows drawn by show_arrows: the forces right after the change. */
export const shownArrows = (item: PredictItem): Forces => forcesAfter(item);

/** count_units: each arrow's length in units. */
export const countLines = (f: Forces): string[] => [`Lift ${f.lift}`, `Weight ${f.weight}`, `Thrust ${f.thrust}`, `Drag ${f.drag}`];

/** stall_mark: the angle past which the wing stalls. */
export const stallLine = (item: AdjustItem) =>
  `This plane's wings stall past ${AIRCRAFT[item.aircraft].stallAngle}°: the ${NOSE_ANGLES[5]}° step is past it.`;

/** The leak rule for every lever line: no motion word ("climbs", "slows down", "level", "balanced"). */
export function motionLeak(line: string): boolean {
  return /\b(climb|climbs|climbing|sink|sinks|sinking|level|rises?|falls?|descends?|speeds? up|slows? down|faster|slower|steady|balanced|same speed|goes up|goes down)\b/i.test(line);
}

// ── Simplify: practice items ─────────────────────────────────────────────────────────────

const PRACTICE = '~simpler';
export const isPractice = (item: Pick<FlightItem, 'id'>) => item.id.endsWith(PRACTICE);
export const practiceParent = (id: string) => (id.endsWith(PRACTICE) ? id.slice(0, -PRACTICE.length) : null);

/** The simpler item, or null when the item is already one step. Its key always differs from the item's own. */
export function simplerItem(item: FlightItem): FlightItem | null {
  if (isPractice(item)) return null;
  const id = `${item.id}${PRACTICE}`;
  if (item.mode === 'predict') {
    let s: PredictItem | null = null;
    if (item.later) s = { ...item, id, asked: 'speed', later: false };
    else if (item.change === 'stall') s = { ...item, id, change: 'nose_up' };
    else if (item.change === 'gear_and_throttle') s = { ...item, id, change: 'gear_down' };
    else if (item.change === 'crate_and_nose') s = { ...item, id, change: 'drop_crate' };
    if (!s) return null;
    return keyLabel(s, s.asked) !== keyLabel(item, item.asked) ? s : null;
  }
  if (item.mode === 'observe') {
    if (item.asked !== 'both') return null;
    return { ...item, id, asked: 'height' } as ObserveItem;
  }
  if (item.controls.length < 2) return null;
  const s: AdjustItem = { ...item, id, controls: ['nose'], coupled: false, stall: false,
    start: { thrust: item.drag0, nose: Math.min(item.start.nose, 4) }, goal: { ...item.goal, speed: undefined } };
  if (!s.goal.height || goalMet(s, s.start) || !solution(s)) return null;
  return s;
}

// ── The lever set ────────────────────────────────────────────────────────────────────────

const PRACTICE_NOTE = 'It is not graded; this item comes back after it.';

/** What the levers read beside the item: the controls as set now (target_marks follows the drag). */
export interface FlightLeverContext { setting?: Setting }

/** In the order the observer offers them: on every miss a help lever comes before the item's easier one. */
export const FLIGHT_LEVERS = leverSet<FlightItem, FlightLeverContext>({
  modeOf: item => item.mode,
  missesOf: mode => FLIGHT_MISSES[mode as FlightMode] ?? [],
  // The force_link card never names what the plane does.
  answersOf: item => { const key = flightKey(item); return key ? keyAnswers(key) : []; },
  specs: [
    { id: FORCE_LINK_LEVER, type: 'clue', carrier: 'shown', modes: ['predict'], answers: ['stall_more_lift', 'said_no_change', 'opposite_way'],
      when: 'The learner does not know which force the action changes.',
      does: 'Shows a card naming which force the action changes and which way (for example "wheels hanging under the plane catch the air: more drag"). It names no motion.',
      offer: item => item.mode === 'predict' && !item.named,
      content: item => (item.mode === 'predict' && forceLinkLines(item).length ? forceLinkLines(item) : null),
      fact: (lines: string[]) => `A card: ${lines.join(' ')}` },
    { id: SHOW_ARROWS_LEVER, type: 'marks', modes: ['predict'], answers: 'all',
      when: 'The learner cannot picture the forces after the change, or does not compare the pairs.',
      does: 'Draws the four arrows as they are right after the change, without moving the plane.',
      content: item => (item.mode === 'predict' ? shownArrows(item) : null),
      fact: (f: Forces) => `The arrows right after the change are drawn (the plane has not moved): lift ${f.lift}, weight ${f.weight}, thrust ${f.thrust}, drag ${f.drag}.` },
    { id: ONE_STEP_LEVER, type: 'easier', modes: ['predict'], answers: 'all',
      when: 'The learner cannot follow the change through.',
      does: item => (item.mode === 'predict' && item.later ? `Opens the same change asking about the speed first. ${PRACTICE_NOTE}`
        : item.mode === 'predict' && item.change === 'stall' ? `Opens the same plane with the nose tilted up only a little (6°) first. ${PRACTICE_NOTE}`
          : `Opens the same plane with only the first of the two changes. ${PRACTICE_NOTE}`),
      content: item => simplerItem(item) },
    { id: PAIR_UP_LEVER, type: 'layout', modes: ['observe'], answers: 'all',
      when: 'The learner compares the wrong arrows, or cannot see which of a pair is longer.',
      does: 'Lines the arrows up in their pairs on one unit grid beside the plane: lift beside weight, thrust beside drag.',
      fact: 'Beside the plane, the arrows are lined up in pairs on one unit grid: lift beside weight, thrust beside drag.' },
    { id: COUNT_UNITS_LEVER, type: 'marks', modes: ['observe'], answers: 'all',
      when: 'The learner cannot judge lengths that differ by little.',
      does: "Writes each arrow's length in units beside the drawing. It writes no comparison.",
      content: item => (item.mode === 'observe' ? countLines(item.forces) : null),
      fact: (lines: string[]) => `Each arrow's length is written beside it: ${lines.join(', ')}.` },
    { id: ONE_AXIS_LEVER, type: 'easier', modes: ['observe'], answers: 'all',
      when: 'The learner cannot handle both directions at once.',
      does: `Opens the same drawing asking only about the height first. ${PRACTICE_NOTE}`,
      content: item => simplerItem(item) },
    { id: TARGET_MARKS_LEVER, type: 'marks', modes: ['adjust'], answers: ['forgot_drag', 'lift_vs_weight', 'thrust_vs_drag'],
      when: 'The learner does not know how big the lift or the thrust must be, or misses that the drag grew.',
      does: "Draws a dashed mark on the lift arrow's track at the weight's length, and on the thrust arrow's track at the drag's length (it follows the drag). A mark shows where the arrow would be as long as its partner; it is not the goal.",
      content: (item, ctx) => (item.mode === 'adjust' ? forcesAt(item, ctx.setting ?? item.start) : null),
      fact: (f: Forces) => `Dashed marks: on the lift track at ${f.weight} (the weight's length), on the thrust track at ${f.drag} (the drag's length now). Each mark shows equal length with the partner arrow, not where the goal needs the arrow.` },
    { id: STALL_MARK_LEVER, type: 'marks', modes: ['adjust'], answers: ['stalled'],
      when: 'The learner tilts the nose past the stall angle.',
      does: 'Marks on the nose control the angle past which the wing stalls.',
      content: item => (item.mode === 'adjust' && item.stall ? stallLine(item) : null),
      fact: (line: string) => `On the nose control: ${line}` },
    { id: ONE_CONTROL_LEVER, type: 'easier', modes: ['adjust'], answers: 'all',
      when: 'The learner cannot set two controls at once.',
      does: `Opens the same plane and height goal with the thrust held as big as the drag, so only the nose angle is set. ${PRACTICE_NOTE}`,
      content: item => simplerItem(item) },
  ],
});

/** For tests: every miss this item's work can show. */
export function possibleMisses(item: FlightItem): FlightMiss[] {
  const out = new Set<FlightMiss>();
  if (item.mode === 'adjust') {
    for (const setting of settings(item)) { const m = flightMiss(item, { ...emptyWork(item), setting }); if (m) out.add(m); }
    return Array.from(out);
  }
  const right = { ...emptyWork(item), ...keyOf(item) };
  for (const a of askedAxes(item)) for (const c of choicesFor(a)) {
    const m = flightMiss(item, { ...right, [a]: c });
    if (m) out.add(m);
  }
  return Array.from(out);
}
