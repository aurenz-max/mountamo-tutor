/**
 * length-lab's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `lengthLab.boss.ts`.
 * Comparing two objects and the indirect comparison each ask for one sayable answer: the learner says it (the tutor
 * judges the words against the key) or taps the choice (the activity checks the tap), so they are SAY_OR_SHOW.
 * Laying units with + and Check, guessing then measuring, measuring with two units and putting three objects in
 * order are boards the activity checks.
 */
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`TeachingAttempt.miss`, handoff 20), from the work the check reads, drawn from the old
 * catalog's commonStruggles (longer/shorter confused, gaps or overlaps when tiling):
 * - compare: `reversed` (longer and shorter swapped), `said_same` (a real difference called the same),
 *   `missed_same` (equal lengths called longer or shorter);
 * - tile_and_count / estimate_then_tile: `tiled_to_guess` (stopped at the guess, not the end of the object),
 *   `one_short` / `one_over` (a gap or an overlap's worth), `short` / `over`;
 * - two_unit_compare: `chose_bigger_unit` (picked the unit that took fewer);
 * - order: `reversed_order` (longest first), `swapped_pair` (two neighbours swapped), `other_order`;
 * - indirect: `chose_shorter` (the other object), `said_same`.
 */
export type LengthMiss = 'reversed' | 'said_same' | 'missed_same'
  | 'tiled_to_guess' | 'one_short' | 'one_over' | 'short' | 'over'
  | 'chose_bigger_unit'
  | 'reversed_order' | 'swapped_pair' | 'other_order'
  | 'chose_shorter';

/** The activity's check (`lengthMiss`) and the spoken items' known misses (`lengthSpokenMisses`), by mode, same ids. */
export const LENGTH_MISSES = {
  compare: ['reversed', 'said_same', 'missed_same'],
  estimate_then_tile: ['tiled_to_guess', 'one_short', 'one_over', 'short', 'over'],
  two_unit_compare: ['chose_bigger_unit'],
  tile_and_count: ['one_short', 'one_over', 'short', 'over'],
  order: ['reversed_order', 'swapped_pair', 'other_order'],
  indirect: ['chose_shorter', 'said_same'],
} as const satisfies Record<string, readonly LengthMiss[]>;

const LAY = 'lays units with + and -, then presses Check';

export const lengthLabCard = defineCard<LengthMiss>({
  id: 'length-lab',
  grades: ['Kindergarten', 'Grade 1'],
  modes: {
    compare: { ...SAY_OR_SHOW, moves: 'may instead tap a choice', misses: LENGTH_MISSES.compare },
    estimate_then_tile: { answer: 'manipulate', judge: 'activity', flow: 'board',
      moves: `taps a guess (never marked), then ${LAY}`, misses: LENGTH_MISSES.estimate_then_tile },
    two_unit_compare: { answer: 'manipulate', judge: 'activity', flow: 'board',
      moves: 'measures with each unit (+, then Check), then taps the unit needed more of', misses: LENGTH_MISSES.two_unit_compare },
    tile_and_count: { answer: 'manipulate', judge: 'activity', flow: 'board', moves: LAY, misses: LENGTH_MISSES.tile_and_count },
    order: { answer: 'manipulate', judge: 'activity', flow: 'board',
      moves: 'taps the objects into the slots, shortest first, then presses Check Order',
      misses: LENGTH_MISSES.order },
    indirect: { ...SAY_OR_SHOW, moves: 'may instead tap a choice', misses: LENGTH_MISSES.indirect },
  },
  words: {
    job: 'compare lengths, measure with units, or order objects by length',
    answer: 'their answer',
    question: 'the ask and the objects on screen',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
