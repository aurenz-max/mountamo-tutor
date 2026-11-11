/**
 * Sorting station's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `sortingStation.boss.ts`.
 * Every mode is one spoken answer the tutor judges against the key, so the boss is the spoken preset. say_rule's
 * answer is one word the child may also tap (a rule chip, or the card in the wrong group), which the activity checks
 * (USER 10-13, voice beside the tap), so it is SAY_OR_SHOW.
 */
import type { SpokenSortingMiss } from './sortingStationDomain';
import { defineCard, OFF_BY, SAY_OR_SHOW, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

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
    say_rule: { ...SAY_OR_SHOW, moves: 'may instead tap a rule on screen, or tap the card in the wrong group',
      misses: ['other_group_rule', 'partial_rule', 'said_card', 'belonging_card', 'said_all_belong'] },
  },
  words: {
    job: 'say which group a picture card belongs with, how to sort the cards, which card does not belong, how many '
      + 'are in a group, which group has more, whether one card matches two things, or why the cards of a finished sort '
      + 'go together',
    answer: 'the answer',
    question: 'the ask',
    special: 'At Kindergarten the tray labels are words a pre-reader cannot read, so the ask names the groups aloud. On a '
      + 'count or compare item the tray counts stay hidden until an answer is credited, because they are the answer. On a '
      + "say-the-rule item the trays have no names, because a tray's name is its rule; point at the ringed tray by its place.",
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
