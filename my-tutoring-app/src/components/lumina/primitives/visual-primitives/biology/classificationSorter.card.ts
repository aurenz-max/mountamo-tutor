/**
 * The classification sorter's card: how its mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `classificationSorter.boss.ts`.
 */
import type { SortMiss } from './classificationSorterWorkspace';
import { defineCard, TAP_ONE } from '../../../components/live-activity/boss';

/** What a wrong placement shows (`sortMiss`). */
export const SORT_MISSES: readonly SortMiss[] = ['repeated_group', 'parent_group', 'sibling_group', 'wrong_group'];

export const classificationSorterCard = defineCard<SortMiss>({
  id: 'classification-sorter',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  modes: {
    sort: { ...TAP_ONE, misses: SORT_MISSES },
  },
  words: {
    job: 'tap the group each card belongs in, one card at a time',
    answer: 'which group a card goes in',
    question: 'the sorting rule, the group names and the card’s name',
    special: 'When the rule is a feature a thing has or lacks, whether the card’s thing has it is the deciding fact. '
      + 'Some cards are tricky on purpose (a bat, a penguin): steer the learner to the rule, not to how the thing looks.',
  },
  levers: true,
});
