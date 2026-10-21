/**
 * number-bond's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `numberBond.boss.ts`.
 * Every mode is stepped, and the step names are the scene's `kind`: the learner splits the counters (`split`), moves
 * the coloured groups (`move`) or builds an equation (`equation`) and the board checks it; or says one number about
 * the bond on screen (`say`), which the tutor judges against the key.
 */
import type { OffByMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { defineCard, OFF_BY, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/**
 * What a wrong split, move or equation shows (`bondMiss`), from the same work the check reads:
 * - split: `not_all_placed` (counters left in the whole), `same_way_again` (a decompose pair already made),
 *   `ten_one_off` (ten_and_ones: a part of nine or eleven), `no_full_ten` (neither part is ten, nor one off);
 * - move: `other_move` (a complete whole-group move, not the one asked for);
 * - equation: `unfinished_equation`, `false_equation` (does not add up), `other_numbers` (numbers not from
 *   this bond), `other_fact` (a true fact of this bond that does not record the move made).
 */
export type BondMiss = 'not_all_placed' | 'same_way_again' | 'ten_one_off' | 'no_full_ten' | 'other_move'
  | 'unfinished_equation' | 'false_equation' | 'other_numbers' | 'other_fact';

/** What a wrong spoken number shows (`numberBondSpokenMisses`): the bond's own numbers first, then the off-by misses. */
export type SpokenBondMiss = OffByMiss | 'said_ten' | 'said_whole' | 'said_given_part' | 'said_change' | 'added_both';

export type NumberBondMiss = BondMiss | SpokenBondMiss;

/** The board's own check on the split, move and equation steps, and the say steps' known wrong answers, by mode. */
export const NUMBER_BOND_MISSES = {
  decompose: ['same_way_again', 'not_all_placed', 'said_given_part', 'said_whole', ...OFF_BY],
  ten_and_ones: ['ten_one_off', 'no_full_ten', 'not_all_placed', 'said_ten', 'said_whole', ...OFF_BY],
  missing_part: ['said_given_part', 'said_whole', 'added_both', ...OFF_BY],
  related_fact: ['other_move', 'said_given_part', 'said_change', 'said_whole', 'added_both', ...OFF_BY],
  build_equation: ['other_move', 'unfinished_equation', 'false_equation', 'other_numbers', 'other_fact'],
  fact_family: ['other_move', 'unfinished_equation', 'false_equation', 'other_numbers', 'other_fact'],
} as const satisfies Record<string, readonly NumberBondMiss[]>;

const SPLIT = { answer: 'build', judge: 'activity', flow: 'one-at-a-time',
  moves: 'taps a counter, then the whole or the part it goes to, or drags it there (Undo and Bring back together take '
    + 'moves back); the board checks the split once every counter is in a part and the learner stops' } as const;
const MOVE = { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time',
  moves: 'presses the move button the ask names, or moves the coloured groups by hand; the board checks the move once '
    + 'the learner stops' } as const;
const EQUATION = { answer: 'build', judge: 'activity', flow: 'one-at-a-time',
  moves: 'taps number and sign tiles, or types into the box, to build a number sentence for the move on the board; '
    + 'the board checks it once the learner stops' } as const;

export const numberBondCard = defineCard<NumberBondMiss>({
  id: 'number-bond',
  grades: ['Kindergarten', 'Grade 1'],
  modes: {
    // A split commits only once the parts make the whole, so `not_all_placed` is never committed there (contract).
    decompose: { steps: { split: SPLIT, say: SPOKEN }, misses: NUMBER_BOND_MISSES.decompose, unanswered: ['not_all_placed'] },
    ten_and_ones: { steps: { split: SPLIT, say: SPOKEN }, misses: NUMBER_BOND_MISSES.ten_and_ones,
      unanswered: ['not_all_placed'] },
    missing_part: { steps: { say: { ...SPOKEN, moves: 'may press Use counters and set the known part aside before answering' } },
      misses: NUMBER_BOND_MISSES.missing_part },
    related_fact: { steps: { move: MOVE, say: SPOKEN }, misses: NUMBER_BOND_MISSES.related_fact },
    // The model step is the learner's free choice among join and the two take-aways; its only wrong move (a swap) is
    // not offered, so no lever answers `other_move` there.
    build_equation: { steps: { move: { ...MOVE, moves: 'chooses Join the groups, Take away red or Take away blue; the '
      + 'board checks the move once the learner stops' }, equation: EQUATION },
    misses: NUMBER_BOND_MISSES.build_equation, unanswered: ['other_move'] },
    fact_family: { steps: { move: MOVE, equation: EQUATION }, misses: NUMBER_BOND_MISSES.fact_family },
  },
  words: {
    job: 'split a number into two parts with counters, or into a ten and some ones, then say how many are in one part; '
      + 'say the covered part of a number bond; join two groups and take one away, saying each missing number; or move '
      + 'the groups and build the number sentence that shows the move',
    answer: 'their answer',
    question: 'the ask and the bond on screen',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
