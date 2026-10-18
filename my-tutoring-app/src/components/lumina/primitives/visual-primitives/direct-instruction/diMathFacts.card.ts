/**
 * Math facts' card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `diMathFacts.boss.ts`.
 * Every mode is one spoken number word the tutor judges against the key; the observer reads the tutor's feedback.
 */
import type { SpokenFactMiss } from './diMathFactsDomain';
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

const OFF_BY = ['one_short', 'one_over', 'short_by_more', 'over_by_more'] as const;
// The take-away misses are named on the addition modes too; the model lever answers any wrong number.
const ADDITION = ['said_addend', 'said_start', 'said_change', 'added_instead', 'teen_decade_swap', ...OFF_BY] as const;

export const diMathFactsCard = defineCard<SpokenFactMiss>({
  id: 'di-math-facts',
  grades: ['Kindergarten', 'Grade 1'],
  // Every mode's known wrong answers (`mathFactSpokenMisses`), named by the `spoken_miss` observer.
  modes: {
    answer_fact: { ...SPOKEN, misses: ADDITION },
    fact_review: { ...SPOKEN, misses: ADDITION },
    subtraction_fact: { ...SPOKEN, misses: ['said_start', 'said_change', 'added_instead', 'teen_decade_swap', ...OFF_BY] },
    counting_next: { ...SPOKEN, misses: ['said_printed', 'said_before', 'said_two_after', 'decade_rollover', 'teen_decade_swap', ...OFF_BY] },
    name_numeral: { ...SPOKEN, misses: ['recited_sequence', 'look_alike_numeral', 'teen_decade_swap', ...OFF_BY] },
  },
  words: {
    job: 'say the answer to the printed problem out loud, as a number word',
    answer: 'the spoken number',
    question: 'the printed problem and the ask',
    // The counting route, the strict different-number rule and the teen/decade rule are each item's key; the model
    // lever and the screen rule are the shared doctrine's.
    special: 'The card shows one printed problem and never its answer. demonstrate takes "problem" or a term id from '
      + 'workspace.objects.',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
