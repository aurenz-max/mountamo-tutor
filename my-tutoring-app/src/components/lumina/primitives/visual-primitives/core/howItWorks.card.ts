/**
 * how-it-works's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `howItWorks.boss.ts`.
 * The learner first reads a process (steps, or pictures for a pre-reader), then answers questions code builds from the
 * steps' order. A question whose answer is a step's name (which step a description tells of; what happens next) is
 * said (the tutor judges the words against the key) or tapped and checked (the activity checks it), so every mode is
 * SAY_OR_SHOW. Putting the step cards in order (sequence) and choosing what a step makes possible (explain, in predict)
 * have no key: the activity checks them, item by item inside those modes.
 */
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`TeachingAttempt.miss`), from the work the check reads, by item kind. The same ids name a
 * spoken item's known wrong answers.
 * - identify, explain: `neighbour_step` (the step just before or after), `far_step`;
 * - predict: `skipped_ahead` (a later step, not the next), `went_back` (a step already shown);
 * - sequence: `adjacent_swap`, `reversed`, `one_moved`, `two_swapped`, `mixed_order`.
 */
export type ChoiceMiss = 'neighbour_step' | 'far_step';
export type NextMiss = 'skipped_ahead' | 'went_back';
export type OrderMiss = 'adjacent_swap' | 'reversed' | 'one_moved' | 'two_swapped' | 'mixed_order';
export type HowMiss = ChoiceMiss | NextMiss | OrderMiss;
export const CHOICE_MISSES = ['neighbour_step', 'far_step'] as const satisfies readonly ChoiceMiss[];
export const NEXT_MISSES = ['skipped_ahead', 'went_back'] as const satisfies readonly NextMiss[];
export const ORDER_MISSES = ['adjacent_swap', 'reversed', 'one_moved', 'two_swapped', 'mixed_order'] as const satisfies readonly OrderMiss[];

const PICK = 'may instead tap a choice, then press Check Answer (a picture choice checks itself)';

export const howItWorksCard = defineCard<HowMiss>({
  id: 'how-it-works',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  modes: {
    guided: { ...SAY_OR_SHOW, moves: PICK, misses: CHOICE_MISSES },
    sequence: { ...SAY_OR_SHOW, moves: `${PICK}; on a card-order item, taps the cards into the numbered slots, first to last, `
      + 'then presses Check Answer (picture cards check themselves when every slot is full)', misses: [...ORDER_MISSES, ...CHOICE_MISSES] },
    predict: { ...SAY_OR_SHOW, moves: `${PICK}; on a why-it-matters item, only taps a choice and presses Check Answer`,
      misses: [...NEXT_MISSES, ...CHOICE_MISSES] },
  },
  words: {
    job: 'read how a process works, step by step, then answer questions about its steps and their order',
    answer: 'their answer',
    question: 'the printed question and the choices or cards',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
