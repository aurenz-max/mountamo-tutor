/**
 * strategy-picker's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `strategyPicker.boss.ts`.
 * Every challenge is one checked gesture, then the picker's own Check: a number set with the − and + buttons (guided,
 * try_another, choose after a menu pick) or a strategy tapped (match, compare). Bespoke: the stepper modes are not one tap.
 */
import { TAP_ONE, defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong Check shows (`strategyPickerMiss`, `TeachingAttempt.miss`, handoff 20), from the same work the check reads:
 * - a number (guided, try_another, choose): `other_operation` (the two numbers combined the other way),
 *   `printed_number` (one of the problem's own numbers), then `one_short` / `one_over` / `short_by_more` /
 *   `over_by_more`;
 * - match: `similar_strategy` (one that draws the same kind of picture: the other number-line, doubles or
 *   count-everything strategy), `different_strategy`.
 * Compare names none: every choice is credited.
 */
export type StrategyPickerMiss = 'other_operation' | 'printed_number' | 'one_short' | 'one_over' | 'short_by_more'
  | 'over_by_more' | 'similar_strategy' | 'different_strategy';

const NUMBER: readonly StrategyPickerMiss[] = ['other_operation', 'printed_number', 'one_short', 'one_over',
  'short_by_more', 'over_by_more'];
export const STRATEGY_PICKER_MISSES_BY_MODE: Record<string, readonly StrategyPickerMiss[]> = {
  guided: NUMBER,
  try_another: NUMBER,
  choose: NUMBER,
  match: ['similar_strategy', 'different_strategy'],
  compare: [],
};

const SET = 'sets the answer with the − and + buttons and presses Check Answer';
const STEPPER = { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time' } as const;
const by = (mode: string) => STRATEGY_PICKER_MISSES_BY_MODE[mode];

export const strategyPickerCard = defineCard<StrategyPickerMiss>({
  id: 'strategy-picker',
  grades: ['Kindergarten', 'Grade 1'],
  // guided, try_another, choose and match publish levers (`strategyPickerLevers.ts`); compare credits every choice, so
  // it has no miss and no lever.
  modes: {
    guided: { ...STEPPER, misses: by('guided'), moves: `follows the named strategy with its picture and steps, then ${SET}` },
    match: { ...TAP_ONE, misses: by('match'),
      moves: 'reads the worked solution, taps the strategy it used, then presses Check Answer' },
    try_another: { ...STEPPER, misses: by('try_another'),
      moves: `solves the same problem again with the different strategy named on screen, then ${SET}` },
    compare: { ...TAP_ONE, misses: by('compare'),
      moves: 'answers the question by tapping one of the two strategies or Both the same, then presses Check Answer' },
    choose: { ...STEPPER, misses: by('choose'),
      moves: `taps a strategy from the menu, which draws its picture, then ${SET}` },
  },
  words: {
    job: 'solve one addition or subtraction problem within ten with a strategy and its picture (counting on, counting '
      + 'back, make ten, doubles, near doubles, tally marks or drawing objects), solve it again another way, pick their '
      + 'own strategy, tell which strategy a worked solution used, or compare two strategies',
    answer: 'the number they set or the strategy they tap',
    question: 'the instruction, the problem, the strategy steps, the worked solution and the strategy names on screen',
  },
  levers: true,
});
