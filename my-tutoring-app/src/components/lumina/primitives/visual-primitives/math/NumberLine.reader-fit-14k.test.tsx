import { describe, expect, it } from 'vitest';
import { isFindBetweenAnswerCorrect } from './numberLineGrading';

describe('NumberLine exact find-between grading', () => {
  it('accepts only the code-owned missing integer when exactTargetValue is present', () => {
    expect(isFindBetweenAnswerCorrect(101, [100, 102], 101, 'integer')).toBe(true);
    expect(isFindBetweenAnswerCorrect(100, [100, 102], 101, 'integer')).toBe(false);
    expect(isFindBetweenAnswerCorrect(102, [100, 102], 101, 'integer')).toBe(false);
  });

  it('preserves the legacy any-interior contract when exactTargetValue is absent', () => {
    expect(isFindBetweenAnswerCorrect(3, [2, 8], undefined, 'integer')).toBe(true);
    expect(isFindBetweenAnswerCorrect(7, [2, 8], undefined, 'integer')).toBe(true);
    expect(isFindBetweenAnswerCorrect(2, [2, 8], undefined, 'integer')).toBe(false);
  });
});
