/**
 * The in-item levers on race-track-lab, as one lever set (`bossLevers.ts`; `/add-support-tiers`, report
 * qa/eval-reports/race-track-lab-levers-2026-10-15.md).
 * No real-learner evidence: the misses are what `raceMiss` observes; the failures behind them come from the catalog's
 * commonStruggles (speed read from looks, a position-time graph not read) and the task. Every lever starts released;
 * `config.difficulty` changes the items, not the levers.
 *
 * - `trail_count` (marks; observe, offered once the race has run): numbers the squares along every car's trail, 1, 2, 3
 *   from where it started. It marks no car as most or fastest.
 * - `step_marks` (marks; predict): a mark on each lane where the car will be after 1 and after 2 seconds; no mark at or
 *   past the finish line.
 * - `squares_to_go` (marks; predict, head-start items): each car's squares to the finish beside it.
 * - `trail_ticks` (marks; measure "how far", once the race has run): an unnumbered tick on every square the asked car moved.
 * - `gap_bracket` (marks; measure "how many more", once the race has run): an unnumbered bracket between where the two
 *   cars stopped.
 * - `second_marks` (marks; calculate): an unnumbered mark on each trail at every whole second.
 * - `one_second_step` (marks; graph): on each line (or the asked line), a step one second across and up to the line,
 *   without numbers.
 * - `simpler_race` / `simpler_numbers` / `simpler_graph` (easier): a fresh race with other cars in the easy shape of
 *   the same mode (two cars from square 0, a 2-second log, lines from 0), ungraded, then the full item back.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { RACE_MISSES } from './raceTrackLab.card';
import {
  choicesOf, drawSimpler, hasHeadStart, isNameAsk, keyChoice, movedOf, numericChoices, raceMiss,
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

// ── The lever set ─────────────────────────────────────────────────────────────────────────

/** What the levers read beside the item: whether the learner has run the race (observe, measure). */
export interface RaceLeverContext { ran: boolean }

const SIMPLER_SHAPE: Record<RaceItem['mode'], string> = {
  observe: 'two cars from square 0 with a clear difference in speed',
  predict: 'two cars from square 0 with a clear difference in speed',
  measure: 'two cars from square 0 for 2 seconds, asking how far one moved',
  calculate: 'one car from square 0 for 2 seconds',
  graph: 'two cars whose lines start at 0, asking which is fastest',
};
const simplerSpec = (mode: RaceItem['mode'], modes: RaceItem['mode'][]) => ({
  id: SIMPLER_LEVERS[mode], type: 'easier' as const, modes, answers: 'all' as const,
  when: 'The learner cannot do this race yet.',
  does: (item: RaceItem) => `Opens a simpler race of the same kind first, with other cars: ${SIMPLER_SHAPE[item.mode]}. `
    + 'It is not graded; this item comes back after it.',
  content: (item: RaceItem) => simplerItem(item),
});
const asked = (item: RaceItem) => item.racers[item.target ?? 0].name;

export const RACE_LEVERS = leverSet<RaceItem, RaceLeverContext>({
  modeOf: item => item.mode,
  missesOf: mode => RACE_MISSES[mode as RaceItem['mode']] ?? [],
  specs: [
    { id: TRAIL_COUNT_LEVER, type: 'marks', modes: ['observe'], answers: 'all',
      when: 'The learner judges by which car is in front, or cannot compare how far each car moved.',
      does: 'Numbers the squares along every car\'s trail, 1, 2, 3 and on from where it started. It marks no car as fastest.',
      // The trails are drawn only once the race has run.
      offer: (_item, { ran }) => ran,
      fact: 'Along each car\'s trail, the squares it moved are numbered 1, 2, 3 and on from where it started.' },
    { id: STEP_MARKS_LEVER, type: 'marks', modes: ['predict'], answers: 'all',
      when: 'The learner cannot turn a speed into where the car will be.',
      does: 'Draws a mark on each lane where the car will be after 1 second and after 2 seconds. No mark reaches the finish line.',
      fact: 'On each lane, a mark shows where the car will be after 1 second and after 2 seconds.' },
    { id: TO_GO_LEVER, type: 'marks', modes: ['predict'], answers: ['fastest_not_winner', 'head_start_not_winner'],
      when: 'The learner ignores the head start, or thinks a head start always wins.',
      does: 'Writes beside each car how many squares it has to go to the finish line.',
      offer: item => hasHeadStart(item),
      fact: (_on: unknown, item) => `Beside each car, its squares to go to the finish line: `
        + `${item.racers.map(r => `${r.name} ${item.trackLength - r.start}`).join(', ')}.` },
    { id: TRAIL_TICKS_LEVER, type: 'marks', modes: ['measure'], answers: 'all',
      when: 'The learner reads the square the car stopped on, counts the lines, or counts the wrong car.',
      does: 'Puts a small tick on every square the asked car moved, from where it started, without numbers.',
      offer: (item, { ran }) => ran && item.ask !== 'farther_by',
      fact: (_on: unknown, item) => `${asked(item)}'s trail has a small tick on every square it moved, without numbers.` },
    { id: GAP_BRACKET_LEVER, type: 'marks', modes: ['measure'], answers: 'all',
      when: 'The learner gives one car\'s whole distance, or adds the two.',
      does: 'Draws a bracket on the track between where the two cars stopped, without a number.',
      offer: (item, { ran }) => ran && item.ask === 'farther_by',
      fact: 'A bracket on the track spans the squares between where the two cars stopped, without a number.' },
    { id: SECOND_MARKS_LEVER, type: 'marks', modes: ['calculate'], answers: 'all',
      when: 'The learner gives the distance, multiplies, or does not see speed as squares in one second.',
      does: 'Puts a mark on each car\'s trail at every whole second, without numbers, so each second\'s squares can be counted.',
      fact: 'Each car\'s trail has a mark at every whole second, without numbers.' },
    { id: ONE_SECOND_LEVER, type: 'marks', modes: ['graph'], answers: 'all',
      when: 'The learner reads the height of a line, not how steep it is.',
      does: item => (item.ask === 'speed'
        ? 'On the asked car\'s line, draws a step one second across and up to the line, without numbers.'
        : 'On every line, draws a step one second across and up to the line, without numbers, so the steps can be compared.'),
      fact: (_on: unknown, item) => (item.ask === 'speed'
        ? `On ${asked(item)}'s line, a step shows one second across and how far up the line goes in that second, without numbers.`
        : 'On every line, a step shows one second across and how far up the line goes in that second, without numbers.') },
    simplerSpec('observe', ['observe', 'predict', 'measure']),
    simplerSpec('calculate', ['calculate']),
    simplerSpec('graph', ['graph']),
  ],
});

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
