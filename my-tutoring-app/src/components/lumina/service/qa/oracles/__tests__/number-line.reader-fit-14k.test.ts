import { describe, expect, it } from 'vitest';
import { numberLineOracle } from '../number-line';

const ctx = {
  componentId: 'number-line',
  evalMode: 'between',
  topic: 'Identify missing numbers within 120',
  gradeLevel: 'grade 1',
};

function fixture(exactTargetValue: number) {
  return {
    title: 'Missing Numbers',
    range: { min: 0, max: 120 },
    gradeBand: 'K-2',
    numberType: 'integer',
    interactionMode: 'compare',
    highlights: [],
    operations: [],
    challenges: [0, 1, 2, 3].map((index) => ({
      id: `find_between-${index}`,
      type: 'find_between',
      instruction: 'Which number is missing?',
      targetValues: [90 + index, 92 + index],
      exactTargetValue: exactTargetValue + index,
      hint: 'Count by ones.',
    })),
  };
}

describe('number-line oracle exact missing-number contract', () => {
  it('passes adjacent exact targets in the requested high-magnitude window', () => {
    expect(numberLineOracle.verify(fixture(91), ctx).violations).toEqual([]);
  });

  it('flags an exact target that is not the adjacent midpoint', () => {
    const violations = numberLineOracle.verify(fixture(90), ctx).violations;
    expect(violations.some((v) => v.check === 'answer-key-desync'
      && /single adjacent/.test(v.detail))).toBe(true);
  });
});
