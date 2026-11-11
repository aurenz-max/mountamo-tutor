/**
 * pattern-builder's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `patternBuilder.boss.ts`.
 * Every challenge is one checked gesture: tokens tapped into the blanks or the gap, the repeating part selected in the
 * row, a model row rebuilt, a new row tapped out from the key, or the learner's own row in the asked shape and then the
 * part of it that repeats, then the builder's own Check (create: "I'm done!", then the picked part). One item at a time,
 * built or tapped, activity-judged: a bespoke boss.
 */
import type { PatternBuilderChallenge } from './PatternBuilder';
import { defineCard, SAY_OR_SHOW } from '../../../components/live-activity/boss';

/**
 * What a wrong Check shows (`patternBuilderMiss`, `TeachingAttempt.miss`, handoff 20), from the same work the check reads:
 * - a row filled in (extend, find_rule, translate): `blanks_left` (fewer tokens than places), `extra_tokens`,
 *   `repeated_last` (extend, find_rule: every blank holds the row's last token), `started_over` (extend, find_rule:
 *   the blanks hold the row's first tokens), `two_swapped`, `one_wrong` (one place), `several_wrong`;
 * - identify_core: `two_repeats` (the part twice), `too_long`, `too_short`, `other_part` (as many tokens, not the part);
 * - create: `too_short` (fewer than two whole repeats of the asked part, or under four tokens without a shape),
 *   `other_shape` (a part repeats, but not of the asked shape: AB made when ABB was asked, or one token over and
 *   over), `no_repeat` (no starting part repeats all the way through); in the rule turn, `rule_short` (the picked part
 *   is one token short of the part that repeats) and `rule_long` (one token over);
 * - copy: the row misses (`blanks_left` fewer tokens than the model, `extra_tokens`, `two_swapped`, `one_wrong`,
 *   `several_wrong`);
 * - fill_gap: `blanks_left` (Check with the gap empty), `copied_neighbour` (the token beside the gap), `one_wrong`.
 */
export type PatternBuilderMiss = 'blanks_left' | 'extra_tokens' | 'repeated_last' | 'started_over' | 'two_swapped' | 'one_wrong'
  | 'several_wrong' | 'two_repeats' | 'too_long' | 'too_short' | 'other_part' | 'no_repeat' | 'other_shape'
  | 'rule_short' | 'rule_long' | 'copied_neighbour';

const ROW: readonly PatternBuilderMiss[] = ['blanks_left', 'extra_tokens', 'repeated_last', 'started_over', 'two_swapped', 'one_wrong',
  'several_wrong'];
export const PATTERN_MISSES_BY_MODE: Record<PatternBuilderChallenge['type'], readonly PatternBuilderMiss[]> = {
  extend: ROW,
  find_rule: ROW,
  translate: ['blanks_left', 'extra_tokens', 'two_swapped', 'one_wrong', 'several_wrong'],
  identify_core: ['two_repeats', 'too_long', 'too_short', 'other_part'],
  create: ['too_short', 'other_shape', 'no_repeat', 'rule_short', 'rule_long'],
  copy: ['blanks_left', 'extra_tokens', 'two_swapped', 'one_wrong', 'several_wrong'],
  fill_gap: ['blanks_left', 'copied_neighbour', 'one_wrong'],
};

const CHECKED = { judge: 'activity', flow: 'one-at-a-time' } as const;
const BLANKS = 'taps tokens from the choices into the "?" blanks in order, then presses Check Answer';
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
      moves: 'taps the new tokens in order, following the drawn key (each old token becomes its new token), then presses '
        + 'Check Answer' },
    create: { answer: 'build', ...CHECKED, misses: PATTERN_MISSES_BY_MODE.create,
      moves: 'taps tokens to make their own row in the asked shape (the letters, such as A B B; any '
        + 'tokens) at least twice, presses I\'m done!, then taps the part of their row that repeats; Try again keeps '
        + 'the row' },
    copy: { answer: 'build', ...CHECKED, misses: PATTERN_MISSES_BY_MODE.copy,
      moves: 'taps tokens to build the model row again, then presses Check Answer' },
    // The gap's token is one word: said (the tutor judges it) or tapped into the gap and checked.
    fill_gap: { ...SAY_OR_SHOW, misses: PATTERN_MISSES_BY_MODE.fill_gap, unanswered: ['blanks_left'],
      moves: 'may instead tap the token for the "?" gap, then press Check Answer' },
    find_rule: { answer: 'tap', ...CHECKED, moves: BLANKS, misses: PATTERN_MISSES_BY_MODE.find_rule, unanswered: NO_LEVER },
  },
  words: {
    job: 'work with repeating and number patterns: copy, continue or fill a gap in one, find the part that repeats, make '
      + 'it in new tokens, or make their own in the asked shape and tell its rule',
    answer: 'the tokens they place or select',
    question: 'the instruction, the pattern row (colors and shapes by name), the drawn key and the choices',
  },
  levers: true,
});
