/**
 * The in-item levers on number-sequencer's five spoken modes (`/add-support-tiers`, handoff 23 step 2; table
 * qa/support-levers/m2-lever-tables-2026-09-28.md, spoken slice). No real-learner evidence: the misses are what
 * `numberSequencerSpokenMisses` names (the numbers on this train, then the sound-alikes, then off by one or more).
 *
 * Help (the train shows more; the question is unchanged):
 * - `step_arrow` (count_from, before_after, fill_missing, decade_fill): an arrow on the printed car beside the glowing
 *   car, pointing at it and marked with the train's step (+1, −1, +5). Answers the start or the printed number said
 *   again, the other side, one skipped, a neighbour, counting by ones on a skip-count train, one off. Leak rule: it
 *   sits on a printed car, never on the glowing one, and carries the step, never the landing.
 * - `car_marks` (the same four modes, values 100 or less): each printed car shows its amount as sticks of ten and
 *   dots; an empty car shows none. Answers the teen/-ty swap, "twenty-ten", far off. Leak rule: no marks on an empty car.
 * - `model_train` (spot_error): below the train, a model train with its own numbers, the one that does not belong
 *   circled. Answers the repair said instead, a neighbour said. Leak rule: it shares no number with the item's train.
 * The lever set over all six modes is `NUMBER_SEQUENCER_LEVERS` (`numberSequencerLevers.ts`).
 * Simplify (an ungraded easier train of the same mode, then the full item):
 * - `smaller_numbers` (every spoken mode but spot_error): the same train shifted down by tens, so the step, the ones
 *   digits and any decade crossing are kept, with one gap only. Offered only when a shift of ten or more fits. Leak
 *   rule: its answer is none of the item's numbers, and no session item's answer where one is free.
 */
import type { NumberSequencerChallenge } from './NumberSequencer';
import { sequencerItemsForChallenge, type SequencerItem } from './numberSequencerDomain';

export const STEP_ARROW_LEVER = 'step_arrow';
export const CAR_MARKS_LEVER = 'car_marks';
export const MODEL_TRAIN_LEVER = 'model_train';
export const SMALLER_LEVER = 'smaller_numbers';

const STEP_KINDS = new Set(['count-from', 'before-after', 'fill-missing', 'decade-fill']);

/** The printed train with every gap filled, from its step: the gap items' numbers never appear on screen. */
function fullTrain(item: SequencerItem): number[] {
  if (item.challengeType === 'count-from') {
    const sign = item.direction === 'backward' ? -1 : 1;
    return item.sequence.map((_, i) => item.sequence[0]! + sign * i);
  }
  const known = item.sequence.flatMap((n, i) => n === null ? [] : [[i, n] as const]);
  if (!known.length) return [];
  const step = known.length >= 2 ? (known[1][1] - known[0][1]) / (known[1][0] - known[0][0]) : (item.answer - known[0][1]) / (item.slot - known[0][0]);
  return item.sequence.map((n, i) => n ?? known[0][1] + (i - known[0][0]) * step);
}

/**
 * The step arrow: which printed car carries it and the step it shows. Null when no printed car sits beside the
 * glowing one (a gap between two gaps). The car is the one the count is at on count_from.
 */
export function stepArrow(item: SequencerItem | null): { from: number; step: number } | null {
  if (!item || !STEP_KINDS.has(item.challengeType)) return null;
  const s = item.slot;
  if (item.challengeType === 'count-from') return { from: s - 1, step: item.direction === 'backward' ? -1 : 1 };
  const full = fullTrain(item);
  if (item.sequence[s - 1] != null) return { from: s - 1, step: full[s] - full[s - 1] };
  if (item.sequence[s + 1] != null) return { from: s + 1, step: full[s] - full[s + 1] };
  return null;
}

const MODELS: readonly (readonly number[])[] = [[2, 3, 8, 5, 6], [31, 32, 39, 34, 35], [71, 72, 77, 74, 75]];
/** The model train for spot_error, its wrong car at index 2, sharing no number with the item's train. */
export function modelTrain(item: SequencerItem | null): { cars: readonly number[]; wrong: number } | null {
  if (item?.challengeType !== 'spot-error') return null;
  const own = new Set(item.sequence.filter((n): n is number => n !== null));
  const cars = MODELS.find(m => m.every(n => !own.has(n)));
  return cars ? { cars, wrong: 2 } : null;
}

/** The easier train: the item's own shape shifted down by tens, with its one gap. Null when no shift fits. */
export function smallerNumbers(item: SequencerItem | null, session: readonly SequencerItem[]): SequencerItem | null {
  if (!item || !STEP_KINDS.has(item.challengeType)) return null;
  const full = fullTrain(item);
  const values = [...full, item.previous].filter(n => n > 0);
  const lowest = Math.min(...values);
  const own = new Set(values);
  const shifts: number[] = [];
  for (let s = Math.floor((lowest - 1) / 10) * 10; s >= 10; s -= 10) shifts.push(s);
  for (const taken of [new Set([...Array.from(own), ...session.map(i => i.answer)]), own])
    for (const s of shifts) {
      const answer = item.answer - s;
      if (taken.has(answer)) continue;
      const built = practiceFor(item, full.map(n => n - s), answer, s);
      if (built) return built;
    }
  return null;
}

function practiceFor(item: SequencerItem, train: number[], answer: number, shift: number): SequencerItem | null {
  const id = `${item.sourceId}~simpler`;
  let challenge: NumberSequencerChallenge;
  if (item.challengeType === 'count-from') {
    const start = item.previous - shift;
    challenge = { id, type: 'count-from', instruction: '', sequence: [start], correctAnswers: [answer], startNumber: start,
      direction: item.direction, rangeMin: Math.min(start, answer), rangeMax: Math.max(start, answer) };
  } else {
    const sequence = train.map((n, i) => i === item.slot ? null : n);
    challenge = { id, type: item.challengeType, instruction: '', sequence, correctAnswers: [answer],
      rangeMin: Math.min(...train), rangeMax: Math.max(...train) };
  }
  const built = sequencerItemsForChallenge(challenge)[0];
  return built && built.answer === answer ? { ...built, id: `${item.id}~simpler` } : null;
}

const STEP_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** The step arrow's words: "one more", "five less". */
export const stepPhrase = (step: number) => `${STEP_WORDS[Math.abs(step)] ?? 'one step'} ${step > 0 ? 'more' : 'less'}`;
