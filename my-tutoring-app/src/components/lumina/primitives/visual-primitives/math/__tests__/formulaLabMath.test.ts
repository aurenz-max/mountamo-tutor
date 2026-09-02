import { describe, expect, it } from 'vitest';
import {
  evaluateFormulaExpression,
  validateFormulaExpression,
} from '../formulaLabMath';

describe('formulaLabMath', () => {
  it('evaluates supported formula relationships with standard precedence', () => {
    expect(evaluateFormulaExpression('m * a', { m: 4, a: 3 })).toBe(12);
    expect(evaluateFormulaExpression('0.5 * m * v ^ 2', { m: 2, v: 5 })).toBe(25);
    expect(evaluateFormulaExpression('pi * r ^ 2', { r: 3 })).toBeCloseTo(9 * Math.PI);
  });

  it('supports parentheses and unary signs without executing code', () => {
    expect(evaluateFormulaExpression('-(x - 5) / 2', { x: 1 })).toBe(2);
    expect(validateFormulaExpression('(a + b) / c', ['a', 'b', 'c'])).toBe(true);
  });

  it('rejects undeclared symbols, functions, assignments, and property access', () => {
    expect(validateFormulaExpression('m * hidden', ['m'])).toBe(false);
    expect(validateFormulaExpression('sqrt(r)', ['r'])).toBe(false);
    expect(validateFormulaExpression('x = 4', ['x'])).toBe(false);
    expect(validateFormulaExpression('Math.random()', [])).toBe(false);
  });

  it('returns null for invalid or non-finite evaluations', () => {
    expect(evaluateFormulaExpression('a / b', { a: 4, b: 0 })).toBeNull();
    expect(evaluateFormulaExpression('x ^ 1000', { x: 1000 })).toBeNull();
    expect(evaluateFormulaExpression('x + missing', { x: 2 })).toBeNull();
  });
});

