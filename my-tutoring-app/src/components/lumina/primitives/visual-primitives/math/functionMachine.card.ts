/**
 * function-machine's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `functionMachine.boss.ts`.
 * Every mode is answered on the screen and checked by the activity itself: inputs fed, a prediction or a rule typed,
 * or a machine built from tiles. One item at a time: a bespoke boss.
 */
import type { MakeRuleMiss } from './functionMachineDomain';
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20), from the old catalog's commonStruggles (adding for a
 * multiplicative rule, looking at one pair, two-step rules) and the open build's own judge:
 * - predict (`predictMiss`): `gave_input` (the input back), `added_not_multiplied` (added or subtracted the rule's
 *   number where the rule multiplies or divides), `multiplied_not_added`, `one_step_only` (one step of a two-step
 *   rule), `wrong_order` (the two steps the other way round), `too_high` / `too_low`;
 * - discover_rule, create_rule (`guessMiss`): `not_a_rule` (cannot run), `fits_some_pairs` (right for some pairs, not
 *   all), `added_not_multiplied`, `multiplied_not_added`, `one_step_only`, `wrong_order`, `wrong_rule`;
 * - make_rule (`judgeMakeRule`): `not_a_rule`, `no_input`, `wrong_output`, `same_machine`.
 * Observe has no check that can fail: Continue is the item's end.
 */
export type FunctionMachineMiss = 'gave_input' | 'added_not_multiplied' | 'multiplied_not_added' | 'one_step_only'
  | 'wrong_order' | 'too_high' | 'too_low' | 'fits_some_pairs' | 'wrong_rule' | MakeRuleMiss;

export const PREDICT_MISSES: readonly FunctionMachineMiss[] = ['gave_input', 'added_not_multiplied', 'multiplied_not_added',
  'one_step_only', 'wrong_order', 'too_high', 'too_low'];
export const GUESS_MISSES: readonly FunctionMachineMiss[] = ['not_a_rule', 'fits_some_pairs', 'added_not_multiplied',
  'multiplied_not_added', 'one_step_only', 'wrong_order', 'wrong_rule'];
export const MAKE_MISSES: readonly FunctionMachineMiss[] = ['not_a_rule', 'no_input', 'wrong_output', 'same_machine'];

const CHECKED = { judge: 'activity', flow: 'one-at-a-time' } as const;
const RULE_BOX = 'types the rule in Your rule, using x, and presses Check';

export const functionMachineCard = defineCard<FunctionMachineMiss>({
  id: 'function-machine',
  grades: ['Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  // Every checked mode publishes levers (`functionMachineLevers.ts`); observe has none, since nothing in it can miss.
  modes: {
    observe: { ...CHECKED, answer: 'tap', misses: [],
      moves: 'taps input numbers to feed them into the machine, then presses Continue once enough pairs are fed' },
    predict: { ...CHECKED, answer: 'type', misses: PREDICT_MISSES,
      moves: 'types the output in My prediction, then taps that input to feed it; the output shows only after a right prediction' },
    discover_rule: { ...CHECKED, answer: 'type', misses: GUESS_MISSES,
      moves: `taps inputs to feed them into the machine; once two pairs are out, ${RULE_BOX}` },
    create_rule: { ...CHECKED, answer: 'type', misses: GUESS_MISSES, moves: RULE_BOX },
    make_rule: { ...CHECKED, answer: 'build', misses: MAKE_MISSES,
      moves: 'taps number, x and sign tiles to build a rule (tapping a tile in the rule takes it out; Start over clears the '
        + 'rule) and presses I\'m done!; then builds a different machine for the same pair' },
  },
  words: {
    job: 'work with a function machine that turns each input into an output by one rule: watch a shown rule work, '
      + 'predict outputs from a shown rule, find a hidden rule by feeding inputs, write the rule for a table of pairs, '
      + 'or build two different machines that turn one input into one output',
    answer: 'the output they predict, the rule they type, or the machine they build',
    question: 'the instruction, the rule shown on the machine in observe and predict, the inputs left to feed, every '
      + 'input and output pair already on screen, and the pair a machine must make',
  },
  levers: true,
});
