/**
 * opinion-builder's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `opinionBuilder.boss.ts`.
 * OREO and CER write an answer to an opinion question one typed sentence per step; code checks the sentence's shape and
 * the shared writing judge checks it makes sense and does its step's job (`writingStages.ts`, shared with
 * paragraph-architect). build_opinion orders cards for either side into an OREO answer, checked in code from the cards'
 * roles and sides (`opinionBuild.ts`). Every item is checked by the activity: a bespoke boss.
 */
import { defineCard } from '../../../components/live-activity/boss';
import { WRITE, type WritingMiss } from './paragraphArchitect.card';

/** What a wrong opinion build shows (`opinionMiss`), the first that applies. */
export type OpinionMiss = 'opinion_not_first' | 'restate_not_last' | 'no_reason' | 'no_example' | 'other_side' | 'off_topic' | 'out_of_order';
export const OPINION_MISSES: readonly OpinionMiss[] = ['opinion_not_first', 'restate_not_last', 'no_reason', 'no_example', 'other_side', 'off_topic', 'out_of_order'];

export const opinionBuilderCard = defineCard<WritingMiss | OpinionMiss>({
  id: 'opinion-builder',
  grades: ['Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
  // Every mode publishes levers (`opinionBuilderLevers.ts`).
  modes: {
    oreo: WRITE,
    cer: WRITE,
    build_opinion: { answer: 'build', judge: 'activity', flow: 'board', misses: OPINION_MISSES,
      moves: 'taps cards into the answer in order (tapping a placed card takes it back), then presses "I\'m done!"' },
  },
  words: {
    job: 'answer an opinion question on the side they pick, one typed sentence per step (an opinion, a reason, an '
      + 'example and the opinion again; or a claim, evidence, reasoning and a conclusion), or build that answer from cards '
      + 'for either side',
    answer: 'the learner\'s sentence or answer',
    question: 'the question, the step\'s instruction, the sentence starters and every card',
  },
  levers: true,
});
