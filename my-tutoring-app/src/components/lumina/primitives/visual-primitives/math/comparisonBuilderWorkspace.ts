/**
 * Comparison builder on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md).
 *
 * Pure: the component and any probe read the same assignment and scene. A tap is checked by the primitive's own
 * check. A challenge whose answer is one sayable thing (which group has more, how two numbers compare, the one number
 * one more or one less) may also be said aloud: the item is spoken with `acceptsGesture`, and JEV judges it from the
 * tutor's feedback against `expectedAnswer` (as math-fact-fluency, 2026-10-13). Order and a one-more-and-one-less pair
 * are several answers at once: they stay tap-only, and the tutor is never handed the sorted order or target +/- 1.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { offByMisses, spokenNumber, type KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { ComparisonBuilderChallenge } from './ComparisonBuilder';

/** Whether this challenge's answer is one thing a learner can say. */
export const isSpokenComparison = (c: ComparisonBuilderChallenge) => c.type === 'compare-groups'
  || c.type === 'compare-numbers' || (c.type === 'one-more-one-less' && askOf(c) !== 'both');

const groupName = (c: ComparisonBuilderChallenge, side: 'left' | 'right') => {
  const g = side === 'left' ? c.leftGroup : c.rightGroup, other = side === 'left' ? c.rightGroup : c.leftGroup;
  return g?.objectType && g.objectType !== other?.objectType ? `the ${side} group (the ${g.objectType})` : `the ${side} group`;
};

const RELATION: Record<string, string> = { '>': 'greater than', '<': 'less than', '=': 'equal to' };

/** The one answer a spoken comparison is judged against, with the natural ways a learner says it. */
export function comparisonExpectedAnswer(c: ComparisonBuilderChallenge): string | undefined {
  if (c.type === 'compare-groups') {
    const l = c.leftGroup?.count, r = c.rightGroup?.count, left = groupName(c, 'left'), right = groupName(c, 'right');
    if (c.correctAnswer === 'equal') return `the same (${left} and ${right} both have ${l}); said as "the same", "equal", `
      + '"they are the same" or "neither has more"';
    const [more, fewer] = c.correctAnswer === 'more' ? [left, right] : [right, left];
    return `${more} has more and ${fewer} has fewer (left ${l} vs right ${r}); said as "more" or "fewer"/"less" for the `
      + `group the question asks about, or by naming ${more} as the one with more (or ${fewer} as the one with fewer)`;
  }
  if (c.type === 'compare-numbers') {
    const a = c.leftNumber, b = c.rightNumber, s = c.correctSymbol ?? '=';
    if (s === '=') return `${a} is equal to ${b} (${a} = ${b}); said as "equal", "the same" or "${a} equals ${b}"`;
    const [big, small] = s === '>' ? [a, b] : [b, a];
    return `${a} is ${RELATION[s]} ${b} (${a} ${s} ${b}); said as "${RELATION[s]}", "${big} is bigger", `
      + `"${big} is more than ${small}", "${small} is less than ${big}", or naming ${big} as the bigger number`;
  }
  if (isSpokenComparison(c)) {
    const t = c.targetNumber ?? 0, more = askOf(c) === 'one-more', n = more ? t + 1 : t - 1;
    return `${n} (one ${more ? 'more' : 'less'} than ${t} is ${n}), said as a number, digits or words`;
  }
  return undefined;
}

/**
 * A spoken answer's known wrong answers, with the tap's ids (`comparisonMiss`, the catalog's lists), most specific
 * first. Each pattern names the wrong answer the learner gives.
 */
export function comparisonSpokenMisses(c: ComparisonBuilderChallenge): KnownMiss[] {
  if (c.type === 'compare-groups') {
    if (c.correctAnswer === 'equal') return [{ id: 'missed_equal', pattern: 'The groups are equal, but the learner says '
      + 'one group has more or fewer than the other (or names one group as the bigger one).', examples: ['more', 'fewer', 'the left one'] }];
    const [more, fewer] = c.correctAnswer === 'more' ? ['left', 'right'] : ['right', 'left'];
    return [
      { id: 'said_equal', pattern: 'The learner says the two groups are the same or equal, though they are not.', examples: ['the same', 'equal'] },
      { id: 'reversed', pattern: `The learner says the ${fewer} group has more (or the ${more} group has fewer): the opposite relation.`,
        examples: [c.correctAnswer === 'more' ? 'fewer' : 'more', `the ${fewer} one`] },
    ];
  }
  if (c.type === 'compare-numbers') {
    const a = c.leftNumber ?? 0, b = c.rightNumber ?? 0;
    if (c.correctSymbol === '=') return [{ id: 'missed_equal', pattern: `${a} and ${b} are equal, but the learner says one `
      + 'is greater or less than the other.', examples: ['greater than', 'less than'] }];
    const [big, small] = c.correctSymbol === '>' ? [a, b] : [b, a];
    return [
      { id: 'said_equal', pattern: `The learner says ${a} and ${b} are equal or the same.`, examples: ['equal', 'the same'] },
      { id: 'reversed', pattern: `The learner says ${small} is the bigger number (or ${big} the smaller): the opposite relation.`,
        examples: [`${spokenNumber(small)} is bigger`, c.correctSymbol === '>' ? 'less than' : 'greater than'] },
    ];
  }
  if (!isSpokenComparison(c)) return [];
  const t = c.targetNumber ?? 0, more = askOf(c) === 'one-more', back = more ? t - 1 : t + 1;
  const own: KnownMiss[] = [{ id: 'no_step', pattern: `The learner's answer is ${t}, the number itself, with no step.`, examples: [spokenNumber(t)] },
    ...(back >= 1 ? [{ id: 'wrong_way', pattern: `The learner's answer is ${back}, one ${more ? 'less' : 'more'} than ${t}: a step the other way.`,
      examples: [spokenNumber(back)] }] : [])];
  // The off-by entry that lands on the number itself is the no-step miss above.
  return [...own, ...offByMisses(more ? t + 1 : t - 1, `the number one ${more ? 'more' : 'less'} than ${t}`)
    .filter(m => m.id !== (more ? 'one_short' : 'one_over'))];
}

export function workspaceAssignment(challenge: ComparisonBuilderChallenge): TeachingAssignment {
  const expectedAnswer = comparisonExpectedAnswer(challenge);
  if (!expectedAnswer) return { id: challenge.id, task: challenge.instruction, response: 'gesture' };
  const how = challenge.type === 'one-more-one-less' ? 'saying the number, or tapping it'
    : 'saying it, or tapping the choice on the screen';
  return { id: challenge.id, task: `${challenge.instruction} The learner answers by ${how}.`,
    response: 'speech', acceptsGesture: true, expectedAnswer, misses: comparisonSpokenMisses(challenge) };
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

/** What a spoken mode's answer is, which the scene withholds until the learner answers. */
const WITHHELD: Record<ComparisonBuilderChallenge['type'], string> = {
  'compare-groups': 'which group has more or fewer, or whether they are the same',
  'compare-numbers': 'which number is bigger, the relation or the symbol',
  'one-more-one-less': 'the number asked for', order: 'the order',
};

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
      constraints: isSpokenComparison(challenge)
        ? 'The learner says the answer or taps it on the screen (a side, a number or a symbol, then Check where there is '
          + `one); a tap is checked by the activity. Before the learner answers, never name ${WITHHELD[challenge.type]}. `
          + 'You cannot tap or choose anything for the learner.'
        : 'The learner answers by tapping on the screen (number cards or number cells, then Check where there is one); '
          + 'the activity checks the work itself. You cannot tap, choose or order anything for the learner.',
    },
  };
}
