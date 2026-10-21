/**
 * paragraph-architect's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `paragraphArchitect.boss.ts`.
 * The writing modes (informational, narrative, opinion) write a paragraph one typed sentence per step; code checks the
 * sentence's shape and the shared writing judge checks it makes sense and does its step's job (`writingStages.ts`).
 * build_paragraph orders sentence cards into a paragraph, checked in code from the cards' roles (`paragraphBuild.ts`).
 * Every item is checked by the activity: a bespoke boss.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong writing step shows (`writingShapeMiss`, then the judge's verdict): `too_short` (under three words),
 * `blank_left` (a starter's blank not filled), `repeat` (a sentence already written), `not_sense`, `wrong_job` (the
 * sentence does a different step's job). Shared with opinion-builder's OREO and CER steps.
 */
export type WritingMiss = 'too_short' | 'blank_left' | 'repeat' | 'not_sense' | 'wrong_job';
export const WRITING_MISSES: readonly WritingMiss[] = ['too_short', 'blank_left', 'repeat', 'not_sense', 'wrong_job'];

/** What a wrong paragraph build shows (`paragraphMiss`), the first that applies. */
export type ParagraphMiss = 'topic_not_first' | 'closing_not_last' | 'too_few_details' | 'off_topic_detail';
export const PARAGRAPH_MISSES: readonly ParagraphMiss[] = ['topic_not_first', 'closing_not_last', 'too_few_details', 'off_topic_detail'];

/** A writing step's wiring, shared with opinion-builder's OREO and CER. */
export const WRITE = {
  answer: 'type', judge: 'activity', flow: 'one-at-a-time',
  moves: 'types one sentence for this step in the box (tapping a shown sentence starter puts it in the box to finish), '
    + 'then presses "I\'m done!"',
  misses: WRITING_MISSES,
  // The box keeps the sentence and the check's words say what to change.
  unanswered: ['blank_left', 'repeat'],
} as const;

export const paragraphArchitectCard = defineCard<WritingMiss | ParagraphMiss>({
  id: 'paragraph-architect',
  grades: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
  // Every mode publishes levers (`paragraphArchitectLevers.ts`).
  modes: {
    informational: WRITE,
    narrative: WRITE,
    opinion: WRITE,
    build_paragraph: { answer: 'build', judge: 'activity', flow: 'board', misses: PARAGRAPH_MISSES,
      moves: 'taps sentence cards into the paragraph in order (tapping a placed card takes it back), then presses '
        + '"I\'m done!"' },
  },
  words: {
    job: 'write a paragraph one sentence per step (a topic sentence, facts and a closing; a story\'s beginning, middle '
      + 'and end; or an opinion, reasons and the opinion again), or build an informative paragraph from sentence cards',
    answer: 'the learner\'s sentence or paragraph',
    question: 'the step\'s instruction, the topic, the sentence starters and every sentence card',
  },
  levers: true,
});
