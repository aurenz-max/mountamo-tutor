/**
 * Comparison builder's live-tutor misstep inventory (see `/add-live-tutor-tools`).
 *
 * A dedicated module rather than a section of a script file, because this is a
 * TUTOR-LED primitive: there is no judged runner and therefore no `correctionFor`
 * for these aids to sit beside. The component's own feedback line states the
 * verdict; these aids name the MISSTEP and never state the answer.
 *
 * "The answer" is a different shape on each mode here, and every one of them is
 * guarded: a comparison WORD on compare-groups, a SYMBOL on compare-numbers, an
 * ARRANGEMENT on order and a NUMBER on one-more-one-less. That is why not one
 * line below contains "more", "less", "equal", a comparison symbol or a numeral.
 *
 * Missteps deliberately left to another lane:
 *   - "cannot count either group" — between-item remediation, and the wrong
 *     skill besides; this primitive assumes counting and teaches comparison.
 *   - "needs the correspondence lines, the count badges or the target marker" —
 *     those are support-tier levers (`correspondenceMode`, `showCountBadges`,
 *     `showTargetMarker`), a difficulty axis rather than an error response.
 *   - "tapped the wrong object by accident" — a slip, not a misconception; the
 *     learner's own clear control, which `retry` calls, is what answers it.
 */
import { resolveScaffolds, type LiveScaffold } from '../../../components/live-activity/runtime/liveScaffolds';
import type { ComparisonBuilderChallenge } from './ComparisonBuilder';

/** What the child has actually done on this item, as the adapter publishes it. */
export interface ComparisonMisstepEvidence {
  /** Whether the last committed check was judged wrong. Every aid gates on it. */
  wrongNow: boolean;
  /** The comparison word or symbol currently chosen. */
  selected: string | null;
  /** order: the numbers currently in the slots, in the child's order. */
  ordered: readonly number[];
  /** one-more-one-less: what the child put in each box. */
  oneMore: number | null;
  oneLess: number | null;
}

export type ComparisonScaffold = LiveScaffold<ComparisonBuilderChallenge, ComparisonMisstepEvidence>;

/** The arrangement this challenge is asking for. */
const targetOrder = (c: ComparisonBuilderChallenge): number[] => {
  const numbers = [...(c.numbers ?? [])];
  return c.direction === 'descending' ? numbers.sort((a, b) => b - a) : numbers.sort((a, b) => a - b);
};
const sameOrder = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((n, i) => n === b[i]);

/**
 * One method reminder per challenge type. `order` branches on its own direction,
 * because "smallest first" is the method on one and the misstep on the other.
 */
const METHOD: Record<ComparisonBuilderChallenge['type'], ComparisonScaffold> = {
  'compare-groups': { strategyId: 'match-them-up-side-by-side', when: 'the child needs the method again',
    hint: () => 'Put them side by side and match them up. Then look at which row runs out first.' },
  'compare-numbers': { strategyId: 'the-open-end-faces-the-bigger', when: 'the child needs the method again',
    hint: () => 'The wide open end of the sign always goes next to the bigger number.' },
  order: { strategyId: 'start-at-one-end-and-keep-going', when: 'the child needs the method again',
    hint: c => c.direction === 'descending'
      ? 'Find the biggest number and put it first, then keep going down.'
      : 'Find the smallest number and put it first, then keep going up.' },
  'one-more-one-less': { strategyId: 'step-along-the-line', when: 'the child needs the method again',
    hint: () => 'Find the target on the number line, then take a single step along it.' },
};

/**
 * The error-specific aids, offered only once the published evidence fits. Each
 * `when` states the CONDITION, because the model routes on that sentence.
 */
const AIDS: readonly ComparisonScaffold[] = [
  // compare-groups — the two errors this mode actually produces.
  { strategyId: 'the-rows-do-not-run-out-together', when: 'the child said the groups match when they do not',
    hint: () => 'Count each group again. Check whether the rows really do run out together.',
    matches: (c, e) => e.wrongNow && c.type === 'compare-groups' && e.selected === 'equal'
      && (c.leftGroup?.count ?? 0) !== (c.rightGroup?.count ?? 0) },
  { strategyId: 'watch-which-row-runs-out-first', when: 'the child chose the opposite comparison',
    hint: () => 'Line them up again and watch which row runs out first. That row is the smaller group.',
    matches: (c, e) => e.wrongNow && c.type === 'compare-groups' && !!e.selected
      && e.selected !== 'equal' && e.selected !== c.correctAnswer },

  // compare-numbers — same two errors, in the symbol vocabulary.
  { strategyId: 'read-both-numbers-out-loud', when: 'the child said the numbers match when they do not',
    hint: () => 'Read both numbers out loud, and check whether they really are the same number.',
    matches: (c, e) => e.wrongNow && c.type === 'compare-numbers' && e.selected === '='
      && c.leftNumber !== c.rightNumber },
  { strategyId: 'the-sign-is-facing-the-wrong-way', when: 'the child picked the sign pointing the other way',
    hint: () => 'You picked the sign pointing the other way. The wide open end goes next to the bigger number.',
    matches: (c, e) => e.wrongNow && c.type === 'compare-numbers' && !!e.selected
      && e.selected !== '=' && e.selected !== c.correctSymbol },

  // order — the arrangement is the evidence.
  { strategyId: 'you-sorted-the-other-way', when: 'the child put them in the opposite order',
    hint: () => 'You put them in the other order. Check whether I asked for smallest first or biggest first.',
    matches: (c, e) => e.wrongNow && c.type === 'order' && e.ordered.length > 1
      && sameOrder(e.ordered, [...targetOrder(c)].reverse()) },
  { strategyId: 'every-number-needs-a-place', when: 'the child left part of the row empty',
    hint: () => 'There are still numbers waiting. Every number has a place in the row.',
    matches: (c, e) => e.wrongNow && c.type === 'order'
      && e.ordered.length > 0 && e.ordered.length < (c.numbers?.length ?? 0) },

  // one-more-one-less — the target is public, so saying it back is distinct from
  // stepping the wrong way.
  { strategyId: 'that-is-the-number-i-said', when: 'the child gave back the number the question named',
    hint: () => 'That is the number I said. Take a step away from it.',
    matches: (c, e) => e.wrongNow && c.type === 'one-more-one-less'
      && (e.oneMore === c.targetNumber || e.oneLess === c.targetNumber) },
  { strategyId: 'check-which-way-i-asked', when: 'the child stepped the wrong way along the line',
    hint: () => 'You stepped the other way. Check whether I asked you to go up or to go down.',
    matches: (c, e) => {
      if (!e.wrongNow || c.type !== 'one-more-one-less' || typeof c.targetNumber !== 'number') return false;
      return e.oneMore === c.targetNumber - 1 || e.oneLess === c.targetNumber + 1;
    } },
];

/** The type's method reminder plus every aid whose evidence currently fits. */
export function comparisonScaffoldsFor(challenge: ComparisonBuilderChallenge | null | undefined,
  evidence: ComparisonMisstepEvidence): ComparisonScaffold[] {
  return resolveScaffolds(challenge, evidence, challenge ? METHOD[challenge.type] : undefined, AIDS);
}
