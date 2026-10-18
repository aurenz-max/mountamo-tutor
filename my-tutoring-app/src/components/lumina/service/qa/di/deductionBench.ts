/**
 * deductionBench — the fixture rules for di-deduction's item-builder tests.
 *
 * Each rule exists for a shape the builder must handle: a rule with NO lookalike (insects / six legs) builds
 * no cannot_tell case at all — the plan refuses it rather than shipping a vague reason — and two rules with
 * real, checkable lookalikes (birds / lay eggs → turtle; fish / live in water → whale) build all three shapes.
 * Every fact here was checked by eye as a grade-3 text would state it.
 */

import type { DeductionRuleSpec } from '../../../primitives/visual-primitives/direct-instruction/diDeductionScript';

/** The fixture rules. Ids are stable; item ids derive from them. */
export const DEDUCTION_BENCH_RULES: DeductionRuleSpec[] = [
  // All insects have six legs. No lookalike a child knows → no cannot_tell
  // case; the rule ships conclude + deny only.
  {
    id: 'ddb-insects',
    category: 'insect',
    categoryPlural: 'insects',
    propertyPlural: 'have six legs',
    propertySingular: 'has six legs',
    propertyNegated: 'does not have six legs',
    kindNoun: 'animal',
    members: ['beetle', 'ant'],
    nonMembers: ['spider', 'snail'],
    lookalikes: [],
  },
  // All birds lay eggs. Lookalike: a turtle lays eggs and is not a bird.
  {
    id: 'ddb-birds',
    category: 'bird',
    categoryPlural: 'birds',
    propertyPlural: 'lay eggs',
    propertySingular: 'lays eggs',
    propertyNegated: 'does not lay eggs',
    kindNoun: 'animal',
    members: ['robin', 'penguin'],
    nonMembers: ['dog', 'cow'],
    lookalikes: ['turtle', 'frog'],
  },
  // All fish live in water. Lookalike: a whale lives in water and is not a fish.
  {
    id: 'ddb-fish',
    category: 'fish',
    categoryPlural: 'fish',
    propertyPlural: 'live in water',
    propertySingular: 'lives in water',
    propertyNegated: 'does not live in water',
    kindNoun: 'animal',
    members: ['shark', 'goldfish'],
    nonMembers: ['camel', 'eagle'],
    lookalikes: ['whale', 'frog'],
  },
];
