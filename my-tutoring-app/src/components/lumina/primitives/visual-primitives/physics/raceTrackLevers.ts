/**
 * The in-item levers on race-track-lab (`/add-support-tiers`; report qa/eval-reports/race-track-lab-levers-2026-10-15.md).
 * No real-learner evidence: the misses are what `raceMiss` observes; the failures behind them come from the catalog's
 * commonStruggles (speed read from looks, a position-time graph not read) and the task. Every lever starts released;
 * `config.difficulty` changes the items, not the levers.
 *
 * - `trail_count` (help; observe, after the run): numbers the squares along every car's trail, 1, 2, 3 from where it
 *   started. It marks no car as most or fastest.
 * - `step_marks` (help; predict): a mark on each lane where the car will be after 1 and after 2 seconds; no mark at or
 *   past the finish line.
 * - `squares_to_go` (help; predict, head-start items): each car's squares to the finish beside it.
 * - `trail_ticks` (help; measure "how far", after the run): an unnumbered tick on every square the asked car moved.
 * - `gap_bracket` (help; measure "how many more", after the run): an unnumbered bracket between where the two cars stopped.
 * - `second_marks` (help; calculate): an unnumbered mark on each trail at every whole second.
 * - `one_second_step` (help; graph): on each line (or the asked line), a step one second across and up to the line,
 *   without numbers.
 * - `simpler_race` / `simpler_numbers` / `simpler_graph` (simplify): a fresh race with other cars in the easy shape of
 *   the same mode (two cars from square 0, a 2-second log, lines from 0), ungraded, then the full item back.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import {
  choicesOf, drawSimpler, hasHeadStart, isNameAsk, keyChoice, movedOf, numericChoices, RACE_MISSES, raceMiss,
  seededRng, type RaceItem, type RaceTrackMiss,
} from './raceTrackWorkspace';

export const TRAIL_COUNT_LEVER = 'trail_count';
export const STEP_MARKS_LEVER = 'step_marks';
export const TO_GO_LEVER = 'squares_to_go';
export const TRAIL_TICKS_LEVER = 'trail_ticks';
export const GAP_BRACKET_LEVER = 'gap_bracket';
export const SECOND_MARKS_LEVER = 'second_marks';
export const ONE_SECOND_LEVER = 'one_second_step';
export const SIMPLER_LEVERS: Record<RaceItem['mode'], string> = {
  observe: 'simpler_race', predict: 'simpler_race', measure: 'simpler_race', calculate: 'simpler_numbers', graph: 'simpler_graph',
};

/** step_marks: the whole seconds (1 and 2) each car is drawn at, only while it is short of the finish line. */
export function stepMarks(item: RaceItem): Array<{ car: number; second: number; square: number }> {
  const out: Array<{ car: number; second: number; square: number }> = [];
  item.racers.forEach((r, car) => {
    for (const second of [1, 2]) {
      const square = r.start + r.speed * second;
      if (square < item.trackLength) out.push({ car, second, square });
    }
  });
  return out;
}

/** The lines one_second_step draws on: every line for "which is fastest", the asked line for "what speed". */
export const stepLines = (item: RaceItem) => (item.ask === 'speed' ? [item.target ?? 0] : item.racers.map((_, i) => i));

// ── Simplify: practice items ──────────────────────────────────────────────────────────────

const PRACTICE = '~simpler';
export const isPractice = (item: Pick<RaceItem, 'id'>) => item.id.endsWith(PRACTICE);
export const practiceParent = (id: string) => (id.endsWith(PRACTICE) ? id.slice(0, -PRACTICE.length) : null);

