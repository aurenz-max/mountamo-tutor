/**
 * evidence-finder's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `evidenceFinder.boss.ts`.
 * One passage is one or two items, the activity's own steps: `find` (highlight every sentence that is evidence, each
 * under the claim it supports, then check) on every mode, and `rate` (rate each evidence sentence Strong, Moderate or
 * Weak, then check) on a CER passage (evaluate_evidence_strength). The item's kind names its step. Each step is checked
 * whole by the activity: one item at a time, never a board (a count of right highlights would name the evidence; the
 * count is the `evidence_count` lever, refused where it would).
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`evidenceFinderMiss`, `TeachingAttempt.miss`), drawn from the old catalog's commonStruggles
 * ("opinion vs evidence", "weak evidence"):
 * - find, first that applies: `not_evidence` (a highlighted sentence is on the topic but is not evidence),
 *   `wrong_claim` (an evidence sentence under the other claim), `missed_evidence` (a strong or moderate one left out);
 * - rate: `weak_as_strong` (a sentence that only relates to the claim rated Strong: mentions vs proves),
 *   `rated_too_strong` (every wrong rating above the key), `rated_too_weak` (every wrong rating below it),
 *   `mixed_ratings` (some above, some below).
 */
export type EvidenceFinderMiss = 'not_evidence' | 'wrong_claim' | 'missed_evidence'
  | 'weak_as_strong' | 'rated_too_strong' | 'rated_too_weak' | 'mixed_ratings';
export const FIND_MISSES: readonly EvidenceFinderMiss[] = ['not_evidence', 'wrong_claim', 'missed_evidence'];
export const RATE_MISSES: readonly EvidenceFinderMiss[] = ['weak_as_strong', 'rated_too_strong', 'rated_too_weak', 'mixed_ratings'];

const FIND = { answer: 'tap', judge: 'activity', flow: 'one-at-a-time',
  moves: 'taps each sentence of the passage that is evidence to highlight it (with two claims, first taps the claim it '
    + 'supports; tapping a highlighted sentence again takes it off), then presses Check Evidence' } as const;
const RATE = { answer: 'tap', judge: 'activity', flow: 'one-at-a-time',
  moves: 'taps Strong, Moderate or Weak under each evidence sentence, then presses Check Ratings' } as const;

export const evidenceFinderCard = defineCard<EvidenceFinderMiss>({
  id: 'evidence-finder',
  grades: ['Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
  // Every step publishes levers (`evidenceFinderLevers.ts`); `wrong_claim` needs two claims, the ratings a CER passage.
  modes: {
    locate_evidence: { steps: { find: FIND }, misses: ['not_evidence', 'missed_evidence'] },
    match_evidence_to_claim: { steps: { find: FIND }, misses: FIND_MISSES },
    evaluate_evidence_strength: { steps: { find: FIND, rate: RATE }, misses: [...FIND_MISSES, ...RATE_MISSES] },
  },
  words: {
    job: 'highlight every sentence of a short informational passage that is evidence for a claim (with two claims, under '
      + 'the claim it supports), and on some passages rate how strong each piece of evidence is',
    answer: 'the learner\'s highlights (and the claim each is under) or ratings',
    question: 'the claims, the passage, each of its sentences and the three ratings (Strong, Moderate, Weak)',
  },
  levers: true,
});
