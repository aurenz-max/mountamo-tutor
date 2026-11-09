/**
 * practice-studio's card: how it is wired to the live tutor (`components/live-activity/boss.ts`). The catalog reads it;
 * the behavior is `practiceStudio.boss.ts`. One mode (USER 2026-11-08: a general agent primitive, mixed only): the
 * author agent picks each item's answer surface (choose, categorize, order) and its displays, and the activity's own
 * check judges every tap, so no key reaches the tutor.
 */
import { defineCard, TAP_ONE } from '../../../../components/live-activity/boss';
import type { SurfaceMiss } from '../../../../service/agent-kit/surfaces';

export const PRACTICE_MODES = ['practice'] as const;
export type PracticeStudioMode = typeof PRACTICE_MODES[number];

export const practiceStudioCard = defineCard<SurfaceMiss>({
  id: 'practice-studio',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  // Levers: every item carries its own help and simplify levers, authored with it (`service/agent-kit/levers.ts`).
  levers: true,
  modes: {
    practice: {
      ...TAP_ONE,
      // The kit's surface misses (`SURFACE_MISSES` in `service/agent-kit/surfaces.ts`); a card holds facts only.
      misses: ['wrong_choice', 'misplaced', 'out_of_order'],
      moves: 'taps one card to choose it, or a card then a box to sort it, or cards into numbered boxes in order; then Check',
    },
  },
  words: {
    job: 'answer a short item built for this lesson: choose a card, sort the cards into boxes, or put the cards in order, then press Check',
    answer: 'the cards as the learner chose, sorted or ordered them',
    question: 'the prompt, what is shown above the cards (a picture, a graph, a number line, a table or a short text), and the cards',
    special: 'Short sentences, everyday words. Read the prompt and any short text aloud. Describe what the picture or graph shows '
      + 'without saying which card is right. After a miss, say the hint shown and invite one more look.',
  },
});
