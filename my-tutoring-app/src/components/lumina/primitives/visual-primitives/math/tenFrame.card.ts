/**
 * ten-frame's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `tenFrame.boss.ts`.
 * Subitize, operate and Grades 1-2 make-ten are one spoken number the tutor judges against the key. The rest are
 * answered on the frame and checked by it: counters placed (build, build_teen, Kindergarten make-ten), counters
 * turned yellow (decompose, decompose_teen), or a number made from two colours (build_pair).
 */
import type { OffByMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { defineCard, OFF_BY, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/**
 * What a wrong placement shows (`frameMiss`), from the count the frame commits: counters placed (build), added to the
 * seeded ones (make_ten, build_teen) or turned yellow (split, decompose_teen).
 * - `one_short` / `one_over`, `short_by_more` / `over_by_more`: off by one, or by two or more;
 * - `filled_frame`: every empty box filled (build, build_teen, build_pair), when that is more than one over;
 * - `all_flipped` / `none_flipped`: the whole group turned yellow, or none of it;
 * - `same_way_again`: a pair already shown for this total while another way remains;
 * - `one_colour` (build_pair): the right number on the frame, all of it one colour.
 */
export type FrameMiss = OffByMiss | 'filled_frame' | 'all_flipped' | 'none_flipped' | 'same_way_again' | 'one_colour';

/** What a wrong spoken number shows (`tenFrameSpokenMisses`, named by the `spoken_miss` observer). */
export type SpokenFrameMiss = OffByMiss | 'empty_count' | 'said_shown' | 'said_capacity' | 'said_addend' | 'said_start' | 'said_change';

export type TenFrameMiss = FrameMiss | SpokenFrameMiss;

/** The frame's own check on the board modes, and the spoken items' known wrong answers, by mode. */
export const TEN_FRAME_MISSES = {
  build: ['one_short', 'one_over', 'filled_frame', 'short_by_more', 'over_by_more'],
  make_ten: ['said_shown', 'said_capacity', ...OFF_BY],
  subitize: ['empty_count', ...OFF_BY],
  operate: ['said_addend', 'said_start', 'said_change', ...OFF_BY],
  decompose: ['all_flipped', 'none_flipped', 'same_way_again'],
  build_pair: ['one_short', 'one_over', 'filled_frame', 'short_by_more', 'over_by_more', 'one_colour', 'same_way_again'],
  build_teen: ['one_short', 'one_over', 'filled_frame', 'short_by_more', 'over_by_more'],
  decompose_teen: ['one_short', 'one_over', 'all_flipped', 'short_by_more', 'over_by_more'],
} as const satisfies Record<string, readonly TenFrameMiss[]>;

const BOARD = { answer: 'build', judge: 'activity', flow: 'one-at-a-time' } as const;
const PLACE = 'taps the empty boxes to put counters on; the frame checks once the learner stops';
const FLIP = 'taps counters to turn them yellow or back to red; the frame checks once the learner stops';

export const tenFrameCard = defineCard<TenFrameMiss>({
  id: 'ten-frame',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2'],
  modes: {
    build: { ...BOARD, moves: PLACE, misses: TEN_FRAME_MISSES.build },
    decompose: { ...BOARD, moves: FLIP, misses: TEN_FRAME_MISSES.decompose },
    build_teen: { ...BOARD, moves: PLACE, misses: TEN_FRAME_MISSES.build_teen },
    build_pair: { ...BOARD, moves: 'presses Red counters or Yellow counters, taps boxes to put counters of that colour on '
      + '(a tap on a counter takes it off), then presses I\'m done', misses: TEN_FRAME_MISSES.build_pair },
    // RP-2 pilot on real Live transcripts (spoken-miss/rp2-pilot-2026-09-29): 0/150 right-answer readings named wrong.
    subitize: { ...SPOKEN, moves: 'presses Show me to see the counters for a moment (Show again shows them once more)',
      misses: TEN_FRAME_MISSES.subitize, missFromWords: true },
    decompose_teen: { ...BOARD, moves: FLIP, misses: TEN_FRAME_MISSES.decompose_teen },
    make_ten: { ...SPOKEN, moves: 'in Kindergarten taps the empty boxes until the frame is full (the frame checks itself); '
      + 'in Grades 1 and 2 says how many more make ten', misses: TEN_FRAME_MISSES.make_ten },
    operate: { ...SPOKEN, moves: 'may put counters on the frame or take them off to work it out',
      misses: TEN_FRAME_MISSES.operate },
  },
  words: {
    job: 'build a number on a ten frame, split a group into two colours, make a teen number as ten and some more or '
      + 'find the ten in one, or fill the frame to ten; or say how many after a quick look, how many more make ten, '
      + 'or the answer to an adding or take-away problem',
    answer: 'their answer',
    question: 'the ask and how to use the frame',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
