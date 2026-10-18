/**
 * Word problem setup's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `diWordProblemSetup.boss.ts`.
 * The first stepped card: an item is one STEP of a story, and the steps are wired differently. Saying the kind, the
 * family, the operation and the answer is spoken and tutor-judged; placing the story parts is hands-on and the
 * activity checks the big slot. The step names are the scene's `kind`.
 */
import type { SpokenWordProblemMiss, WordProblemMiss } from './diWordProblemWorkspace';
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

const OFF_BY = ['one_short', 'one_over', 'short_by_more', 'over_by_more'] as const;
const PLACE = ['box_in_big', 'printed_small_in_big'] as const;
const BUILD = { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time',
  moves: 'puts the three story-part cards into small + small = big' } as const;

export const diWordProblemSetupCard = defineCard<WordProblemMiss | SpokenWordProblemMiss>({
  id: 'di-word-problem-setup',
  grades: ['Grade 1', 'Grade 2', 'Grade 3'],
  // The activity's own check of the big slot (`wordProblemMiss`), then the spoken steps' known wrong answers
  // (`wordProblemSpokenMisses`), named by the `spoken_miss` observer.
  modes: {
    find_big_number: {
      steps: {
        big_number: { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time',
          moves: 'drags or taps a story-part card into the big-amount box' },
        solve: SPOKEN,
      },
      misses: [...PLACE, 'wrong_way', 'said_story_number', ...OFF_BY],
    },
    build_family: {
      steps: { big_number: BUILD, family: SPOKEN, operation: SPOKEN, solve: SPOKEN },
      misses: [...PLACE, 'big_in_small_slot', 'subtraction_sentence', 'opposite_operation', 'wrong_way', 'said_story_number', ...OFF_BY],
    },
    classify_and_build: {
      steps: { classify: SPOKEN, big_number: BUILD, family: SPOKEN, operation: SPOKEN, solve: SPOKEN },
      misses: ['signature_kind', 'other_kind', ...PLACE, 'big_in_small_slot', 'subtraction_sentence', 'opposite_operation',
        'wrong_way', 'said_story_number', ...OFF_BY],
    },
  },
  words: {
    job: 'set up the printed story and solve it: name its kind, place the story parts, read the number family, '
      + 'choose add or subtract, then say the answer',
    answer: 'the step\'s answer',
    question: 'the printed story and the ask',
    special: 'Never say which part is the big amount or where a part belongs before the learner tries. The family '
      + 'decides the operation, not the story\'s words. Nothing the learner must say is printed before it is credited.',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
