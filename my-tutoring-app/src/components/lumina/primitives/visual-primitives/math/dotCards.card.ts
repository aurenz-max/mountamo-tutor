/**
 * dot-cards' card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `dotCards.boss.ts`.
 * The answer is one number: the learner says it (the tutor judges the words against the key) or taps it on the 1-10
 * pad (the activity checks the tap), so the mode is SAY_OR_SHOW.
 */
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/**
 * What a wrong total shows (`dotCardsMiss` on a tap, the spoken misses by the same ids): `one_group` (the size of one
 * colored group, as if the other was not there), then how far off it is.
 */
export type DotCardsMiss = 'one_group' | 'one_short' | 'one_over' | 'short_by_more' | 'over_by_more';
export const DOT_CARDS_MISSES: readonly DotCardsMiss[] = ['one_group', 'one_short', 'one_over', 'short_by_more', 'over_by_more'];

export const dotCardsCard = defineCard<DotCardsMiss>({
  id: 'dot-cards',
  grades: ['Kindergarten', 'Grade 1'],
  modes: {
    quick_total: { ...SAY_OR_SHOW,
      moves: 'flips the card for one quick look, then may instead tap the total on the 1 to 10 number pad',
      // Born without levers: Try again's one new look is the only help until /add-support-tiers builds them
      // (count together, a longer look, one group at a time).
      misses: DOT_CARDS_MISSES, unanswered: DOT_CARDS_MISSES },
  },
  words: {
    job: 'take one quick look at a dot card with two colored groups and tell how many dots altogether, seeing the '
      + 'groups at a glance instead of counting one by one',
    answer: 'the total',
    question: 'the instruction and the card\'s two colors and how its dots are arranged',
  },
  audio: SPOKEN_AUDIO,
});
