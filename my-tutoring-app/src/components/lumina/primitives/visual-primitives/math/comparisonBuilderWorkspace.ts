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
