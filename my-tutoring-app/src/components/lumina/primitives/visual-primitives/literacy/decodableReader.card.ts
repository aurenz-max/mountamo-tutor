/**
 * Decodable reader's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `decodableReader.boss.ts`.
 * Every item is spoken (a printed line read aloud, one word from the story, or which printed choice is right), and the
 * tutor judges it against the key, so the boss is the spoken preset.
 */
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** The misses a spoken answer names, per mode (`decodableSpokenMisses`; a choice question names none yet). */
export const DECODABLE_MISSES = {
  literal: ['word_swap', 'word_skip', 'lifted_word', 'retell'],
  sequence: ['word_swap', 'word_skip', 'other_choice', 'retell'],
  inference: ['word_swap', 'word_skip', 'other_choice', 'retell'],
  main_idea: ['word_swap', 'word_skip', 'other_choice', 'retell'],
  read_along: ['lifted_word', 'retell'],
} as const;
export type DecodableMiss = typeof DECODABLE_MISSES[keyof typeof DECODABLE_MISSES][number];

// No lever for a retell on a decoded story or for another choice, by decision: fewer choices on the same question
// repeats it, and a new question would spend a later item (decodableReaderLevers.ts).
const CHOICE_MODE = { ...SPOKEN, misses: DECODABLE_MISSES.sequence, unanswered: ['other_choice', 'retell'] } as const;

export const decodableReaderCard = defineCard<DecodableMiss>({
  id: 'decodable-reader',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    read_along: { ...SPOKEN, misses: DECODABLE_MISSES.read_along },
    literal: { ...SPOKEN, misses: DECODABLE_MISSES.literal, unanswered: ['retell'] },
    sequence: CHOICE_MODE,
    inference: CHOICE_MODE,
    main_idea: CHOICE_MODE,
  },
  words: {
    job: 'read each printed story line aloud, then answer questions about the story with one word from it or by saying '
      + 'which printed choice is right',
    answer: 'the read or the answer',
    question: 'the question and its choices',
    special: 'A read line is read cold: never read it or any word of it before the learner has tried; after a try you '
      + 'may model it. In read-along the learner cannot read yet: read the whole story aloud, exactly as printed, before '
      + 'its first question, and again if asked. Say that again asks you for the question only.',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
