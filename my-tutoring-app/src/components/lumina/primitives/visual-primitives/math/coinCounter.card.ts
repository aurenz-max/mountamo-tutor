/**
 * coin-counter's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `coinCounter.boss.ts`.
 * A total, the group worth more and the change are each one sayable answer: the learner says it (the tutor judges the
 * words against the key) or types or taps it and presses Check (the activity checks it), so count-mixed, compare and
 * make-change are SAY_OR_SHOW. count-like is too, from Grade 2; in Kindergarten and Grade 1 tapping every coin is part
 * of the answer, so those items have no key and are only shown. Identify is a tap and Check. The builds are boards.
 */
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO, TAP_ONE } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`TeachingAttempt.miss`, handoff 20), from the work the check reads, drawn from the
 * catalog's old commonStruggles (small coin is not small value; skip-counting mixed values; change needs subtraction):
 * - identify: `dime_nickel` (the two swapped), `dime_penny` (the small coins swapped), `silver_coins` (another silver
 *   coin), `other_coin`;
 * - count, make-amount and show-amount: `counted_coins` (the number of coins, not their value), `all_one_kind` (every
 *   coin valued as one of the kinds shown), `one_coin_short` / `one_coin_over` (off by one coin's value), `short` / `over`;
 * - compare: `more_coins` (the group with more coins but less money), `said_equal`, `missed_equal`, `reversed`;
 * - make-change: `gave_cost` (the price), `gave_paid` (the amount paid), `added` (paid plus price), `short` / `over`.
 */
export type CoinMiss = 'dime_nickel' | 'dime_penny' | 'silver_coins' | 'other_coin'
  | 'counted_coins' | 'all_one_kind' | 'one_coin_short' | 'one_coin_over' | 'short' | 'over'
  | 'more_coins' | 'said_equal' | 'missed_equal' | 'reversed'
  | 'gave_cost' | 'gave_paid' | 'added';

const BUILD = ['counted_coins', 'one_coin_short', 'one_coin_over', 'short', 'over'] as const;

/** The activity's check (`coinMiss`) and the spoken items' known misses (`coinSpokenMisses`), by mode, same ids.
 *  Kindergarten like coins check themselves on the last tap. fewest-coins renders and checks as make-amount. */
export const COIN_MISSES = {
  identify: ['dime_nickel', 'dime_penny', 'silver_coins', 'other_coin'],
  'count-like': BUILD,
  'count-mixed': ['counted_coins', 'all_one_kind', 'one_coin_short', 'one_coin_over', 'short', 'over'],
  compare: ['more_coins', 'said_equal', 'missed_equal', 'reversed'],
  'make-amount': BUILD,
  'show-amount': BUILD,
  'make-change': ['gave_cost', 'gave_paid', 'added', 'short', 'over'],
  'fewest-coins': BUILD,
} as const satisfies Record<string, readonly CoinMiss[]>;

const MAKE = 'taps coins to add them (a tap on one takes it out), then presses Check';
/** A said amount may instead be typed: one sentence for both modes. */
const TYPE_IT = 'may instead type it and press Check';

export const coinCounterCard = defineCard<CoinMiss>({
  id: 'coin-counter',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3'],
  modes: {
    identify: { ...TAP_ONE, moves: 'taps a coin, then presses Check', misses: COIN_MISSES.identify },
    'count-like': { ...SAY_OR_SHOW,
      moves: 'in Kindergarten taps each coin once (the count checks itself); in Grade 1 taps each coin once, then types '
        + 'the total and presses Check; from Grade 2 may instead type it and press Check',
      misses: COIN_MISSES['count-like'] },
    'count-mixed': { ...SAY_OR_SHOW, moves: TYPE_IT, misses: COIN_MISSES['count-mixed'] },
    compare: { ...SAY_OR_SHOW, moves: 'may instead tap a group or They\'re Equal, then press Check', misses: COIN_MISSES.compare },
    'make-amount': { answer: 'manipulate', judge: 'activity', flow: 'board', moves: MAKE, misses: COIN_MISSES['make-amount'] },
    'show-amount': { answer: 'build', judge: 'activity', flow: 'board',
      moves: 'taps bins to put coins on the tray (a tap on one takes it off), then presses I\'m done',
      misses: COIN_MISSES['show-amount'] },
    'make-change': { ...SAY_OR_SHOW, moves: TYPE_IT, misses: COIN_MISSES['make-change'] },
    'fewest-coins': { answer: 'manipulate', judge: 'activity', flow: 'board', moves: MAKE, misses: COIN_MISSES['fewest-coins'] },
  },
  words: {
    job: 'name coins, count or compare what coins are worth, make an amount, or find the change',
    answer: 'their answer',
    question: 'the ask and the amounts on screen',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