/** The item is already in its mode's easy shape, so there is nothing simpler to open. */
function alreadySimple(item: RaceItem): boolean {
  const fromZero = !hasHeadStart(item), two = item.racers.length === 2;
  const speeds = item.racers.map(r => r.speed).sort((a, b) => b - a);
  switch (item.mode) {
    case 'observe': return fromZero && two && speeds[0] - speeds[1] >= 2;
    case 'predict': return fromZero && two && item.given !== 'in_time' && speeds[0] - speeds[1] >= 2;
    case 'measure': return fromZero && item.ask === 'distance' && item.time === 2;
    case 'calculate': return fromZero && item.ask === 'speed' && item.time === 2;
    case 'graph': return fromZero && item.ask === 'fastest' && two;
  }
}

/**
 * The simpler item: a fresh race with cars not in the item, in the easy shape of the same mode (two cars from square
 * 0 with a clear gap; a "how far" count after 2 seconds; a 2-second log from square 0; lines from 0, which is fastest).
 * Null when the item is already that simple. Its key is never the item's key: other cars, and a different number.
 */
export function simplerItem(item: RaceItem): RaceItem | null {
  if (isPractice(item) || alreadySimple(item)) return null;
  const rng = seededRng(`${item.id}:${JSON.stringify(item.racers)}`);
  const exclude = item.racers.map(r => r.name);
  for (let tries = 0; tries < 50; tries++) {
    const practice = drawSimpler(item.mode, rng, exclude);
    if (!practice) return null;
    if (keyChoice(practice) === keyChoice(item)) continue;
    return { ...practice, id: `${item.id}${PRACTICE}` };
  }
  return null;
}

// ── Levers on the current item ────────────────────────────────────────────────────────────

const lever = (id: string, kind: WorkspaceLever['kind'], pulled: readonly string[], answers: readonly RaceTrackMiss[], when: string, does: string): WorkspaceLever =>
  ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });

/** The levers on the current session item. A practice item has none. */
export function raceLevers(item: RaceItem | undefined, pulled: readonly string[]): WorkspaceLever[] {
  if (!item || isPractice(item)) return [];
  const out: WorkspaceLever[] = [];
  const misses = RACE_MISSES[item.mode];
  switch (item.mode) {
    case 'observe':
      out.push(lever(TRAIL_COUNT_LEVER, 'help', pulled, misses,
        'The learner judges by which car is in front, or cannot compare how far each car moved.',
        'After the race has run, numbers the squares along every car\'s trail, 1, 2, 3 and on from where it started. It marks no car as fastest.'));
      break;
    case 'predict':
      out.push(lever(STEP_MARKS_LEVER, 'help', pulled, misses,
        'The learner cannot turn a speed into where the car will be.',
        'Draws a mark on each lane where the car will be after 1 second and after 2 seconds. No mark reaches the finish line.'));
      if (hasHeadStart(item)) {
        out.push(lever(TO_GO_LEVER, 'help', pulled, ['fastest_not_winner', 'head_start_not_winner'],
          'The learner ignores the head start, or thinks a head start always wins.',
          'Writes beside each car how many squares it has to go to the finish line.'));
      }
      break;
    case 'measure':
      out.push(item.ask === 'farther_by'
        ? lever(GAP_BRACKET_LEVER, 'help', pulled, misses,
          'The learner gives one car\'s whole distance, or adds the two.',
          'After the race has run, draws a bracket on the track between where the two cars stopped, without a number.')
        : lever(TRAIL_TICKS_LEVER, 'help', pulled, misses,
          'The learner reads the square the car stopped on, counts the lines, or counts the wrong car.',
          'After the race has run, puts a small tick on every square the asked car moved, from where it started, without numbers.'));
      break;
    case 'calculate':
      out.push(lever(SECOND_MARKS_LEVER, 'help', pulled, misses,
        'The learner gives the distance, multiplies, or does not see speed as squares in one second.',
        'Puts a mark on each car\'s trail at every whole second, without numbers, so each second\'s squares can be counted.'));
      break;
    case 'graph':
      out.push(lever(ONE_SECOND_LEVER, 'help', pulled, misses,
        'The learner reads the height of a line, not how steep it is.',
        item.ask === 'speed'
          ? 'On the asked car\'s line, draws a step one second across and up to the line, without numbers.'
          : 'On every line, draws a step one second across and up to the line, without numbers, so the steps can be compared.'));
      break;
  }
  const simpler = simplerItem(item);
  if (simpler) {
    const what = item.mode === 'calculate' ? 'one car from square 0 for 2 seconds'
      : item.mode === 'graph' ? 'two cars whose lines start at 0, asking which is fastest'
        : item.mode === 'measure' ? 'two cars from square 0 for 2 seconds, asking how far one moved'
          : 'two cars from square 0 with a clear difference in speed';
    out.push(lever(SIMPLER_LEVERS[item.mode], 'simplify', pulled, misses, 'The learner cannot do this race yet.',
      `Opens a simpler race of the same kind first, with other cars: ${what}. It is not graded; this item comes back after it.`));
  }
  return out;
}

