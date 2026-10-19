/**
 * You & Me's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `youAndMe.boss.ts`.
 * Every turn is one spoken sentence, judged by the tutor on who its subject points at from the speaking role, so the
 * boss is the spoken preset.
 */
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong spoken sentence shows (`youAndMeSpokenMisses`, handoff 20 Part B): which word stands as the subject. */
export const YOU_AND_ME_MISSES = ['swapped_pronoun', 'said_name', 'said_he_she'] as const;
export type SpokenYouAndMeMiss = typeof YOU_AND_ME_MISSES[number];

// Each miss is answered by a lever the tier withdrew (`youAndMeLevers.ts`); an easy item shows both aids and has none.
const TURN = { ...SPOKEN, misses: YOU_AND_ME_MISSES } as const;

export const youAndMeCard = defineCard<SpokenYouAndMeMiss>({
  id: 'you-and-me',
  grades: ['Kindergarten', 'Grade 1'],
  modes: {
    describe_action: TURN,
    describe_independent_action: TURN,
  },
  words: {
    job: 'play the named speaking partner and tell the listening partner what happened, with a subject word that '
      + 'points at the one who did it from that role, and on independent actions a self word for that same person',
    answer: 'the spoken sentence',
    question: 'the scene sentence and the directions',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
