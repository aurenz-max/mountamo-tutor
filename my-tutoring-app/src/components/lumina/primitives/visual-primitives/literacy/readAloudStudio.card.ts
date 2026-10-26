/**
 * read-aloud-studio's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `readAloudStudio.boss.ts`.
 * Every scored item is one printed line read aloud and judged word for word against the print (never how it sounded).
 * accuracy is a cold read; dialogue hears the line in the character's voice first. expression runs three steps per line
 * (the scene's `kind`): a phrase plan the learner marks on the page (the activity commits it; any plan passes and it is
 * never scored), a first read, then a reread after the tutor models the groups; only the reread is scored.
 */
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong read shows (`lineReadingMisses`): a word read as another, a word left out, the idea said in other words. */
export type ReadAloudMiss = 'word_swap' | 'word_drop' | 'paraphrase';

export const READ_ALOUD_MISSES = {
  accuracy: ['word_swap', 'word_drop'],
  expression: ['word_swap', 'word_drop'],
  dialogue: ['word_swap', 'word_drop', 'paraphrase'],
} as const satisfies Record<string, readonly ReadAloudMiss[]>;

export const readAloudStudioCard = defineCard<ReadAloudMiss>({
  id: 'read-aloud-studio',
  grades: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
  modes: {
    // `unanswered` is the levers' own pinned list (`readAloudStudioLevers.test.ts`); expression's reads are answered.
    accuracy: { ...SPOKEN, misses: READ_ALOUD_MISSES.accuracy, unanswered: READ_ALOUD_MISSES.accuracy },
    expression: {
      steps: {
        mark: { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time',
          moves: 'taps between words to mark pauses, then taps "Use my phrase plan"; any plan passes and it is never scored' },
        first_read: SPOKEN,
        reread: SPOKEN,
      },
      misses: READ_ALOUD_MISSES.expression,
    },
    dialogue: { ...SPOKEN, misses: READ_ALOUD_MISSES.dialogue, unanswered: READ_ALOUD_MISSES.dialogue },
  },
  words: {
    job: 'read one printed line aloud at a time, every word in order',
    answer: 'the words they read',
    // Reading the print is the task, so the doctrine's "let the learner read it first" covers the cold reads; the asks
    // of dialogue and the expression reread carry their model, and the key says how it sounds is never graded.
    question: 'the instruction and the speaker\'s name',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
