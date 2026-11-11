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
      misses: ['wrong_choice', 'misplaced', 'out_of_order', 'off_goal'],
      moves: 'taps one card to choose it, or a card then a box to sort it, or cards into numbered boxes in order, or pieces onto a tray, or marks on a picture to change it; then Check',
    },
  },
  words: {
    job: 'answer a short item built for this lesson: choose a card, sort the cards into boxes, put the cards in order, put pieces on a tray to meet a goal, or change a picture (cut a shape, move a clock\'s hands) until it is right, then press Check',
    answer: 'the cards as the learner chose, sorted or ordered them, the pieces on the tray, or the picture as the learner left it',
    question: 'the prompt, what is shown above the cards (a picture, a graph, a number line, a table or a short text), and the cards',
    special: 'Short sentences, everyday words. Read the prompt and any short text aloud. Describe what the picture or graph shows '
      + 'without saying which card is right. After a miss, say the hint shown and invite one more look. On a tray item or a picture the learner changes, more than one answer is right: never name the pieces to use or where to cut.',
  },
});
