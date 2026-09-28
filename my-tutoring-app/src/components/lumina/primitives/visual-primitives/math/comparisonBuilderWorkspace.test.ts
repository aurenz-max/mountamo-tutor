import { expect, it } from 'vitest';
import { comparisonMiss } from './comparisonBuilderWorkspace';
import type { ComparisonBuilderChallenge } from './ComparisonBuilder';

const groups = (correctAnswer: 'more' | 'less' | 'equal'): ComparisonBuilderChallenge =>
  ({ id: 'g', type: 'compare-groups', instruction: '', correctAnswer });
const numbers = (correctSymbol: '<' | '>' | '='): ComparisonBuilderChallenge =>
  ({ id: 'n', type: 'compare-numbers', instruction: '', correctSymbol });
const order: ComparisonBuilderChallenge = { id: 'o', type: 'order', instruction: '', numbers: [7, 2, 9, 4], direction: 'ascending' };
const step = (askFor: 'one-more' | 'one-less' | 'both'): ComparisonBuilderChallenge =>
  ({ id: 's', type: 'one-more-one-less', instruction: '', targetNumber: 8, askFor });
const view = (v: { selected?: string; ordered?: number[]; oneMore?: number; oneLess?: number }) =>
  ({ selected: v.selected ?? null, ordered: v.ordered ?? [], oneMore: v.oneMore ?? null, oneLess: v.oneLess ?? null });

it.each([
  [groups('more'), view({ selected: 'less' }), 'reversed'], [groups('more'), view({ selected: 'equal' }), 'said_equal'],
  [groups('equal'), view({ selected: 'more' }), 'missed_equal'], [groups('less'), view({ selected: 'less' }), undefined],
  [numbers('<'), view({ selected: '>' }), 'reversed'], [numbers('>'), view({ selected: '=' }), 'said_equal'],
  [numbers('='), view({ selected: '<' }), 'missed_equal'],
  [order, view({ ordered: [9, 7, 4, 2] }), 'reversed'], [order, view({ ordered: [2, 7, 4, 9] }), 'two_swapped'],
  [order, view({ ordered: [4, 2, 7, 9] }), 'two_swapped'], [order, view({ ordered: [7, 2, 4, 9] }), 'other_order'],
  [order, view({ ordered: [2, 4, 7, 9] }), undefined],
  [step('one-more'), view({ oneMore: 7 }), 'wrong_way'], [step('one-more'), view({ oneMore: 8 }), 'no_step'],
  [step('one-more'), view({ oneMore: 10 }), 'one_over'], [step('one-less'), view({ oneLess: 6 }), 'one_short'],
  [step('one-less'), view({ oneLess: 3 }), 'short_by_more'], [step('both'), view({ oneMore: 7, oneLess: 9 }), 'wrong_way'],
  [step('both'), view({ oneMore: 9, oneLess: 8 }), 'no_step'], [step('both'), view({ oneMore: 9, oneLess: 7 }), undefined],
] as const)('row %#', (challenge, work, miss) => {
  expect(comparisonMiss(challenge, work)).toBe(miss);
});
