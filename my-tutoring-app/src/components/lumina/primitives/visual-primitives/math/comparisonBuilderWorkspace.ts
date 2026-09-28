/**
 * Comparison builder on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md).
 *
 * Pure: the component and any probe read the same assignment and scene. Every challenge is
 * answered by a tap on the screen and checked by the primitive's own check, so the tutor is never
 * handed `correctAnswer`, `correctSymbol`, the sorted order or target +/- 1.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { ComparisonBuilderChallenge } from './ComparisonBuilder';

export function workspaceAssignment(challenge: ComparisonBuilderChallenge): TeachingAssignment {
  return { id: challenge.id, task: challenge.instruction, response: 'gesture' };
}

export interface ComparisonView {
  /** The comparison word ('more' | 'less' | 'equal') or symbol ('<' | '>' | '=') chosen. */
  selected: string | null;
  ordered: readonly number[];
  oneMore: number | null;
  oneLess: number | null;
  /** The numbers in the order the cards are drawn (order challenges). */
  shuffled: readonly number[];
  /** Whether the "Left: N / Right: N" count badges are on screen. */
  countsShown: boolean;
}

const GROUP_WORDS: Record<string, string> = {
  more: 'the left group has more', less: 'the left group has fewer', equal: 'the two groups are the same' };
const askOf = (c: ComparisonBuilderChallenge) => c.askFor ?? 'both';

/** The learner's work in their own terms, never the key. */
export function describeComparison(challenge: ComparisonBuilderChallenge, view: Pick<ComparisonView,
  'selected' | 'ordered' | 'oneMore' | 'oneLess'>): string {
  switch (challenge.type) {
    case 'compare-groups':
      return view.selected ? `Chose: ${GROUP_WORDS[view.selected] ?? view.selected}` : 'Nothing chosen yet';
    case 'compare-numbers':
      return view.selected
        ? `Chose: ${challenge.leftNumber} ${view.selected} ${challenge.rightNumber}` : 'No symbol chosen yet';
    case 'order':
      return view.ordered.length ? `Placed in order: ${view.ordered.join(', ')}` : 'Nothing placed yet';
    default: {
      const parts: string[] = [];
      if (askOf(challenge) !== 'one-less') parts.push(`one more: ${view.oneMore ?? 'not chosen yet'}`);
      if (askOf(challenge) !== 'one-more') parts.push(`one less: ${view.oneLess ?? 'not chosen yet'}`);
      return `Chose ${parts.join('; ')}`;
    }
  }
}

/**
 * What a wrong answer shows (`TeachingAttempt.miss`, handoff 20), by the kind of choice, never the option:
 * - compare-groups / compare-numbers: `said_equal` (same chosen for unequal), `missed_equal` (more or fewer, or
 *   a < or >, chosen for equal), `reversed` (the opposite relation);
 * - order: `reversed` (the other direction), `two_swapped`, `other_order`;
 * - one-more-one-less: `no_step` (the number itself), `wrong_way` (one the other way, or the two answers
 *   exchanged), `one_short` / `one_over` / `short_by_more` / `over_by_more` (from the right number).
 */
export type ComparisonMiss = 'said_equal' | 'missed_equal' | 'reversed' | 'two_swapped' | 'other_order'
  | 'no_step' | 'wrong_way' | 'one_short' | 'one_over' | 'short_by_more' | 'over_by_more';

const relationMiss = (chosen: string | null, key: string | undefined, equal: string): ComparisonMiss | undefined =>
  !chosen || chosen === key ? undefined : chosen === equal ? 'said_equal' : key === equal ? 'missed_equal' : 'reversed';

const stepMiss = (got: number | null, target: number, step: 1 | -1): ComparisonMiss | undefined => {
  if (got === null || got === target + step) return undefined;
  if (got === target) return 'no_step';
  if (got === target - step) return 'wrong_way';
  const off = got - (target + step);
  return off === -1 ? 'one_short' : off === 1 ? 'one_over' : off < 0 ? 'short_by_more' : 'over_by_more';
};

export function comparisonMiss(challenge: ComparisonBuilderChallenge | null, view: Pick<ComparisonView,
  'selected' | 'ordered' | 'oneMore' | 'oneLess'>): ComparisonMiss | undefined {
  if (!challenge) return undefined;
  switch (challenge.type) {
    case 'compare-groups': return relationMiss(view.selected, challenge.correctAnswer, 'equal');
    case 'compare-numbers': return relationMiss(view.selected, challenge.correctSymbol, '=');
    case 'order': {
      const want = [...(challenge.numbers ?? [])].sort((a, b) => challenge.direction === 'descending' ? b - a : a - b);
      if (want.every((n, i) => view.ordered[i] === n)) return undefined;
      if (want.every((n, i) => view.ordered[i] === want[want.length - 1 - i])) return 'reversed';
      return want.filter((n, i) => view.ordered[i] !== n).length === 2 ? 'two_swapped' : 'other_order';
    }
    default: {
      const t = challenge.targetNumber ?? 0, ask = askOf(challenge);
      if (ask === 'both' && view.oneMore === t - 1 && view.oneLess === t + 1) return 'wrong_way';
      return (ask !== 'one-less' ? stepMiss(view.oneMore, t, 1) : undefined)
        ?? (ask !== 'one-more' ? stepMiss(view.oneLess, t, -1) : undefined);
    }
  }
}

/** What is drawn and asked. Counts only where the screen shows them. */
export function workspaceScene(challenge: ComparisonBuilderChallenge, view: ComparisonView): WorkspaceScene {
  const drawn: Record<string, string | number> = {};
  if (challenge.type === 'compare-groups') {
    drawn.groups = `left: ${challenge.leftGroup?.objectType ?? 'objects'}, right: ${challenge.rightGroup?.objectType ?? 'objects'}`;
    if (view.countsShown) drawn.countsOnScreen = `left ${challenge.leftGroup?.count}, right ${challenge.rightGroup?.count}`;
  } else if (challenge.type === 'compare-numbers') {
    drawn.numbers = `${challenge.leftNumber} on the left, ${challenge.rightNumber} on the right`;
  } else if (challenge.type === 'order') {
    drawn.cards = view.shuffled.join(', ');
    drawn.direction = challenge.direction === 'descending' ? 'greatest to least' : 'least to greatest';
  } else {
    drawn.target = challenge.targetNumber ?? '';
    drawn.asks = askOf(challenge) === 'both' ? 'one more and one less' : askOf(challenge) === 'one-more' ? 'one more' : 'one less';
  }
  return {
    objects: [],
    facts: {
      kind: challenge.type, ...drawn,
      learnerWork: describeComparison(challenge, view),
      constraints: 'The learner answers by tapping on the screen (a side, a number, a symbol or number cards, then Check '
        + 'where there is one); the activity checks the work itself. You cannot tap, choose or order anything for the learner.',
    },
  };
}
