/**
 * comparison-builder's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `comparisonBuilder.boss.ts`.
 * Comparing two groups, comparing two numbers and one number one more or one less are each one sayable answer: the
 * learner says it (the tutor judges the words against the key) or taps it (the activity checks the tap), so those
 * modes are SAY_OR_SHOW; an item asking for one more and one less together has no key and is only tapped. Ordering
 * the number cards is a board of slots the activity checks together.
 */
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`TeachingAttempt.miss`, handoff 20), by the kind of choice, never the option:
 * - compare-groups / compare-numbers: `said_equal` (same chosen for unequal), `missed_equal` (more or fewer, or
 *   a < or >, chosen for equal), `reversed` (the opposite relation);
 * - order: `reversed` (the other direction), `two_swapped`, `other_order`;
 * - one-more-one-less: `no_step` (the number itself), `wrong_way` (one the other way, or the two answers
 *   exchanged), `one_short` / `one_over` / `short_by_more` / `over_by_more` (from the right number).
 */
export type ComparisonMiss = 'said_equal' | 'missed_equal' | 'reversed' | 'two_swapped' | 'other_order'
  | 'no_step' | 'wrong_way' | 'one_short' | 'one_over' | 'short_by_more' | 'over_by_more';

/** The activity's own check (`comparisonMiss`) and the spoken items' known misses, by mode, with the same ids. */
export const COMPARISON_MISSES = {
  compare_groups: ['reversed', 'said_equal', 'missed_equal'],
  compare_numbers: ['reversed', 'said_equal', 'missed_equal'],
  order: ['reversed', 'two_swapped', 'other_order'],
  one_more_less: ['no_step', 'wrong_way', 'one_short', 'one_over', 'short_by_more', 'over_by_more'],
} as const satisfies Record<string, readonly ComparisonMiss[]>;

export const comparisonBuilderCard = defineCard<ComparisonMiss>({
  id: 'comparison-builder',
  grades: ['Kindergarten', 'Grade 1'],
  modes: {
    compare_groups: { ...SAY_OR_SHOW,
      moves: 'may instead tap: in Kindergarten the group with more (or the equals sign for the same); in Grade 1 More, '
        + 'Fewer or The Same, then Check',
      misses: COMPARISON_MISSES.compare_groups },
    one_more_less: { ...SAY_OR_SHOW,
      moves: 'may instead tap the number (in Grade 1, then Check); an item asking for one more and one less is only '
        + 'tapped, one number per row',
      misses: COMPARISON_MISSES.one_more_less },
    compare_numbers: { ...SAY_OR_SHOW,
      moves: 'may instead tap: in Kindergarten the bigger number (or the equals sign for the same); in Grade 1 the sign '
        + 'between them, then Check',
      misses: COMPARISON_MISSES.compare_numbers },
    order: { answer: 'tap', judge: 'activity', flow: 'board',
      moves: 'taps the cards into the slots in order (tapping the last card placed takes it back), then presses Check',
      misses: COMPARISON_MISSES.order },
  },
  words: {
    job: 'compare two groups or two numbers, find one more or one less than a number, or put number cards in order',
    answer: 'their answer',
    question: 'the ask and the numbers on screen',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
