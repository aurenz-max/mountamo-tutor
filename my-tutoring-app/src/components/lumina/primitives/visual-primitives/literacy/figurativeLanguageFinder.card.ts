/**
 * figurative-language-finder's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `figurativeLanguageFinder.boss.ts`.
 * The four passage modes (sound devices, comparison, advanced, idiom) run two steps: `find` (tap a sentence of the
 * passage and the kind of figure in it; any figure passes, in any order, one per item, so never a board) and `meaning`
 * (type what a marked phrase really means). build_figurative's one step is `make` (write your own figure). The item's
 * kind names its step. Every item is checked by the activity: a tagged figure in code, everything else by the shared
 * writing judge (`figurativeSteps.ts`).
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`findVerdict`, `writtenShapeMiss`, then the judge's verdict). find: `wrong_type` (the
 * sentence holds a figure of another kind), `no_device` (the judge sees no figure of that kind), `already_found`.
 * meaning and make: `too_short`, `unchanged` (the phrase copied), `not_sense`, `wrong_job`.
 */
export type FigMiss = 'wrong_type' | 'no_device' | 'already_found' | 'too_short' | 'unchanged' | 'not_sense' | 'wrong_job';
export const FIND_MISSES: readonly FigMiss[] = ['wrong_type', 'no_device', 'already_found'];
export const MEANING_MISSES: readonly FigMiss[] = ['too_short', 'unchanged', 'not_sense', 'wrong_job'];
export const MAKE_MISSES: readonly FigMiss[] = ['too_short', 'not_sense', 'wrong_job'];

const passage = {
  steps: {
    find: { answer: 'tap', judge: 'activity', flow: 'one-at-a-time',
      moves: 'taps a sentence of the passage, then the kind of figure of speech in it, then presses "I\'m done!"' },
    meaning: { answer: 'type', judge: 'activity', flow: 'one-at-a-time',
      moves: 'types what the marked phrase really means in the box, then presses "I\'m done!"' },
  },
  misses: [...FIND_MISSES, ...MEANING_MISSES],
  // already_found and too_short need no lever: the check's words say what to do next.
  unanswered: ['already_found', 'too_short'],
} as const;

export const figurativeLanguageFinderCard = defineCard<FigMiss>({
  id: 'figurative-language-finder',
  grades: ['Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
  // Every step publishes levers (`figurativeLanguageFinderLevers.ts`).
  modes: {
    sound_devices: passage,
    comparison: passage,
    advanced: passage,
    idiom: passage,
    build_figurative: { steps: { make: { answer: 'build', judge: 'activity', flow: 'one-at-a-time',
      moves: 'types their own sentence with the asked figure about the subject in the box, then presses "I\'m done!"' } },
    misses: MAKE_MISSES },
  },
  words: {
    job: 'find a figure of speech in a passage and name its kind, say in plain words what a marked figure really '
      + 'means, or write their own figure (a simile, a metaphor, ...) about a subject',
    answer: 'the learner\'s pick or sentence',
    question: 'the task, the passage, the kinds on the buttons, the marked phrase and the subject',
  },
  levers: true,
});
