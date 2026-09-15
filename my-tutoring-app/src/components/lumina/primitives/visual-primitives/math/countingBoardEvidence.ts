import { numberWordFor, type CountingItem } from './countingBoardScript';

/** What the learner produced on one judged attempt, as the board and the runner recorded it. */
export interface CountingResponse {
  heard?: string | null;
  given?: number;
  hand?: number | null;
}

/** The task and key of one board, stated from its rendered fields. Facts only; no error is named. */
export function countingTask(item: CountingItem, gradeBand: 'K' | '1'): { challenge: string; expected: string } {
  const n = (v: number) => `${numberWordFor(v)} (${v})`;
  const objects = item.objectWord;
  const expected = n(item.target);
  switch (item.kind) {
    case 'subitize_perceptual':
      return { challenge: `${item.count} ${objects} shown; tap the hand with that many fingers (hands show 1, 2 and 3).`, expected: `The hand with ${item.target} fingers.` };
    case 'give_me_n':
      return { challenge: `From a pile of ${item.count} ${objects}, the tutor asked for ${item.target}; touch that many and hand them over.`, expected: `${item.target} ${objects} handed over.` };
    case 'subitize':
      return { challenge: `${item.count} ${objects} shown${gradeBand === 'K' ? ' briefly, then hidden' : ''}; say how many without counting one by one.`, expected };
    case 'count_on':
      return { challenge: `The tutor said ${item.startFrom} are already in the group (${gradeBand === 'K' ? 'covered by a basket' : 'visible and marked counted'}); `
        + `${item.count - (item.startFrom ?? 0)} more ${objects} are on the board to count on. Say how many altogether.`, expected };
    case 'group_count':
      return { challenge: `${item.count} ${objects} in groups of ${item.groupSize}. Say how many altogether.`, expected };
    case 'compare':
      return { challenge: item.compareGroups
        ? `Two groups of ${objects}: ${item.compareGroups[0]} on the left and ${item.compareGroups[1]} on the right. Say how many are in the group with more.`
        : `Two groups of ${objects}: ${item.target} and ${item.count - item.target}. Say how many are in the group with more.`, expected };
    case 'recount_moved':
      return { challenge: `${item.count} ${objects} in a line; after the learner counted them they moved to new places and could not be touched again. Say how many now.`, expected };
    case 'take_away':
      return { challenge: `${item.count} ${objects} on the board; the tutor said to take away ${item.changeBy}. Say how many are left.`, expected: `${expected} left` };
    case 'add_more':
      return { challenge: `${item.count} ${objects} on the board; the tutor said to put ${item.changeBy} more on. Say how many altogether.`, expected: `${expected} altogether` };
    default:
      return { challenge: `${item.count} ${objects} on the board. Touch each and say how many.`, expected };
  }
}

/** One observation for the runner: the task and what the learner said, handed over or tapped. */
export function countingObservation(item: CountingItem, gradeBand: 'K' | '1', response: CountingResponse) {
  const observed = item.kind === 'give_me_n'
    ? `Handed over ${response.given ?? 0} ${item.objectWord}.`
    : item.kind === 'subitize_perceptual'
      ? response.hand != null ? `Tapped the hand with ${response.hand} fingers.` : 'Tapped a hand; which one was not recorded.'
      : response.heard?.trim() ? `Said "${response.heard.trim()}".` : 'No transcript; the tutor judged the spoken answer wrong.';
  return { ...countingTask(item, gradeBand), observed };
}

const EXPECTED: Partial<Record<CountingItem['kind'], string>> = {
  take_away: 'The number left on the board: the start minus the number taken away.',
  add_more: 'The number on the board altogether: the start plus the number put on.',
  count_on: 'The number altogether: the start plus the objects counted on.',
  compare: 'The number of objects in the larger group.',
  recount_moved: 'The same number that was counted before the objects moved.',
  group_count: 'The number of objects in all the groups together.',
  give_me_n: 'Exactly the number asked for, handed over.',
  subitize_perceptual: 'The hand whose finger count equals the number of objects shown.',
};

const SESSION: Partial<Record<CountingItem['kind'], string>> = {
  take_away: 'each board starts with some objects, the tutor says how many to take away, the learner removes them and says how many are left',
  add_more: 'each board starts with some objects, the tutor says how many more to put on, the learner puts them on and says how many altogether',
  count_on: 'the tutor says how many are already in a group and the learner counts on the rest and says how many altogether',
  give_me_n: 'the tutor asks for a number of objects and the learner hands that many over from a bigger pile',
  subitize_perceptual: 'the learner sees a few objects and taps the hand with that many fingers',
};

/**
 * The session and its correct outcome, stated per mode for the distiller. The runner's `judgedRunEvidence`
 * adds the board count, the correction policy, the first-response share and the kept phases; this only says
 * what a session of these boards IS and what a right answer on it is.
 */
export function countingBoardEvidenceSummary(items: readonly Pick<CountingItem, 'kind'>[]): { task: string; expected: string } {
  const modes = Array.from(new Set(items.map((item) => item.kind)));
  const what = modes.length === 1 ? SESSION[modes[0]] ?? 'the learner counts the objects on each board and says how many' : `boards of ${modes.join(', ')}`;
  return {
    task: `Counting board (${modes.join(', ')}), ${items.length} boards: ${what}.`,
    expected: (modes.length === 1 && EXPECTED[modes[0]]) || 'The number of objects the board shows.',
  };
}
