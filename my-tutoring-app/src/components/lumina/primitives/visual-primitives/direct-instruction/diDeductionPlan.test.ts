/**
 * The case shapes are the pedagogy's ground truth, so their gates are pinned
 * here rather than trusted: a rule that slips one of them hands the judge a
 * discrimination the bench never measured.
 */

import { describe, it, expect } from 'vitest';
import {
  casesFor,
  findRuleDefects,
  normalizeEntity,
  planCases,
  ruleTextOf,
  sanitizeRule,
  withArticle,
  type DeductionRuleSpec,
} from './diDeductionPlan';

const BIRDS: DeductionRuleSpec = {
  id: 'birds',
  category: 'bird',
  categoryPlural: 'birds',
  propertyPlural: 'lay eggs',
  propertySingular: 'lays eggs',
  propertyNegated: 'does not lay eggs',
  kindNoun: 'animal',
  members: ['robin', 'penguin'],
  nonMembers: ['dog', 'cow'],
  lookalikes: ['turtle', 'frog'],
};

describe('words', () => {
  it('supplies the article and builds the rule sentence in code', () => {
    expect(withArticle('beetle')).toBe('a beetle');
    expect(withArticle('ant')).toBe('an ant');
    expect(ruleTextOf(BIRDS)).toBe('All birds lay eggs.');
  });
  it('normalizes an entity: article stripped, lowercased, trailing period gone', () => {
    expect(normalizeEntity(' A Beetle. ')).toBe('beetle');
    expect(normalizeEntity('the  honey bee')).toBe('honey bee');
    expect(normalizeEntity(42)).toBe('');
  });
});

describe('findRuleDefects — the content gates', () => {
  it('passes a clean rule', () => {
    expect(findRuleDefects(BIRDS)).toEqual([]);
  });
  it('refuses a negation that does not negate', () => {
    expect(findRuleDefects({ ...BIRDS, propertyNegated: 'lays eggs' })).toContain('propertyNegated "lays eggs" carries no negation');
  });
  it('refuses a negated property — a rule states what every member HAS', () => {
    expect(findRuleDefects({ ...BIRDS, propertyPlural: 'do not have fur', propertySingular: 'does not have fur' }).join(' '))
      .toMatch(/property itself is negated/);
  });
  it('refuses an entity in two lists, and the category as an entity', () => {
    expect(findRuleDefects({ ...BIRDS, lookalikes: ['dog'] })).toContain('"dog" appears in both nonMembers and lookalikes');
    expect(findRuleDefects({ ...BIRDS, members: ['bird'] })).toContain('members: "bird" is the category itself');
  });
  it('refuses an entity the rule text names (leak)', () => {
    expect(findRuleDefects({ ...BIRDS, propertyPlural: 'lay eggs like a turtle' })).toContain('the rule text names "turtle" (leak)');
  });
  it('refuses unsayable entities and a rule with no member', () => {
    expect(findRuleDefects({ ...BIRDS, members: ['a very long bird name'] }).join(' ')).toMatch(/longer than 3 words/);
    expect(findRuleDefects({ ...BIRDS, members: ['R2-D2!'] }).join(' ')).toMatch(/not a sayable noun/);
    expect(findRuleDefects({ ...BIRDS, members: [] })).toContain('no members');
    expect(findRuleDefects({ ...BIRDS, kindNoun: 'living thing' })).toContain('kindNoun must be one word');
  });
});

describe('sanitizeRule — normalize, cap, keep-or-drop', () => {
  it('normalizes model output and caps every list at three', () => {
    const rule = sanitizeRule({
      category: ' Bird', categoryPlural: 'Birds', propertyPlural: 'lay eggs.', propertySingular: 'Lays eggs',
      propertyNegated: "doesn't lay eggs", kindNoun: 'Animal',
      members: ['A robin', 'the penguin', 'robin', 'ostrich', 'duck', 'hen'],
      nonMembers: ['Dog'], lookalikes: ['Turtle'], shapes: ['deny', 'bogus'],
    }, 'r1')!;
    expect(rule).not.toBeNull();
    expect(rule.category).toBe('bird');
    expect(rule.propertyNegated).toBe("doesn't lay eggs");
    expect(rule.members).toEqual(['robin', 'penguin', 'ostrich']);
    expect(rule.shapes).toEqual(['deny']);
  });
  it('returns null on any defect — never a patched rule', () => {
    expect(sanitizeRule({ ...BIRDS, propertyNegated: 'lays eggs' }, 'r2')).toBeNull();
  });
});

describe('the three case shapes', () => {
  it('builds conclude from members and deny from non-members, with the article', () => {
    expect(casesFor(BIRDS, 'conclude', 2)).toEqual([
      { shape: 'conclude', subject: 'a robin', caseText: 'A robin is a bird.', conclusionText: 'A robin lays eggs.', verdict: null, lookalike: null },
      { shape: 'conclude', subject: 'a penguin', caseText: 'A penguin is a bird.', conclusionText: 'A penguin lays eggs.', verdict: null, lookalike: null },
    ]);
    expect(casesFor(BIRDS, 'deny', 1)).toEqual([
      { shape: 'deny', subject: 'a dog', caseText: 'A dog does not lay eggs.', conclusionText: 'A dog is not a bird.', verdict: 'no', lookalike: null },
    ]);
  });
  it('builds ONE cannot_tell case with an ANONYMOUS subject and the first lookalike', () => {
    expect(casesFor(BIRDS, 'cannot_tell', 2)).toEqual([{
      shape: 'cannot_tell',
      subject: 'this animal',
      caseText: 'This animal lays eggs.',
      conclusionText: "Can't tell: the rule does not say only birds lay eggs.",
      verdict: 'cannot_tell',
      lookalike: 'turtle',
    }]);
  });
  it('builds NO cannot_tell case when the rule has no lookalike — refused, not vague', () => {
    expect(casesFor({ ...BIRDS, lookalikes: [] }, 'cannot_tell', 1)).toEqual([]);
  });
  it('works a rule through every shape once in the DI order, or one shape twice', () => {
    expect(planCases(BIRDS).map((c) => `${c.shape}:${c.subject}`)).toEqual([
      'conclude:a robin', 'deny:a dog', 'cannot_tell:this animal',
    ]);
    expect(planCases({ ...BIRDS, shapes: ['deny'] }).map((c) => c.subject)).toEqual(['a dog', 'a cow']);
    expect(planCases({ ...BIRDS, shapes: ['cannot_tell', 'conclude'] }).map((c) => c.shape)).toEqual(['conclude', 'cannot_tell']);
  });
});
