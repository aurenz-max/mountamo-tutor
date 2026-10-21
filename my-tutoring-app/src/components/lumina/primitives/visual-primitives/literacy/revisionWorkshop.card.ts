/**
 * revision-workshop's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `revisionWorkshop.boss.ts`.
 * The five revision skills (add details, word choice, combine sentences, transitions, concision) each mark one sentence
 * of a draft; the learner types a revision of it, code checks it changed and fits the skill's shape, then the shared
 * writing judge checks it does the job (`revisionSteps.ts`). reorganize orders the draft's sentences, checked whole in
 * code against the one order that makes sense: one item at a time, never a board (a count of sentences in the right
 * place would name the order).
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong revision shows (`revisionShapeMiss`, then the judge's verdict): `unchanged`, `too_short`,
 * `not_combined` (a combine still more than one sentence), `not_shorter` (a concise one with as many words or more),
 * `not_sense`, `wrong_job`. reorganize: `wrong_order`.
 */
export type RevisionMiss = 'unchanged' | 'too_short' | 'not_combined' | 'not_shorter' | 'not_sense' | 'wrong_job' | 'wrong_order';

const TYPED: readonly RevisionMiss[] = ['unchanged', 'too_short', 'not_sense', 'wrong_job'];

/** Each mode's misses, in the order the check names them. */
export const REVISION_MISSES_BY_MODE: Readonly<Record<string, readonly RevisionMiss[]>> = {
  add_details: TYPED,
  word_choice: TYPED,
  combine_sentences: ['unchanged', 'too_short', 'not_combined', 'not_sense', 'wrong_job'],
  transitions: TYPED,
  reorganize: ['wrong_order'],
  concision: ['unchanged', 'too_short', 'not_shorter', 'not_sense', 'wrong_job'],
};

const revise = (mode: string) => ({
  answer: 'type', judge: 'activity', flow: 'one-at-a-time',
  moves: 'types a revision of the marked sentence in the box, then presses "I\'m done!"',
  misses: REVISION_MISSES_BY_MODE[mode],
} as const);

export const revisionWorkshopCard = defineCard<RevisionMiss>({
  id: 'revision-workshop',
  grades: ['Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
  // Every mode publishes levers (`revisionWorkshopLevers.ts`).
  modes: {
    add_details: revise('add_details'),
    word_choice: revise('word_choice'),
    combine_sentences: revise('combine_sentences'),
    transitions: revise('transitions'),
    reorganize: { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time', misses: REVISION_MISSES_BY_MODE.reorganize,
      moves: 'taps the draft\'s sentences into the order that makes sense (tapping a placed sentence takes it back), then '
        + 'presses "I\'m done!"' },
    concision: revise('concision'),
  },
  words: {
    job: 'revise one marked sentence of a draft (add a detail, use a stronger word, join sentences into one, add a '
      + 'transition, or say it in fewer words), or put a draft\'s sentences in the order that makes sense',
    answer: 'the learner\'s revised sentence or order',
    question: 'the task, the draft, the marked sentence and every sentence to order',
  },
  levers: true,
});
