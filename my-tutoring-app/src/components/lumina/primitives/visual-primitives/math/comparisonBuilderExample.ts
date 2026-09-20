/**
 * Comparison builder's prepared contrast pair (see `/add-live-tutor-tools`).
 *
 * The one shape a single row of counters cannot draw is a relationship BETWEEN
 * two collections, which is the whole of what this primitive teaches. A contrast
 * pair stacks two rows so their columns line up and rings the counters that have
 * no partner: the "match them up and see which row runs out first" method, drawn.
 *
 * NEARBY, NEVER THIS ITEM. Neither count in the pair is a number the current
 * challenge asks about, so the child still has to match up THEIR groups; what
 * they take back is the method and the words. The exposure is declared `partial`
 * rather than `none`, matching number-bond's prepared example: the vocabulary of
 * the answer ("more", ">", "one more") is spoken, about a different pair.
 *
 * `order` gets nothing. Two rows cannot show an ordering of three or more, and an
 * example that showed two would be teaching comparison beside an ordering task.
 */
import type { ContrastPairSupport, ContrastPanel } from '../../../components/live-activity/runtime/contract';
import type { ComparisonBuilderChallenge } from './ComparisonBuilder';

const isNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Every number the current challenge is about, so the example can avoid them all. */
export function ownNumbers(c: ComparisonBuilderChallenge): number[] {
  switch (c.type) {
    case 'compare-groups': return [c.leftGroup?.count, c.rightGroup?.count].filter(isNumber);
    case 'compare-numbers': return [c.leftNumber, c.rightNumber].filter(isNumber);
    case 'one-more-one-less':
      return isNumber(c.targetNumber) ? [c.targetNumber - 1, c.targetNumber, c.targetNumber + 1] : [];
    default: return (c.numbers ?? []).filter(isNumber);
  }
}

// Candidate pairs in preference order, all within ten so a five-year-old can read
// the rows at a glance. The first pair that shares no number with the item wins.
const UNEQUAL: ReadonlyArray<readonly [number, number]> =
  [[6, 4], [5, 3], [7, 4], [8, 5], [4, 2], [9, 6], [3, 1], [7, 5], [10, 7], [5, 2]];
const EQUAL: readonly number[] = [4, 5, 3, 6, 7, 2];
const ADJACENT: ReadonlyArray<readonly [number, number]> =
  [[5, 6], [3, 4], [7, 8], [2, 3], [8, 9], [4, 5], [6, 7], [1, 2]];

const row = (count: number, highlighted: number): ContrastPanel =>
  ({ kind: 'counters', label: String(count), count, highlighted });
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const base = (c: ComparisonBuilderChallenge, suffix: string) =>
  ({ id: `contrast-${c.id}-${suffix}`, kind: 'contrast-pair' as const, provenance: 'prepared' as const,
    answerExposure: 'partial' as const });

/** Two rows, the bigger on top, its unpartnered tail ringed. */
function unequal(c: ComparisonBuilderChallenge, own: readonly number[]): ContrastPairSupport | null {
  const pair = UNEQUAL.find(([a, b]) => !own.includes(a) && !own.includes(b));
  if (!pair) return null;
  const [big, small] = pair, extra = big - small;
  const altText = `Two rows of counters lined up. The top row has ${big} and the bottom row has ${small}. `
    + `The last ${plural(extra, 'counter', 'counters')} of the top row ${extra === 1 ? 'is' : 'are'} ringed because nothing sits under ${extra === 1 ? 'it' : 'them'}.`;
  if (c.type === 'compare-numbers') return { ...base(c, 'unequal'), title: 'Compare a different pair',
    panels: [row(big, extra), row(small, 0)], altText,
    caption: `${big} is bigger than ${small}, so the open end of the sign faces the ${big}: ${big} > ${small}.` };
  return { ...base(c, 'unequal'), title: 'Match up a different pair',
    panels: [row(big, extra), row(small, 0)], altText,
    caption: `${big} is more than ${small}. Match them up and ${extra === 1 ? 'one is' : `${extra} are`} left over.` };
}

/** Two rows the same length: every counter has a partner, nothing is ringed. */
function equal(c: ComparisonBuilderChallenge, own: readonly number[]): ContrastPairSupport | null {
  const n = EQUAL.find(v => !own.includes(v));
  if (n === undefined) return null;
  return { ...base(c, 'equal'), title: 'A pair that matches exactly',
    panels: [row(n, 0), row(n, 0)],
    caption: `${n} and ${n} are the same. Every counter has a partner and nothing is left over.`,
    altText: `Two rows of counters lined up, ${n} in each. Every counter in the top row has one directly under it, and nothing is ringed.` };
}

/** Two rows that differ by exactly one, with the single unpartnered counter ringed. */
function adjacent(c: ComparisonBuilderChallenge, own: readonly number[]): ContrastPairSupport | null {
  const pair = ADJACENT.find(([a, b]) => !own.includes(a) && !own.includes(b));
  if (!pair) return null;
  const [less, more] = pair;
  const oneLess = c.askFor === 'one-less';
  return { ...base(c, 'adjacent'), title: oneLess ? 'One less, on a different number' : 'One more, on a different number',
    // The ringed counter sits on the bigger row either way; which row is read first
    // follows the direction the item asks about.
    panels: oneLess ? [row(more, 1), row(less, 0)] : [row(less, 0), row(more, 1)],
    caption: oneLess
      ? `${less} is one less than ${more}. Take one counter off ${more} and you have ${less}.`
      : `${more} is one more than ${less}. Add one counter to ${less} and you have ${more}.`,
    altText: `Two rows of counters lined up, ${less} in one and ${more} in the other. `
      + `The last counter of the row of ${more} is ringed because nothing sits beside it in the other row.` };
}

/** The prepared examples for this challenge, or none where two rows cannot state its teaching. */
export function comparisonContrastFor(c: ComparisonBuilderChallenge | null | undefined): ContrastPairSupport[] {
  if (!c) return [];
  const own = ownNumbers(c);
  const artifacts = c.type === 'compare-groups' ? [unequal(c, own), equal(c, own)]
    : c.type === 'compare-numbers' ? [unequal(c, own)]
    : c.type === 'one-more-one-less' ? [adjacent(c, own)]
    : [];
  return artifacts.filter((a): a is ContrastPairSupport => a !== null);
}
