import type { FractionBarChallenge, FractionBarData } from '../../../primitives/visual-primitives/math/FractionBar';
import { barTask } from '../../../primitives/visual-primitives/math/fractionBarWorkspace';
import { equalWays } from '../../../primitives/visual-primitives/math/fractionEqualBuild';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

const whole = (n: unknown, min: number, max: number): n is number => Number.isInteger(n) && (n as number) >= min && (n as number) <= max;

/** A challenge the bar can run to a correct check: both choices reachable and a shadeable target, or an open build with another way. */
function runnable(type: FractionBarData['challengeType']) {
  return (c: FractionBarChallenge): boolean => {
    if (!c || typeof c.id !== 'string' || !whole(c.denominator, 2, 12)) return false;
    // The open build needs another equal split the bar can make (never the target's own).
    if (type === 'build_equal') return whole(c.numerator, 1, c.denominator - 1) && equalWays(c.numerator, c.denominator).length > 0;
    // compare: two proper fractions and the relation the check expects.
    if (type === 'compare') return whole(c.numerator, 1, c.denominator - 1) && !!c.compareWith
      && whole(c.compareWith.denominator, 2, 12) && whole(c.compareWith.numerator, 1, c.compareWith.denominator - 1)
      && ['<', '=', '>'].includes(c.relation as string);
    return whole(c.numerator, 0, c.denominator) && Array.isArray(c.numeratorChoices) && c.numeratorChoices.includes(c.numerator)
      && Array.isArray(c.denominatorChoices) && c.denominatorChoices.includes(c.denominator);
  };
}

export function validateFractionBarData(value: unknown): FractionBarData {
  const type = (value as FractionBarData | null)?.challengeType;
  if (!['identify', 'build', 'larger_denominators', 'compare', 'add_subtract', 'build_equal'].includes(type as string))
    throw new Error('Generated fraction bar has no known challenge type.');
  return validateChallengePool<FractionBarData>(value, runnable(type as FractionBarData['challengeType']), {
    pool: 'Generated fraction bar has no valid challenges.',
    item: 'A fraction bar challenge cannot run in the lesson.',
  });
}

/** What the live adapter needs from the fraction bar; the catalog's `teachingWorkspace` declares the rest. */
export const fractionBarLiveDomain: WorkspaceDomain<FractionBarData> = {
  validate: validateFractionBarData,
  initialState: d => workspaceOpening({ title: d.title, task: barTask(d.challengeType, d.challenges[0]), total: d.challenges.length }),
};
