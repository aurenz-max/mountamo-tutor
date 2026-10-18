/**
 * Deduction's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `diDeduction.boss.ts`.
 * Every case is one spoken verdict (and, past conclude, its reason) the tutor judges on meaning against the key.
 */
import type { SpokenDeductionMiss } from './diDeductionWorkspace';
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

export const diDeductionCard = defineCard<SpokenDeductionMiss>({
  id: 'di-deduction',
  grades: ['Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  // Every case's known wrong answers (`deductionSpokenMisses`), named by the `spoken_miss` observer.
  modes: {
    conclude: { ...SPOKEN, misses: ['said_negation', 'read_rule_back', 'read_case_back'] },
    deny: { ...SPOKEN, misses: ['said_member', 'said_cannot_tell', 'verdict_without_reason'] },
    cannot_tell: { ...SPOKEN, misses: ['backwards_yes', 'said_not_member', 'verdict_without_reason'] },
  },
  words: {
    job: 'say what the rule card tells them about the case card, using only the rule, and on a verdict case the reason',
    answer: 'the spoken verdict and its reason',
    question: 'the two cards and the ask',
    // The reason the verdict needs and the backwards rule are each case's key; the model lever is the shared doctrine's.
    special: 'A right verdict with no reason is not yet the answer, so ask how they know. On a can\'t-tell case never '
      + 'say what the rule does not say about THIS category ("not only birds…") or name another thing with its property: '
      + 'that is the reason the learner must give.',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
