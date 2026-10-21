/**
 * balance-scale's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `balanceScale.boss.ts`.
 * Every mode is stepped, and the step names are the scene's `kind`: a hands step (place weights, set a known weight
 * aside, share units into groups) is checked by the scale once the move is complete and the learner stops; a spoken
 * step asks for one number about the scale the learner built (or, in two_step, why one equal share is x), which the
 * tutor judges against the key.
 */
import type { OffByMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { defineCard, OFF_BY, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong spoken weight shows (`balanceSpokenMisses`): this problem's other numbers first, then the off-by misses. */
export type SpokenBalanceMiss = OffByMiss | 'said_whole' | 'said_given_part' | 'added_both' | 'said_change' | 'said_one_parcel'
  | 'said_remaining' | 'said_parcels';

const SHARE: readonly SpokenBalanceMiss[] = ['said_remaining', 'said_parcels', 'said_whole'];

/** The spoken steps' known wrong weights, by mode. The hands steps name none (an incomplete move is exploration, never
 *  committed), and the two_step explanation names none (it is judged on meaning). */
export const BALANCE_MISSES_BY_MODE = {
  equality: [...OFF_BY],
  equality_hard: [...OFF_BY],
  one_step: ['said_whole', 'said_given_part', 'added_both', ...OFF_BY],
  one_step_hard: [...SHARE, ...OFF_BY],
  two_step_intro: [...SHARE, 'said_change', 'said_one_parcel', ...OFF_BY],
  two_step: [...SHARE, 'said_change', 'said_one_parcel', ...OFF_BY],
} as const satisfies Record<string, readonly SpokenBalanceMiss[]>;

const hands = (moves: string) => ({ answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time', moves } as const);
// The scale checks a hands step once it is complete and the learner stops; an unbalanced or uneven move is exploration.
const PLACE = 'taps tray weights onto the right pan until it balances';
const RECOMPOSE = 'balances the right pan again with a different set of weights from the first';
const COMPLETE = 'taps tray weights onto the left pan, beside the known weight, until it balances';
const SEPARATE = 'taps the known loose weight, then right-side units, to set the same weight aside on both sides';
const SHARE_UNITS = 'taps a unit, then a parcel group, or drags it there, until the groups are equal';

export const balanceScaleCard = defineCard<SpokenBalanceMiss>({
  id: 'balance-scale',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    equality: { steps: { build: hands(PLACE), total: SPOKEN, infer: SPOKEN }, misses: BALANCE_MISSES_BY_MODE.equality },
    equality_hard: { steps: { compose: hands(PLACE), sum: SPOKEN, recompose: hands(RECOMPOSE), resum: SPOKEN, infer: SPOKEN },
      misses: BALANCE_MISSES_BY_MODE.equality_hard },
    one_step: { steps: { complete: hands(COMPLETE), added: SPOKEN, relate: SPOKEN }, misses: BALANCE_MISSES_BY_MODE.one_step },
    one_step_hard: { steps: { share: hands(SHARE_UNITS), each: SPOKEN, infer: SPOKEN }, misses: BALANCE_MISSES_BY_MODE.one_step_hard },
    two_step_intro: { steps: { separate: hands(SEPARATE), remaining: SPOKEN, share: hands(SHARE_UNITS), each: SPOKEN, infer: SPOKEN },
      misses: BALANCE_MISSES_BY_MODE.two_step_intro },
    two_step: { steps: { separate: hands(SEPARATE), remaining: SPOKEN, share: hands(SHARE_UNITS), each: SPOKEN, infer: SPOKEN,
      explain: SPOKEN }, misses: BALANCE_MISSES_BY_MODE.two_step },
  },
  words: {
    job: 'balance a scale with weights, then say a number it shows (the total placed, the hidden weight, the part '
      + 'added, one equal group, one parcel); in two_step, also why one equal share is x',
    answer: 'their answer',
    question: 'the ask and the scale',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
