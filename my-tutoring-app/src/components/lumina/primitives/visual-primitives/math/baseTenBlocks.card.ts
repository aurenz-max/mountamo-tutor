/**
 * base-ten-blocks' card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `baseTenBlocks.boss.ts`.
 * Two mats, chosen by the payload: on the click mat the learner builds a number, builds it two ways, or adds and
 * subtracts and types the result, and the mat checks it; on the spoken mat (a read_blocks or regroup session) the
 * learner says how many blocks of one size there are and what they are worth, or predicts a trade aloud and then makes
 * it with a tap, which the mat checks. Every mode is wired by step (the scene's `kind`), so each step's moves are named.
 * No `audio` here: only the spoken mat takes the microphone, which the catalog's `audioInputByMode` keeps per mode.
 */
import type { OffByMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { defineCard, SPOKEN } from '../../../components/live-activity/boss';

/**
 * What a wrong answer on either mat shows (`TeachingAttempt.miss`). Only the observable pattern:
 * - a value built or typed: `digits_swapped` (the target's digits in reverse, 21 for 12), `one_short` /
 *   `one_over` (one of the smallest block), `one_ten_off` (ten of the smallest block, either way),
 *   `short_by_more` / `over_by_more`;
 * - build_number: `not_traded_up` (the right value, but a place holds ten or more);
 * - a trade: `no_trade` (checked before any trade), `value_changed` (blocks added or removed as well),
 *   `other_block` (a different size broken down), `traded_twice` (more than one of the asked block broken);
 * - build_two_ways: `same_as_first` (the second way has the right value and the same blocks as the first).
 */
export type BaseTenMiss = 'digits_swapped' | 'one_short' | 'one_over' | 'one_ten_off' | 'short_by_more' | 'over_by_more'
  | 'not_traded_up' | 'no_trade' | 'value_changed' | 'other_block' | 'traded_twice' | 'same_as_first';

/** What a wrong spoken number on the spoken mat shows (`baseTenSpokenMisses`, named by the `spoken_miss` observer). */
export type SpokenBaseTenMiss = OffByMiss | 'said_value' | 'said_count' | 'said_total' | 'other_block_count' | 'one_block_off'
  | 'said_ten' | 'said_start';

export type BaseTenBlocksMiss = BaseTenMiss | SpokenBaseTenMiss;
export type BaseTenMode = 'build_number' | 'build_two_ways' | 'read_blocks' | 'regroup' | 'operate';

/**
 * The misses each mode names. read_blocks' and regroup's click-mat misses (`one_ten_off`, `digits_swapped`, `no_trade`,
 * `value_changed`) come only from a mixed payload, which runs those items on the click mat with the keypad or the
 * trade buttons; a read_blocks or regroup session runs on the spoken mat.
 */
export const BASE_TEN_MISSES_BY_MODE: Record<BaseTenMode, readonly BaseTenBlocksMiss[]> = {
  build_number: ['one_short', 'one_over', 'one_ten_off', 'digits_swapped', 'not_traded_up', 'short_by_more', 'over_by_more'],
  build_two_ways: ['one_short', 'one_over', 'one_ten_off', 'digits_swapped', 'short_by_more', 'over_by_more', 'same_as_first'],
  read_blocks: ['one_short', 'one_over', 'one_ten_off', 'digits_swapped', 'short_by_more', 'over_by_more', 'said_value',
    'said_count', 'said_total', 'other_block_count', 'one_block_off'],
  regroup: ['other_block', 'traded_twice', 'no_trade', 'value_changed', 'said_ten', 'said_start', 'one_short', 'one_over',
    'short_by_more', 'over_by_more'],
  operate: ['one_short', 'one_over', 'one_ten_off', 'digits_swapped', 'short_by_more', 'over_by_more'],
};

const CHECKED = { judge: 'activity', flow: 'one-at-a-time' } as const;
const M = BASE_TEN_MISSES_BY_MODE;

export const baseTenBlocksCard = defineCard<BaseTenBlocksMiss>({
  id: 'base-ten-blocks',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    build_number: { steps: { build_number: { ...CHECKED, answer: 'build',
      moves: 'presses + or - under a column to add or take away a block, may trade ten blocks for one of the next size, '
        + 'then presses Check My Blocks' } }, misses: M.build_number },
    build_two_ways: { steps: { build_two_ways: { ...CHECKED, answer: 'build',
      moves: "puts any blocks that make the number on an empty mat and presses I'm done, then changes the blocks to make "
        + "it a different way and presses I'm done again" } }, misses: M.build_two_ways },
    // The click-mat misses of read_blocks and regroup come only from a mixed payload, where the click mat's levers
    // answer them (`ten_model`, `plainer_read`); a read_blocks or regroup session runs on the spoken mat, which never
    // checks them, so no lever there answers them.
    read_blocks: { steps: { count: SPOKEN, worth: SPOKEN }, misses: M.read_blocks, unanswered: ['one_ten_off', 'digits_swapped'] },
    regroup: { steps: { predict: SPOKEN, trade: { ...CHECKED, answer: 'manipulate',
      moves: 'taps one block to break it into ten of the next size down, and may put the blocks back; the mat checks the '
        + 'trade once the learner stops tapping' } }, misses: M.regroup, unanswered: ['no_trade', 'value_changed'] },
    // `digits_swapped` on operate has no lever (approved lever table).
    operate: { steps: { operate: { ...CHECKED, answer: 'type',
      moves: 'may model the numbers with blocks, then types the result on the keypad' } },
    misses: M.operate, unanswered: ['digits_swapped'] },
  },
  words: {
    job: 'show numbers with base-ten blocks: build a number, build it two ways, add or subtract with blocks, say how many '
      + 'blocks of one size there are and what they are worth, or predict a trade out loud and then make it',
    answer: 'their answer',
    question: 'the instruction and the ask',
  },
  levers: true,
});
