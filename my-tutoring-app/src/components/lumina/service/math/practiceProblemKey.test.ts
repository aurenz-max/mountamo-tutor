import { describe, expect, it } from 'vitest';
import { checkPracticeKey, solveLinear } from './practiceProblemKey';

const body = (...s: string[]) => s.map(canonicalBody => ({ canonicalBody }));

describe('checkPracticeKey (contract G1)', () => {
  it('the 10-09 derive_medium key: a step that does not follow (m + 2 = 30 -> m = 27) makes the steps inconsistent', () => {
    const r = checkPracticeKey({
      problem: { statement: 'The beam: 4(m + 2) + 14 = 134. Find m.' }, canonicalAnswer: 'm = 27',
      steps: body('4(m + 2) + 14 = 134 -> [subtract 14 from both sides] -> 4(m + 2) = 120',
        '4(m + 2) = 120 -> [divide both sides by 4] -> m + 2 = 30',
        'm + 2 = 30 -> [subtract 2 from both sides] -> m = 27'),
    });
    expect(r).toMatchObject({ status: 'inconsistent' });
    expect(r.status === 'inconsistent' && r.reason).toMatch(/m = 27.*28/);
  });

  it('the 10-09 derive_easy key: x = 21/3 in a simplest-form problem is corrected to the last step, x = 7', () => {
    expect(checkPracticeKey({
      problem: { statement: 'Solve the linear equation $3x - 7 = 14$ for $x$. Express your answer in simplest form.' },
      canonicalAnswer: 'x = \\frac{21}{3}',
      steps: body('3x - 7 = 14 -> [add 7 to both sides] -> 3x = 21', '3x = 21 -> [divide both sides by 3] -> x = 7'),
    })).toEqual({ status: 'corrected', key: 'x = 7', reason: expect.stringMatching(/simplest/) });
  });

  it('the 10-09 derive_hard key: 3300h = 105000 -> h = 300 does not follow (h is 350/11), so the steps are inconsistent', () => {
    expect(checkPracticeKey({
      problem: { statement: 'A cooperative ... how many households h?' }, canonicalAnswer: 'h = 300',
      steps: body('12(400h - 125h) - 45000 = 60000 -> [simplify inside the parentheses] -> 12(275h) - 45000 = 60000',
        '12(275h) - 45000 = 60000 -> [multiply 12 by 275] -> 3300h - 45000 = 60000',
        '3300h - 45000 = 60000 -> [add 45000 to both sides] -> 3300h = 105000',
        '3300h = 105000 -> [divide both sides by 3300] -> h = 300'),
    })).toMatchObject({ status: 'inconsistent', reason: expect.stringMatching(/step 4/) });
  });

  it('a consistent problem keeps its key', () => {
    expect(checkPracticeKey({
      problem: { statement: 'Solve $3x - 7 = 14$ for $x$.' }, canonicalAnswer: 'x = 7',
      steps: body('3x - 7 = 14 -> [add 7 to both sides] -> 3x = 21', '3x = 21 -> [divide both sides by 3] -> x = 7'),
    })).toEqual({ status: 'ok', key: 'x = 7' });
  });

  it('a key that disagrees with consistent steps is replaced by the last step', () => {
    expect(checkPracticeKey({ problem: { statement: 'Solve 2x + 1 = 9.' }, canonicalAnswer: 'x = 5',
      steps: body('2x + 1 = 9 -> [subtract 1] -> 2x = 8', '2x = 8 -> [divide by 2] -> x = 4') }))
      .toMatchObject({ status: 'corrected', key: 'x = 4' });
  });

  it('an unreduced key is kept when the problem does not ask for simplest form', () => {
    expect(checkPracticeKey({ problem: { statement: 'Solve 3x = 21.' }, canonicalAnswer: 'x = \\frac{21}{3}',
      steps: body('3x = 21 -> [divide by 3] -> x = 7', 'x = 7 -> [check] -> 3(7) = 21') }).status).toBe('ok');
  });

  it('leaves what it cannot read unchecked', () => {
    expect(checkPracticeKey({ problem: { statement: 'Differentiate.' }, canonicalAnswer: "f'(x) = 2x",
      steps: body('f(x) = x^2 -> [power rule] -> 2x', 'y = 3x + z -> [solve] -> y - z = 3x') }).status).toBe('unchecked');
  });

  it('solveLinear reads implicit products, fractions and TeX', () => {
    expect(solveLinear('4(m + 2) + 14 = 134')).toEqual({ variable: 'm', value: 28 });
    expect(solveLinear('\\frac{x}{2} - 3 = 5')).toEqual({ variable: 'x', value: 16 });
    expect(solveLinear('3 \\cdot y = 1')!.value).toBeCloseTo(1 / 3);
    expect(solveLinear('x^2 = 4')).toBeNull();
    expect(solveLinear('x + y = 4')).toBeNull();
  });
});
