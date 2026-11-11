/**
 * deep-dive's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `deepDive.boss.ts`.
 * The items are the dive's graded blocks, one at a time in lesson order. A choice the learner can say is SAY_OR_SHOW
 * (said and judged by the tutor, or tapped and checked by the block); a sort, an order, a labeling, a lab or a choice
 * that cannot be said has no key and is only answered on screen. The modes differ in which blocks the generator makes
 * graded (explore: a few easy choices; analyze: sorts, orders and pattern questions too), not in how an item is wired.
 */
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`TeachingAttempt.miss`), by how the item is answered:
 * - `wrong_choice`: another of the choices;
 * - `out_of_order`: the timeline's events in the wrong order;
 * - `wrong_side`: a statement sorted under the other heading;
 * - `misplaced_label`: a diagram label on the wrong part;
 * - `wrong_role`: a lab factor in the wrong zone;
 * - `off_goal`: a set of pieces, or a changed picture, that does not meet the goal the check gives.
 * A check on a kit surface uses these too: a tapped part or a card is `wrong_choice`, a sort is `wrong_side`.
 */
export type DeepDiveMiss = 'wrong_choice' | 'out_of_order' | 'wrong_side' | 'misplaced_label' | 'wrong_role' | 'off_goal';
export const DEEP_DIVE_MISSES = ['wrong_choice', 'out_of_order', 'wrong_side', 'misplaced_label', 'wrong_role', 'off_goal'] as const satisfies readonly DeepDiveMiss[];

const MOVES = 'may instead tap a choice and press Check; a sort, an order, a diagram\'s labels, a lab, a tap on a picture, a set of pieces, a picture to change, or a choice that cannot be said is answered only on screen';
/** No in-item levers yet (`/add-support-tiers` designs them); every miss is answered by the tutor's own help. */
const mode = { ...SAY_OR_SHOW, moves: MOVES, misses: DEEP_DIVE_MISSES, unanswered: DEEP_DIVE_MISSES };

export const deepDiveCard = defineCard<DeepDiveMiss>({
  id: 'deep-dive',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  modes: { explore: mode, recall: mode, apply: mode, analyze: mode },
  words: {
    job: 'go through the sections of a deep dive with you, one at a time, and answer the check that follows them',
    answer: 'their choice',
    question: 'the check on screen and its choices',
    special: 'Before each check the lesson stops on each section in turn. While facts.stage names a teaching section, you '
      + 'teach it as facts.howToTeach says, no tool is offered and none is needed, and the learner taps Next to go on.',
  },
  audio: SPOKEN_AUDIO,
});
