/**
 * volcano-island's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `volcanoIsland.boss.ts`.
 * kitchen_volcano is a fair test on a 3D kitchen table the activity checks: one item at a time, no key reaches the tutor.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`TeachingAttempt.miss`), from `kitchenMiss` in `volcanoModel.ts`: `changed_both` (volcano B
 * changes the other amount too, an unfair test), `no_change` (B is the same as A), `kept_prediction` (the claim is the
 * guess the eruptions did not show), `misread_result` (another claim they did not show). runny_or_sticky, from
 * `magmaMiss` in `magmaModel.ts`: `missed_thickness` (runny called thick or the other way), `missed_gas` (thick magma's gas).
 * layers_over_time, from `layersMiss` in `layersModel.ts`: `top_is_oldest` (read from the top down), `crack_too_early` (the
 * lava crack before a layer it cuts), `order_slip` (another). save_the_village, from `villageMiss` in `villageModel.ts`:
 * `walls_off_path` (no wall where the lava goes), `lava_went_around` (the lava went around the walls). cool_the_rock, from
 * `rockMiss` in `rockModel.ts`: `speed_swapped` (slow and fast cooling swapped), `fast_mixup` (surface and sea mixed up),
 * `missed_bubbles` (pumice's holes not traced to gassy lava).
 */
export const VOLCANO_MISSES_BY_MODE = {
  kitchen_volcano: ['changed_both', 'no_change', 'kept_prediction', 'misread_result'],
  runny_or_sticky: ['missed_thickness', 'missed_gas'],
  layers_over_time: ['top_is_oldest', 'crack_too_early', 'order_slip'],
  save_the_village: ['walls_off_path', 'lava_went_around'],
  cool_the_rock: ['speed_swapped', 'fast_mixup', 'missed_bubbles'],
} as const;
export type VolcanoMiss = typeof VOLCANO_MISSES_BY_MODE[keyof typeof VOLCANO_MISSES_BY_MODE][number];

/** Every miss is answered by a lever (`volcanoLevers.ts`). */
export const volcanoIslandCard = defineCard<VolcanoMiss>({
  id: 'volcano-island',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    kitchen_volcano: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: VOLCANO_MISSES_BY_MODE.kitchen_volcano,
      moves: 'sets volcano B\'s baking soda and vinegar, guesses which will erupt higher, erupts both, taps which went higher, '
        + 'and presses Check' },
    runny_or_sticky: { answer: 'tap', judge: 'activity', flow: 'one-at-a-time', misses: VOLCANO_MISSES_BY_MODE.runny_or_sticky,
      moves: 'erupts each test magma on the island after a guess, then taps what the new volcano\'s magma will do, and '
        + 'presses Check; a right check erupts it' },
    layers_over_time: { answer: 'tap', judge: 'activity', flow: 'one-at-a-time', misses: VOLCANO_MISSES_BY_MODE.layers_over_time,
      moves: 'guesses where the new layer will go, erupts the volcano, taps the layers in the cutaway oldest first, and presses Check' },
    save_the_village: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: VOLCANO_MISSES_BY_MODE.save_the_village,
      moves: 'taps squares on the slope map to place or remove rock walls, erupts to test, and presses "I\'m done!"' },
    cool_the_rock: { answer: 'tap', judge: 'activity', flow: 'one-at-a-time', misses: VOLCANO_MISSES_BY_MODE.cool_the_rock,
      moves: 'cools each lava sample after guessing its rock, then taps where the found rock cooled, and presses Check' },
  },
  words: {
    job: 'run a fair test with two baking-soda-and-vinegar volcanoes, or erupt real volcanoes\' magma on an island and use what it is like (runny or thick, gas) to say what a new one will do, put a volcano\'s rock layers in order, place walls so lava misses a village, or tell where a rock cooled from its crystals',
    answer: 'volcano B\'s mix and which erupted higher, or the call on the new magma',
    question: 'volcano A\'s mix, the amount to change, the foam heights, or each magma\'s look and what the tests did',
  },
  levers: true,
});
