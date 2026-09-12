import { describe, expect, it } from 'vitest';
import { buildDiDrivePlan } from './diDrivePlan';

const payload = (challenges: Record<string, unknown>[]) => ({
  title: 'Number bonds',
  gradeBand: '1',
  maxNumber: 10,
  challenges,
});

describe('number-bond DI drive plan', () => {
  it('drives the same four-phase related-fact sequence as the mounted runtime', () => {
    const plan = buildDiDrivePlan('number-bond', payload([
      { id: 'related', type: 'related-fact', whole: 7, part1: 3, part2: 4, instruction: 'Use seven.' },
    ]), 'Grade 1');

    expect(plan.items.map((item) => item.answerKind)).toEqual(['gesture', 'voice', 'gesture', 'voice']);
    expect(plan.items.map((item) => item.action)).toEqual([
      'related-join', 'related-say-addend', 'related-separate', 'related-say-remainder',
    ]);
    expect(plan.items[1].answers.correct).toBe('four');
    expect(plan.items[3].answers.correct).toBe('three');
    expect(plan.items[0].gestureVerdict?.correct).toContain('matched=true');
    expect(plan.packGateIssues).toEqual([]);
  });

  it('exercises action-aware equation judging and every required family form', () => {
    const build = buildDiDrivePlan('number-bond', payload([
      { id: 'build', type: 'build-equation', whole: 7, part1: 3, part2: 4, targetEquation: '3+4=7', instruction: 'Use seven.' },
    ]), 'Grade 1');
    expect(build.items).toHaveLength(2);
    expect(build.items[1].gestureVerdict?.correct).toContain('that MATCHES');
    expect(build.items[1].gestureVerdict?.wrong).toContain('does NOT match');

    const unequal = buildDiDrivePlan('number-bond', payload([
      { id: 'family', type: 'fact-family', whole: 7, part1: 3, part2: 4,
        factFamily: ['3+4=7', '4+3=7', '7-3=4', '7-4=3'], instruction: 'Use seven.' },
    ]), 'Grade 1');
    expect(unequal.items).toHaveLength(8);
    expect(unequal.items.filter((item) => item.action?.endsWith('equation'))).toHaveLength(4);

    const equal = buildDiDrivePlan('number-bond', payload([
      { id: 'family', type: 'fact-family', whole: 6, part1: 3, part2: 3,
        factFamily: ['3+3=6', '6-3=3'], instruction: 'Use six.' },
    ]), 'Grade 1');
    expect(equal.items).toHaveLength(4);
    expect(equal.packGateIssues).toEqual([]);
  });
});
