/**
 * number-line's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `numberLine.boss.ts`.
 * Every mode is one item at a time, placed or built on the line and checked by the line's own code: points, jump
 * landings and an order are placed and then Check Answer; build_hops is an open build of the learner's own hops,
 * judged at "I'm done!". A build beside placements keeps it off the tap preset: a bespoke boss.
 */
import type { LineMiss } from './numberLineLevers';
import type { BuildHopsMiss } from './numberLineBuildHops';
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`TeachingAttempt.miss`), from the same work the check reads:
 * - jump (`jumpMiss`): `one_short` / `one_past` one hop before or beyond the landing, `off_by_more`, `wrong_direction`
 *   (the other side of the start, or on it), `second_jump_off` (the first landing right, the second not), `no_landing`;
 * - identify, plot (`plotMiss`): `one_short`, `one_past`, `off_by_more`, on the snap grid from the target;
 * - order (`orderMiss`): `reversed` (largest to smallest), `out_of_order`;
 * - between (`betweenMiss`): `on_end` (on a given number), `outside`, `wrong_inside` (an exact missing number missed
 *   inside the pair; only a fraction or decimal grid has room for it);
 * - build_hops (`buildHopsMiss`): the landing as the jump's, `other_hop_count`, `same_way_again`.
 */
export type NumberLineMiss = LineMiss | BuildHopsMiss;
export type NumberLineMode = 'identify' | 'plot' | 'jump' | 'build_hops' | 'order' | 'between';

const POINT: readonly NumberLineMiss[] = ['one_short', 'one_past', 'off_by_more'];
export const NUMBER_LINE_MISSES_BY_MODE: Record<NumberLineMode, readonly NumberLineMiss[]> = {
  identify: POINT,
  plot: POINT,
  jump: [...POINT, 'wrong_direction', 'second_jump_off', 'no_landing'],
  build_hops: [...POINT, 'other_hop_count', 'same_way_again'],
  order: ['reversed', 'out_of_order'],
  between: ['on_end', 'outside', 'wrong_inside'],
};

const PLACED = { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time' } as const;
const PLACE_POINT = 'taps the line to place a point (dragging the point moves it), then presses Check Answer';

export const numberLineCard = defineCard<NumberLineMiss>({
  id: 'number-line',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  // Every mode publishes levers (`NUMBER_LINE_LEVERS`, numberLineLevers.ts) on an integer line.
  modes: {
    identify: { ...PLACED, moves: PLACE_POINT, misses: NUMBER_LINE_MISSES_BY_MODE.identify },
    plot: { ...PLACED, moves: PLACE_POINT, misses: NUMBER_LINE_MISSES_BY_MODE.plot },
    jump: { ...PLACED, misses: NUMBER_LINE_MISSES_BY_MODE.jump,
      moves: 'taps the line where each jump lands, one landing for each jump in order, then presses Check Answer' },
    build_hops: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: NUMBER_LINE_MISSES_BY_MODE.build_hops,
      moves: 'taps hop buttons (Hop 1 to Hop 10) to hop from the start, each hop from where the last one landed, taps a '
        + 'landing dot to take that hop off, and presses I\'m done!; after a right first way they make the same number a '
        + 'different way',
      // The right number in fewer or more hops than asked: the ask names the count, and no hop-slot picture is built.
      unanswered: ['other_hop_count'] },
    order: { ...PLACED, misses: NUMBER_LINE_MISSES_BY_MODE.order,
      moves: 'taps a number, then taps its place on the line, for every number, then presses Check Answer' },
    between: { ...PLACED, misses: NUMBER_LINE_MISSES_BY_MODE.between,
      moves: 'taps the line to place one point, then presses Check Answer',
      // Inside the pair but not the exact missing number: only on a fraction or decimal grid, which has no levers.
      unanswered: ['wrong_inside'] },
  },
  words: {
    job: 'place numbers on a number line: find a number, show a jump that adds or takes away, put numbers in order, '
      + 'find a number between two others, or build hops of their own that land on a number',
    answer: 'the points, landings or hops they place',
    question: 'the instruction, the numbers it names, and the labels under the line',
  },
  levers: true,
});