/** What the pulled levers put on screen, as a scene fact. Never a key. */
export function leverFact(item: RaceItem | undefined, pulled: readonly string[]): string {
  if (!item || isPractice(item)) return '';
  const parts: string[] = [];
  if (pulled.includes(TRAIL_COUNT_LEVER)) parts.push('Along each car\'s trail, the squares it moved are numbered 1, 2, 3 and on from where it started.');
  if (pulled.includes(STEP_MARKS_LEVER)) parts.push('On each lane, a mark shows where the car will be after 1 second and after 2 seconds.');
  if (pulled.includes(TO_GO_LEVER)) parts.push(`Beside each car, its squares to go to the finish line: ${item.racers.map(r => `${r.name} ${item.trackLength - r.start}`).join(', ')}.`);
  if (pulled.includes(TRAIL_TICKS_LEVER)) parts.push(`${item.racers[item.target ?? 0].name}'s trail has a small tick on every square it moved, without numbers.`);
  if (pulled.includes(GAP_BRACKET_LEVER)) parts.push('A bracket on the track spans the squares between where the two cars stopped, without a number.');
  if (pulled.includes(SECOND_MARKS_LEVER)) parts.push('Each car\'s trail has a mark at every whole second, without numbers.');
  if (pulled.includes(ONE_SECOND_LEVER)) parts.push(item.ask === 'speed'
    ? `On ${item.racers[item.target ?? 0].name}'s line, a step shows one second across and how far up the line goes in that second, without numbers.`
    : 'On every line, a step shows one second across and how far up the line goes in that second, without numbers.');
  return parts.join(' ');
}

/** Help levers that need the race on screen first (observe, measure): refused before Run the race. */
export const NEEDS_RUN_LEVERS = [TRAIL_COUNT_LEVER, TRAIL_TICKS_LEVER, GAP_BRACKET_LEVER];

/** For tests: every miss this item's choices can show. */
export const possibleMisses = (item: RaceItem): RaceTrackMiss[] =>
  Array.from(new Set(choicesOf(item).map(c => raceMiss(item, c)).filter((m): m is RaceTrackMiss => !!m)));

/** For tests: the numbers a lever draws, so a leak rule can check none is the key. */
export function leverNumbers(item: RaceItem, id: string): number[] {
  if (id === TO_GO_LEVER) return item.racers.map(r => item.trackLength - r.start);
  if (id === STEP_MARKS_LEVER) return stepMarks(item).map(m => m.square);
  if (id === TRAIL_COUNT_LEVER) return item.racers.flatMap(r => Array.from({ length: movedOf(item, r) }, (_, i) => i + 1));
  return [];
}

/** The leak rule for numbered levers on a numeric item: no number they draw is the key's number. */
export function numberLeak(item: RaceItem, id: string): boolean {
  if (isNameAsk(item.ask)) return false;
  const key = numericChoices(item)!.find(c => c.kind === 'key')!.value;
  return leverNumbers(item, id).includes(key);
}

/** The leak rule for step_marks: no mark at or past the finish line (that would show the winner). */
export const stepMarksLeak = (item: RaceItem) => stepMarks(item).some(m => m.square >= item.trackLength);
