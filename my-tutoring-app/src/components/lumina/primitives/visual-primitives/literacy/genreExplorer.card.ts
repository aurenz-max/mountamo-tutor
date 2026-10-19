/**
 * genre-explorer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `genreExplorer.boss.ts`.
 * Every item is one spoken answer (yes or no, which text, or the kind of writing) the tutor judges against the key,
 * so the boss is the spoken preset.
 */
import type { SpokenGenreMiss } from './genreExplorerDomain';
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

export const genreExplorerCard = defineCard<SpokenGenreMiss>({
  id: 'genre-explorer',
  grades: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
  // Each item's known wrong answers (`genreSpokenMisses`), per mode only the misses its actions can show:
  // identify_basic has no pick-excerpt and a two-kind menu; compare_genres has no yes-or-no step.
  modes: {
    identify_basic: { ...SPOKEN, misses: ['opposite_verdict', 'said_feature_back', 'close_relative'] },
    classify_genre: { ...SPOKEN, misses: ['opposite_verdict', 'said_feature_back', 'close_relative', 'other_genre', 'said_broad_kind'] },
    compare_genres: { ...SPOKEN, misses: ['other_text', 'said_both', 'close_relative', 'other_genre', 'said_broad_kind'] },
  },
  words: {
    job: 'say yes or no about what is in a short text, which of two texts something is true of, or what kind of '
      + 'writing a text is from the printed menu',
    answer: 'the spoken answer',
    question: 'the texts and the ask',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
