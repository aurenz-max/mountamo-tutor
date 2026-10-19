/**
 * era-explorer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `eraExplorer.boss.ts`.
 * Every item is one spoken pick from three choices the ask names aloud, judged by the tutor against the key, so the
 * boss is the spoken preset.
 */
import type { SpokenEraMiss } from './eraExplorerDomain';
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

export const eraExplorerCard = defineCard<SpokenEraMiss>({
  id: 'era-explorer',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
  // Each item's known wrong picks (`eraSpokenMisses`), per mode: each other choice named for what it is, "today" on a
  // compare item (not a choice there), a thing from the sentence instead of a lens, what changed instead of why.
  modes: {
    lens_id: { ...SPOKEN, misses: ['other_lens', 'named_a_thing'] },
    era_sort: { ...SPOKEN, misses: ['said_back_then', 'said_today', 'said_both'] },
    era_compare: { ...SPOKEN, misses: ['said_earlier', 'said_later', 'said_both', 'said_today'] },
    cause_of_change: { ...SPOKEN, misses: ['other_cause', 'said_what_changed'] },
  },
  words: {
    job: 'hear a detail about life in one era and say which of the three choices the ask names fits it: which lens it '
      + 'came from, when life looked like that, which of two past times it belongs to, or why life changed',
    answer: 'the choice the learner says',
    question: 'the detail and the three choices',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
