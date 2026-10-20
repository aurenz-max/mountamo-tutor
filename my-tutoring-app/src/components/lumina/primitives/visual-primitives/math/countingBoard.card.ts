/**
 * counting-board's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `countingBoard.boss.ts`.
 * Eight modes are one spoken number the tutor judges against the key. Three are answered on the board and checked
 * by it: a hand picked to match a small group, a set handed over from a pile, a set put into an empty scene.
 */
import type { CountMiss, SpokenCountMiss } from './countingBoardDomain';
import { defineCard, OFF_BY, SPOKEN, SPOKEN_AUDIO, TAP_ONE } from '../../../components/live-activity/boss';

export type CountingBoardMiss = CountMiss | SpokenCountMiss;

/**
 * What a wrong answer shows, by mode: the board's own check (`countMiss`) on the hand, the handover and the build;
 * the spoken items' known wrong answers (`countingBoardSpokenMisses`), named by the `spoken_miss` observer.
 */
export const COUNTING_MISSES = {
  give_me_n: ['one_short', 'one_over', 'gave_all', 'short_by_more', 'over_by_more'],
  build_n: OFF_BY,
  subitize_perceptual: OFF_BY,
  count: ['skipped_a_number', ...OFF_BY],
  recount_moved: OFF_BY,
  subitize: OFF_BY,
  count_on: ['skipped_a_number', 'said_start', ...OFF_BY],
  group: ['said_group_count', ...OFF_BY],
  compare: ['smaller_group', 'said_total', ...OFF_BY],
  take_away: ['said_start', 'said_change', ...OFF_BY],
  add_more: ['said_start', 'said_change', ...OFF_BY],
} as const satisfies Record<string, readonly CountingBoardMiss[]>;

export const countingBoardCard = defineCard<CountingBoardMiss>({
  id: 'counting-board',
  grades: ['Kindergarten', 'Grade 1'],
  modes: {
    subitize_perceptual: { ...TAP_ONE, misses: COUNTING_MISSES.subitize_perceptual },
    // RP-2 pilot on real Live transcripts (spoken-miss/rp2-pilot-2026-09-29): 0/510 right-answer and 0/393
    // non-answer readings named wrong.
    count: { ...SPOKEN, misses: COUNTING_MISSES.count, missFromWords: true },
    give_me_n: { answer: 'tap', judge: 'activity', flow: 'one-at-a-time',
      moves: 'touches the ones to give (a second touch puts one back), then presses Give them to me',
      misses: COUNTING_MISSES.give_me_n },
    build_n: { answer: 'build', judge: 'activity', flow: 'one-at-a-time',
      moves: 'taps the empty scene to put objects in (a tap on one takes it out), then presses I\'m done',
      misses: COUNTING_MISSES.build_n },
    recount_moved: { ...SPOKEN, moves: 'touches each object to count it; after the last one the set moves and cannot be touched again',
      misses: COUNTING_MISSES.recount_moved },
    subitize: { ...SPOKEN, misses: COUNTING_MISSES.subitize },
    group: { ...SPOKEN, misses: COUNTING_MISSES.group },
    add_more: { ...SPOKEN, moves: 'touches the faded objects to put them on the board before answering', misses: COUNTING_MISSES.add_more },
    take_away: { ...SPOKEN, moves: 'touches the objects to take them off the board before answering', misses: COUNTING_MISSES.take_away },
    count_on: { ...SPOKEN, misses: COUNTING_MISSES.count_on },
    compare: { ...SPOKEN, misses: COUNTING_MISSES.compare },
  },
  words: {
    job: 'count the objects on a board and say how many: all of them, after a quick look, counting on from a group '
      + 'already counted, in groups, in the bigger of two groups, after some are taken away or put on, or after they '
      + 'move; or make a set of the size asked for; or tap the hand that matches a small group',
    answer: 'the count',
    question: 'the ask and how to use the board',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
