/**
 * pattern-builder's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `patternBuilder.boss.ts`.
 * Every challenge is one checked gesture: tokens tapped into the blanks, the repeating part selected in the row, a new
 * row tapped out from the key, or the learner's own row in the asked shape, then the builder's own Check (create:
 * "I'm done!"). One item at a time, built or tapped, activity-judged: a bespoke boss.
 */
import type { PatternBuilderChallenge } from './PatternBuilder';
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong Check shows (`patternBuilderMiss`, `TeachingAttempt.miss`, handoff 20), from the same work the check reads:
 * - a row filled in (extend, find_rule, translate): `blanks_left` (fewer tokens than places), `extra_tokens`,
 *   `repeated_last` (extend, find_rule: every blank holds the row's last token), `started_over` (extend, find_rule:
 *   the blanks hold the row's first tokens), `two_swapped`, `one_wrong` (one place), `several_wrong`;
 * - identify_core: `two_repeats` (the part twice), `too_long`, `too_short`, `other_part` (as many tokens, not the part);
 * - create: `too_short` (fewer than two whole repeats of the asked part, or under four tokens without a shape),
 *   `other_shape` (a part repeats, but not of the asked shape: AB made when ABB was asked, or one token over and
 *   over), `no_repeat` (no starting part repeats all the way through).
 */
export type PatternBuilderMiss = 'blanks_left' | 'extra_tokens' | 'repeated_last' | 'started_over' | 'two_swapped' | 'one_wrong'
  | 'several_wrong' | 'two_repeats' | 'too_long' | 'too_short' | 'other_part' | 'no_repeat' | 'other_shape';

const ROW: readonly PatternBuilderMiss[] = ['blanks_left', 'extra_tokens', 'repeated_last', 'started_over', 'two_swapped', 'one_wrong',
  'several_wrong'];
export const PATTERN_MISSES_BY_MODE: Record<PatternBuilderChallenge['type'], readonly PatternBuilderMiss[]> = {
  extend: ROW,
  find_rule: ROW,
  translate: ['blanks_left', 'extra_tokens', 'two_swapped', 'one_wrong', 'several_wrong'],
  identify_core: ['two_repeats', 'too_long', 'too_short', 'other_part'],
  create: ['too_short', 'other_shape', 'no_repeat'],
};

const CHECKED = { judge: 'activity', flow: 'one-at-a-time' } as const;
const BLANKS = 'taps tokens from the choices into the "?" blanks in order (tapping the last one placed takes it back), then '
  + 'presses Check Answer';
// A Check with "?" blanks left needs no picture (the blanks are on screen); a row longer than its blanks cannot be made
// (the row stops at the last blank).
const NO_LEVER: readonly PatternBuilderMiss[] = ['blanks_left', 'extra_tokens'];

export const patternBuilderCard = defineCard<PatternBuilderMiss>({
  id: 'pattern-builder',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3'],
  // Every mode publishes levers (`patternBuilderLevers.ts`): gaps or a number line on the row, a model in other
  // pictures, a place marker, and an easier practice row.
  modes: {
    extend: { answer: 'build', ...CHECKED, moves: BLANKS, misses: PATTERN_MISSES_BY_MODE.extend, unanswered: NO_LEVER },
    identify_core: { answer: 'tap', ...CHECKED, misses: PATTERN_MISSES_BY_MODE.identify_core,
      moves: 'taps the tokens in the row that make the smallest part that repeats, then presses Check Answer' },
    translate: { answer: 'build', ...CHECKED, misses: PATTERN_MISSES_BY_MODE.translate,
      moves: 'taps the new tokens in order to make the same pattern, following the drawn key (each old token becomes its '
        + 'new token), then presses Check Answer' },
    create: { answer: 'build', ...CHECKED, misses: PATTERN_MISSES_BY_MODE.create,
      moves: 'taps tokens to make their own pattern in the asked shape (the letters in the task, such as A B B, are the '
        + 'shape; the tokens are theirs), at least two whole times, then presses I\'m done!; Try again keeps the row to revise' },
    find_rule: { answer: 'tap', ...CHECKED, moves: BLANKS, misses: PATTERN_MISSES_BY_MODE.find_rule, unanswered: NO_LEVER },
  },
  words: {
    job: 'work with repeating and number patterns: continue a pattern, find the part that repeats, make the same pattern '
      + 'with new tokens, or make a pattern of their own in the asked shape',
    answer: 'the tokens they place or select',
    question: 'the instruction, the pattern row (colors and shapes by name), the drawn key and the choices',
  },
  levers: true,
});
