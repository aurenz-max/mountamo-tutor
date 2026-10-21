/**
 * letter-workshop's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `letterWorkshop.boss.ts`.
 * Every mode is one letter written on the writing paper and checked by the paper itself (geometry, then on copy and
 * write the vision judge): one item at a time, activity-judged, a bespoke boss.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`letterWorkshopMiss`, `TeachingAttempt.miss`, handoff 20), from what the check read:
 * - the vision judge's confident reading (copy, write) when it is another letter: `wrong_case` (the target in the
 *   other case), `reversed` (its mirror: b/d, p/q), `other_letter`;
 * - geometry otherwise, the first failing measure the paper's tip is about: `stroke_count` (more or fewer strokes
 *   than the letter has), `start_or_order` (a stroke starts away from its start), `part_left_out` (part of the
 *   letter is not drawn), `extra_ink` (marks off the letter), `direction_or_shape` (on the letter, the wrong way
 *   or the wrong size).
 */
export type LetterWorkshopMiss = 'other_letter' | 'reversed' | 'wrong_case'
  | 'stroke_count' | 'start_or_order' | 'part_left_out' | 'extra_ink' | 'direction_or_shape';

export const GEOMETRY_MISSES: readonly LetterWorkshopMiss[] = ['stroke_count', 'start_or_order', 'part_left_out', 'extra_ink', 'direction_or_shape'];
export const READING_MISSES: readonly LetterWorkshopMiss[] = ['other_letter', 'reversed', 'wrong_case'];
/** A mode's misses: trace is geometry alone; copy and write also read the vision judge. */
export const LETTER_WORKSHOP_MISSES_BY_MODE: Readonly<Record<'trace' | 'copy' | 'write', readonly LetterWorkshopMiss[]>> = {
  trace: GEOMETRY_MISSES,
  copy: [...READING_MISSES, ...GEOMETRY_MISSES],
  write: [...READING_MISSES, ...GEOMETRY_MISSES],
};

const WRITTEN = { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time' } as const;

export const letterWorkshopCard = defineCard<LetterWorkshopMiss>({
  id: 'letter-workshop',
  grades: ['Kindergarten', 'Grade 1'],
  // Every mode publishes levers (`letterWorkshopLevers.ts`).
  modes: {
    trace: { ...WRITTEN, misses: LETTER_WORKSHOP_MISSES_BY_MODE.trace,
      moves: 'draws over the dotted letter on the writing paper with a finger, pen or mouse (Clear wipes it), then presses Check my tracing' },
    copy: { ...WRITTEN, misses: LETTER_WORKSHOP_MISSES_BY_MODE.copy,
      moves: 'writes the letter on the writing paper beside the model (Clear wipes it), then presses Check my writing' },
    write: { ...WRITTEN, misses: LETTER_WORKSHOP_MISSES_BY_MODE.write,
      moves: 'writes the letter on the blank writing paper (Clear wipes it), then presses Check my writing' },
  },
  words: {
    job: 'form letters by hand: trace a dotted letter, copy a letter from the model beside the paper, or write a '
      + 'letter from its name, which you say',
    answer: 'the shape of the letter they write and how its strokes go',
    question: 'the instruction and the letter and case it names (said by its NAME, never its sound or a word that starts with it)',
  },
  levers: true,
});
