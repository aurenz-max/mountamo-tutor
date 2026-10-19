/**
 * states-of-matter's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `statesOfMatter.boss.ts`.
 * Every item is one spoken answer computed from the substance table, judged by the tutor against the key, so the boss
 * is the spoken preset.
 */
import type { SpokenStatesMiss } from './statesOfMatterDomain';
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

export const statesOfMatterCard = defineCard<SpokenStatesMiss>({
  id: 'states-of-matter',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  // Each item's known wrong answers (`statesSpokenMisses`), named by the `spoken_miss` observer.
  modes: {
    observe: { ...SPOKEN, misses: ['other_state', 'said_substance_back'] },
    predict: { ...SPOKEN, misses: ['said_start_state', 'other_state', 'said_end_state', 'opposite_change'] },
    compare: { ...SPOKEN, misses: ['other_of_pair'] },
  },
  words: {
    job: 'say the state of a substance from its particles, the state it will reach or the change it goes through when it '
      + 'is heated or cooled, or which of two substances melts first or is still solid',
    answer: 'the spoken answer',
    question: 'the ask and the melting and boiling points in it',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
