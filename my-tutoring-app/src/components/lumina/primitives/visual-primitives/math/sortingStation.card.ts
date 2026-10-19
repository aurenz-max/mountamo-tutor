/**
 * Sorting station's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `sortingStation.boss.ts`.
 * Every mode is one spoken answer the tutor judges against the key, so the boss is the spoken preset.
 */
import type { SpokenSortingMiss } from './sortingStationDomain';
import { defineCard, OFF_BY, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

const SORT = ['said_object', 'other_group'] as const;

export const sortingStationCard = defineCard<SpokenSortingMiss>({
  id: 'sorting-station',
  grades: ['Kindergarten', 'Grade 1'],
  // Each item's known wrong answers (`sortingStationSpokenMisses`), named by the `spoken_miss` observer.
  modes: {
    sort_one: { ...SPOKEN, misses: SORT },
    sort_attribute: { ...SPOKEN, misses: ['other_rule', ...SORT] },
    sort_variety: { ...SPOKEN, misses: SORT },
    count_compare: { ...SPOKEN, misses: [...OFF_BY, 'other_group', 'said_same', 'bare_more'] },
    odd_one_out: { ...SPOKEN, misses: ['belonging_card', 'said_all_belong'] },
    two_attributes: { ...SPOKEN, misses: ['opposite_verdict', 'one_criterion_only'] },
    tally_record: { ...SPOKEN, misses: OFF_BY },
  },
  words: {
    job: 'say which group a picture card belongs with, how to sort the cards, which card does not belong, how many '
      + 'are in a group, which group has more, or whether one card matches two things',
    answer: 'the answer',
    question: 'the ask',
    special: 'At Kindergarten the tray labels are words a pre-reader cannot read, so the ask names the groups aloud. On a '
      + 'count or compare item the tray counts stay hidden until an answer is credited, because they are the answer.',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
