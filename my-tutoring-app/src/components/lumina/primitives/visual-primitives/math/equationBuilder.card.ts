/**
 * equation-builder's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `equationBuilder.boss.ts`.
 * Every challenge is one checked gesture: tiles built into a row (build-simple, rewrite, make-n), a number or True /
 * False tapped (missing-result, missing-operand, true-false) or a number typed (balance-both-sides), then the builder's
 * own Check. Bespoke: the build and typed modes are not one tap.
 */
import { TAP_ONE, defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong Check shows (`equationBuilderMiss`, `TeachingAttempt.miss`, handoff 20), from the same work the check reads:
 * - tiles (build, rewrite): `unfinished_equation` (not two sides around one =), `false_equation` (the sides
 *   differ), `other_operation` (true, the target's numbers with the other sign), `other_numbers` (true, other
 *   numbers); rewrite also `same_as_printed` (the printed equation again) and `other_form` (true, the printed
 *   numbers, not a form this item accepts);
 * - a number (missing-value, balance): `printed_number` (one already in the equation), `sum_of_printed`
 *   (missing-value: the printed numbers added), `other_side_total` (balance: the value of the side with no ?),
 *   then `one_short` / `one_over` / `short_by_more` / `over_by_more`;
 * - true-false: `said_true` (True for a false equation), `said_false`;
 * - make-n: `bare_number` (one number tile, no sign), `unfinished_sentence` (not number, sign, number...), then the
 *   sentence's value against the total (`one_short` / `one_over` / `short_by_more` / `over_by_more`), and on a two-way
 *   item `same_way` (the numbers of a way already made, in any order).
 */
export type EquationBuilderMiss = 'unfinished_equation' | 'false_equation' | 'other_operation' | 'other_numbers'
  | 'same_as_printed' | 'other_form' | 'printed_number' | 'sum_of_printed' | 'other_side_total'
  | 'one_short' | 'one_over' | 'short_by_more' | 'over_by_more' | 'said_true' | 'said_false'
  | 'bare_number' | 'unfinished_sentence' | 'same_way';

const OFF: readonly EquationBuilderMiss[] = ['one_short', 'one_over', 'short_by_more', 'over_by_more'];
const MISSING: readonly EquationBuilderMiss[] = ['printed_number', 'sum_of_printed', ...OFF];
export const EQUATION_BUILDER_MISSES_BY_MODE: Record<string, readonly EquationBuilderMiss[]> = {
  'build-simple': ['unfinished_equation', 'false_equation', 'other_operation', 'other_numbers'],
  'make-n': ['bare_number', 'unfinished_sentence', ...OFF, 'same_way'],
  'missing-result': MISSING,
  'missing-operand': MISSING,
  'true-false': ['said_true', 'said_false'],
  'balance-both-sides': ['other_side_total', 'printed_number', ...OFF],
  rewrite: ['unfinished_equation', 'false_equation', 'same_as_printed', 'other_form', 'other_numbers'],
};

const ACTIVITY = { judge: 'activity', flow: 'one-at-a-time' } as const;
const TILES = { answer: 'build', ...ACTIVITY,
  moves: 'taps tiles into the row (a placed tile taps back out; Clear empties the row), then presses Check' } as const;
const PICK = { ...TAP_ONE, moves: 'taps the number that fills the ?, then presses Check' } as const;
const by = (mode: string) => EQUATION_BUILDER_MISSES_BY_MODE[mode];

export const equationBuilderCard = defineCard<EquationBuilderMiss>({
  id: 'equation-builder',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2'],
  // Every mode publishes levers (`equationBuilderLevers.ts`): dots, a frame, a rewrite model, match marks, and an
  // easier practice item.
  modes: {
    'build-simple': { ...TILES, misses: by('build-simple') },
    'make-n': { answer: 'build', ...ACTIVITY, misses: by('make-n'),
      // `same_way` has no lever: the way already made stays on screen beside the row, and "different" has no smaller form.
      unanswered: ['same_way'],
      moves: 'taps tiles from a bank that never runs out into the row to make a number sentence for the total (a placed '
        + 'tile taps back out; Clear empties the row), then presses I\'m done!; a two-way item then asks for a different one' },
    'missing-result': { ...PICK, misses: by('missing-result') },
    'true-false': { ...TAP_ONE, misses: by('true-false'), moves: 'taps True or False, then presses Check' },
    'missing-operand': { ...PICK, misses: by('missing-operand') },
    'balance-both-sides': { answer: 'type', ...ACTIVITY, misses: by('balance-both-sides'),
      moves: 'types the number that fills the ? in the box, then presses Check' },
    rewrite: { ...TILES, misses: by('rewrite') },
  },
  words: {
    job: 'read and make equations where = means the same amount on both sides, not "the answer comes next": build one '
      + 'from tiles, find a missing number, decide if one is true, balance two sides, write one another way, or make '
      + 'their own sentence for a total',
    answer: 'the equation, number or True or False they give',
    question: 'the instruction, the printed equation and the tiles or choices on screen',
  },
  levers: true,
});
